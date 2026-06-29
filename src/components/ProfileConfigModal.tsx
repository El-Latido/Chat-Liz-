import React, { useState } from 'react';
import { Settings, X, LogOut, Bot } from 'lucide-react';
import { socket } from '../socket';
import { UserObj } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface ProfileConfigModalProps {
  user: UserObj & { password?: string };
  setUser: React.Dispatch<React.SetStateAction<UserObj & { password?: string, securityEmail?: string }>>;
  setIsConfigOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAdminConfigLizOpen: React.Dispatch<React.SetStateAction<boolean>>;
  usersOnline: UserObj[];
  setAiProfileForm: React.Dispatch<React.SetStateAction<{ profilePic: string; statusMessage: string; systemInstruction: string; }>>;
}

export function ProfileConfigModal({
  user, setUser, setIsConfigOpen, setAdminConfigLizOpen, usersOnline, setAiProfileForm
}: ProfileConfigModalProps) {
  // Local states as requested
  const [nombre, setNombre] = useState(user.username || '');
  const [comentario, setComentario] = useState(user.statusMessage || '');
  const [pais, setPais] = useState(user.countryLanguage || 'es');
  const [password, setPassword] = useState(user.password || '');
  const [fotoURL, setFotoURL] = useState(user.profilePic || '');
  const [isFriendsPublic, setIsFriendsPublic] = useState(user.is_friends_public || false);
  const [backgroundBase64, setBackgroundBase64] = useState(user.preferred_background || '');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    try {
      setSaveStatus("Guardando...");
      // 1. Referencia al documento específico de este usuario en Firebase
      const userRef = doc(db, "users", user.username); 

      // 2. Ejecuta la actualización (aquí es donde los datos "pasan" a Firebase)
      await setDoc(userRef, {
        password: password,
        profilePic: fotoURL,
        statusMessage: comentario,
        pais_idioma: pais,
        is_friends_public: isFriendsPublic,
        preferred_background: backgroundBase64
      }, { merge: true });

      // Update local state (though onSnapshot will also catch it)
      setUser(prev => ({
        ...prev,
        password: password,
        profilePic: fotoURL,
        statusMessage: comentario,
        countryLanguage: pais,
        is_friends_public: isFriendsPublic,
        preferred_background: backgroundBase64
      }));

      // Aún emitimos a socket para otras cosas de conexión
      socket.emit('update_profile', { 
        oldUsername: user.username, 
        newUsername: nombre, 
        newPassword: password, 
        profilePic: fotoURL, 
        statusMessage: comentario, 
        countryLanguage: pais,
        is_friends_public: isFriendsPublic,
        preferred_background: backgroundBase64
      }, () => {});

      setSaveStatus("Tema guardado correctamente");
      setTimeout(() => setSaveStatus(null), 3000);
      // No longer reloading the page
    } catch (error) {
      setSaveStatus("Error al guardar");
      setTimeout(() => setSaveStatus(null), 3000);
      alert("Error: " + (error as Error).message); 
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[var(--bg-modal)] text-[var(--text-primary)] p-6 lg:p-8 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl relative border-t border-x sm:border-b border-[var(--border-color)] max-h-[85vh] overflow-y-auto scrollbar-thin animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6 sm:hidden"></div>
        <button onClick={() => setIsConfigOpen(false)} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--border-color)] hover:opacity-80 p-2 rounded-full transition-all">
           <X size={20} />
        </button>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
           <Settings size={22} className="text-[var(--text-accent)]" />
           Ajustes de Perfil
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col items-center mb-4">
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-[var(--border-color)] flex items-center justify-center overflow-hidden bg-[var(--bg-card)] relative">
               <img src={fotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
               <input type="file" title="Subir foto de perfil" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setFotoURL(reader.result as string);
                    reader.readAsDataURL(file);
                  }
               }} />
            </div>
            <span className="text-xs text-gray-500 mt-2">Haz clic para cambiar foto</span>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-secondary)]">Usuario</label>
            <input 
               disabled
               value={nombre}
               className="w-full bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-color)] outline-none text-[var(--text-secondary)] opacity-70 cursor-not-allowed" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-secondary)]">Estado / Comentario</label>
            <input 
               value={comentario}
               onChange={e => setComentario(e.target.value)}
               maxLength={60}
               placeholder="Ej: Hola a todos!"
               type="text"
               className="w-full bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-color)] outline-none focus:border-[var(--text-accent)] transition-all text-[var(--text-primary)]" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-secondary)]">Contraseña</label>
            <input 
               value={password}
               onChange={e => setPassword(e.target.value)}
               type="password"
               className="w-full bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-color)] outline-none focus:border-[var(--text-accent)] transition-all text-[var(--text-primary)]" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-secondary)]">País / Idioma</label>
            <div className="relative">
              <select
                 value={pais}
                 onChange={e => setPais(e.target.value)}
                 className="w-full bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-color)] outline-none focus:border-[var(--text-accent)] transition-all text-[var(--text-primary)] appearance-none"
              >
                 <option value="es">Español</option>
                 <option value="en">English</option>
                 <option value="pt">Português</option>
                 <option value="fr">Français</option>
                 <option value="de">Deutsch</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]">
                 ▼
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
             <label className="text-sm font-semibold text-[var(--text-secondary)]">Mostrar mi lista de amigos públicamente</label>
             <button
               onClick={() => setIsFriendsPublic(!isFriendsPublic)}
               className={`w-12 h-6 rounded-full relative transition-colors ${isFriendsPublic ? 'bg-cyan-500' : 'bg-gray-600'}`}
             >
               <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isFriendsPublic ? 'translate-x-6' : ''}`} />
             </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-secondary)]">Fondo del Chat</label>
            <div className="flex gap-2">
               <input 
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setBackgroundBase64(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-color)] outline-none focus:border-[var(--text-accent)] transition-all text-[var(--text-primary)]" 
               />
               <button onClick={() => setBackgroundBase64('')} className="bg-[var(--bg-input)] hover:opacity-80 px-4 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-xs">
                  Restaurar
               </button>
            </div>
            {backgroundBase64 && <img src={backgroundBase64} className="h-16 w-16 rounded-lg object-cover mt-2" alt="Background preview" />}
          </div>
          
          {user.username === 'Axiss' && (
             <button onClick={() => { 
                const aiUser = usersOnline.find(u => u.username === 'Elizabeth');
                setAiProfileForm({ profilePic: aiUser?.profilePic || '', statusMessage: aiUser?.statusMessage || 'IA Asistente virtual', systemInstruction: aiUser?.systemInstruction || '' });
                setIsConfigOpen(false); 
                setAdminConfigLizOpen(true); 
             }} className="w-full flex items-center justify-center gap-2 text-fuchsia-400 border border-fuchsia-400 bg-fuchsia-500/10 p-3 rounded-xl font-bold mt-2 hover:bg-fuchsia-500/20 transition-all">
                <Bot size={18} /> Configurar a HELIZABETH
             </button>
          )}

          {saveStatus && <div className="text-center text-sm font-bold text-[var(--text-accent)] mt-2">{saveStatus}</div>}

          <button 
            onClick={handleSaveProfile}
            className="w-full mt-4 bg-[var(--text-accent)] hover:opacity-80 text-white p-3 rounded-xl font-bold transition-all shadow-lg"
           >
             Guardar Cambios
           </button>
         </div>
         
         <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
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
  );
}
