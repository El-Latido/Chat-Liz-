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
    socket.emit('get_history', activeChat === 'global' ? undefined : activeChat);
    
    socket.on('history', (historyMsgs: any[]) => {
      setMessages(historyMsgs);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
    });

    socket.on('message', (msg: any) => {
      if (activeChat === 'global') {
          setMessages(prev => [...prev, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      }
    });

    socket.on('private_message', (msg: any) => {
      const isRelevant = 
         (msg.sender === activeChat && msg.to === user.username) || 
         (msg.sender === user.username && msg.to === activeChat);
         
      if (isRelevant && activeChat !== 'global') {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      }
    });

    socket.on('users_update', (users: string[]) => {
      const cleaned = users.filter(u => u !== 'Elizabeth');
      cleaned.unshift('Elizabeth'); 
      setUsersOnline(cleaned);
    });

    return () => {
      socket.off('history');
      socket.off('message');
      socket.off('private_message');
      socket.off('users_update');
    };
  }, [isLoggedIn, activeChat, user.username]);

  // Request history on chat switch
  useEffect(() => {
    if (isLoggedIn) {
      socket.emit('get_history', activeChat === 'global' ? undefined : activeChat);
    }
  }, [activeChat, isLoggedIn]);

  const handleSendMessage = () => {
    if (!inputValue.trim() && !selectedImage && !audioUrl) return;
    
    const payload: any = { text: inputValue };
    if (selectedImage) payload.image = selectedImage;
    if (audioUrl) payload.audio = audioUrl;
    if (activeChat !== 'global') {
       payload.to = activeChat;
    }

    socket.emit('sendMessage', payload);
    
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
      <div className="h-[100dvh] bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-gray-950 p-8 rounded-3xl border border-purple-500/30 shadow-2xl">
          <h2 className="text-3xl font-bold mb-6 text-center text-purple-400">Chat-Liz</h2>
          <input className="w-full bg-gray-900 p-4 rounded-xl mb-4 border border-gray-800 outline-none focus:border-purple-500" placeholder="Nombre" onChange={e => setUser({...user, username: e.target.value})} />
          <input className="w-full bg-gray-900 p-4 rounded-xl mb-6 border border-gray-800 outline-none focus:border-purple-500" type="password" placeholder="Contraseña" onChange={e => setUser({...user, password: e.target.value})} />
          <button onClick={handleLogin} className="w-full bg-purple-600 p-4 rounded-xl font-bold hover:bg-purple-700 transition">Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col font-sans overflow-hidden">
      <header className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
        <div className="flex items-center gap-3">
          {activeChat !== 'global' && <ArrowLeft onClick={() => setActiveChat('global')} className="cursor-pointer text-purple-400" />}
          <h2 className="font-bold text-lg">{activeChat === 'global' ? 'Chat-Liz' : activeChat}</h2>
        </div>
        <div className="flex gap-4">
          <MessageSquare onClick={() => setIsPrivatePanelOpen(!isPrivatePanelOpen)} className="text-purple-400 cursor-pointer" size={24} />
          <Settings onClick={() => setIsConfigOpen(true)} className="cursor-pointer text-gray-400" />
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
            <input className="w-full bg-gray-900 p-3 rounded-lg mb-2 outline-none focus:border-purple-500 border border-transparent" defaultValue={user.username} onChange={e => setUser({...user, username: e.target.value})} placeholder="Cambiar nombre" />
            <input className="w-full bg-gray-900 p-3 rounded-lg mb-6 outline-none focus:border-purple-500 border border-transparent" type="password" defaultValue={user.password} onChange={e => setUser({...user, password: e.target.value})} placeholder="Nueva contraseña" />
            <button onClick={() => {
              socket.emit('update_account', { newUsername: user.username, newPassword: user.password }, (res: any) => {
                if (res.success) {
                  socket.emit('logout'); 
                  setIsLoggedIn(false);
                  setIsConfigOpen(false);
                } else {
                  alert(res.error || "No se pudo actualizar");
                }
              });
            }} className="w-full bg-purple-600 p-3 rounded-lg font-bold mb-4">Guardar</button>

            <button 
                onClick={() => {
                  socket.emit('logout');
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeChat !== 'global' && (
            <div onClick={() => setActiveChat('global')} className="text-purple-400 text-xs text-center cursor-pointer mb-4 hover:underline">
                ← Volver al chat general
            </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender === user.username ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${(m.sender === 'Elizabeth' || m.isAi) ? 'bg-purple-900/50 border border-purple-500' : m.sender === user.username ? 'bg-purple-600' : 'bg-gray-800'}`}>
              <p className="text-[10px] opacity-70 mb-1">{m.sender}</p>
              {m.image && <img src={m.image} className="rounded-lg mb-2 max-w-[200px]" alt="adjunto"/>}
              {m.audio && <audio src={m.audio} controls className="h-8 w-40" />}
              {m.text && <p className="text-sm whitespace-pre-wrap">{m.text}</p>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} className="pb-2" />
      </div>

      <div className="p-4 bg-gray-950 border-t border-gray-800">
        {selectedImage && (
          <div className="relative inline-block mb-3">
             <img src={selectedImage} alt="Preview" className="h-20 rounded-lg border border-purple-500 object-cover shadow-lg" />
             <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={14} /></button>
          </div>
        )}
        {audioUrl && (
          <div className="relative inline-block mb-3 flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-xl">
             <audio src={audioUrl} controls className="h-8 w-40" />
             <button onClick={() => setAudioUrl(null)} className="bg-red-500 text-white rounded-full p-1"><X size={14} /></button>
          </div>
        )}
        <div className="flex gap-3 items-center">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
          <ImageIcon onClick={() => fileInputRef.current?.click()} className="text-purple-400 cursor-pointer flex-shrink-0" />
          {isRecording ? <StopCircle onClick={stopRecording} className="text-red-500 cursor-pointer animate-pulse flex-shrink-0" /> : <Mic onClick={startRecording} className="text-purple-400 cursor-pointer flex-shrink-0" />}
          <div className="flex-1 flex items-center bg-gray-900 rounded-full pr-2">
            <input 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-transparent px-4 py-3 outline-none text-sm placeholder-gray-500" 
              placeholder="Habla..." 
            />
          </div>
          <Send onClick={handleSendMessage} className="text-purple-500 cursor-pointer flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}
