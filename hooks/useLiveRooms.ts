//hooks/useLiveRooms.ts
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

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

  const refresh = useCallback(() => setRefreshTrigger(k => k + 1), []);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL;
    if (!API) return;
    let stop = false;

    const fetchRooms = async () => {
      if (stop) return;
      setLoading(true);
      try {
        // Kirim token KALAU ADA, tapi tetap jalan tanpa token
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await axios.get(`${API}/live/active`, { headers });
        if (!stop) setRooms(res.data?.items || []);
      } catch (e: any) {
        // Jangan kosongkan rooms kalau cuma network hiccup
        const s = e.response?.status;
        if (s === 401 || s === 403) {
          // token expired → kosongkan
          if (!stop) setRooms([]);
        } else {
          console.warn('[useLiveRooms] fetch error:', e.message);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    };

    fetchRooms();
    const id = setInterval(fetchRooms, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [token, intervalMs, refreshTrigger]);

  return { rooms, loading, refresh };
}