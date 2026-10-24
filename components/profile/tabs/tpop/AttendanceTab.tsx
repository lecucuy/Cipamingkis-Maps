'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL!;

type DayStatus =
  | 'present' | 'late' | 'missed'
  | 'no_plan' | 'sunday' | 'future' | null;

interface DayEntry {
  date: string;
  day: number;
  day_of_week: number;      // 0=Sen .. 6=Min
  is_sunday: boolean;
  is_today: boolean;
  is_future: boolean;
  status: DayStatus;
  plan_id: string | null;
  plan_title: string | null;
  check_in_at: string | null;
  selfie_url: string | null;
}

interface Stats {
  planned: number;
  attended: number;
  present: number;
  late: number;
  missed: number;
  future: number;
  no_plan: number;
  sunday: number;
  total_workdays: number;
  progress: number;
  perfect_month: boolean;
}

interface Summary {
  year: number;
  month: number;
  month_label: string;
  today: string;
  stats: Stats;
  days: DayEntry[];
}

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const STATUS_STYLE: Record<string, {
  bg: string; text: string; icon: string; label: string;
}> = {
  present:  { bg: 'bg-emerald-500/15', text: 'text-emerald-500', icon: 'fa-circle-check',       label: 'Hadir' },
  late:     { bg: 'bg-amber-500/15',   text: 'text-amber-500',   icon: 'fa-clock',              label: 'Telat' },
  missed:   { bg: 'bg-red-500/15',     text: 'text-red-500',     icon: 'fa-circle-xmark',       label: 'Alpa' },
  no_plan:  { bg: 'bg-gray-200/50 dark:bg-white/5', text: 'text-gray-400', icon: 'fa-minus',   label: 'Tanpa rencana' },
  sunday:   { bg: 'bg-gray-100 dark:bg-white/5',    text: 'text-gray-400', icon: 'fa-mug-hot', label: 'Libur' },
  future:   { bg: 'bg-[#00c8ff]/10',  text: 'text-[#00c8ff]',   icon: 'fa-hourglass-half',     label: 'Akan datang' },
};

export default function AttendanceTab() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData]   = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API}/api/tpop/attendance/monthly-summary?year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setData)
      .catch(() => toast.error('Gagal memuat rekap kehadiran'))
      .finally(() => setLoading(false));
  }, [token, year, month]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  // Offset: hari pertama dalam bulan, dipetakan ke kolom Sen=0..Min=6
  const firstOffset = useMemo(() => {
    if (!data) return 0;
    // day_of_week dari backend 0=Sen..6=Min → sama dengan kolom
    return data.days[0]?.day_of_week ?? 0;
  }, [data]);

  const stats  = data?.stats;
  const isFull = (stats?.progress ?? 0) >= 100;

  return (
    <div className="space-y-4">
      {/* Banner: absen hanya via mobile */}
      <div className="rounded-xl border border-[#00c8ff]/30 bg-[#00c8ff]/5 p-3 flex items-start gap-3">
        <i className="fa-solid fa-mobile-screen text-[#00c8ff] mt-0.5"></i>
        <div className="text-xs text-gray-600 dark:text-gray-300">
          <p className="font-medium text-[#1a1a2e] dark:text-white">
            Absensi dilakukan via aplikasi mobile
          </p>
          <p>Halaman ini untuk melihat rekap kehadiran Anda bulan ini.</p>
        </div>
      </div>

      {/* Header: navigasi bulan */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => shiftMonth(-1)}
          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#0f0f23] hover:bg-gray-200 dark:hover:bg-[#1a1a2e] flex items-center justify-center"
        >
          <i className="fa-solid fa-chevron-left text-xs"></i>
        </button>
        <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-white">
          {data?.month_label || `${year}-${month}`}
        </h3>
        <button
          onClick={() => shiftMonth(1)}
          disabled={
            year > now.getFullYear() ||
            (year === now.getFullYear() && month >= now.getMonth() + 1)
          }
          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#0f0f23] hover:bg-gray-200 dark:hover:bg-[#1a1a2e] flex items-center justify-center disabled:opacity-30"
        >
          <i className="fa-solid fa-chevron-right text-xs"></i>
        </button>
      </div>

      {/* Progress card */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !data || !stats ? (
        <div className="text-center py-10 text-gray-400 text-sm">Tidak ada data</div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-4">
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">
                  Progress Kehadiran
                </p>
                <p className="text-2xl font-bold text-[#1a1a2e] dark:text-white">
                  {stats.progress.toFixed(1)}%
                  {stats.perfect_month && (
                    <span className="ml-2 text-xs align-middle px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                      🏆 Bulan Sempurna
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right text-[10px] text-gray-400">
                <p>{stats.attended}/{stats.planned} hari hadir</p>
                <p>{stats.missed} alpa · {stats.future} akan datang</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-[#1a1a2e] overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isFull ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#00c8ff] to-[#a855f7]'
                }`}
                style={{ width: `${Math.min(stats.progress, 100)}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <Stat label="Hadir"   value={stats.present}  color="text-emerald-500" />
              <Stat label="Telat"   value={stats.late}     color="text-amber-500" />
              <Stat label="Alpa"    value={stats.missed}   color="text-red-500" />
              <Stat label="Libur"   value={stats.sunday}   color="text-gray-400" />
            </div>
          </div>

          {/* Calendar */}
          <div className="rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-3">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={`text-[10px] text-center font-semibold ${
                    i === 6 ? 'text-red-400' : 'text-gray-400'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Placeholder sebelum tanggal 1 */}
              {Array.from({ length: firstOffset }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}

              {data.days.map((d) => {
                const s = STATUS_STYLE[d.status || 'no_plan'] || STATUS_STYLE.no_plan;
                return (
                  <DayCell key={d.date} day={d} s={s} />
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#2a2a4e] flex flex-wrap gap-x-3 gap-y-1.5 text-[10px]">
              {(['present', 'late', 'missed', 'sunday', 'no_plan', 'future'] as const).map(k => (
                <span key={k} className="flex items-center gap-1 text-gray-500">
                  <span className={`w-2 h-2 rounded-sm ${STATUS_STYLE[k].bg} border border-current/20 ${STATUS_STYLE[k].text}`} />
                  {STATUS_STYLE[k].label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-gray-400 uppercase">{label}</p>
    </div>
  );
}

function DayCell({ day, s }: { day: DayEntry; s: typeof STATUS_STYLE[string] }) {
  const showIcon = day.status && day.status !== 'future' && day.status !== 'no_plan';
  return (
    <div
      title={day.plan_title || s.label}
      className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center text-[10px] transition
        ${s.bg} ${s.text}
        ${day.is_today
          ? 'border-[#00c8ff] ring-2 ring-[#00c8ff]/30'
          : 'border-transparent'}
        ${day.status === 'sunday' ? 'opacity-70' : ''}
      `}
    >
      <span className={`text-[11px] font-semibold ${day.is_today ? 'text-[#00c8ff]' : ''}`}>
        {day.day}
      </span>
      {showIcon && <i className={`fa-solid ${s.icon} text-[8px] mt-0.5`} />}
      {day.selfie_url && (
        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
      )}
    </div>
  );
}