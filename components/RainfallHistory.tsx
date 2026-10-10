// components/RainfallHistory.tsx
'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { createPortal } from 'react-dom';   // ⬅️ TAMBAH INI

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
);

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ===== FIELD NAMES SESUAI BACKEND =====
interface RainfallReading {
  _id?: string;
  building_id: string;
  rainfall_mm: number;
  status?: string;
  notes?: string;
  created_at?: string;
  reporter_email?: string;
  user_name?: string | null;
  user_full_name?: string | null;
  user_role?: string | null;
  user_exists?: boolean;
}

interface ForecastItem {
  date: string;
  rainfall_mm: number;
  weathercode: number;
  tempMax?: number;
  tempMin?: number;
}

interface RainfallHistoryProps {
  buildingId: string;
  buildingName: string;
  buildingLat?: number;
  buildingLon?: number;
  token?: string;
}

// ===== STATUS META =====
const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  normal: { label: 'Normal', color: '#22C55E', icon: 'fa-water' },
  siaga:  { label: 'Siaga',  color: '#EAB308', icon: 'fa-triangle-exclamation' },
  banjir: { label: 'Banjir', color: '#F97316', icon: 'fa-house-flood-water' },
  kering: { label: 'Kering', color: '#EF4444', icon: 'fa-ban' },
};

// ===== WMO WEATHER CODE → emoji + label =====
const weatherEmoji = (code: number): string => {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 99) return '⛈️';
  return '🌤️';
};

export default function RainfallHistory({
  buildingId,
  buildingName,
  buildingLat,
  buildingLon,
  token,
}: RainfallHistoryProps) {
  const [readings, setReadings] = useState<RainfallReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'chart'>('chart');
  const [fullscreen, setFullscreen] = useState(false);

  // ===== FORECAST STATE =====
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // ============ LOAD HISTORY ============
  const load = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(
        `${API_URL}/rainfall/${encodeURIComponent(buildingId)}`,
        { headers }
      );
      const items: RainfallReading[] = res.data?.reports || [];
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

  // ============ LOAD FORECAST (Open-Meteo, free, no key) ============
  const loadForecast = useCallback(async () => {
    if (!buildingLat || !buildingLon) return;
    setForecastLoading(true);
    setForecastError(null);
    try {
      const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: buildingLat,
          longitude: buildingLon,
          daily: 'precipitation_sum,weathercode,temperature_2m_max,temperature_2m_min',
          timezone: 'Asia/Jakarta',
          forecast_days: 7,
        },
        timeout: 10000,
      });
      const daily = res.data?.daily;
      if (!daily?.time) throw new Error('No forecast data');
      const items: ForecastItem[] = daily.time.map((t: string, i: number) => ({
        date: t,
        rainfall_mm: Number(daily.precipitation_sum?.[i] ?? 0),
        weathercode: Number(daily.weathercode?.[i] ?? 0),
        tempMax: daily.temperature_2m_max?.[i],
        tempMin: daily.temperature_2m_min?.[i],
      }));
      setForecast(items);
    } catch (err: any) {
      console.error('Forecast error:', err);
      setForecastError('Gagal memuat prakiraan cuaca');
    } finally {
      setForecastLoading(false);
    }
  }, [buildingLat, buildingLon]);

  useEffect(() => { loadForecast(); }, [loadForecast]);

  // ============ ESC untuk exit fullscreen ============
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // ============ SORTED (newest first) ============
  const sorted = useMemo(() => {
    return [...readings].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
  }, [readings]);

  // ============ STATS ============
  const stats = useMemo(() => {
    if (sorted.length === 0) return null;
    const values = sorted.map(r => Number(r.rainfall_mm)).filter(v => isFinite(v));
    if (values.length === 0) return null;
    const total = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      avg: total / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
      total,
    };
  }, [sorted]);

  // ============ TREND ANALYSIS ============
  const trend = useMemo(() => {
    if (sorted.length < 4) return null;
    const recent = sorted.slice(0, 7);
    const prev = sorted.slice(7, 14);
    if (prev.length === 0) return null;
    const rAvg = recent.reduce((s, r) => s + Number(r.rainfall_mm), 0) / recent.length;
    const pAvg = prev.reduce((s, r) => s + Number(r.rainfall_mm), 0) / prev.length;
    const diff = rAvg - pAvg;
    return {
      recentAvg: rAvg,
      prevAvg: pAvg,
      diff,
      direction: diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : 'stable',
    };
  }, [sorted]);

  // ============ HELPERS ============
  const formatDateTime = (v?: string) => {
    if (!v) return '-';
    const d = new Date(v);
    if (!isFinite(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getUploaderName = (r: RainfallReading) => {
    if (r.user_exists === false && !r.user_name) {
      return { name: 'User Terhapus', deleted: true };
    }
    return { name: r.user_name || r.user_full_name || 'Anonim', deleted: false };
  };

  // ============ CHART DATA (history) ============
  const historyChartData = useMemo(() => {
    const recent = [...sorted].reverse().slice(-30); // oldest → newest, max 30
    return {
      labels: recent.map(r => {
        const d = new Date(r.created_at || '');
        return isFinite(d.getTime())
          ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          : '-';
      }),
      datasets: [
        {
          label: 'Curah Hujan',
          data: recent.map(r => Number(r.rainfall_mm)),
          borderColor: '#00c8ff',
          backgroundColor: 'rgba(0,200,255,0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#00c8ff',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          borderWidth: 2,
        },
      ],
    };
  }, [sorted]);

  const historyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,15,35,0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed.y} mm`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: 'rgba(148,163,184,0.1)' },
      },
      x: {
        ticks: { color: '#94a3b8', font: { size: 9 } },
        grid: { display: false },
      },
    },
  }), []);

  // ============ CHART DATA (forecast) ============
  const forecastChartData = useMemo(() => ({
    labels: forecast.map(f => {
      const d = new Date(f.date);
      return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Prakiraan',
        data: forecast.map(f => f.rainfall_mm),
        backgroundColor: forecast.map(f =>
          f.rainfall_mm === 0
            ? 'rgba(148,163,184,0.25)'
            : f.rainfall_mm < 10
            ? 'rgba(34,197,94,0.7)'
            : f.rainfall_mm < 30
            ? 'rgba(234,179,8,0.8)'
            : 'rgba(239,68,68,0.85)'
        ),
        borderColor: '#00c8ff',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }), [forecast]);

  const forecastChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,15,35,0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed.y} mm`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: 'rgba(148,163,184,0.1)' },
      },
      x: {
        ticks: { color: '#94a3b8', font: { size: 9 } },
        grid: { display: false },
      },
    },
  }), []);

  // ============ RENDER: FULLSCREEN MODAL ============
const renderFullscreen = () => {
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <div
      className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => setFullscreen(false)}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-[#0f0f1e] rounded-2xl shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#2a2a4e] bg-white/95 dark:bg-[#0f0f1e]/95 backdrop-blur-md">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-chart-line text-[#00c8ff]"></i>
              Analisis Curah Hujan
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{buildingName}</p>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#2a2a4e] hover:bg-gray-200 dark:hover:bg-[#3a3a5e] flex items-center justify-center text-gray-600 dark:text-gray-300 transition"
            title="Tutup (ESC)"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Summary Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-[10px] text-blue-600 dark:text-blue-300 font-semibold uppercase">Total Data</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-200 tabular-nums mt-1">{stats.count}</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-900/10 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
                <p className="text-[10px] text-cyan-600 dark:text-cyan-300 font-semibold uppercase">Rata-rata</p>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-200 tabular-nums mt-1">
                  {stats.avg.toFixed(1)}<span className="text-xs font-normal ml-1">mm</span>
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-semibold uppercase">Tertinggi</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200 tabular-nums mt-1">
                  {stats.max.toFixed(1)}<span className="text-xs font-normal ml-1">mm</span>
                </p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <p className="text-[10px] text-amber-600 dark:text-amber-300 font-semibold uppercase">Total Kumulatif</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-200 tabular-nums mt-1">
                  {stats.total.toFixed(0)}<span className="text-xs font-normal ml-1">mm</span>
                </p>
              </div>
            </div>
          )}

          {/* Trend */}
          {trend && (
            <div className={`rounded-xl p-4 border flex items-center gap-3 ${
              trend.direction === 'up'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : trend.direction === 'down'
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
            }`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                trend.direction === 'up' ? 'bg-blue-500 text-white' :
                trend.direction === 'down' ? 'bg-orange-500 text-white' :
                'bg-gray-400 text-white'
              }`}>
                <i className={`fa-solid ${
                  trend.direction === 'up' ? 'fa-arrow-trend-up' :
                  trend.direction === 'down' ? 'fa-arrow-trend-down' :
                  'fa-minus'
                }`}></i>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-800 dark:text-white">
                  Tren 7 Hari Terakhir:{' '}
                  {trend.direction === 'up' ? 'Meningkat' :
                   trend.direction === 'down' ? 'Menurun' : 'Stabil'}
                </p>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                  Rata-rata sekarang <b>{trend.recentAvg.toFixed(1)} mm</b>
                  {' '}vs sebelumnya <b>{trend.prevAvg.toFixed(1)} mm</b>
                  {' '}({trend.diff >= 0 ? '+' : ''}{trend.diff.toFixed(1)} mm)
                </p>
              </div>
            </div>
          )}

          {/* History Chart */}
          <div className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <i className="fa-solid fa-chart-area text-[#00c8ff]"></i>
                Riwayat Curah Hujan (30 terakhir)
              </h4>
              <span className="text-[10px] text-gray-400">dari database</span>
            </div>
            <div className="h-[300px]">
              {sorted.length > 0 ? (
                <Line data={historyChartData} options={historyChartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                  Belum ada data
                </div>
              )}
            </div>
          </div>

          {/* Forecast Chart */}
          <div className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <i className="fa-solid fa-cloud-sun-rain text-[#00c8ff]"></i>
                Prakiraan 7 Hari ke Depan
              </h4>
              <span className="text-[10px] text-gray-400">Open-Meteo API</span>
            </div>

            {!buildingLat || !buildingLon ? (
              <div className="h-[200px] flex items-center justify-center text-gray-400 text-xs">
                <div className="text-center">
                  <i className="fa-solid fa-location-dot text-2xl mb-2"></i>
                  <p>Koordinat bangunan tidak tersedia</p>
                </div>
              </div>
            ) : forecastLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : forecastError ? (
              <div className="h-[200px] flex items-center justify-center text-red-500 text-xs">
                <div className="text-center">
                  <i className="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                  <p>{forecastError}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[220px] mb-3">
                  <Bar data={forecastChartData} options={forecastChartOptions} />
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {forecast.map((f, i) => {
                    const d = new Date(f.date);
                    const isToday = i === 0;
                    return (
                      <div
                        key={i}
                        className={`text-center rounded-lg p-2 border ${
                          isToday
                            ? 'bg-[#00c8ff]/10 border-[#00c8ff]/40'
                            : 'bg-gray-50 dark:bg-[#0f0f1e] border-gray-200 dark:border-[#2a2a4e]'
                        }`}
                      >
                        <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
                          {d.toLocaleDateString('id-ID', { weekday: 'short' })}
                        </p>
                        <p className="text-lg my-0.5">{weatherEmoji(f.weathercode)}</p>
                        <p className={`text-[11px] font-bold tabular-nums ${
                          f.rainfall_mm === 0 ? 'text-gray-400' :
                          f.rainfall_mm < 10 ? 'text-green-600 dark:text-green-400' :
                          f.rainfall_mm < 30 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {f.rainfall_mm.toFixed(0)}<span className="text-[8px] font-normal">mm</span>
                        </p>
                        {f.tempMax != null && f.tempMin != null && (
                          <p className="text-[9px] text-gray-400 tabular-nums">
                            {Math.round(f.tempMin)}°/{Math.round(f.tempMax)}°
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body   // ⬅️ TELEPORT KE BODY
  );
};

  // ============ RENDER: EMPTY ============
  const hasAnything = readings.length > 0 || forecast.length > 0;

  return (
    <div className="space-y-3">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="text-lg">🌧️</span> Data Curah Hujan
          </h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{buildingName}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Toggle View */}
          <div className="flex bg-gray-100 dark:bg-[#2a2a4e] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              className={`px-2 py-1 text-[10px] rounded-md transition-all ${
                view === 'list'
                  ? 'bg-white dark:bg-[#1a1a2e] text-[#00c8ff] shadow-sm font-semibold'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              title="List"
            >
              <i className="fa-solid fa-list"></i>
            </button>
            <button
              type="button"
              onClick={() => setView('chart')}
              className={`px-2 py-1 text-[10px] rounded-md transition-all ${
                view === 'chart'
                  ? 'bg-white dark:bg-[#1a1a2e] text-[#00c8ff] shadow-sm font-semibold'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              title="Grafik"
            >
              <i className="fa-solid fa-chart-line"></i>
            </button>
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#2a2a4e] hover:bg-gray-200 dark:hover:bg-[#3a3a5e] flex items-center justify-center text-gray-600 dark:text-gray-300 transition"
            title="Analisis Fullscreen"
          >
            <i className="fa-solid fa-expand text-[11px]"></i>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => { load(); loadForecast(); }}
            disabled={loading}
            className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#2a2a4e] hover:bg-gray-200 dark:hover:bg-[#3a3a5e] flex items-center justify-center text-gray-600 dark:text-gray-300 transition"
            title="Refresh"
          >
            <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* ===== BODY ===== */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-center py-6 text-red-500 text-xs">
          <i className="fa-solid fa-triangle-exclamation text-2xl block mb-2"></i>
          {error}
        </div>
      ) : !hasAnything ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <i className="fa-solid fa-cloud-rain text-3xl block mb-2"></i>
          <p className="text-sm">Belum ada data curah hujan</p>
          <p className="text-xs">Data akan muncul setelah reporter menginput</p>
        </div>
      ) : view === 'list' ? (
        /* ============ LIST VIEW ============ */
        <div className="space-y-3">
          {stats && (
            <div className="grid grid-cols-4 gap-1.5">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                <p className="text-[9px] text-blue-600 dark:text-blue-300 font-medium">Total</p>
                <p className="text-base font-bold text-blue-700 dark:text-blue-200 tabular-nums">{stats.count}</p>
              </div>
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-2">
                <p className="text-[9px] text-cyan-600 dark:text-cyan-300 font-medium">Avg</p>
                <p className="text-base font-bold text-cyan-700 dark:text-cyan-200 tabular-nums">
                  {stats.avg.toFixed(1)}
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2">
                <p className="text-[9px] text-emerald-600 dark:text-emerald-300 font-medium">Max</p>
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-200 tabular-nums">
                  {stats.max.toFixed(1)}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                <p className="text-[9px] text-amber-600 dark:text-amber-300 font-medium">Min</p>
                <p className="text-base font-bold text-amber-700 dark:text-amber-200 tabular-nums">
                  {stats.min.toFixed(1)}
                </p>
              </div>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
            {sorted.map((r, i) => {
              const { name, deleted } = getUploaderName(r);
              const statusMeta = r.status ? STATUS_META[r.status] : null;
              return (
                <div
                  key={r._id || i}
                  className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                          {Number(r.rainfall_mm).toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">mm</span>
                        {statusMeta && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ml-1"
                            style={{ backgroundColor: statusMeta.color }}
                          >
                            <i className={`fa-solid ${statusMeta.icon} mr-0.5`}></i>
                            {statusMeta.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                        <i className="fa-regular fa-calendar"></i>
                        {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] shrink-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        deleted ? 'bg-gray-200 dark:bg-gray-700 text-gray-400' : 'bg-[#00c8ff] text-white'
                      }`}>
                        {deleted ? '?' : name.charAt(0).toUpperCase()}
                      </div>
                      <span className={`font-semibold ${
                        deleted ? 'text-gray-400 italic' : 'text-gray-700 dark:text-gray-200'
                      }`}>
                        {deleted ? name : `@${name}`}
                      </span>
                    </div>
                  </div>
                  {r.notes && (
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2">
                      {r.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ============ CHART VIEW (compact di panel) ============ */
        <div className="space-y-3">
          {/* History Chart */}
          <div className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                <i className="fa-solid fa-chart-area text-[#00c8ff]"></i>
                Riwayat
              </h5>
              <span className="text-[9px] text-gray-400">{sorted.length} data</span>
            </div>
            <div className="h-[160px]">
              {sorted.length > 0 ? (
                <Line data={historyChartData} options={historyChartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-[11px]">
                  Belum ada data
                </div>
              )}
            </div>
          </div>

          {/* Forecast Compact */}
          <div className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                <i className="fa-solid fa-cloud-sun-rain text-[#00c8ff]"></i>
                Prakiraan 7 Hari
              </h5>
              <span className="text-[9px] text-gray-400">Open-Meteo</span>
            </div>

            {!buildingLat || !buildingLon ? (
              <p className="text-[11px] text-gray-400 text-center py-4">
                Koordinat tidak tersedia
              </p>
            ) : forecastLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : forecastError ? (
              <p className="text-[11px] text-red-500 text-center py-4">{forecastError}</p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {forecast.map((f, i) => {
                  const d = new Date(f.date);
                  return (
                    <div
                      key={i}
                      className="text-center rounded-md p-1 bg-gray-50 dark:bg-[#0f0f1e]"
                    >
                      <p className="text-[8px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        {d.toLocaleDateString('id-ID', { weekday: 'short' })}
                      </p>
                      <p className="text-sm my-0.5">{weatherEmoji(f.weathercode)}</p>
                      <p className={`text-[9px] font-bold tabular-nums ${
                        f.rainfall_mm === 0 ? 'text-gray-400' :
                        f.rainfall_mm < 10 ? 'text-green-600 dark:text-green-400' :
                        f.rainfall_mm < 30 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {f.rainfall_mm.toFixed(0)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fullscreen hint */}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-[#00c8ff]/10 to-blue-500/10 border border-[#00c8ff]/30 text-[#00c8ff] text-[11px] font-medium hover:from-[#00c8ff]/20 hover:to-blue-500/20 transition flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-expand"></i>
            Buka Analisis Lengkap
          </button>
        </div>
      )}

      {/* ===== FULLSCREEN MODAL ===== */}
      {fullscreen && renderFullscreen()}
    </div>
  );
}