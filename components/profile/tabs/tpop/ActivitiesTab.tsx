'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL!;

interface WeeklySummary {
  week_key: string;
  week_start: string;
  week_end: string;
  target: number;
  completed: number;
  remaining: number;
  progress: number;
  achieved: boolean;
  days: {
    date: string;
    day_of_week: number;
    is_sunday: boolean;
    is_today: boolean;
    is_future: boolean;
    activity_count: number;
    activities: any[];
  }[];
}

const TYPE_ICON: Record<string, string> = {
  perbaikan: '🔧', babad: '🌿', ngecat: '🎨', lainnya: '📋',
};
const TYPE_LABEL: Record<string, string> = {
  perbaikan: 'Perbaikan', babad: 'Babad', ngecat: 'Ngecat', lainnya: 'Lainnya',
};
const WEEKDAY = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function ActivitiesTab() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [weekKey, setWeekKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (wk?: string) => {
    if (!token) return;
    setLoading(true);
    const url = wk
      ? `${API}/api/tpop/activities/weekly-summary?week_key=${wk}`
      : `${API}/api/tpop/activities/weekly-summary`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setSummary)
      .catch(() => toast.error('Gagal memuat rekap kegiatan'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-7 h-7 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!summary) {
    return <div className="text-center py-10 text-gray-400 text-sm">Tidak ada data</div>;
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-xl border border-[#00c8ff]/30 bg-[#00c8ff]/5 p-3 flex items-start gap-3">
        <i className="fa-solid fa-mobile-screen text-[#00c8ff] mt-0.5"></i>
        <div className="text-xs text-gray-600 dark:text-gray-300">
          <p className="font-medium text-[#1a1a2e] dark:text-white">
            Upload kegiatan via aplikasi mobile
          </p>
          <p>Halaman ini untuk melihat progress kegiatan mingguan Anda.</p>
        </div>
      </div>

      {/* Progress card */}
      <div className="rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Kegiatan Minggu Ini
            </p>
            <p className="text-2xl font-bold text-[#1a1a2e] dark:text-white">
              {summary.completed}/{summary.target}
              {summary.achieved && (
                <span className="ml-2 text-xs align-middle px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                  🎯 Tercapai
                </span>
              )}
            </p>
          </div>
          <div className="text-right text-[10px] text-gray-400">
            <p>{new Date(summary.week_start).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              {' — '}
              {new Date(summary.week_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
            <p>{summary.remaining > 0 ? `Kurang ${summary.remaining} lagi` : '✅ Target tercapai'}</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-[#1a1a2e] overflow-hidden">
          <div
            className={`h-full transition-all ${
              summary.achieved ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#00c8ff] to-[#a855f7]'
            }`}
            style={{ width: `${summary.progress}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] text-gray-400 text-center">
          {summary.progress.toFixed(1)}% dari target {summary.target} kegiatan/minggu
        </p>
      </div>

      {/* Days grid */}
      <div className="rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-3">
        <div className="grid grid-cols-7 gap-1.5">
          {summary.days.map((d) => {
            const isSunday = d.is_sunday;
            const done = d.activity_count > 0;
            return (
              <div
                key={d.date}
                className={`
                  aspect-square rounded-lg border flex flex-col items-center justify-center text-[10px] p-1
                  ${d.is_today ? 'border-[#00c8ff] ring-2 ring-[#00c8ff]/30' : 'border-transparent'}
                  ${isSunday
                    ? 'bg-gray-100 dark:bg-white/5 text-gray-400'
                    : done
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : d.is_future
                        ? 'bg-[#00c8ff]/5 text-gray-400'
                        : 'bg-red-500/10 text-red-400'}
                `}
              >
                <span className="text-[9px] font-semibold opacity-70">{WEEKDAY[d.day_of_week]}</span>
                <span className="text-[10px] font-bold">
                  {new Date(d.date).getDate()}
                </span>
                {isSunday ? (
                  <span className="text-[8px]">☕</span>
                ) : done ? (
                  <span className="text-[8px]">{d.activity_count}×</span>
                ) : (
                  <span className="text-[8px]">–</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#2a2a4e] flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-gray-500">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/40 mr-1" />Ada kegiatan</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-red-500/30 mr-1" />Kosong</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-gray-300/60 mr-1" />Libur</span>
        </div>
      </div>

      {/* Detail per hari */}
      {summary.days.filter(d => d.activity_count > 0).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Detail Kegiatan
          </h4>
          {summary.days.filter(d => d.activity_count > 0).map(d => (
            <div
              key={d.date}
              className="rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-2.5 space-y-1.5"
            >
              <p className="text-[10px] font-semibold text-gray-400">
                {new Date(d.date).toLocaleDateString('id-ID', {
                  weekday: 'long', day: 'numeric', month: 'short',
                })}
              </p>
              {d.activities.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 py-1">
                  <span className="text-lg">{TYPE_ICON[a.activity_type] || '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[#1a1a2e] dark:text-white truncate">
                      {a.title}
                    </p>
                    <p className="text-[9px] text-gray-400 truncate">
                      {TYPE_LABEL[a.activity_type] || a.activity_type}
                      {a.polygon_name && ` · ${a.polygon_name}`}
                      {a.media_count > 0 && ` · ${a.media_count} file`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}