import React, { useState, useEffect, useRef, ErrorInfo, Component } from 'react';
import { 
  Send, User, MessageCircle, Settings, Bot, 
  Image as ImageIcon, Mic, StopCircle, 
  Menu, X, Hash, MessageSquare, Plus, LogOut, Check, Search
} from 'lucide-react';
import { socket } from './socket';
import { FuturisticCanvas } from './components/FuturisticCanvas';

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: 'red', color: 'white', zIndex: 9999, position: 'relative' }}>
          <h1>Algo salió mal en la aplicación.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
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
      <div className="h-screen relative flex items-center justify-center p-6 bg-[#0a0a16] overflow-hidden">
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
    <div className="h-screen bg-[#0a0a16] text-white flex overflow-hidden relative font-sans">
      <FuturisticCanvas />
      
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed md:relative z-40 w-80 h-full bg-[#1e2130] border-r border-[#2d3148] flex flex-col transition-transform duration-300 ease-in-out px-4 py-6 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="text-cyan-400">
             <MessageSquare size={28} className="stroke-[1.5]" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 text-transparent bg-clip-text">Chat-Liz</h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Main User (Elizabeth) */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4 group cursor-pointer" onClick={() => { setActiveChat('Elizabeth'); setIsSidebarOpen(false); }}>
               <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-30 rounded-full group-hover:opacity-50 transition-opacity"></div>
               <div className="w-24 h-24 rounded-full border-2 border-cyan-400/80 p-1 relative z-10 bg-[#1e2130]">
                  <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-cyan-400/30">
                     <Bot size={48} className="text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  </div>
               </div>
            </div>

            <button 
              onClick={() => { setActiveChat('Elizabeth'); setIsSidebarOpen(false); }}
              className={`w-full relative flex flex-col px-4 py-3 rounded-2xl transition-all ${activeChat === 'Elizabeth' ? 'bg-[#2a2e42] border border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'border border-transparent hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                 <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-cyan-500/50 overflow-hidden shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                        <Bot size={20} className="text-cyan-300" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-cyan-400 rounded-full border-2 border-[#1e2130]" />
                 </div>
                 <div className="flex flex-col items-start w-full">
                    <span className="font-bold text-gray-100 flex items-center justify-between w-full">
                        ELIZABETH (IA) <span className="text-cyan-400 font-normal">~</span>
                    </span>
                    <span className="text-xs text-cyan-400 font-medium tracking-wider">online</span>
                 </div>
              </div>
            </button>
          </div>

          <div className="space-y-1">
            <button 
              onClick={() => { setActiveChat('global'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group ${activeChat === 'global' ? 'bg-[#2a2e42] border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'border border-transparent hover:bg-white/5'}`}
            >
              <div className="w-10 h-10 rounded-full bg-[#13141f] flex items-center justify-center text-purple-300 border border-purple-500/30 group-hover:border-purple-500/50">
                <Hash size={18} />
              </div>
              <span className="font-semibold text-gray-200">Global</span>
              <div className="ml-auto w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.6)]" />
            </button>

            {usersOnline.map(u => {
              if (u === 'Elizabeth') return null; // Already rendered above
              return (
                <button
                  key={u}
                  onClick={() => { setActiveChat(u); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group ${activeChat === u ? 'bg-[#2a2e42] border border-slate-600 shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'border border-transparent hover:bg-white/5'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#13141f] flex items-center justify-center text-gray-300 border border-white/10 group-hover:border-white/20 font-bold overflow-hidden">
                     {u && typeof u === 'string' ? u.charAt(0).toUpperCase() : '?'}
                  </div>
                  <span className="font-semibold text-gray-200 flex items-center gap-2">
                     {u} <span className="text-gray-500 font-normal">~</span>
                  </span>
                  <div className="ml-auto w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.6)]" />
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#13141f] p-4 md:p-6 pb-6 relative z-10">
        
        {/* Top Right User Info & Settings */}
        <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
           <div className="flex items-center gap-3 bg-[#1e2130] border border-cyan-500/30 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <div className="w-8 h-8 rounded-full bg-cyan-900 flex items-center justify-center text-sm font-bold border border-cyan-500/50 text-cyan-100">
                 {user && typeof user.username === 'string' && user.username.length > 0 ? user.username.charAt(0).toUpperCase() : '?'}
              </div>
              <span className="font-semibold text-gray-200 pr-2">{user.username}</span>
           </div>
           
           <button 
              onClick={() => { setProfileForm({ username: user.username, password: user.password }); setIsConfigOpen(true); }}
              className="p-2.5 bg-[#1e2130] border border-white/10 text-gray-300 rounded-xl hover:text-white hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all"
           >
              <Settings size={20} />
           </button>
        </div>

        {/* Chat Window Container */}
        <div className="flex-1 flex flex-col mt-20 border border-cyan-500/40 rounded-[2rem] bg-[#1e2130]/90 backdrop-blur-xl shadow-[0_0_40px_rgba(6,182,212,0.15),inset_0_0_20px_rgba(168,85,247,0.05)] overflow-hidden relative">
           
           {/* Inner glow gradients */}
           <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-70"></div>
           
           {/* Chat Header */}
           <div className="flex items-center justify-between px-6 py-5 border-b border-[#2d3148] bg-[#1e2130]">
              <div className="flex items-center gap-3">
                 <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-300 hover:text-white p-1">
                   <Menu size={20} />
                 </button>
                 <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2 tracking-wide uppercase">
                    {activeChat === 'global' ? 'CHAT GLOBAL #1 - Chat-Liz' : `Private Chat: ${activeChat}`}
                    {activeChat === 'global' && <span className="text-sm font-normal text-gray-400 capitalize">({usersOnline.length} usuarios online)</span>}
                 </h2>
              </div>
              {activeChat === 'global' && (
                 <button className="flex items-center gap-2 text-gray-300 bg-[#2a2e42] border border-white/10 px-4 py-1.5 rounded-full hover:bg-[#343851] hover:border-white/20 transition-all shadow-inner text-sm font-medium">
                    <MessageSquare size={16} className="text-cyan-400" />
                    Private chat
                    <Search size={16} className="ml-1 opacity-50" />
                 </button>
              )}
           </div>

           {/* Chat Feed */}
           <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
              {messages.filter((m, i, arr) => 
                m && m.sender && !(i > 0 && m.sender === 'Elizabeth' && arr[i-1] && m.text === arr[i-1].text)
              ).map((m, idx) => {
                const isLiz = m.sender === 'Elizabeth' || m.isAi;
                // Generate a dummy timestamp if missing
                const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                const timeStr = isNaN(date.getTime()) ? `10:0${idx % 10}` : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                   <div key={m.id || idx} className="text-[16px] font-medium leading-relaxed font-sans mb-4 group">
                      <span className="text-gray-500 mr-2 opacity-80 group-hover:opacity-100 transition-opacity">[{timeStr}]</span>
                      <span className={`font-bold mr-2 ${isLiz ? 'text-cyan-400' : 'text-blue-400'}`}>
                         {isLiz ? 'ELIZABETH (IA Administradora Gemini ✨):' : `${m.sender}:`}
                      </span>
                      <span className={isLiz ? 'text-gray-100' : 'text-gray-300'}>
                         {m.text}
                      </span>
                      {m.image && <div className="ml-[60px] mt-3"><img src={m.image} className="rounded-xl border border-cyan-500/30 max-w-[300px] shadow-lg" alt="adjunto"/></div>}
                      {m.audio && <div className="ml-[60px] mt-3 bg-[#13141f] p-2 rounded-xl inline-block border border-white/10 shadow-inner"><audio src={m.audio} controls className="h-8 max-w-[250px] filter opacity-90" /></div>}
                   </div>
                );
              })}
              <div ref={bottomRef} className="h-4" />
           </div>

           {/* Input Area */}
           <div className="px-6 py-5 bg-[#1e2130] flex flex-col border-t border-[#2d3148]">
             {(selectedImage || audioUrl) && (
               <div className="flex gap-4 mb-4">
                 {selectedImage && (
                   <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                      <img src={selectedImage} alt="Preview" className="h-20 w-20 rounded-xl border-2 border-cyan-500 object-cover shadow-lg" />
                      <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                   </div>
                 )}
                 {audioUrl && (
                   <div className="relative flex items-center gap-3 bg-[#13141f] px-4 py-2 rounded-xl border border-[#2d3148] shadow-lg animate-in fade-in slide-in-from-bottom-2">
                      <audio src={audioUrl} controls className="h-8 w-48 opacity-90" />
                      <button onClick={() => setAudioUrl(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                   </div>
                 )}
               </div>
             )}

             <div className="flex items-center gap-3 w-full">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                <div className="flex-1 bg-[#13141f] border border-[#2d3148] rounded-full flex items-center px-5 py-3 relative shadow-inner focus-within:border-cyan-500/50 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all">
                   <input 
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSendMessage();
                      }}
                      className="w-full bg-transparent outline-none text-gray-200 placeholder-gray-500 text-[16px]" 
                      placeholder="Escribe tu mensaje... @Elizabeth para IA carismática 😉"
                   />
                   <div className="flex items-center gap-4 text-gray-400 ml-3">
                       <MessageCircle size={22} className="opacity-50" />
                       <div className="h-5 w-[1px] bg-white/10"></div>
                       <ImageIcon onClick={() => fileInputRef.current?.click()} className="cursor-pointer hover:text-cyan-400 transition-colors" size={22} />
                       <button onClick={isRecording ? stopRecording : startRecording} className={`flex items-center justify-center cursor-pointer transition-all ${isRecording ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse scale-110' : 'hover:text-cyan-400'}`}>
                          {isRecording ? <StopCircle size={22} /> : <Mic size={22} />}
                       </button>
                   </div>
                </div>
                
                <button 
                  onClick={handleSendMessage} 
                  disabled={!inputValue.trim() && !selectedImage && !audioUrl}
                  className="bg-gradient-to-br from-cyan-500 to-teal-400 rounded-full h-12 w-12 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:shadow-none hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:scale-105 transition-all duration-300 text-white shrink-0 ml-1"
                >
                  <Send size={22} className="ml-0.5" />
                </button>
             </div>
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

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
