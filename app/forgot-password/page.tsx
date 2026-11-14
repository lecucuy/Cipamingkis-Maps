// app/forgot-password/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import ForgotPasswordForm from '@/components/ForgotPasswordForm';

// ── Aliran current horizontal (parallax) ──
const CURRENTS = Array.from({ length: 14 }).map((_, i) => ({
  top: (i * 7 + 5) % 95,
  delay: (i * 0.6) % 8,
  duration: 6 + ((i * 1.7) % 5),
  width: 120 + ((i * 40) % 320),
  opacity: 0.08 + (i % 4) * 0.06,
}));

// ── Bubbles naik dari dasar ──
const BUBBLES = Array.from({ length: 18 }).map((_, i) => ({
  left: (i * 47) % 100,
  delay: (i * 0.8) % 10,
  duration: 9 + ((i * 2.3) % 7),
  size: 2 + (i % 5) * 2,
}));

// ── Caustic shimmer (cahaya di bawah air) ──
const CAUSTICS = [
  { x: '10%', y: '20%', size: 320, delay: '0s', duration: '12s' },
  { x: '70%', y: '15%', size: 260, delay: '3s', duration: '15s' },
  { x: '30%', y: '70%', size: 360, delay: '6s', duration: '18s' },
  { x: '85%', y: '60%', size: 220, delay: '2s', duration: '14s' },
  { x: '50%', y: '40%', size: 300, delay: '8s', duration: '16s' },
];

// ── Sun rays dari atas ──
const RAYS = [
  { left: '20%', rot: 12, delay: '0s', duration: '8s' },
  { left: '50%', rot: -8, delay: '2s', duration: '10s' },
  { left: '80%', rot: 10, delay: '4s', duration: '12s' },
];

function FormFallback() {
  return (
    <div className="w-full max-w-md p-8 rounded-2xl bg-white/90 dark:bg-[#12122b]/90 backdrop-blur-md border border-white/20 dark:border-[#2a2a4e] shadow-2xl flex flex-col items-center justify-center min-h-[300px]">
      <div className="w-10 h-10 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">Memuat formulir...</p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const [reducedMotion, setReducedMotion] = useState(false);

  // Deteksi prefers-reduced-motion (aksesibilitas)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#020a1a] via-[#0a1a3a] to-[#050a20] px-4 py-8">
      {/* ===== RIVER BACKGROUND ===== */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {/* 1. Caustic shimmer — cahaya bawah air */}
        {!reducedMotion && (
          <div className="caustics-layer">
            {CAUSTICS.map((c, i) => (
              <div
                key={`c-${i}`}
                className="absolute rounded-full mix-blend-screen caustic-blob"
                style={{
                  left: c.x,
                  top: c.y,
                  width: c.size,
                  height: c.size,
                  background:
                    'radial-gradient(circle, rgba(0,200,255,0.18) 0%, rgba(0,100,255,0.08) 40%, transparent 70%)',
                  filter: 'blur(40px)',
                  transform: 'translate(-50%, -50%)',
                  animation: `causticFloat ${c.duration} ease-in-out infinite`,
                  animationDelay: c.delay,
                }}
              />
            ))}
          </div>
        )}

        {/* 2. Sun rays */}
        {!reducedMotion && (
          <div className="rays-layer">
            {RAYS.map((r, i) => (
              <div
                key={`r-${i}`}
                className="absolute top-0 w-24 h-full ray-beam origin-top pointer-events-none"
                style={{
                  left: r.left,
                  background:
                    'linear-gradient(180deg, rgba(0,200,255,0.12) 0%, rgba(0,150,255,0.03) 60%, transparent 100%)',
                  transform: `rotate(${r.rot}deg)`,
                  filter: 'blur(16px)',
                  animation: `rayShimmer ${r.duration} ease-in-out infinite`,
                  animationDelay: r.delay,
                }}
              />
            ))}
          </div>
        )}

        {/* 3. Arus sungai horizontal */}
        {!reducedMotion && (
          <div className="currents-layer">
            {CURRENTS.map((c, i) => (
              <div
                key={`curr-${i}`}
                className="absolute h-px current-line"
                style={{
                  top: `${c.top}%`,
                  width: `${c.width}px`,
                  background:
                    'linear-gradient(90deg, transparent, rgba(0,200,255,0.6), transparent)',
                  opacity: c.opacity,
                  animation: `currentFlow ${c.duration}s linear infinite`,
                  animationDelay: `${c.delay}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* 4. Bubbles */}
        {!reducedMotion && (
          <div className="bubbles-layer">
            {BUBBLES.map((b, i) => (
              <div
                key={`b-${i}`}
                className="absolute rounded-full bubble"
                style={{
                  left: `${b.left}%`,
                  bottom: '-20px',
                  width: `${b.size}px`,
                  height: `${b.size}px`,
                  background:
                    'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(0,200,255,0.3))',
                  boxShadow: '0 0 6px rgba(0,200,255,0.5)',
                  animation: `bubbleRise ${b.duration}s ease-in infinite`,
                  animationDelay: `${b.delay}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* 5. Gelombang SVG di bagian bawah */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-28 text-[#00c8ff]/10 wave-slow pointer-events-none"
          viewBox="0 0 2880 120"
          preserveAspectRatio="none"
          style={{ animation: 'waveMove 22s linear infinite' }}
        >
          <path
            fill="currentColor"
            d="M0,40 C720,10 1440,70 2160,40 C2520,25 2800,55 2880,40 L2880,120 L0,120 Z"
          />
        </svg>

        <svg
          className="absolute bottom-0 left-0 w-[200%] h-24 text-[#0088cc]/15 wave-fast pointer-events-none"
          viewBox="0 0 2880 120"
          preserveAspectRatio="none"
          style={{ animation: 'waveMove 14s linear infinite reverse' }}
        >
          <path
            fill="currentColor"
            d="M0,90 C720,60 1440,110 2160,80 C2520,60 2800,100 2880,90 L2880,120 L0,120 Z"
          />
        </svg>

        {/* 6. Vignette gelap di tepi */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,10,26,0.7)_100%)]" />
      </div>

      {/* ===== FORM + FOOTER ===== */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        <Suspense fallback={<FormFallback />}>
          <ForgotPasswordForm />
        </Suspense>

        {/* ===== FOOTER: Copyright + Versi ===== */}
        <footer className="mt-8 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-[10px] text-[#00c8ff]/70 font-mono">
            <span className="px-2 py-0.5 rounded-full bg-[#00c8ff]/10 border border-[#00c8ff]/20">
              v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-white/40">
              {process.env.NEXT_PUBLIC_BUILD_DATE || 'dev'}
            </span>
          </div>

          <p className="text-[11px] text-white/50 leading-relaxed">
            © {new Date().getFullYear()}{' '}
            <span className="font-semibold text-white/70">IlookaAi</span>
            {' · '}
            <span className="text-white/40">Cipamingkis</span>
            {' '}member of{' '}
            <span className="text-white/60">Perum Jasa Tirta II</span>
          </p>

          <p className="text-[9px] text-white/25 tracking-wider uppercase">
            Powered by Tailscale · Leaflet · FastAPI
          </p>
        </footer>
      </div>

      <style>{`
        @keyframes currentFlow {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(100vw); opacity: 0; }
        }
        @keyframes bubbleRise {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.7; }
          100% { transform: translateY(-105vh) translateX(20px); opacity: 0; }
        }
        @keyframes causticFloat {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.5; }
          50%      { transform: translate(-50%, -50%) scale(1.25); opacity: 1;   }
        }
        @keyframes rayShimmer {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 0.65; }
        }
        @keyframes waveMove {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .caustic-blob { will-change: transform, opacity; }
        .ray-beam     { will-change: opacity; }
        .current-line { will-change: transform, opacity; }
        .bubble       { will-change: transform, opacity; }
        .wave-slow,
        .wave-fast    { will-change: transform; }

        @media (max-width: 640px) {
          .caustics-layer > :nth-child(n+4) { display: none; }
          .rays-layer     > :nth-child(n+2) { display: none; }
          .currents-layer > :nth-child(n+8) { display: none; }
          .bubbles-layer  > :nth-child(n+10) { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .caustic-blob,
          .ray-beam,
          .current-line,
          .bubble,
          .wave-slow,
          .wave-fast {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
