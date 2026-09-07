// components/BuildingMedia.tsx
'use client';
import * as turf from '@turf/turf';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import Model3DViewer from '@/components/Model3DViewer';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface MediaItem {
  _id: string;
  building_id: string;
  media_type: 'photo' | 'video' | 'maintenance' | 'model_3d';
  file_type: string;
  file_url: string;
  description: string;
  timestamp: string;
  created_at: string;
}

interface BuildingMediaProps {
  buildingId: string;
  buildingName: string;
  onMediaChange?: () => void;
  userRole?: string;
  userPolygon?: number[][];
  userLocation?: { lat: number; lng: number } | null;
}

export default function BuildingMedia({
  buildingId,
  buildingName,
  onMediaChange,
  userRole,
  userPolygon,
  userLocation,
}: BuildingMediaProps) {
  const { data: session } = useSession();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'maintenance' | 'model_3d'>('photo');
  const [timestamp, setTimestamp] = useState('');
  const [activeTab, setActiveTab] = useState<'photo' | 'video' | 'maintenance' | 'model_3d'>('photo');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isCarouselMode, setIsCarouselMode] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});


  // ===== FUNGSI VALIDASI TPOP =====
  const isTPOPInArea = useCallback((): boolean => {
    if (userRole !== 'tpop') return true;
    if (!userPolygon || userPolygon.length < 4) {
      alert('⚠️ Wilayah kerja TPOP belum diatur. Hubungi admin.');
      return false;
    }
    if (!userLocation) {
      alert('⚠️ Lokasi Anda belum diketahui. Aktifkan GPS atau klik tombol Lokasi di peta.');
      return false;
    }
    const point = turf.point([userLocation.lng, userLocation.lat]);
    const polygon = turf.polygon([userPolygon]);
    const inside = turf.booleanPointInPolygon(point, polygon);
    if (!inside) {
      alert('📍 Anda berada di luar wilayah kerja TPOP. Upload tidak diizinkan.');
      return false;
    }
    return true;
  }, [userRole, userPolygon, userLocation]);

  // ===== LOAD MEDIA =====
  const loadMedia = useCallback(async () => {
    if (!buildingId) return;
    try {
      const res = await axios.post(`${API_URL}/buildings/media/batch`, [buildingId]);
      const mediaData = res.data?.media || {};
      const items = mediaData[buildingId] || [];
      setMedia(items);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setMedia([]);
      } else {
        console.error('Gagal load media:', err);
        setMedia([]);
      }
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // ===== KOMPRESI GAMBAR =====
  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    if (file.type === 'image/heic' || file.type === 'image/heif') return file;
    try {
      const options = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };
      const compressed = await imageCompression(file, options);
      return compressed;
    } catch (e) {
      console.warn('Kompresi gagal, pakai file asli:', e);
      return file;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    if (activeTab === 'model_3d') {
      const invalidFiles = fileArray.filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return !['glb', 'gltf'].includes(ext || '');
      });
      if (invalidFiles.length > 0) {
        alert('Hanya file .glb atau .gltf yang diterima untuk model 3D');
        return;
      }
    }
    const validFiles = fileArray.filter(f => f.size <= 100 * 1024 * 1024);
    if (validFiles.length !== fileArray.length) {
      alert('Beberapa file >100MB, akan diabaikan.');
    }
    setSelectedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ===== HANDLE UPLOAD MULTIPLE =====
  const handleMultipleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Pilih file dulu!');
      return;
    }
    if (!session?.accessToken) {
      alert('Login dulu!');
      return;
    }
    if (!isTPOPInArea()) return;

    setUploading(true);
    setUploadIndex(0);
    setTotalProgress(0);

    for (let i = 0; i < selectedFiles.length; i++) {
      let file = selectedFiles[i];
      if (activeTab !== 'model_3d' && file.type.startsWith('image/') && file.type !== 'image/heic' && file.type !== 'image/heif') {
        try {
          file = await compressImage(file);
        } catch (e) {
          console.warn('Kompresi gagal, lanjut tanpa kompresi');
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('building_id', buildingId);
      formData.append('media_type', mediaType);
      formData.append('description', description);
      if (timestamp) formData.append('timestamp', timestamp);

      try {
        await axios.post(`${API_URL}/buildings/media/upload`, formData, {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        setUploadIndex(i + 1);
        setTotalProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      } catch (err: any) {
        console.error('Upload error for', file.name, err);
        alert(`Gagal upload ${file.name}: ${err.response?.data?.detail || err.message}`);
      }
    }

    setSelectedFiles([]);
    setUploading(false);
    setUploadIndex(0);
    setTotalProgress(0);
    await loadMedia();
    if (onMediaChange) onMediaChange();
    alert('✅ Semua file berhasil diupload!');
  };

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (selectedFile.size > 100 * 1024 * 1024) {
      alert('File terlalu besar! Maksimal 100MB.');
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith('video/')) {
      setFilePreview(URL.createObjectURL(selectedFile));
    } else {
      setFilePreview(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0] || null;
    handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Pilih file dulu!');
      return;
    }
    if (!session?.accessToken) {
      alert('Login dulu!');
      return;
    }
    if (!isTPOPInArea()) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('building_id', buildingId);
    formData.append('media_type', mediaType);
    formData.append('description', description);
    if (timestamp) formData.append('timestamp', timestamp);

    setUploading(true);
    setUploadProgress(0);

    try {
      await axios.post(`${API_URL}/buildings/media/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });
      setFile(null);
      setFilePreview(null);
      setDescription('');
      setTimestamp('');
      setUploadProgress(0);
      await loadMedia();
      alert('✅ Upload berhasil!');
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(err.response?.data?.detail || '❌ Gagal upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus media ini?')) return;
    try {
      await axios.delete(`${API_URL}/buildings/media/${id}`, {
        headers: { 'Authorization': `Bearer ${session?.accessToken}` },
      });
      await loadMedia();
      alert('✅ Media berhasil dihapus!');
    } catch (err) {
      console.error('Gagal hapus:', err);
      alert('❌ Gagal hapus media');
    }
  };

  const filtered = media.filter((item) => item.media_type === activeTab);

  useEffect(() => {
    if (activeTab === 'model_3d') {
      const models = media.filter(m => m.media_type === 'model_3d');
      if (models.length > 0) {
        const lastModel = models[models.length - 1];
        if (!selectedModelUrl || !models.some(m => m.file_url === selectedModelUrl)) {
          setSelectedModelUrl(lastModel.file_url);
        }
      } else {
        setSelectedModelUrl(null);
      }
    }
  }, [activeTab, media]);

  // ===== CEK APAKAH USER BERADA DI DALAM POLYGON =====
  const isInside = userLocation && userPolygon && turf.booleanPointInPolygon(
    turf.point([userLocation.lng, userLocation.lat]),
    turf.polygon([userPolygon])
  );

  if (!buildingId) return null;

  // ===== LIKE =====
  const toggleLike = async (mediaId: string) => {
    try {
      const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
      const res = await axios.post(`${API_URL}/media/${mediaId}/like`, {}, { headers });
      const { liked, like_count } = res.data;
      setLikeCounts(prev => ({
        ...prev,
        [mediaId]: { count: like_count, liked }
      }));
    } catch (err) {
      console.error('Like error:', err);
      toast.error('Gagal like media');
    }
  };

  useEffect(() => {
    const fetchLikeStatus = async () => {
      const mediaIds = filtered.map(item => item._id);
      const statuses = await Promise.all(
        mediaIds.map(async (id) => {
          try {
            const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
            const res = await axios.get(`${API_URL}/media/${id}/like/status`, { headers });
            return { id, ...res.data };
          } catch {
            return { id, liked: false, like_count: 0 };
          }
        })
      );
      const newCounts: Record<string, { count: number; liked: boolean }> = {};
      statuses.forEach(s => {
        newCounts[s.id] = { count: s.like_count, liked: s.liked };
      });
      setLikeCounts(newCounts);
    };
    if (filtered.length > 0) {
      fetchLikeStatus();
    }
  }, [filtered, session]);

  // ===== SHARE =====
const handleShare = async (mediaItem: MediaItem) => {
  try {
    // 1. Kirim request ke backend untuk catat share
    const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
    const res = await axios.post(`${API_URL}/media/${mediaItem._id}/share`, {}, { headers });
    const { shared, share_count } = res.data;

    if (shared) {
      // Update state share count
      setShareCounts(prev => ({
        ...prev,
        [mediaItem._id]: share_count
      }));
    }

    // 2. Bagikan via Web Share API atau copy link
    const shareData = {
      title: `📸 ${buildingName} - ${mediaItem.description || 'Media'}`,
      text: `Cek media dari ${buildingName} di Cipamingkis!`,
      url: mediaItem.file_url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('✅ Berhasil dibagikan!');
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share error:', err);
          toast.error('Gagal share');
        }
      }
    } else {
      // Fallback: copy link
      try {
        await navigator.clipboard.writeText(mediaItem.file_url);
        toast.success('🔗 Link disalin ke clipboard!');
      } catch {
        toast.error('Gagal copy link');
      }
    }
  } catch (err) {
    console.error('Share error:', err);
    toast.error('Gagal share media');
  }
};

useEffect(() => {
  const fetchShareCounts = async () => {
    const mediaIds = filtered.map(item => item._id);
    const counts = await Promise.all(
      mediaIds.map(async (id) => {
        try {
          const res = await axios.get(`${API_URL}/media/${id}/share/count`);
          return { id, count: res.data.share_count };
        } catch {
          return { id, count: 0 };
        }
      })
    );
    const newCounts: Record<string, number> = {};
    counts.forEach(c => { newCounts[c.id] = c.count; });
    setShareCounts(newCounts);
  };
  if (filtered.length > 0) {
    fetchShareCounts();
  }
}, [filtered]);

  // ===== RENDER =====
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
        <span className="text-lg">📸</span> Media & Riwayat {buildingName}
      </h4>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'photo', label: '📷 Foto' },
          { key: 'video', label: '🎥 Video' },
          { key: 'maintenance', label: '🔧 Perbaikan' },
          { key: 'model_3d', label: '🧊 3D' },
        ].map((tab) => {
          const count = media.filter(m => m.media_type === tab.key).length;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key as any);
                setMediaType(tab.key as any);
              }}
              className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all flex items-center gap-1 ${
                activeTab === tab.key
                  ? 'bg-[#00c8ff] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'model_3d' ? (
        <div className="space-y-3">
          <Model3DViewer url={selectedModelUrl} className="w-full h-[400px] sm:h-[500px]" />
          {filtered.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filtered.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setSelectedModelUrl(item.file_url)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                    selectedModelUrl === item.file_url
                      ? 'border-[#00c8ff] bg-[#00c8ff]/10 text-[#00c8ff]'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#00c8ff]'
                  }`}
                >
                  <i className="fa-solid fa-cube mr-1"></i>
                  {item.description || 'Model 3D'}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">
              Belum ada model 3D. Upload sekarang!
            </p>
          )}
        </div>
      ) : (
        <div className="media-feed-container space-y-4 pb-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <i className="fa-regular fa-face-frown text-3xl block mb-2"></i>
              <p className="text-sm">Belum ada {activeTab === 'photo' ? 'foto' : activeTab === 'video' ? 'video' : 'riwayat perbaikan'}</p>
              <p className="text-xs">Upload sekarang untuk berbagi momen!</p>
            </div>
          ) : (
            filtered.map((item, index) => {
              const isVideo = item.file_type === 'videos' || item.file_type === 'video';
              const isImage = item.file_type === 'images' || item.file_type === 'image';
              const isDocument = !isVideo && !isImage;

              return (
                <div
                  key={item._id}
                  className="media-feed-item media-card group"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="relative bg-black/5 dark:bg-black/20">
                    {isImage && (
                      <img
                        src={item.file_url}
                        alt={item.description || 'Media'}
                        className="w-full max-h-[500px] object-contain cursor-pointer bg-gray-50 dark:bg-gray-900 transition-transform duration-300 group-hover:scale-[1.01]"
                        onClick={() => {
                          setCurrentMediaIndex(index);
                          setIsCarouselMode(true);
                        }}
                        loading="lazy"
                      />
                    )}
                    {isVideo && (
                      <video
                        src={item.file_url}
                        className="w-full max-h-[500px] object-contain rounded-t-2xl cursor-pointer bg-black"
                        controls
                        playsInline
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentMediaIndex(index);
                          setIsCarouselMode(true);
                        }}
                      />
                    )}
                    {isDocument && (
                      <div className="w-full h-48 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-pointer" onClick={() => window.open(item.file_url, '_blank')}>
                        <i className="fa-solid fa-file-pdf text-5xl mb-2"></i>
                        <span className="text-sm font-medium">{item.file_type || 'Dokumen'}</span>
                        <span className="text-xs">Klik untuk buka</span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 z-10 bg-black/50 backdrop-blur-sm text-white text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                      {item.media_type === 'photo' && '📷 Foto'}
                      {item.media_type === 'video' && '🎥 Video'}
                      {item.media_type === 'maintenance' && '🔧 Perbaikan'}
                    </div>

                    <div className="absolute bottom-3 right-3 z-10 bg-black/40 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded-full">
                      {index + 1} / {filtered.length}
                    </div>

                    {session && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item._id)}
                        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    )}
                  </div>

                  <div className="p-3 space-y-1.5">
                    <p className="text-sm font-medium text-gray-800 dark:text-white line-clamp-2">
                      {item.description || 'Tanpa deskripsi'}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <i className="fa-regular fa-calendar"></i>
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                      <span className="flex items-center gap-1">
                        <i className="fa-regular fa-clock"></i>
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-800 mt-1.5">
                      <button 
                        className={`social-btn group ${likeCounts[item._id]?.liked ? 'text-red-500' : ''}`} 
                        onClick={() => toggleLike(item._id)}
                      >
                        <i className={`fa-${likeCounts[item._id]?.liked ? 'solid' : 'regular'} fa-heart text-base group-hover:scale-110 transition-transform`}></i>
                        <span className="tabular-nums">{likeCounts[item._id]?.count || 0}</span>
                      </button>
                      <button 
                        className="social-btn ml-auto" 
                        onClick={() => handleShare(item)}
                      >
                        <i className="fa-regular fa-share-from-square text-base"></i>
                        <span className="tabular-nums">{shareCounts[item._id] || 0}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===== INDIKATOR TPOP ===== */}
      {userRole === 'tpop' && userPolygon && (
        <div className={`text-xs p-2 rounded-lg border ${
          isInside
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
        }`}>
          <i className={`fa-solid ${
            isInside ? 'fa-check-circle' : 'fa-exclamation-triangle'
          } mr-1`}></i>
          {isInside
            ? '✅ Anda berada di dalam wilayah kerja TPOP'
            : '⚠️ Pastikan Anda berada di dalam wilayah kerja TPOP untuk upload'
          }
        </div>
      )}

      {session && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
            Tambah {activeTab === 'maintenance' ? 'Perbaikan' : activeTab === 'video' ? 'Video' : activeTab === 'model_3d' ? 'Model 3D' : 'Foto'}
          </p>

          <div
            className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
              isDragging
                ? 'border-[#00c8ff] bg-[#00c8ff]/5'
                : 'border-gray-300 dark:border-gray-600 hover:border-[#00c8ff]'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = e.dataTransfer.files;
              if (files && files.length) {
                const validFiles = Array.from(files).filter(f => f.size <= 100 * 1024 * 1024);
                setSelectedFiles(prev => [...prev, ...validFiles]);
              }
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept={
                activeTab === 'video'
                  ? 'video/*'
                  : activeTab === 'maintenance'
                  ? 'application/pdf,image/*'
                  : activeTab === 'model_3d'
                  ? '.glb,.gltf'
                  : 'image/*,image/heic,image/heif'
              }
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 pointer-events-none">
              {selectedFiles.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-medium">{selectedFiles.length} file siap diupload</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {selectedFiles.slice(0, 5).map((f, idx) => (
                      <span key={idx} className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-[10px]">
                        {f.name} ({(f.size/1024/1024).toFixed(1)}MB)
                      </span>
                    ))}
                    {selectedFiles.length > 5 && <span className="text-gray-400">+{selectedFiles.length-5} lagi</span>}
                  </div>
                  <div className="flex justify-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-red-500 text-[10px] hover:underline"
                    >
                      Hapus semua
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-upload-alt text-2xl text-gray-300 dark:text-gray-500 mb-1 block"></i>
                  <span className="font-medium">Seret file ke sini atau klik untuk pilih</span>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {activeTab === 'video'
                      ? 'MP4, WebM, MOV (max 100MB)'
                      : activeTab === 'maintenance'
                      ? 'PDF, Gambar (max 100MB)'
                      : activeTab === 'model_3d'
                      ? 'GLB, GLTF (max 100MB)'
                      : 'JPG, PNG, GIF, WebP, HEIC (max 100MB)'}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <input
              type="text"
              placeholder="Deskripsi (opsional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
            />
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <i className="fa-solid fa-calendar-alt absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                  placeholder="Pilih tanggal & waktu"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={handleMultipleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              className={`w-full py-2 text-xs font-medium rounded-lg transition-all ${
                selectedFiles.length === 0 || uploading
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-[#00c8ff] text-white hover:bg-[#00c8ff]/90 shadow-md hover:shadow-lg'
              }`}
            >
              {uploading ? (
                <span>
                  Uploading {uploadIndex}/{selectedFiles.length} ({totalProgress}%)
                </span>
              ) : (
                <span>📤 Upload {selectedFiles.length} file</span>
              )}
            </button>
            {uploading && (
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00c8ff] transition-all duration-300 rounded-full"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {previewMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="max-w-4xl w-full max-h-[90vh] bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {previewMedia.file_type === 'videos' && (
              <video
                src={previewMedia.file_url}
                controls
                autoPlay
                className="w-full h-auto max-h-[80vh]"
              />
            )}
            {previewMedia.file_type === 'images' && (
              <img
                src={previewMedia.file_url}
                alt={previewMedia.description || 'Media'}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
            <div className="p-4 text-white">
              <p>{previewMedia.description || 'Tanpa deskripsi'}</p>
              <p className="text-sm text-gray-400">
                {new Date(previewMedia.timestamp).toLocaleDateString('id-ID')}
              </p>
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-red-500 rounded hover:bg-red-600 transition"
                onClick={() => setPreviewMedia(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}