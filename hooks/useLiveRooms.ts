// hooks/useLiveRooms.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { REALTIME_URL } from '@/lib/realtime';

export interface LiveRoom {
  room_id: string;
  streamer_id: string | null;
  streamer_name: string;
  building_id: string;
  building_name: string;
  title: string;
  started_at: string;
  viewers: number;
  is_mine: boolean;
}

export function useLiveRooms(token?: string, intervalMs = 8000) {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🔒 Refs untuk kontrol loop tanpa bikin effect re-run
  const inflightRef = useRef(false);          // anti-overlap
  const errorCountRef = useRef(0);            // backoff counter
  const authFailedRef = useRef(false);        // stop polling kalau 401/403

  const refresh = useCallback(() => {
    // manual refresh → reset backoff & auth flag
    errorCountRef.current = 0;
    authFailedRef.current = false;
    setRefreshTrigger(k => k + 1);
  }, []);

  useEffect(() => {
    if (!REALTIME_URL) return;

    // Kalau token berubah (login/logout) → reset auth flag
    authFailedRef.current = false;

    let stopped = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let abortCtrl: AbortController | null = null;

    const fetchRooms = async () => {
      // 🛑 Skip kalau sudah gagal auth (menunggu manual refresh / token baru)
      if (authFailedRef.current) return;

      // 🛑 Skip kalau request sebelumnya belum selesai
      if (inflightRef.current) return;

      // 🛑 Skip kalau tab tidak aktif (dicek di schedule, ini jaga-jaga)
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      inflightRef.current = true;
      setLoading(true);

      // abort controller baru per request
      abortCtrl = new AbortController();

      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await axios.get(`${REALTIME_URL}/live/active`, {
          headers,
          signal: abortCtrl.signal,
          timeout: 10_000,
        });

        if (!stopped) {
          setRooms(res.data?.items || []);
          errorCountRef.current = 0;  // sukses → reset backoff
        }
      } catch (e: any) {
        // Aborted (unmount / tab hidden) → bukan error
        if (axios.isCancel(e) || e.name === 'CanceledError') return;

        const status = e.response?.status;

        if (status === 401 || status === 403) {
          // 🔥 Token mati → STOP polling sampai user login ulang / manual refresh
          authFailedRef.current = true;
          if (!stopped) setRooms([]);
          console.warn('[useLiveRooms] auth failed — polling stopped. Refresh after login.');
        } else {
          // Error jaringan / 5xx → biarkan data lama, naikkan backoff
          errorCountRef.current += 1;
          console.warn(
            `[useLiveRooms] fetch error (${errorCountRef.current}):`,
            e.message,
          );
        }
      } finally {
        inflightRef.current = false;
        if (!stopped) setLoading(false);
      }
    };

    // 📅 Scheduler dengan backoff + pause saat tab hidden
    const schedule = () => {
      if (stopped) return;

      // Kalau tab tidak aktif → jadwalkan cek lagi 5s (tidak fetch)
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        timerId = setTimeout(schedule, 5000);
        return;
      }

      // Kalau auth sudah gagal → jangan jadwalkan apa-apa (tunggu manual refresh)
      if (authFailedRef.current) {
        return;
      }

      // Backoff: 8s, 16s, 32s, 64s (cap 60s)
      const base = intervalMs;
      const backoff =
        errorCountRef.current === 0
          ? base
          : Math.min(base * 2 ** errorCountRef.current, 60_000);

      timerId = setTimeout(async () => {
        await fetchRooms();
        schedule();  // jadwalkan berikutnya SETELAH fetch selesai
      }, backoff);
    };

    // 🌐 Visibility handler — resume saat tab aktif kembali
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !authFailedRef.current) {
        // Tab aktif lagi → fetch segera (jangan tunggu timer)
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        fetchRooms().then(() => schedule());
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    // 🚀 Kick-off
    fetchRooms().then(() => schedule());

    // 🧹 Cleanup
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timerId) clearTimeout(timerId);
      if (abortCtrl) abortCtrl.abort();
    };
  }, [token, intervalMs, refreshTrigger]);

  return { rooms, loading, refresh };
}