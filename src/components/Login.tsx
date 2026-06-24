import React from 'react';
import { User, Lock } from 'lucide-react';
import { UserObj } from '../types';

interface LoginProps {
  user: UserObj & { password?: string };
  setUser: React.Dispatch<React.SetStateAction<UserObj & { password?: string, securityEmail?: string }>>;
  handleLogin: (e?: React.FormEvent) => void;
  setRecoveryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Login({ user, setUser, handleLogin, setRecoveryModalOpen }: LoginProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen font-sans bg-[#050508] bg-[radial-gradient(circle_at_center,#131720_0%,#050508_100%),url('data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h1v1H0V0zm12 12h1v1h-1v-1z\' fill=\'rgba(255,255,255,0.02)\' fill-rule=\'evenodd\'/%3E%3C/svg%3E')]">
      <div className="relative w-full max-w-[480px] px-5 mx-auto box-border">
        <div className="relative z-10 p-[2px] rounded-[24px] bg-gradient-to-r from-[#00f2fe] via-[#4facfe] to-[#f5576c] shadow-[0_0_20px_rgba(0,242,254,0.4),0_0_40px_rgba(245,87,108,0.2)]">
           <div className="relative overflow-hidden bg-[rgba(13,17,26,0.95)] backdrop-blur-[10px] rounded-[22px] px-8 py-12">
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
              
              <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#00f2fe] rounded-tl-[22px] shadow-[inset_4px_4px_10px_rgba(0,242,254,0.3)] pointer-events-none"></div>
              <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-[#f5576c] rounded-tr-[22px] shadow-[inset_-4px_4px_10px_rgba(245,87,108,0.3)] pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-[#00f2fe] rounded-bl-[22px] shadow-[inset_4px_-4px_10px_rgba(0,242,254,0.3)] pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#f5576c] rounded-br-[22px] shadow-[inset_-4px_-4px_10px_rgba(245,87,108,0.3)] pointer-events-none"></div>
              
              <div className="absolute top-1/4 bottom-1/4 left-0 w-[2px] bg-[#00f2fe] shadow-[0_0_15px_2px_#00f2fe]"></div>
              <div className="absolute top-1/4 bottom-1/4 right-0 w-[2px] bg-[#f5576c] shadow-[0_0_15px_2px_#f5576c]"></div>

              <div className="relative flex flex-col z-10 gap-6">
                 <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(0,242,254,0.7)] pointer-events-none z-10">
                      <User size={20} strokeWidth={2} />
                   </div>
                   <input 
                     className="w-full bg-[rgba(24,27,43,0.8)] pl-12 pr-4 py-4 rounded-xl border border-white/10 outline-none text-white text-[15px] backdrop-blur-[5px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all duration-300 focus:border-[rgba(0,242,254,0.5)] focus:shadow-[0_0_15px_rgba(0,242,254,0.2),inset_0_2px_10px_rgba(0,0,0,0.5)]"
                     placeholder="Nombre de Usuario..." 
                     value={user.username}
                     onChange={e => setUser({...user, username: e.target.value})} 
                   />
                 </div>

                 <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(0,242,254,0.7)] pointer-events-none z-10">
                      <Lock size={20} strokeWidth={2} />
                   </div>
                   <input 
                     className="w-full bg-[rgba(24,27,43,0.8)] pl-12 pr-4 py-4 rounded-xl border border-white/10 outline-none text-white text-[15px] backdrop-blur-[5px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all duration-300 focus:border-[rgba(0,242,254,0.5)] focus:shadow-[0_0_15px_rgba(0,242,254,0.2),inset_0_2px_10px_rgba(0,0,0,0.5)]"
                     type="password" 
                     placeholder="Contraseña..." 
                     value={user.password}
                     onChange={e => setUser({...user, password: e.target.value})} 
                     onKeyDown={e => e.key === 'Enter' && handleLogin()}
                   />
                 </div>

                 <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(0,242,254,0.7)] pointer-events-none z-10">
                      <Lock size={20} strokeWidth={2} />
                   </div>
                   <input 
                     className="w-full bg-[rgba(24,27,43,0.8)] pl-12 pr-4 py-4 rounded-xl border border-white/10 outline-none text-white text-[15px] backdrop-blur-[5px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all duration-300 focus:border-[rgba(0,242,254,0.5)] focus:shadow-[0_0_15px_rgba(0,242,254,0.2),inset_0_2px_10px_rgba(0,0,0,0.5)]"
                     type="email" 
                     placeholder="Email de Recuperación (Opcional)" 
                     value={user.securityEmail || ''}
                     onChange={e => setUser({...user, securityEmail: e.target.value})} 
                     onKeyDown={e => e.key === 'Enter' && handleLogin()}
                   />
                 </div>

                 <div className="relative">
                   <select
                     className="w-full bg-[rgba(24,27,43,0.8)] p-4 rounded-xl border border-white/10 outline-none text-white text-[15px] backdrop-blur-[5px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-all duration-300 focus:border-[rgba(0,242,254,0.5)] focus:shadow-[0_0_15px_rgba(0,242,254,0.2),inset_0_2px_10px_rgba(0,0,0,0.5)]"
                     value={user.countryLanguage}
                     onChange={e => setUser({...user, countryLanguage: e.target.value})}
                   >
                      <option value="es">Español (General)</option>
                      <option value="en">English (US/UK)</option>
                      <option value="pt">Português (Brasil)</option>
                      <option value="fr">Français (France)</option>
                      <option value="de">Deutsch (Germany)</option>
                      <option value="it">Italiano (Italy)</option>
                      <option value="ja">日本語 (Japan)</option>
                      <option value="ko">한국어 (Korea)</option>
                      <option value="zh">中文 (China)</option>
                      <option value="mx">Español (México)</option>
                      <option value="ar">Español (Argentina)</option>
                      <option value="co">Español (Colombia)</option>
                      <option value="cl">Español (Chile)</option>
                      <option value="pe">Español (Perú)</option>
                   </select>
                 </div>

                 <div className="flex justify-end -mt-2">
                    <button 
                       onClick={(e) => { e.preventDefault(); setRecoveryModalOpen(true); }} 
                       className="text-[14px] text-gray-300 underline underline-offset-4 decoration-gray-500 hover:text-[#00f2fe] hover:decoration-[#00f2fe] transition-colors"
                    >
                       ¿Olvidaste tu contraseña?
                    </button>
                 </div>

                 <button 
                   onClick={handleLogin}
                   className="relative w-full py-4 text-white font-bold text-[16px] tracking-wide rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#4facfe] shadow-[0_0_20px_rgba(0,242,254,0.4)] overflow-hidden group border-none cursor-pointer mt-2"
                 >
                    <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">ENTRAR AL NEXO</span>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20"></div>
                 </button>
              </div>

              <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-r from-[#00f2fe] to-[#f5576c] blur-[3px] opacity-30"></div>
           </div>
        </div>
      </div>
    </div>
  );
}
