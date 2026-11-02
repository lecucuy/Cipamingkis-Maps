// components/map/screens/MapLoadingScreen.tsx
'use client';
import { useEffect, useState } from 'react';

const MESSAGES = [
  { icon: 'fa-map',          text: 'Memuat peta...' },
  { icon: 'fa-layer-group',  text: 'Menyiapkan layer geospasial...' },
  { icon: 'fa-location-dot', text: 'Mengambil data bangunan...' },
  { icon: 'fa-satellite',    text: 'Menyinkronkan citra satelit...' },
  { icon: 'fa-compass',      text: 'Hampir selesai...' },
] as const;

const KEYFRAMES = `
  @keyframes mls-radar-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes mls-ping { 0% { transform: scale(0.3); opacity: 0.9; } 100% { transform: scale(1.8); opacity: 0; } }
  @keyframes mls-pin-bounce { 0%,100% { transform: translateY(-4px); } 50% { transform: translateY(4px); } }
  @keyframes mls-grid-slide { from { background-position: 0 0; } to { background-position: 60px 60px; } }
  @keyframes mls-dot { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
  @keyframes mls-bar-shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
  @keyframes mls-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
`;

export function MapLoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);

  // Rotating status messages
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 1600);
    return () => clearInterval(t);
  }, []);

  // Inject keyframes once
  useEffect(() => {
    if (document.getElementById('map-loader-style')) return;
    const style = document.createElement('style');
    style.id = 'map-loader-style';
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="h-screen w-screen flex items-center justify-center relative overflow-hidden bg-white">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,150,200,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,150,200,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          animation: 'mls-grid-slide 12s linear infinite',
        }}
      />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,200,255,0.18),transparent_60%)] pointer-events-none" />

      <div className="relative text-center px-4">
        {/* Radar */}
        <div className="relative w-40 h-40 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-[#00c8ff]" style={{ animation: 'mls-ping 2.4s ease-out infinite' }} />
          <div className="absolute inset-0 rounded-full border-2 border-[#00c8ff]" style={{ animation: 'mls-ping 2.4s ease-out 0.6s infinite' }} />
          <div className="absolute inset-0 rounded-full border-2 border-[#00c8ff]" style={{ animation: 'mls-ping 2.4s ease-out 1.2s infinite' }} />
          <div className="absolute inset-4 rounded-full border border-[#00c8ff]/30" />
          <div className="absolute inset-10 rounded-full border border-[#00c8ff]/20" />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(0,200,255,0.45) 60deg, transparent 90deg)',
              animation: 'mls-radar-sweep 2s linear infinite',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00c8ff] to-blue-600 flex items-center justify-center shadow-2xl shadow-[#00c8ff]/40 border-4 border-white"
              style={{ animation: 'mls-pin-bounce 2s ease-in-out infinite' }}
            >
              <i className="fa-solid fa-location-dot text-white text-2xl" />
            </div>
          </div>
        </div>

        {/* Brand */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-wider flex items-center justify-center gap-2">
            <i className="fa-solid fa-droplet text-[#00c8ff]" />
            iLook<span className="text-[#00c8ff]">Ai</span>
          </h1>
          <p className="text-[10px] text-[#00a0d0] tracking-[0.3em] mt-1 uppercase">
            Cipamingkis Map
          </p>
        </div>

        {/* Rotating message */}
        <div className="h-6 mb-6 overflow-hidden relative">
          <div
            key={msgIdx}
            className="flex items-center justify-center gap-2 text-slate-600 text-sm"
            style={{ animation: 'mls-fade-in 0.5s ease-out' }}
          >
            <i className={`fa-solid ${MESSAGES[msgIdx].icon} text-[#00c8ff] text-xs`} />
            <span>{MESSAGES[msgIdx].text}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-1 mx-auto rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #00c8ff, transparent)',
              backgroundSize: '200% 100%',
              animation: 'mls-bar-shimmer 1.5s linear infinite',
            }}
          />
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#00c8ff]"
              style={{ animation: `mls-dot 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-[10px] text-slate-400">
          Perum Jasa Tirta II · <span className="font-mono text-[#00a0d0]">v0.1 A</span>
        </p>
      </div>
    </div>
  );
}

export default MapLoadingScreen;