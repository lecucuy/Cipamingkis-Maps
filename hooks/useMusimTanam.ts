// hooks/useMusimTanam.ts
'use client';
import { useCallback, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useSession, signOut } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const MUSIM_TANAM_STATUS = {
  bibit:     { label: 'Bibit',                color: '#A3E635' },
  garap:     { label: 'Garap',                color: '#78350F' },
  tanam:     { label: 'Tanam',                color: '#16A34A' },
  panen:     { label: 'Panen',                color: '#EAB308' },
  tidak_ada: { label: 'Tidak Ada Aktivitas',  color: '#94A3B8' },
} as const;

export type MusimTanamStatus = keyof typeof MUSIM_TANAM_STATUS;

export interface MusimTanamReport {
  _id: string;
  polygon_id: string;
  polygon_name: string;
  periode_key: string;
  periode_start: string;
  periode_end: string;
  periode_label: string;
  status: MusimTanamStatus;
  luas_ha: number;
  keterangan: string;
  reporter_role: string;
}

export interface PeriodeInfo {
  key: string;
  start: string;
  end: string;
  label: string;
}

const COOLDOWN_MS = 60_000; // 60 detik

export function useMusimTanam() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<MusimTanamReport[]>([]);
  const [periodeInfo, setPeriodeInfo] = useState<{ current: PeriodeInfo; previous: PeriodeInfo } | null>(null);
  const [compare, setCompare] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<number>(0);

  const token = session?.accessToken;
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // ===== FETCH =====
const refresh = useCallback(async () => {
  if (!token) {
    console.warn('[useMusimTanam] No token, skip fetch');
    return;
  }
  setLoading(true);
  try {
    const [infoRes, reportRes, compareRes] = await Promise.all([
      axios.get(`${API_URL}/musim-tanam/periode-info`, { headers }),
      axios.get(`${API_URL}/musim-tanam/laporan`, { headers }),
      axios.get(`${API_URL}/musim-tanam/compare`, { headers }),
    ]);
    console.log('[useMusimTanam] Fetched OK:', {
      reports: reportRes.data.reports?.length,
      periode: infoRes.data.current?.key,
    });
    setPeriodeInfo({
      current: infoRes.data.current,
      previous: infoRes.data.previous,
    });
    setReports(reportRes.data.reports || []);
    setCompare(compareRes.data);
  } catch (err: any) {
    console.error('[useMusimTanam] fetch error:', err.response?.status, err.message);
    // 🔥 401 → paksa sign out
    if (err.response?.status === 401) {
      console.warn('[useMusimTanam] 401 — token expired, sign out');
      await signOut({ callbackUrl: '/login' });
      return;
    }
  } finally {
    setLoading(false);
  }
}, [token, headers]);



  // ===== MAP BY POLYGON =====
  const reportByPolygon = useMemo(() => {
    const map: Record<string, MusimTanamReport> = {};
    reports.forEach((r) => {
      map[r.polygon_id] = r;
    });
    return map;
  }, [reports]);

  // ===== SUBMIT =====
  const submit = useCallback(
    async (items: Array<{
      polygon_id: string;
      polygon_name: string;
      status: MusimTanamStatus;
      luas_ha: number;
      keterangan: string;
    }>) => {
      if (!token) throw new Error('Belum login');

      if (submitting) {
        console.warn('[useMusimTanam] submit diabaikan — masih submitting');
        throw new Error('Sedang menyimpan, tunggu sebentar…');
      }

      // 🔥 Cooldown 60 detik
      const elapsed = Date.now() - lastSubmittedAt;
      if (lastSubmittedAt > 0 && elapsed < COOLDOWN_MS) {
        const sisa = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        throw new Error(`Tunggu ${sisa} detik sebelum submit lagi.`);
      }

      setSubmitting(true);
      try {
        const res = await axios.post(
          `${API_URL}/musim-tanam/submit`,
          { items },
          { headers }
        );
        setLastSubmittedAt(Date.now());
        await refresh();
        return res.data;
      } finally {
        setSubmitting(false);
      }
    },
    [token, refresh, headers, submitting, lastSubmittedAt]
  );

  return {
    reports,
    reportByPolygon,
    periodeInfo,
    compare,
    loading,
    submitting,
    submit,
    refresh,
  };
}