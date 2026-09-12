// components/PelaporanDebit.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  DebitHourlyRow,
  HOURS,
  canReportDebit,
  emptyDebitRow,
  getRoleLabel,
} from '@/types/pelaporan';
import { useDebitReport } from '@/hooks/useDebitReport';

interface PelaporanDebitProps {
  buildingId: string;
  buildingName: string;
  userRole?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

const NUMERIC_COLS = [
  'limpasan',
  'intakeKiri',
  'intakeKanan',
  'jumlah',
  'kaliCipamingkis',
  'hujan',
] as const;
type NumericCol = typeof NUMERIC_COLS[number];

// Parsing angka toleran: "5,570" / "5.570" / "12"
function toNumber(v: string): number | null {
  if (!v || !v.trim()) return null;
  const s = v.trim().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

// Format ringkas: 5.57 -> "5,57" ; 8.603 -> "8,603"
function fmt(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('id-ID', { maximumFractionDigits: 3 });
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PelaporanDebit({
  buildingId,
  buildingName,
  userRole,
  onSuccess,
  onClose,
}: PelaporanDebitProps) {
  const [tanggal, setTanggal] = useState(todayISO());
  const [rows, setRows] = useState<DebitHourlyRow[]>(() => HOURS.map(emptyDebitRow));

  const { reports, loading, submitting, error, submit, refresh } = useDebitReport(buildingId);
  const allowed = canReportDebit(userRole);

  // Load laporan existing saat tanggal berubah
  useEffect(() => {
    const existing = reports.find((r) => r.tanggal === tanggal);
    if (existing) {
      const map = new Map(existing.rows.map((r) => [r.jam, r]));
      setRows(HOURS.map((h) => map.get(h) ?? emptyDebitRow(h)));
    } else {
      setRows(HOURS.map(emptyDebitRow));
    }
  }, [tanggal, reports]);

  // ===== SUMMARY (Max / Min / Rata-rata) =====
  const summary = useMemo(() => {
    const max: Partial<Record<NumericCol, number>> = {};
    const min: Partial<Record<NumericCol, number>> = {};
    const avg: Partial<Record<NumericCol, number>> = {};

    for (const col of NUMERIC_COLS) {
      const vals = rows
        .map((r) => toNumber(r[col]))
        .filter((n): n is number => n !== null);
      if (vals.length === 0) continue;
      max[col] = Math.max(...vals);
      min[col] = Math.min(...vals);
      avg[col] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return { max, min, avg };
  }, [rows]);

  // ===== UPDATE CELL =====
  const updateCell = (
    rowIdx: number,
    col: keyof DebitHourlyRow,
    value: string
  ) => {
    setRows((prev) => {
      const copy = [...prev];
      const row = { ...copy[rowIdx], [col]: value };

      // Auto-hitung "Jumlah" = Intake Kiri + Intake Kanan
      if (col === 'intakeKiri' || col === 'intakeKanan') {
        const kiri = toNumber(row.intakeKiri);
        const kanan = toNumber(row.intakeKanan);
        if (kiri !== null && kanan !== null) {
          row.jumlah = (kiri + kanan).toLocaleString('id-ID', {
            maximumFractionDigits: 3,
          });
        }
      }
      copy[rowIdx] = row;
      return copy;
    });
  };

  // ===== SUBMIT =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowed) return toast.error('Role Anda tidak diizinkan melaporkan debit.');
    if (!tanggal) return toast.error('Tanggal wajib diisi.');

    // Cek minimal ada 1 baris terisi
    const hasAny = rows.some(
      (r) =>
        r.limpasan || r.intakeKiri || r.intakeKanan ||
        r.kaliCipamingkis || r.hujan || r.keterangan
    );
    if (!hasAny) return toast.error('Belum ada data yang diisi.');

    try {
      await submit(tanggal, rows);
      toast.success('Laporan debit harian berhasil disimpan!');
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan laporan.');
    }
  };

  const handleClear = () => {
    if (!confirm('Kosongkan semua data pada tabel?')) return;
    setRows(HOURS.map(emptyDebitRow));
  };

  // ===== RENDER =====
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#1a1a2e] shadow-lg overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2a2a4e] bg-gradient-to-r from-[#00c8ff]/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#00c8ff]/15 flex items-center justify-center">
            <i className="fa-solid fa-gauge-high text-[#00c8ff]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-white">
              Laporan Debit Harian
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
              {buildingName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00c8ff]/15 text-[#00c8ff] border border-[#00c8ff]/30">
            {getRoleLabel(userRole)}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500 dark:text-gray-400"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
      </div>

      {/* NOT-ALLOWED NOTICE */}
      {!allowed && (
        <div className="m-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <i className="fa-solid fa-eye" />
          Role Anda hanya bisa melihat riwayat, tidak bisa mengisi / menyimpan laporan debit.
        </div>
      )}

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-[#2a2a4e] bg-gray-50 dark:bg-[#0f0f23]">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-gray-500 dark:text-gray-400">Tanggal:</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#1a1a2e] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
          />
        </div>
        {loading && (
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <i className="fa-solid fa-spinner fa-spin" /> memuat…
          </span>
        )}
        <div className="flex-1" />
        {allowed && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2.5 py-1 text-[11px] rounded-md bg-gray-200 dark:bg-[#2a2a4e] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#3a3a5e] transition"
          >
            <i className="fa-solid fa-eraser mr-1" /> Bersihkan
          </button>
        )}
      </div>

      {error && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 text-xs">
          {error}
        </div>
      )}

      {/* ====== TABLE ====== */}
      <form onSubmit={handleSubmit}>
        <div className="overflow-auto max-h-[65vh]">
          <table className="min-w-[820px] w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              {/* Baris grup header */}
              <tr className="bg-[#00c8ff]/10 text-[#1a1a2e] dark:text-white">
                <th rowSpan={2} className="px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] font-semibold">JAM</th>
                <th rowSpan={2} className="px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] font-semibold">
                  TMA<br /><span className="text-[9px] font-normal opacity-70">(m)</span>
                </th>
                <th className="px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] font-semibold">
                  Jumlah Debit
                </th>
                <th colSpan={3} className="px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] font-semibold">
                  Debit Yang Dimanfaatkan
                </th>
                <th className="px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] font-semibold">
                  Debit Tersedia
                </th>
                <th className="px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] font-semibold">
                  Curah Hujan
                </th>
                <th rowSpan={2} className="px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] font-semibold">
                  Keterangan
                </th>
              </tr>
              {/* Baris sub-header */}
              <tr className="bg-[#00c8ff]/10 text-[#1a1a2e] dark:text-white">
                <th className="px-2 py-1 border border-gray-200 dark:border-[#2a2a4e] font-medium">
                  Limpasan<br /><span className="text-[9px] font-normal opacity-70">(m³/detik)</span>
                </th>
                <th className="px-2 py-1 border border-gray-200 dark:border-[#2a2a4e] font-medium">
                  Ke Intake Kiri
                </th>
                <th className="px-2 py-1 border border-gray-200 dark:border-[#2a2a4e] font-medium">
                  Ke Intake Kanan
                </th>
                <th className="px-2 py-1 border border-gray-200 dark:border-[#2a2a4e] font-medium">
                  Jumlah<br /><span className="text-[9px] font-normal opacity-70">(m³/detik)</span>
                </th>
                <th className="px-2 py-1 border border-gray-200 dark:border-[#2a2a4e] font-medium">
                  Di Kali Cipamingkis<br /><span className="text-[9px] font-normal opacity-70">(m³/detik)</span>
                </th>
                <th className="px-2 py-1 border border-gray-200 dark:border-[#2a2a4e] font-medium">
                  Hujan<br /><span className="text-[9px] font-normal opacity-70">(mm)</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.jam}
                  className={idx % 2 ? 'bg-gray-50/50 dark:bg-[#0f0f23]/40' : ''}
                >
                  <td className="px-2 py-1 border border-gray-200 dark:border-[#2a2a4e] font-mono text-gray-700 dark:text-gray-300 text-center">
                    {row.jam}
                  </td>

                  {/* TMA */}
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-[#2a2a4e]">
                    <CellInput
                      value={row.tma}
                      disabled={!allowed}
                      onChange={(v) => updateCell(idx, 'tma', v)}
                      width="w-16"
                    />
                  </td>

                  {/* Limpasan */}
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-[#2a2a4e]">
                    <CellInput
                      value={row.limpasan}
                      disabled={!allowed}
                      onChange={(v) => updateCell(idx, 'limpasan', v)}
                      width="w-14"
                    />
                  </td>

                  {/* Intake Kiri */}
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-[#2a2a4e]">
                    <CellInput
                      value={row.intakeKiri}
                      disabled={!allowed}
                      onChange={(v) => updateCell(idx, 'intakeKiri', v)}
                      width="w-16"
                    />
                  </td>

                  {/* Intake Kanan */}
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-[#2a2a4e]">
                    <CellInput
                      value={row.intakeKanan}
                      disabled={!allowed}
                      onChange={(v) => updateCell(idx, 'intakeKanan', v)}
                      width="w-16"
                    />
                  </td>

                  {/* Jumlah (readonly, auto) */}
                  <td className="px-2 py-1 border border-gray-200 dark:border-[#2a2a4e] text-center font-mono text-[#00c8ff] font-semibold">
                    {row.jumlah || '—'}
                  </td>

                  {/* Kali Cipamingkis */}
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-[#2a2a4e]">
                    <CellInput
                      value={row.kaliCipamingkis}
                      disabled={!allowed}
                      onChange={(v) => updateCell(idx, 'kaliCipamingkis', v)}
                      width="w-16"
                    />
                  </td>

                  {/* Hujan */}
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-[#2a2a4e]">
                    <CellInput
                      value={row.hujan}
                      disabled={!allowed}
                      onChange={(v) => updateCell(idx, 'hujan', v)}
                      width="w-14"
                    />
                  </td>

                  {/* Keterangan */}
                  <td className="px-1 py-0.5 border border-gray-200 dark:border-[#2a2a4e]">
                    <CellInput
                      value={row.keterangan}
                      disabled={!allowed}
                      onChange={(v) => updateCell(idx, 'keterangan', v)}
                      width="w-24"
                    />
                  </td>
                </tr>
              ))}

              {/* ===== MAX / MIN / RATA-RATA ===== */}
              <SummaryRow label="Max" values={summary.max} accent="text-green-600 dark:text-green-400" />
              <SummaryRow label="Min" values={summary.min} accent="text-red-600 dark:text-red-400" />
              <SummaryRow label="Rata-rata" values={summary.avg} accent="text-blue-600 dark:text-blue-400" />
            </tbody>
          </table>
        </div>

        {/* FOOTER / SUBMIT */}
        {allowed && (
          <div className="flex items-center justify-between gap-2 p-3 border-t border-gray-200 dark:border-[#2a2a4e]">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Kolom <span className="text-[#00c8ff] font-semibold">Jumlah</span> otomatis = Intake Kiri + Intake Kanan.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-white text-xs font-medium transition shadow-lg shadow-[#00c8ff]/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" /> Menyimpan…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" /> Simpan Laporan
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

/* ============ SUB-KOMPONEN ============ */

function CellInput({
  value,
  onChange,
  disabled,
  width = 'w-full',
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  width?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${width} mx-auto block px-1.5 py-0.5 text-[11px] text-center font-mono rounded border border-transparent bg-transparent text-[#1a1a2e] dark:text-white focus:outline-none focus:bg-white dark:focus:bg-[#0f0f23] focus:border-[#00c8ff] disabled:opacity-70 disabled:cursor-not-allowed`}
    />
  );
}

function SummaryRow({
  label,
  values,
  accent,
}: {
  label: string;
  values: Partial<Record<NumericCol, number>>;
  accent: string;
}) {
  const cell = (col: NumericCol) => (
    <td className={`px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] text-center font-mono font-semibold ${accent}`}>
      {values[col] !== undefined ? fmt(values[col]!) : '—'}
    </td>
  );

  return (
    <tr className="bg-gray-100 dark:bg-[#0f0f23]">
      <td colSpan={2} className={`px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] text-right font-semibold ${accent}`}>
        {label}
      </td>
      {/* Limpasan */}
      <td className="px-2 py-1.5 border border-gray-200 dark:border-[#2a2a4e] text-center text-gray-400">—</td>
      {cell('intakeKiri')}
      {cell('intakeKanan')}
      {cell('jumlah')}
      {cell('kaliCipamingkis')}
      {cell('hujan')}
      <td className="border border-gray-200 dark:border-[#2a2a4e]" />
    </tr>
  );
}