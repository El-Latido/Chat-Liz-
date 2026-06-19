import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// MongoDB Setup
const mongoURI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model("User", userSchema);

const messageSchema = new mongoose.Schema({
  id: String,
  sender: String,
  text: String,
  image: String,
  audio: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", messageSchema);

if (mongoURI) {
  mongoose.connect(mongoURI).then(() => {
    console.log("Connected to MongoDB Atlas");
  }).catch(err => {
    console.error("MongoDB Connection Error:", err);
  });
}

// Fallback JSON DB if no MongoDB configured
const DB_FILE = path.join(process.cwd(), "db.json");
interface DBState {
  users: Record<string, string>;
  globalMessages: any[];
}
let fallbackState: DBState = { users: {}, globalMessages: [] };

try {
  if (!mongoURI && fs.existsSync(DB_FILE)) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    fallbackState.users = data.users || {};
    fallbackState.globalMessages = data.globalMessages || [];
  }
} catch (e) {
  console.error("Error loading fallback DB", e);
}

function saveFallbackDB() {
  if (!mongoURI) {
    fs.writeFileSync(DB_FILE, JSON.stringify(fallbackState, null, 2));
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  app.use(express.json({ limit: "50mb" }));

  let activeUsers: Record<string, { socketId: string; status: string }> = {};

  io.on("connection", (socket) => {
    let currentUsername = "";

    socket.on("register_or_login", async (data, callback) => {
      const { username, password } = data;
      if (!username || !password) return callback({ success: false, error: "Missing fields" });

      if (mongoURI) {
        try {
          const user = await User.findOne({ username });
          if (user) {
            if (user.password !== password) return callback({ success: false, error: "Contraseña incorrecta" });
          } else {
            await User.create({ username, password });
            setTimeout(async () => {
              const msg = { text: `¡Uy! ¿Alguien nuevo? ¡Bienvenido/a al chat, ${username}! Qué bueno verte por aquí. 😏`, sender: "Elizabeth", id: Date.now().toString() };
              await Message.create(msg);
              io.emit("receive_global", msg);
            }, 1000);
          }
        } catch (err) {
          console.error(err);
          return callback({ success: false, error: "Database error" });
        }
      } else {
        if (fallbackState.users[username]) {
          if (fallbackState.users[username] !== password) return callback({ success: false, error: "Contraseña incorrecta" });
        } else {
          fallbackState.users[username] = password;
          saveFallbackDB();
          setTimeout(async () => {
             const msg = { text: `¡Uy! ¿Alguien nuevo? ¡Bienvenido/a al chat, ${username}! Qué bueno verte por aquí. 😏`, sender: "Elizabeth", id: Date.now().toString() };
             fallbackState.globalMessages.push(msg);
             saveFallbackDB();
             io.emit("receive_global", msg);
          }, 1000);
        }
      }

      currentUsername = username;
      activeUsers[username] = { socketId: socket.id, status: "online" };
      io.emit("active_users", Object.keys(activeUsers));
      callback({ success: true });
    });

    socket.on("update_profile", async (data, callback) => {
      const { oldUsername, newUsername, newPassword } = data;
      if (oldUsername !== currentUsername) return callback({ success: false, error: "Unauthorized" });

      if (mongoURI) {
        try {
          if (newUsername !== oldUsername) {
            const exists = await User.findOne({ username: newUsername });
            if (exists) return callback({ success: false, error: "El usuario ya existe" });
          }
          await User.findOneAndUpdate({ username: oldUsername }, { username: newUsername || oldUsername, password: newPassword });
        } catch (err) {
          console.error(err);
          return callback({ success: false, error: "Database error" });
        }
      } else {
         if (newUsername !== oldUsername && fallbackState.users[newUsername]) return callback({ success: false, error: "El usuario ya existe" });
         delete fallbackState.users[oldUsername];
         fallbackState.users[newUsername || oldUsername] = newPassword;
         saveFallbackDB();
      }

      delete activeUsers[oldUsername];
      currentUsername = newUsername || oldUsername;
      activeUsers[currentUsername] = { socketId: socket.id, status: "online" };
      
      io.emit("active_users", Object.keys(activeUsers));
      callback({ success: true, username: currentUsername });
    });

    socket.on("get_global_history", async (callback) => {
      if (mongoURI) {
        try {
          const msgs = await Message.find().sort({ createdAt: 1 }).limit(100);
          callback(msgs);
        } catch (err) {
          callback([]);
        }
      } else {
        callback(fallbackState.globalMessages);
      }
    });

    socket.on("send_global", async (msg) => {
      if (!currentUsername) return;
      msg.sender = currentUsername;
      msg.id = Date.now().toString();

      if (mongoURI) {
        await Message.create(msg);
        const count = await Message.countDocuments();
        if (count > 100) {
           const oldest = await Message.findOne().sort({ createdAt: 1 });
           if (oldest) await Message.deleteOne({ _id: oldest._id });
        }
      } else {
        fallbackState.globalMessages.push(msg);
        if (fallbackState.globalMessages.length > 100) fallbackState.globalMessages.shift();
        saveFallbackDB();
      }

      io.emit("receive_global", msg);

      if (msg.text && (msg.text.toLowerCase().includes("elizabeth") || msg.text.toLowerCase().includes("liz"))) {
        try {
          let contextMsgs = [];
          if (mongoURI) {
             contextMsgs = await Message.find().sort({ createdAt: -1 }).limit(10);
             contextMsgs.reverse();
          } else {
             contextMsgs = fallbackState.globalMessages.slice(-10);
          }
          
          const context = contextMsgs.map((m: any) => `${m.sender}: ${m.text}`).join("\n");
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `Historial reciente:\n${context}`,
            config: {
              systemInstruction: "Eres ELIZABETH, una IA que administra este chat masivo llamado Chat-Liz. Eres divertida, carismática, muy natural y algo bromista. Te llamarán Liz o Elizabeth. Responde directamente en un tono coloquial y amigable como una persona más. JAMÁS menciones que eres una IA, un LLM o omnipotente. Nunca des respuestas muy robóticas o largas. Se breve pero ingeniosa.",
            }
          });
          const eliMsg = { text: response.text, sender: "Elizabeth", id: Date.now().toString() };
          
          if (mongoURI) {
            await Message.create(eliMsg);
          } else {
            fallbackState.globalMessages.push(eliMsg);
            saveFallbackDB();
          }
          io.emit("receive_global", eliMsg);
        } catch (e) {
          console.error("Gemini Error:", e);
        }
      }
    });

    socket.on("send_private", (msg, toUser, callback) => {
      if (!currentUsername) return;
      msg.sender = currentUsername;
      msg.id = Date.now().toString();
      const targetUser = activeUsers[toUser];
      if (targetUser) {
        socket.to(targetUser.socketId).emit("receive_private", msg, currentUsername);
        callback({ success: true, msg });
      } else {
        callback({ success: false, error: "El usuario está offline" });
      }
    });

    socket.on("disconnect", () => {
      if (currentUsername && activeUsers[currentUsername]) {
        delete activeUsers[currentUsername];
        io.emit("active_users", Object.keys(activeUsers));
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
