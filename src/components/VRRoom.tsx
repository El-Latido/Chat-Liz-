import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Box, Capsule, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Backpack, Camera, MessageSquare, Send } from 'lucide-react';
import { create } from 'zustand';

// --- State Management ---
type VRState = {
  isThirdPerson: boolean;
  toggleCamera: () => void;
  isBackpackOpen: boolean;
  setBackpackOpen: (v: boolean) => void;
  isPhoneOpen: boolean;
  setPhoneOpen: (v: boolean) => void;
  isSkinsOpen: boolean;
  setSkinsOpen: (v: boolean) => void;
};

const useVRStore = create<VRState>((set) => ({
  isThirdPerson: true,
  toggleCamera: () => set((s) => ({ isThirdPerson: !s.isThirdPerson })),
  isBackpackOpen: false,
  setBackpackOpen: (v) => set({ isBackpackOpen: v }),
  isPhoneOpen: false,
  setPhoneOpen: (v) => set({ isPhoneOpen: v }),
  isSkinsOpen: false,
  setSkinsOpen: (v) => set({ isSkinsOpen: v }),
}));

// --- 3D Player Controller ---
const Player = ({ socket, username }: { socket: any, username: string }) => {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const isThirdPerson = useVRStore(s => s.isThirdPerson);
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keys.current[e.code] = true;
    const onKeyUp = (e: KeyboardEvent) => keys.current[e.code] = false;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    
    const speed = keys.current['ShiftLeft'] ? 10 : 5;
    const moveZ = (keys.current['KeyS'] ? 1 : 0) - (keys.current['KeyW'] ? 1 : 0);
    const moveX = (keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0);
    
    // Determine movement direction relative to camera
    const euler = new THREE.Euler(0, camera.rotation.y, 0, 'YXZ');
    const direction = new THREE.Vector3(moveX, 0, moveZ).applyEuler(euler).normalize().multiplyScalar(speed * delta);
    
    if (moveX !== 0 || moveZ !== 0) {
      ref.current.position.add(direction);
      // Look direction
      const targetPos = ref.current.position.clone().add(direction);
      ref.current.lookAt(targetPos);
      
      // Emit movement
      socket.emit('vr_move', {
        x: ref.current.position.x,
        y: ref.current.position.y,
        z: ref.current.position.z,
        ry: ref.current.rotation.y,
        action: keys.current['ShiftLeft'] ? 'Run' : 'Walk'
      });
    }

    // Camera follow
    if (isThirdPerson) {
      const offset = new THREE.Vector3(0, 3, 6);
      offset.applyEuler(new THREE.Euler(0, ref.current.rotation.y, 0));
      camera.position.lerp(ref.current.position.clone().add(offset), 0.1);
      camera.lookAt(ref.current.position.clone().add(new THREE.Vector3(0, 1, 0)));
    } else {
      camera.position.copy(ref.current.position).add(new THREE.Vector3(0, 1.5, 0));
      camera.rotation.y = ref.current.rotation.y;
    }
  });

  return (
    <group ref={ref} position={[0, 1, 0]}>
      <Capsule args={[0.5, 1]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#06b6d4" />
      </Capsule>
      <Text position={[0, 1.2, 0]} fontSize={0.3} color="white" outlineColor="black" outlineWidth={0.05}>
        {username}
      </Text>
    </group>
  );
};

const RemotePlayer = ({ id, data }: { id: string, data: any }) => {
  const ref = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.1);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, data.ry, 0.1);
  });

  return (
    <group ref={ref} position={[data.x, data.y, data.z]}>
      <Capsule args={[0.5, 1]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#a855f7" />
      </Capsule>
      <Text position={[0, 1.2, 0]} fontSize={0.3} color="white" outlineColor="black" outlineWidth={0.05}>
        {data.username || id}
      </Text>
    </group>
  );
};

// --- Main VR Room Component ---
export default function VRRoom({ socket, user }: { socket: any, user: any }) {
  const [vrUsers, setVrUsers] = useState<Record<string, any>>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const { toggleCamera, isThirdPerson, isBackpackOpen, setBackpackOpen, isPhoneOpen, setPhoneOpen, isSkinsOpen, setSkinsOpen } = useVRStore();
  
  useEffect(() => {
    socket.emit('vr_join', { skin: '' });
    
    socket.on('vr_users', (users: any) => setVrUsers(users));
    socket.on('vr_update', (data: any) => {
      setVrUsers(prev => ({ ...prev, [data.username]: data }));
    });
    
    socket.on('receive_vr', (msg: any) => {
      setChatMessages(prev => [...prev.slice(-20), msg]);
    });

    return () => {
      socket.emit('vr_leave');
      socket.off('vr_users');
      socket.off('vr_update');
      socket.off('receive_vr');
    };
  }, [socket]);

  const sendVrMsg = () => {
    if (!msgInput.trim()) return;
    socket.emit('send_vr', { text: msgInput });
    setMsgInput('');
  };

  const handleCapture = () => {
    // Basic capture mechanism (in real app, extract canvas data URL)
    alert("Cámara: ¡Captura tomada exitosamente! (Simulado)");
  };

  return (
    <div className="relative w-full h-full bg-[#13151f] overflow-hidden flex flex-col">
      {/* 3D Canvas */}
      <div className="flex-1 w-full relative">
         <Canvas shadows camera={{ position: [0, 3, 6], fov: 60 }}>
           <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimuth={0.25} />
           <ambientLight intensity={0.5} />
           <directionalLight position={[10, 10, 10]} castShadow intensity={1} />
           
           {/* Simple Environment */}
           <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
             <planeGeometry args={[100, 100]} />
             <meshStandardMaterial color="#fcd34d" /> {/* Sand */}
           </mesh>
           <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[50, -0.6, 0]}>
             <planeGeometry args={[100, 100]} />
             <meshStandardMaterial color="#0284c7" /> {/* Water */}
           </mesh>

           {/* Local Player */}
           <Player socket={socket} username={user.username} />
           
           {/* Remote Players */}
           {Object.entries(vrUsers).map(([id, data]) => {
             if (id === user.username) return null;
             return <RemotePlayer key={id} id={id} data={data} />;
           })}
           
           {isThirdPerson && <OrbitControls enablePan={false} enableZoom={true} />}
         </Canvas>
         
         {/* UI Overlays */}
         <div className="absolute top-4 right-4 flex flex-col gap-3">
            <button onClick={toggleCamera} className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center border border-white/20 backdrop-blur hover:bg-black/70">
              <Camera size={20} />
            </button>
            <button onClick={handleCapture} className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center border border-white/20 backdrop-blur hover:bg-black/70" title="Tomar Foto">
              📸
            </button>
            <button onClick={() => setBackpackOpen(!isBackpackOpen)} className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center border border-white/20 backdrop-blur hover:bg-black/70">
              <Backpack size={20} />
            </button>
         </div>
         
         {/* Actions Bar */}
         <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
            {['Caminar', 'Correr', 'Sentarse', 'Saltar', 'Acostarse'].map(act => (
               <button key={act} className="px-4 py-2 bg-black/50 text-white text-sm rounded-full backdrop-blur border border-white/10 hover:bg-white/10 transition-colors">
                  {act}
               </button>
            ))}
         </div>

         {/* Local Chat VR */}
         <div className="absolute bottom-4 left-4 w-72 bg-black/40 backdrop-blur rounded-xl border border-white/10 flex flex-col overflow-hidden max-h-64">
             <div className="p-2 border-b border-white/10 text-xs font-bold text-white flex items-center gap-2">
                <MessageSquare size={14} /> CHAT DE SALA
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {chatMessages.map((m, i) => (
                   <div key={i} className="text-sm text-white">
                      <span className="font-bold text-cyan-300">{m.sender}:</span> {m.text}
                   </div>
                ))}
             </div>
             <div className="p-2 border-t border-white/10 flex items-center gap-2">
                <input 
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendVrMsg()}
                  className="flex-1 bg-white/10 text-white text-sm rounded-full px-3 py-1 outline-none"
                  placeholder="Habla en la sala..."
                />
                <button onClick={sendVrMsg} className="text-cyan-400 hover:text-cyan-300">
                   <Send size={16} />
                </button>
             </div>
         </div>
         
         {/* Backpack Modals */}
         {isBackpackOpen && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-[#1a1c26] rounded-2xl border border-white/10 shadow-2xl p-4 flex flex-col gap-4">
               <h3 className="text-white font-bold text-lg text-center">Mochila VR</h3>
               <button onClick={() => { setBackpackOpen(false); setPhoneOpen(true); }} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium flex items-center justify-center gap-2">
                  📱 Red Social (Celular)
               </button>
               <button onClick={() => { setBackpackOpen(false); setSkinsOpen(true); }} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium flex items-center justify-center gap-2">
                  👤 Inventario de Skins
               </button>
               <button onClick={() => setBackpackOpen(false)} className="mt-2 text-gray-500 hover:text-white text-sm text-center">Cerrar</button>
            </div>
         )}
         
         {isPhoneOpen && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[550px] bg-black rounded-[40px] border-[8px] border-gray-800 shadow-2xl p-4 flex flex-col overflow-hidden">
               <div className="w-32 h-6 bg-gray-800 rounded-b-xl absolute top-0 left-1/2 -translate-x-1/2 z-10"></div>
               <h3 className="text-white font-bold text-center mt-6 mb-4">VR Social Feed</h3>
               <div className="flex-1 overflow-y-auto space-y-4">
                  <div className="bg-gray-900 rounded-xl p-3">
                     <div className="font-bold text-cyan-400 text-sm">Axiss</div>
                     <div className="text-white text-sm mt-1">¡Bienvenido a la nueva Sala VR! Aquí podrás interactuar con todos.</div>
                     <div className="mt-2 flex items-center gap-4 text-gray-500 text-xs">
                        <span>❤️ 24 Likes</span>
                        <span>💬 5 Comentarios</span>
                     </div>
                  </div>
               </div>
               <button onClick={() => setPhoneOpen(false)} className="w-full py-2 bg-red-500/20 text-red-400 rounded-xl mt-4 font-bold">Cerrar Celular</button>
            </div>
         )}
         
         {isSkinsOpen && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[#1a1c26] rounded-2xl border border-white/10 shadow-2xl p-6 flex flex-col gap-4">
               <h3 className="text-white font-bold text-lg">Inventario de Skins</h3>
               <p className="text-gray-400 text-sm">Pega la URL de un modelo 3D (.glb o .gltf) para usarlo como tu skin.</p>
               <input type="text" placeholder="https://ejemplo.com/modelo.glb" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500" />
               <input type="text" placeholder="Nombre del skin" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500" />
               <div className="flex gap-2 mt-4">
                  <button onClick={() => setSkinsOpen(false)} className="flex-1 py-2 bg-gray-800 text-white rounded-xl">Cancelar</button>
                  <button className="flex-1 py-2 bg-cyan-600 text-white rounded-xl font-bold">Cargar Skin</button>
               </div>
            </div>
         )}
         
      </div>
    </div>
  );
}
