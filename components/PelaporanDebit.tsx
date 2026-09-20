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
  onClose?: () => void; // tidak dipakai → popup tidak bisa ditutup
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

const COL_LABEL: Record<NumericCol, string> = {
  limpasan:        'Limpasan',
  intakeKiri:      'Intake Kiri',
  intakeKanan:     'Intake Kanan',
  jumlah:          'Jumlah',
  kaliCipamingkis: 'Kali Cipamingkis',
  hujan:           'Hujan',
};

// ---- helpers ----
function toNumber(v: string): number | null {
  if (!v || !v.trim()) return null;
  const s = v.trim().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function fmt(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('id-ID', { maximumFractionDigits: 3 });
}

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function hourSlot(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function getHourLabel(jam: string) {
  const h = parseInt(jam.split(':')[0] ?? '0', 10);
  if (h < 6) return 'Malam';
  if (h < 12) return 'Pagi';
  if (h < 18) return 'Siang';
  return 'Sore';
}

export default function PelaporanDebit({
  buildingId,
  buildingName,
  userRole,
  onSuccess,
}: PelaporanDebitProps) {
  // ===== Waktu berjalan — tick tiap 30 detik =====
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const tanggal = useMemo(() => localDateStr(now), [now]);
  const currentHour = useMemo(() => hourSlot(now), [now]);

  const [row, setRow] = useState<DebitHourlyRow>(() => emptyDebitRow(hourSlot(new Date())));

  const { reports, loading, submitting, error, submit } = useDebitReport(buildingId);
  const allowed = canReportDebit(userRole);

  // Apakah jam ini sudah pernah dilaporkan?
  const existingForHour = useMemo(() => {
    const rep = reports.find((r) => r.tanggal === tanggal);
    return rep?.rows.find((r) => r.jam === currentHour) ?? null;
  }, [reports, tanggal, currentHour]);

  // Load data jam aktif saat tanggal / jam berubah
  useEffect(() => {
    const rep = reports.find((r) => r.tanggal === tanggal);
    const found = rep?.rows.find((r) => r.jam === currentHour);
    setRow(found ?? emptyDebitRow(currentHour));
  }, [tanggal, currentHour, reports]);

  // ===== UPDATE FIELD =====
  const updateField = (col: keyof DebitHourlyRow, value: string) => {
    setRow((prev) => {
      const next = { ...prev, [col]: value };
      if (col === 'intakeKiri' || col === 'intakeKanan') {
        const kiri = toNumber(next.intakeKiri);
        const kanan = toNumber(next.intakeKanan);
        if (kiri !== null && kanan !== null) {
          next.jumlah = (kiri + kanan).toLocaleString('id-ID', {
            maximumFractionDigits: 3,
          });
        }
      }
      return next;
    });
  };

  // ===== SUBMIT (merge dengan jam lain supaya tidak menimpa) =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowed) return toast.error('Role Anda tidak diizinkan melaporkan debit.');

    const hasAny =
      row.tma || row.limpasan || row.intakeKiri || row.intakeKanan ||
      row.kaliCipamingkis || row.hujan || row.keterangan;
    if (!hasAny) return toast.error('Belum ada data yang diisi.');

    // Bangun array penuh: ambil data existing tiap jam, ganti jam sekarang
    const existing = reports.find((r) => r.tanggal === tanggal);
    const fullRows: DebitHourlyRow[] = HOURS.map((h) => {
      if (h === currentHour) return row;
      return existing?.rows.find((r) => r.jam === h) ?? emptyDebitRow(h);
    });

    try {
      await submit(tanggal, fullRows);
      toast.success(`Laporan jam ${currentHour} berhasil disimpan!`);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan laporan.');
    }
  };

  const handleClear = () => {
    if (!confirm(`Kosongkan data jam ${currentHour}?`)) return;
    setRow(emptyDebitRow(currentHour));
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
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
              {buildingName}
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00c8ff]/15 text-[#00c8ff] border border-[#00c8ff]/30">
          {getRoleLabel(userRole)}
        </span>
      </div>

      {/* NOT-ALLOWED */}
      {!allowed && (
        <div className="m-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <i className="fa-solid fa-eye" />
          Role Anda hanya bisa melihat riwayat, tidak bisa mengisi / menyimpan laporan debit.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ===== PANEL JAM AKTIF ===== */}
        <div className="mx-3 mt-3 rounded-xl border border-[#00c8ff]/30 bg-gradient-to-r from-[#00c8ff]/10 to-transparent p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#00c8ff]/20 flex items-center justify-center">
                <i className="fa-solid fa-clock text-[#00c8ff] text-lg" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Jam Aktif · {getHourLabel(currentHour)}
                </div>
                <div className="font-mono text-xl font-bold text-[#1a1a2e] dark:text-white leading-none">
                  {currentHour}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Tanggal
              </div>
              <div className="font-mono text-sm font-semibold text-[#1a1a2e] dark:text-white">
                {new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <i className="fa-solid fa-circle-info text-[#00c8ff]" />
            Form otomatis mengikuti jam saat ini. Jam lain tidak dapat diisi manual.
          </p>

          {existingForHour && (
            <div className="mt-2 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[10px] flex items-center gap-1.5">
              <i className="fa-solid fa-triangle-exclamation" />
              Jam ini sudah pernah dilaporkan. Menyimpan akan menimpa data lama.
            </div>
          )}

          {loading && (
            <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
              <i className="fa-solid fa-spinner fa-spin" /> memuat data…
            </div>
          )}
        </div>

        {error && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 text-xs">
            {error}
          </div>
        )}

        {/* ===== FORM INPUT ===== */}
        <div className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field
              label="TMA"
              unit="m"
              value={row.tma}
              disabled={!allowed}
              onChange={(v) => updateField('tma', v)}
            />
            <Field
              label="Limpasan"
              unit="m³/detik"
              value={row.limpasan}
              disabled={!allowed}
              onChange={(v) => updateField('limpasan', v)}
            />
            <Field
              label="Intake Kiri"
              unit="m³/detik"
              value={row.intakeKiri}
              disabled={!allowed}
              onChange={(v) => updateField('intakeKiri', v)}
            />
            <Field
              label="Intake Kanan"
              unit="m³/detik"
              value={row.intakeKanan}
              disabled={!allowed}
              onChange={(v) => updateField('intakeKanan', v)}
            />
            <div>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                Jumlah <span className="text-gray-400">(auto)</span>
              </span>
              <div className="w-full px-3 py-2 text-sm font-mono font-bold rounded-md border border-[#00c8ff]/30 bg-[#00c8ff]/10 text-[#00c8ff] text-center">
                {row.jumlah || '—'}
              </div>
            </div>
            <Field
              label="Kali Cipamingkis"
              unit="m³/detik"
              value={row.kaliCipamingkis}
              disabled={!allowed}
              onChange={(v) => updateField('kaliCipamingkis', v)}
            />
            <Field
              label="Hujan"
              unit="mm"
              value={row.hujan}
              disabled={!allowed}
              onChange={(v) => updateField('hujan', v)}
            />
            <div className="col-span-2 md:col-span-2">
              <Field
                label="Keterangan"
                value={row.keterangan}
                disabled={!allowed}
                onChange={(v) => updateField('keterangan', v)}
              />
            </div>
          </div>
        </div>

        {/* ===== RINGKASAN SINGKAT ===== */}
        <div className="px-3 pb-3">
          <details className="rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-gray-50 dark:bg-[#0f0f23]">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 select-none">
              <i className="fa-solid fa-chart-simple text-[#00c8ff]" />
              Ringkasan Statistik Hari Ini
            </summary>
            <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {NUMERIC_COLS.map((col) => {
                const rep = reports.find((r) => r.tanggal === tanggal);
                const vals = (rep?.rows ?? [])
                  .map((r) => toNumber(r[col]))
                  .filter((n): n is number => n !== null);
                const mx = vals.length ? Math.max(...vals) : null;
                const mn = vals.length ? Math.min(...vals) : null;
                const av = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                return (
                  <div
                    key={col}
                    className="rounded-md bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] px-2 py-1.5"
                  >
                    <div className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 truncate">
                      {COL_LABEL[col]}
                    </div>
                    {av !== null ? (
                      <div className="space-y-0.5 text-[10px] font-mono leading-none">
                        <div className="flex justify-between text-green-500">
                          <span className="font-bold">Max</span><span>{fmt(mx!)}</span>
                        </div>
                        <div className="flex justify-between text-red-500">
                          <span className="font-bold">Min</span><span>{fmt(mn!)}</span>
                        </div>
                        <div className="flex justify-between text-blue-500">
                          <span className="font-bold">Avg</span><span>{fmt(av!)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-300 dark:text-gray-600 text-center py-1">
                        —
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        </div>

        {/* FOOTER / SUBMIT */}
        {allowed && (
          <div className="flex items-center justify-between gap-2 p-3 border-t border-gray-200 dark:border-[#2a2a4e]">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Kolom <span className="text-[#00c8ff] font-semibold">Jumlah</span> otomatis = Intake Kiri + Intake Kanan.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-[#2a2a4e] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#3a3a5e] text-xs font-medium transition"
              >
                <i className="fa-solid fa-eraser mr-1" /> Bersihkan
              </button>
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
                    <i className="fa-solid fa-floppy-disk" /> Simpan Jam {currentHour}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/* ============ SUB-KOMPONEN ============ */

function Field({
  label,
  unit,
  value,
  onChange,
  disabled,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
        {label}
        {unit && <span className="text-gray-400 dark:text-gray-500"> ({unit})</span>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm font-mono rounded-md border border-gray-300 dark:border-[#2a2a4e]
          bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white
          focus:outline-none focus:ring-2 focus:ring-[#00c8ff]/40 focus:border-[#00c8ff]
          disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </label>
  );
}