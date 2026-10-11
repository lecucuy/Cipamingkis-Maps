// hooks/useLatestDebits.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface DebitRow {
  jam: string;
  tma: string;
  limpasan: string;
  intakeKiri: string;
  intakeKanan: string;
  jumlah: string;
  kaliCipamingkis: string;
  hujan: string;
  keterangan: string;
}

export interface DebitFlowInfo {
  buildingId: string;
  debit: number;
  tanggal: string;
  jam: string;
  row: DebitRow;
}

// ============================================================
// 🔥 Cek row punya minimal 1 field berisi
// ============================================================
const isValidRow = (r: any): boolean =>
  ['tma', 'limpasan', 'intakeKiri', 'intakeKanan', 'jumlah',
   'kaliCipamingkis', 'hujan', 'keterangan']
    .some((k) => {
      const v = r?.[k];
      if (v === null || v === undefined) return false;
      const s = String(v).trim();
      return s !== '' && s !== '-';
    });

// ============================================================
// 🔥 Hitung debit dari 1 row
// ============================================================
function computeDebit(lastRow: DebitRow): number {
  const num = (v: any) => {
    if (v === null || v === undefined) return 0;
    const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const jumlah = num(lastRow.jumlah);
  if (jumlah > 0) return jumlah;
  return num(lastRow.limpasan) + num(lastRow.intakeKiri) + num(lastRow.intakeKanan);
}

// ============================================================
// MAIN HOOK
// ============================================================
export function useLatestDebits(
  buildingIds: string[],
  options?: { pollMs?: number }
) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const [latestDebits, setLatestDebits] = useState<Record<string, DebitFlowInfo>>({});

  const buildingIdsRef = useRef<string[]>([]);
  buildingIdsRef.current = buildingIds;

  const fetchAll = async () => {
    const ids = buildingIdsRef.current;
    if (!ids || ids.length === 0) {
      setLatestDebits({});
      return;
    }

    // ⛔ Skip kalau belum login / session masih loading
    if (status === 'loading') return;
    const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;


    const result: Record<string, DebitFlowInfo> = {};

    // 🔥 Fetch serial biar log-nya kebaca (ganti ke Promise.all kalau banyak banget)
    for (const buildingId of ids) {
      try {
        const res = await axios.get(
                `${API_URL}/buildings/${encodeURIComponent(buildingId)}/debit`,
                {
                  params: { limit: 30 },
                  headers,          // ← kalau belum login, headers kosong, tetap fetch
                  timeout: 10000,
                }
              );

        const reports: any[] = Array.isArray(res.data)
          ? res.data
          : res.data?.reports ?? [];

        if (reports.length === 0) {
          console.log(`[useLatestDebits] ${buildingId} — belum ada report`);
          continue;
        }

        // Sort DESC by tanggal (backend harusnya udah, tapi kita pastikan)
        const sorted = [...reports].sort(
          (a, b) =>
            new Date(b.tanggal || 0).getTime() -
            new Date(a.tanggal || 0).getTime()
        );

        // 🔥 Cari report terbaru yang PUNYA minimal 1 row berisi
        let picked: { tanggal: string; rows: DebitRow[] } | null = null;
        for (const rep of sorted) {
          const rowsRaw: DebitRow[] = Array.isArray(rep.rows) ? rep.rows : [];
          const validRows = rowsRaw.filter(isValidRow);
          if (validRows.length > 0) {
            picked = { tanggal: rep.tanggal, rows: validRows };
            break;
          }
        }

        if (!picked) {
          console.log(`[useLatestDebits] ${buildingId} — semua rows kosong`);
          continue;
        }

        // Ambil row jam paling akhir (data terbaru di hari itu)
        const sortedRows = [...picked.rows].sort((a, b) =>
          String(a.jam).localeCompare(String(b.jam))
        );
        const lastRow = sortedRows[sortedRows.length - 1];

        // Hitung debit
        const debit = computeDebit(lastRow);

        console.log(
          `[useLatestDebits] ${buildingId} → ${picked.tanggal} ${lastRow.jam} debit=${debit}`
        );

        result[buildingId] = {
          buildingId,
          debit,
          tanggal: picked.tanggal,
          jam: lastRow.jam,
          row: lastRow,
        };
      } catch (err: any) {
        if (err.response?.status === 404) {
          console.log(`[useLatestDebits] ${buildingId} — 404`);
        } else if (err.response?.status === 401) {
          console.warn(`[useLatestDebits] ${buildingId} — 401 unauthorized`);
        } else {
          console.warn(
            `[useLatestDebits] ${buildingId} — error:`,
            err.response?.status || err.message
          );
        }
      }
    }

    setLatestDebits(result);
  };

  // Initial + polling
  useEffect(() => {
    if (status === 'loading') return;

    fetchAll();

    const pollMs = options?.pollMs ?? 60_000;
    const interval = setInterval(fetchAll, pollMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(buildingIds), token, status, options?.pollMs]);

  return { latestDebits, refresh: fetchAll };
}

export default useLatestDebits;