import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import { Message } from "../types";
import { Send, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { cn } from "./GlobalChat";

// Basic session storage for demo purposes
const privateSessions: Record<string, Message[]> = {};

export default function PrivateChat({ currentUser, targetUser, onBack, activeUsers }: { currentUser: string; targetUser: string; onBack: () => void; activeUsers: string[] }) {
  const [messages, setMessages] = useState<Message[]>(privateSessions[targetUser] || []);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    privateSessions[targetUser] = messages;
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleReceive = (msg: Message, from: string) => {
      if (from === targetUser || from === currentUser) {
        setMessages(prev => [...prev, msg]);
      }
    };
    socket.on("receive_private", handleReceive);
    return () => {
      socket.off("receive_private", handleReceive);
    };
  }, [targetUser, currentUser]);

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = { id: Date.now().toString(), sender: currentUser, text: input };
    
    socket.emit("send_private", newMsg, targetUser, (res: any) => {
      if (res.success) {
        setMessages(prev => [...prev, newMsg]);
        setInput("");
      } else {
        alert(res.error);
      }
    });
  };

  const isOnline = activeUsers.includes(targetUser);

  return (
    <div className="flex flex-col h-full w-full relative bg-[#050505] text-white font-sans max-w-7xl mx-auto overflow-hidden">
      <header className="h-[70px] bg-black/50 backdrop-blur-md border-b border-[#222] px-4 sm:px-[30px] flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 text-[#666] hover:text-white transition flex items-center gap-2 uppercase font-bold tracking-widest text-[10px]">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:block text-xs">VOLVER</span>
        </button>
        <div className="flex-1 text-center sm:text-left flex items-center gap-3">
          <span className="font-bold text-[16px] sm:text-[18px] tracking-[1px] uppercase font-display">{targetUser}</span>
          <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-[#444]")}></span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-[30px] py-6 flex flex-col gap-6" style={{ backgroundImage: 'radial-gradient(ellipse at top, #111118 0%, #050505 100%)' }}>
        {messages.map((m, idx) => {
          const isMe = m.sender === currentUser;
          return (
            <div key={m.id || idx} className={cn("flex flex-col max-w-[85%] sm:max-w-[70%]", isMe ? "ml-auto items-end" : "items-start")}>
              <div className={cn("px-5 py-3.5 text-[14px] sm:text-[15px] leading-relaxed shadow-sm", isMe ? "bg-indigo-600 text-white rounded-[20px] rounded-br-[4px]" : "bg-[#111115] border border-[#222] text-gray-200 rounded-[20px] rounded-tl-[4px]")}>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} className="pb-4" />
      </div>

      <footer className="h-auto min-h-[90px] py-4 bg-[#0a0a0c] border-t border-[#222] flex items-center px-4 sm:px-[30px] relative z-10">
        <div className="flex items-center flex-1 w-full relative">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder={`Escribe un mensaje a ${targetUser}...`}
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
