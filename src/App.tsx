import React, { useState, useEffect, useRef, ErrorInfo, Component } from 'react';
import { 
  Send, User, MessageCircle, Settings, Bot, 
  Image as ImageIcon, Mic, StopCircle, 
  Menu, X, Hash, MessageSquare, LogOut, Search,
  Paperclip, Smile, Globe, Box, Volume2, VolumeX, Users, UserPlus, AlertCircle
} from 'lucide-react';
import { collection, onSnapshot, query, doc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { socket } from './socket';
import { UserObj, MessageObj } from './types';
import { Login } from './components/Login';
import { RecoveryModal } from './components/RecoveryModal';
import { ProfileConfigModal } from './components/ProfileConfigModal';
import { AdminConfigLizModal } from './components/AdminConfigLizModal';
import { EmojiGifPicker } from './components/EmojiGifPicker';

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    // @ts-ignore
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    // @ts-ignore
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: 'red', color: 'white', zIndex: 9999, position: 'relative' }}>
          <h1>Algo salió mal en la aplicación.</h1>
          {/* @ts-ignore */}
          <pre>{this.state.error?.toString()}</pre>
          {/* @ts-ignore */}
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

let currentVersion: string | null = null;

function checkVersion() {
    fetch('/version')
        .then(response => response.json())
        .then(data => {
            if (currentVersion === null) {
                currentVersion = data.version;
            } else if (data.version !== currentVersion) {
                // Se detectó una nueva versión, recargar solo si no hay mensaje en progreso
                console.log("Nueva actualización detectada. Recargando...");
                window.location.reload();
            }
        })
        .catch(err => console.error("Error verificando versión:", err));
}

// Verificar cada 15 segundos
setInterval(checkVersion, 15000);

function MainApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserObj & {password?: string, securityEmail?: string}>({ username: '', password: '', countryLanguage: 'es', securityEmail: '' });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedUserModal, setSelectedUserModal] = useState<UserObj | null>(null);
  const [adminConfigLizOpen, setAdminConfigLizOpen] = useState(false);
  const [aiProfileForm, setAiProfileForm] = useState({ profilePic: '', statusMessage: 'Administradora', systemInstruction: '' });
  
  const [activeChat, setActiveChat] = useState('global');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  
  const [usersOnline, setUsersOnline] = useState<UserObj[]>([{ username: 'Elizabeth', statusMessage: 'Administradora', role: 'admin' }]); 

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFriendsSidebarOpen, setIsFriendsSidebarOpen] = useState(false);
  const [unreadPMs, setUnreadPMs] = useState<Record<string, boolean>>({});
  const [plumaState, setPlumaState] = useState<any>({ isActive: false, timerEndTime: 0, phrases: [] });
  const [hallOfFame, setHallOfFame] = useState<any[]>([]);
  const chatBg = localStorage.getItem('chatBg');

  // Recovery States
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryCodeStr, setRecoveryCodeStr] = useState('');
  const [inputRecoveryCode, setInputRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      if (isMusicPlaying) audio.play().catch(e => console.log("Autoplay prevented:", e));
      else audio.pause();
    }
  }, [isMusicPlaying]);

  useEffect(() => {
    const interval = setInterval(() => {
       setMessages(prev => {
          const twelveMinAgo = Date.now() - 12 * 60 * 1000;
          const filtered = prev.filter(m => {
             const time = m.createdAt?.seconds ? m.createdAt.seconds * 1000 : (typeof m.createdAt === 'number' ? m.createdAt : Date.now());
             return time > twelveMinAgo;
          });
          return filtered.length !== prev.length ? filtered : prev;
       });
    }, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    socket.emit("typing", { username: user.username, chat: activeChat });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { username: user.username, chat: activeChat });
    }, 2000);
  };

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user.username || !user.password) return;
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const loginPayload = { ...user, timezone };

    socket.emit('register_or_login', loginPayload, (res: any) => {
      if (res.success) {
        setUser({ 
           ...user, 
           profilePic: res.profilePic, 
           statusMessage: res.statusMessage, 
           role: res.role, 
           countryLanguage: res.countryLanguage || user.countryLanguage, 
           timezone,
           is_friends_public: res.is_friends_public,
           friends_list: res.friends_list || [],
           blocked_list: res.blocked_list || []
        });
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
      socket.emit('get_private_history', activeChat, (historyMsgs: any[]) => {
        setMessages(historyMsgs);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    }
    
    socket.on('receive_global', (msg: any) => {
      if (activeChat === 'global') {
          setMessages(prev => {
             if (prev.some(m => m.id === msg.id)) return prev;
             return [...prev, msg];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });

    socket.on('receive_private', (msg: any, fromUser: string) => {
      if (activeChat === fromUser) {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        setUnreadPMs(prev => ({ ...prev, [fromUser]: true }));
      }
    });

    socket.on('pluma_state', (state: any) => {
      setPlumaState(state);
    });

    socket.emit('get_hall_of_fame', (data: any[]) => {
      setHallOfFame(data);
    });

    socket.on('active_users', (usersList: UserObj[]) => {
      const cleaned = usersList.filter(u => u.username !== 'Elizabeth' && u.username !== user.username);
      const elizabeth = usersList.find(u => u.username === 'Elizabeth') || { username: 'Elizabeth', statusMessage: 'Administradora', role: 'admin' };
      cleaned.unshift(elizabeth); 
      setUsersOnline(cleaned);
      // Removed setUser from here, as onSnapshot will handle it.
    });

    socket.on('typing', (data: { username: string, chat: string }) => {
       setTypingUsers(prev => {
          const chatTyping = prev[data.chat] || [];
          if (!chatTyping.includes(data.username)) {
             return { ...prev, [data.chat]: [...chatTyping, data.username] };
          }
          return prev;
       });
       // Límite estricto de 4 segundos a la animación
       setTimeout(() => {
          setTypingUsers(prev => {
             const chatTyping = prev[data.chat] || [];
             if (chatTyping.includes(data.username)) {
                return { ...prev, [data.chat]: chatTyping.filter(u => u !== data.username) };
             }
             return prev;
          });
       }, 4000);
    });

    socket.on('stop_typing', (data: { username: string, chat: string }) => {
       setTypingUsers(prev => {
          const chatTyping = prev[data.chat] || [];
          return { ...prev, [data.chat]: chatTyping.filter(u => u !== data.username) };
       });
    });
    
    const unsubUser = onSnapshot(doc(db, "users", user.username), (docSnap) => {
        if (docSnap.exists()) {
            const updatedUser = docSnap.data() as UserObj;
            setUser(prev => ({ ...prev, ...updatedUser }));
            
            // También actualizamos nuestra info en usersOnline
            setUsersOnline(prevOnline => {
                const exists = prevOnline.find(u => u.username === user.username);
                if (exists) {
                    return prevOnline.map(u => u.username === user.username ? { ...u, ...updatedUser } : u);
                }
                return prevOnline;
            });
        }
    });

    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "modified" || change.type === "added") {
                const updatedUser = change.doc.data() as UserObj;
                setUsersOnline(prevOnline => {
                    const exists = prevOnline.find(u => u.username === updatedUser.username);
                    if (exists) {
                        return prevOnline.map(u => u.username === updatedUser.username ? { ...u, ...updatedUser } : u);
                    }
                    return prevOnline;
                });
            }
        });
    });

    return () => {
      socket.off('receive_global');
      socket.off('receive_private');
      socket.off('active_users');
      unsubscribe();
      unsubUser();
    };
  }, [isLoggedIn, activeChat, user.username]);

  const handleSendMessage = () => {
    if (!inputValue.trim() && !selectedImage && !audioUrl && !selectedGif) return;
    
    const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const payload: any = { text: inputValue, id: msgId };
    if (selectedImage) payload.image = selectedImage;
    if (selectedGif) payload.image = selectedGif;
    if (audioUrl) payload.audio = audioUrl;

    if (activeChat === 'global') {
      const optimisticMsg = { ...payload, sender: user.username, createdAt: Date.now() };
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      socket.emit('send_global', payload);
    } else {
      const optimisticMsg = { ...payload, sender: user.username, createdAt: Date.now() };
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      
      socket.emit('send_private', payload, activeChat, (res: any) => {
         if (!res.success) {
            // Remove optimistic message if failed
            setMessages(prev => prev.filter(m => m.id !== msgId));
            alert(res.error || "No se pudo enviar");
         } else {
            // Replace optimistic with real msg to get accurate timestamp and properties
            setMessages(prev => prev.map(m => m.id === msgId ? res.msg : m));
         }
      });
    }
    
    socket.emit("stop_typing", { username: user.username, chat: activeChat });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Limpieza inmediata del input para evitar sensación de "congelamiento"
    setInputValue('');
    setSelectedImage(null);
    setSelectedGif(null);
    setAudioUrl(null);
    setShowEmojiPicker(false);
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
      <>
        <Login 
          user={user} 
          setUser={setUser} 
          handleLogin={handleLogin} 
          setRecoveryModalOpen={setRecoveryModalOpen} 
        />
        {recoveryModalOpen && (
          <RecoveryModal
            recoveryStep={recoveryStep}
            setRecoveryStep={setRecoveryStep}
            recoveryUsername={recoveryUsername}
            setRecoveryUsername={setRecoveryUsername}
            recoveryCodeStr={recoveryCodeStr}
            setRecoveryCodeStr={setRecoveryCodeStr}
            inputRecoveryCode={inputRecoveryCode}
            setInputRecoveryCode={setInputRecoveryCode}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            setRecoveryModalOpen={setRecoveryModalOpen}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }} className="bg-[#07090e] text-gray-200 flex flex-col font-sans">
      
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-[#07090e] shrink-0">
         <div className="flex items-center gap-3">
             <div className="relative flex items-center justify-center">
                 <MessageSquare size={32} strokeWidth={1.5} className="text-cyan-400" />
                 <div className="absolute w-[18px] h-[6px] bg-gradient-to-r from-cyan-400 to-purple-500 right-0 bottom-2 rounded-full"></div>
             </div>
             <h1 className="text-2xl font-bold text-white tracking-wide">Chat-Liz</h1>
         </div>

         <div className="flex items-center gap-4">
             <button 
                onClick={() => { setActiveChat('global'); setUnreadPMs(prev => ({ ...prev, global: false })); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${activeChat === 'global' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-[#13151f] border-white/10 text-gray-400 hover:text-white hover:border-white/30'} shadow-[0_4px_10px_rgba(0,0,0,0.5)]`}
             >
                <Globe size={20} />
                <span className="font-bold text-sm hidden sm:inline">Mundo</span>
             </button>
             <button 
                onClick={() => { setActiveChat('pluma'); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${activeChat === 'pluma' ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-400' : 'bg-[#13151f] border-white/10 text-gray-400 hover:text-white hover:border-white/30'} shadow-[0_4px_10px_rgba(0,0,0,0.5)]`}
             >
                <div className="relative">
                   <Bot size={20} />
                   {plumaState.isActive && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-black"></div>}
                </div>
                <span className="font-bold text-sm hidden sm:inline">La Pluma</span>
             </button>
             <button 
                onClick={() => { setIsFriendsSidebarOpen(!isFriendsSidebarOpen); }}
                className={`relative w-10 h-10 rounded-xl bg-[#13151f] border transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)] flex items-center justify-center ${Object.values(unreadPMs).some(v => v) ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'}`}
             >
                <MessageSquare size={20} />
                {Object.values(unreadPMs).some(v => v) && (
                   <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full border-2 border-[#07090e]"></div>
                )}
             </button>
             <div className="flex items-center gap-3 bg-[#13151f] border border-white/10 px-4 py-1.5 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                 <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold border border-white/5 overflow-hidden">
                    <img src={user.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
                 </div>
                 <span className="font-medium text-gray-200 text-sm tracking-wide">{user.username}</span>
             </div>
             <button 
                onClick={() => { setIsConfigOpen(true); }}
                className="w-10 h-10 rounded-xl bg-[#13151f] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/30 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
             >
                <Settings size={20} />
             </button>
         </div>
      </nav>

      {/* Main Content Layout */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden p-4 md:p-6 pt-0 gap-6">
          
          {/* Sidebar */}
          <aside className={`w-[280px] bg-[#0B1220] rounded-3xl border border-[#D4AF37]/20 flex flex-col min-h-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all shrink-0 ${isSidebarOpen ? 'translate-x-0 absolute z-40 h-full left-0' : 'hidden md:flex'}`}>
              
              {/* Inner ambient glow for sidebar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#D4AF37]/10 blur-[60px] rounded-full pointer-events-none"></div>

              {/* Elizabeth Profile Area (Sidebar header) */}
              <div className="flex flex-col items-center pt-10 pb-6 relative z-10">
                 <div className="relative mb-6 group cursor-pointer" onClick={() => {
                    const elizabethUser = usersOnline.find(u => u.username === 'Elizabeth') || {username: 'Elizabeth', statusMessage: 'Administradora', role: 'admin'};
                    if (user.username.trim() === "Axiss") {
                        setAiProfileForm({ profilePic: elizabethUser.profilePic || '', statusMessage: elizabethUser.statusMessage || 'Administradora', systemInstruction: elizabethUser.systemInstruction || '' });
                        setAdminConfigLizOpen(true);
                    } else {
                        setSelectedUserModal(elizabethUser);
                    }
                 }}>
                    <div className="absolute inset-0 bg-[#D4AF37] blur-2xl opacity-10 rounded-full group-hover:opacity-30 transition-opacity"></div>
                    <div className="w-28 h-28 rounded-full border border-[#D4AF37]/50 p-1 relative z-10 bg-[#121B2A] shadow-[0_0_20px_rgba(212,175,55,0.2)] flex items-center justify-center overflow-hidden [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]">
                       {(usersOnline.find(u => u.username === 'Elizabeth')?.profilePic) ? (
                         <img src={usersOnline.find(u => u.username === 'Elizabeth')?.profilePic} className="w-full h-full object-cover rounded-full" alt="Elizabeth" />
                       ) : (
                         <Bot size={54} className="text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
                       )}
                    </div>
                    {/* Glowing dot for online status */}
                    <div className="absolute bottom-2 right-2 w-4 h-4 bg-[#D4AF37] rounded-full border-2 border-[#0B1220] shadow-[0_0_8px_rgba(212,175,55,0.6)]"></div>
                 </div>

                 {/* Elizabeth Tab */}
                 <div className="px-4 w-full">
                    <button 
                       onClick={() => setActiveChat('Elizabeth')}
                       className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border ${activeChat === 'Elizabeth' || activeChat === 'global' ? 'shadow-[0_0_15px_rgba(212,175,55,0.15)]' : 'border-transparent hover:bg-white/5'} transition-all`}
                       style={ (activeChat === 'Elizabeth' || activeChat === 'global') ? { background: 'linear-gradient(#151C2C, #151C2C) padding-box, linear-gradient(to right, #D4AF37, #9B8233) border-box', border: '1px solid transparent' } : {} }
                    >
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/50 flex items-center justify-center overflow-hidden">
                              {(usersOnline.find(u => u.username === 'Elizabeth')?.profilePic) ? (
                                <img src={usersOnline.find(u => u.username === 'Elizabeth')?.profilePic} className="w-full h-full object-cover" />
                              ) : (
                                <Bot size={16} className="text-[#D4AF37]" />
                              )}
                           </div>
                           <div className="flex flex-col items-start leading-tight">
                              <span className="font-bold text-[#E8D9B0] text-[15px]">ELIZABETH <span className="text-[#D4AF37] font-normal">~</span></span>
                              <span className="text-[12px] text-[#D4AF37]">online</span>
                           </div>
                        </div>
                    </button>
                 </div>
              </div>
              
              <div className="w-full h-px bg-white/5 my-2"></div>

              {/* Users List */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 scrollbar-thin">
                 {usersOnline.map(u => {
                    if (u.username === 'Elizabeth') return null;
                    return (
                        <div key={u.username} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all ${activeChat === u.username ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                           <div className="flex items-center gap-3 flex-1 overflow-hidden">
                               <div 
                                 title="Ver perfil"
                                 className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer flex-shrink-0"
                                 onClick={() => {
                                    if (u.username === 'Elizabeth' && user.username.trim() === "Axiss") {
                                        setAiProfileForm({ profilePic: u.profilePic || '', statusMessage: u.statusMessage || 'Administradora', systemInstruction: u.systemInstruction || '' });
                                        setAdminConfigLizOpen(true);
                                    } else {
                                        setSelectedUserModal(u);
                                    }
                                 }}
                               >
                                   <img src={u.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt="avatar" className="w-full h-full object-cover" />
                               </div>
                               <button className="text-left flex-1 truncate flex items-center gap-1" onClick={() => setActiveChat(u.username)}>
                                 <span className="font-medium text-gray-300 text-[15px] truncate block">{u.username}</span>
                                 {u.awards && u.awards.map((award, idx) => (
                                     <span key={idx} className="text-xs">{award}</span>
                                 ))}
                                 <span className="text-gray-500">~</span>
                               </button>
                           </div>
                           <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] flex-shrink-0"></div>
                        </div>
                    )
                 })}
              </div>
          </aside>

          {/* Main Chat Container */}
          <main className="flex-1 min-w-0 min-h-0 rounded-[2.5rem] relative flex flex-col bg-gradient-to-b from-[#0B1220] to-[#121B2A] overflow-hidden border-[8px] border-[#07090e] shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                style={{ background: chatBg ? `url(${chatBg}) center/cover no-repeat` : undefined }}>
              
              {/* Chat Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3 z-10 shrink-0 bg-transparent">
                  <div className="flex-1 flex items-center">
                      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-[#D4AF37] hover:text-[#E8D9B0] p-2 rounded-full hover:bg-white/5 transition-colors">
                          <Menu size={22} strokeWidth={1.5} />
                      </button>
                  </div>
                  
                  <div className="flex items-center justify-center flex-1">
                      <div className="bg-[#151C2C]/80 backdrop-blur-md border border-[#D4AF37]/40 rounded-full px-8 py-1.5 shadow-[0_0_20px_rgba(212,175,55,0.15)] flex items-center justify-center min-w-[140px]">
                          <h2 className="text-[18px] font-bold text-[#E8D9B0] tracking-wide">
                              Chat-Liz
                          </h2>
                      </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 flex-1">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full border border-[#D4AF37]/50 overflow-hidden shadow-sm">
                              <img src={user.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[#E8D9B0] font-medium text-[15px] hidden md:block">{user.username}</span>
                      </div>
                      <button onClick={() => setIsConfigOpen(true)} className="text-[#D4AF37] hover:text-[#E8D9B0] transition-colors p-1 hover:bg-white/5 rounded-full">
                          <Settings size={22} strokeWidth={1.5} />
                      </button>
                  </div>
              </div>

              {activeChat === 'pluma' ? (
                 <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto bg-black/60 relative">
                    <div className="absolute top-0 left-0 right-0 w-full bg-gradient-to-r from-fuchsia-600 to-cyan-600 p-3 flex justify-between items-center shadow-lg z-20">
                       <h2 className="text-white font-bold text-xl drop-shadow-md">La Pluma Infinita</h2>
                       <div className="flex gap-4">
                           <button onClick={() => setActiveChat('fama')} className="text-white font-medium hover:text-cyan-200 transition">🏆 Salón de la Fama</button>
                           {plumaState.isActive && (
                               <div className={`px-4 py-1 rounded-full font-bold text-white shadow-inner flex items-center gap-2 ${
                                   plumaState.timerEndTime - Date.now() < 10000 ? 'bg-red-500 animate-pulse' : 'bg-black/40'
                               }`}>
                                   ⏱️ {Math.max(0, Math.floor((plumaState.timerEndTime - Date.now()) / 1000))}s
                               </div>
                           )}
                       </div>
                    </div>

                    {!plumaState.isActive && (
                        <div className="text-center mt-32 flex-1 flex flex-col items-center justify-center">
                            <Bot size={80} className="mx-auto text-fuchsia-500 mb-6 drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]" />
                            <h3 className="text-3xl font-bold text-white mb-4">Comienza una Nueva Historia</h3>
                            <p className="text-gray-400 mb-8 max-w-md text-lg">Escribe la primera frase. Tienes 59 segundos por turno. Alcanza 20 frases entre todos para ganar y entrar al Salón de la Fama.</p>
                            <button onClick={() => socket.emit('start_pluma_game')} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-8 py-4 rounded-full text-xl font-bold shadow-[0_0_20px_rgba(217,70,239,0.5)] transition-transform hover:scale-105 active:scale-95">
                                Empezar Juego
                            </button>
                        </div>
                    )}

                    {plumaState.isActive && (
                        <div className="w-full max-w-3xl mt-20 flex-1 flex flex-col pb-6">
                            <div className="bg-[#12141c]/80 backdrop-blur-sm border border-fuchsia-500/30 p-6 rounded-2xl mb-6 shadow-xl flex-1 overflow-y-auto scrollbar-thin">
                                <h4 className="text-center text-gray-500 font-bold mb-4 uppercase text-xs tracking-widest">
                                    {plumaState.lastWriter === null ? 'Turno Libre' : `Último turno: ${plumaState.lastWriter} (Turno Libre)`}
                                </h4>
                                <div className="space-y-4">
                                    {plumaState.phrases.map((p: any, i: number) => (
                                        <p key={i} className="text-xl text-gray-200 leading-relaxed font-serif animate-in slide-in-from-bottom-2 fade-in">
                                            <span className="text-fuchsia-400 font-bold font-sans text-sm mr-3 uppercase tracking-wider">{p.sender}</span>
                                            {p.text}
                                        </p>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <input 
                                    disabled={plumaState.lastWriter === user.username}
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && inputValue.trim()) {
                                            socket.emit('send_pluma_phrase', inputValue.trim(), () => setInputValue(''));
                                        }
                                    }}
                                    className="flex-1 bg-[#12141c] p-4 rounded-xl border border-white/10 outline-none text-white focus:border-fuchsia-500 transition-colors disabled:opacity-50 text-lg shadow-inner"
                                    placeholder={plumaState.lastWriter === user.username ? 'Debes esperar al siguiente turno...' : 'Aporta la siguiente frase...'}
                                />
                                <button 
                                    disabled={plumaState.lastWriter === user.username || !inputValue.trim()}
                                    onClick={() => { socket.emit('send_pluma_phrase', inputValue.trim(), () => setInputValue('')); }}
                                    className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-gray-700 text-white px-8 rounded-xl font-bold transition-colors shadow-lg disabled:shadow-none"
                                >
                                    Enviar
                                </button>
                            </div>
                        </div>
                    )}
                 </div>
              ) : activeChat === 'fama' ? (
                 <div className="flex-1 overflow-y-auto p-6 bg-black/80 relative">
                    <div className="max-w-4xl mx-auto mt-4">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-4xl font-bold text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] flex items-center gap-4">
                                <span className="text-5xl">🏆</span> El Legado
                            </h2>
                            <button onClick={() => setActiveChat('pluma')} className="text-gray-300 hover:text-white px-6 py-2 border border-white/10 rounded-full hover:bg-white/10 transition-colors bg-white/5 font-medium">Volver al Juego</button>
                        </div>
                        <div className="space-y-8">
                            {hallOfFame.length === 0 ? <p className="text-gray-400 text-center text-xl mt-20 italic">Aún no hay historias legendarias.</p> : null}
                            {hallOfFame.map((story, i) => (
                                <div key={i} className="bg-gradient-to-br from-[#1c1822] to-[#12141c] border border-yellow-500/20 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl"></div>
                                    <h3 className="text-2xl font-bold text-white mb-2 relative z-10">{story.title}</h3>
                                    <p className="text-sm text-yellow-500/80 font-bold mb-6 italic uppercase tracking-wider relative z-10">Escrito por: {story.authors.join(', ')}</p>
                                    <div className="space-y-2 mb-6 text-gray-300 font-serif leading-relaxed border-l-4 border-yellow-500/30 pl-6 text-lg relative z-10">
                                        {story.phrases.map((p: any, j: number) => (
                                            <span key={j}>{p.text} </span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 text-right font-medium relative z-10">{new Date(story.date).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>
              ) : (
                <>
                  {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-2 scrollbar-thin">
                  {messages.filter((m, i, arr) => 
                     m && m.sender && !(i > 0 && m.sender === 'Elizabeth' && arr[i-1] && m.text === arr[i-1].text)
                  ).map((m, idx) => {
                     const isLiz = m.sender === 'Elizabeth' || m.isAi;
                     const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                     const timeStr = isNaN(date.getTime()) ? `10:0${idx % 10}` : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                     const senderUser = usersOnline.find(u => u.username === m.sender);

                     return (
                         <div key={m.id || idx} className="flex justify-start mb-2 group px-2 md:px-6">
                             {isLiz ? (
                                 <div className="bg-[#151C2C] border border-[#2B354C] rounded-[24px] px-5 py-2.5 max-w-[95%] md:max-w-[85%] shadow-md">
                                     <span className="text-[#8B98B0] mr-2 text-[14px]">[{timeStr}]</span>
                                     <span className="font-bold text-[#E8D9B0] mr-2 text-[15px]">ELIZABETH {isAi && '(IA Administradora Gemini ✨)'}:</span>
                                     <span className="text-[#E8D9B0] text-[15px]">{m.text}</span>
                                     {m.image && <div className="mt-2"><img src={m.image} className="rounded-xl border border-white/10 max-w-full shadow-lg" alt="adjunto"/></div>}
                                     {(m.type === 'audio' || m.audio) && <div className="mt-2 bg-[#13151f] p-2 rounded-xl border border-white/5 shadow-inner"><audio src={m.audio} controls className="h-8 max-w-[200px] opacity-90" /></div>}
                                 </div>
                             ) : (
                                 <div className="bg-[#F2E3C6] border border-[#E0D0B0] rounded-[24px] px-5 py-2.5 max-w-[95%] md:max-w-[85%] shadow-md">
                                     <span className="text-[#6B7280] mr-2 text-[14px]">[{timeStr}]</span>
                                     <span className="font-bold text-[#5A52A5] mr-2 text-[15px]">{m.sender}:</span>
                                     <span className="text-[#1A2035] text-[15px]">{m.text}</span>
                                     {m.image && <div className="mt-2"><img src={m.image} className="rounded-xl border border-black/10 max-w-full shadow-lg" alt="adjunto"/></div>}
                                     {(m.type === 'audio' || m.audio) && <div className="mt-2 bg-white/50 p-2 rounded-xl border border-black/5 shadow-inner"><audio src={m.audio} controls className="h-8 max-w-[200px]" /></div>}
                                 </div>
                             )}
                         </div>
                     );
                  })}

                  {/* Typing Indicator */}
                  {typingUsers[activeChat] && typingUsers[activeChat].length > 0 && (
                     <div className="flex flex-col gap-1 mb-4 px-2 md:px-6">
                        {typingUsers[activeChat].includes("Elizabeth") && (
                           <div className="text-[#D4AF37] text-sm font-medium italic flex items-center">
                              ELIZABETH está escribiendo<span className="ml-1 flex gap-1"><span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '0.2s'}}>.</span><span className="animate-bounce" style={{animationDelay: '0.4s'}}>.</span></span>
                           </div>
                        )}
                        {typingUsers[activeChat].filter(u => u !== "Elizabeth").length > 0 && (
                           <div className="text-[#8B98B0] text-sm font-medium italic">
                              {typingUsers[activeChat].filter(u => u !== "Elizabeth").join(", ")} {typingUsers[activeChat].filter(u => u !== "Elizabeth").length > 1 ? 'están' : 'está'} escribiendo...
                           </div>
                        )}
                     </div>
                  )}

                  <div ref={bottomRef} className="h-2" />
              </div>

              {/* Input Area */}
              <div className="px-4 py-4 md:px-6 md:py-6 shrink-0 bg-transparent relative z-10">
                  {(selectedImage || audioUrl || selectedGif) && (
                    <div className="flex gap-4 mb-4">
                      {selectedImage && (
                        <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                           <img src={selectedImage} alt="Preview" className="h-20 w-20 rounded-xl border-2 border-[#D4AF37] object-cover shadow-lg" />
                           <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                        </div>
                      )}
                      {selectedGif && (
                        <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                           <img src={selectedGif} alt="GIF Preview" className="h-20 w-20 rounded-xl border-2 border-[#D4AF37] object-cover shadow-lg" />
                           <button onClick={() => setSelectedGif(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                        </div>
                      )}
                      {audioUrl && (
                        <div className="relative flex items-center gap-3 bg-[#121927] px-4 py-2 rounded-xl border border-[#D4AF37]/40 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                           <audio src={audioUrl} controls className="h-8 w-48 opacity-90" />
                           <button onClick={() => setAudioUrl(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 relative">
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                      <div className="flex-1 bg-[#121927]/60 backdrop-blur-md border border-[#D4AF37]/40 rounded-full flex items-center px-4 py-2 relative shadow-[0_0_15px_rgba(212,175,55,0.05)] focus-within:border-[#D4AF37] focus-within:shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all">
                          <input 
                             value={inputValue}
                             onChange={handleInputChange}
                             onKeyDown={e => {
                                if (e.key === 'Enter') handleSendMessage();
                             }}
                             className="w-full bg-transparent outline-none text-[#E8D9B0] placeholder-[#D4AF37]/60 text-[15px] py-1.5" 
                             placeholder="Escribe tu mensaje... @Elizabeth para IA carismática"
                          />
                          <div className="flex items-center gap-1 text-[#D4AF37] ml-2">
                              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="hover:text-[#E8D9B0] p-1.5 rounded-full hover:bg-white/5 transition-colors"><Smile size={22} strokeWidth={1.5} /></button>
                              <button onClick={() => fileInputRef.current?.click()} className="hover:text-[#E8D9B0] p-1.5 rounded-full hover:bg-white/5 transition-colors"><Paperclip size={22} strokeWidth={1.5} /></button>
                          </div>
                      </div>
                      
                      {showEmojiPicker && (
                         <EmojiGifPicker 
                           onSelect={(type, val) => {
                              if (type === 'emoji') setInputValue(prev => prev + val);
                              if (type === 'gif') setSelectedGif(val);
                           }} 
                           onClose={() => setShowEmojiPicker(false)} 
                         />
                      )}

                      <button 
                        onClick={handleSendMessage} 
                        disabled={!inputValue.trim() && !selectedImage && !audioUrl && !selectedGif}
                        className="bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#D4AF37] hover:text-[#E8D9B0] rounded-full h-[54px] w-[54px] flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.2)] disabled:opacity-50 disabled:shadow-none transition-all shrink-0 ml-1"
                      >
                        <Send size={24} className="ml-1" strokeWidth={1.5} />
                      </button>
                      <button onClick={isRecording ? stopRecording : startRecording} className={`ml-1 flex items-center justify-center rounded-full h-[54px] w-[54px] bg-[#121927]/60 backdrop-blur-md border border-[#D4AF37]/40 shrink-0 transition-all ${isRecording ? 'text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] bg-red-500/10 border-red-500/50' : 'text-[#D4AF37] hover:text-[#E8D9B0] hover:bg-white/5'}`}>
                          {isRecording ? <StopCircle size={24} className="animate-pulse" strokeWidth={1.5} /> : <Mic size={24} strokeWidth={1.5} />}
                      </button>
                  </div>
              </div>
              </>
              )}
          </main>
      </div>

      <audio id="bg-music" ref={audioRef} src="https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" loop preload="none" />

      {isConfigOpen && (
        <ProfileConfigModal
          user={user}
          setUser={setUser}
          setIsConfigOpen={setIsConfigOpen}
          setAdminConfigLizOpen={setAdminConfigLizOpen}
          usersOnline={usersOnline}
          setAiProfileForm={setAiProfileForm}
        />
      )}

      {adminConfigLizOpen && (
        <AdminConfigLizModal
          setAdminConfigLizOpen={setAdminConfigLizOpen}
          aiProfileForm={aiProfileForm}
          setAiProfileForm={setAiProfileForm}
        />
      )}

      {/* Selected User Info Modal */}
       {selectedUserModal && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedUserModal(null)}>
           <div className="bg-[#12141c] p-8 rounded-3xl w-full max-w-sm shadow-2xl relative border border-white/10 text-center" onClick={e => e.stopPropagation()}>
             <button onClick={() => setSelectedUserModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors">
                <X size={20} />
             </button>
             <div 
                className={`w-24 h-24 mx-auto mb-4 rounded-full border border-white/10 overflow-hidden shadow-lg relative ${selectedUserModal.username === 'Elizabeth' && user.username.trim() === 'Axiss' ? 'cursor-pointer group' : ''}`}
                onClick={() => {
                    if (selectedUserModal.username === 'Elizabeth' && user.username.trim() === 'Axiss') {
                        setAiProfileForm({ profilePic: selectedUserModal.profilePic || '', statusMessage: selectedUserModal.statusMessage || 'Administradora', systemInstruction: selectedUserModal.systemInstruction || '' });
                        setSelectedUserModal(null);
                        setAdminConfigLizOpen(true);
                    }
                }}
             >
                <img src={selectedUserModal.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUserModal.username}`} className="w-full h-full object-cover" alt="Avatar" />
                {selectedUserModal.username === 'Elizabeth' && user.username.trim() === 'Axiss' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-bold text-white uppercase text-center px-1">Cambiar Foto</span>
                    </div>
                )}
             </div>
             <h3 className="text-xl font-bold text-white mb-1 flex items-center justify-center gap-2">
                {selectedUserModal.username}
                {selectedUserModal.awards && selectedUserModal.awards.map((award, idx) => (
                    <span key={idx} className="text-xl" title="Galardón: Pluma Infinita">{award}</span>
                ))}
                {selectedUserModal.role === 'admin' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">Admin</span>}
             </h3>
             <p className="text-cyan-400 text-sm mb-4">Online</p>
             
             <div className="bg-[#0a0a16] border border-white/5 p-4 rounded-2xl relative mb-4">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#12141c] px-2 text-xs text-gray-500 font-semibold uppercase">Estado</div>
                <p className="text-gray-300 italic text-sm">
                   "{selectedUserModal.statusMessage || 'Disponible'}"
                </p>
             </div>
             
             {/* Friends Banner */}
             <div className="bg-[#0a0a16] border border-cyan-500/20 p-4 rounded-2xl relative mb-4">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#12141c] px-2 text-xs text-cyan-400 font-semibold uppercase flex items-center gap-1">
                   <Users size={12} /> Amigos
                </div>
                {selectedUserModal.username === user.username || selectedUserModal.is_friends_public ? (
                   <p className="text-gray-300 text-sm">
                      {(selectedUserModal.username === user.username ? user.friends_list : selectedUserModal.friends_list)?.length ? 
                        (selectedUserModal.username === user.username ? user.friends_list : selectedUserModal.friends_list)?.join(', ')
                        : 'No hay amigos para mostrar.'}
                   </p>
                ) : (
                   <p className="text-gray-500 text-sm italic">
                      La lista de amigos de este usuario es privada.
                   </p>
                )}
             </div>
             
             {selectedUserModal.username !== user.username && (
               <div className="flex flex-col gap-2 mt-6">
                   <button 
                     onClick={() => { setActiveChat(selectedUserModal.username); setSelectedUserModal(null); }}
                     className="w-full flex items-center justify-center gap-2 text-white bg-white/5 hover:bg-white/10 p-3 rounded-xl font-medium transition-colors border border-white/10"
                   >
                     <MessageCircle size={18} />
                     Enviar mensaje
                   </button>
                   {selectedUserModal.username !== 'Elizabeth' && (
                     <div className="flex gap-2">
                         <button 
                             onClick={() => {
                                 socket.emit('toggle_friend', selectedUserModal.username, (res: any) => {
                                     if(res.success) {
                                         setUser(prev => ({
                                             ...prev,
                                             friends_list: res.isFriend ? [...(prev.friends_list || []), selectedUserModal.username] : (prev.friends_list || []).filter(f => f !== selectedUserModal.username)
                                         }));
                                         setSelectedUserModal(null);
                                     }
                                 });
                             }}
                             className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-colors border ${user.friends_list?.includes(selectedUserModal.username) ? 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20' : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20'}`}
                         >
                             <UserPlus size={18} />
                             {user.friends_list?.includes(selectedUserModal.username) ? 'Quitar Amigo' : 'Añadir Amigo'}
                         </button>
                         {selectedUserModal.role !== 'admin' && (
                             <button 
                                 onClick={() => {
                                     socket.emit('toggle_ban', selectedUserModal.username, (res: any) => {
                                         if(res.success) {
                                             setUser(prev => ({
                                                 ...prev,
                                                 blocked_list: res.isBanned ? [...(prev.blocked_list || []), selectedUserModal.username] : (prev.blocked_list || []).filter(b => b !== selectedUserModal.username)
                                             }));
                                             setSelectedUserModal(null);
                                         }
                                     });
                                 }}
                                 className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-colors border ${user.blocked_list?.includes(selectedUserModal.username) ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20'}`}
                             >
                                 <AlertCircle size={18} />
                                 {user.blocked_list?.includes(selectedUserModal.username) ? 'Desbanear' : 'Banear'}
                             </button>
                         )}
                     </div>
                   )}
               </div>
             )}
           </div>
         </div>
       )}

       {/* Friends Sidebar */}
       {isFriendsSidebarOpen && (
           <div className="fixed inset-y-0 right-0 w-80 bg-[#0f111a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-40 flex flex-col transform transition-transform animate-in slide-in-from-right">
               <div className="p-6 border-b border-white/5 flex items-center justify-between">
                   <h2 className="text-xl font-bold text-white flex items-center gap-2">
                       <Users size={24} className="text-cyan-400" />
                       Mis Amigos
                   </h2>
                   <button onClick={() => setIsFriendsSidebarOpen(false)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                       <X size={20} />
                   </button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-2">
                   {(!user.friends_list || user.friends_list.length === 0) ? (
                       <p className="text-gray-500 text-center text-sm mt-10">No tienes amigos agregados aún.</p>
                   ) : (
                       user.friends_list.map(friendUsername => {
                           const isOnline = usersOnline.some(u => u.username === friendUsername);
                           const friendInfo = usersOnline.find(u => u.username === friendUsername);
                           return (
                               <div 
                                   key={friendUsername} 
                                   onClick={() => { setActiveChat(friendUsername); setUnreadPMs(prev => ({...prev, [friendUsername]: false})); setIsFriendsSidebarOpen(false); }}
                                   className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5 group"
                               >
                                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 overflow-hidden relative">
                                       <img src={friendInfo?.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendUsername}`} className="w-full h-full object-cover" />
                                       <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0f111a] ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                   </div>
                                   <div className="flex-1 min-w-0">
                                       <div className="flex justify-between items-center">
                                           <p className="text-white font-medium text-sm truncate">{friendUsername}</p>
                                           {unreadPMs[friendUsername] && <div className="w-2 h-2 rounded-full bg-cyan-500 ml-2"></div>}
                                       </div>
                                       <p className="text-xs text-gray-500 truncate">{isOnline ? friendInfo?.statusMessage || 'Conectado' : 'Desconectado'}</p>
                                   </div>
                               </div>
                           );
                       })
                   )}
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          background-color: #07090e;
          color: #e2e8f0;
          margin: 0;
          overflow: hidden;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 5px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
      <MainApp />
    </ErrorBoundary>
  );
}
