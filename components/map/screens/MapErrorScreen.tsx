// components/map/screens/MapErrorScreen.tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface MapErrorScreenProps {
  error: string;
  onRetry: () => void;
  /** Regex untuk mendeteksi error jaringan, default sudah diset */
  networkErrorPattern?: RegExp;
  /** Jumlah detik auto-retry setelah koneksi kembali, default 3 */
  autoRetryDelay?: number;
}

const KEYFRAMES = `
  @keyframes mes-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes mes-pulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.15); opacity: 0.9; } }
  @keyframes mes-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes mes-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-3px); } 40% { transform: translateX(3px); } 60% { transform: translateX(-2px); } 80% { transform: translateX(2px); } }
`;

export function MapErrorScreen({
  error,
  onRetry,
  networkErrorPattern = /network|fetch|timeout|failed to|gagal load data/i,
  autoRetryDelay = 3,
}: MapErrorScreenProps) {
  const isOnline = useNetworkStatus();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);
  const wasOfflineRef = useRef(false);

  const isNetworkIssue = !isOnline || networkErrorPattern.test(error);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    setTimeout(() => onRetry(), 350);
  }, [onRetry]);

  // Auto-retry saat koneksi kembali
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setCountdown(null);
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setCountdown(autoRetryDelay);
    }
  }, [isOnline, autoRetryDelay]);

  // Countdown
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => {
      if (countdown === 1) {
        handleRetry();
        setCountdown(null);
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown, handleRetry]);

  // Inject keyframes once
  useEffect(() => {
    if (document.getElementById('map-error-style')) return;
    const style = document.createElement('style');
    style.id = 'map-error-style';
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }, []);

  const iconClass = isNetworkIssue
    ? isOnline
      ? 'fa-server'
      : 'fa-wifi-slash'
    : 'fa-triangle-exclamation';

  const title = isNetworkIssue
    ? isOnline
      ? 'Server Tidak Merespon'
      : 'Koneksi Terputus'
    : 'Gagal Memuat Peta';

  const subtitle = isNetworkIssue
    ? isOnline
      ? 'Tidak dapat menghubungi server. Periksa koneksi atau coba beberapa saat lagi.'
      : 'Anda sedang offline. Sambungkan perangkat ke internet untuk melanjutkan.'
    : 'Terjadi kesalahan saat memuat data geospasial.';

  return (
    <div className="h-screen w-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#0a0a1a] via-[#1a0d14] to-[#0a0a1a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15),transparent_60%)] pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(239,68,68,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(239,68,68,0.6) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative max-w-md w-full mx-4 text-center" style={{ animation: 'mes-fade-in 0.4s ease-out' }}>
        {/* Icon */}
        <div className="relative w-32 h-32 mx-auto mb-6" style={{ animation: 'mes-float 3s ease-in-out infinite' }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(239,68,68,0.35), transparent 70%)',
              animation: 'mes-pulse 2.4s ease-in-out infinite',
            }}
          />
          <div className="relative w-full h-full rounded-full bg-gradient-to-br from-red-500/15 to-orange-500/10 border-2 border-red-500/30 flex items-center justify-center backdrop-blur-sm">
            <i className={`fa-solid ${iconClass} text-red-500 text-5xl`} />
          </div>
          <div
            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-bold whitespace-nowrap shadow-lg ${
              isOnline
                ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                : 'bg-red-500 text-white shadow-red-500/40'
            }`}
          >
            <i className={`fa-solid ${isOnline ? 'fa-circle-check' : 'fa-circle-xmark'} mr-1`} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

        {/* Text */}
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-400 mb-5 leading-relaxed">{subtitle}</p>

        {/* Error detail */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 mb-4 text-left">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
            Detail Error
          </p>
          <p className="text-[11px] text-gray-300 font-mono break-all leading-relaxed">{error}</p>
        </div>

        {/* Tips */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-5 text-left">
          <p className="text-[10px] uppercase tracking-wider text-[#00c8ff] mb-2 font-semibold">
            Yang bisa Anda lakukan
          </p>
          <div className="space-y-2 text-[11px] text-gray-300">
            {[
              'Periksa kabel atau sinyal Wi-Fi / data seluler',
              'Matikan lalu nyalakan ulang koneksi internet',
              'Muat ulang halaman jika masalah berlanjut',
            ].map((tip) => (
              <div key={tip} className="flex items-start gap-2">
                <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5 text-[9px]" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Countdown */}
        {countdown !== null && countdown > 0 && (
          <div className="mb-4 text-xs text-emerald-400 flex items-center justify-center gap-2">
            <i className="fa-solid fa-rotate" style={{ animation: 'mes-shake 0.6s ease-in-out infinite' }} />
            Koneksi kembali — memuat ulang dalam <b>{countdown}s</b>...
          </div>
        )}

        {/* Retry button */}
        <button
          onClick={handleRetry}
          disabled={retrying || !isOnline}
          className={`w-full px-6 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg ${
            retrying
              ? 'bg-gray-500 cursor-wait text-white'
              : !isOnline
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
              : 'bg-gradient-to-r from-[#00c8ff] to-blue-600 hover:opacity-90 active:scale-[0.98] text-white shadow-[#00c8ff]/30'
          }`}
        >
          <i
            className={`fa-solid ${
              retrying ? 'fa-spinner fa-spin' : !isOnline ? 'fa-hourglass-half' : 'fa-rotate-right'
            }`}
          />
          {retrying ? 'Memuat Ulang...' : !isOnline ? 'Menunggu Koneksi...' : 'Muat Ulang Sekarang'}
        </button>

        <p className="mt-6 text-[10px] text-gray-500">
          iLookAi · Cipamingkis · <span className="font-mono text-[#00c8ff]/60">v0.1 A</span>
        </p>
      </div>
    </div>
  );
}

export default MapErrorScreen;