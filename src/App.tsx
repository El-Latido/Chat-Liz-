import React, { useState, useEffect, useRef, ErrorInfo, Component } from 'react';
import { 
  Send, User, MessageCircle, Settings, Bot, 
  Image as ImageIcon, Mic, StopCircle, 
  Menu, X, Hash, MessageSquare, LogOut, Search
} from 'lucide-react';
import { socket } from './socket';

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
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
      <div className="h-screen relative flex items-center justify-center p-6 bg-[#f3f4f6] overflow-hidden">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl border border-gray-200 shadow-xl z-10">
          <div className="mb-10 text-center flex flex-col items-center">
            <svg viewBox="0 0 100 100" className="w-16 h-16 mb-4">
               <circle cx="50" cy="50" r="50" fill="#FFD21E"/>
               <circle cx="35" cy="40" r="8" fill="#000"/>
               <circle cx="65" cy="40" r="8" fill="#000"/>
               <path d="M 30 65 Q 50 85 70 65" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round"/>
            </svg>
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight mb-2">
              HuggingChat
            </h2>
            <p className="text-gray-500 text-sm font-medium">Inicia sesión para continuar</p>
          </div>
          
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 pl-1">Identificador</label>
              <input 
                className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 outline-none focus:border-[#FFD21E] focus:ring-2 focus:ring-[#FFD21E]/30 transition-all text-gray-800 placeholder:text-gray-400" 
                placeholder="Ingresa tu nombre..." 
                onChange={e => setUser({...user, username: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 pl-1">Contraseña</label>
              <input 
                className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 outline-none focus:border-[#FFD21E] focus:ring-2 focus:ring-[#FFD21E]/30 transition-all text-gray-800 placeholder:text-gray-400" 
                type="password" 
                placeholder="••••••••" 
                onChange={e => setUser({...user, password: e.target.value})} 
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button 
              onClick={handleLogin} 
              className="w-full mt-4 bg-gray-900 text-white p-4 rounded-xl font-bold hover:bg-gray-800 transition-colors duration-300 flex justify-center items-center gap-2"
            >
              Iniciar Conexión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white text-gray-900 flex overflow-hidden relative font-sans">
      
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed md:relative z-40 w-72 h-full bg-[#f9f9f9] border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out px-4 py-6 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center gap-3 mb-8 px-2">
           <svg viewBox="0 0 100 100" className="w-8 h-8">
               <circle cx="50" cy="50" r="50" fill="#FFD21E"/>
               <circle cx="35" cy="40" r="8" fill="#000"/>
               <circle cx="65" cy="40" r="8" fill="#000"/>
               <path d="M 30 65 Q 50 85 70 65" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round"/>
            </svg>
          <h2 className="text-xl font-bold text-gray-800">HuggingChat</h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-1">
            <button 
              onClick={() => { setActiveChat('global'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeChat === 'global' ? 'bg-white shadow-sm border border-gray-200 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'}`}
            >
              <Hash size={18} className="text-gray-400" />
              <span>Global Chat</span>
              <div className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
            </button>

            {usersOnline.map(u => {
              if (u === 'Elizabeth') {
                 // Elizabeth is our AI
                 return (
                    <button 
                      key={u}
                      onClick={() => { setActiveChat('Elizabeth'); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeChat === 'Elizabeth' ? 'bg-white shadow-sm border border-[#FFD21E] font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'}`}
                    >
                      <Bot size={18} className="text-yellow-500" />
                      <span>Elizabeth (AI)</span>
                      <div className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
                    </button>
                 );
              }
              return (
                <button
                  key={u}
                  onClick={() => { setActiveChat(u); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${activeChat === u ? 'bg-white shadow-sm border border-gray-200 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'}`}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-gray-200 text-gray-600 text-xs font-bold uppercase">
                     {u && typeof u === 'string' ? u.charAt(0) : '?'}
                  </div>
                  <span>{u}</span>
                  <div className="ml-auto w-2 h-2 bg-green-500 rounded-full" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer / User section */}
        <div className="pt-4 border-t border-gray-200 mt-auto">
            <button 
              onClick={() => { setProfileForm({ username: user.username, password: user.password }); setIsConfigOpen(true); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-200 transition-colors"
           >
              <div className="w-8 h-8 rounded-full bg-[#FFD21E] flex items-center justify-center text-black font-bold border border-yellow-400">
                 {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="truncate flex-1 text-left">{user.username}</span>
              <Settings size={18} className="text-gray-500" />
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white relative z-10 h-full">
        
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-gray-500 hover:text-gray-800 p-1">
                  <Menu size={20} />
                </button>
                <div className="flex flex-col">
                  <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                      {activeChat === 'global' ? 'Global Chat' : (activeChat === 'Elizabeth' ? 'Elizabeth (AI)' : `Chatting with ${activeChat}`)}
                  </h2>
                  {activeChat === 'global' && <span className="text-xs font-medium text-gray-500">{usersOnline.length} members online</span>}
                </div>
            </div>
            {activeChat !== 'global' && activeChat !== 'Elizabeth' && (
                <div className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded">Private Chat</div>
            )}
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6 scrollbar-thin">
            {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <svg viewBox="0 0 100 100" className="w-20 h-20 mb-4 opacity-50 grayscale">
                       <circle cx="50" cy="50" r="50" fill="#FFD21E"/>
                       <circle cx="35" cy="40" r="8" fill="#000"/>
                       <circle cx="65" cy="40" r="8" fill="#000"/>
                       <path d="M 30 65 Q 50 85 70 65" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round"/>
                    </svg>
                    <p className="font-semibold text-lg text-gray-500">No hay mensajes aún.</p>
                    <p className="text-sm">¡Sé el primero en enviar algo!</p>
                </div>
            )}
            {messages.filter((m, i, arr) => 
              m && m.sender && !(i > 0 && m.sender === 'Elizabeth' && arr[i-1] && m.text === arr[i-1].text)
            ).map((m, idx) => {
              const isLiz = m.sender === 'Elizabeth' || m.isAi;
              const isMe = m.sender === user.username;
              const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
              const timeStr = isNaN(date.getTime()) ? `10:0${idx % 10}` : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              if (isMe) {
                 return (
                    <div key={m.id || idx} className="flex justify-end mb-4 group max-w-3xl ml-auto">
                        <div className="flex flex-col items-end">
                            <div className="bg-gray-100 text-gray-900 rounded-2xl p-4 sm:px-5 border border-gray-200">
                                <span className="text-[15px] leading-relaxed">{m.text}</span>
                                {m.image && <div className="mt-3"><img src={m.image} className="rounded-xl border border-gray-200 max-w-xs sm:max-w-sm shadow-sm" alt="adjunto"/></div>}
                                {m.audio && <div className="mt-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm"><audio src={m.audio} controls className="h-8 max-w-[200px]" /></div>}
                            </div>
                            <span className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">{timeStr} - You</span>
                        </div>
                    </div>
                 );
              }

              return (
                  <div key={m.id || idx} className="flex gap-4 mb-4 group max-w-4xl mr-auto">
                     <div className="shrink-0 mt-1">
                        {isLiz ? (
                          <div className="w-8 h-8 rounded bg-[#FFD21E] flex items-center justify-center shadow-sm">
                              <svg viewBox="0 0 100 100" className="w-5 h-5">
                                 <circle cx="35" cy="40" r="10" fill="#000"/>
                                 <circle cx="65" cy="40" r="10" fill="#000"/>
                                 <path d="M 30 65 Q 50 85 70 65" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round"/>
                              </svg>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm uppercase">
                             {m.sender?.charAt(0) || '?'}
                          </div>
                        )}
                     </div>
                     <div className="flex flex-col items-start w-full">
                        <div className="flex items-center gap-2 mb-1">
                             <span className="font-semibold text-gray-800 text-sm">
                                {isLiz ? 'Elizabeth' : m.sender}
                             </span>
                             {isLiz && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">AI</span>}
                             <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{timeStr}</span>
                        </div>
                        <div className="text-[15px] leading-relaxed text-gray-800 format-message">
                           {m.text}
                        </div>
                        {m.image && <div className="mt-3"><img src={m.image} className="rounded-xl border border-gray-200 max-w-xs sm:max-w-sm shadow-sm" alt="adjunto"/></div>}
                        {m.audio && <div className="mt-3 bg-gray-50 p-2 rounded-xl border border-gray-200 shadow-sm"><audio src={m.audio} controls className="h-8 max-w-[200px]" /></div>}
                     </div>
                  </div>
              );
            })}
            <div ref={bottomRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="px-4 sm:px-10 pb-6 pt-2 bg-white flex flex-col">
            <div className="max-w-4xl mx-auto w-full relative">
                 {(selectedImage || audioUrl) && (
                   <div className="flex gap-4 mb-4">
                     {selectedImage && (
                       <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                          <img src={selectedImage} alt="Preview" className="h-20 w-20 rounded-xl border border-gray-200 object-cover shadow-sm bg-white" />
                          <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-gray-800 hover:bg-gray-900 transition-colors text-white rounded-full p-1 shadow"><X size={14} /></button>
                       </div>
                     )}
                     {audioUrl && (
                       <div className="relative flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                          <audio src={audioUrl} controls className="h-8 w-48" />
                          <button onClick={() => setAudioUrl(null)} className="absolute -top-2 -right-2 bg-gray-800 hover:bg-gray-900 transition-colors text-white rounded-full p-1 shadow"><X size={14} /></button>
                       </div>
                     )}
                   </div>
                 )}

                 <div className="flex flex-col bg-white border border-gray-300 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-[#FFD21E]/50 focus-within:border-[#FFD21E] transition-all">
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                    <textarea 
                       value={inputValue}
                       onChange={e => setInputValue(e.target.value)}
                       onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                             e.preventDefault();
                             handleSendMessage();
                          }
                       }}
                       rows={1}
                       className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400 text-[15px] px-4 py-3 min-h-[60px] resize-none" 
                       placeholder="Ask anything..."
                    />
                    <div className="flex items-center justify-between px-3 pb-3">
                       <div className="flex items-center gap-1.5">
                           <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Attach file">
                               <ImageIcon size={20} />
                           </button>
                           <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-lg transition-all ${isRecording ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`} title={isRecording ? "Stop recording" : "Record audio"}>
                              {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
                           </button>
                       </div>
                       
                       <button 
                         onClick={handleSendMessage} 
                         disabled={!inputValue.trim() && !selectedImage && !audioUrl}
                         className="bg-gray-900 text-white rounded-xl px-4 py-2 flex items-center justify-center font-medium disabled:opacity-30 hover:bg-gray-800 transition-all text-sm"
                       >
                         Send
                       </button>
                    </div>
                 </div>
            </div>
            <div className="text-center mt-3 text-xs text-gray-400 font-medium">
               HuggingChat style AI interface. AI can make mistakes.
            </div>
        </div>
      </main>

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl relative border border-gray-100">
            <button onClick={() => setIsConfigOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors">
               <X size={20} />
            </button>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
               <Settings size={22} className="text-gray-500" />
               Ajustes de Perfil
            </h2>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Username</label>
                <input 
                   disabled
                   value={profileForm.username}
                   className="w-full bg-gray-100 p-3 rounded-xl border border-gray-200 outline-none text-gray-600 opacity-70 cursor-not-allowed" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Cambiar Contraseña</label>
                <input 
                   value={profileForm.password}
                   onChange={e => setProfileForm({...profileForm, password: e.target.value})}
                   type="password"
                   className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 outline-none focus:border-[#FFD21E] focus:ring-2 focus:ring-[#FFD21E]/20 transition-all text-gray-900" 
                />
              </div>
              <button 
                onClick={() => {
                  socket.emit('update_profile', profileForm, (res: any) => {
                    if (res.success) {
                        setUser({...user, password: profileForm.password});
                        alert("Actualizado");
                        setIsConfigOpen(false);
                    } else {
                        alert(res.error);
                    }
                  });
                }}
                className="w-full mt-4 bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-xl font-bold transition-colors shadow-sm"
               >
                 Guardar Cambios
               </button>
             </div>
             
             <div className="mt-8 pt-6 border-t border-gray-100">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 p-3 rounded-xl font-medium transition-colors"
                >
                  <LogOut size={18} />
                  Cerrar Sesión
                </button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
  }, []);

  return (
    <ErrorBoundary>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          background-color: #ffffff;
          color: #111827;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
      <MainApp />
    </ErrorBoundary>
  );
}
