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

type AuthFailReason = null | 'unauthenticated' | 'forbidden';

export function useLiveRooms(token?: string, intervalMs = 8000) {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const inflightRef = useRef<AbortController | null>(null);
  const errorCountRef = useRef(0);
  const authFailedRef = useRef<AuthFailReason>(null);

  const refresh = useCallback(() => {
    errorCountRef.current = 0;
    authFailedRef.current = null;
    setRefreshTrigger((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!REALTIME_URL) return;

    authFailedRef.current = null;

    let stopped = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let generation = 0;

    const isVisible = () =>
      typeof document === 'undefined' ||
      document.visibilityState === 'visible';

    // Backoff + jitter (hindari thundering herd)
    const computeDelay = () => {
      const errs = errorCountRef.current;
      const jitter = Math.random() * 2000;
      if (errs === 0) return intervalMs + jitter;
      const base = Math.min(intervalMs * 2 ** errs, 60_000);
      return base + jitter;
    };

    const fetchRooms = async (gen: number) => {
      if (authFailedRef.current) return;
      if (!isVisible()) return;

      // abort request sebelumnya (kalau ada) — pakai ctrl lokal
      if (inflightRef.current) {
        inflightRef.current.abort();
        inflightRef.current = null;
      }
      const ctrl = new AbortController();
      inflightRef.current = ctrl;

      setLoading(true);

      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await axios.get(`${REALTIME_URL}/live/active`, {
          headers,
          signal: ctrl.signal,
          timeout: 10_000,
        });

        if (stopped || gen !== generation) return;
        setRooms(res.data?.items || []);
        errorCountRef.current = 0;
      } catch (e: any) {
        if (
          axios.isCancel(e) ||
          e.name === 'CanceledError' ||
          e.name === 'AbortError'
        ) {
          return;
        }
        if (stopped || gen !== generation) return;

        const status = e.response?.status;

        if (status === 401) {
          authFailedRef.current = 'unauthenticated';
          setRooms([]);
          console.warn('[useLiveRooms] 401 — polling paused (login ulang)');
        } else if (status === 403) {
          authFailedRef.current = 'forbidden';
          setRooms([]);
          console.warn('[useLiveRooms] 403 — polling paused (refresh utk resume)');
        } else {
          errorCountRef.current += 1;
          console.warn(
            `[useLiveRooms] fetch error #${errorCountRef.current} ` +
              `status=${status ?? 'network'}: ${e.message}`,
          );
        }
      } finally {
        if (inflightRef.current === ctrl) inflightRef.current = null;
        if (!stopped && gen === generation) setLoading(false);
      }
    };

    const loop = async (gen: number) => {
      if (stopped || gen !== generation) return;
      if (authFailedRef.current) return;

      // tab hidden → cek lagi 5s, nggak fetch
      if (!isVisible()) {
        timerId = setTimeout(() => loop(gen), 5000);
        return;
      }

      await fetchRooms(gen);

      if (stopped || gen !== generation) return;
      if (authFailedRef.current) return;

      timerId = setTimeout(() => loop(gen), computeDelay());
    };

    // Kick = invalidate chain lama + mulai chain baru
    const kick = () => {
      generation++;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      loop(generation);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') kick();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    kick();

    return () => {
      stopped = true;
      generation++;                          // invalidate semua chain aktif
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (inflightRef.current) {
        inflightRef.current.abort();
        inflightRef.current = null;
      }
    };
  }, [token, intervalMs, refreshTrigger]);

  return { rooms, loading, refresh };
}