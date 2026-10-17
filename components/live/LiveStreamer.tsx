'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const WS_URL = API_URL.replace(/^http/, 'ws');

// Batas buffer WS: kalau >1MB menumpuk, skip frame (jaringan lambat).
// 1MB ≈ 3 detik video pada 350kbps — cukup buffer, tidak membengkak.
const MAX_BUFFERED_BYTES = 1_000_000;

interface Props {
  roomId: string;
  token: string;
  buildingName?: string;
  onStop?: () => void;
}

// ── Utility: pilih codec yang didukung browser ──
function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  for (const m of candidates) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return '';
}

// ── Utility: bitrate adaptif berdasarkan kualitas jaringan ──
function pickBitrate(): { video: number; audio: number } {
  const conn: any = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
  const et = conn?.effectiveType as string | undefined;
  if (conn?.saveData) return { video: 200_000, audio: 24_000 };
  if (et === 'slow-2g' || et === '2g') return { video: 150_000, audio: 24_000 };
  if (et === '3g') return { video: 250_000, audio: 32_000 };
  return { video: 350_000, audio: 32_000 };
}

function describeMediaError(e: any): string {
  const name = e?.name || '';
  if (name === 'NotAllowedError') return 'Izin kamera/mic ditolak. Aktifkan di pengaturan browser.';
  if (name === 'NotFoundError') return 'Kamera atau mikrofon tidak ditemukan.';
  if (name === 'NotReadableError') return 'Kamera/mic sedang dipakai aplikasi lain.';
  if (name === 'OverconstrainedError') return 'Resolusi kamera tidak didukung.';
  return e?.message || 'Gagal akses kamera/mic';
}

export default function LiveStreamer({ roomId, token, buildingName, onStop }: Props) {
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref untuk hindari stale closure
  const liveRef = useRef(false);
  const startingRef = useRef(false);
  const onStopRef = useRef(onStop);

  // Sync ref callback supaya cleanup selalu panggil versi terbaru
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);

  // ── Cleanup terpusat ──
  //   notifyStop=true  → panggil onStop (user klik Stop)
  //   notifyStop=false → tidak panggil (unmount / server putus / stream_end)
  const cleanup = useCallback((notifyStop: boolean) => {
    const wasLive = liveRef.current;
    liveRef.current = false;

    // 1) Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 2) Stop recorder — flush chunk terakhir sebelum WS ditutup
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch {}
    }
    recorderRef.current = null;

    // 3) Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }

    // 4) Null-kan handler WS DULU, baru close — cegah double-callback
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try { ws.close(); } catch {}
    }
    wsRef.current = null;

    // 5) Reset state
    setLive(false);
    setSeconds(0);
    setViewers(0);
    startingRef.current = false;

    // 6) Notifikasi parent setelah semua beres
    if (notifyStop && wasLive) {
      onStopRef.current?.();
    }
  }, []);

  // ── Start ──
  const start = useCallback(async () => {
    if (startingRef.current || liveRef.current) return;
    startingRef.current = true;
    setErr(null);

    // Guard browser
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('Browser tidak mendukung akses kamera. Gunakan Chrome/Firefox terbaru.');
      startingRef.current = false;
      return;
    }

    // Ambil stream kamera + mic
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 854 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 20 },
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e: any) {
      setErr(describeMediaError(e));
      startingRef.current = false;
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;

    // Buka WebSocket
    const params = new URLSearchParams({ role: 'streamer' });
    if (token) params.set('token', token);
    const ws = new WebSocket(`${WS_URL}/ws/live/${roomId}?${params.toString()}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    // ── WS open: mulai MediaRecorder ──
    ws.onopen = () => {
      const mime = pickMimeType();
      if (!mime) {
        setErr('Browser tidak mendukung MediaRecorder WebM.');
        cleanup(false);
        return;
      }

      const { video: vbr, audio: abr } = pickBitrate();

      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond: vbr,
          audioBitsPerSecond: abr,
        });
      } catch (e: any) {
        setErr(`Gagal inisialisasi recorder: ${e?.message || e}`);
        cleanup(false);
        return;
      }

      rec.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        const sock = wsRef.current;
        if (!sock || sock.readyState !== WebSocket.OPEN) return;
        // Jangan kirim kalau buffer WS sudah menumpuk
        if (sock.bufferedAmount > MAX_BUFFERED_BYTES) return;
        try {
          const buf = await e.data.arrayBuffer();
          if (sock.readyState === WebSocket.OPEN) sock.send(buf);
        } catch {}
      };

      rec.onerror = (e: any) => {
        setErr(`Recorder error: ${e?.error?.message || 'tidak diketahui'}`);
      };

      // Kirim chunk tiap 1 detik (≈1 chunk/detik)
      rec.start(1000);
      recorderRef.current = rec;

      liveRef.current = true;
      setLive(true);
      startingRef.current = false;

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    };

    // ── Pesan dari server ──
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'joined') {
          setViewers(msg.viewers || 0);
        } else if (msg.type === 'viewers') {
          // 🔧 FIX: backend kirim {"type":"viewers","count":N}
          setViewers(msg.count || 0);
        } else if (msg.type === 'stream_end') {
          // Server minta stop (biasanya parent sudah hit REST /stop)
          cleanup(false);
        }
      } catch {}
    };

    ws.onerror = () => {
      setErr('Koneksi WebSocket gagal. Cek jaringan.');
    };

    ws.onclose = (ev) => {
      const wasLive = liveRef.current;
      cleanup(false);
      // Kalau sebelumnya live dan close bukan normal → server putus
      if (wasLive && ev.code !== 1000 && ev.code !== 1005) {
        toast.error('Koneksi live terputus');
        onStopRef.current?.();
      }
    };
  }, [roomId, token, cleanup]);

  // ── Cleanup saat unmount / roomId berubah ──
  useEffect(() => {
    return () => { cleanup(false); };
  }, [cleanup]);

  // ── Stop manual ──
  const stop = () => { cleanup(true); };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />

        {live && (
          <>
            <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-mono">
              {fmtTime(seconds)}
            </div>
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1">
              <i className="fa-solid fa-eye" /> {viewers}
            </div>
          </>
        )}

        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 pointer-events-none">
            <i className="fa-solid fa-video text-4xl mb-2" />
            <p className="text-xs">Preview kamera</p>
            {buildingName && (
              <p className="text-[10px] mt-1 opacity-70">{buildingName}</p>
            )}
          </div>
        )}
      </div>

      {err && (
        <div className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg">
          <i className="fa-solid fa-triangle-exclamation mr-1" />
          {err}
        </div>
      )}

      <button
        onClick={live ? stop : start}
        className={`w-full py-3 text-sm rounded-xl font-semibold text-white transition ${
          live ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[#00c8ff] hover:opacity-90'
        }`}
      >
        {live ? (
          <><i className="fa-solid fa-stop mr-2" /> Stop Live</>
        ) : (
          <><i className="fa-solid fa-circle-play mr-2" /> Mulai Live</>
        )}
      </button>
    </div>
  );
}