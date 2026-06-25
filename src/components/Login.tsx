import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { UserObj } from '../types';

interface LoginProps {
  user: UserObj & { password?: string };
  setUser: React.Dispatch<React.SetStateAction<UserObj & { password?: string, securityEmail?: string }>>;
  handleLogin: (e?: React.FormEvent) => void;
  setRecoveryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Login({ user, setUser, handleLogin, setRecoveryModalOpen }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center w-full h-full font-sans bg-[#050508] bg-[radial-gradient(circle_at_center,#131720_0%,#050508_100%),url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M54.627 0l.83.83v58.34l-.83.83H5.373l-.83-.83V.83l.83-.83h49.254zM53.5 2.5h-47v55h47v-55zM27 27h6v6h-6v-6zm-4-4h14v14H23V23zm-6-6h26v26H17V17z\' fill=\'rgba(255,255,255,0.03)\' fill-rule=\'evenodd\'/%3E%3C/svg%3E')]">
      
      {/* Títulos sobre el panel */}
      <div className="mb-6 text-center z-10 flex flex-col items-center">
         <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-200 mb-2 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
           ¡Bienvenido a ChatLiz!
         </h1>
         <p className="text-gray-300 text-sm font-medium tracking-wide">
           Inicia sesión o regístrate para continuar.
         </p>
      </div>

      <div className="relative w-full max-w-[420px] px-5 box-border">
        {/* Panel Central de Vidrio con Brillo Neón */}
        <div className="relative z-10 p-[2px] rounded-[24px] bg-gradient-to-r from-cyan-400 via-purple-500 to-fuchsia-500 shadow-[0_0_25px_rgba(34,211,238,0.5),0_0_40px_rgba(217,70,239,0.3)]">
           <div className="relative overflow-hidden bg-[#0d111a]/90 backdrop-blur-md rounded-[22px] px-8 py-10 border border-white/5">
              
              {/* Esquinas decorativas futuristas */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-cyan-400 rounded-tl-[22px] pointer-events-none opacity-80 shadow-[inset_2px_2px_8px_rgba(34,211,238,0.3)]"></div>
              <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-fuchsia-500 rounded-tr-[22px] pointer-events-none opacity-80 shadow-[inset_-2px_2px_8px_rgba(217,70,239,0.3)]"></div>
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-cyan-400 rounded-bl-[22px] pointer-events-none opacity-80 shadow-[inset_2px_-2px_8px_rgba(34,211,238,0.3)]"></div>
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-fuchsia-500 rounded-br-[22px] pointer-events-none opacity-80 shadow-[inset_-2px_-2px_8px_rgba(217,70,239,0.3)]"></div>

              <div className="relative flex flex-col z-10 gap-6">
                 {/* Input: Nombre de Usuario */}
                 <div className="relative group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 group-focus-within:text-cyan-300 transition-colors pointer-events-none z-10">
                      <User size={18} strokeWidth={2.5} />
                   </div>
                   <input 
                     className="w-full bg-[#131722]/80 pl-12 pr-4 py-3.5 rounded-lg border border-cyan-500/30 outline-none text-white text-[15px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all duration-300 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.2),inset_0_2px_10px_rgba(0,0,0,0.5)] placeholder:text-gray-500 font-medium tracking-wide"
                     placeholder="Nombre de Usuario..." 
                     value={user.username}
                     onChange={e => setUser({...user, username: e.target.value})} 
                   />
                 </div>

                 {/* Input: Contraseña */}
                 <div className="relative group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fuchsia-400 group-focus-within:text-fuchsia-300 transition-colors pointer-events-none z-10">
                      <Lock size={18} strokeWidth={2.5} />
                   </div>
                   <input 
                     className="w-full bg-[#131722]/80 pl-12 pr-12 py-3.5 rounded-lg border border-fuchsia-500/30 outline-none text-white text-[15px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all duration-300 focus:border-fuchsia-400 focus:shadow-[0_0_15px_rgba(217,70,239,0.2),inset_0_2px_10px_rgba(0,0,0,0.5)] placeholder:text-gray-500 font-medium tracking-wide"
                     type={showPassword ? "text" : "password"} 
                     placeholder="Contraseña..." 
                     value={user.password}
                     onChange={e => setUser({...user, password: e.target.value})} 
                     onKeyDown={e => e.key === 'Enter' && handleLogin()}
                   />
                   <button 
                     type="button"
                     onClick={() => setShowPassword(!showPassword)}
                     className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                   >
                     {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                   </button>
                 </div>

                 {/* Botón ENTRAR AL CHAT */}
                 <button 
                   onClick={handleLogin}
                   className="relative w-full py-3.5 mt-2 text-white font-bold text-[15px] tracking-wider rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 shadow-[0_0_20px_rgba(34,211,238,0.4)] overflow-hidden hover:shadow-[0_0_30px_rgba(217,70,239,0.6)] transition-shadow group border-none cursor-pointer"
                 >
                    <span className="relative z-10 drop-shadow-md">ENTRAR AL CHAT</span>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-white"></div>
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Enlaces centrados debajo del panel */}
      <div className="mt-8 flex flex-col items-center gap-3 z-10">
         <button 
            onClick={handleLogin} // Assuming it handles creation as well
            className="text-[14px] text-cyan-300 hover:text-cyan-200 hover:underline underline-offset-4 transition-colors font-medium tracking-wide"
         >
            Crear nueva cuenta
         </button>
         <button 
            onClick={(e) => { e.preventDefault(); setRecoveryModalOpen(true); }} 
            className="text-[14px] text-fuchsia-300 hover:text-fuchsia-200 hover:underline underline-offset-4 transition-colors font-medium tracking-wide"
         >
            ¿Olvidaste tu contraseña?
         </button>
      </div>

    </div>
  );
}
