import React, { useState, useEffect, useRef, ErrorInfo, Component } from 'react';
import { 
  Send, User, MessageCircle, Settings, Bot, 
  Image as ImageIcon, Mic, StopCircle, 
  Menu, X, Hash, MessageSquare, LogOut, Search,
  Paperclip, Smile, Lock, EyeOff
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

interface UserObj {
  username: string;
  profilePic?: string;
  statusMessage?: string;
  role?: string;
}

function MainApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserObj & {password?: string}>({ username: '', password: '' });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<UserObj & {password?: string}>({ username: '', password: '', profilePic: '', statusMessage: 'Disponible' });
  const [selectedUserModal, setSelectedUserModal] = useState<UserObj | null>(null);
  const [adminConfigLizOpen, setAdminConfigLizOpen] = useState(false);
  const [aiProfileForm, setAiProfileForm] = useState({ profilePic: '', statusMessage: 'IA Asistente virtual' });
  
  const [activeChat, setActiveChat] = useState('global');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  const [usersOnline, setUsersOnline] = useState<UserObj[]>([{ username: 'Elizabeth', statusMessage: 'IA Asistente virtual', role: 'admin' }]); 
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
        setUser({ ...user, profilePic: res.profilePic, statusMessage: res.statusMessage, role: res.role });
        setProfileForm({ ...profileForm, username: res.username, profilePic: res.profilePic, statusMessage: res.statusMessage });
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

    socket.on('active_users', (usersList: UserObj[]) => {
      const cleaned = usersList.filter(u => u.username !== 'Elizabeth' && u.username !== user.username);
      const elizabeth = usersList.find(u => u.username === 'Elizabeth') || { username: 'Elizabeth', statusMessage: 'IA Asistente virtual', role: 'admin' };
      cleaned.unshift(elizabeth); 
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
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#050508',
        backgroundImage: 'radial-gradient(circle at center, #131720 0%, #050508 100%), url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h1v1H0V0zm12 12h1v1h-1v-1z\' fill=\'rgba(255,255,255,0.02)\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto', padding: '0 20px', boxSizing: 'border-box' }}>
          
          <div style={{
            position: 'relative',
            zIndex: 10,
            padding: '2px',
            borderRadius: '24px',
            background: 'linear-gradient(90deg, #00f2fe 0%, #4facfe 30%, #f093fb 70%, #f5576c 100%)',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.4), 0 0 40px rgba(245, 87, 108, 0.2)'
          }}>
             
             <div style={{
                position: 'relative',
                backgroundColor: 'rgba(13, 17, 26, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '22px',
                overflow: 'hidden',
                padding: '48px 32px'
             }}>
                
                {/* Circuit Grid Background inside panel */}
                <div style={{
                   position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                   opacity: 0.1,
                   pointerEvents: 'none',
                   backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                   backgroundSize: '20px 20px'
                }}></div>

                {/* Corner Tech Brackets */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '64px', height: '64px', borderTop: '4px solid #00f2fe', borderLeft: '4px solid #00f2fe', borderTopLeftRadius: '22px', boxShadow: 'inset 4px 4px 10px rgba(0,242,254,0.3)', pointerEvents: 'none' }}></div>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '64px', height: '64px', borderTop: '4px solid #f5576c', borderRight: '4px solid #f5576c', borderTopRightRadius: '22px', boxShadow: 'inset -4px 4px 10px rgba(245,87,108,0.3)', pointerEvents: 'none' }}></div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '64px', height: '64px', borderBottom: '4px solid #00f2fe', borderLeft: '4px solid #00f2fe', borderBottomLeftRadius: '22px', boxShadow: 'inset 4px -4px 10px rgba(0,242,254,0.3)', pointerEvents: 'none' }}></div>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '64px', height: '64px', borderBottom: '4px solid #f5576c', borderRight: '4px solid #f5576c', borderBottomRightRadius: '22px', boxShadow: 'inset -4px -4px 10px rgba(245,87,108,0.3)', pointerEvents: 'none' }}></div>
                
                {/* Subtle side glowing overlays */}
                <div style={{ position: 'absolute', top: '25%', bottom: '25%', left: 0, width: '2px', backgroundColor: '#00f2fe', boxShadow: '0 0 15px 2px #00f2fe' }}></div>
                <div style={{ position: 'absolute', top: '25%', bottom: '25%', right: 0, width: '2px', backgroundColor: '#f5576c', boxShadow: '0 0 15px 2px #f5576c' }}></div>

                <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                   
                   <div style={{ position: 'relative' }}>
                     <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0, 242, 254, 0.7)', pointerEvents: 'none', zIndex: 10 }}>
                        <User size={20} strokeWidth={2} />
                     </div>
                     <input 
                       style={{
                         width: '100%', backgroundColor: 'rgba(24, 27, 43, 0.8)', padding: '16px 16px 16px 48px',
                         borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none',
                         color: 'white', fontSize: '15px', backdropFilter: 'blur(5px)',
                         boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)', transition: 'all 0.3s ease',
                         boxSizing: 'border-box'
                       }}
                       onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(0, 242, 254, 0.5)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(0,242,254,0.2), inset 0 2px 10px rgba(0,0,0,0.5)'; }}
                       onBlur={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'inset 0 2px 10px rgba(0,0,0,0.5)'; }}
                       placeholder="Nombre de Usuario..." 
                       onChange={e => setUser({...user, username: e.target.value})} 
                     />
                   </div>

                   <div style={{ position: 'relative' }}>
                     <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0, 242, 254, 0.7)', pointerEvents: 'none', zIndex: 10 }}>
                        <Lock size={20} strokeWidth={2} />
                     </div>
                     <input 
                       style={{
                         width: '100%', backgroundColor: 'rgba(24, 27, 43, 0.8)', padding: '16px 48px 16px 48px',
                         borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none',
                         color: 'white', fontSize: '15px', backdropFilter: 'blur(5px)',
                         boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)', transition: 'all 0.3s ease',
                         boxSizing: 'border-box'
                       }}
                       type="password" 
                       onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(0, 242, 254, 0.5)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(0,242,254,0.2), inset 0 2px 10px rgba(0,0,0,0.5)'; }}
                       onBlur={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'inset 0 2px 10px rgba(0,0,0,0.5)'; }}
                       placeholder="Contraseña..." 
                       onChange={e => setUser({...user, password: e.target.value})} 
                       onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                     />
                     <button style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.color='white'} onMouseOut={e => e.currentTarget.style.color='#9ca3af'}>
                        <EyeOff size={20} strokeWidth={2} />
                     </button>
                   </div>

                   <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px' }}>
                      <a href="#" style={{ fontSize: '14px', color: '#d1d5db', textDecoration: 'underline', textUnderlineOffset: '4px', textDecorationColor: '#6b7280' }} onMouseOver={e => { e.currentTarget.style.color='#00f2fe'; e.currentTarget.style.textDecorationColor='#00f2fe'; }} onMouseOut={e => { e.currentTarget.style.color='#d1d5db'; e.currentTarget.style.textDecorationColor='#6b7280'; }}>¿Olvidaste tu contraseña?</a>
                   </div>

                   <button 
                     onClick={handleLogin} 
                     style={{
                       width: '100%', marginTop: '16px', padding: '16px', borderRadius: '12px',
                       fontWeight: 'bold', fontSize: '16px', color: 'white', letterSpacing: '1px',
                       background: 'linear-gradient(90deg, #00f2fe 0%, #f5576c 100%)',
                       border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                       boxShadow: '0 0 20px rgba(245, 87, 108, 0.4)', transition: 'all 0.3s ease',
                       position: 'relative', overflow: 'hidden'
                     }}
                     onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 35px rgba(0, 242, 254, 0.6)'; }}
                     onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(245, 87, 108, 0.4)'; }}
                   >
                     ENTRAR AL CHAT
                   </button>

                   <div style={{ textAlign: 'center', marginTop: '12px' }}>
                      <a href="#" style={{ fontSize: '14px', color: '#d1d5db', textDecoration: 'underline', textUnderlineOffset: '4px', textDecorationColor: '#6b7280' }} onMouseOver={e => { e.currentTarget.style.color='white'; e.currentTarget.style.textDecorationColor='white'; }} onMouseOut={e => { e.currentTarget.style.color='#d1d5db'; e.currentTarget.style.textDecorationColor='#6b7280'; }}>Crear nueva cuenta</a>
                   </div>
                </div>
             </div>
          </div>
          
          {/* Glass Reflection Under Container */}
          <div style={{ position: 'relative', marginTop: '8px', height: '80px', overflow: 'hidden', margin: '8px 32px 0 32px', opacity: 0.4 }}>
             <div style={{
               width: '100%', height: '100%', borderTop: '2px solid #00f2fe', borderRadius: '24px 24px 0 0',
               position: 'absolute', top: '-10px', transform: 'scaleY(-1)',
               maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
               background: 'linear-gradient(90deg, #00f2fe 0%, #f5576c 100%)', filter: 'blur(3px)'
             }}></div>
          </div>
        </div>
      </div>
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
             <div className="flex items-center gap-3 bg-[#13151f] border border-white/10 px-4 py-1.5 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                 <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold border border-white/5 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
                 </div>
                 <span className="font-medium text-gray-200 text-sm tracking-wide">{user.username}</span>
             </div>
             <button 
                onClick={() => { setProfileForm({ username: user.username, password: user.password }); setIsConfigOpen(true); }}
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
                 <div className="relative mb-6 group cursor-pointer" onClick={() => setSelectedUserModal(usersOnline.find(u => u.username === 'Elizabeth') || {username: 'Elizabeth', statusMessage: 'IA Asistente virtual', role: 'admin'})}>
                    <div className="absolute inset-0 bg-cyan-400 blur-2xl opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
                    <div className="w-28 h-28 rounded-full border border-cyan-400/50 p-1 relative z-10 bg-[#0a0a16] shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center overflow-hidden">
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
                              <span className="font-bold text-white text-[15px]">ELIZABETH (IA) <span className="text-cyan-400 font-normal">~</span></span>
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
                                 onClick={() => setSelectedUserModal(u)}
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
                               {isLiz ? 'ELIZABETH (IA Administradora Gemini ✨):' : `${m.sender}:`}
                            </span>
                            <span className={isLiz ? 'text-gray-200' : 'text-gray-300'}>
                               {isLiz ? `"${m.text}"` : m.text}
                            </span>
                            {m.image && <div className="mt-3 ml-2"><img src={m.image} className="rounded-xl border border-white/10 max-w-[300px] shadow-lg" alt="adjunto"/></div>}
                            {m.audio && <div className="mt-3 ml-2 bg-[#13151f] p-2 rounded-xl inline-block border border-white/5 shadow-inner"><audio src={m.audio} controls className="h-8 max-w-[250px] filter opacity-90" /></div>}
                         </div>
                     );
                  })}
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
                             onChange={e => setInputValue(e.target.value)}
                             onKeyDown={e => {
                                if (e.key === 'Enter') handleSendMessage();
                             }}
                             className="w-full bg-transparent outline-none text-gray-200 placeholder-gray-500 text-[15px] py-1.5" 
                             placeholder="Escribe tu mensaje... @Elizabeth para IA carismática 😉"
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
          </main>
      </div>

      {/* Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141c] p-6 lg:p-8 rounded-3xl w-full max-w-md shadow-2xl relative border border-white/10 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <button onClick={() => setIsConfigOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors">
               <X size={20} />
            </button>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
               <Settings size={22} className="text-cyan-400" />
               Ajustes de Perfil
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden bg-black/30 relative">
                   <img src={profileForm.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
                   <input type="file" title="Subir foto de perfil" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setProfileForm({...profileForm, profilePic: reader.result as string});
                        reader.readAsDataURL(file);
                      }
                   }} />
                </div>
                <span className="text-xs text-gray-500 mt-2">Haz clic para cambiar foto</span>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-400">Usuario</label>
                <input 
                   disabled
                   value={profileForm.username}
                   className="w-full bg-[#0a0a16] p-3 rounded-xl border border-white/5 outline-none text-gray-500 opacity-70 cursor-not-allowed" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-400">Estado / Comentario</label>
                <input 
                   value={profileForm.statusMessage || ''}
                   onChange={e => setProfileForm({...profileForm, statusMessage: e.target.value})}
                   maxLength={60}
                   placeholder="Ej: Hola a todos!"
                   type="text"
                   className="w-full bg-[#0a0a16] p-3 rounded-xl border border-white/10 outline-none focus:border-cyan-500 transition-all text-white" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-400">Contraseña</label>
                <input 
                   value={profileForm.password}
                   onChange={e => setProfileForm({...profileForm, password: e.target.value})}
                   type="password"
                   className="w-full bg-[#0a0a16] p-3 rounded-xl border border-white/10 outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all text-white" 
                />
              </div>
              
              {user.role === 'admin' && (
                 <button onClick={() => { 
                    const aiUser = usersOnline.find(u => u.username === 'Elizabeth');
                    setAiProfileForm({ profilePic: aiUser?.profilePic || '', statusMessage: aiUser?.statusMessage || 'IA Asistente virtual' });
                    setIsConfigOpen(false); 
                    setAdminConfigLizOpen(true); 
                 }} className="w-full flex items-center justify-center gap-2 text-fuchsia-400 border border-fuchsia-400 bg-fuchsia-500/10 p-3 rounded-xl font-bold mt-2 hover:bg-fuchsia-500/20 transition-all">
                    <Bot size={18} /> Configurar a HELIZABETH
                 </button>
              )}

              <button 
                onClick={() => {
                  socket.emit('update_profile', { oldUsername: user.username, newUsername: profileForm.username, newPassword: profileForm.password, profilePic: profileForm.profilePic, statusMessage: profileForm.statusMessage }, (res: any) => {
                    if (res.success) {
                        setUser({...user, password: profileForm.password, profilePic: profileForm.profilePic, statusMessage: profileForm.statusMessage });
                        setIsConfigOpen(false);
                    } else {
                        alert(res.error);
                    }
                  });
                }}
                className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-xl font-bold transition-colors shadow-[0_4px_14px_rgba(6,182,212,0.3)]"
               >
                 Guardar Cambios
               </button>
             </div>
             
             <div className="mt-8 pt-6 border-t border-white/10">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center gap-2 text-red-400 bg-red-400/10 hover:bg-red-400/20 p-3 rounded-xl font-medium transition-colors border border-red-400/20"
                >
                  <LogOut size={18} />
                  Cerrar Sesión
                </button>
             </div>
           </div>
         </div>
       )}
       {/* Admin Config Liz Modal */}
       {adminConfigLizOpen && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-[#12141c] p-6 lg:p-8 rounded-3xl w-full max-w-md shadow-2xl relative border border-fuchsia-500/20">
             <button onClick={() => setAdminConfigLizOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors">
                <X size={20} />
             </button>
             <h2 className="text-xl font-bold text-fuchsia-400 flex items-center gap-2 mb-6">
                <Bot size={22} />
                Configurar HELIZABETH
             </h2>
             <div className="space-y-4">
               <p className="text-sm text-gray-400 leading-relaxed mb-4">
                 Como administrador (AXISS), puedes modificar el perfil de la IA.
               </p>
               
               <div className="flex flex-col items-center mb-4">
                 <div className="w-24 h-24 rounded-full border-2 border-dashed border-fuchsia-500/50 flex items-center justify-center overflow-hidden bg-black/30 relative">
                    {aiProfileForm.profilePic ? (
                       <img src={aiProfileForm.profilePic} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                       <Bot size={40} className="text-fuchsia-400" />
                    )}
                    <input type="file" title="Subir foto de perfil IA" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={e => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onload = () => setAiProfileForm({...aiProfileForm, profilePic: reader.result as string});
                         reader.readAsDataURL(file);
                       }
                    }} />
                 </div>
                 <span className="text-xs text-gray-500 mt-2">Haz clic para cambiar foto</span>
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-semibold text-gray-400">Estado / Información</label>
                 <input 
                    value={aiProfileForm.statusMessage || ''}
                    onChange={e => setAiProfileForm({...aiProfileForm, statusMessage: e.target.value})}
                    maxLength={100}
                    placeholder="Ej: IA Asistente virtual"
                    type="text"
                    className="w-full bg-[#0a0a16] p-3 rounded-xl border border-white/10 outline-none focus:border-fuchsia-500 transition-all text-white" 
                 />
               </div>

               <button 
                 onClick={() => {
                   socket.emit('update_ai_config', { profilePic: aiProfileForm.profilePic, statusMessage: aiProfileForm.statusMessage }, (res: any) => {
                       if (res.success) {
                           alert("Perfil de HELIZABETH actualizado en el servidor.");
                           setAdminConfigLizOpen(false);
                       } else {
                           alert("Error: " + res.error);
                       }
                   });
                 }}
                 className="w-full mt-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white p-3 rounded-xl font-bold transition-colors shadow-[0_4px_14px_rgba(217,70,239,0.3)]"
               >
                 Aplicar cambios
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Selected User Info Modal */}
       {selectedUserModal && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedUserModal(null)}>
           <div className="bg-[#12141c] p-8 rounded-3xl w-full max-w-sm shadow-2xl relative border border-white/10 text-center" onClick={e => e.stopPropagation()}>
             <button onClick={() => setSelectedUserModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors">
                <X size={20} />
             </button>
             <div className="w-24 h-24 mx-auto mb-4 rounded-full border border-white/10 overflow-hidden shadow-lg">
                <img src={selectedUserModal.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUserModal.username}`} className="w-full h-full object-cover" alt="Avatar" />
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

