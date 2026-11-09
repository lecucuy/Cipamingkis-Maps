'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { liveWsUrl } from '@/lib/realtime';

// Batas buffer WS: kalau >1MB menumpuk, skip frame (jaringan lambat).
const MAX_BUFFERED_BYTES = 1_000_000;

interface Props {
  roomId: string;
  token: string;
  buildingName?: string;
  onStop?: () => void;
}

type Facing = 'user' | 'environment';

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

function pickBitrate(): { video: number; audio: number } {
  const conn: any = typeof navigator !== 'undefined'
    ? (navigator as any).connection
    : null;
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

// 🔥 Helper: request stream dengan facing mode tertentu
async function requestStream(facing: Facing): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facing },   // 'ideal' bukan 'exact' → fallback aman di desktop
      width: { ideal: 854 },
      height: { ideal: 480 },
      frameRate: { ideal: 15, max: 20 },
    },
    audio: { echoCancellation: true, noiseSuppression: true },
  });
}

export default function LiveStreamer({ roomId, token, buildingName, onStop }: Props) {
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [facing, setFacing] = useState<Facing>('environment'); // 🔥 default belakang
  const [hasMultipleCams, setHasMultipleCams] = useState(false);
  const [switching, setSwitching] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const facingRef = useRef<Facing>('environment');

  const liveRef = useRef(false);
  const startingRef = useRef(false);
  const onStopRef = useRef(onStop);

  useEffect(() => { onStopRef.current = onStop; }, [onStop]);
  useEffect(() => { facingRef.current = facing; }, [facing]);

  // 🔧 Helper: bikin MediaRecorder untuk stream tertentu & langsung start
  const attachRecorder = useCallback((stream: MediaStream): MediaRecorder | null => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return null;

    const mime = pickMimeType();
    if (!mime) {
      setErr('Browser tidak mendukung MediaRecorder WebM.');
      return null;
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
      return null;
    }

    rec.ondataavailable = async (e) => {
      if (!e.data || e.data.size === 0) return;
      const sock = wsRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      if (sock.bufferedAmount > MAX_BUFFERED_BYTES) return;
      try {
        const buf = await e.data.arrayBuffer();
        if (sock.readyState === WebSocket.OPEN) sock.send(buf);
      } catch {}
    };

    rec.onerror = (e: any) => {
      setErr(`Recorder error: ${e?.error?.message || 'tidak diketahui'}`);
    };

    rec.start(1000);
    return rec;
  }, []);

  const cleanup = useCallback((notifyStop: boolean) => {
    const wasLive = liveRef.current;
    liveRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch {}
    }
    recorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }

    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try { ws.close(); } catch {}
    }
    wsRef.current = null;

    setLive(false);
    setSeconds(0);
    setViewers(0);
    startingRef.current = false;

    if (notifyStop && wasLive) {
      onStopRef.current?.();
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || liveRef.current) return;
    startingRef.current = true;
    setErr(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('Browser tidak mendukung akses kamera. Gunakan Chrome/Firefox terbaru.');
      startingRef.current = false;
      return;
    }

    let stream: MediaStream;
    try {
      stream = await requestStream(facingRef.current);
    } catch (e: any) {
      setErr(describeMediaError(e));
      startingRef.current = false;
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;

    // 🔥 Deteksi >1 kamera (paling andal setelah permission granted)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      setHasMultipleCams(cams.length > 1);
    } catch {}

    // ── WS ke backend realtime (port 5002), path /api/ws/live/:roomId
    const ws = new WebSocket(liveWsUrl(roomId, 'streamer', token));
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      // 🔥 Pakai streamRef.current (bukan closure `stream`) supaya kalau user
      // sempat switch kamera di window antara getUserMedia dan onopen, tetap benar.
      const activeStream = streamRef.current;
      if (!activeStream) { cleanup(false); return; }

      const rec = attachRecorder(activeStream);
      if (!rec) { cleanup(false); return; }

      recorderRef.current = rec;
      liveRef.current = true;
      setLive(true);
      startingRef.current = false;

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'joined') setViewers(msg.viewers || 0);
        else if (msg.type === 'viewers') setViewers(msg.count || 0);
        else if (msg.type === 'stream_end') cleanup(false);
      } catch {}
    };

    ws.onerror = () => {
      setErr('Koneksi WebSocket gagal. Cek jaringan.');
    };

    ws.onclose = (ev) => {
      const wasLive = liveRef.current;
      cleanup(false);
      if (wasLive && ev.code !== 1000 && ev.code !== 1005) {
        toast.error('Koneksi live terputus');
        onStopRef.current?.();
      }
    };
  }, [roomId, token, cleanup, attachRecorder]);

  // 🔥 SWITCH KAMERA DEPAN ↔ BELAKANG
  const switchCamera = useCallback(async () => {
    if (switching) return;
    setSwitching(true);
    const nextFacing: Facing = facingRef.current === 'user' ? 'environment' : 'user';

    try {
      // 1. Ambil stream baru DULU — kalau gagal, belum ada yang berubah
      const newStream = await requestStream(nextFacing);

      if (liveRef.current) {
        // === Sedang live → restart recorder, WS TETAP TERBUKA ===
        const oldRec = recorderRef.current;
        if (oldRec && oldRec.state !== 'inactive') {
          try { oldRec.stop(); } catch {}
        }
        recorderRef.current = null;

        // Stop track lama
        streamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch {} });

        streamRef.current = newStream;
        if (videoRef.current) videoRef.current.srcObject = newStream;

        const rec = attachRecorder(newStream);
        if (rec) recorderRef.current = rec;
        else toast.error('Gagal restart recorder setelah switch kamera');
      } else {
        // === Belum live → cukup swap preview ===
        streamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch {} });
        streamRef.current = newStream;
        if (videoRef.current) videoRef.current.srcObject = newStream;
      }

      setFacing(nextFacing);
      toast.success(
        nextFacing === 'user' ? '📷 Kamera depan aktif' : '📷 Kamera belakang aktif',
        { duration: 1500, position: 'bottom-center' }
      );
    } catch (e: any) {
      toast.error(describeMediaError(e));
    } finally {
      setSwitching(false);
    }
  }, [switching, attachRecorder]);

  useEffect(() => {
    return () => { cleanup(false); };
  }, [cleanup]);

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

        {/* 🔥 TOMBOL SWITCH KAMERA — hanya tampil kalau device punya >1 kamera */}
        {hasMultipleCams && (
          <button
            onClick={switchCamera}
            disabled={switching}
            aria-label="Ganti kamera"
            title={facing === 'user' ? 'Pakai kamera belakang' : 'Pakai kamera depan'}
            className="absolute bottom-3 right-3 z-10 w-11 h-11 rounded-full
                       bg-black/55 hover:bg-black/75 active:scale-95
                       backdrop-blur-md text-white border border-white/30
                       flex items-center justify-center transition disabled:opacity-50"
          >
            <i className={`fa-solid ${switching ? 'fa-spinner fa-spin' : 'fa-camera-rotate'} text-base`} />
          </button>
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
          live
            ? 'bg-rose-500 hover:bg-rose-600'
            : 'bg-[#00c8ff] hover:opacity-90'
        }`}
      >
        {live ? (
          <>
            <i className="fa-solid fa-stop mr-2" /> Stop Live
          </>
        ) : (
          <>
            <i className="fa-solid fa-circle-play mr-2" /> Mulai Live
          </>
        )}
      </button>
    </div>
  );
}