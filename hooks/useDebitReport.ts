// hooks/useDebitReport.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { DebitDailyReport, DebitHourlyRow } from '@/types/pelaporan';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface UseDebitReportResult {
  reports: DebitDailyReport[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  submit: (tanggal: string, rows: DebitHourlyRow[]) => Promise<DebitDailyReport>;
  refresh: () => Promise<void>;
}

export function useDebitReport(buildingId: string): UseDebitReportResult {
  const [reports, setReports] = useState<DebitDailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${API_URL}/buildings/${encodeURIComponent(buildingId)}/debit`
      );
      const list: DebitDailyReport[] = Array.isArray(res.data)
        ? res.data
        : res.data?.reports ?? [];
      list.sort(
        (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
      );
      setReports(list);
    } catch (err: any) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.detail || err.message || 'Gagal memuat laporan debit');
      }
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => { refresh(); }, [refresh]);

  const submit = useCallback(
    async (tanggal: string, rows: DebitHourlyRow[]) => {
      if (!buildingId) throw new Error('buildingId kosong');
      setSubmitting(true);
      setError(null);
      try {
        const res = await axios.post(
          `${API_URL}/buildings/${encodeURIComponent(buildingId)}/debit`,
          { tanggal, rows }
        );
        await refresh();
        return res.data as DebitDailyReport;
      } catch (err: any) {
        const msg =
          err.response?.data?.detail || err.message || 'Gagal menyimpan laporan debit';
        setError(msg);
        throw new Error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [buildingId, refresh]
  );

  return { reports, loading, submitting, error, submit, refresh };
}