'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { uploadsApi, MyUploadItem } from '@/lib/api/uploads';
import AttendanceTab from './tpop/AttendanceTab';
import ActivitiesTab from './tpop/ActivitiesTab';

// ✅ Media types saja — dipakai untuk query uploadsApi
const TYPES = [
  { key: 'photo',       label: '📷 Foto',      color: '#00c8ff' },
  { key: 'video',       label: '🎥 Video',     color: '#a855f7' },
  { key: 'maintenance', label: '🔧 Perbaikan', color: '#f59e0b' },
  { key: 'model_3d',    label: '🧊 3D',        color: '#10b981' },
] as const;

type FilterType = 'photo' | 'video' | 'maintenance' | 'model_3d';
type Mode = 'media' | 'attendance' | 'activities';

const TPOP_TABS: { key: Mode; label: string }[] = [
  { key: 'media',      label: '📤 Media' },
  { key: 'attendance', label: '🗓️ Kehadiran' },
  { key: 'activities', label: '📸 Kegiatan' },
];

export default function UploadsTab() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  const isTpop = role === 'tpop';

  const [mode, setMode] = useState<Mode>('media');
  const [filter, setFilter] = useState<FilterType>('photo');
  const [items, setItems] = useState<MyUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!token || mode !== 'media') return;
    setLoading(true);
    try {
      const r = await uploadsApi.list(token, {
        media_type: filter,
        q: q || undefined,
        limit: 50,
      });
      setItems(r.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter, q, mode]);

  useEffect(() => {
    if (mode === 'media') load();
  }, [load, mode]);

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Hapus upload ini?')) return;
    try {
      await uploadsApi.remove(token, id);
      setItems((p) => p.filter((x) => x._id !== id));
      toast.success('Terhapus');
    } catch {
      toast.error('Gagal hapus');
    }
  };

  const openInMap = (item: MyUploadItem) => {
    if (item.building_lat == null || item.building_lon == null) {
      return toast.error('Lokasi tidak tersedia');
    }
    window.location.href = `/?focus=${encodeURIComponent(item.building_id)}&lat=${item.building_lat}&lon=${item.building_lon}`;
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher — hanya TPOP */}
      {isTpop && (
        <div className="flex gap-1 bg-gray-100 dark:bg-[#0f0f23] rounded-lg p-1">
          {TPOP_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={`flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition ${
                mode === t.key
                  ? 'bg-white dark:bg-[#1a1a2e] shadow-sm text-[#00c8ff]'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Mode: Kegiatan (TPOP only) */}
      {mode === 'activities' && isTpop && <ActivitiesTab />}

      {/* Mode: Kehadiran (TPOP only) */}
      {mode === 'attendance' && isTpop && <AttendanceTab />}

      {/* Mode: Media — default & untuk semua role */}
      {(mode === 'media' || !isTpop) && (
        <>
          {/* Filter media */}
          <div className="flex gap-1 bg-gray-100 dark:bg-[#0f0f23] rounded-lg p-1 overflow-x-auto">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`flex-1 min-w-fit px-3 py-1.5 text-xs rounded-md font-medium transition whitespace-nowrap ${
                  filter === t.key
                    ? 'bg-white dark:bg-[#1a1a2e] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                style={filter === t.key ? { color: t.color } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Cari deskripsi atau bangunan..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
          />

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <i className="fa-solid fa-inbox text-3xl mb-2 block" />
              <p className="text-sm">Belum ada upload {filter}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((item) => {
                const isVideo =
                  item.file_type === 'videos' || item.file_type === 'video';
                const isModel = item.media_type === 'model_3d';
                return (
                  <div
                    key={item._id}
                    className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-[#2a2a4e] bg-gray-50 dark:bg-[#0f0f23]"
                  >
                    <div className="aspect-square relative bg-black/5 dark:bg-black/20">
                      {isVideo ? (
                        <video
                          src={item.file_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : isModel ? (
                        <div className="w-full h-full flex items-center justify-center text-[#00c8ff]">
                          <i className="fa-solid fa-cube text-4xl" />
                        </div>
                      ) : (
                        <img
                          src={item.file_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                        <button
                          onClick={() => openInMap(item)}
                          className="px-3 py-1.5 rounded-lg bg-[#00c8ff] text-white text-[10px] font-medium flex items-center gap-1"
                          title="Lihat lokasi di peta"
                        >
                          <i className="fa-solid fa-location-dot" /> Lokasi
                        </button>
                        <button
                          onClick={() => handleDelete(item._id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-medium flex items-center gap-1"
                        >
                          <i className="fa-solid fa-trash" /> Hapus
                        </button>
                      </div>

                      <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full">
                        {item.media_type === 'photo' && '📷'}
                        {item.media_type === 'video' && '🎥'}
                        {item.media_type === 'maintenance' && '🔧'}
                        {item.media_type === 'model_3d' && '🧊'}
                      </div>
                    </div>

                    <div className="p-2 space-y-0.5">
                      <p className="text-[11px] font-medium text-[#1a1a2e] dark:text-white truncate">
                        {item.description || 'Tanpa deskripsi'}
                      </p>
                      <p className="text-[9px] text-gray-500 truncate flex items-center gap-1">
                        <i className="fa-solid fa-location-dot text-[8px]" />
                        {item.building_name || item.building_id}
                      </p>
                      <p className="text-[9px] text-gray-400">
                        {new Date(item.timestamp || item.created_at).toLocaleDateString(
                          'id-ID',
                          { day: 'numeric', month: 'short', year: 'numeric' }
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}