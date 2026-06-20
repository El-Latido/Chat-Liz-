import React, { useState } from "react";
import { socket } from "../socket";
import { ArrowLeft, User, Lock, LogOut } from "lucide-react";

export default function Settings({ currentUser, onBack, onLogout }: { currentUser: string; onBack: () => void; onLogout: () => void }) {
  const [newUsername, setNewUsername] = useState(currentUser);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setError("Debes ingresar una contraseña nueva o tu contraseña actual.");
      return;
    }

    socket.emit("update_profile", { oldUsername: currentUser, newUsername, newPassword }, (res: any) => {
      if (res.success) {
        setSuccess("Perfil actualizado con éxito.");
        setError("");
      } else {
        setError(res.error);
        setSuccess("");
      }
    });
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-[#050505] text-white font-sans max-w-7xl mx-auto overflow-hidden">
      <header className="h-[70px] bg-black/50 backdrop-blur-md border-b border-[#222] px-4 sm:px-[30px] flex items-center justify-between sticky top-0 z-10">
        <button onClick={onBack} className="p-2 flex items-center gap-2 text-[#666] hover:text-white transition uppercase font-bold tracking-widest text-[10px]">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:block text-xs">VOLVER</span>
        </button>
        <h1 className="font-bold text-[16px] sm:text-[18px] tracking-[1px] uppercase font-display text-white">AJUSTES & PERFIL</h1>
        <button onClick={onLogout} className="p-2 flex items-center gap-2 text-red-500 hover:text-red-400 transition uppercase font-bold tracking-widest text-[10px]">
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:block text-xs">SALIR</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 flex justify-center items-start sm:items-center" style={{ backgroundImage: 'radial-gradient(ellipse at top, #111118 0%, #050505 100%)' }}>
        <div className="w-full max-w-md bg-[#0f0f12] border border-[#222] rounded-3xl p-8 sm:p-10 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col items-center gap-2 mb-8 justify-center">
            <User className="w-10 h-10 text-indigo-500 mb-2" />
            <h2 className="text-[20px] font-bold tracking-[1px] uppercase font-display text-white">Tu Perfil</h2>
            <div className="text-[10px] text-[#888] tracking-[2px] uppercase">CREDENCIALES DE ACCESO</div>
          </div>
          <form onSubmit={handleUpdate} className="flex flex-col gap-6">
            <div>
              <label className="text-xs font-bold text-[#888] tracking-widest uppercase block mb-2">Nombre de usuario</label>
              <input 
                type="text" 
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                maxLength={20}
                className="w-full bg-[#1a1a20] border-none p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all text-white placeholder-[#555]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#888] tracking-widest uppercase block mb-2">Nueva Contraseña</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#1a1a20] border-none p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all text-white placeholder-[#555]"
              />
            </div>
            
            {error && <p className="text-red-500 text-xs font-bold mt-1 text-center">{error}</p>}
            {success && <p className="text-emerald-500 text-xs font-bold mt-1 text-center">{success}</p>}

            <button type="submit" className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-colors tracking-wide uppercase text-sm font-display">
              Guardar Cambios
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
