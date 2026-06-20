import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import { Message } from "../types";
import { Send, Image as ImageIcon, MessageSquare, Settings as SettingsIcon, Users, ArrowLeft, Mic } from "lucide-react";
import Settings from "./Settings";
import PrivateChat from "./PrivateChat";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function GlobalChat({ currentUser, onLogout }: { currentUser: string; onLogout: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [privateChatUser, setPrivateChatUser] = useState<string | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    socket.emit("get_global_history", (history: Message[]) => {
      setMessages(history);
      scrollToBottom();
    });

    socket.on("receive_global", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    });

    socket.on("active_users", (users: string[]) => {
      setActiveUsers(users);
    });

    return () => {
      socket.off("receive_global");
      socket.off("active_users");
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    socket.emit("send_global", { text: input });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        socket.emit("send_global", { image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          socket.emit("send_global", { audio: reader.result as string });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (showSettings) {
    return <Settings currentUser={currentUser} onBack={() => setShowSettings(false)} onLogout={onLogout} />;
  }

  if (privateChatUser) {
    return <PrivateChat currentUser={currentUser} activeUsers={activeUsers} targetUser={privateChatUser} onBack={() => setPrivateChatUser(null)} />;
  }

  return (
    <div className="flex bg-zinc-950 text-white font-sans h-[100dvh] w-full overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 absolute z-20 h-full sm:relative",
        showUserList ? "w-64 translate-x-0" : "w-64 -translate-x-full sm:translate-x-0 sm:w-64 md:w-72 hidden sm:flex"
      )}>
        <div className="p-4 sm:p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white font-display">Directory</h2>
            <div className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase mt-1">Online - {activeUsers.length}</div>
          </div>
          <button onClick={() => setShowUserList(false)} className="sm:hidden text-zinc-400 hover:text-white p-2">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-3">
          {activeUsers.map(u => (
            <div 
              key={u}
              onClick={() => {
                  if (u !== currentUser) {
                     setPrivateChatUser(u);
                  }
              }}
              className={cn(
                "px-3 py-3 rounded-lg flex items-center gap-3 transition cursor-pointer group mb-1", 
                u !== currentUser ? "hover:bg-zinc-800/50" : ""
              )}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {u.charAt(0).toUpperCase()}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-900"></div>
              </div>
              <span className={cn("text-sm font-medium tracking-wide flex-1 truncate", u === currentUser ? "text-white" : "text-zinc-300 group-hover:text-white")}>{u}</span>
              {u !== currentUser && <MessageSquare className="w-4 h-4 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-white">
            <SettingsIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Settings & Profile</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-zinc-950">
        {/* Header */}
        <header className="h-[70px] border-b border-zinc-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowUserList(!showUserList)} className="sm:hidden text-zinc-400 hover:text-white p-2 -ml-2 rounded-lg hover:bg-zinc-800/50 transition">
              <Users className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold tracking-tight text-white font-display">General Lounge</h1>
              <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Supervised by Elizabeth AI
              </div>
            </div>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
          {messages.map((m, idx) => {
            const isMe = m.sender === currentUser;
            const isEli = m.sender === "Elizabeth";
            return (
              <div key={m.id || idx} className={cn("flex flex-col max-w-[85%] sm:max-w-[70%]", isMe ? "ml-auto items-end" : "items-start")}>
                <div className="text-[12px] text-zinc-500 mb-1.5 flex items-center gap-2 font-medium px-1">
                  {isEli ? (
                    <>
                      <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wide border border-indigo-500/20">System AI</span>
                      <span className="text-zinc-400">Elizabeth</span>
                    </>
                  ) : (
                    <span>{m.sender}</span>
                  )}
                </div>
                <div className={cn(
                  "px-4 py-3 text-[15px] leading-relaxed shadow-sm", 
                  isMe ? "bg-indigo-600/90 text-white rounded-2xl rounded-tr-sm" : 
                  isEli ? "bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-100 rounded-2xl rounded-tl-sm ring-1 ring-white/5" : 
                  "bg-zinc-800/80 border border-zinc-700/50 text-zinc-200 rounded-2xl rounded-tl-sm"
                )}>
                  {m.image ? (
                    <img src={m.image} alt="Upload" className="max-w-[200px] md:max-w-sm rounded-xl object-cover mb-1 border border-white/10" />
                  ) : m.audio ? (
                    <audio src={m.audio} controls className="max-w-[200px] md:max-w-sm outline-none" />
                  ) : m.text ? (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} className="pb-2" />
        </div>

        {/* Input Area */}
        <footer className="p-4 sm:p-5 bg-zinc-950/80 backdrop-blur-md relative z-10">
          <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageSelect} />
          
          <div className="flex items-end gap-2 max-w-4xl mx-auto w-full relative">
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-2xl p-1 shadow-sm flex-1 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all">
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all h-full self-end"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={handleKeyDown}
                placeholder="Message General Lounge..."
                className="flex-1 bg-transparent border-none px-3 py-3 outline-none text-white text-[15px] placeholder-zinc-500 min-w-0"
              />

              <button 
                type="button"
                onPointerDown={startRecording}
                onPointerUp={stopRecording}
                onPointerLeave={stopRecording}
                className={cn("p-3 rounded-xl transition-all self-end", isRecording ? "text-red-400 bg-red-400/10" : "text-zinc-400 hover:text-white hover:bg-zinc-800")}
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>

            <button 
              onClick={handleSend} 
              disabled={!input.trim() && !isRecording}
              className="h-14 w-14 flex items-center justify-center bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all flex-shrink-0 shadow-sm"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
