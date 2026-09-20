// hooks/useLatestDebits.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface LatestDebit {
  buildingId: string;
  tanggal: string;
  jam: string;
  debit: number;
  limpasan: number;
  intakeKiri: number;
  intakeKanan: number;
  jumlah: number;
}

function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function useLatestDebits(buildingIds: string[]) {
  const { data: session } = useSession();
  const [debits, setDebits] = useState<Record<string, LatestDebit>>({});

  const idsKey = buildingIds.slice().sort().join('|');

  const fetchAll = useCallback(async () => {
    if (!session?.accessToken) {
      console.warn('[useLatestDebits] Skip — belum login');
      return;
    }
    if (!idsKey) {
      console.warn('[useLatestDebits] Skip — gak ada bendung');
      return;
    }

    const ids = idsKey.split('|');
    console.log('[useLatestDebits] Fetching bendung:', ids);

    const results: Record<string, LatestDebit> = {};

    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await axios.get(
            `${API_URL}/buildings/${encodeURIComponent(id)}/debit`,
            {
              params: { limit: 5 },
              headers: { Authorization: `Bearer ${session.accessToken}` },
            }
          );

          const reports = res.data?.reports || [];
          console.log(`[useLatestDebits] ${id} → ${reports.length} reports`);

          if (!reports.length) return;

          // Ambil report terbaru (backend sudah sort DESC by tanggal)
          const latest = reports[0];
          const rows = latest.rows || [];

          // Ambil row yang ada datanya — cek SEMUA kolom, bukan cuma intake
          const filled = rows.filter(
            (r: any) =>
              r.tma ||
              r.limpasan ||
              r.intakeKiri ||
              r.intakeKanan ||
              r.jumlah ||
              r.kaliCipamingkis ||
              r.hujan ||
              r.keterangan
          );

          if (!filled.length) {
            console.warn(`[useLatestDebits] ${id} — rows kosong`);
            return;
          }

          // Ambil row paling akhir yang ada datanya (jam terakhir diisi)
          const lastRow = filled[filled.length - 1];

          const kiri = toNumber(lastRow.intakeKiri);
          const kanan = toNumber(lastRow.intakeKanan);
          const jumlah = toNumber(lastRow.jumlah);
          const limpasan = toNumber(lastRow.limpasan);

          // Fallback: kalau jumlah 0, pakai intake kiri+kanan, atau limpasan
          const debit = jumlah || (kiri + kanan) || limpasan;

          console.log(`[useLatestDebits] ${id} → debit=${debit} (jumlah=${jumlah}, kiri=${kiri}, kanan=${kanan}, limpasan=${limpasan})`);

          results[id] = {
            buildingId: id,
            tanggal: latest.tanggal,
            jam: lastRow.jam || '',
            debit,
            limpasan,
            intakeKiri: kiri,
            intakeKanan: kanan,
            jumlah,
          };
        } catch (err: any) {
          console.error(
            `[useLatestDebits] Gagal fetch ${id}:`,
            err.response?.data?.detail || err.message
          );
        }
      })
    );

    console.log('[useLatestDebits] Hasil akhir:', results);
    setDebits(results);
  }, [session?.accessToken, idsKey]);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 60_000);
    return () => clearInterval(t);
  }, [fetchAll]);

  return debits;
}