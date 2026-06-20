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
    <div className="flex flex-col h-full w-full relative bg-zinc-950 text-white font-sans max-w-7xl mx-auto overflow-hidden">
      <header className="h-[70px] bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-6 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition flex items-center gap-2 uppercase font-bold tracking-widest text-[10px]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {targetUser.charAt(0).toUpperCase()}
            </div>
            {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950"></div>}
          </div>
          <span className="font-bold text-lg tracking-tight text-white font-display">{targetUser}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col gap-6 bg-zinc-950">
        {messages.map((m, idx) => {
          const isMe = m.sender === currentUser;
          return (
            <div key={m.id || idx} className={cn("flex flex-col max-w-[85%] sm:max-w-[70%]", isMe ? "ml-auto items-end" : "items-start")}>
              <div className={cn(
                "px-4 py-3 text-[15px] leading-relaxed shadow-sm", 
                isMe ? "bg-indigo-600/90 text-white rounded-2xl rounded-tr-sm" : 
                "bg-zinc-800/80 border border-zinc-700/50 text-zinc-200 rounded-2xl rounded-tl-sm"
              )}>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} className="pb-4" />
      </div>

      <footer className="p-4 sm:p-5 bg-zinc-950/80 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full relative">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-2xl p-1 shadow-sm flex-1 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder={`Message ${targetUser}...`}
              className="flex-1 bg-transparent border-none pl-4 pr-3 py-3 outline-none text-white text-[15px] placeholder-zinc-500 min-w-0"
            />
          </div>
          <button 
            onClick={handleSend} 
            disabled={!input.trim()}
            className="h-14 w-14 flex items-center justify-center bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all flex-shrink-0 shadow-sm"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </div>
      </footer>
    </div>
  );
}
