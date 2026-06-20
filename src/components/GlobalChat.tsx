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
    <div className="flex flex-col h-full w-full relative bg-[#050505] text-white font-sans max-w-7xl mx-auto overflow-hidden">
      {/* Header */}
      <header className="h-[70px] border-b border-[#222] px-4 sm:px-[30px] flex items-center justify-between sticky top-0 z-10 bg-black/50 backdrop-blur-md">
        <div className="flex flex-col">
          <h1 className="text-[16px] sm:text-[18px] font-bold tracking-[1px] m-0 uppercase font-display text-white">SALA GENERAL</h1>
          <div className="text-[9px] sm:text-[10px] text-indigo-400 tracking-[2px] uppercase font-medium">Supervised by Elizabeth AI v2.0</div>
        </div>
        <div className="flex items-center gap-5 text-[#666]">
          <button onClick={() => setShowUserList(!showUserList)} className="hover:text-white transition relative">
            <Users className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></span>
          </button>
          <button onClick={() => setShowSettings(true)} className="hover:text-white transition">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-[30px] py-6 flex flex-col gap-6" style={{ backgroundImage: 'radial-gradient(ellipse at top, #111118 0%, #050505 100%)' }}>
          {messages.map((m, idx) => {
            const isMe = m.sender === currentUser;
            const isEli = m.sender === "Elizabeth";
            return (
              <div key={m.id || idx} className={cn("flex flex-col max-w-[85%] sm:max-w-[70%]", isMe ? "ml-auto items-end" : "items-start")}>
                <div className="text-[11px] text-[#888] mb-1.5 flex items-center gap-1.5 font-medium tracking-wide">
                  {isEli ? (
                    <>
                      <span className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider">ELIZABETH</span>
                      <span className="text-purple-400 font-bold text-[9px] uppercase tracking-widest">Admin AI</span>
                    </>
                  ) : (
                    <span>{m.sender}</span>
                  )}
                </div>
                <div className={cn("px-5 py-3.5 text-[14px] sm:text-[15px] leading-relaxed shadow-sm", isMe ? "bg-indigo-600 text-white rounded-[20px] rounded-br-[4px]" : isEli ? "bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 text-indigo-50 rounded-[20px] rounded-tl-[4px]" : "bg-[#111115] border border-[#222] text-gray-200 rounded-[20px] rounded-tl-[4px]")}>
                  {m.image ? (
                    <img src={m.image} alt="Enviada" className="max-w-[200px] md:max-w-sm rounded-lg object-cover" />
                  ) : m.audio ? (
                    <audio src={m.audio} controls className="max-w-[200px] md:max-w-sm outline-none" />
                  ) : m.text ? (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} className="pb-4" />
        </div>

        {/* User Sidebar Panel */}
        {showUserList && (
          <div className="w-[280px] bg-[#0a0a0c] border-l border-[#222] overflow-y-auto flex-shrink-0 absolute right-0 h-full z-20 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] md:relative md:shadow-none">
            <div className="p-6 border-b border-[#222] sticky top-0 bg-[#0a0a0c] flex justify-between items-start z-10">
              <div>
                <h2 className="m-0 text-[20px] font-bold tracking-[1px] uppercase font-display text-white">Directorio</h2>
                <div className="text-[10px] text-emerald-500 mt-1 font-bold tracking-widest uppercase">Activos - {activeUsers.length}</div>
              </div>
              <button onClick={() => setShowUserList(false)} className="md:hidden text-[#666] hover:text-white p-2">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {activeUsers.map(u => (
                <div 
                  key={u}
                  onClick={() => {
                      if (u !== currentUser) {
                         setPrivateChatUser(u);
                      }
                  }}
                  className={cn("px-6 py-3.5 flex items-center gap-3 transition cursor-pointer group", u !== currentUser ? "hover:bg-[#151518]" : "")}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                  <span className={cn("text-sm tracking-wide", u === currentUser ? "font-bold text-white" : "text-[#aaa] group-hover:text-white")}>{u}</span>
                  {u !== currentUser && <MessageSquare className="w-4 h-4 text-[#444] ml-auto opacity-0 group-hover:opacity-100 transition" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <footer className="h-auto min-h-[90px] py-4 bg-[#0a0a0c] border-t border-[#222] flex flex-col sm:flex-row items-center px-4 sm:px-[30px] gap-3 sm:gap-5 relative z-10">
        <input type="file" accept="image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImageSelect} />
        
        <div className="flex items-center gap-4 text-[#888] w-full sm:w-auto justify-between sm:justify-start px-2 sm:px-0">
          <button onClick={() => fileInputRef.current?.click()} className="hover:text-white transition flex-shrink-0 p-2 sm:p-0">
            <ImageIcon className="w-6 h-6" />
          </button>
          
          <button 
            type="button"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            className={cn("transition flex-shrink-0 p-2 sm:p-0", isRecording ? "text-red-500 animate-pulse scale-110" : "hover:text-white")}
          >
            <Mic className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center flex-1 w-full relative">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={handleKeyDown}
            placeholder="Mensaje a sala general..."
            className="flex-1 bg-[#15151a] border border-[#222] focus:border-indigo-500/50 rounded-xl pl-5 pr-14 py-4 outline-none text-white text-sm transition-all placeholder-[#555]"
          />
          <button 
            onClick={handleSend} 
            disabled={!input.trim()}
            className="absolute right-2 w-10 h-10 bg-indigo-600 text-white rounded-lg flex justify-center items-center hover:bg-indigo-500 disabled:opacity-0 disabled:scale-90 transition-all"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
