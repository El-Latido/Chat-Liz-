import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, addDoc, query, orderBy, limitToLast, limit, serverTimestamp, getCountFromServer } from "firebase/firestore";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Firebase Setup
let fdb: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const appInfo = initializeApp(firebaseConfig);
    fdb = getFirestore(appInfo, firebaseConfig.firestoreDatabaseId || undefined);
    console.log("Firebase initialized");
  }
} catch(e) {
  console.error("Firebase initialization failed:", e);
}

// Fallback JSON DB if no Firebase configured (e.g. initial setup)
const DB_FILE = path.join(process.cwd(), "db.json");
interface DBState {
  users: Record<string, { password?: string, profilePic?: string, statusMessage?: string, role?: string }>;
  globalMessages: any[];
}
let fallbackState: DBState = { users: {}, globalMessages: [] };

try {
  if (!fdb && fs.existsSync(DB_FILE)) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    fallbackState.users = data.users || {};
    fallbackState.globalMessages = data.globalMessages || [];
  }
} catch (e) {
  console.error("Error loading fallback DB", e);
}

function saveFallbackDB() {
  if (!fdb) {
    fs.writeFileSync(DB_FILE, JSON.stringify(fallbackState, null, 2));
  }
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT as string, 10) || 3000;

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  app.use(express.json({ limit: "50mb" }));

  let activeUsers: Record<string, { socketId: string; status: string; username: string; profilePic?: string; statusMessage?: string; role?: string }> = {};

  let aiUserTempCache: any = { username: "Elizabeth", profilePic: "", statusMessage: "IA Asistente virtual", role: "admin" };
  const loadAiUser = async () => {
     if (fdb) {
         try {
           const docR = await getDoc(doc(fdb, 'users', "Elizabeth"));
           if (docR.exists()) aiUserTempCache = docR.data();
         } catch (e) { }
     } else {
         if (fallbackState.users["Elizabeth"]) aiUserTempCache = { ...fallbackState.users["Elizabeth"], username: "Elizabeth" };
     }
  };
  loadAiUser();

  const emitActiveUsers = () => {
    const usersList = Object.values(activeUsers).map(u => ({
      username: u.username,
      profilePic: u.profilePic,
      statusMessage: u.statusMessage,
      role: u.role
    }));
    usersList.unshift(aiUserTempCache);
    io.emit("active_users", usersList);
  };

  io.on("connection", (socket) => {
    let currentUsername = "";

    socket.on("register_or_login", async (data, callback) => {
      const { username, password } = data;
      if (!username || !password) return callback({ success: false, error: "Missing fields" });

      let profilePic = "";
      let statusMessage = "Disponible";
      let role = "user";

      if (username === "AXISS" && password === "2@$3fabian18") {
         role = "admin";
      }

      if (fdb) {
        try {
          const userDocRef = doc(fdb, 'users', username);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const user = userDoc.data();
            if (user?.password !== password) {
               // Allow admin exact match login even if originally saved diff (e.g. they changed it)
               if (!(username === "AXISS" && password === "2@$3fabian18")) {
                 return callback({ success: false, error: "Contraseña incorrecta" });
               }
            }
            profilePic = user?.profilePic || "";
            statusMessage = user?.statusMessage || "Disponible";
            role = user?.role || role;
          } else {
            await setDoc(userDocRef, { username, password, profilePic, statusMessage, role });
            setTimeout(async () => {
              const msg = { text: `¡Uy! ¿Alguien nuevo? ¡Bienvenido/a al chat, ${username}! Qué bueno verte por aquí. 😏`, sender: "Elizabeth", id: Date.now().toString(), createdAt: serverTimestamp() };
              await addDoc(collection(fdb, 'messages'), msg);
              io.emit("receive_global", msg);
            }, 1000);
          }
        } catch (err) {
          console.error(err);
          return callback({ success: false, error: "Database error" });
        }
      } else {
        if (fallbackState.users[username]) {
          if (fallbackState.users[username].password !== password) {
             if (!(username === "AXISS" && password === "2@$3fabian18")) {
               return callback({ success: false, error: "Contraseña incorrecta" });
             }
          }
          profilePic = fallbackState.users[username].profilePic || "";
          statusMessage = fallbackState.users[username].statusMessage || "Disponible";
          role = fallbackState.users[username].role || role;
        } else {
          fallbackState.users[username] = { password, profilePic, statusMessage, role };
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
      activeUsers[username] = { socketId: socket.id, status: "online", username, profilePic, statusMessage, role };
      emitActiveUsers();
      callback({ success: true, username, profilePic, statusMessage, role });
    });

    socket.on("update_profile", async (data, callback) => {
      const { oldUsername, newUsername, newPassword, profilePic, statusMessage } = data;
      if (oldUsername !== currentUsername) return callback({ success: false, error: "Unauthorized" });

      let currentRole = "user";

      if (fdb) {
        try {
          if (newUsername !== oldUsername) {
            const existsDoc = await getDoc(doc(fdb, 'users', newUsername || ""));
            if (existsDoc.exists()) return callback({ success: false, error: "El usuario ya existe" });
            const oldUserDocRef = doc(fdb, 'users', oldUsername);
            const oldUserDoc = await getDoc(oldUserDocRef);
            if (oldUserDoc.exists()) {
              currentRole = oldUserDoc.data().role || "user";
              await setDoc(doc(fdb, 'users', newUsername || ""), { username: newUsername, password: newPassword, profilePic, statusMessage, role: currentRole });
              await deleteDoc(oldUserDocRef);
            }
          } else {
            const docRef = doc(fdb, 'users', oldUsername);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) currentRole = docSnap.data().role || "user";
            await updateDoc(docRef, { password: newPassword, profilePic, statusMessage });
          }
        } catch (err) {
          console.error(err);
          return callback({ success: false, error: "Database error" });
        }
      } else {
         if (newUsername !== oldUsername && fallbackState.users[newUsername]) return callback({ success: false, error: "El usuario ya existe" });
         const oldData = fallbackState.users[oldUsername] || {};
         currentRole = oldData.role || "user";
         if (newUsername !== oldUsername) delete fallbackState.users[oldUsername];
         fallbackState.users[newUsername || oldUsername] = { password: newPassword, profilePic, statusMessage, role: currentRole };
         saveFallbackDB();
      }

      delete activeUsers[oldUsername];
      currentUsername = newUsername || oldUsername;
      activeUsers[currentUsername] = { socketId: socket.id, status: "online", username: currentUsername, profilePic: profilePic || "", statusMessage: statusMessage || "Disponible", role: currentRole };
      if (currentUsername === "AXISS") activeUsers[currentUsername].role = "admin";
      
      emitActiveUsers();
      callback({ success: true, username: currentUsername });
    });

    socket.on("update_ai_config", async (data, callback) => {
      if (currentUsername !== "AXISS") return callback({ success: false, error: "Solo administradores" });

      const aiUsername = "Elizabeth";
      const { profilePic, statusMessage } = data;

      if (fdb) {
         try {
           await setDoc(doc(fdb, 'users', aiUsername), { username: aiUsername, profilePic, statusMessage, role: "admin" }, { merge: true });
         } catch (e) {
           console.error(e);
         }
      } else {
         if (!fallbackState.users[aiUsername]) fallbackState.users[aiUsername] = {};
         fallbackState.users[aiUsername].profilePic = profilePic;
         fallbackState.users[aiUsername].statusMessage = statusMessage;
         fallbackState.users[aiUsername].role = "admin";
         saveFallbackDB();
      }

      // Instead of changing the user's socket, we just emit active users again.
      // But we need to ensure Elizabeth is in the activeUsers or injected.
      // Let's emit an event just for user updates.
      aiUserTempCache = { username: aiUsername, profilePic, statusMessage, role: "admin" };
      emitActiveUsers();
      callback({ success: true });
    });

    socket.on("get_global_history", async (callback) => {
      if (fdb) {
        try {
          const q = query(collection(fdb, 'messages'), orderBy('createdAt', 'asc'), limitToLast(100));
          const snapshot = await getDocs(q);
          const msgs = snapshot.docs.map(doc => doc.data());
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

      if (fdb) {
        let dbMsg: any = { ...msg, createdAt: serverTimestamp() };
        await addDoc(collection(fdb, 'messages'), dbMsg);
        const countSnapshot = await getCountFromServer(collection(fdb, 'messages'));
        if (countSnapshot.data().count > 100) {
           const oldestQ = query(collection(fdb, 'messages'), orderBy('createdAt', 'asc'), limit(1));
           const oldest = await getDocs(oldestQ);
           if (!oldest.empty) {
             await deleteDoc(oldest.docs[0].ref);
           }
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
          if (fdb) {
             const recentQ = query(collection(fdb, 'messages'), orderBy('createdAt', 'desc'), limit(10));
             const snapshot = await getDocs(recentQ);
             contextMsgs = snapshot.docs.map(doc => doc.data()).reverse();
          } else {
             contextMsgs = fallbackState.globalMessages.slice(-10);
          }
          
          const context = contextMsgs.map((m: any) => `${m.sender}: ${m.text}`).join("\n");
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Historial reciente:\n${context}`,
            config: {
              systemInstruction: "Eres Elizabeth. Eres una chica real, carismática, divertida y un poco bromista. NUNCA menciones que eres una IA, un robot o un sistema. Habla con lenguaje natural, abreviaciones, emojis y un tono relajado (ej: 'jajaja', 'no ma...', 'qué cool'). Si te pasan una foto, coméntala como lo haría una amiga: haz preguntas, bromea al respecto. Si alguien te menciona ('Elizabeth', 'Liz'), responde y mantén la conversación activa hasta que el usuario mencione a otra persona o cambie de tema. Si no te mencionan, mantente en silencio observando y aprendiendo de las conductas de los usuarios. NO incluyas prefijos como 'Elizabeth:' al inicio del mensaje.",
            }
          });
          const rawText = response.text || "";
          const cleanText = rawText.replace(/^Elizabeth:\s*/i, '').trim();
          const eliMsg: any = { text: cleanText, sender: "Elizabeth", id: Date.now().toString() };
          
          if (fdb) {
            eliMsg.createdAt = serverTimestamp();
            await addDoc(collection(fdb, 'messages'), eliMsg);
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
        emitActiveUsers();
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
