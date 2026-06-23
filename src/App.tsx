import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, MessageCircle, Settings, Bot, 
  Image as ImageIcon, Mic, StopCircle, 
  ChevronLeft, Users, ArrowLeft, LogOut, Check, X,
  Search, MoreVertical, MessageSquare
} from 'lucide-react';
import { socket } from './socket';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState({ username: '', password: '' });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', password: '' });
  
  const [activeChat, setActiveChat] = useState('global');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  const [isPrivatePanelOpen, setIsPrivatePanelOpen] = useState(false);
  const [usersOnline, setUsersOnline] = useState<string[]>(['Elizabeth']); 

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Authenticate
  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user.username || !user.password) return;
    
    socket.emit('register_or_login', user, (res: any) => {
      if (res.success) {
        setIsLoggedIn(true);
      } else {
        alert(res.error || 'Error al iniciar sesión');
      }
    });
  };

  // Socket sync
  useEffect(() => {
    if (!isLoggedIn) return;
    
    if (activeChat === 'global') {
      socket.emit('get_global_history', (historyMsgs: any[]) => {
        setMessages(historyMsgs);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      });
    } else {
      setMessages([]);
    }
    
    socket.on('receive_global', (msg: any) => {
      if (activeChat === 'global') {
          setMessages(prev => [...prev, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      }
    });

    socket.on('receive_private', (msg: any, fromUser: string) => {
      if (activeChat === fromUser) {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      }
    });

    socket.on('active_users', (users: string[]) => {
      const cleaned = users.filter((u: string) => u !== 'Elizabeth' && u !== user.username);
      cleaned.unshift('Elizabeth'); 
      setUsersOnline(cleaned);
    });

    return () => {
      socket.off('receive_global');
      socket.off('receive_private');
      socket.off('active_users');
    };
  }, [isLoggedIn, activeChat, user.username]);

  // Request history on chat switch
  useEffect(() => {
    if (isLoggedIn) {
      if (activeChat === 'global') {
         socket.emit('get_global_history', (historyMsgs: any[]) => setMessages(historyMsgs));
      } else {
         setMessages([]);
      }
    }
  }, [activeChat, isLoggedIn]);

  const handleSendMessage = () => {
    if (!inputValue.trim() && !selectedImage && !audioUrl) return;
    
    const payload: any = { text: inputValue };
    if (selectedImage) payload.image = selectedImage;
    if (audioUrl) payload.audio = audioUrl;

    if (activeChat === 'global') {
      socket.emit('send_global', payload);
    } else {
      socket.emit('send_private', payload, activeChat, (res: any) => {
         if (res.success) {
            setMessages(prev => [...prev, res.msg]);
            setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
         } else {
            alert(res.error || "No se pudo enviar");
         }
      });
    }
    
    setInputValue('');
    setSelectedImage(null);
    setAudioUrl(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = () => setAudioUrl(reader.result as string);
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="h-[100dvh] relative flex items-center justify-center p-6 bg-gray-900 overflow-hidden">
        {/* Colorful gradient background decoration */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/30 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-pink-600/30 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="w-full max-w-sm bg-gray-950/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl z-10 relative">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 text-transparent bg-clip-text">
              Chat-Liz
            </h2>
            <p className="text-gray-400 text-sm mt-2 font-medium">Únete a la conversación</p>
          </div>
          
          <div className="space-y-4">
            <input 
              className="w-full bg-gray-900/50 p-4 rounded-xl border border-gray-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all placeholder:text-gray-600" 
              placeholder="¿Cómo te llamas?" 
              onChange={e => setUser({...user, username: e.target.value})} 
            />
            <input 
              className="w-full bg-gray-900/50 p-4 rounded-xl border border-gray-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all placeholder:text-gray-600" 
              type="password" 
              placeholder="Contraseña" 
              onChange={e => setUser({...user, password: e.target.value})} 
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button 
              onClick={handleLogin} 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-xl font-bold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] transition-all"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gray-950 text-white flex flex-col font-sans overflow-hidden relative">
      {/* Background ambient light */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="p-4 border-b border-white/5 flex justify-between items-center bg-gray-950/80 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          {activeChat !== 'global' && <ArrowLeft onClick={() => setActiveChat('global')} className="cursor-pointer text-pink-400 hover:text-pink-300 transition" />}
          <h2 className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
            {activeChat === 'global' ? 'Chat Global' : activeChat}
          </h2>
        </div>
        <div className="flex gap-4 items-center">
          <MessageSquare onClick={() => setIsPrivatePanelOpen(!isPrivatePanelOpen)} className="text-purple-400 hover:text-purple-300 cursor-pointer transition" size={24} />
          <Settings onClick={() => { setProfileForm({ username: user.username, password: user.password }); setIsConfigOpen(true); }} className="cursor-pointer text-gray-400 hover:text-white transition" size={24} />
        </div>
      </header>

      {isPrivatePanelOpen && (
        <div className="absolute inset-0 z-50 bg-black/95 p-6 animate-in fade-in duration-200">
          <div className="flex justify-between mb-8">
            <h2 className="text-2xl font-bold">Chats Privados</h2>
            <X onClick={() => setIsPrivatePanelOpen(false)} className="cursor-pointer" />
          </div>
          <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            {usersOnline.map(u => (
              <div key={u} onClick={() => { if(u !== user.username) { setActiveChat(u); setIsPrivatePanelOpen(false); } }} className="p-4 bg-gray-900 rounded-xl flex items-center justify-between cursor-pointer">
                <span>{u} {u === user.username && '(Tú)'}</span>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {isConfigOpen && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-gray-950 p-8 rounded-3xl border border-purple-500 w-full max-w-sm relative">
            <div className="flex justify-between mb-4">
              <h3 className="text-xl font-bold">Configuración</h3>
              <X onClick={() => setIsConfigOpen(false)} className="cursor-pointer" />
            </div>
            <input className="w-full bg-gray-900 p-3 rounded-lg mb-2 outline-none focus:border-purple-500 border border-transparent" defaultValue={profileForm.username} onChange={e => setProfileForm({...profileForm, username: e.target.value})} placeholder="Cambiar nombre" />
            <input className="w-full bg-gray-900 p-3 rounded-lg mb-6 outline-none focus:border-purple-500 border border-transparent" type="password" defaultValue={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} placeholder="Nueva contraseña" />
            <button onClick={() => {
              socket.emit('update_profile', { oldUsername: user.username, newUsername: profileForm.username, newPassword: profileForm.password }, (res: any) => {
                if (res.success) {
                  setUser({ username: profileForm.username, password: profileForm.password });
                  setIsConfigOpen(false);
                } else {
                  alert(res.error || "No se pudo actualizar");
                }
              });
            }} className="w-full bg-purple-600 p-3 rounded-lg font-bold mb-4">Guardar</button>

            <button 
                onClick={() => {
                  socket.disconnect();
                  socket.connect();
                  setIsLoggedIn(false);
                  setIsConfigOpen(false);
                }} 
                className="w-full flex justify-center items-center gap-2 border border-red-500/50 text-red-400 p-3 rounded-lg font-bold hover:bg-red-500/10 transition"
              >
                <LogOut size={16} /> Cerrar Sesión
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {activeChat !== 'global' && (
            <div onClick={() => setActiveChat('global')} className="text-pink-400 text-xs text-center cursor-pointer mb-6 hover:underline hover:text-pink-300">
                ← Volver al chat general
            </div>
        )}
        {messages.map(m => {
          const isMe = m.sender === user.username;
          const isLiz = m.sender === 'Elizabeth' || m.isAi;
          
          let bubbleClass = 'bg-gray-800/80 border border-white/5';
          if (isLiz) {
            bubbleClass = 'bg-gradient-to-br from-purple-900/60 to-pink-900/40 border border-pink-500/30 backdrop-blur-sm shadow-lg shadow-purple-900/20';
          } else if (isMe) {
            bubbleClass = 'bg-blue-600 border border-blue-500/50 shadow-lg shadow-blue-900/20';
          }
          
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-4 py-3 rounded-2xl max-w-[85%] ${bubbleClass} ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                <p className={`text-[10px] font-bold tracking-wider uppercase mb-1 ${isLiz ? 'text-pink-300' : isMe ? 'text-blue-200' : 'text-gray-400'}`}>{m.sender}</p>
                {m.image && <img src={m.image} className="rounded-lg mb-2 max-w-[200px]" alt="adjunto"/>}
                {m.audio && <audio src={m.audio} controls className="h-8 w-40 mt-2 filter brightness-110" />}
                {m.text && <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isMe ? 'text-white' : 'text-gray-100'}`}>{m.text}</p>}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} className="pb-2" />
      </div>

      <div className="p-4 bg-gray-950/80 backdrop-blur-md border-t border-white/5 relative z-10">
        {selectedImage && (
          <div className="relative inline-block mb-3">
             <img src={selectedImage} alt="Preview" className="h-20 rounded-lg border border-pink-500 object-cover shadow-lg" />
             <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition"><X size={14} /></button>
          </div>
        )}
        {audioUrl && (
          <div className="relative inline-block mb-3 flex items-center gap-2 bg-gray-900 border border-white/5 px-3 py-1 rounded-xl">
             <audio src={audioUrl} controls className="h-8 w-40 filter brightness-110" />
             <button onClick={() => setAudioUrl(null)} className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition"><X size={14} /></button>
          </div>
        )}
        <div className="flex gap-3 items-center">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
          <div onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-900 border border-white/10 rounded-full text-purple-400 cursor-pointer flex-shrink-0 hover:bg-purple-900/30 hover:border-purple-500/50 hover:text-purple-300 transition-all shadow-md">
            <ImageIcon size={20} />
          </div>
          <div onClick={isRecording ? stopRecording : startRecording} className={`p-3 bg-gray-900 border border-white/10 rounded-full cursor-pointer flex-shrink-0 transition-all shadow-md ${isRecording ? 'text-red-500 animate-pulse border-red-500/50 bg-red-900/20' : 'text-purple-400 hover:bg-purple-900/30 hover:border-purple-500/50 hover:text-purple-300'}`}>
            {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
          </div>
          <div className="flex-1 flex items-center bg-gray-900 border border-white/10 rounded-full pr-2 focus-within:border-pink-500/50 focus-within:ring-1 focus-within:ring-pink-500/30 transition-all shadow-inner">
            <input 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-transparent px-5 py-3 outline-none text-sm placeholder-gray-500 text-white" 
              placeholder="Habla..." 
            />
          </div>
          <button onClick={handleSendMessage} className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full cursor-pointer flex-shrink-0 hover:scale-105 shadow-lg shadow-purple-500/30 hover:shadow-pink-500/50 transition-all">
            <Send size={20} className="text-white ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
