// components/FeatureDetail.tsx
import React, { useMemo } from 'react';
import { CATEGORY_CONFIG } from '@/components/MapWithKML';

interface FeatureDetailProps {
  feature: any;
  media: any[];
  onClose: () => void;
}

export const FeatureDetail: React.FC<FeatureDetailProps> = ({ feature, media, onClose }) => {
  if (!feature) return null;

  const cfg = CATEGORY_CONFIG[feature.category] || CATEGORY_CONFIG['default'];

  // Filter HANYA foto (video dan model 3D tidak boleh ditampilkan di bagian ini)
  const photos = useMemo(() => {
    if (!media || !Array.isArray(media)) return [];
    return media.filter((m: any) => {
      if (m.media_type === 'video' || m.media_type === 'model_3d') return false;
      const url = (m.file_url || '').toLowerCase();
      const fileType = (m.file_type || '').toLowerCase();
      if (fileType.includes('video') || /\.(mp4|webm|mov|mkv|avi|m4v)(\?.*)?$/i.test(url)) return false;
      return (
        m.media_type === 'photo' ||
        m.media_type === 'image' ||
        fileType.includes('image') ||
        /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url)
      );
    });
  }, [media]);

  return (
    <div className="bg-gradient-to-br from-[#00c8ff]/5 to-transparent rounded-xl border border-[#00c8ff]/20 p-4 animate-fadeIn">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-[#1a1a2e] dark:text-white text-sm truncate">{feature.name}</h3>
          {feature.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 whitespace-pre-line">{feature.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-1 bg-[#00c8ff]/10 text-[#00c8ff] rounded-lg text-[10px] font-mono font-medium">ACTIVE</span>
          <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2a2a4e] transition" aria-label="Tutup">
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      </div>

      {typeof feature.lat === 'number' && typeof feature.lon === 'number' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <i className="fa-solid fa-location-dot text-[#00c8ff]"></i>
          <span className="font-mono">{feature.lat.toFixed(5)}, {feature.lon.toFixed(5)}</span>
        </div>
      )}

      {feature.category && (
        <p className="text-[10px] mt-2 flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <i className={`fa-solid ${cfg.icon}`} style={{ color: cfg.color }}></i>
          {cfg.label || feature.category}
        </p>
      )}

      {feature.tags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {feature.tags.map((tag: string) => (
            <span key={tag} className="bg-[#00c8ff]/10 text-[#00c8ff] px-2 py-0.5 rounded-full text-[10px] font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Tampilkan 'Foto terkait' HANYA jika ada foto valid */}
      {photos.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Foto terkait:</p>
          <div className="flex gap-2 mt-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {photos.slice(0, 4).map((m: any, i: number) => (
              <img
                key={m._id || i}
                src={m.file_url}
                alt={m.description || `Foto ${feature.name}`}
                loading="lazy"
                decoding="async"
                className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-[#2a2a4e] shrink-0 hover:opacity-90 transition cursor-pointer"
                onClick={() => window.open(m.file_url, '_blank')}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
