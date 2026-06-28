import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface EmojiGifPickerProps {
  onSelect: (type: 'emoji' | 'gif', val: string) => void;
  onClose: () => void;
}

export function EmojiGifPicker({ onSelect, onClose }: EmojiGifPickerProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif'>('emoji');
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const emojis = ['😊', '😂', '🥰', '😎', '🥺', '😭', '😡', '🤔', '👍', '❤️', '🔥', '✨', '🎉', '🌟', '👀', '🐱', '🐶', '🦊', '🐼', '🐰'];

  useEffect(() => {
    if (activeTab === 'gif' && gifQuery.trim()) {
      const delay = setTimeout(() => {
        searchGifs(gifQuery);
      }, 500);
      return () => clearTimeout(delay);
    } else if (activeTab === 'gif' && !gifQuery.trim()) {
      searchGifs('anime'); // Default search
    }
  }, [gifQuery, activeTab]);

  const searchGifs = async (q: string) => {
    setLoading(true);
    try {
      const apiKey = 'dc6zaTOxFJmzC'; // Public Giphy test key
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=15`);
      const data = await res.json();
      if (data.data) {
        setGifs(data.data.map((g: any) => g.images.fixed_height.url));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute bottom-16 left-0 w-72 bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50">
      <div className="flex border-b border-white/10">
        <button 
          onClick={() => setActiveTab('emoji')} 
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'emoji' ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-400 hover:text-white'}`}
        >
          Emojis
        </button>
        <button 
          onClick={() => setActiveTab('gif')} 
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'gif' ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-400 hover:text-white'}`}
        >
          GIFs
        </button>
      </div>

      <div className="p-3 max-h-64 overflow-y-auto">
        {activeTab === 'emoji' && (
          <div className="grid grid-cols-5 gap-2">
            {emojis.map((e, i) => (
              <button 
                key={i} 
                onClick={() => { onSelect('emoji', e); onClose(); }}
                className="text-2xl hover:bg-white/10 rounded-lg p-1 transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'gif' && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                value={gifQuery}
                onChange={e => setGifQuery(e.target.value)}
                placeholder="Buscar GIFs..."
                className="w-full bg-[#1a1c29] rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-200 outline-none border border-white/5 focus:border-cyan-500/50"
              />
            </div>
            
            {loading ? (
              <div className="text-center text-gray-500 text-sm py-4">Buscando...</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((g, i) => (
                  <img 
                    key={i} 
                    src={g} 
                    loading="lazy"
                    alt="gif" 
                    onClick={() => { onSelect('gif', g); onClose(); }}
                    className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
