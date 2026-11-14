// components/BuildingMedia.tsx
'use client';
import * as turf from '@turf/turf';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import UploadModal from '@/components/media/UploadModal';

const Model3DViewer = dynamic(() => import('@/components/Model3DViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] sm:h-[450px] bg-neutral-950 rounded-xl flex flex-col items-center justify-center gap-3 border border-neutral-800">
      <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-white/70 text-xs font-medium">Memuat 3D Engine...</p>
    </div>
  ),
});

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
  user_name?: string | null;
  user_full_name?: string | null;
  user_role?: string | null;
  user_exists?: boolean;
  mentions?: Array<{ id: string; username: string; full_name?: string | null }>;
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

// ============ MODULE-LEVEL HELPERS ============
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

  // ============ CORE STATE ============
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'photo' | 'video' | 'maintenance' | 'model_3d'>('photo');
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const models3D = useMemo(() => media.filter(m => m.media_type === 'model_3d'), [media]);
  const effectiveModelUrl = selectedModelUrl || (models3D.length > 0 ? models3D[models3D.length - 1].file_url : null);
  const [is3DActive, setIs3DActive] = useState(false);

  const selectedModelItem = useMemo(() => {
    return models3D.find(m => m.file_url === effectiveModelUrl) || (models3D.length > 0 ? models3D[models3D.length - 1] : null);
  }, [models3D, effectiveModelUrl]);

  const handleTabClick = useCallback((tabKey: 'photo' | 'video' | 'maintenance' | 'model_3d') => {
    if (tabKey === 'model_3d' && !selectedModelUrl && models3D.length > 0) {
      setSelectedModelUrl(models3D[models3D.length - 1].file_url);
    }
    setActiveTab(tabKey);
  }, [models3D, selectedModelUrl]);
  const [likeCounts, setLikeCounts] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});

  // ===== VIEW MODE & LIGHTBOX =====
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed');
  const [lightbox, setLightbox] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const [gridLimit, setGridLimit] = useState(60);

  // ===== FULLSCREEN MODE =====
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  // ===== FEED SLIDER =====
  const [slideIndexes, setSlideIndexes] = useState<Record<string, number>>({});

  // ===== VIDEO FEED =====
  const videoFeedRef = useRef<HTMLDivElement | null>(null);
  const videoRefsMap = useRef<Map<string, HTMLVideoElement>>(new Map());
  const ioRef = useRef<IntersectionObserver | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [mutedVideos, setMutedVideos] = useState<Record<string, boolean>>({});
  const [pausedVideos, setPausedVideos] = useState<Record<string, boolean>>({});
  const [bufferingVideos, setBufferingVideos] = useState<Record<string, boolean>>({});
  const [videoProgress, setVideoProgress] = useState<Record<string, { played: number; buffered: number }>>({});
  const [lightboxBuffering, setLightboxBuffering] = useState(false);

  // ====== EDIT ======
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [editMediaType, setEditMediaType] = useState<'photo' | 'video' | 'maintenance' | 'model_3d'>('photo');
  const [saving, setSaving] = useState(false);

  // ===== SWIPE REFS =====
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);
  const swipeJustHappenedRef = useRef(false);
  const lightboxTouchRef = useRef<{ startX: number | null; deltaX: number }>({
    startX: null,
    deltaX: 0,
  });

  // ===== FETCH GUARD REFS =====
  const fetchedShareRef = useRef<Set<string>>(new Set());
  const fetchedLikeRef = useRef<Set<string>>(new Set());
  const fetchedViewRef = useRef<Set<string>>(new Set());
  const trackedViewRef = useRef<Set<string>>(new Set());

  // ====== CURRENT USER ======
  const currentUserId = getUserIdFromToken(session?.accessToken);
  const [refreshingMedia, setRefreshingMedia] = useState(false);
  // ===== SSR PORTAL READY =====
  useEffect(() => { setPortalReady(true); }, []);

  // ===== UPLOADER LABEL =====
  const getUploaderLabel = useCallback(
    (item: MediaItem): { name: string; isMe: boolean; role?: string | null; deleted: boolean } => {
      const isMe = !!currentUserId && String(item.user_id) === String(currentUserId);

      if (item.user_exists === false && !isMe) {
        return { name: 'User Terhapus', isMe: false, role: null, deleted: true };
      }

      const rawName =
        item.user_name ||
        item.user_full_name ||
        (isMe ? (session?.user as any)?.name : null) ||
        (isMe ? (session?.user as any)?.email?.split('@')[0] : null) ||
        'Anonim';

      return { name: rawName, isMe, role: item.user_role, deleted: false };
    },
    [currentUserId, session]
  );

  // ============ COMPUTED PERMISSION ============
  const roleNorm = (userRole || '').toLowerCase();
  const isPolygonRole = ['tpop', 'pob', 'juru', 'supervisor'].includes(roleNorm);
  const safePolygon = ensureClosedRing(userPolygon);

  function formatDateID(value?: string | null, withTime = false): string {
    if (!value) return '-';
    const t = new Date(value).getTime();
    if (!isFinite(t)) return '-';
    const opts: Intl.DateTimeFormatOptions = withTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(t).toLocaleDateString('id-ID', opts);
  }

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

  const mediaIdsKey = useMemo(
    () => filtered.map((item) => item._id).sort().join('|'),
    [filtered]
  );

  // ===== GROUPING (photo & maintenance) =====
  const grouped = useMemo(() => {
    if (activeTab !== 'photo' && activeTab !== 'maintenance') {
      return filtered.map(item => ({ key: item._id, items: [item] }));
    }

    const BATCH_WINDOW_MS = 5 * 60 * 1000;
    const groups: { key: string; items: MediaItem[] }[] = [];

    const getTime = (item: MediaItem): number => {
      const t = new Date(item.created_at).getTime();
      if (isFinite(t)) return t;
      const t2 = new Date(item.timestamp).getTime();
      if (isFinite(t2)) return t2;
      return 0;
    };

    const sorted = [...filtered].sort((a, b) => getTime(a) - getTime(b));

    for (const item of sorted) {
      const last = groups[groups.length - 1];
      if (last) {
        const prev = last.items[last.items.length - 1];
        const sameUser = String(prev.user_id) === String(item.user_id);
        const sameDesc = (prev.description || '') === (item.description || '');
        const sameType = prev.media_type === item.media_type;
        const sameTimestamp = prev.timestamp === item.timestamp;
        const dt = Math.abs(getTime(item) - getTime(prev));

        if (sameUser && sameDesc && sameType && (sameTimestamp || dt <= BATCH_WINDOW_MS)) {
          last.items.push(item);
          continue;
        }
      }
      groups.push({ key: item._id, items: [item] });
    }
    return groups;
  }, [filtered, activeTab]);

  // ============ RESET GRID LIMIT ============
  useEffect(() => { setGridLimit(60); }, [buildingId, activeTab]);

  // ============ ESC FULLSCREEN ============
  useEffect(() => {
    if (!fullscreenMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightbox && !editingMedia) {
        setFullscreenMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenMode, lightbox, editingMedia]);

  // ============ BODY SCROLL LOCK ============
  useEffect(() => {
    if (!fullscreenMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [fullscreenMode]);

  // ============ FETCH VIEW COUNT ============
  useEffect(() => {
    const ids = mediaIdsKey ? mediaIdsKey.split('|') : [];
    const toFetch = ids.filter(id => !fetchedViewRef.current.has(id));
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/media/views/batch`, { params: { ids: toFetch.join(',') } });
        if (cancelled) return;
        const views = res.data.views || {};
        toFetch.forEach(id => fetchedViewRef.current.add(id));
        setViewCounts(prev => ({ ...prev, ...views }));
      } catch (e) { console.error('Fetch views batch error:', e); }
    })();
    return () => { cancelled = true; };
  }, [mediaIdsKey]);

  // ============ FETCH LIKE ============
  useEffect(() => {
    const ids = mediaIdsKey ? mediaIdsKey.split('|') : [];
    const toFetch = ids.filter(id => !fetchedLikeRef.current.has(id));
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
      const results = await Promise.all(
        toFetch.map(async (id) => {
          try {
            const res = await axios.get(`${API_URL}/media/${id}/like/status`, { headers });
            return { id, liked: res.data.liked, like_count: res.data.like_count };
          } catch { return { id, liked: false, like_count: 0 }; }
        })
      );
      if (cancelled) return;
      toFetch.forEach(id => fetchedLikeRef.current.add(id));
      setLikeCounts(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.id] = { count: r.like_count, liked: r.liked }; });
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [mediaIdsKey, session?.accessToken]);

  // ============ FETCH SHARE ============
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
          } catch { return { id, count: 0 }; }
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

  // ============ LOAD MEDIA ============
    const loadMedia = useCallback(async (opts?: { silent?: boolean }) => {
      if (!buildingId) return;
      if (opts?.silent) setRefreshingMedia(true);
      else setLoading(true);

      try {
        const res = await axios.post(
          `${API_URL}/buildings/media/batch`,
          [buildingId],
          {
            headers: { 'Cache-Control': 'no-cache' },
            timeout: 30_000,
          },
        );
        const mediaData = res.data?.media || {};
        setMedia(mediaData[buildingId] || []);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setMedia([]);
        } else {
          console.error('Gagal load media:', err);
          if (!opts?.silent) toast.error('Gagal memuat media, coba refresh');
        }
      } finally {
        if (opts?.silent) setRefreshingMedia(false);
        else setLoading(false);
      }
    }, [buildingId]);

    useEffect(() => { void loadMedia(); }, [loadMedia]);

    // ============ UPLOAD HANDLERS (🆕 — INI YANG BELUM ADA) ============
    const handleUploadSuccess = useCallback(async () => {
      await loadMedia({ silent: true });
      onMediaChange?.();
    }, [loadMedia, onMediaChange]);

    const handleUploadError = useCallback((msg: string) => {
      toast.error(msg);
    }, []);

  // ============ TRACK VIEW ============
  const trackView = useCallback(async (mediaId: string) => {
    if (!mediaId) return;
    if (trackedViewRef.current.has(mediaId)) return;
    trackedViewRef.current.add(mediaId);
    try {
      let deviceId: string = localStorage.getItem('device_id') ?? '';
      if (!deviceId) {
        deviceId = (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem('device_id', deviceId);
      }
      const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
      const res = await axios.post(`${API_URL}/media/${mediaId}/view`, {}, { params: { device_id: deviceId }, headers });
      const view_count = res.data?.view_count ?? 0;
      setViewCounts(prev => ({ ...prev, [mediaId]: view_count }));
    } catch (err) {
      console.error('View track error:', err);
      trackedViewRef.current.delete(mediaId);
    }
  }, [session?.accessToken]);

  // ============ OPEN LIGHTBOX ============
  const openLightbox = useCallback((items: MediaItem[], index: number) => {
    const item = items[index];
    if (item?._id) trackView(item._id);
    setLightbox({ items, index });
  }, [trackView]);

  // ============ LIGHTBOX KEYBOARD NAV ============
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowLeft' && lightbox.items.length > 1) {
        setLightbox(p => p ? { ...p, index: (p.index - 1 + p.items.length) % p.items.length } : null);
      }
      if (e.key === 'ArrowRight' && lightbox.items.length > 1) {
        setLightbox(p => p ? { ...p, index: (p.index + 1) % p.items.length } : null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  // ============ VIDEO AUTOPLAY ON SCROLL ============
  useEffect(() => {
    if (activeTab !== 'video') return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLVideoElement;
          const id = el.dataset.mediaId;
          if (!id) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActiveVideoId(id);
            trackView(id);
            el.preload = 'auto';
            el.muted = mutedVideos[id] ?? true;
            if (!pausedVideos[id]) el.play().catch(() => {});
          } else {
            el.pause();
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );
    ioRef.current = io;
    videoRefsMap.current.forEach((el) => io.observe(el));
    return () => { io.disconnect(); ioRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, mediaIdsKey, fullscreenMode]);

  const setVideoRef = useCallback((id: string) => (el: HTMLVideoElement | null) => {
    if (el) {
      el.dataset.mediaId = id;
      videoRefsMap.current.set(id, el);
      ioRef.current?.observe(el);
    } else {
      const prev = videoRefsMap.current.get(id);
      if (prev) { ioRef.current?.unobserve(prev); videoRefsMap.current.delete(id); }
    }
  }, []);

  // ============ VIDEO BUFFERING HANDLERS ============
  const handleVideoWaiting = useCallback((id: string) => {
    setBufferingVideos((prev) => ({ ...prev, [id]: true }));
  }, []);

  const handleVideoCanPlay = useCallback((id: string) => {
    setBufferingVideos((prev) => ({ ...prev, [id]: false }));
  }, []);

  const handleVideoProgress = useCallback((id: string, el: HTMLVideoElement) => {
    if (!el.duration) return;
    const played = (el.currentTime / el.duration) * 100;
    let buffered = 0;
    if (el.buffered.length > 0) {
      for (let i = 0; i < el.buffered.length; i++) {
        if (el.buffered.start(i) <= el.currentTime && el.currentTime <= el.buffered.end(i)) {
          buffered = (el.buffered.end(i) / el.duration) * 100;
          break;
        }
      }
      if (buffered === 0 && el.buffered.length > 0) {
        buffered = (el.buffered.end(el.buffered.length - 1) / el.duration) * 100;
      }
    }
    setVideoProgress((prev) => ({
      ...prev,
      [id]: { played, buffered },
    }));
  }, []);

  const toggleVideoMute = (id: string) => {
    setMutedVideos((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      const el = videoRefsMap.current.get(id);
      if (el) el.muted = next[id];
      return next;
    });
  };

  const toggleVideoPlay = (id: string) => {
    const el = videoRefsMap.current.get(id);
    if (!el) return;
    setPausedVideos((prev) => {
      const isPaused = prev[id] ?? false;
      if (isPaused) el.play().catch(() => {});
      else el.pause();
      return { ...prev, [id]: !isPaused };
    });
  };

  const toggleVideoFullscreen = async (id: string) => {
    const el = videoRefsMap.current.get(id);
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        const anyEl = el as any;
        if (typeof el.requestFullscreen === 'function') await el.requestFullscreen();
        else if (typeof anyEl.webkitEnterFullscreen === 'function') anyEl.webkitEnterFullscreen();
      }
    } catch (err) { console.warn('Video fullscreen gagal:', err); }
  };

  // ============ MODEL 3D AUTO SELECT ============
  useEffect(() => {
    if (models3D.length > 0) {
      if (!selectedModelUrl || !models3D.some(m => m.file_url === selectedModelUrl)) {
        setSelectedModelUrl(models3D[models3D.length - 1].file_url);
      }
    } else if (selectedModelUrl) {
      setSelectedModelUrl(null);
    }
  }, [models3D, selectedModelUrl]);

  // ============ MODEL 3D VIEW TRACKING ============
  useEffect(() => {
    if (activeTab === 'model_3d' && selectedModelItem?._id) {
      trackView(selectedModelItem._id);
    }
  }, [activeTab, selectedModelItem?._id, trackView]);

  // ============ LIKE ============
  const toggleLike = async (mediaId: string) => {
    try {
      const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
      const res = await axios.post(`${API_URL}/media/${mediaId}/like`, {}, { headers });
      const { liked, like_count } = res.data;
      setLikeCounts(prev => ({ ...prev, [mediaId]: { count: like_count, liked } }));
    } catch (err: any) {
      console.error('Like error:', err);
      toast.error('Gagal like media');
    }
  };

  // ============ SHARE ============
  const handleShare = async (mediaItem: MediaItem) => {
    try {
      const headers = session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
      const res = await axios.post(`${API_URL}/media/${mediaItem._id}/share`, {}, { headers });
      const { shared, share_count } = res.data;
      if (shared) setShareCounts(prev => ({ ...prev, [mediaItem._id]: share_count }));

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
          if (err.name !== 'AbortError') { console.error('Share error:', err); toast.error('Gagal share'); }
        }
      } else {
        try { await navigator.clipboard.writeText(mediaItem.file_url); toast.success('🔗 Link disalin ke clipboard!'); }
        catch { toast.error('Gagal copy link'); }
      }
    } catch (err: any) {
      console.error('Share error:', err);
      toast.error('Gagal share media');
    }
  };

  // ============ EDIT ============
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
      setEditTimestamp(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else setEditTimestamp('');
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
    } finally { setSaving(false); }
  };

  if (!buildingId) return null;

  // ============ MAIN CONTENT (dipakai inline & fullscreen) ============
  const mainContent = (
    <div className={fullscreenMode ? 'h-full flex flex-col bg-black' : 'space-y-4'}>

      {/* ===== HEADER ===== */}
      {fullscreenMode ? (
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-black border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 text-white min-w-0">
            <span className="text-lg">📸</span>
            <span className="text-sm font-semibold truncate">{buildingName}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(activeTab === 'photo' || activeTab === 'maintenance') && !loading && filtered.length > 0 && (
              <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('feed')}
                  className={`px-2 py-1 rounded text-[11px] transition ${
                    viewMode === 'feed' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                  title="Tampilan Feed"
                >
                  <i className="fa-solid fa-list" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-1 rounded text-[11px] transition ${
                    viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                  title="Tampilan Grid"
                >
                  <i className="fa-solid fa-table-cells" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFullscreenMode(false)}
              className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition"
              title="Tutup (ESC)"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2 min-w-0">
            <span className="text-lg">📸</span>
            <span className="truncate">Media & Riwayat {buildingName}</span>
          </h4>
          <div className="flex items-center gap-1.5 shrink-0">
            {(activeTab === 'photo' || activeTab === 'maintenance') && !loading && filtered.length > 0 && (
              <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('feed')}
                  className={`px-2 py-1 rounded text-[11px] transition ${
                    viewMode === 'feed' ? 'bg-white dark:bg-gray-700 text-[#00c8ff] shadow-sm' : 'text-gray-500'
                  }`}
                  title="Tampilan Feed"
                >
                  <i className="fa-solid fa-list" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-1 rounded text-[11px] transition ${
                    viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-[#00c8ff] shadow-sm' : 'text-gray-500'
                  }`}
                  title="Tampilan Grid"
                >
                  <i className="fa-solid fa-table-cells" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFullscreenMode(true)}
              className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition shrink-0"
              title="Fullscreen Slide"
            >
              <i className="fa-solid fa-expand" />
            </button>
          </div>
        </div>
      )}

      {/* ===== TABS ===== */}
      <div className={
        fullscreenMode
          ? 'flex items-center gap-1 px-4 py-2 bg-black border-b border-white/10 overflow-x-auto shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex items-center gap-1 border-b border-gray-200 dark:border-gray-700'
      }>
        <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { key: 'photo', label: '📷 Foto' },
            { key: 'video', label: '🎥 Video' },
            { key: 'maintenance', label: '🔧 Perbaikan' },
            { key: 'model_3d', label: '🧊 3D' },
          ].map((tab) => {
            const count = media.filter(m => m.media_type === tab.key).length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabClick(tab.key as any)}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isActive
                    ? fullscreenMode
                      ? 'bg-white/20 text-white shadow-md'
                      : 'bg-[#00c8ff] text-white shadow-md'
                    : fullscreenMode
                      ? 'text-white/60 hover:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{count}</span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* ===== CONTENT ===== */}
      <div className={fullscreenMode ? 'flex-1 min-h-0 overflow-y-auto bg-neutral-950' : ''}>
        {/* ===== TAB 3D ===== */}
        <div className={activeTab === 'model_3d' ? (fullscreenMode ? 'p-4 space-y-4' : 'space-y-4') : 'hidden'}>
          {models3D.length > 0 && selectedModelItem ? (
            <>
              {/* Selector jika ada lebih dari 1 model 3D */}
              {models3D.length > 1 && (
                <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-100 dark:border-white/5">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 self-center mr-1">
                    Pilih Objek:
                  </span>
                  {models3D.map((item, idx) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => setSelectedModelUrl(item.file_url)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                        effectiveModelUrl === item.file_url
                          ? 'border-[#00c8ff] bg-[#00c8ff]/10 text-[#00c8ff] font-semibold'
                          : fullscreenMode
                            ? 'border-white/20 text-white/80 hover:border-[#00c8ff]'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#00c8ff]'
                      }`}
                    >
                      <i className="fa-solid fa-cube text-[10px]"></i>
                      <span className="max-w-[140px] truncate">{item.description || `Model ${idx + 1}`}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* AREA 3D: Mode Ringan (Preview Card) vs Mode Interaktif (WebGL) */}
              {is3DActive ? (
                <div className="relative">
                  <Model3DViewer
                    url={effectiveModelUrl}
                    className={
                      fullscreenMode
                        ? 'w-full h-[calc(100vh-320px)] min-h-[420px]'
                        : 'w-full h-[380px] sm:h-[460px]'
                    }
                    onClose={() => setIs3DActive(false)}
                  />
                  {/* Floating social bar di dalam 3D Interaktif */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
                    <button
                      type="button"
                      onClick={() => toggleLike(selectedModelItem._id)}
                      className={`flex items-center gap-1 text-xs font-semibold transition cursor-pointer ${
                        likeCounts[selectedModelItem._id]?.liked ? 'text-red-400' : 'text-white/80 hover:text-white'
                      }`}
                      title={likeCounts[selectedModelItem._id]?.liked ? 'Batal Suka' : 'Suka'}
                    >
                      <i className={`fa-${likeCounts[selectedModelItem._id]?.liked ? 'solid text-red-500 animate-pulse' : 'regular'} fa-heart`}></i>
                      <span className="tabular-nums">{likeCounts[selectedModelItem._id]?.count || 0}</span>
                    </button>
                    <span className="text-white/30 text-xs">•</span>
                    <span className="flex items-center gap-1 text-xs text-white/80" title="Jumlah tayangan">
                      <i className="fa-regular fa-eye text-[#00c8ff]"></i>
                      <span className="tabular-nums">{viewCounts[selectedModelItem._id] || 0}</span>
                    </span>
                    <span className="text-white/30 text-xs">•</span>
                    <button
                      type="button"
                      onClick={() => handleShare(selectedModelItem)}
                      className="flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white transition cursor-pointer"
                      title="Bagikan"
                    >
                      <i className="fa-solid fa-share text-[11px]"></i>
                      <span className="tabular-nums">{shareCounts[selectedModelItem._id] || 0}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-[300px] sm:h-[360px] rounded-xl overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-800 flex flex-col items-center justify-center p-6 text-center select-none shadow-inner">
                  {/* Grid background effect */}
                  <div
                    className="absolute inset-0 opacity-15 pointer-events-none"
                    style={{
                      backgroundImage: 'radial-gradient(circle, #00c8ff 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                  />

                  {/* Top-right View Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] text-white/90 border border-white/10 flex items-center gap-1.5 font-medium shadow-sm">
                      <i className="fa-regular fa-eye text-[#00c8ff]"></i>
                      <span className="tabular-nums">{viewCounts[selectedModelItem._id] || 0} tayangan</span>
                    </span>
                  </div>

                  {/* Icon 3D */}
                  <div className="relative mb-3">
                    <div className="w-16 h-16 rounded-2xl bg-[#00c8ff]/10 border border-[#00c8ff]/30 flex items-center justify-center text-[#00c8ff] text-2xl shadow-xl shadow-[#00c8ff]/10">
                      <i className="fa-solid fa-cube"></i>
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c8ff] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00c8ff]"></span>
                    </span>
                  </div>

                  <h4 className="text-white font-semibold text-sm mb-1 max-w-sm truncate">
                    {selectedModelItem.description || 'Model 3D Objek Bangunan'}
                  </h4>
                  <p className="text-gray-400 text-xs max-w-xs mb-5">
                    Objek 3D siap dilihat. Muat tampilan 3D saat ingin memutar & memperbesar objek tanpa membebani browser.
                  </p>

                  <div className="flex items-center gap-2 flex-wrap justify-center z-10">
                    <button
                      type="button"
                      onClick={() => setIs3DActive(true)}
                      className="px-4 py-2.5 bg-gradient-to-r from-[#00c8ff] to-blue-600 hover:from-[#00b0e0] hover:to-blue-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#00c8ff]/25 transition flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <i className="fa-solid fa-eye text-xs"></i>
                      <span>Lihat 3D Interaktif</span>
                    </button>

                    {/* Quick Like & Share di Card */}
                    <button
                      type="button"
                      onClick={() => toggleLike(selectedModelItem._id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold backdrop-blur-md border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                        likeCounts[selectedModelItem._id]?.liked
                          ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                          : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                      }`}
                      title={likeCounts[selectedModelItem._id]?.liked ? 'Batal Suka' : 'Suka'}
                    >
                      <i className={`fa-${likeCounts[selectedModelItem._id]?.liked ? 'solid text-red-500' : 'regular'} fa-heart text-sm`}></i>
                      <span className="tabular-nums">{likeCounts[selectedModelItem._id]?.count || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShare(selectedModelItem)}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold backdrop-blur-md border border-white/15 bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Bagikan"
                    >
                      <i className="fa-solid fa-share text-xs"></i>
                      <span className="tabular-nums">{shareCounts[selectedModelItem._id] || 0}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ===== INFO UPLOADER & DETAIL MODEL (SESUAI REQUEST USER) ===== */}
              {(() => {
                const uploader = getUploaderLabel(selectedModelItem);
                const uploadDate = formatDateID(selectedModelItem.timestamp || selectedModelItem.created_at, true);
                return (
                  <div className={`rounded-xl p-3.5 space-y-2.5 border transition ${
                    fullscreenMode
                      ? 'bg-neutral-900 border-white/10 text-white'
                      : 'bg-gray-50 dark:bg-[#1f1f38] border-gray-200 dark:border-gray-700/60 text-gray-800 dark:text-gray-100'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          uploader.deleted ? 'bg-gray-600 text-gray-300' :
                          uploader.isMe ? 'bg-[#00c8ff] text-white shadow-sm' :
                          'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm'
                        }`}>
                          {uploader.deleted ? '?' : uploader.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Name & Role */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold truncate">
                              {uploader.deleted ? uploader.name : `@${uploader.name}`}
                            </span>
                            {uploader.isMe && !uploader.deleted && (
                              <span className="text-[9px] bg-[#00c8ff]/20 text-[#00c8ff] px-1.5 py-0.5 rounded-full font-medium">
                                Anda
                              </span>
                            )}
                            {uploader.role && !uploader.deleted && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium ${
                                fullscreenMode
                                  ? 'bg-white/10 text-white/80'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}>
                                {uploader.role}
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${
                            fullscreenMode ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            <i className="fa-regular fa-calendar"></i>
                            <span>Diupload pada: {uploadDate}</span>
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      {canModifyMedia(selectedModelItem) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(selectedModelItem)}
                            className={`p-1.5 rounded-lg transition ${
                              fullscreenMode
                                  ? 'bg-white/10 hover:bg-white/20 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                            }`}
                            title="Edit keterangan model"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Catatan / Keterangan */}
                    {selectedModelItem.description && (
                      <p className={`text-xs p-2 rounded-lg border ${
                        fullscreenMode
                          ? 'bg-black/30 border-white/5 text-white/90'
                          : 'bg-white dark:bg-black/20 border-gray-100 dark:border-white/5 text-gray-700 dark:text-gray-300'
                      }`}>
                        {selectedModelItem.description}
                      </p>
                    )}

                    {/* Social Media Action Row */}
                    <div className={`flex items-center gap-4 pt-2.5 border-t mt-2 ${
                      fullscreenMode ? 'border-white/10' : 'border-gray-200 dark:border-gray-700/60'
                    }`}>
                      {/* Love / Like */}
                      <button
                        type="button"
                        onClick={() => toggleLike(selectedModelItem._id)}
                        className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
                          likeCounts[selectedModelItem._id]?.liked
                            ? 'text-red-500 bg-red-500/10 dark:bg-red-500/20'
                            : 'text-gray-600 dark:text-gray-300 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                        title={likeCounts[selectedModelItem._id]?.liked ? 'Batal menyukai' : 'Sukai model ini'}
                      >
                        <i className={`fa-${likeCounts[selectedModelItem._id]?.liked ? 'solid text-red-500 animate-pulse' : 'regular'} fa-heart text-sm`}></i>
                        <span className="tabular-nums">{likeCounts[selectedModelItem._id]?.count || 0} Suka</span>
                      </button>

                      {/* View Count */}
                      <div
                        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 py-1 px-2 cursor-default"
                        title="Jumlah pengguna yang melihat model 3D ini"
                      >
                        <i className="fa-regular fa-eye text-sm text-[#00c8ff]"></i>
                        <span className="tabular-nums font-medium">{viewCounts[selectedModelItem._id] || 0} tayangan</span>
                      </div>

                      {/* Share */}
                      <button
                        type="button"
                        onClick={() => handleShare(selectedModelItem)}
                        className="ml-auto flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-[#00c8ff] hover:bg-[#00c8ff]/10 py-1 px-2.5 rounded-lg transition cursor-pointer"
                        title="Bagikan link model 3D"
                      >
                        <i className="fa-solid fa-share text-xs"></i>
                        <span className="tabular-nums font-medium">{shareCounts[selectedModelItem._id] || 0} Bagikan</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className={`text-center py-12 flex flex-col items-center justify-center ${
              fullscreenMode ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'
            }`}>
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-2xl mb-3">
                <i className="fa-solid fa-cube"></i>
              </div>
              <p className="text-sm font-medium">Belum ada model 3D</p>
              <p className="text-xs mt-0.5 text-gray-400/80">Upload file format .glb atau .gltf untuk menampilkan objek 3D!</p>
            </div>
          )}
        </div>

        {activeTab === 'video' ? (
          <div
            ref={videoFeedRef}
            className={`relative overflow-y-auto snap-y snap-mandatory bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              fullscreenMode
                ? 'h-full'
                : 'rounded-xl h-[70vh] min-h-[420px] max-h-[640px]'
            }`}
          >
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 flex flex-col items-center justify-center h-full">
                <i className="fa-regular fa-face-frown text-3xl block mb-2"></i>
                <p className="text-sm">Belum ada video</p>
                <p className="text-xs">Upload sekarang untuk berbagi momen!</p>
              </div>
            ) : (
              filtered.map((item, idx) => {
                const { name, isMe, role, deleted } = getUploaderLabel(item);
                const isMuted = mutedVideos[item._id] ?? true;
                const isPaused = pausedVideos[item._id] ?? false;
                return (
                  <div key={item._id} className="snap-start snap-always relative w-full h-full flex items-center justify-center bg-black">
                    <video
                      ref={setVideoRef(item._id)}
                      src={item.file_url}
                      className="w-full h-full object-contain cursor-pointer"
                      loop
                      playsInline
                      preload={activeVideoId === item._id || (idx === 0 && !activeVideoId) ? 'auto' : 'none'}
                      muted={isMuted}
                      onClick={() => toggleVideoPlay(item._id)}
                      onDoubleClick={() => toggleVideoFullscreen(item._id)}
                      onWaiting={() => handleVideoWaiting(item._id)}
                      onStalled={() => handleVideoWaiting(item._id)}
                      onPlaying={() => handleVideoCanPlay(item._id)}
                      onCanPlay={() => handleVideoCanPlay(item._id)}
                      onLoadedData={() => handleVideoCanPlay(item._id)}
                      onTimeUpdate={(e) => handleVideoProgress(item._id, e.currentTarget)}
                      onProgress={(e) => handleVideoProgress(item._id, e.currentTarget)}
                    />

                    {isPaused && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                          <i className="fa-solid fa-play text-white text-2xl ml-1"></i>
                        </div>
                      </div>
                    )}

                    <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
                      <button type="button" onClick={() => toggleLike(item._id)} className="flex flex-col items-center cursor-pointer group">
                        <div className={`w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition group-hover:scale-110 ${
                          likeCounts[item._id]?.liked ? 'text-red-500 shadow-lg shadow-red-500/25' : 'text-white'
                        }`}>
                          <i className={`fa-${likeCounts[item._id]?.liked ? 'solid text-red-500 animate-pulse' : 'regular'} fa-heart text-lg`}></i>
                        </div>
                        <span className="text-[10px] mt-1 text-white tabular-nums font-medium">{likeCounts[item._id]?.count || 0}</span>
                      </button>

                      {/* View count untuk video */}
                      <div className="flex flex-col items-center cursor-default" title="Jumlah tayangan video">
                        <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
                          <i className="fa-regular fa-eye text-lg text-[#00c8ff]"></i>
                        </div>
                        <span className="text-[10px] mt-1 text-white tabular-nums font-medium">{viewCounts[item._id] || 0}</span>
                      </div>

                      <button type="button" onClick={() => handleShare(item)} className="flex flex-col items-center cursor-pointer group">
                        <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white transition group-hover:scale-110">
                          <i className="fa-solid fa-share text-lg"></i>
                        </div>
                        <span className="text-[10px] mt-1 text-white tabular-nums font-medium">{shareCounts[item._id] || 0}</span>
                      </button>

                      <button type="button" onClick={() => toggleVideoMute(item._id)} className="flex flex-col items-center cursor-pointer">
                        <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
                          <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'} text-lg`}></i>
                        </div>
                        <span className="text-[10px] mt-1 text-white">{isMuted ? 'Mute' : 'Sound'}</span>
                      </button>

                      <button type="button" onClick={() => toggleVideoFullscreen(item._id)} className="flex flex-col items-center cursor-pointer">
                        <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
                          <i className="fa-solid fa-expand text-lg"></i>
                        </div>
                        <span className="text-[10px] mt-1 text-white">Full</span>
                      </button>

                      {canModifyMedia(item) && (
                        <button type="button" onClick={() => openEditModal(item)} className="flex flex-col items-center cursor-pointer">
                          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
                            <i className="fa-solid fa-pen text-base"></i>
                          </div>
                          <span className="text-[10px] mt-1 text-white">Edit</span>
                        </button>
                      )}
                    </div>

                    <div className="absolute left-3 right-20 bottom-4 z-10 text-white space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          deleted ? 'bg-gray-600 text-gray-300' :
                          isMe ? 'bg-[#00c8ff] text-white' :
                          'bg-white/20 backdrop-blur-sm text-white'
                        }`}>
                          {deleted ? '?' : name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold">{deleted ? name : `@${name}`}</span>
                        {isMe && !deleted && (
                          <span className="text-[9px] bg-[#00c8ff] px-1.5 py-0.5 rounded-full font-medium">Anda</span>
                        )}
                        {role && !isMe && !deleted && (
                          <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full uppercase">{role}</span>
                        )}
                      </div>

                      <p className="text-xs line-clamp-2 text-white/90">{item.description || 'Tanpa deskripsi'}</p>

                      {item.mentions && item.mentions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.mentions.slice(0, 3).map((m: any, i: number) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                              <i className="fa-solid fa-at text-[7px] mr-0.5"></i>
                              {m.username || m}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-[10px] text-white/70 flex items-center gap-1">
                        <i className="fa-regular fa-calendar"></i>
                        {formatDateID(item.timestamp || item.created_at, true)}
                      </p>
                    </div>

                    <div className="absolute top-3 right-3 z-10 bg-black/40 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded-full">
                      {idx + 1} / {filtered.length}
                    </div>

                    {idx === 0 && filtered.length > 1 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/70 text-[10px] animate-bounce flex flex-col items-center pointer-events-none">
                        <i className="fa-solid fa-chevron-down"></i>
                      </div>
                    )}

                    {/* Buffer loading badge di bawah saat video buffering / kurang lancar */}
                    {bufferingVideos[item._id] && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-black/85 backdrop-blur-md rounded-full border border-[#00c8ff]/60 flex items-center gap-2 shadow-lg shadow-[#00c8ff]/25 pointer-events-none animate-pulse">
                        <div className="w-3.5 h-3.5 border-2 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[11px] font-medium text-white tracking-wide">Memuat buffer video...</span>
                      </div>
                    )}

                    {/* Progress & Buffer bar di paling bawah video */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20 pointer-events-none overflow-hidden">
                      <div
                        className="h-full bg-white/40 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, videoProgress[item._id]?.buffered ?? 0))}%` }}
                      />
                      <div
                        className="h-full bg-[#00c8ff] -mt-1 transition-all duration-150"
                        style={{ width: `${Math.min(100, Math.max(0, videoProgress[item._id]?.played ?? 0))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab !== 'model_3d' && (viewMode === 'grid' ? (
          <div className={fullscreenMode ? 'p-4 pb-6' : 'pb-2'}>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className={`text-center py-8 ${fullscreenMode ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
                <i className="fa-regular fa-face-frown text-3xl block mb-2" />
                <p className="text-sm">Belum ada {activeTab === 'photo' ? 'foto' : 'riwayat perbaikan'}</p>
                <p className="text-xs">Upload sekarang untuk berbagi momen!</p>
              </div>
            ) : (
              <>
                <div className={
                  fullscreenMode
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2'
                    : 'grid grid-cols-3 gap-1.5'
                }>
                  {filtered.slice(0, gridLimit).map((item, idx) => {
                    const isVideo = item.file_type === 'videos' || item.file_type === 'video';
                    const isImage = item.file_type === 'images' || item.file_type === 'image';
                    return (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => openLightbox(filtered, idx)}
                        className="aspect-square relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 group"
                      >
                        {isVideo ? (
                          <>
                            <video
                              src={`${item.file_url}#t=0.1`}
                              className="w-full h-full object-cover"
                              muted
                              preload="none"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <i className="fa-solid fa-play text-white text-2xl drop-shadow-lg" />
                            </div>
                          </>
                        ) : isImage ? (
                          <img
                            src={item.file_url}
                            alt={item.description || 'Foto'}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <i className="fa-solid fa-file text-2xl" />
                            <span className="text-[8px] mt-1 px-1 w-full text-center truncate">{item.file_type || 'File'}</span>
                          </div>
                        )}

                        {item.media_type === 'maintenance' && (
                          <span className="absolute top-1 left-1 text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-semibold">🔧</span>
                        )}

                        {item.description && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pointer-events-none">
                            <p className="text-[9px] text-white line-clamp-1">{item.description}</p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {filtered.length > gridLimit && (
                  <button
                    type="button"
                    onClick={() => setGridLimit(l => l + 60)}
                    className={`w-full mt-3 py-2 rounded-lg text-xs font-medium ${
                      fullscreenMode
                        ? 'bg-white/10 text-white/80 hover:bg-white/20'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <i className="fa-solid fa-chevron-down mr-1" />
                    Muat 60 lagi ({filtered.length - gridLimit} tersisa)
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className={`media-feed-container space-y-4 ${fullscreenMode ? 'p-4 pb-6' : 'pb-2'}`}>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className={`text-center py-8 ${fullscreenMode ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
                <i className="fa-regular fa-face-frown text-3xl block mb-2"></i>
                <p className="text-sm">Belum ada {activeTab === 'photo' ? 'foto' : 'riwayat perbaikan'}</p>
                <p className="text-xs">Upload sekarang untuk berbagi momen!</p>
              </div>
            ) : (
              grouped.map((group, groupIndex) => {
                const isAlbum = group.items.length > 1;
                const slideIdx = slideIndexes[group.key] ?? 0;
                const item = group.items[slideIdx];
                const isVideo = item.file_type === 'videos' || item.file_type === 'video';
                const isImage = item.file_type === 'images' || item.file_type === 'image';
                const isDocument = !isVideo && !isImage;

                const goPrev = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSlideIndexes(prev => ({
                    ...prev,
                    [group.key]: slideIdx === 0 ? group.items.length - 1 : slideIdx - 1,
                  }));
                };
                const goNext = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSlideIndexes(prev => ({
                    ...prev,
                    [group.key]: (slideIdx + 1) % group.items.length,
                  }));
                };

                return (
                  <div
                    key={group.key}
                    className={`media-feed-item media-card group ${fullscreenMode ? 'max-w-3xl mx-auto' : ''}`}
                    style={{ animationDelay: `${groupIndex * 0.05}s` }}
                  >
                    <div className="relative bg-black/5 dark:bg-black/20">
                      {isImage && (
                        <img
                          src={item.file_url}
                          alt={item.description || 'Media'}
                          className={`w-full object-contain cursor-pointer bg-gray-50 dark:bg-gray-900 transition-transform duration-300 group-hover:scale-[1.01] ${
                            fullscreenMode ? 'max-h-[80vh]' : 'max-h-[500px]'
                          }`}
                          onClick={() => {
                            if (swipeJustHappenedRef.current) {
                              swipeJustHappenedRef.current = false;
                              return;
                            }
                            openLightbox(group.items, slideIdx);
                          }}
                          onTouchStart={(e) => {
                            touchStartXRef.current = e.touches[0].clientX;
                            touchDeltaXRef.current = 0;
                          }}
                          onTouchMove={(e) => {
                            if (touchStartXRef.current == null) return;
                            touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
                          }}
                          onTouchEnd={() => {
                            if (touchStartXRef.current == null) return;
                            const dx = touchDeltaXRef.current;
                            touchStartXRef.current = null;
                            touchDeltaXRef.current = 0;
                            if (Math.abs(dx) < 50 || group.items.length < 2) return;
                            swipeJustHappenedRef.current = true;
                            setTimeout(() => { swipeJustHappenedRef.current = false; }, 100);
                            setSlideIndexes((prev) => {
                              const cur = prev[group.key] ?? 0;
                              const next = dx < 0
                                ? (cur + 1) % group.items.length
                                : (cur - 1 + group.items.length) % group.items.length;
                              return { ...prev, [group.key]: next };
                            });
                          }}
                          loading="lazy"
                          decoding="async"
                        />
                      )}

                      {isVideo && (
                        <div className="relative w-full bg-black rounded-t-2xl overflow-hidden flex items-center justify-center">
                          <video
                            src={item.file_url}
                            className={`w-full object-contain ${
                              fullscreenMode ? 'max-h-[80vh]' : 'max-h-[500px]'
                            }`}
                            controls
                            playsInline
                            preload="none"
                            onWaiting={() => handleVideoWaiting(item._id)}
                            onStalled={() => handleVideoWaiting(item._id)}
                            onPlaying={() => handleVideoCanPlay(item._id)}
                            onCanPlay={() => handleVideoCanPlay(item._id)}
                            onLoadedData={() => handleVideoCanPlay(item._id)}
                          />
                          {bufferingVideos[item._id] && (
                            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 bg-black/85 backdrop-blur-md rounded-full border border-[#00c8ff]/60 flex items-center gap-2 shadow-lg pointer-events-none animate-pulse">
                              <div className="w-3.5 h-3.5 border-2 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
                              <span className="text-[11px] font-medium text-white">Memuat buffer video...</span>
                            </div>
                          )}
                        </div>
                      )}

                      {isDocument && (
                        <div
                          className="w-full h-48 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-pointer"
                          onClick={() => window.open(item.file_url, '_blank')}
                        >
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
                        {isAlbum
                          ? `${slideIdx + 1} / ${group.items.length}`
                          : `${groupIndex + 1} / ${grouped.length}`}
                      </div>

                      {isAlbum && (
                        <>
                          <button
                            type="button"
                            onClick={goPrev}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition shadow-lg"
                            title="Sebelumnya"
                          >
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={goNext}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition shadow-lg"
                            title="Berikutnya"
                          >
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                          </button>

                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
                            {group.items.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSlideIndexes(prev => ({ ...prev, [group.key]: i }));
                                }}
                                className={`h-1.5 rounded-full transition-all ${
                                  i === slideIdx ? 'bg-white w-4' : 'bg-white/50 w-1.5'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}

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
                        </div>
                      )}
                    </div>

                    {isAlbum && (
                      <div className="flex gap-1.5 p-2 overflow-x-auto bg-black/5 dark:bg-black/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {group.items.map((thumb, i) => {
                          const thumbIsVideo = thumb.file_type === 'videos' || thumb.file_type === 'video';
                          return (
                            <button
                              key={thumb._id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSlideIndexes(prev => ({ ...prev, [group.key]: i }));
                              }}
                              className={`w-12 h-12 rounded-md flex-shrink-0 overflow-hidden border-2 transition-all ${
                                i === slideIdx
                                  ? 'border-[#00c8ff] opacity-100'
                                  : 'border-transparent opacity-50 hover:opacity-100'
                              }`}
                            >
                              {thumbIsVideo ? (
                                <div className="w-full h-full bg-black flex items-center justify-center relative">
                                  <video src={`${thumb.file_url}#t=0.1`} className="w-full h-full object-cover" muted preload="none" />
                                  <i className="fa-solid fa-play text-white text-[10px] absolute" />
                                </div>
                              ) : (
                                <img src={thumb.file_url} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className={`p-3 space-y-1.5 ${fullscreenMode ? 'bg-white dark:bg-[#1a1a2e]' : ''}`}>
                      {(() => {
                        const { name, isMe, role, deleted } = getUploaderLabel(item);
                        return (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              deleted ? 'bg-gray-200 dark:bg-gray-700 text-gray-400' :
                              isMe ? 'bg-[#00c8ff] text-white' :
                              'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                            }`}>
                              {deleted ? '?' : name.charAt(0).toUpperCase()}
                            </div>
                            <span className={`font-semibold ${
                              deleted ? 'text-gray-400 dark:text-gray-500 italic' :
                              isMe ? 'text-[#00c8ff]' :
                              'text-gray-700 dark:text-gray-200'
                            }`}>
                              {deleted ? name : `@${name}`}
                            </span>
                            {isMe && !deleted && (
                              <span className="text-[9px] bg-[#00c8ff]/10 text-[#00c8ff] px-1.5 py-0.5 rounded-full font-medium">Anda</span>
                            )}
                            {role && !isMe && !deleted && (
                              <span className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full uppercase">{role}</span>
                            )}
                          </div>
                        );
                      })()}

                      <p className="text-sm font-medium text-gray-800 dark:text-white line-clamp-2">
                        {item.description || 'Tanpa deskripsi'}
                      </p>

                      {item.mentions && item.mentions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.mentions.slice(0, 3).map((m: any, i: number) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00c8ff]/10 text-[#00c8ff] font-medium border border-[#00c8ff]/20">
                              <i className="fa-solid fa-at text-[7px] mr-0.5"></i>
                              {m.username || m}
                            </span>
                          ))}
                          {item.mentions.length > 3 && (
                            <span className="text-[9px] text-gray-400">+{item.mentions.length - 3}</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <i className="fa-regular fa-calendar"></i>
                          {formatDateID(item.timestamp || item.created_at, true)}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                        <span className="flex items-center gap-1">
                          <i className="fa-regular fa-clock"></i>
                          {formatDateID(item.created_at || item.timestamp, false)}
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

                        <div className="social-btn cursor-default" title="Jumlah user yang melihat">
                          <i className="fa-regular fa-eye text-base"></i>
                          <span className="tabular-nums">{viewCounts[item._id] || 0}</span>
                        </div>

                        <button className="social-btn ml-auto" onClick={() => handleShare(item)}>
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
        ))}
      </div>

      {/* ===== REGION + UPLOAD (inline only) ===== */}
      {!fullscreenMode && session && (isPolygonRole || roleNorm === 'reporter') && (
        <div className={`text-xs p-2 rounded-lg border ${
          canUploadHere
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
        }`}>
          <i className={`fa-solid ${canUploadHere ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-1`}></i>
          {canUploadHere
            ? (isPolygonRole
                ? '✅ Bangunan ini di dalam wilayah kerja Anda'
                : '✅ Anda berada di dalam wilayah kerja')
            : (outsideReason || '⚠️ Pastikan bangunan berada di dalam wilayah kerja Anda untuk upload')}
        </div>
      )}

      {!fullscreenMode && session && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <button
            type="button"
            onClick={() => canUploadHere && setUploadModalOpen(true)}
            disabled={!canUploadHere}
            className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              canUploadHere
                ? 'bg-gradient-to-r from-[#00c8ff] to-blue-600 text-white hover:shadow-lg hover:shadow-[#00c8ff]/30'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}
          >
            <i className={`fa-solid ${canUploadHere ? 'fa-plus-circle' : 'fa-lock'}`}></i>
            <span>
              {canUploadHere
                ? `Tambah ${activeTab === 'maintenance' ? 'Perbaikan' : activeTab === 'video' ? 'Video' : activeTab === 'model_3d' ? 'Model 3D' : 'Foto'}`
                : (outsideReason || 'Upload tidak diizinkan')}
            </span>
          </button>

          {refreshingMedia && (
            <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-[#00c8ff]">
              <div className="w-3 h-3 border-2 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
              <span>Memuat ulang media…</span>
            </div>
          )}

          <UploadModal
            open={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            buildingId={buildingId}
            buildingName={buildingName}
            mediaType={activeTab}
            token={session.accessToken as string}
            canUpload={canUploadHere}
            outsideReason={outsideReason}
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
          />
        </div>
      )}
    </div>
  );

  // ============ RENDER ============
  return (
    <>
      {/* MAIN CONTENT — portal ke body saat fullscreen (escape transform sidebar) */}
      {fullscreenMode && portalReady
        ? createPortal(
            <div className="fixed inset-0 z-[9998] bg-black">
              {mainContent}
            </div>,
            document.body
          )
        : mainContent}

      {/* LIGHTBOX — SELALU portal ke body */}
      {lightbox && portalReady && (() => {
        const item = lightbox.items[lightbox.index];
        if (!item) return null;
        const isVideo = item.file_type === 'videos' || item.file_type === 'video';
        const isImage = item.file_type === 'images' || item.file_type === 'image';
        const total = lightbox.items.length;
        const goPrev = () =>
          setLightbox(p => p ? { ...p, index: (p.index - 1 + total) % total } : null);
        const goNext = () =>
          setLightbox(p => p ? { ...p, index: (p.index + 1) % total } : null);
        const { name, isMe, deleted } = getUploaderLabel(item);

        return createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            <div
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 z-30 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
                title="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>

              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white/10 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full tabular-nums">
                {lightbox.index + 1} / {total}
              </div>

              {total > 1 && (
                <button
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
              )}

              {isVideo ? (
                <div className="relative max-h-screen max-w-full flex items-center justify-center">
                  <video
                    key={item._id}
                    src={item.file_url}
                    controls
                    autoPlay
                    playsInline
                    preload="auto"
                    className="max-h-screen max-w-full"
                    onWaiting={() => setLightboxBuffering(true)}
                    onStalled={() => setLightboxBuffering(true)}
                    onPlaying={() => setLightboxBuffering(false)}
                    onCanPlay={() => setLightboxBuffering(false)}
                    onLoadedData={() => setLightboxBuffering(false)}
                  />
                  {lightboxBuffering && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 bg-black/85 backdrop-blur-md rounded-full border border-[#00c8ff]/60 flex items-center gap-2 shadow-2xl pointer-events-none animate-pulse">
                      <div className="w-4 h-4 border-2 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-white tracking-wide">Memuat buffer video...</span>
                    </div>
                  )}
                </div>
              ) : isImage ? (
                <img
                  key={item._id}
                  src={item.file_url}
                  alt={item.description || 'Media'}
                  className="max-h-screen max-w-full object-contain select-none"
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  onTouchStart={(e) => {
                    lightboxTouchRef.current.startX = e.touches[0].clientX;
                    lightboxTouchRef.current.deltaX = 0;
                  }}
                  onTouchMove={(e) => {
                    if (lightboxTouchRef.current.startX == null) return;
                    lightboxTouchRef.current.deltaX = e.touches[0].clientX - lightboxTouchRef.current.startX;
                  }}
                  onTouchEnd={() => {
                    const dx = lightboxTouchRef.current.deltaX;
                    lightboxTouchRef.current.startX = null;
                    lightboxTouchRef.current.deltaX = 0;
                    if (Math.abs(dx) < 50 || total < 2) return;
                    if (dx < 0) goNext(); else goPrev();
                  }}
                />
              ) : (
                <div className="w-full max-w-md p-6 bg-white/5 rounded-2xl text-center">
                  <i className="fa-solid fa-file text-6xl text-white/40 mb-4 block" />
                  <p className="text-white/80 text-sm mb-4">{item.file_type || 'Dokumen'}</p>
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block px-4 py-2 bg-[#00c8ff] text-white rounded-lg text-sm font-medium"
                  >
                    Buka file
                  </a>
                </div>
              )}

              {total > 1 && (
                <button
                  onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    deleted ? 'bg-gray-600 text-gray-300' : isMe ? 'bg-[#00c8ff] text-white' : 'bg-white/20 text-white'
                  }`}>
                    {deleted ? '?' : name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-white font-semibold">{deleted ? name : `@${name}`}</span>
                  {isMe && !deleted && (
                    <span className="text-[9px] bg-[#00c8ff] text-white px-1.5 py-0.5 rounded-full font-medium">Anda</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-white text-sm font-medium line-clamp-2">{item.description}</p>
                )}
                <p className="text-white/60 text-xs mt-1 flex items-center gap-2">
                  <i className="fa-regular fa-calendar" />
                  {formatDateID(item.timestamp || item.created_at, true)}
                  {item.media_type === 'maintenance' && (
                    <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-semibold">🔧 Perbaikan</span>
                  )}
                </p>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
                  <button
                    onClick={() => toggleLike(item._id)}
                    className={`flex items-center gap-1.5 text-sm ${likeCounts[item._id]?.liked ? 'text-red-400' : 'text-white/80 hover:text-white'}`}
                  >
                    <i className={`fa-${likeCounts[item._id]?.liked ? 'solid' : 'regular'} fa-heart`} />
                    <span className="tabular-nums">{likeCounts[item._id]?.count || 0}</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-sm text-white/60">
                    <i className="fa-regular fa-eye" />
                    <span className="tabular-nums">{viewCounts[item._id] || 0}</span>
                  </div>
                  <button
                    onClick={() => handleShare(item)}
                    className="ml-auto flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
                  >
                    <i className="fa-regular fa-share-from-square" />
                    <span className="tabular-nums">{shareCounts[item._id] || 0}</span>
                  </button>
                  {canModifyMedia(item) && (
                    <button
                      onClick={() => { openEditModal(item); setLightbox(null); }}
                      className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
                    >
                      <i className="fa-solid fa-pen" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* EDIT MODAL — SELALU portal ke body */}
      {editingMedia && portalReady && createPortal(
        <div className="fixed inset-0 z-[10002] bg-black/70 flex items-center justify-center p-4" onClick={() => !saving && setEditingMedia(null)}>
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-pen text-[#00c8ff]"></i>
                Edit Media
              </h3>
              <button type="button" onClick={() => !saving && setEditingMedia(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="rounded-lg overflow-hidden bg-black/5 dark:bg-black/20 max-h-40 flex items-center justify-center">
              {editingMedia.file_type === 'videos' ? (
                <video src={editingMedia.file_url} className="max-h-40" muted />
              ) : editingMedia.file_type === 'images' ? (
                <img src={editingMedia.file_url} className="max-h-40 object-contain" alt="preview" />
              ) : (
                <i className="fa-solid fa-file text-4xl text-gray-400 py-10"></i>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Kategori</label>
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

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Deskripsi</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f0f1e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                placeholder="Deskripsi media..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tanggal & Waktu</label>
              <input
                type="datetime-local"
                value={editTimestamp}
                onChange={(e) => setEditTimestamp(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f0f1e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
              />
            </div>

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
        </div>,
        document.body
      )}

      {/* FULLSCREEN HINT */}
      {fullscreenMode && !lightbox && !editingMedia && portalReady && createPortal(
        <div className="fixed bottom-4 right-4 z-[9999] bg-black/70 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-full pointer-events-none border border-white/20">
          <kbd className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10px]">ESC</kbd> keluar fullscreen
        </div>,
        document.body
      )}
    </>
  );
}