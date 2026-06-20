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
    <div className="flex flex-col h-full w-full relative bg-zinc-950 text-white font-sans max-w-7xl mx-auto overflow-hidden">
      <header className="h-[70px] bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 flex items-center gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition uppercase font-bold tracking-widest text-[10px]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg tracking-tight text-white font-display">SETTINGS & PROFILE</h1>
        <button onClick={onLogout} className="p-2 -mr-2 flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition uppercase font-bold tracking-widest text-[10px]">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 flex justify-center items-start sm:items-center bg-zinc-950">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="flex flex-col items-center gap-2 mb-8 justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-2 shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Your Profile</h2>
            <div className="text-[10px] text-zinc-400 tracking-widest uppercase">CONNECTION CREDENTIALS</div>
          </div>
          <form onSubmit={handleUpdate} className="flex flex-col gap-6">
            <div>
              <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase block mb-2 px-1">Username</label>
              <input 
                type="text" 
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                maxLength={20}
                className="w-full bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-[15px] transition-all text-white placeholder-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase block mb-2 px-1">New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-[15px] transition-all text-white placeholder-zinc-600"
              />
            </div>
            
            {error && <p className="text-red-400 text-sm mt-1 font-medium text-center">{error}</p>}
            {success && <p className="text-emerald-400 text-sm mt-1 font-medium text-center">{success}</p>}

            <button type="submit" className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-colors tracking-wide text-[15px] font-sans shadow-sm">
              Save Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
