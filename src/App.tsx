import React, { useState, useEffect, useRef, ErrorInfo, Component } from 'react';
import { 
  Send, User, MessageCircle, Settings, Bot, 
  Image as ImageIcon, Mic, StopCircle, 
  Menu, X, Hash, MessageSquare, LogOut, Search,
  Paperclip, Smile, Globe, Box, Volume2, VolumeX, Users, UserPlus, AlertCircle, ChevronLeft
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
import { AudioVisualizer } from './components/AudioVisualizer';

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
  const [readReceipts, setReadReceipts] = useState<Record<string, boolean>>({});
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  
  const [usersOnline, setUsersOnline] = useState<UserObj[]>([{ username: 'Elizabeth', statusMessage: 'Administradora', role: 'admin' }]); 

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFriendsSidebarOpen, setIsFriendsSidebarOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'chat' | 'buzon'>('chat');
  const [unreadPMs, setUnreadPMs] = useState<Record<string, boolean>>({});
  const [plumaState, setPlumaState] = useState<any>({ isActive: false, timerEndTime: 0, phrases: [] });
  const [hallOfFame, setHallOfFame] = useState<any[]>([]);
  const [showFamaModal, setShowFamaModal] = useState(false);
  const chatBg = user.preferred_background;

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
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
  const addMessage = (prev: MessageObj[], newMsg: MessageObj) => {
      const next = [...prev, newMsg];
      if (next.length > 15) {
         return next.slice(next.length - 15);
      }
      return next;
  };

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
        setMessages(historyMsgs.slice(-15));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    } else {
      socket.emit('get_private_history', activeChat, (historyMsgs: any[]) => {
        setMessages(historyMsgs.slice(-15));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    }
    
    socket.on('receive_global', (msg: any) => {
      if (activeChat === 'global') {
          setMessages(prev => {
             return prev.some(m => m.id === msg.id) ? prev : addMessage(prev, msg);
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });

    socket.on('receive_private', (msg: any, fromUser: string) => {
      if (activeChat === fromUser) {
        setMessages(prev => addMessage(prev, msg));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        setUnreadPMs(prev => ({ ...prev, [fromUser]: true }));
      }
    });

    // Delay marking as read
    if (activeChat !== 'global' && activeChat !== 'pluma') {
      const timer = setTimeout(() => {
         socket.emit("read_messages", { targetUser: activeChat });
      }, 1000);
      return () => clearTimeout(timer);
    }

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

    socket.on('messages_read', (data: { by: string }) => {
       setReadReceipts(prev => ({...prev, [data.by]: true}));
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
      setMessages(prev => addMessage(prev, optimisticMsg));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      socket.emit('send_global', payload);
    } else {
      const optimisticMsg = { ...payload, sender: user.username, createdAt: Date.now() };
      setMessages(prev => addMessage(prev, optimisticMsg));
      setReadReceipts(prev => ({...prev, [activeChat]: false}));
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
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
           setAudioUrl(reader.result as string);
        };
      };
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

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
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
    }
    analyserRef.current = null;
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
      
      {/* Top Navigation Bar (Mobile-First Ultra-Compact) */}
      <nav className="flex items-center justify-between px-3 py-2 bg-[#07090e] shrink-0 border-b border-white/5 relative z-50">
         <div className="flex items-center gap-2">
             <div className="relative">
                 <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800">
                     <img src={user.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
                 </div>
                 <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-[#07090e]"></div>
             </div>
             <div className="flex flex-col justify-center">
                 <h1 className="text-base font-bold text-white leading-none">Chat-Liz</h1>
                 <span className="text-[10px] text-cyan-400 font-medium">En línea</span>
             </div>
         </div>

         <div className="flex items-center gap-2">
             <button 
                onClick={() => { setActiveChat('global'); setUnreadPMs(prev => ({ ...prev, global: false })); }}
                className={`p-2 rounded-xl transition-all ${activeChat === 'global' ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-400 hover:text-white'}`}
             >
                <Globe size={24} strokeWidth={1.5} />
             </button>
             <button 
                onClick={() => { setActiveChat('pluma'); }}
                className={`p-2 rounded-xl transition-all relative ${activeChat === 'pluma' ? 'text-fuchsia-400 bg-fuchsia-500/10' : 'text-gray-400 hover:text-white'}`}
             >
                <Bot size={24} strokeWidth={1.5} />
                {plumaState.isActive && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-black"></div>}
             </button>
             <button 
                onClick={() => { 
                   setIsFriendsSidebarOpen(!isFriendsSidebarOpen);
                   if (!isFriendsSidebarOpen) {
                       setMobileView('buzon');
                   }
                }}
                className={`p-2 rounded-xl transition-all relative ${(Object.values(unreadPMs).some(v => v) || (user.friend_requests && user.friend_requests.length > 0)) ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-400 hover:text-white'}`}
             >
                <Users size={24} strokeWidth={1.5} />
                {(Object.values(unreadPMs).some(v => v) || (user.friend_requests && user.friend_requests.length > 0)) && (
                   <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-500 rounded-full border border-[#07090e] shadow-[0_0_10px_rgba(6,182,212,1)] animate-pulse"></div>
                )}
             </button>
             <button 
                onClick={() => setIsConfigOpen(true)}
                className="p-2 rounded-xl text-gray-400 hover:text-white transition-all"
             >
                <Menu size={24} strokeWidth={1.5} />
             </button>
         </div>
      </nav>

      {/* Main Content Layout */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden p-4 md:p-6 pt-0 gap-6">
          
          {/* Sidebar */}
          <aside className={`w-[280px] bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 flex flex-col min-h-0 shadow-2xl relative overflow-hidden transition-all shrink-0 ${isSidebarOpen ? 'translate-x-0 absolute z-40 h-full left-0' : 'hidden md:flex'}`}>
              
              {/* Inner ambient glow for sidebar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none"></div>

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
                    <div className="absolute inset-0 bg-cyan-400 blur-2xl opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
                    <div className="w-28 h-28 rounded-full border border-cyan-400/50 p-1 relative z-10 bg-[#0a0a16] shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center overflow-hidden [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]">
                       {(usersOnline.find(u => u.username === 'Elizabeth')?.profilePic) ? (
                         <img src={usersOnline.find(u => u.username === 'Elizabeth')?.profilePic} className="w-full h-full object-cover rounded-full" alt="Elizabeth" />
                       ) : (
                         <Bot size={54} className="text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                       )}
                    </div>
                    {/* Glowing dot for online status */}
                    <div className="absolute bottom-2 right-2 w-4 h-4 bg-cyan-400 rounded-full border-2 border-[#12141c] shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                 </div>

                 {/* Elizabeth Tab */}
                 <div className="px-4 w-full">
                    <button 
                       onClick={() => setActiveChat('Elizabeth')}
                       className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border ${activeChat === 'Elizabeth' || activeChat === 'global' ? 'shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'border-transparent hover:bg-white/5'} transition-all`}
                       style={ (activeChat === 'Elizabeth' || activeChat === 'global') ? { background: 'linear-gradient(#1a1c26, #1a1c26) padding-box, linear-gradient(to right, #06b6d4, #a855f7) border-box', border: '1px solid transparent' } : {} }
                    >
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-cyan-900/50 border border-cyan-500/50 flex items-center justify-center overflow-hidden">
                              {(usersOnline.find(u => u.username === 'Elizabeth')?.profilePic) ? (
                                <img src={usersOnline.find(u => u.username === 'Elizabeth')?.profilePic} className="w-full h-full object-cover" />
                              ) : (
                                <Bot size={16} className="text-cyan-300" />
                              )}
                           </div>
                           <div className="flex flex-col items-start leading-tight">
                              <span className="font-bold text-white text-[15px]">ELIZABETH <span className="text-cyan-400 font-normal">~</span></span>
                              <span className="text-[12px] text-cyan-400">online</span>
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
                               <button className="text-left flex-1 truncate flex items-center gap-1" onClick={(e) => {
                                 e.stopPropagation();
                                 setActiveChat(u.username);
                                 setIsFriendsSidebarOpen(false);
                               }}>
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
          <main className={`flex-1 min-w-0 min-h-0 rounded-3xl relative flex flex-col bg-white/5 backdrop-blur-lg overflow-hidden shadow-2xl border border-white/10 ${mobileView === 'chat' ? 'fixed inset-0 top-[49px] z-[60] sm:static sm:inset-auto sm:z-auto sm:top-auto' : 'hidden sm:flex'}`}
                style={{ background: chatBg ? `url(${chatBg}) center/cover no-repeat` : 'rgba(255, 255, 255, 0.05)' }}>
              
              {/* Chat Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md z-10 shrink-0">
                  <div className="flex items-center gap-2">
                     <button onClick={() => { setMobileView('buzon'); }} className="sm:hidden text-gray-400 hover:text-white mr-1 transition-colors">
                       <ChevronLeft size={24} />
                     </button>
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white mr-2">
                       <Menu size={20} />
                     </button>
                     <h2 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                        {activeChat === 'global' ? 'CHAT GLOBAL #1' : `Private Chat: ${activeChat}`}
                        {activeChat === 'global' && <span className="text-xs font-normal text-gray-500">({usersOnline.filter(u => u.username !== 'Elizabeth').length + 1} on)</span>}
                     </h2>
                  </div>
                  <div className="flex items-center gap-2">
                     <button id="music-toggle" onClick={() => setIsMusicPlaying(!isMusicPlaying)} className="text-gray-400 hover:text-cyan-400 p-2 rounded-full hover:bg-white/5">
                        {isMusicPlaying ? <Volume2 size={20} /> : <VolumeX size={20} />}
                     </button>
                  </div>
              </div>



              {activeChat === 'pluma' ? (
                 <div className="flex-1 flex flex-col items-center justify-start p-4 overflow-y-auto bg-black/60 relative">
                    <div className="absolute top-0 left-0 right-0 w-full bg-gradient-to-r from-fuchsia-600 to-cyan-600 p-2 flex justify-between items-center shadow-lg z-20">
                       <h2 className="text-white font-bold text-lg drop-shadow-md flex items-center gap-2"><Bot size={20}/> La Pluma</h2>
                       <div className="flex gap-2">
                           <button onClick={() => setShowFamaModal(true)} className="text-white font-medium hover:text-cyan-200 transition text-sm">🏆 Fama</button>
                           {plumaState.isActive && (
                               <div className={`px-2 py-0.5 rounded-full font-bold text-white text-xs flex items-center gap-1 ${
                                   plumaState.timerEndTime - Date.now() < 10000 ? 'bg-red-500 animate-pulse' : 'bg-black/40'
                               }`}>
                                   ⏱️ {Math.max(0, Math.floor((plumaState.timerEndTime - Date.now()) / 1000))}s
                               </div>
                           )}
                       </div>
                    </div>

                    {!plumaState.isActive && (
                        <div className="text-center mt-20 flex-1 flex flex-col items-center justify-center">
                            <Bot size={60} className="mx-auto text-fuchsia-500 mb-4 drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]" />
                            <h3 className="text-2xl font-bold text-white mb-3">Nueva Historia</h3>
                            <p className="text-gray-400 mb-6 max-w-sm text-sm">59s por turno. 20 frases para entrar al Salón de la Fama.</p>
                            <button onClick={() => socket.emit('start_pluma_game')} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-6 py-3 rounded-full text-base font-bold shadow-[0_0_20px_rgba(217,70,239,0.5)] transition-transform hover:scale-105 active:scale-95">
                                Empezar
                            </button>
                        </div>
                    )}

                    {plumaState.isActive && (
                        <div className="w-full max-w-3xl mt-14 flex-1 flex flex-col pb-4">
                            <div className="bg-[#12141c]/80 backdrop-blur-sm border border-fuchsia-500/30 p-4 rounded-2xl mb-4 shadow-xl flex-1 overflow-y-auto scrollbar-thin">
                                <h4 className="text-center text-gray-500 font-bold mb-3 uppercase text-[10px] tracking-widest">
                                    {plumaState.lastWriter === null ? 'Turno Libre' : `Último turno: ${plumaState.lastWriter}`}
                                </h4>
                                <div className="space-y-3">
                                    {plumaState.phrases.map((p: any, i: number) => (
                                        <p key={i} className="text-base text-gray-200 leading-relaxed font-serif animate-in slide-in-from-bottom-2 fade-in">
                                            <span className="text-fuchsia-400 font-bold font-sans text-[10px] mr-2 uppercase tracking-wider">{p.sender}</span>
                                            {p.text}
                                        </p>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    disabled={plumaState.lastWriter === user.username}
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && inputValue.trim()) {
                                            socket.emit('send_pluma_phrase', inputValue.trim(), () => setInputValue(''));
                                        }
                                    }}
                                    className="flex-1 bg-[#12141c] p-3 rounded-xl border border-white/10 outline-none text-white focus:border-fuchsia-500 transition-colors disabled:opacity-50 text-sm shadow-inner"
                                    placeholder={plumaState.lastWriter === user.username ? 'Espera...' : 'Aporta una frase...'}
                                />
                                <button 
                                    disabled={plumaState.lastWriter === user.username || !inputValue.trim()}
                                    onClick={() => { socket.emit('send_pluma_phrase', inputValue.trim(), () => setInputValue('')); }}
                                    className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-gray-700 text-white px-5 rounded-xl font-bold text-sm shadow-lg disabled:shadow-none"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                 </div>
              ) : (
                <>
                  {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
                  {messages.filter((m, i, arr) => 
                     m && m.sender && !(i > 0 && m.sender === 'Elizabeth' && arr[i-1] && m.text === arr[i-1].text)
                  ).slice(-15).map((m, idx) => {
                     const isMine = m.sender === user.username;
                     const isLiz = m.sender === 'Elizabeth' || m.isAi;
                     const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                     const timeStr = isNaN(date.getTime()) ? `10:0${idx % 10}` : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                     const senderUser = usersOnline.find(u => u.username === m.sender);

                     return (
                         <div key={m.id || idx} className={`flex flex-col mb-4 ${isMine ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                               <span className={`text-[10px] font-bold uppercase tracking-wider ${isMine ? 'text-[var(--text-accent)]' : isLiz ? 'text-[var(--text-accent)]' : 'text-[var(--text-secondary)]'}`}>
                                  {isLiz ? 'ELIZABETH' : m.sender}
                                  {!isLiz && senderUser?.awards?.map((award, i) => (
                                     <span key={i} className="text-[10px] ml-1">{award}</span>
                                  ))}
                               </span>
                               <span className="text-[9px] text-[var(--text-secondary)] opacity-70">{timeStr}</span>
                            </div>
                            <div className={`px-4 py-2.5 max-w-[85%] sm:max-w-[70%] break-words shadow-sm border border-[var(--border-color)] ${isMine ? 'bg-[var(--bubble-sent)] text-[var(--bubble-text)] rounded-2xl rounded-tr-sm' : 'bg-[var(--bubble-recv)] text-[var(--bubble-text)] rounded-2xl rounded-tl-sm'}`}>
                               {m.text}
                               {m.image && <div className="mt-2"><img src={m.image} className="rounded-xl border border-[var(--border-color)] max-w-[200px] shadow-sm" alt="adjunto"/></div>}
                               {(m.type === 'audio' || m.audio) && <div className="mt-2 bg-[var(--bg-input)] p-1 rounded-xl inline-block border border-[var(--border-color)]"><audio src={m.audio} controls className="h-6 max-w-[200px] filter opacity-90" /></div>}
                            </div>
                         </div>
                     );
                  })}

                  {/* Typing Indicator */}
                  {typingUsers[activeChat] && typingUsers[activeChat].length > 0 && (
                     <div className="flex flex-col gap-0.5 mb-2 px-2">
                        {typingUsers[activeChat].includes("Elizabeth") && (
                           <div className="text-[var(--text-accent)] text-xs font-medium italic flex items-center">
                              ELIZABETH escribiendo<span className="ml-1 flex gap-0.5"><span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '0.2s'}}>.</span><span className="animate-bounce" style={{animationDelay: '0.4s'}}>.</span></span>
                           </div>
                        )}
                        {typingUsers[activeChat].filter(u => u !== "Elizabeth").length > 0 && (
                           <div className="text-[var(--text-secondary)] text-xs font-medium italic">
                              {typingUsers[activeChat].filter(u => u !== "Elizabeth").join(", ")} escribiendo...
                           </div>
                        )}
                     </div>
                  )}

                  {activeChat !== 'global' && activeChat !== 'pluma' && activeChat !== 'fama' && readReceipts[activeChat] && messages.length > 0 && messages[messages.length - 1].sender === user.username && (
                      <div className="flex justify-end mt-1 mb-2 px-2 animate-in fade-in">
                          <span className="text-[10px] text-[var(--text-accent)] opacity-80 font-medium flex items-center gap-1">✓ Visto</span>
                      </div>
                  )}

                  <div ref={bottomRef} className="h-1" />
              </div>

              {/* Input Area */}
              <div className="px-3 py-3 shrink-0 bg-[var(--bg-main)]/90 backdrop-blur-md relative z-10 border-t border-[var(--border-color)]">
                  {(selectedImage || audioUrl || selectedGif || isRecording) && (
                    <div className="flex gap-2 mb-2 items-end">
                      {selectedImage && (
                        <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                           <img src={selectedImage} alt="Preview" className="h-12 w-12 rounded-lg border border-cyan-500 object-cover" />
                           <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1"><X size={10} /></button>
                        </div>
                      )}
                      {selectedGif && (
                        <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                           <img src={selectedGif} alt="GIF Preview" className="h-12 w-12 rounded-lg border border-cyan-500 object-cover" />
                           <button onClick={() => setSelectedGif(null)} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1"><X size={10} /></button>
                        </div>
                      )}
                      {audioUrl && (
                        <div className="relative flex items-center gap-2 bg-[#1a1c26] px-2 py-1 rounded-lg border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                           <audio src={audioUrl} controls className="h-6 w-32 opacity-90" />
                           <button onClick={() => setAudioUrl(null)} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1"><X size={10} /></button>
                        </div>
                      )}
                      {isRecording && (
                        <div className="flex items-center justify-center h-10 px-3 bg-[#12141c]/80 rounded-xl py-1 border border-cyan-500/30 animate-in fade-in absolute -top-12 right-0">
                           {analyserRef.current ? (
                              <AudioVisualizer analyser={analyserRef.current} />
                           ) : (
                              <div className="text-cyan-400 text-xs font-bold animate-pulse">Escuchando...</div>
                           )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 relative">
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                      <div className="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-2xl flex items-center px-3 py-1 relative focus-within:border-[var(--text-accent)] transition-all">
                          <input 
                             value={inputValue}
                             onChange={handleInputChange}
                             onKeyDown={e => {
                                if (e.key === 'Enter') handleSendMessage();
                             }}
                             className="w-full bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm py-1" 
                             placeholder="Mensaje..."
                          />
                          <div className="flex items-center gap-2 text-[var(--text-secondary)] ml-2">
                              <Smile onClick={() => setShowEmojiPicker(!showEmojiPicker)} size={18} className="hover:text-[var(--text-accent)] cursor-pointer transition-colors" />
                              <Paperclip onClick={() => fileInputRef.current?.click()} size={18} className="hover:text-[var(--text-accent)] cursor-pointer transition-colors" />
                          </div>
                      </div>
                      
                      {showEmojiPicker && (
                         <div className="absolute bottom-[80px] right-[10px] z-[9999]">
                             <EmojiGifPicker 
                               onSelect={(type, val) => {
                                  if (type === 'emoji') setInputValue(prev => prev + val);
                                  if (type === 'gif') setSelectedGif(val);
                               }} 
                               onClose={() => setShowEmojiPicker(false)} 
                             />
                         </div>
                      )}

                      <button 
                        onClick={handleSendMessage} 
                        disabled={!inputValue.trim() && !selectedImage && !audioUrl && !selectedGif}
                        className="bg-[var(--text-accent)] rounded-xl h-9 w-9 flex items-center justify-center disabled:opacity-50 shrink-0"
                      >
                        <Send size={16} className="text-white ml-0.5" />
                      </button>
                      <button onClick={isRecording ? stopRecording : startRecording} className={`flex items-center justify-center rounded-xl h-9 w-9 bg-[var(--bg-input)] border border-[var(--border-color)] shrink-0 transition-all ${isRecording ? 'text-red-500 bg-red-500/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                          {isRecording ? <StopCircle size={16} className="animate-pulse" /> : <Mic size={16} />}
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

      {/* Selected User Info Modal (Bottom Sheet) */}
       {selectedUserModal && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in" onClick={() => setSelectedUserModal(null)}>
           <div className="bg-[#12141c] p-6 rounded-t-3xl sm:rounded-3xl w-full max-w-sm shadow-2xl relative border-t border-x sm:border-b border-white/10 text-center max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
             <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6 sm:hidden"></div>
             <button onClick={() => setSelectedUserModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors">
                <X size={20} />
             </button>
             <div 
                className={`w-20 h-20 mx-auto mb-3 rounded-full border border-white/10 overflow-hidden shadow-lg relative ${selectedUserModal.username === 'Elizabeth' && user.username.trim() === 'Axiss' ? 'cursor-pointer group' : ''}`}
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
             <p className="text-cyan-400 text-xs mb-4 font-medium flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] inline-block"></span> Online
             </p>
             
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
                         {user.friends_list?.includes(selectedUserModal.username) ? (
                             <button 
                                 onClick={() => {
                                     socket.emit('remove_friend', selectedUserModal.username, (res: any) => {
                                         if(res.success) {
                                             setUser(prev => ({
                                                 ...prev,
                                                 friends_list: (prev.friends_list || []).filter(f => f !== selectedUserModal.username)
                                             }));
                                             setSelectedUserModal(null);
                                         }
                                     });
                                 }}
                                 className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-colors border text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20"
                             >
                                 <UserPlus size={18} />
                                 Eliminar Amigo
                             </button>
                         ) : (
                             <button 
                                 onClick={() => {
                                     socket.emit('send_friend_request', selectedUserModal.username, (res: any) => {
                                         if(res.success) {
                                             setSelectedUserModal(null);
                                         }
                                     });
                                 }}
                                 className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-colors border text-cyan-400 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20"
                             >
                                 <UserPlus size={18} />
                                 Enviar solicitud
                             </button>
                         )}
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

       {/* Friends Sidebar / Buzón (State Stack on Mobile, Modal on Desktop) */}
       <div className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-300 ${isFriendsSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none delay-100'} ${isFriendsSidebarOpen && mobileView !== 'buzon' ? 'bg-black/60 backdrop-blur-sm' : 'bg-[#07090e] sm:bg-transparent'}`} onClick={() => { setIsFriendsSidebarOpen(false); }}>
           <div className={`bg-[#12141c] rounded-none sm:rounded-3xl w-full sm:max-w-md shadow-2xl relative border-0 sm:border border-white/10 flex flex-col h-full sm:h-[85vh] transition-transform duration-300 ${isFriendsSidebarOpen ? 'translate-x-0 sm:translate-y-0' : '-translate-x-full sm:-translate-y-10 sm:translate-x-0'}`} onClick={e => e.stopPropagation()}>
               <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0a0a16] sm:bg-transparent">
                   <div className="flex flex-col gap-2">
                       <h2 className="text-lg font-bold text-white flex items-center gap-2">
                           <Users size={20} className="text-cyan-400" />
                           Buzón de Amigos
                       </h2>
                   </div>
                   <button onClick={() => { setIsFriendsSidebarOpen(false); }} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                       <X size={20} />
                   </button>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-1">
                   {user.friend_requests && user.friend_requests.length > 0 && (
                           <div className="mb-4">
                               <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-2">Solicitudes Pendientes</h3>
                               {user.friend_requests.map(reqUsername => (
                                   <div key={`req-${reqUsername}`} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 mb-2">
                                       <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 overflow-hidden relative shrink-0">
                                           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${reqUsername}`} className="w-full h-full object-cover" />
                                       </div>
                                       <div className="flex-1 min-w-0">
                                           <p className="text-white font-medium text-sm truncate">{reqUsername}</p>
                                           <p className="text-xs text-gray-400">Quiere ser tu amigo</p>
                                       </div>
                                       <div className="flex gap-2 shrink-0">
                                           <button onClick={() => socket.emit('accept_friend_request', reqUsername)} className="bg-green-500/20 text-green-400 p-2 rounded-xl hover:bg-green-500/30 transition-colors">
                                               ✓
                                           </button>
                                           <button onClick={() => socket.emit('reject_friend_request', reqUsername)} className="bg-red-500/20 text-red-400 p-2 rounded-xl hover:bg-red-500/30 transition-colors">
                                               ✕
                                           </button>
                                       </div>
                                   </div>
                               ))}
                           </div>
                       )}

                       {user.friends_list && user.friends_list.length > 0 && (
                          <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-2">Amigos</h3>
                       )}
                       {(!user.friends_list || user.friends_list.length === 0) ? (
                           <p className="text-gray-500 text-center text-sm mt-10">No tienes amigos agregados aún.</p>
                       ) : (
                           user.friends_list.map(friendUsername => {
                               const isOnline = usersOnline.some(u => u.username === friendUsername);
                               const friendInfo = usersOnline.find(u => u.username === friendUsername);
                               const hasNewMsg = unreadPMs[friendUsername];
                               return (
                                   <div 
                                       key={friendUsername} 
                                       onClick={() => { 
                                           setActiveChat(friendUsername); 
                                           setUnreadPMs(prev => ({...prev, [friendUsername]: false})); 
                                           setMobileView('chat');
                                       }}
                                       className={`flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors border group ${hasNewMsg ? 'border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'border-transparent hover:border-white/5'}`}
                                   >
                                       <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 overflow-hidden relative shrink-0">
                                           <img src={friendInfo?.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendUsername}`} className="w-full h-full object-cover" />
                                           <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0f111a] ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                       </div>
                                       <div className="flex-1 min-w-0">
                                           <div className="flex justify-between items-center">
                                               <p className="text-white font-medium text-sm truncate">{friendUsername}</p>
                                               {hasNewMsg && <div className="text-[10px] font-bold bg-cyan-500 text-[#0f111a] px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]">Nuevo</div>}
                                           </div>
                                           <p className="text-xs text-gray-500 truncate">{isOnline ? friendInfo?.statusMessage || 'Conectado' : 'Desconectado'}</p>
                                       </div>
                                   </div>
                               );
                           })
                       )}
                   </div>
               </div>
           </div>
       {/* Fama Modal (Bottom Sheet) */}
       {showFamaModal && (
           <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in" onClick={() => setShowFamaModal(false)}>
               <div className="bg-[#12141c] rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl relative border-t border-x sm:border-b border-white/10 flex flex-col h-[85vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
                   <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                       <div className="flex flex-col gap-2">
                           <div className="w-12 h-1 bg-white/20 rounded-full sm:hidden"></div>
                           <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                               <span className="text-2xl">🏆</span> Legado
                           </h2>
                       </div>
                       <button onClick={() => setShowFamaModal(false)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                           <X size={20} />
                       </button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {hallOfFame.length === 0 ? <p className="text-gray-400 text-center text-sm mt-10 italic">Vacio.</p> : null}
                        {hallOfFame.map((story, i) => (
                            <div key={i} className="bg-gradient-to-br from-[#1c1822] to-[#12141c] border border-yellow-500/20 p-5 rounded-2xl shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl"></div>
                                <h3 className="text-xl font-bold text-white mb-1 relative z-10">{story.title}</h3>
                                <p className="text-xs text-yellow-500/80 font-bold mb-4 italic uppercase tracking-wider relative z-10">Autores: {story.authors.join(', ')}</p>
                                <div className="space-y-1 mb-4 text-gray-300 font-serif leading-relaxed border-l-2 border-yellow-500/30 pl-4 text-sm relative z-10">
                                    {story.phrases.map((p: any, j: number) => (
                                        <span key={j}>{p.text} </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-500 text-right font-medium relative z-10">{new Date(story.date).toLocaleDateString()}</p>
                            </div>
                        ))}
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

