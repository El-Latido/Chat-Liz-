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
    <div className="flex h-[100dvh] w-full items-center justify-center bg-zinc-950 text-white font-sans">
      <div className="w-full max-w-sm p-8 sm:p-10 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl mx-4">
        <div className="flex flex-col items-center gap-2 mb-8 justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-2 shadow-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Chat-Liz</h1>
          <div className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase">Supervised by Elizabeth AI</div>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase block mb-2 px-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-[15px] transition-all text-white placeholder-zinc-600"
              placeholder="Your name"
              maxLength={20}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase block mb-2 px-1 flex justify-between">
              Password
            </label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-[15px] transition-all text-white placeholder-zinc-600"
              placeholder="•••••••••"
            />
          </div>
          {error && <p className="text-red-400 text-sm mt-1 font-medium text-center">{error}</p>}
          <button type="submit" disabled={loading} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors tracking-wide text-[15px] font-sans shadow-sm">
            {loading ? "Entrando..." : "Entrar al Chat"}
          </button>
        </form>
      </div>
    </div>
  );
}
