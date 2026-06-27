import React, { useState, useEffect, useRef, ErrorInfo, Component } from 'react';
import { 
  Send, User, MessageCircle, Settings, Bot, 
  Image as ImageIcon, Mic, StopCircle, 
  Menu, X, Hash, MessageSquare, LogOut, Search,
  Paperclip, Smile, Globe, Box
} from 'lucide-react';
import VRRoom from './components/VRRoom';
import { collection, onSnapshot, query, doc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { socket } from './socket';
import { UserObj, MessageObj } from './types';
import { Login } from './components/Login';
import { RecoveryModal } from './components/RecoveryModal';
import { ProfileConfigModal } from './components/ProfileConfigModal';
import { AdminConfigLizModal } from './components/AdminConfigLizModal';

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

  // Recovery States
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryCodeStr, setRecoveryCodeStr] = useState('');
  const [inputRecoveryCode, setInputRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
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
        setUser({ ...user, profilePic: res.profilePic, statusMessage: res.statusMessage, role: res.role, countryLanguage: res.countryLanguage || user.countryLanguage, timezone });
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
      }
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
    if (!inputValue.trim() && !selectedImage && !audioUrl) return;
    
    const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const payload: any = { text: inputValue, id: msgId };
    if (selectedImage) payload.image = selectedImage;
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
                onClick={() => setActiveChat('global')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${activeChat === 'global' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-[#13151f] border-white/10 text-gray-400 hover:text-white hover:border-white/30'} shadow-[0_4px_10px_rgba(0,0,0,0.5)]`}
             >
                <Globe size={20} />
                <span className="font-bold text-sm hidden sm:inline">Mundo</span>
             </button>
             <button 
                onClick={() => setActiveChat('vr')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${activeChat === 'vr' ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-[#13151f] border-white/10 text-gray-400 hover:text-white hover:border-white/30'} shadow-[0_4px_10px_rgba(0,0,0,0.5)]`}
             >
                <Box size={20} />
                <span className="font-bold text-sm hidden sm:inline">Sala VR</span>
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
          <aside className={`w-[280px] bg-[#12141c] rounded-3xl border border-white/5 flex flex-col min-h-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all shrink-0 ${isSidebarOpen ? 'translate-x-0 absolute z-40 h-full left-0' : 'hidden md:flex'}`}>
              
              {/* Inner ambient glow for sidebar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-cyan-500/10 blur-[60px] rounded-full pointer-events-none"></div>

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
                               <button className="text-left flex-1 truncate" onClick={() => setActiveChat(u.username)}>
                                 <span className="font-medium text-gray-300 text-[15px] truncate block">{u.username} <span className="text-gray-500">~</span></span>
                               </button>
                           </div>
                           <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] flex-shrink-0"></div>
                        </div>
                    )
                 })}
              </div>
          </aside>

          {/* Main Chat Container */}
          <main className="flex-1 min-w-0 min-h-0 rounded-3xl relative flex flex-col bg-[#0f111a] overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] border"
                style={{ background: 'linear-gradient(#0f111a, #0f111a) padding-box, linear-gradient(135deg, #06b6d4 0%, #a855f7 100%) border-box', border: '1px solid transparent' }}>
              
              {/* Outer gradient border illusion via linear-gradient using a wrapper, but implemented directly on container above with box-shadow */}
              
              {activeChat === 'vr' ? (
                  <VRRoom socket={socket} user={user} />
              ) : (
                  <>
              {/* Chat Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#0f111a]/80 backdrop-blur-md z-10 shrink-0">
                  <div className="flex items-center gap-2">
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-gray-400 hover:text-white mr-2">
                       <Menu size={20} />
                     </button>
                     <h2 className="text-[16px] md:text-lg font-bold text-white flex items-center gap-2">
                        {activeChat === 'global' ? 'CHAT GLOBAL #1 - Chat-Liz' : (activeChat === 'Elizabeth' ? 'Private Chat: Elizabeth' : `Private Chat: ${activeChat}`)}
                        {activeChat === 'global' && <span className="text-sm font-normal text-gray-500 ml-1">({usersOnline.filter(u => u.username !== 'Elizabeth').length + 1} usuarios online)</span>}
                     </h2>
                  </div>
                  {activeChat === 'global' && (
                     <button className="hidden md:flex items-center gap-2 text-gray-400 bg-transparent border border-white/10 px-4 py-1.5 rounded-full hover:bg-white/5 transition-all text-sm font-medium">
                        <MessageSquare size={16} />
                        Private chat
                        <Search size={16} className="ml-1 opacity-50" />
                     </button>
                  )}
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 scrollbar-thin">
                  {messages.filter((m, i, arr) => 
                     m && m.sender && !(i > 0 && m.sender === 'Elizabeth' && arr[i-1] && m.text === arr[i-1].text)
                  ).map((m, idx) => {
                     const isLiz = m.sender === 'Elizabeth' || m.isAi;
                     const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
                     const timeStr = isNaN(date.getTime()) ? `10:0${idx % 10}` : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                     return (
                         <div key={m.id || idx} className="text-[15px] font-medium leading-relaxed font-sans group">
                            <span className="text-gray-500 mr-2 font-normal">[{timeStr}]</span>
                            <span className={`font-bold mr-2 ${isLiz ? 'text-cyan-400' : 'text-blue-300'}`}>
                               {isLiz ? 'ELIZABETH:' : `${m.sender}:`}
                            </span>
                            <span className={isLiz ? 'text-gray-200' : 'text-gray-300'}>
                               {isLiz ? `"${m.text}"` : m.text}
                            </span>
                            {m.image && <div className="mt-3 ml-2"><img src={m.image} className="rounded-xl border border-white/10 max-w-[300px] shadow-lg" alt="adjunto"/></div>}
                            {(m.type === 'audio' || m.audio) && <div className="mt-3 ml-2 bg-[#13151f] p-2 rounded-xl inline-block border border-white/5 shadow-inner"><audio src={m.audio} controls className="h-8 max-w-[250px] filter opacity-90" /></div>}
                         </div>
                     );
                  })}

                  {/* Typing Indicator */}
                  {typingUsers[activeChat] && typingUsers[activeChat].length > 0 && (
                     <div className="flex flex-col gap-1 mb-4">
                        {typingUsers[activeChat].includes("Elizabeth") && (
                           <div className="text-cyan-400 text-sm font-medium italic flex items-center">
                              ELIZABETH está escribiendo<span className="ml-1 flex gap-1"><span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '0.2s'}}>.</span><span className="animate-bounce" style={{animationDelay: '0.4s'}}>.</span></span>
                           </div>
                        )}
                        {typingUsers[activeChat].filter(u => u !== "Elizabeth").length > 0 && (
                           <div className="text-gray-400 text-sm font-medium italic">
                              {typingUsers[activeChat].filter(u => u !== "Elizabeth").join(", ")} {typingUsers[activeChat].filter(u => u !== "Elizabeth").length > 1 ? 'están' : 'está'} escribiendo...
                           </div>
                        )}
                     </div>
                  )}

                  <div ref={bottomRef} className="h-2" />
              </div>

              {/* Input Area */}
              <div className="px-6 py-5 shrink-0 bg-[#0f111a]/90 backdrop-blur-md relative z-10">
                  {(selectedImage || audioUrl) && (
                    <div className="flex gap-4 mb-4">
                      {selectedImage && (
                        <div className="relative inline-block animate-in fade-in slide-in-from-bottom-2">
                           <img src={selectedImage} alt="Preview" className="h-20 w-20 rounded-xl border-2 border-cyan-500 object-cover shadow-lg" />
                           <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                        </div>
                      )}
                      {audioUrl && (
                        <div className="relative flex items-center gap-3 bg-[#1a1c26] px-4 py-2 rounded-xl border border-white/10 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                           <audio src={audioUrl} controls className="h-8 w-48 opacity-90" />
                           <button onClick={() => setAudioUrl(null)} className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1.5 shadow-xl"><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                      <div className="flex-1 bg-transparent border border-gray-600 rounded-full flex items-center px-4 py-1.5 relative shadow-inner focus-within:border-cyan-500/50 transition-all">
                          <input 
                             value={inputValue}
                             onChange={handleInputChange}
                             onKeyDown={e => {
                                if (e.key === 'Enter') handleSendMessage();
                             }}
                             className="w-full bg-transparent outline-none text-gray-200 placeholder-gray-500 text-[15px] py-1.5" 
                             placeholder="Escribe tu mensaje... @Elizabeth para hablar 😉"
                          />
                          <div className="flex items-center gap-3 text-gray-400 ml-3 mr-2">
                              <Smile size={20} className="hover:text-cyan-400 cursor-pointer transition-colors" />
                              <Paperclip onClick={() => fileInputRef.current?.click()} size={20} className="hover:text-cyan-400 cursor-pointer transition-colors" />
                          </div>
                      </div>
                      <button 
                        onClick={handleSendMessage} 
                        disabled={!inputValue.trim() && !selectedImage && !audioUrl}
                        className="bg-gradient-to-r from-[#0d9488] to-[#0891b2] rounded-full h-[46px] w-[46px] flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:shadow-none hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all shrink-0 ml-2"
                      >
                        <Send size={20} className="text-white ml-0.5" />
                      </button>
                      <button onClick={isRecording ? stopRecording : startRecording} className={`ml-2 flex items-center justify-center rounded-full h-[46px] w-[46px] bg-[#1a1c26] border border-white/10 shrink-0 transition-all ${isRecording ? 'text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] bg-red-500/10' : 'text-gray-400 hover:text-white'}`}>
                          {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Mic size={20} />}
                      </button>
                  </div>
              </div>
              </>
              )}
          </main>
      </div>

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
                {selectedUserModal.role === 'admin' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">Admin</span>}
             </h3>
             <p className="text-cyan-400 text-sm mb-4">Online</p>
             
             <div className="bg-[#0a0a16] border border-white/5 p-4 rounded-2xl relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#12141c] px-2 text-xs text-gray-500 font-semibold uppercase">Estado</div>
                <p className="text-gray-300 italic text-sm">
                   "{selectedUserModal.statusMessage || 'Disponible'}"
                </p>
             </div>
             
             {selectedUserModal.username !== user.username && (
               <button 
                 onClick={() => { setActiveChat(selectedUserModal.username); setSelectedUserModal(null); }}
                 className="w-full mt-6 flex items-center justify-center gap-2 text-white bg-white/5 hover:bg-white/10 p-3 rounded-xl font-medium transition-colors border border-white/10"
               >
                 <MessageCircle size={18} />
                 Enviar mensaje privado
               </button>
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

