import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, MessageCircle, Settings, Bot, 
  Image as ImageIcon, Mic, StopCircle, 
  Menu, X, Hash, MessageSquare, Plus, LogOut, Check
} from 'lucide-react';
import { socket } from './socket';
import { FuturisticCanvas } from './components/FuturisticCanvas';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState({ username: '', password: '' });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', password: '' });
  
  const [activeChat, setActiveChat] = useState('global');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  const [usersOnline, setUsersOnline] = useState<string[]>(['Elizabeth']); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isLoggedIn) return;
    
    if (activeChat === 'global') {
      socket.emit('get_global_history', (historyMsgs: any[]) => {
        setMessages(historyMsgs);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    } else {
      setMessages([]);
    }
    
    socket.on('receive_global', (msg: any) => {
      if (activeChat === 'global') {
          setMessages(prev => [...prev, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });

    socket.on('receive_private', (msg: any, fromUser: string) => {
      if (activeChat === fromUser) {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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

  useEffect(() => {
    if (isLoggedIn) {
      if (activeChat === 'global') {
         socket.emit('get_global_history', (historyMsgs: any[]) => {
           setMessages(historyMsgs);
           setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
         });
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
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
           setAudioUrl(reader.result as string);
        };
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Error al acceder al micrófono");
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
      <div className="h-[100dvh] relative flex items-center justify-center p-6 bg-[#0a0a16] overflow-hidden">
        <FuturisticCanvas />
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-700/20 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-700/20 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="w-full max-w-md bg-gray-950/60 backdrop-blur-3xl p-10 rounded-[2rem] border border-white/10 shadow-2xl z-10">
          <div className="mb-10 text-center">
            <h2 className="text-5xl font-black bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 text-transparent bg-clip-text tracking-tight mb-2">
              Chat-Liz
            </h2>
            <p className="text-gray-400 text-sm font-medium">Neuro-Red de Comunicación Global</p>
          </div>
          
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Identificador</label>
              <input 
                className="w-full bg-black/40 p-4 rounded-xl border border-white/5 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-white placeholder:text-gray-600" 
                placeholder="Ingresa tu nombre..." 
                onChange={e => setUser({...user, username: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Clave de Acceso</label>
              <input 
                className="w-full bg-black/40 p-4 rounded-xl border border-white/5 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-white placeholder:text-gray-600" 
                type="password" 
                placeholder="••••••••" 
                onChange={e => setUser({...user, password: e.target.value})} 
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button 
              onClick={handleLogin} 
              className="w-full mt-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-4 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:-translate-y-0.5 transition-all duration-300"
            >
              Iniciar Conexión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#0a0a16] text-white flex overflow-hidden relative font-sans">
      <FuturisticCanvas />
      
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative z-40 w-72 h-full bg-gray-950/80 backdrop-blur-2xl border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">Chat-Liz</h2>
            <p className="text-xs text-gray-500 mt-1">Conectado como <span className="text-purple-300">{user.username}</span></p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-2 mb-3">Red Global</h3>
            <button 
              onClick={() => { setActiveChat('global'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeChat === 'global' ? 'bg-purple-900/40 border border-purple-500/30 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Hash size={18} className={activeChat === 'global' ? 'text-purple-400' : ''} />
              <span className="font-medium">Global</span>
            </button>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-2 mb-3 flex justify-between items-center">
              <span>Usuarios Conectados</span>
              <span className="bg-purple-900/50 text-purple-300 text-[10px] px-2 py-0.5 rounded-full">{usersOnline.length}</span>
            </h3>
            <div className="space-y-1">
              {usersOnline.map(u => (
                <button
                  key={u}
                  onClick={() => { setActiveChat(u); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${activeChat === u ? 'bg-blue-900/40 border border-blue-500/30 text-white shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="relative">
                      {u === 'Elizabeth' ? (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center p-1">
                          <img src="https://huggingface.co/front/assets/huggingface_logo-noborder.svg" className="w-full h-full object-contain filter invert" alt="HF" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-300 border border-white/10 group-hover:border-white/20 transition-colors">
                          {u.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-gray-950" />
                    </div>
                    <span className="font-medium truncate">{u}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={() => { setProfileForm({ username: user.username, password: user.password }); setIsConfigOpen(true); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all font-medium"
          >
            <Settings size={18} />
            <span>Configuración</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 backdrop-blur-[2px]">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-6 bg-gray-950/40 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {activeChat === 'global' ? (
                  <>
                    <Hash className="text-purple-400" size={24} />
                    <span>Global</span>
                  </>
                ) : (
                  <>
                    <User className="text-blue-400" size={24} />
                    <span>{activeChat}</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeChat === 'global' ? 'Canal de comunicación pública' : 'Mensajería cifrada de extremo a extremo'}
              </p>
            </div>
          </div>
        </header>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4 opacity-50">
              <MessageSquare size={48} className="text-gray-600" />
              <p>No hay mensajes en esta conexión</p>
            </div>
          )}
          {messages.filter((m, i, arr) => 
            // Dedup consecutive identical welcome messages from Elizabeth
            !(i > 0 && m.sender === 'Elizabeth' && m.text === arr[i-1].text)
          ).map((m, idx) => {
            const isMe = m.sender === user.username;
            const isLiz = m.sender === 'Elizabeth' || m.isAi;
            
            // To prevent Elizabeth duplicate welcome spam, we can filter out identical messages
            // but for now we just show them
            
            let bubbleClass = 'bg-gray-800/60 border border-white/5 backdrop-blur-md';
            let alignClass = 'items-start';
            let labelColor = 'text-gray-400';
            
            if (isLiz) {
              bubbleClass = 'bg-gradient-to-br from-purple-900/80 to-pink-900/60 border border-pink-500/30 backdrop-blur-md shadow-[0_4px_20px_rgba(236,72,153,0.15)] text-white';
              labelColor = 'text-pink-300';
            } else if (isMe) {
              bubbleClass = 'bg-indigo-600/90 border border-indigo-400/50 backdrop-blur-md shadow-[0_4px_20px_rgba(79,70,229,0.2)] text-white';
              alignClass = 'items-end';
              labelColor = 'text-indigo-200';
            }
            
            return (
              <div key={m.id || idx} className={`flex flex-col ${alignClass} animate-in slide-in-from-bottom-2 duration-300 group`}>
                <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-800 border border-white/10 flex items-center justify-center overflow-hidden">
                       {isLiz ? (
                          <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center p-1.5">
                             <img src="https://huggingface.co/front/assets/huggingface_logo-noborder.svg" className="w-full h-full object-contain filter invert" alt="HF" />
                          </div>
                       ) : (
                          <span className="text-xs font-bold text-gray-300">{m.sender.charAt(0).toUpperCase()}</span>
                       )}
                    </div>
                  )}

                  <div className={`px-5 py-3.5 rounded-2xl ${bubbleClass} ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'} relative`}>
                    <p className={`text-[10px] font-bold tracking-wider uppercase mb-1.5 ${labelColor}`}>{m.sender}</p>
                    {m.image && <img src={m.image} className="rounded-xl mb-3 max-w-full md:max-w-[300px] border border-white/10" alt="adjunto"/>}
                    {m.audio && (
                      <div className="bg-black/30 p-2 rounded-xl border border-white/5 mb-2 w-full md:w-64">
                         <audio src={m.audio} controls className="w-full h-8 opacity-90" />
                      </div>
                    )}
                    {m.text && <p className="text-[15px] whitespace-pre-wrap leading-relaxed min-w-[20px]">{m.text}</p>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-gray-950/60 backdrop-blur-xl border-t border-white/5 shrink-0">
          <div className="max-w-4xl mx-auto">
            {/* Previews */}
            {(selectedImage || audioUrl) && (
              <div className="flex gap-4 mb-4">
                {selectedImage && (
                  <div className="relative group">
                     <img src={selectedImage} alt="Preview" className="h-24 w-24 rounded-xl border border-purple-500/50 object-cover shadow-lg" />
                     <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-gray-900 border border-white/10 hover:border-red-500 text-gray-400 hover:text-red-500 rounded-full p-1.5 transition-all shadow-xl"><X size={14} /></button>
                  </div>
                )}
                {audioUrl && (
                  <div className="relative flex items-center gap-3 bg-gray-900/80 border border-white/10 px-4 py-2 rounded-xl shadow-lg">
                     <Mic className="text-purple-400 animate-pulse" size={16} />
                     <audio src={audioUrl} controls className="h-8 w-48 opacity-90" />
                     <button onClick={() => setAudioUrl(null)} className="absolute -top-3 -right-3 bg-gray-900 border border-white/10 hover:border-red-500 text-gray-400 hover:text-red-500 rounded-full p-1.5 transition-all shadow-xl"><X size={14} /></button>
                  </div>
                )}
              </div>
            )}

            {/* Input Bar */}
            <div className="flex gap-3 items-end">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
              
              <div className="flex bg-gray-900/80 border border-white/5 backdrop-blur-md rounded-2xl p-1 shadow-inner">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="p-3 text-gray-400 hover:text-purple-400 hover:bg-white/5 rounded-xl transition-all"
                  title="Adjuntar Imagen"
                >
                  <ImageIcon size={22} />
                </button>
                <button 
                  onClick={isRecording ? stopRecording : startRecording} 
                  className={`p-3 rounded-xl transition-all ${isRecording ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-purple-400 hover:bg-white/5'}`}
                  title={isRecording ? "Detener Grabación" : "Grabar Audio"}
                >
                  {isRecording ? <StopCircle size={22} /> : <Mic size={22} />}
                </button>
              </div>

              <div className="flex-1 bg-gray-900/80 border border-white/5 backdrop-blur-md rounded-2xl flex items-center focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all shadow-inner relative">
                <textarea 
                  value={inputValue} 
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full bg-transparent px-5 py-4 outline-none text-[15px] placeholder-gray-500 text-white resize-none max-h-32 min-h-[56px] scrollbar-thin overflow-y-auto" 
                  placeholder="Transmite tu mensaje..."
                  rows={1}
                />
              </div>

              <button 
                onClick={handleSendMessage} 
                disabled={!inputValue.trim() && !selectedImage && !audioUrl}
                className="h-[56px] w-[56px] flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl cursor-pointer flex-shrink-0 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all duration-300 group"
              >
                <Send size={22} className="text-white ml-0.5 group-hover:scale-110 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            {/* Note about shift+enter */}
            <p className="text-[10px] text-gray-600 font-medium mt-2 text-right px-2">Enter para enviar, Shift+Enter para nueva línea</p>
          </div>
        </div>
      </main>

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-gray-950 p-8 rounded-[2rem] border border-white/10 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">Ajustes</h3>
              <button onClick={() => setIsConfigOpen(false)} className="text-gray-500 hover:text-white p-2 bg-gray-900 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Identificador</label>
                <input 
                  className="w-full bg-black/50 p-4 rounded-xl border border-white/5 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-white" 
                  defaultValue={profileForm.username} 
                  onChange={e => setProfileForm({...profileForm, username: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Clave de Acceso</label>
                <input 
                  className="w-full bg-black/50 p-4 rounded-xl border border-white/5 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-white" 
                  type="password" 
                  defaultValue={profileForm.password} 
                  onChange={e => setProfileForm({...profileForm, password: e.target.value})} 
                />
              </div>
              <button 
                onClick={() => {
                  socket.emit('update_profile', { oldUsername: user.username, newUsername: profileForm.username, newPassword: profileForm.password }, (res: any) => {
                    if (res.success) {
                      setUser({ username: profileForm.username, password: profileForm.password });
                      setIsConfigOpen(false);
                    } else {
                      alert(res.error || "Error al actualizar perfil");
                    }
                  });
                }}
                className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white p-4 rounded-xl font-bold transition-colors"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
