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

import { StoreModal } from './components/StoreModal';

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

const DECORATIONS = [
  // Básico (500 Liz-Moneditas)
  { id: 'dec_b1', type: 'basic', price: 500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=flower1' },
  { id: 'dec_b2', type: 'basic', price: 500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=star' },
  { id: 'dec_b3', type: 'basic', price: 500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=heart' },
  { id: 'dec_b4', type: 'basic', price: 500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=leaf' },
  { id: 'dec_b5', type: 'basic', price: 500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=cloud' },
  // Intermedio (1200 Liz-Moneditas)
  { id: 'dec_i1', type: 'intermediate', price: 1200, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=cat' },
  { id: 'dec_i2', type: 'intermediate', price: 1200, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=dog' },
  { id: 'dec_i3', type: 'intermediate', price: 1200, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=rabbit' },
  { id: 'dec_i4', type: 'intermediate', price: 1200, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=bird' },
  { id: 'dec_i5', type: 'intermediate', price: 1200, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=fish' },
  // Premium (2500 Liz-Moneditas)
  { id: 'dec_p1', type: 'premium', price: 2500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=crown' },
  { id: 'dec_p2', type: 'premium', price: 2500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=diamond' },
  { id: 'dec_p3', type: 'premium', price: 2500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=dragon' },
  { id: 'dec_p4', type: 'premium', price: 2500, url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=unicorn' },
];

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
  const [tutiFruttiState, setTutiFruttiState] = useState<any>({ isActive: false, players: [], currentLetter: '', roundEndTime: 0, scores: {}, answers: {}, maxPlayers: 5 });
  const [tfAnswers, setTfAnswers] = useState({ name: '', color: '', animal: '', fruit: '', thing: '' });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
     const interval = setInterval(() => setNow(Date.now()), 1000);
     return () => clearInterval(interval);
  }, []);
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
  
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  
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
    
    if (activeChat === 'global' || activeChat === 'tutifrutti') {
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
      if (activeChat === 'global' || activeChat === 'tutifrutti') {
          setMessages(prev => {
             if (prev.some(m => m.id === msg.id)) return prev;
             return [...prev, msg];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });

    socket.on('receive_private', (msg: any, fromUser: string) => {
      if (activeChat === fromUser) {
        setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        setUnreadPMs(prev => ({ ...prev, [fromUser]: true }));
      }
    });

    socket.on('tutifrutti_state', (state: any) => {
      setTutiFruttiState(state);
    });

    socket.emit('get_hall_of_fame', (data: any[]) => {
      setHallOfFame(data);
    });

    socket.on('active_users', (usersList: UserObj[]) => {
      const cleaned = usersList.filter(u => u.username !== 'Elizabeth' && u.username !== user.username);
      const elizabeth = usersList.find(u => u.username === 'Elizabeth') || { username: 'Elizabeth', statusMessage: 'Administradora', role: 'admin' };
      cleaned.unshift(elizabeth); 
      setUsersOnline(cleaned);
      const me = usersList.find(u => u.username === user.username);
      if (me) {
          setUser(prev => ({ ...prev, ...me }));
      }
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

    if (activeChat === 'global' || activeChat === 'tutifrutti') {
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      const options = {
        audioBitsPerSecond: 128000,
      };
      
      let mimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
         mimeType = 'audio/mp4;codecs=mp4a.40.2';
      } else if (!MediaRecorder.isTypeSupported(mimeType) && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
         mimeType = 'audio/ogg;codecs=opus';
      }

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType, ...options });
      audioChunks.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: mimeType });
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
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }} className="bg-gradient-to-br from-[#0B1220] via-[#121B2A] to-[#0A101C] text-gray-200 flex flex-col font-sans">
      
      {/* Top Navigation Bar (Floating/Overlay style) */}
      <nav className="flex items-center justify-between px-4 py-3 shrink-0 z-50 relative w-full">
         <div className="flex-1 flex items-center justify-start">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-[#D4AF37] hover:text-[#E8D9B0] p-2 rounded-full hover:bg-white/5 transition-colors">
                 <Menu size={24} strokeWidth={1.5} />
             </button>
         </div>

         {/* Center: Chat-Liz pill */}
         <div className="flex-1 flex justify-center">
             <div className="bg-[#121B2A]/60 backdrop-blur-md border border-[#D4AF37]/30 rounded-full px-6 py-1.5 shadow-[0_0_15px_rgba(212,175,55,0.1)] flex items-center justify-center">
                 <h1 className="text-[16px] font-bold text-[#E8D9B0] tracking-wide">Chat-Liz</h1>
             </div>
         </div>

         {/* Right: Avatar, Name, Settings */}
         <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
             <div className="hidden sm:flex items-center gap-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 px-3 py-1 rounded-full cursor-pointer hover:bg-amber-500/30 transition-colors" onClick={() => setIsStoreOpen(true)}>
                 <span className="text-amber-400 font-bold text-sm">{user.lizCoins || 0}</span>
                 <span className="text-xs text-amber-200">LM</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full overflow-visible shrink-0 relative flex justify-center items-center">
                    {user.activeDecoration && (
                        <div className="absolute -inset-1.5 pointer-events-none z-10 flex items-center justify-center">
                            <img src={DECORATIONS.find(d => d.id === user.activeDecoration)?.url} className="w-full h-full object-contain filter drop-shadow-sm" style={{ imageRendering: 'pixelated' }} alt="" />
                        </div>
                    )}
                    <div className="w-full h-full rounded-full border border-[#D4AF37]/50 overflow-hidden relative z-0">
                        <img src={user.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                 </div>
                 <span className="font-medium text-[#E8D9B0] text-[14px] tracking-wide hidden sm:block">{user.username}</span>
             </div>
             <button 
                onClick={() => { setIsConfigOpen(true); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#D4AF37] hover:text-[#E8D9B0] transition-colors"
             >
                <Settings size={20} strokeWidth={1.5} />
             </button>
         </div>
      </nav>

      {/* Main Content Layout */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">

          
          {/* Sidebar */}
          <aside className={`w-[280px] bg-[#0B1220] rounded-3xl border border-[#D4AF37]/20 flex flex-col min-h-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all shrink-0 ${isSidebarOpen ? 'translate-x-0 absolute z-40 h-full left-0' : 'hidden md:flex'}`}>
              
              {/* Inner ambient glow for sidebar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#D4AF37]/10 blur-[60px] rounded-full pointer-events-none"></div>

              {/* Elizabeth Profile Area (Sidebar header) */}
              <div className="flex flex-col items-center pt-8 pb-4 relative z-10 border-b border-[#D4AF37]/10">
                 <button 
                    onClick={() => setActiveChat('Elizabeth')}
                    className="relative mb-3 group transition-transform hover:scale-105"
                 >
                    <div className="absolute inset-0 bg-[#D4AF37] blur-2xl opacity-10 rounded-full group-hover:opacity-30 transition-opacity"></div>
                    <div className={`w-24 h-24 rounded-full border ${activeChat === 'Elizabeth' ? 'border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.4)]' : 'border-[#D4AF37]/50'} p-1 relative z-10 bg-[#121B2A] flex items-center justify-center overflow-hidden [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]`}>
                       {(usersOnline.find(u => u.username === 'Elizabeth')?.profilePic) ? (
                         <img src={usersOnline.find(u => u.username === 'Elizabeth')?.profilePic} className="w-full h-full object-cover rounded-full" alt="Elizabeth" />
                       ) : (
                         <Bot size={48} className="text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
                       )}
                    </div>
                    {/* Glowing dot for online status */}
                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-[#D4AF37] rounded-full border-2 border-[#0B1220] shadow-[0_0_8px_rgba(212,175,55,0.6)]"></div>
                 </button>
                 
                 <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center leading-tight">
                       <span className="font-bold text-[#E8D9B0] text-[16px]">ELIZABETH <span className="text-[#D4AF37] font-normal">✨</span></span>
                       <span className="text-[12px] text-[#D4AF37]">Administradora IA</span>
                    </div>
                    <button 
                       className="p-1.5 rounded-full hover:bg-white/10 text-[#D4AF37]/70 hover:text-[#D4AF37] transition-colors"
                       title="Perfil de Elizabeth"
                       onClick={() => {
                          const elizabethUser = usersOnline.find(u => u.username === 'Elizabeth') || {username: 'Elizabeth', statusMessage: 'Administradora', role: 'admin'};
                          if (user.username.trim() === "Axiss") {
                              setAiProfileForm({ profilePic: elizabethUser.profilePic || '', statusMessage: elizabethUser.statusMessage || 'Administradora', systemInstruction: elizabethUser.systemInstruction || '' });
                              setAdminConfigLizOpen(true);
                          } else {
                              setSelectedUserModal(elizabethUser);
                          }
                       }}
                    >
                       <Settings size={14} />
                    </button>
                 </div>
              </div>
                 {/* Actions / Utilities */}
                 <div className="px-4 mt-2 grid grid-cols-2 gap-2">
                     <button id="music-toggle" onClick={() => setIsMusicPlaying(!isMusicPlaying)} className="flex items-center justify-center gap-2 text-[#D4AF37] bg-[#121B2A]/80 border border-[#D4AF37]/30 px-3 py-2 rounded-2xl hover:bg-white/5 hover:text-[#E8D9B0] transition-all text-sm font-medium shadow-sm">
                        {isMusicPlaying ? <Volume2 size={16} strokeWidth={1.5} /> : <VolumeX size={16} strokeWidth={1.5} />}
                        Música
                     </button>
                     <button className={`flex items-center justify-center gap-2 text-[#D4AF37] bg-[#121B2A]/80 border ${activeChat === 'global' ? 'border-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'border-[#D4AF37]/30'} px-3 py-2 rounded-2xl hover:bg-white/5 hover:text-[#E8D9B0] transition-all text-sm font-medium shadow-sm`} onClick={() => setActiveChat('global')}>
                        <Globe size={16} strokeWidth={1.5} />
                        Mundo
                     </button>
                     <button className={`flex items-center justify-center gap-2 text-[#D4AF37] bg-[#121B2A]/80 border ${activeChat === 'tutifrutti' ? 'border-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'border-[#D4AF37]/30'} px-3 py-2 rounded-2xl hover:bg-white/5 hover:text-[#E8D9B0] transition-all text-sm font-medium shadow-sm`} onClick={() => setActiveChat('tutifrutti')}>
                        <Bot size={16} strokeWidth={1.5} />
                        Tuti Frutti
                     </button>
                     <button className={`flex items-center justify-center gap-2 text-[#D4AF37] bg-[#121B2A]/80 border ${isFriendsSidebarOpen ? 'border-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'border-[#D4AF37]/30'} px-3 py-2 rounded-2xl hover:bg-white/5 hover:text-[#E8D9B0] transition-all text-sm font-medium shadow-sm`} onClick={() => setIsFriendsSidebarOpen(!isFriendsSidebarOpen)}>
                        <Users size={16} strokeWidth={1.5} />
                        Amigos
                        {Object.values(unreadPMs).some(v => v) && (
                           <div className="w-2 h-2 bg-cyan-500 rounded-full ml-1"></div>
                        )}
                     </button>
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
                                 className="w-10 h-10 rounded-full flex items-center justify-center overflow-visible cursor-pointer flex-shrink-0 relative"
                                 onClick={() => {
                                    if (u.username === 'Elizabeth' && user.username.trim() === "Axiss") {
                                        setAiProfileForm({ profilePic: u.profilePic || '', statusMessage: u.statusMessage || 'Administradora', systemInstruction: u.systemInstruction || '' });
                                        setAdminConfigLizOpen(true);
                                    } else {
                                        setSelectedUserModal(u);
                                    }
                                 }}
                               >
                                   {u.activeDecoration && (
                                       <div className="absolute -inset-2 pointer-events-none z-10 flex items-center justify-center">
                                           <img src={DECORATIONS.find(d => d.id === u.activeDecoration)?.url} className="w-full h-full object-contain filter drop-shadow-sm" style={{ imageRendering: 'pixelated' }} alt="" />
                                       </div>
                                   )}
                                   <div className="w-full h-full rounded-full border border-white/10 overflow-hidden relative z-0">
                                       <img src={u.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt="avatar" className="w-full h-full object-cover" />
                                   </div>
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
          <main className="flex-1 min-w-0 min-h-0 relative flex flex-col bg-transparent overflow-hidden"
                style={{ background: chatBg ? `url(${chatBg}) center/cover no-repeat` : undefined }}>
              
              {/* Chat Content Wrapper */}
              <div className="flex-1 min-h-0 min-w-0 flex flex-col relative z-0">
                  <div className="hidden"></div>

              {activeChat === 'tutifrutti' ? (
                 <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto bg-[#FFF5F8] relative">
                    {/* Header Kawaii */}
                    <div className="absolute top-0 left-0 right-0 w-full bg-gradient-to-r from-pink-300 to-purple-300 p-4 flex justify-between items-center shadow-md z-20 rounded-b-3xl border-b-4 border-white">
                       <h2 className="text-white font-extrabold text-2xl drop-shadow-sm flex items-center gap-2">
                           🍓 Tuti Frutti Kawaii 🍉
                       </h2>
                       <button onClick={() => { socket.emit('leave_tutifrutti'); setActiveChat('global'); }} className="bg-white text-pink-500 font-bold hover:bg-pink-50 px-5 py-2 rounded-full transition-colors shadow-sm">
                           Abandonar Partida
                       </button>
                    </div>

                    <div className="mt-24 w-full max-w-4xl flex flex-col md:flex-row gap-6">
                        {/* Main Game Area */}
                        <div className="flex-1 bg-white p-8 rounded-[32px] shadow-[0_8px_30px_rgba(236,72,153,0.15)] border-4 border-pink-100 flex flex-col">
                            {!tutiFruttiState.isActive ? (
                                <div className="text-center flex-1 flex flex-col items-center justify-center">
                                    <div className="text-6xl mb-4 animate-bounce">🎨</div>
                                    <h3 className="text-3xl font-bold text-pink-500 mb-2">¡Sala de Espera!</h3>
                                    <p className="text-gray-500 mb-8 text-lg">Únete a la partida y demuestra tu rapidez mental.</p>
                                    
                                    {!tutiFruttiState.players.includes(user.username) ? (
                                        <div className="flex flex-col items-center gap-4">
                                            <button 
                                                onClick={() => socket.emit('join_tutifrutti')} 
                                                disabled={tutiFruttiState.players.length >= tutiFruttiState.maxPlayers}
                                                className="bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white px-10 py-4 rounded-full text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
                                            >
                                                {tutiFruttiState.players.length >= tutiFruttiState.maxPlayers ? 'Sala Llena' : 'Unirme al Juego ✨'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4">
                                            <p className="text-pink-500 font-bold text-xl">
                                                Esperando jugadores... ({tutiFruttiState.players.length}/{tutiFruttiState.maxPlayers})
                                            </p>
                                            
                                            <div className="flex items-center gap-2 mb-2 text-pink-500 font-bold">
                                                <label>Jugadores requeridos:</label>
                                                <select 
                                                    value={tutiFruttiState.maxPlayers} 
                                                    onChange={(e) => socket.emit("set_max_players", parseInt(e.target.value))}
                                                    className="bg-white border-2 border-pink-200 rounded-lg p-1 outline-none"
                                                >
                                                    <option value={2}>2</option>
                                                    <option value={3}>3</option>
                                                    <option value={4}>4</option>
                                                    <option value={5}>5</option>
                                                </select>
                                            </div>

                                            <button 
                                                onClick={() => socket.emit('start_tutifrutti_round')} 
                                                disabled={tutiFruttiState.players.length < tutiFruttiState.maxPlayers}
                                                className="bg-gradient-to-r from-green-400 to-emerald-400 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-4 rounded-full text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
                                            >
                                                ¡Comenzar Ronda! 🚀
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col flex-1">
                                    <div className="flex justify-between items-center mb-6 bg-pink-50 p-4 rounded-2xl border-2 border-pink-100">
                                        <div className="text-center">
                                            <p className="text-pink-400 font-bold text-sm uppercase tracking-wider mb-1">Letra Actual</p>
                                            <p className="text-5xl font-black text-purple-600 drop-shadow-sm">{tutiFruttiState.currentLetter}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-pink-400 font-bold text-sm uppercase tracking-wider mb-1">Tiempo</p>
                                            <p className={`text-4xl font-black ${tutiFruttiState.roundEndTime - now < 10000 ? 'text-red-500 animate-pulse' : 'text-pink-500'}`}>
                                                {Math.max(0, Math.floor((tutiFruttiState.roundEndTime - now) / 1000))}s
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 flex-1">
                                        {['name', 'color', 'animal', 'fruit', 'thing'].map((cat) => (
                                            <div key={cat} className="flex flex-col">
                                                <label className="text-purple-500 font-bold text-sm mb-1 ml-2 capitalize">
                                                    {cat === 'name' ? 'Nombre' : cat === 'color' ? 'Color' : cat === 'animal' ? 'Animal' : cat === 'fruit' ? 'Fruta' : 'Cosa'}
                                                </label>
                                                <input 
                                                    disabled={!tutiFruttiState.players.includes(user.username)}
                                                    value={(tfAnswers as any)[cat]}
                                                    onChange={e => setTfAnswers({...tfAnswers, [cat]: e.target.value})}
                                                    className="bg-white border-2 border-pink-200 p-3 rounded-2xl outline-none text-gray-700 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all font-medium text-lg placeholder-pink-200"
                                                    placeholder={`Escribe un(a) ${cat}...`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <button 
                                        disabled={!tutiFruttiState.players.includes(user.username)}
                                        onClick={() => {
                                            socket.emit('submit_tutifrutti', tfAnswers);
                                            socket.emit('stop_tutifrutti');
                                            setTfAnswers({ name: '', color: '', animal: '', fruit: '', thing: '' });
                                        }}
                                        className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white p-4 rounded-2xl font-black text-2xl shadow-xl transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                    >
                                        ¡TUTI FRUTTI! 🛑
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Sidebar (Scoreboard & Players) */}
                        <div className="w-full md:w-72 flex flex-col gap-6">
                            <div className="bg-white p-6 rounded-[32px] shadow-[0_8px_30px_rgba(236,72,153,0.15)] border-4 border-purple-100 flex-1">
                                <h3 className="text-xl font-bold text-purple-600 mb-4 flex items-center gap-2">
                                    🏆 Tabla de Puntos
                                </h3>
                                <div className="space-y-3">
                                    {Object.entries(tutiFruttiState.scores || {}).sort((a: any, b: any) => b[1] - a[1]).map(([p, score]: any, i) => (
                                        <div key={p} className="flex justify-between items-center p-3 bg-purple-50 rounded-2xl border border-purple-100">
                                            <span className="font-bold text-purple-700 flex items-center gap-2">
                                                {i === 0 ? '👑' : '⭐'} {p}
                                            </span>
                                            <span className="font-black text-pink-500 bg-white px-3 py-1 rounded-full shadow-sm">{score}</span>
                                        </div>
                                    ))}
                                    {Object.keys(tutiFruttiState.scores || {}).length === 0 && (
                                        <p className="text-pink-300 text-center italic text-sm mt-4">Aún no hay puntos.</p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-[32px] shadow-[0_8px_30px_rgba(236,72,153,0.15)] border-4 border-blue-100">
                                <h3 className="text-lg font-bold text-blue-500 mb-3 flex items-center gap-2">
                                    🎮 Jugadores ({tutiFruttiState.players?.length || 0})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {tutiFruttiState.players?.map((p: string) => (
                                        <span key={p} className="bg-blue-50 text-blue-600 font-semibold px-3 py-1.5 rounded-full text-sm border border-blue-100">
                                            {p}
                                        </span>
                                    ))}
                                    {(!tutiFruttiState.players || tutiFruttiState.players.length === 0) && (
                                        <span className="text-blue-300 text-sm italic">Esperando jugadores...</span>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-[32px] shadow-[0_8px_30px_rgba(236,72,153,0.15)] border-4 border-blue-100 flex flex-col flex-1 min-h-[300px]">
                                <h3 className="text-lg font-bold text-blue-500 mb-3 flex items-center gap-2">
                                    💬 Chat del Juego
                                </h3>
                                <div className="flex-1 overflow-y-auto mb-3 space-y-2 pr-2 scrollbar-thin">
                                    {messages.slice(-15).map((m: any, idx) => (
                                        <div key={idx} className="bg-blue-50/50 p-2 rounded-2xl">
                                            <span className="font-bold text-blue-600 text-xs mr-2">{m.sender}:</span>
                                            {m.image ? (
                                                <img src={m.image} className="h-20 rounded-lg mt-1" alt="Adjunto" />
                                            ) : m.audio ? (
                                                <audio src={m.audio} controls className="h-6 mt-1 w-full max-w-[200px]" />
                                            ) : (
                                                <span className="text-gray-700 text-sm font-medium">{m.text}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                
                                {(selectedImage || audioUrl || selectedGif) && (
                                    <div className="flex gap-2 mb-2">
                                        {selectedImage && <div className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded-full">📷 Imagen lista</div>}
                                        {selectedGif && <div className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded-full">🎞️ GIF listo</div>}
                                        {audioUrl && <div className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded-full">🎙️ Audio listo</div>}
                                    </div>
                                )}
                                
                                <div className="flex gap-2 relative mt-auto items-center">
                                    <div className="flex-1 flex items-center bg-white border-2 border-blue-200 rounded-full px-3 focus-within:border-pink-400 focus-within:ring-2 focus-within:ring-pink-100 transition-all">
                                        <input 
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && inputValue.trim()) handleSendMessage();
                                            }}
                                            className="flex-1 py-2 outline-none text-gray-700 text-sm placeholder-blue-300 bg-transparent"
                                            placeholder="Escribe un mensaje..."
                                        />
                                        <div className="flex items-center gap-1 text-blue-400">
                                            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="hover:text-pink-500 p-1 transition-colors"><Smile size={18} strokeWidth={2} /></button>
                                            <button onClick={() => fileInputRef.current?.click()} className="hover:text-pink-500 p-1 transition-colors"><Paperclip size={18} strokeWidth={2} /></button>
                                            <button onClick={isRecording ? stopRecording : startRecording} className={`p-1 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'hover:text-pink-500'}`}>
                                                {isRecording ? <StopCircle size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
                                            </button>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleSendMessage}
                                        disabled={!inputValue.trim() && !selectedImage && !audioUrl && !selectedGif}
                                        className="bg-gradient-to-r from-blue-400 to-pink-400 hover:from-blue-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all shadow-md shrink-0 transform hover:scale-105 active:scale-95"
                                    >
                                        <Send size={16} strokeWidth={2.5} className="ml-1" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
              ) : (
                <>
                  {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto px-2 md:px-4 py-2 space-y-1.5 scrollbar-thin">
                  {messages.filter(m => m && m.sender).map((m, idx) => {
                     const isLiz = m.sender === 'Elizabeth' || m.isAi;
                     const isMe = m.sender === user.username;
                     const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                     const timeStr = isNaN(date.getTime()) ? `10:0${idx % 10}` : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                     const senderInfo = isMe ? user : usersOnline.find(u => u.username === m.sender);
                     const decId = senderInfo?.activeDecoration;
                     const decUrl = decId ? DECORATIONS.find(d => d.id === decId)?.url : null;

                     return (
                         <div key={m.id || idx} className="flex justify-start px-1 md:px-2">
                             {isLiz ? (
                                 <div className="pl-2.5 py-0.5 flex flex-col max-w-[98%] border-l-[3px] border-[#D4AF37]/20 ml-1">
                                     <div className="flex items-baseline flex-wrap">
                                         <span className="text-[#8B98B0] mr-1.5 text-[13px] font-mono">[{timeStr}]</span>
                                         <div className="flex items-center relative mr-1.5 shrink-0">
                                            {decUrl && (
                                                <div className="absolute -inset-2 pointer-events-none z-10 flex items-center justify-center">
                                                    <img src={decUrl} className="w-full h-full object-contain filter drop-shadow-sm" style={{ imageRendering: 'pixelated' }} alt="" />
                                                </div>
                                            )}
                                            <span className="font-bold text-[#D4AF37] text-[14px] relative z-20">ELIZABETH {m.isAi && '(IA Administradora Gemini ✨)'}:</span>
                                         </div>
                                         <span className="text-[#E8D9B0] text-[14px] leading-snug ml-1">{m.text}</span>
                                     </div>
                                     {m.image && <div className="mt-1"><img src={m.image} className="rounded-xl border border-white/10 max-w-full shadow-md h-28 object-cover" alt="adjunto"/></div>}
                                     {(m.type === 'audio' || m.audio) && <div className="mt-1 bg-[#13151f] p-1.5 rounded-xl border border-white/5 shadow-inner"><audio src={m.audio} controls className="h-6 max-w-[160px] opacity-90" /></div>}
                                 </div>
                             ) : (
                                 <div className="bg-[#F2E3C6] rounded-[20px] px-3.5 py-1 max-w-[95%] shadow-sm flex items-baseline flex-wrap">
                                     <span className="text-[#6B7280] mr-1.5 text-[13px] font-mono">[{timeStr}]</span>
                                     <div className="flex items-center relative mr-1.5 shrink-0">
                                        {decUrl && (
                                            <div className="absolute -inset-3 pointer-events-none z-10 flex items-center justify-center">
                                                <img src={decUrl} className="w-[120%] h-[120%] object-contain filter drop-shadow-sm opacity-80 mix-blend-multiply" style={{ imageRendering: 'pixelated' }} alt="" />
                                            </div>
                                        )}
                                        <span className="font-bold text-[#5A52A5] text-[14px] relative z-20 px-1">{m.sender}:</span>
                                     </div>
                                     <span className="text-[#1A2035] text-[14px] leading-snug ml-1">{m.text}</span>
                                     {m.image && <div className="w-full mt-1"><img src={m.image} className="rounded-xl border border-black/10 max-w-full shadow-md h-28 object-cover" alt="adjunto"/></div>}
                                     {(m.type === 'audio' || m.audio) && <div className="w-full mt-1 bg-white/50 p-1.5 rounded-xl border border-black/5 shadow-inner"><audio src={m.audio} controls className="h-6 max-w-[160px]" /></div>}
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
              <div className="px-2 pb-2 pt-1 shrink-0 bg-transparent relative z-10 max-w-5xl w-full mx-auto">
                  {(selectedImage || audioUrl || selectedGif) && (
                    <div className="flex gap-4 mb-3">
                      {selectedImage && (
                        <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                           <img src={selectedImage} alt="Preview" className="h-16 w-16 rounded-xl border-2 border-[#D4AF37] object-cover shadow-lg" />
                           <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                        </div>
                      )}
                      {selectedGif && (
                        <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                           <img src={selectedGif} alt="GIF Preview" className="h-16 w-16 rounded-xl border-2 border-[#D4AF37] object-cover shadow-lg" />
                           <button onClick={() => setSelectedGif(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                        </div>
                      )}
                      {audioUrl && (
                        <div className="relative flex items-center gap-2 bg-[#121927] px-3 py-1.5 rounded-xl border border-[#D4AF37]/40 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                           <audio src={audioUrl} controls className="h-6 w-32 opacity-90" />
                           <button onClick={() => setAudioUrl(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 relative">
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                      <div className="flex-1 bg-transparent border border-[#D4AF37]/50 rounded-[24px] flex items-center px-4 py-1.5 relative shadow-[0_0_15px_rgba(212,175,55,0.05)] focus-within:border-[#D4AF37] focus-within:shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all">
                          <input 
                             value={inputValue}
                             onChange={handleInputChange}
                             onKeyDown={e => {
                                if (e.key === 'Enter') handleSendMessage();
                             }}
                             className="w-full bg-transparent outline-none text-[#E8D9B0] placeholder-[#D4AF37]/60 text-[14px] py-1" 
                             placeholder="Escribe tu mensaje... @Elizabeth para IA carismática"
                          />
                          <div className="flex items-center gap-1 text-[#D4AF37]/80 ml-2 shrink-0">
                              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="hover:text-[#D4AF37] p-1.5 transition-colors"><Smile size={20} strokeWidth={1.5} /></button>
                              <button onClick={() => fileInputRef.current?.click()} className="hover:text-[#D4AF37] p-1.5 transition-colors"><Paperclip size={20} strokeWidth={1.5} /></button>
                              <button onClick={isRecording ? stopRecording : startRecording} className={`p-1.5 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'hover:text-[#D4AF37]'}`}>
                                 {isRecording ? <StopCircle size={20} strokeWidth={1.5} /> : <Mic size={20} strokeWidth={1.5} />}
                              </button>
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
                        className="w-[46px] h-[46px] rounded-[16px] bg-[#121B2A]/80 backdrop-blur-md border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] hover:text-[#E8D9B0] hover:bg-[#D4AF37]/20 transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] shrink-0 disabled:opacity-50 disabled:shadow-none"
                      >
                        <Send size={20} className="ml-0.5" strokeWidth={1.5} />
                      </button>
                  </div>
              </div>
              </>
              )}
              </div>
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
                className={`w-24 h-24 mx-auto mb-4 rounded-full border border-white/10 overflow-visible relative ${selectedUserModal.username === 'Elizabeth' && user.username.trim() === 'Axiss' ? 'cursor-pointer group' : ''}`}
                onClick={() => {
                    if (selectedUserModal.username === 'Elizabeth' && user.username.trim() === 'Axiss') {
                        setAiProfileForm({ profilePic: selectedUserModal.profilePic || '', statusMessage: selectedUserModal.statusMessage || 'Administradora', systemInstruction: selectedUserModal.systemInstruction || '' });
                        setSelectedUserModal(null);
                        setAdminConfigLizOpen(true);
                    }
                }}
             >
                {selectedUserModal.activeDecoration && (
                    <div className="absolute -inset-4 pointer-events-none z-10 flex items-center justify-center">
                        <img src={DECORATIONS.find(d => d.id === selectedUserModal.activeDecoration)?.url} className="w-full h-full object-contain filter drop-shadow-lg" style={{ imageRendering: 'pixelated' }} alt="" />
                    </div>
                )}
                <div className="w-full h-full rounded-full overflow-hidden relative z-0">
                    <img src={selectedUserModal.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUserModal.username}`} className="w-full h-full object-cover" alt="Avatar" />
                    {selectedUserModal.username === 'Elizabeth' && user.username.trim() === 'Axiss' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-bold text-white uppercase text-center px-1">Cambiar Foto</span>
                        </div>
                    )}
                </div>
             </div>
             <h3 className="text-xl font-bold text-white mb-1 flex items-center justify-center gap-2">
                {selectedUserModal.username}
                {selectedUserModal.awards && selectedUserModal.awards.map((award, idx) => (
                    <span key={idx} className="text-xl" title="Galardón: Pluma Infinita">{award}</span>
                ))}
                {selectedUserModal.role === 'admin' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">Admin</span>}
             </h3>
             <div className="flex justify-center items-center gap-3 mb-4">
                 <p className="text-cyan-400 text-sm">Online</p>
                 <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                     <span className="text-amber-500 font-bold text-xs">{selectedUserModal.lizCoins || 0}</span>
                     <span className="text-[10px] text-amber-500/70">Liz-Moneditas</span>
                 </div>
             </div>
             
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

       {/* Store Modal */}
       {isStoreOpen && (
           <StoreModal 
               onClose={() => setIsStoreOpen(false)} 
               user={user} 
               decorations={DECORATIONS} 
           />
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
