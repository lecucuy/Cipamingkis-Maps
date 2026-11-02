'use client';
import { useEffect, useRef, useState } from 'react';
import { liveWsUrl } from '@/lib/realtime';

interface Props {
  roomId: string;
  token: string;
  onClose?: () => void;
}

export default function LiveViewer({ roomId, token, onClose }: Props) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended'>(
    'connecting',
  );
  const [viewers, setViewers] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const msRef = useRef<MediaSource | null>(null);
  const sbRef = useRef<SourceBuffer | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // ── Buka WS ke backend realtime (port 5002), path /api/ws/live/:roomId
    const ws = new WebSocket(liveWsUrl(roomId, 'viewer', token));
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    // ── Setup MSE
    const ms = new MediaSource();
    msRef.current = ms;
    video.src = URL.createObjectURL(ms);

    ms.addEventListener('sourceopen', () => {
      const mime = MediaSource.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
      const sb = ms.addSourceBuffer(mime);
      sbRef.current = sb;

      sb.addEventListener('updateend', () => {
        if (queueRef.current.length > 0 && !sb.updating) {
          try {
            sb.appendBuffer(queueRef.current.shift()!);
          } catch {}
        }
        if (video.buffered.length > 0) {
          const buffered = video.buffered.end(video.buffered.length - 1);
          if (buffered - video.currentTime > 3) {
            video.currentTime = buffered - 0.5;
          }
        }
      });
    });

    // ── Handle pesan dari server
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'stream_start') setStatus('live');
          if (msg.type === 'stream_end') setStatus('ended');
          if (msg.type === 'joined') setViewers(msg.viewers || 0);
          if (msg.type === 'viewers') setViewers(msg.count || 0);
        } catch {}
        return;
      }
      // binary chunk video
      setStatus('live');
      const sb = sbRef.current;
      if (!sb) return;
      if (sb.updating) queueRef.current.push(ev.data);
      else {
        try {
          sb.appendBuffer(ev.data);
        } catch {}
      }
    };

    ws.onerror = () => setStatus('ended');
    ws.onclose = () => {
      setStatus((s) => (s === 'ended' ? s : 'ended'));
    };

    return () => {
      try { ws.close(); } catch {}
      try { ms.endOfStream(); } catch {}
    };
  }, [roomId, token]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls
          className="w-full h-full object-contain"
        />

        {status === 'live' && (
          <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
        {status === 'live' && viewers > 0 && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 pointer-events-none">
            <i className="fa-solid fa-eye" /> {viewers}
          </div>
        )}

        {status === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 pointer-events-none">
            <div className="w-8 h-8 border-3 border-white/40 border-t-white rounded-full animate-spin mb-2" />
            <p className="text-xs">Menghubungkan...</p>
          </div>
        )}
        {status === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 bg-black">
            <i className="fa-solid fa-circle-stop text-3xl mb-2" />
            <p className="text-xs">Siaran berakhir</p>
            {onClose && (
              <button
                onClick={onClose}
                className="mt-3 px-4 py-1.5 text-xs rounded-lg bg-white/20 hover:bg-white/30"
              >
                Tutup
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}