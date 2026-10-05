// components/RainfallHistory.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface RainfallReading {
  _id?: string;
  building_id: string;
  value: number;          // mm
  timestamp?: string;
  created_at?: string;
  user_id?: string;
  user_name?: string | null;
  user_full_name?: string | null;
  user_role?: string | null;
  user_exists?: boolean;
  keterangan?: string;
  description?: string;
}

interface RainfallHistoryProps {
  buildingId: string;
  buildingName: string;
  token?: string;
}

export default function RainfallHistory({ buildingId, buildingName, token }: RainfallHistoryProps) {
  const [readings, setReadings] = useState<RainfallReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_URL}/rainfall/${encodeURIComponent(buildingId)}`, { headers });
      const items: RainfallReading[] = res.data?.readings || res.data?.data || [];
      setReadings(items);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setReadings([]);
      } else {
        console.error('Gagal load rainfall:', err);
        setError(err.response?.data?.detail || 'Gagal memuat data curah hujan');
      }
    } finally {
      setLoading(false);
    }
  }, [buildingId, token]);

  useEffect(() => { load(); }, [load]);

  // Stats
  const stats = (() => {
    if (readings.length === 0) return null;
    const values = readings.map(r => r.value).filter(v => typeof v === 'number' && isFinite(v));
    if (values.length === 0) return null;
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    return { total, avg, max, min, count: values.length };
  })();

  // Format
  const formatDate = (v?: string) => {
    if (!v) return '-';
    const d = new Date(v);
    if (!isFinite(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const formatDateTime = (v?: string) => {
    if (!v) return '-';
    const d = new Date(v);
    if (!isFinite(d.getTime())) return '-';
    return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getUploaderName = (r: RainfallReading) => {
    if (r.user_exists === false) return { name: 'User Terhapus', deleted: true };
    return {
      name: r.user_name || r.user_full_name || 'Anonim',
      deleted: false,
    };
  };

  // Sort newest first
  const sorted = [...readings].sort((a, b) => {
    const ta = new Date(a.timestamp || a.created_at || 0).getTime();
    const tb = new Date(b.timestamp || b.created_at || 0).getTime();
    return tb - ta;
  });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
        <span className="text-lg">🌧️</span> Data Curah Hujan {buildingName}
      </h4>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-center py-6 text-red-500 text-xs">
          <i className="fa-solid fa-triangle-exclamation text-2xl block mb-2"></i>
          {error}
        </div>
      ) : readings.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <i className="fa-solid fa-cloud-rain text-3xl block mb-2"></i>
          <p className="text-sm">Belum ada data curah hujan</p>
          <p className="text-xs">Data akan muncul setelah reporter menginput</p>
        </div>
      ) : (
        <>
          {/* STATS */}
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <p className="text-[10px] text-blue-600 dark:text-blue-300 font-medium">Total Pengukuran</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-200">{stats.count}</p>
              </div>
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-3">
                <p className="text-[10px] text-cyan-600 dark:text-cyan-300 font-medium">Rata-rata</p>
                <p className="text-xl font-bold text-cyan-700 dark:text-cyan-200">
                  {stats.avg.toFixed(1)} <span className="text-xs font-normal">mm</span>
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-medium">Tertinggi</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-200">
                  {stats.max.toFixed(1)} <span className="text-xs font-normal">mm</span>
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <p className="text-[10px] text-amber-600 dark:text-amber-300 font-medium">Terendah</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-200">
                  {stats.min.toFixed(1)} <span className="text-xs font-normal">mm</span>
                </p>
              </div>
            </div>
          )}

          {/* LIST */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Riwayat ({sorted.length})
            </p>
            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
              {sorted.map((r, i) => {
                const { name, deleted } = getUploaderName(r);
                return (
                  <div
                    key={r._id || i}
                    className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                            {Number(r.value).toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">mm</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                          <i className="fa-regular fa-calendar"></i>
                          {formatDateTime(r.timestamp || r.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] shrink-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          deleted
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                            : 'bg-[#00c8ff] text-white'
                        }`}>
                          {deleted ? '?' : name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`font-semibold ${
                          deleted ? 'text-gray-400 italic' : 'text-gray-700 dark:text-gray-200'
                        }`}>
                          {deleted ? name : `@${name}`}
                        </span>
                        {r.user_role && !deleted && (
                          <span className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1 py-0.5 rounded-full uppercase">
                            {r.user_role}
                          </span>
                        )}
                      </div>
                    </div>
                    {(r.keterangan || r.description) && (
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2">
                        {r.keterangan || r.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}