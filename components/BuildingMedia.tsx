// components/BuildingMedia.tsx
'use client';
import * as turf from '@turf/turf';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import Model3DViewer from '@/components/Model3DViewer';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface MediaItem {
  _id: string;
  user_id: string;
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
  buildingLat?: number;
  buildingLon?: number;
  onMediaChange?: () => void;
  userRole?: string;
  userPolygon?: number[][];
  userLocation?: { lat: number; lng: number } | null;
}

// ============ MODULE-LEVEL HELPERS (hoisting-safe) ============
function ensureClosedRing(poly?: number[][] | null): number[][] | null {
  if (!Array.isArray(poly) || poly.length < 3) return null;
  const ring: number[][] = [];
  for (const p of poly) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (!isFinite(x) || !isFinite(y)) return null;
    ring.push([x, y]);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  if (ring.length < 4) return null;
  return ring;
}

function getUserIdFromToken(token?: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.sub || null;
  } catch {
    return null;
  }
}

function pointInPolygon(lat: number, lon: number, poly?: number[][] | null): boolean {
  const ring = ensureClosedRing(poly);
  if (!ring) return false;
  try {
    return turf.booleanPointInPolygon(
      turf.point([lon, lat]),
      turf.polygon([ring])
    );
  } catch (e) {
    console.warn('pointInPolygon error:', e);
    return false;
  }
}

export default function BuildingMedia({
  buildingId,
  buildingName,
  buildingLat,
  buildingLon,
  onMediaChange,
  userRole,
  userPolygon,
  userLocation,
}: BuildingMediaProps) {
  const { data: session } = useSession();

  // ============ STATE ============
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
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isCarouselMode, setIsCarouselMode] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ====== STATE EDIT ======
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [editMediaType, setEditMediaType] = useState<'photo' | 'video' | 'maintenance' | 'model_3d'>('photo');
  const [saving, setSaving] = useState(false);

  // ====== CURRENT USER ======
  const currentUserId = getUserIdFromToken(session?.accessToken);

  // ============ COMPUTED PERMISSION ============
  const roleNorm = (userRole || '').toLowerCase();
  const isPolygonRole = ['tpop', 'pob', 'juru', 'supervisor'].includes(roleNorm);
  const safePolygon = ensureClosedRing(userPolygon);

  const buildingInPolygon =
    typeof buildingLat === 'number' && typeof buildingLon === 'number'
      ? pointInPolygon(buildingLat, buildingLon, userPolygon)
      : false;

  const userInPolygon = userLocation
    ? pointInPolygon(userLocation.lat, userLocation.lng, userPolygon)
    : false;

  const canUploadHere: boolean =
    roleNorm === 'admin' ? true :
    isPolygonRole ? (!!safePolygon && buildingInPolygon) :
    roleNorm === 'reporter' ? userInPolygon :
    false;

  const canModifyMedia = (item: MediaItem): boolean => {
    if (!currentUserId) return false;
    if (roleNorm === 'admin') return true;
    if (item.user_id !== currentUserId) return false;
    if (isPolygonRole) return buildingInPolygon;
    return true;
  };

  const outsideReason: string | null =
    roleNorm === 'admin' ? null :
    isPolygonRole && !safePolygon
      ? '📍 Anda belum memiliki polygon wilayah kerja. Hubungi admin.'
      : isPolygonRole && !buildingInPolygon
      ? `📍 Bangunan ini di luar wilayah kerja ${roleNorm.toUpperCase()}. Upload tidak diizinkan.`
      : roleNorm === 'reporter' && !userInPolygon
      ? '📍 Anda harus berada di dalam wilayah kerja untuk upload.'
      : !roleNorm
      ? '📍 Anda tidak memiliki izin upload.'
      : null;

  const filtered = media.filter((item) => item.media_type === activeTab);

  // ===== KEY STABIL (biar useEffect gak spam) =====
  const mediaIdsKey = useMemo(
    () => filtered.map((item) => item._id).sort().join('|'),
    [filtered]
  );

  // ===== CACHE refs (fetch sekali per ID) =====
  const fetchedShareRef = useRef<Set<string>>(new Set());
  const fetchedLikeRef = useRef<Set<string>>(new Set());

  // ============ UPLOAD PERMISSION CHECK ============
  const checkUploadPermission = useCallback((): boolean => {
    if (!session?.accessToken) {
      alert('Login dulu!');
      return false;
    }
    if (!canUploadHere) {
      alert(outsideReason || '📍 Upload tidak diizinkan di lokasi ini.');
      return false;
    }
    return true;
  }, [session, canUploadHere, outsideReason]);

  // ============ LOAD MEDIA ============
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

  // ============ FETCH LIKE STATUS (sekali per ID) ============
  useEffect(() => {
    const ids = mediaIdsKey ? mediaIdsKey.split('|') : [];
    const toFetch = ids.filter(id => !fetchedLikeRef.current.has(id));
    if (toFetch.length === 0) return;

    let cancelled = false;

    (async () => {
      const headers = session?.accessToken
        ? { Authorization: `Bearer ${session.accessToken}` }
        : {};

      const results = await Promise.all(
        toFetch.map(async (id) => {
          try {
            const res = await axios.get(
              `${API_URL}/media/${id}/like/status`,
              { headers }
            );
            return { id, liked: res.data.liked, like_count: res.data.like_count };
          } catch {
            return { id, liked: false, like_count: 0 };
          }
        })
      );

      if (cancelled) return;

      toFetch.forEach(id => fetchedLikeRef.current.add(id));

      setLikeCounts(prev => {
        const next = { ...prev };
        results.forEach(r => {
          next[r.id] = { count: r.like_count, liked: r.liked };
        });
        return next;
      });
    })();

    return () => { cancelled = true; };
  }, [mediaIdsKey, session?.accessToken]);

  // ============ FETCH SHARE COUNT (sekali per ID) ============
  useEffect(() => {
    const ids = mediaIdsKey ? mediaIdsKey.split('|') : [];
    const toFetch = ids.filter(id => !fetchedShareRef.current.has(id));
    if (toFetch.length === 0) return;

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        toFetch.map(async (id) => {
          try {
            const res = await axios.get(`${API_URL}/media/${id}/share/count`);
            return { id, count: res.data.share_count };
          } catch {
            return { id, count: 0 };
          }
        })
      );

      if (cancelled) return;

      toFetch.forEach(id => fetchedShareRef.current.add(id));

      setShareCounts(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.id] = r.count; });
        return next;
      });
    })();

    return () => { cancelled = true; };
  }, [mediaIdsKey]);

  // ============ KOMPRESI GAMBAR ============
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

  // ============ HANDLE UPLOAD MULTIPLE ============
  const handleMultipleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Pilih file dulu!');
      return;
    }
    if (!checkUploadPermission()) return;

    setUploading(true);
    setUploadIndex(0);
    setTotalProgress(0);

    for (let i = 0; i < selectedFiles.length; i++) {
      let fileItem = selectedFiles[i];
      if (activeTab !== 'model_3d' && fileItem.type.startsWith('image/') && fileItem.type !== 'image/heic' && fileItem.type !== 'image/heif') {
        try {
          fileItem = await compressImage(fileItem);
        } catch (e) {
          console.warn('Kompresi gagal, lanjut tanpa kompresi');
        }
      }

      const formData = new FormData();
      formData.append('file', fileItem);
      formData.append('building_id', buildingId);
      formData.append('media_type', mediaType);
      formData.append('description', description);
      if (timestamp) formData.append('timestamp', timestamp);

      try {
        await axios.post(`${API_URL}/buildings/media/upload`, formData, {
          headers: {
            'Authorization': `Bearer ${session!.accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        setUploadIndex(i + 1);
        setTotalProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      } catch (err: any) {
        console.error('Upload error for', fileItem.name, err);
        alert(`Gagal upload ${fileItem.name}: ${err.response?.data?.detail || err.message}`);
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
    if (!checkUploadPermission()) return;

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
          'Authorization': `Bearer ${session!.accessToken}`,
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
    } catch (err: any) {
      console.error('Gagal hapus:', err);
      alert('❌ Gagal hapus media');
    }
  };

  const openEditModal = (item: MediaItem) => {
    if (!canModifyMedia(item)) {
      alert('❌ Anda hanya bisa mengedit media milik Anda di wilayah kerja Anda.');
      return;
    }
    setEditingMedia(item);
    setEditDescription(item.description || '');
    setEditMediaType(item.media_type);
    if (item.timestamp) {
      const d = new Date(item.timestamp);
      const pad = (n: number) => String(n).padStart(2, '0');
      setEditTimestamp(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    } else {
      setEditTimestamp('');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMedia) return;
    setSaving(true);
    try {
      const body: any = { description: editDescription };
      if (editMediaType !== editingMedia.media_type) body.media_type = editMediaType;
      if (editTimestamp) body.timestamp = editTimestamp;

      await axios.put(`${API_URL}/buildings/media/${editingMedia._id}`, body, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      toast.success('✅ Media berhasil diperbarui');
      setEditingMedia(null);
      await loadMedia();
      onMediaChange?.();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '❌ Gagal memperbarui media');
    } finally {
      setSaving(false);
    }
  };

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
  }, [activeTab, media, selectedModelUrl]);

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
    } catch (err: any) {
      console.error('Like error:', err);
      toast.error('Gagal like media');
    }
  };

  // ===== SHARE =====
  const handleShare = async (mediaItem: MediaItem) => {
    try {
      const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
      const res = await axios.post(`${API_URL}/media/${mediaItem._id}/share`, {}, { headers });
      const { shared, share_count } = res.data;

      if (shared) {
        setShareCounts(prev => ({
          ...prev,
          [mediaItem._id]: share_count
        }));
      }

      const shareData = {
        title: `📸 ${buildingName} - ${mediaItem.description || 'Media'}`,
        text: `Cek media dari ${buildingName} di Cipamingkis!`,
        url: mediaItem.file_url,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          toast.success('✅ Berhasil dibagikan!');
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Share error:', err);
            toast.error('Gagal share');
          }
        }
      } else {
        try {
          await navigator.clipboard.writeText(mediaItem.file_url);
          toast.success('🔗 Link disalin ke clipboard!');
        } catch {
          toast.error('Gagal copy link');
        }
      }
    } catch (err: any) {
      console.error('Share error:', err);
      toast.error('Gagal share media');
    }
  };

  // ============ EARLY RETURN ============
  if (!buildingId) return null;

  // ============ RENDER ============
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

                      {canModifyMedia(item) && (
                        <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="w-8 h-8 rounded-full bg-blue-500/85 text-white flex items-center justify-center hover:bg-blue-600 shadow-lg"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item._id)}  
                            className="w-8 h-8 rounded-full bg-red-500/85 text-white flex items-center justify-center hover:bg-red-600 shadow-lg"
                            title="Hapus"
                          >
                            <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
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

      {/* ===== INDIKATOR WILAYAH (general) ===== */}
      {session && (isPolygonRole || roleNorm === 'reporter') && (
        <div className={`text-xs p-2 rounded-lg border ${
          canUploadHere
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
        }`}>
          <i className={`fa-solid ${
            canUploadHere ? 'fa-check-circle' : 'fa-exclamation-triangle'
          } mr-1`}></i>
          {canUploadHere
            ? (isPolygonRole
                ? '✅ Bangunan ini di dalam wilayah kerja Anda'
                : '✅ Anda berada di dalam wilayah kerja')
            : (outsideReason || '⚠️ Pastikan bangunan berada di dalam wilayah kerja Anda untuk upload')}
        </div>
      )}

      {session && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
            Tambah {activeTab === 'maintenance' ? 'Perbaikan' : activeTab === 'video' ? 'Video' : activeTab === 'model_3d' ? 'Model 3D' : 'Foto'}
          </p>

          {!canUploadHere && outsideReason && (
            <div className="mb-2 text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5">
              <i className="fa-solid fa-lock mr-1"></i>
              {outsideReason}
            </div>
          )}

          <div
            className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
              isDragging
                ? 'border-[#00c8ff] bg-[#00c8ff]/5'
                : canUploadHere
                ? 'border-gray-300 dark:border-gray-600 hover:border-[#00c8ff]'
                : 'border-gray-200 dark:border-gray-700 opacity-60'
            }`}
            onDragEnter={canUploadHere ? handleDragEnter : undefined}
            onDragLeave={canUploadHere ? handleDragLeave : undefined}
            onDragOver={canUploadHere ? handleDragOver : undefined}
            onDrop={canUploadHere ? (e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = e.dataTransfer.files;
              if (files && files.length) {
                const validFiles = Array.from(files).filter(f => f.size <= 100 * 1024 * 1024);
                setSelectedFiles(prev => [...prev, ...validFiles]);
              }
            } : (e) => { e.preventDefault(); }}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              disabled={!canUploadHere}
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
              disabled={selectedFiles.length === 0 || uploading || !canUploadHere}
              className={`w-full py-2 text-xs font-medium rounded-lg transition-all ${
                selectedFiles.length === 0 || uploading || !canUploadHere
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-[#00c8ff] text-white hover:bg-[#00c8ff]/90 shadow-md hover:shadow-lg'
              }`}
            >
              {uploading ? (
                <span>
                  Uploading {uploadIndex}/{selectedFiles.length} ({totalProgress}%)
                </span>
              ) : !canUploadHere ? (
                <span>🔒 Upload tidak diizinkan di sini</span>
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

      {editingMedia && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => !saving && setEditingMedia(null)}
          >
            <div
              className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-pen text-[#00c8ff]"></i>
                  Edit Media
                </h3>
                <button
                  type="button"
                  onClick={() => !saving && setEditingMedia(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Preview thumbnail */}
              <div className="rounded-lg overflow-hidden bg-black/5 dark:bg-black/20 max-h-40 flex items-center justify-center">
                {editingMedia.file_type === 'videos' ? (
                  <video src={editingMedia.file_url} className="max-h-40" muted />
                ) : editingMedia.file_type === 'images' ? (
                  <img src={editingMedia.file_url} className="max-h-40 object-contain" alt="preview" />
                ) : (
                  <i className="fa-solid fa-file text-4xl text-gray-400 py-10"></i>
                )}
              </div>

              {/* Media Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Kategori
                </label>
                <select
                  value={editMediaType}
                  onChange={(e) => setEditMediaType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f0f1e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                >
                  <option value="photo">📷 Foto</option>
                  <option value="video">🎥 Video</option>
                  <option value="maintenance">🔧 Perbaikan</option>
                  <option value="model_3d">🧊 Model 3D</option>
                </select>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f0f1e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                  placeholder="Deskripsi media..."
                />
              </div>

              {/* Timestamp */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Tanggal & Waktu
                </label>
                <input
                  type="datetime-local"
                  value={editTimestamp}
                  onChange={(e) => setEditTimestamp(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f0f1e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditingMedia(null)}
                  className="flex-1 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveEdit}
                  className="flex-1 py-2 text-xs rounded-lg bg-[#00c8ff] text-white hover:bg-[#00c8ff]/90 disabled:opacity-50 font-medium"
                >
                  {saving ? 'Menyimpan...' : '💾 Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}