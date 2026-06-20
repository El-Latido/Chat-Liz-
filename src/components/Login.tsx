import React, { useState } from 'react';
import { socket } from '../socket';
import { MessageSquare } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || loading) return;
    
    setLoading(true);
    socket.emit('register_or_login', { username, password }, (res: any) => {
      setLoading(false);
      if (res.success) {
        onLogin(username);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#050505] text-white font-sans">
      <div className="w-full max-w-sm p-10 bg-[#0f0f12] rounded-3xl border border-[#222] shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col items-center gap-2 mb-8 justify-center">
          <MessageSquare className="w-10 h-10 text-indigo-500 mb-2" />
          <h1 className="text-3xl font-bold tracking-tight uppercase font-display">Chat-Liz</h1>
          <div className="text-[10px] text-indigo-400 font-medium tracking-[2px] uppercase">Supervised by Elizabeth AI</div>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="text-xs font-bold text-[#888] tracking-widest uppercase block mb-2">Nombre de usuario</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#1a1a20] border-none p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all"
              placeholder="Ej: cibernauta_1"
              maxLength={20}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#888] tracking-widest uppercase block mb-2">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#1a1a20] border-none p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all"
              placeholder="*********"
            />
          </div>
          {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
          <button type="submit" disabled={loading} className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors tracking-wide uppercase text-sm font-display">
            {loading ? "Entrando..." : "Entrar al Chat"}
          </button>
        </form>
      </div>
    </div>
  );
}
