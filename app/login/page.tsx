// login/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LoginForm from "@/components/LoginForm";

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

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useState(false);

  // Redirect kalau sudah login
  useEffect(() => {
    if (status === "authenticated") router.push("/");
  }, [status, router]);

  // Deteksi prefers-reduced-motion (aksesibilitas)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen overflow-hidden flex items-center justify-center bg-gradient-to-b from-[#020a1a] via-[#0a1a3a] to-[#050a20]">
        <div className="relative" role="status" aria-label="Memuat">
          <div className="w-16 h-16 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-[#00c8ff]/20 rounded-full animate-ping" />
        </div>
      </div>
    );
  }

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

        {/* 2. Sun rays dari atas */}
        {!reducedMotion && (
          <div className="rays-layer">
            {RAYS.map((r, i) => (
              <div
                key={`ray-${i}`}
                className="absolute top-0 h-full origin-top"
                style={{ left: r.left, transform: `rotate(${r.rot}deg)` }}
              >
                <div
                  className="w-24 h-full bg-gradient-to-b from-[#00c8ff]/35 via-[#00c8ff]/10 to-transparent blur-2xl ray-beam"
                  style={{
                    animation: `rayShimmer ${r.duration} ease-in-out infinite`,
                    animationDelay: r.delay,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* 3. Aliran current horizontal (parallax) */}
        {!reducedMotion && (
          <div className="currents-layer">
            {CURRENTS.map((c, i) => (
              <div
                key={`cur-${i}`}
                className="absolute left-0 rounded-full current-line"
                style={{
                  top: `${c.top}%`,
                  width: `${c.width}px`,
                  height: '2px',
                  background:
                    'linear-gradient(90deg, transparent, rgba(0,200,255,0.7), transparent)',
                  opacity: c.opacity,
                  filter: 'blur(0.5px)',
                  animation: `currentFlow ${c.duration}s linear infinite`,
                  animationDelay: `${c.delay}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* 4. Bubbles naik dari dasar */}
        {!reducedMotion && (
          <div className="bubbles-layer">
            {BUBBLES.map((b, i) => (
              <div
                key={`b-${i}`}
                className="absolute rounded-full border border-[#00c8ff]/50 bg-[#00c8ff]/10 bubble"
                style={{
                  left: `${b.left}%`,
                  bottom: '-20px',
                  width: `${b.size}px`,
                  height: `${b.size}px`,
                  boxShadow: '0 0 6px rgba(0,200,255,0.6)',
                  animation: `bubbleRise ${b.duration}s ease-in infinite`,
                  animationDelay: `${b.delay}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* 5. Wave layers bawah (3 parallax) */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-32 text-[#00c8ff]/10 wave-slow"
          viewBox="0 0 2880 120"
          preserveAspectRatio="none"
          style={{ animation: reducedMotion ? 'none' : 'waveMove 14s linear infinite' }}
        >
          <path
            fill="currentColor"
            d="M0,60 C360,100 720,20 1080,60 C1440,100 1800,20 2160,60 C2520,100 2880,20 2880,60 L2880,120 L0,120 Z"
          />
        </svg>
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-24 text-[#0066ff]/12 wave-mid"
          viewBox="0 0 2880 120"
          preserveAspectRatio="none"
          style={{ animation: reducedMotion ? 'none' : 'waveMove 20s linear infinite reverse' }}
        >
          <path
            fill="currentColor"
            d="M0,80 C480,40 960,100 1440,60 C1920,20 2400,100 2880,80 L2880,120 L0,120 Z"
          />
        </svg>
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-16 text-[#0099ff]/18 wave-fast"
          viewBox="0 0 2880 120"
          preserveAspectRatio="none"
          style={{ animation: reducedMotion ? 'none' : 'waveMove 10s linear infinite' }}
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

        <LoginForm redirectTo="/" />

        {/* ===== FOOTER: Copyright + Versi ===== */}
        <footer className="mt-8 text-center space-y-2">
          {/* Versi + build date */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-[#00c8ff]/70 font-mono">
            <span className="px-2 py-0.5 rounded-full bg-[#00c8ff]/10 border border-[#00c8ff]/20">
              v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-white/40">
              {process.env.NEXT_PUBLIC_BUILD_DATE || 'dev'}
            </span>
          </div>

          {/* Copyright */}
          <p className="text-[11px] text-white/50 leading-relaxed">
            © {new Date().getFullYear()}{' '}
            <span className="font-semibold text-white/70">IlookaAi</span>
            {' · '}
            <span className="text-white/40">Cipamingkis</span>
            {' '}member of{' '}
            <span className="text-white/60">Perum Jasa Tirta II</span>
          </p>

          {/* Tech stack */}
          <p className="text-[9px] text-white/25 tracking-wider uppercase">
            Powered by Tailscale · Leaflet · FastAPI
          </p>
        </footer>
      </div>

      {/*
        ===== KEYFRAMES =====
        ⚠️ PENTING: pakai <style> biasa, BUKAN <style jsx>.
        styled-jsx me-rename @keyframes jadi e.g. "waveMove-jsx-xxx",
        sehingga animasi yang dipanggil via inline style (raw string)
        tidak akan match. Bug ini silent — gak ada error di console.
      */}
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

        /* GPU hints — bantu compositing, FPS lebih stabil */
        .caustic-blob { will-change: transform, opacity; }
        .ray-beam     { will-change: opacity; }
        .current-line { will-change: transform, opacity; }
        .bubble       { will-change: transform, opacity; }
        .wave-slow,
        .wave-mid,
        .wave-fast    { will-change: transform; }

        /* Kurangi beban di layar kecil — sisakan yang penting aja */
        @media (max-width: 640px) {
          .caustics-layer > :nth-child(n+4) { display: none; }
          .rays-layer     > :nth-child(n+2) { display: none; }
          .currents-layer > :nth-child(n+8) { display: none; }
          .bubbles-layer  > :nth-child(n+10) { display: none; }
        }

        /* Aksesibilitas — hormati preferensi reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .caustic-blob,
          .ray-beam,
          .current-line,
          .bubble,
          .wave-slow,
          .wave-mid,
          .wave-fast {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}