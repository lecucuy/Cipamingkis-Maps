// components/MapWithKML.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as turf from '@turf/turf';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import BuildingMedia from "@/components/BuildingMedia";
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import * as Esri from 'esri-leaflet';
import { useLatestDebits } from '@/hooks/useLatestDebits';
// MODUL HASHTAG
import { extractHashtags } from '@/utils/hashtagHelpers';
import { useHashtagFilter } from '@/hooks/useHashtagFilter';
import { HashtagFilterBar } from '@/components/HashtagFilterBar';
import { FeatureDetail } from '@/components/FeatureDetail';
import ReporterRainfallInput from "./ReporterRainfallInput";
import { toast } from 'react-hot-toast';
import { useUserLocation } from '@/components/UserLocationMarker';
// ... import lainnya
import 'leaflet-wind';
import NotificationBell from '@/components/NotificationBell';
import PelaporanDebit from '@/components/PelaporanDebit';
import {
  canReportDebit,
  canReportCurahHujan,
  isBendungCategory,
  normalizeRole,
} from '@/types/pelaporan';
// import { useUserLocation } from '@/hooks/useUserLocation';
import 'leaflet.heat';
import MusimTanamPanel from '@/components/MusimTanamPanel';
import {  MUSIM_TANAM_STATUS } from '@/hooks/useMusimTanam';
import RainfallHistory from '@/components/RainfallHistory';
import RABProgressPanel from './progress/RABProgressPanel';
import RABUploadModal from '@/components/progress/RABUploadModal';
import AddWorkModal from '@/components/progress/AddWorkModal';
import LiveStreamer from '@/components/live/LiveStreamer';
import LiveViewer from '@/components/live/LiveViewer';
import { useLiveRooms, LiveRoom } from '@/hooks/useLiveRooms';

declare module 'leaflet' {
  function heat(latlngs: any[], options?: any): any;
}

declare module 'leaflet-wind'; // tambahkan jika diperlukan

declare global {
  interface Window {
    toggleLayer?: (key: string) => void;
    toggleTerrain?: () => void;
  }
}


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ============ KONFIGURASI KATEGORI ============
export const CATEGORY_CONFIG: Record<string, any> = {
  "INTAKE": { icon: "fa-water-pump", color: "#00C853", label: "Intake", type: "point" },
  "BCB": { icon: "fa-code-branch", color: "#1976D2", label: "Bangunan Air", type: "point" },
  "BME": { icon: "fa-water", color: "#FF9800", label: "Bangunan Air", type: "point" },
  "BLE": { icon: "fa-road", color: "#795548", label: "Bangunan Lintas", type: "point" },
  "BTM": { icon: "fa-arrow-down-wide-short", color: "#9C27B0", label: "Bangunan Terjun Miring", type: "point" },
  "BTE": { icon: "fa-arrow-down", color: "#673AB7", label: "Bangunan Terjun", type: "point" },
  "BTS": { icon: "fa-water-ladder", color: "#3F51B5", label: "Bangunan Terjun Saluran", type: "point" },
  "BPE": { icon: "fa-wave-square", color: "#009688", label: "Bangunan Pembawa", type: "point" },
  "BSA": { icon: "fa-droplet", color: "#00BCD4", label: "Bangunan Sadap", type: "point" },
  "BPP": { icon: "fa-faucet", color: "#4CAF50", label: "Bangunan Pembagi", type: "point" },
  "BRB": { icon: "fa-bridge-water", color: "#E91E63", label: "Bangunan Rubber", type: "point" },
  "BCK": { icon: "fa-cubes", color: "#607D8B", label: "Bangunan Cek", type: "point" },
  "BPL": { icon: "fa-water", color: "#00E887", label: "Bangunan Pelengkap", type: "point" },
  "BANJIR": { icon: "fa-triangle-exclamation", color: "#1E88E5", label: "Genangan Banjir", type: "point" },
  "BANGUNAN_LIAR": { icon: "fa-user", color: "#E64A19", label: "Bangunan Liar", type: "point" },
  "BATAS_WILAYAH": { icon: "fa-flag", color: "#F57C00", label: "Batas Wilayah", type: "point" },
  "RUMAH_DINAS": { icon: "fa-home", color: "#6D4C41", label: "Rumah Dinas", type: "point" },
  "RAWA": { icon: "fa-swamp", color: "#4CAF50", label: "Rawa", type: "point" },
  "SEMBADAN": { icon: "fa-border-all", color: "#D32F2F", label: "Sempadan", type: "line" },
  "BATAS": { icon: "fa-flag", color: "#F57C00", label: "Batas Wilayah", type: "line" },
  "LUASAN_SAWAH": { icon: "fa-crop", color: "#FDD835", label: "Luasan Sawah", type: "polygon" },
  "BANJIR_POLY": { icon: "fa-water", color: "#1E88E5", label: "Genangan Banjir", type: "polygon" },
  "SALURAN_DEFAULT": { icon: "fa-water", color: "#00E5FF", label: "Saluran", type: "line" },
  "default": { icon: "fa-location-dot", color: "#00c8ff", label: "Lainnya", type: "point" },
  "BENDUNG": { icon: "fa-dam", color: "#FF6B6B", label: "Bendung", type: "point" },
  "KOLAM": { icon: "fa-water", color: "#4ECDC4", label: "Kolam", type: "point" },
  "KEJURON": { icon: "fa-border-all", color: "#AAAAAA", label: "Batas Kejuron", type: "line" },
  "SUMBER_PENCEMARAN": {
  icon: "fa-biohazard",
  color: "#DC2626",
  label: "Sumber Pencemaran",
  type: "point"},
 };

 // ============ FLOW HELPERS ============
// Konversi Debit (m³/s) ke Durasi Animasi (Detik) yang Realistis
// Range: 4s (debit kecil) → 12s (debit sangat kecil), slow & natural

function debitToColor(debit: number): string {
  if (debit <= 0) return '#00E5FF';
  if (debit < 2)  return '#7DD3FC';
  if (debit < 10) return '#38BDF8';
  if (debit < 30) return '#0EA5E9';
  return '#0369A1';
}

function debitToWidth(debit: number): number {
  if (debit <= 0) return 2;
  if (debit < 2)  return 3;
  if (debit < 10) return 4;
  if (debit < 30) return 5;
  return 6;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  location: string;
}

// ===== UGV STATE =====
interface UGVRobot {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  proxy_video_url?: string | null;
  status?: 'online' | 'offline' | 'moving';
  battery?: number | null;
  last_update?: number;
}

export default function MapWithKML() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const initialFitDone = useRef(false);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const legendContainerRef = useRef<HTMLDivElement | null>(null);
  const villageLayerRef = useRef<L.LayerGroup | null>(null);
  const buildingMediaRef = useRef<Record<string, any[]>>({});
  const stationPointsRef = useRef<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [stationPoints, setStationPoints] = useState<any[]>([]);
  const [activeStation, setActiveStation] = useState<any>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [chartData] = useState<number[]>(Array(20).fill(280));
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [buildingMedia, setBuildingMedia] = useState<Record<string, any[]>>({});
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({});
  const [selectedFeature, setSelectedFeature] = useState<any>(null); // <-- TAMBAHKAN INI
  const [L, setL] = useState<any>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { data: session } = useSession();
  const [villageGeo, setVillageGeo] = useState<any>(null);
  const [villageLoading, setVillageLoading] = useState(false);
  const [villageError, setVillageError] = useState<string | null>(null);
  const [showRainfallInput, setShowRainfallInput] = useState(false);
  const [showDebitInput, setShowDebitInput] = useState(false);
  const [selectedBendungId, setSelectedBendungId] = useState<string>('');
  const [selectedBendungName, setSelectedBendungName] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedBuildingName, setSelectedBuildingName] = useState<string>('');
  const [rainfallHistory, setRainfallHistory] = useState<any[]>([]);
  const [rainfallLoading, setRainfallLoading] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL belum dikonfigurasi');
  // HOOK HASHTAG
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { tagFilter, setTagFilter, filteredPoints, filteredLines, filteredPolygons, allTags } = useHashtagFilter(geoData);
  // State untuk data batas desa
  const [showTerrain, setShowTerrain] = useState(false);
  // ===== FUNGSI FORMAT =====
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showAQI, setShowAQI] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(true); // untuk collapse tombol
  const [showLegend, setShowLegend] = useState(false); 
  // Data lingkungan (dummy atau dari API)
  const [envData, setEnvData] = useState<any>(null);
  const [showTemperature, setShowTemperature] = useState(false);
  const formatLength = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };
  const [showMusimTanam, setShowMusimTanam] = useState(false);
  const router = useRouter();
  // 🔥 Fetch musim tanam langsung (public, tanpa butuh login)
  const [musimTanamByPolygon, setMusimTanamByPolygon] = useState<Record<string, any>>({});
  const [addWorkMode, setAddWorkMode] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [showAddWorkModal, setShowAddWorkModal] = useState(false);
  const [showRABModal, setShowRABModal] = useState(false);
  const [progressRefreshKey, setProgressRefreshKey] = useState(0);
    // ===== LIVE STREAMING =====
  const { rooms: liveRooms, refresh: refreshLiveRooms } = useLiveRooms(
    session?.accessToken as string | undefined
  );
  const [liveStreamerRoom, setLiveStreamerRoom] = useState<string | null>(null);
  const [liveViewerRoom, setLiveViewerRoom] = useState<string | null>(null);
  const [startingLive, setStartingLive] = useState(false);
  const liveLayerRef = useRef<L.LayerGroup | null>(null);

  const [ugvs, setUgvs] = useState<UGVRobot[]>([]);
const ugvLayerRef = useRef<L.LayerGroup | null>(null);
const ugvMarkersRef = useRef<Record<string, L.Marker>>({});

  // Map: building_id → live room (untuk lookup cepat)
  const liveByBuilding = useMemo(() => {
    const m: Record<string, LiveRoom> = {};
    liveRooms.forEach(r => { m[r.building_id] = r; });
    return m;
  }, [liveRooms]);
    const userRole = session?.user?.role;
    const userPolygon = session?.user?.polygon; // hanya ada untuk TPOP
    const userLat = session?.user?.lat;
    const userLon = session?.user?.lon;


  // Cek apakah suatu building berada di polygon user
  const isBuildingInMyPolygon = useCallback((building: any) => {
    if (!userPolygon || userPolygon.length < 3) return false;
    if (typeof building?.lat !== 'number' || typeof building?.lon !== 'number') return false;
    try {
      const ring = [...userPolygon];
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }
      return turf.booleanPointInPolygon(
        turf.point([building.lon, building.lat]),
        turf.polygon([ring])
      );
    } catch {
      return false;
    }
  }, [userPolygon]);

  // Mulai live di building tertentu
  const startLiveAt = useCallback(async (building: any) => {
    if (!session?.accessToken) { toast.error('Login dulu'); return; }
    if (!building?.name) return;
    setStartingLive(true);
    try {
      const res = await axios.post(
        `${API_URL}/live/start`,
        {
          building_id: building.name,
          building_name: building.name,
          title: `Live dari ${building.name}`,
        },
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      );
      const roomId = res.data?.room_id;
      if (roomId) {
        setLiveStreamerRoom(roomId);
        refreshLiveRooms();
        toast.success(res.data?.existing ? 'Melanjutkan live yang aktif' : 'Live dimulai!');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal memulai live');
    } finally {
      setStartingLive(false);
    }
  }, [session, API_URL, refreshLiveRooms]);

  // Stop live
  const stopLive = useCallback(async (roomId: string) => {
    if (!session?.accessToken) return;
    try {
      await axios.post(
        `${API_URL}/live/${roomId}/stop`,
        {},
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      );
    } catch {}
    setLiveStreamerRoom(null);
    refreshLiveRooms();
  }, [session, API_URL, refreshLiveRooms]);

  // Global bridge untuk tombol "Tonton Live" di popup Leaflet
    // Global bridge untuk tombol "Tonton Live" di popup Leaflet
  useEffect(() => {
    (window as any).__openLive = (roomId: string) => setLiveViewerRoom(roomId);
    
    // 🔥 Bridge untuk buka full live di tab baru
    (window as any).__openFullLive = (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    };
    
    return () => { 
      delete (window as any).__openLive; 
      delete (window as any).__openFullLive;
    };
  }, []);

    // ===== LIVE MARKERS (indikator live di peta) =====
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !L) return;

    // Bersihkan layer lama
    if (liveLayerRef.current) {
      map.removeLayer(liveLayerRef.current);
      liveLayerRef.current = null;
    }

    if (liveRooms.length === 0) return;

    // Inject animation style sekali
    if (!document.getElementById('live-marker-style')) {
      const style = document.createElement('style');
      style.id = 'live-marker-style';
      style.textContent = `
        @keyframes live-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 4px rgba(239,68,68,0.35), 0 4px 16px rgba(239,68,68,0.6); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(239,68,68,0.15), 0 4px 24px rgba(239,68,68,0.85); }
        }
        @keyframes live-ring {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    const group = L.layerGroup();

    liveRooms.forEach(room => {
      const building = stationPointsRef.current[room.building_id];
      if (!building) return;

      const icon = L.divIcon({
        className: 'live-marker-div',
        html: `
          <div style="position:relative;text-align:center;">
            <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:48px;height:48px;border-radius:50%;background:rgba(239,68,68,0.35);animation:live-ring 1.8s ease-out infinite;pointer-events:none;"></div>
            <div style="position:relative;width:48px;height:48px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 0 0 3px rgba(239,68,68,0.4),0 6px 20px rgba(239,68,68,0.6);display:flex;align-items:center;justify-content:center;animation:live-pulse 1.6s ease-in-out infinite;cursor:pointer;">
              <span style="color:white;font-weight:900;font-size:10px;letter-spacing:0.8px;">LIVE</span>
            </div>
            <div style="font-size:9px;font-weight:700;color:white;background:#ef4444;padding:2px 8px;border-radius:10px;margin-top:4px;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.5);">
              ${room.streamer_name}
            </div>
          </div>
        `,
        iconSize: [48, 72],
        iconAnchor: [24, 36],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([building.lat, building.lon], {
        icon,
        zIndexOffset: 1000,
      });

      marker.bindPopup(`
        <div style="font-family:Inter;min-width:200px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="background:#ef4444;color:white;font-size:9px;font-weight:800;padding:2px 8px;border-radius:10px;display:inline-flex;align-items:center;gap:3px;">
              <span style="width:5px;height:5px;border-radius:50%;background:white;"></span> LIVE
            </span>
            <span style="font-size:10px;color:#666;display:inline-flex;align-items:center;gap:2px;">
              👁 ${room.viewers}
            </span>
          </div>
          <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">${room.title}</h4>
          <p style="margin:0 0 4px 0;font-size:11px;color:#666;">
            <b>@${room.streamer_name}</b> · 📍 ${room.building_name}
          </p>
          ${room.is_mine ? `
            <p style="margin:0 0 8px 0;font-size:10px;color:#16a34a;font-weight:600;">✓ Ini live Anda</p>
            <button onclick="window.__openLive('${room.room_id}')" style="width:100%;padding:8px;background:#16a34a;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
              Kelola Live
            </button>
          ` : `
            <button onclick="window.__openLive('${room.room_id}')" style="width:100%;padding:8px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
              ▶ Tonton Live
            </button>
          `}
        </div>
      `, { maxWidth: 280 });

      marker.on('click', () => {
        if (room.is_mine) {
          setLiveStreamerRoom(room.room_id);
        }
      });

      group.addLayer(marker);
    });

    group.addTo(map);
    liveLayerRef.current = group;

    return () => {
      if (liveLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(liveLayerRef.current);
        liveLayerRef.current = null;
      }
    };
  }, [liveRooms, mapReady, L, stationPoints]);

  useEffect(() => {
  const map = mapRef.current;
  if (!map || !mapReady) return;

  const onClick = (e: any) => {
    if (!addWorkMode) return;
    setPendingLocation({ lat: e.latlng.lat, lon: e.latlng.lng });
    setShowAddWorkModal(true);
    setAddWorkMode(false);
  };

  map.on('click', onClick);

  // Cursor crosshair saat mode aktif
  const container = map.getContainer();
  container.style.cursor = addWorkMode ? 'crosshair' : '';

  return () => {
    map.off('click', onClick);
    container.style.cursor = '';
  };
}, [mapReady, addWorkMode]);


  const fetchMusimTanam = useCallback(async () => {
    try {
      const headers = session?.accessToken
        ? { Authorization: `Bearer ${session.accessToken}` }
        : {};

      const res = await axios.get(`${API_URL}/musim-tanam/laporan`, { headers });
      const reports = res.data?.reports || [];
      const map: Record<string, any> = {};
      reports.forEach((r: any) => {
        map[r.polygon_id] = r;
      });
      console.log('[MusimTanam] ✅ fetched:', reports.length, 'reports');
      console.log('[MusimTanam] keys:', Object.keys(map));
      setMusimTanamByPolygon(map);
    } catch (err: any) {
      console.error('[MusimTanam] ❌ fetch error:', err.response?.status, err.message);
    }
  }, [session?.accessToken]);

  // ===== DETEKSI STASIUN CURAH HUJAN =====
const isRainfallStation = useCallback((station: any): boolean => {
  return !!station?.name && /curah\s*hujan/i.test(station.name);
}, []);

useEffect(() => {
  fetchMusimTanam();
}, [fetchMusimTanam]);

useEffect(() => {
  fetchMusimTanam();
}, [fetchMusimTanam]);


  // ====== FLOW ANIMATION STATE ======
  const [showFlowAnimation, setShowFlowAnimation] = useState(true);
  // Ambil semua ID bendung
const bendungIds = useMemo(() => {
  const ids = stationPoints
    .filter((p: any) => isBendungCategory(p.category))
    .map((p: any) => p.name);

  // 🔥 Tambahkan polygon Mercu Bendung (karena dia polygon, bukan point)
  const mercuPoly = (geoData?.polygons || []).find((p: any) =>
    /mercu\s*bendung|bendung\s*mercu/i.test(p.name || '')
  );
  if (mercuPoly?.name && !ids.includes(mercuPoly.name)) {
    ids.push(mercuPoly.name);
  }

  console.log('[bendungIds]', ids);  // DEBUG
  return ids;
}, [stationPoints, geoData]);

  // Hook ambil debit terbaru — polling 60s
const { latestDebits } = useLatestDebits(bendungIds);


  // Map: nama saluran → info flow
  // Map: nama saluran → info flow
  const saluranFlowMap = useMemo(() => {
    const map: Record<
      string,
      {
        debit: number;
        duration: number;
        color: string;
        width: number;
        from: string;
        tanggal: string;
        jam: string;
      }
    > = {};

    if (!geoData?.lines?.length || !latestDebits || !stationPointsRef.current) {
      console.log('[saluranFlowMap] skip — data belum siap', {
        hasLines: !!geoData?.lines?.length,
        hasDebits: !!latestDebits,
        hasRef: !!stationPointsRef.current,
      });
      return map;
    }

    console.log(
      '[saluranFlowMap] bendung dgn debit:',
      Object.keys(latestDebits).length,
      Object.entries(latestDebits).map(([k, v]: any) => `${k}=${v.debit}`)
    );

    Object.values(latestDebits).forEach((flow: any) => {
      const bendung = stationPointsRef.current[flow.buildingId];
      if (!bendung) {
        console.warn(`[saluranFlowMap] ${flow.buildingId} gak ketemu di stationPoints`);
        return;
      }
      if (flow.debit <= 0) {
        console.warn(`[saluranFlowMap] ${flow.buildingId} debit=${flow.debit} → skip`);
        return;
      }

      // Cari saluran yang titik awalnya paling dekat dengan bendung
      let bestLine: any = null;
      let bestDist = Infinity;

      geoData.lines.forEach((line: any) => {
        if (!line.path?.length) return;
        const start = line.path[0]; // [lat, lon]
        const d = turf.distance(
          turf.point([bendung.lon, bendung.lat]),
          turf.point([start[1], start[0]]),
          { units: 'kilometers' }
        );
        if (d < bestDist) {
          bestDist = d;
          bestLine = line;
        }
      });

      console.log(
        `[saluranFlowMap] ${flow.buildingId} → saluran terdekat: "${bestLine?.name}" (${bestDist.toFixed(3)} km)`
      );

      // ✅ Threshold dinaikin dari 0.5 → 3 km
      if (bestLine && bestDist < 3) {
        map[bestLine.name] = {
          debit: flow.debit,
          duration: debitToDuration(flow.debit),
          color: debitToColor(flow.debit),
          width: debitToWidth(flow.debit),
          from: flow.buildingId,
          tanggal: flow.tanggal,
          jam: flow.jam,
        };
      } else {
        console.warn(
          `[saluranFlowMap] ${flow.buildingId} — saluran terdekat (${bestLine?.name}) terlalu jauh (${bestDist.toFixed(3)} km > 3 km)`
        );
      }
    });

    console.log('[saluranFlowMap] hasil:', Object.keys(map));
    return map;
  }, [geoData, latestDebits]);


const {
  userLocation,
  userLocationError,
  userLocationLoading,
  getUserLocation,
  clearUserLocation,
} = useUserLocation(mapRef.current, L);

   
    

useEffect(() => {
  console.log('🔍 RAW role:', session?.user?.role);
  console.log('🔍 normalizeRole:', normalizeRole(session?.user?.role));
  console.log('🔍 session.user:', session?.user);
}, [session]);


// 🔥 Deteksi Juru Bengkok (konsisten dgn backend)
    const isJuruBengkok = useMemo(() => {
      const u: any = session?.user;
      if (normalizeRole(u?.role) !== 'juru') return false;
      // OPSI A: field khusus
      if ((u?.juruType || '').toLowerCase() === 'bengkok') return true;
      if ((u?.juru_type || '').toLowerCase() === 'bengkok') return true;
      // OPSI B: dari email / username / full_name
      const email = (u?.email || '').toLowerCase();
      const username = (u?.username || '').toLowerCase();
      const fullName = (u?.name || u?.full_name || '').toLowerCase();
      return email.includes('bengkok') || username.includes('bengkok') || fullName.includes('bengkok');
    }, [session]);

    // 🔥 Hashtag khusus Juru Bengkok
    const JURU_BENGKOK_TAG = 'saluranindukcibarusah';

        // 🔥 Deteksi Juru Mengker (konsisten dgn backend)
    const isJuruMengker = useMemo(() => {
      const u: any = session?.user;
      if (normalizeRole(u?.role) !== 'juru') return false;
      // OPSI A: field khusus
      if ((u?.juruType || '').toLowerCase() === 'mengker') return true;
      if ((u?.juru_type || '').toLowerCase() === 'mengker') return true;
      // OPSI B: dari email / username / full_name
      const email = (u?.email || '').toLowerCase();
      const username = (u?.username || '').toLowerCase();
      const fullName = (u?.name || u?.full_name || '').toLowerCase();
      return email.includes('mengker') || username.includes('mengker') || fullName.includes('mengker');
    }, [session]);

    // 🔥 Regex nama polygon khusus Juru Mengker — sama persis dgn backend
    // Match: "Luasan Sawah BMe 3 Kiri", "Luasan Sawah BME 6 Kanan", dst
    const JURU_MENGKER_POLYGON_REGEX = /luasan\s*sawah.*?\bb\s*m\s*e\b/i;
    

 
  // ===== MUSIM TANAM POLYGONS (khusus LUASAN_SAWAH) =====
  const musimTanamPolygons = useMemo(() => {
    let polys = (geoData?.polygons || [])
      .filter((p: any) => p.category === 'LUASAN_SAWAH');

    // 🔥 Kalau Juru Bengkok → saring hanya polygon ber-hashtag #SaluranIndukCibarusah
    if (isJuruBengkok) {
      polys = polys.filter((p: any) => {
        const tags: string[] = (p.tags || []).map((t: string) => t.toLowerCase());
        return tags.includes(JURU_BENGKOK_TAG);
      });
    }
    // 🔥 Kalau Juru Mengker → saring hanya polygon "Luasan Sawah ... BMe ..."
    else if (isJuruMengker) {
      polys = polys.filter((p: any) => JURU_MENGKER_POLYGON_REGEX.test(p.name || ''));
      console.log(
        '[MusimTanam] Mengker — polygon lolos:',
        polys.map((p: any) => p.name)
      );
    }

    return polys.map((p: any) => ({
      name: p.name,
      area_ha: p.area_ha || 0,
      path: p.path,
    }));
  }, [geoData?.polygons, isJuruBengkok, isJuruMengker]);





  // ===== SEARCH =====
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return stationPoints;
    const q = searchQuery.toLowerCase();
    return stationPoints.filter((p: any) =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  }, [stationPoints, searchQuery]);


// ===== LOAD LIBRARIES =====
useEffect(() => {
  const loadLibraries = async () => {
    const leaflet = await import('leaflet');
    await import('leaflet.markercluster');

    // 🔥 LOAD leaflet-wind dengan cara ini
    await import('leaflet-wind');
    setL(leaflet.default);
  };
  loadLibraries();
}, []);



useEffect(() => {
  document.getElementById('flow-anim-style')?.remove();

  const style = document.createElement('style');
  style.id = 'flow-anim-style';
  style.textContent = `
    @keyframes flow-liquid {
      0% { stroke-dashoffset: 400; }
      100% { stroke-dashoffset: 0; }
    }

    @keyframes flow-surface {
      0% { stroke-dashoffset: 250; opacity: 0; }
      20% { opacity: 0.7; }
      80% { opacity: 0.7; }
      100% { stroke-dashoffset: 0; opacity: 0; }
    }

    /* Arus utama: Kena efek distorsi cairan (Turbulence) */
    .flow-water-mid {
      animation: flow-liquid var(--fd, 2.5s) linear infinite !important;
      filter: url(#water-turbulence); 
    }

    /* Buih/Permukaan: Lebih cepat, memudar secara alami, dan menyatu (screen) */
    .flow-water-surface {
      animation: flow-surface calc(var(--fd, 2.5s) * 0.7) ease-in-out infinite !important;
      mix-blend-mode: screen; 
      filter: url(#water-turbulence);
      pointer-events: none !important;
    }

    .flow-paused {
      animation-play-state: paused !important;
    }
  `;
  document.head.appendChild(style);
  return () => { document.getElementById('flow-anim-style')?.remove(); };
}, []);




  // ===== LOAD MEDIA =====
  const loadBuildingMedia = useCallback(async (buildingId: string) => {
    if (buildingMedia[buildingId] || loadingMedia[buildingId]) return;
    setLoadingMedia(prev => ({ ...prev, [buildingId]: true }));
    try {
      const res = await axios.get(`${API_URL}/buildings/media/${buildingId}`);
      setBuildingMedia(prev => ({ ...prev, [buildingId]: res.data?.media || [] }));
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Error loading media for', buildingId, err);
      }
      setBuildingMedia(prev => ({ ...prev, [buildingId]: [] }));
    } finally {
      setLoadingMedia(prev => ({ ...prev, [buildingId]: false }));
    }
  }, [buildingMedia, loadingMedia]);

  const loadAllMedia = useCallback(async (points: any[]) => {
    if (!points || points.length === 0) return;
    const buildingIds = points.map(p => p.name).filter(Boolean);
    if (buildingIds.length === 0) return;
    try {
      const res = await axios.post(`${API_URL}/buildings/media/batch`, buildingIds);
      const mediaData = res.data?.media || {};
      setBuildingMedia(prev => ({ ...prev, ...mediaData }));
    } catch (err) {
      console.error('Error loading batch media:', err);
    }
  }, [API_URL]);


  // Konversi Debit (m³/s) ke Durasi Animasi (Detik) yang Realistis
function debitToDuration(debit: number): number {
  if (debit <= 0) return 0; // Air diam / mati
  
  // Menggunakan skala logaritmik agar perubahan debit tinggi tidak membuat animasi terlampau cepat/patah
  const duration = 2.5 / Math.pow(debit, 0.35); 
  
  // Batasi durasi minimum 0.3 detik (deras) dan maksimum 3.0 detik (lambat)
  return Math.max(0.3, Math.min(3.0, Number(duration.toFixed(2))));
}



  // ===== FUNGSI KATEGORISASI =====
  const categorizeFeature = (name: string, description: string = '', type: string = 'point') => {
    const upperName = name.toUpperCase().replace(/\./g, '');
    const upperDesc = description.toUpperCase().replace(/\./g, '');
    const fullText = upperName + ' ' + upperDesc;
    if (type === 'point') {
      if (upperName.includes('INTAKE')) return 'INTAKE';
      if (upperName.includes('BCB')) return 'BCB';
      if (upperName.includes('BME')) return 'BME';
      if (upperName.includes('BLE')) return 'BLE';
      if (upperName.includes('BTM')) return 'BTM';
      if (upperName.includes('BTE')) return 'BTE';
      if (upperName.includes('BTS')) return 'BTS';
      if (upperName.includes('BPE')) return 'BPE';
      if (upperName.includes('BSA')) return 'BSA';
      if (upperName.includes('BPP')) return 'BPP';
      if (upperName.includes('BRB')) return 'BRB';
      if (upperName.includes('BCK')) return 'BCK';
      if (upperName.includes('BPL')) return 'BPL';
      if (fullText.includes('BANJIR')) return 'BANJIR';
      if (fullText.includes('LIAR')) return 'BANGUNAN_LIAR';
      if (fullText.includes('BATAS WILAYAH')) return 'BATAS_WILAYAH';
      if (fullText.includes('RUMAH DINAS') || fullText.includes('CIKORONJO')) return 'RUMAH_DINAS';
      if (fullText.includes('RAWA')) return 'RAWA';
      if (upperName.includes('BENDUNG') || fullText.includes('MERCU')) return 'BENDUNG';
      if (upperName.includes('KOLAM') || fullText.includes('OLAK')) return 'KOLAM';
    }
    if (type === 'line') {
      if (fullText.includes('KEJURON')) return 'KEJURON';
      if (fullText.includes('SEMPADAN') || fullText.includes('SEMBADAN')) return 'SEMBADAN';
      if (fullText.includes('BATAS')) return 'BATAS';
      return 'SALURAN_DEFAULT'; // ← ini yang dipakai untuk "Saluran Sekunder Mengker"
    }
    if (type === 'polygon') {
      if (fullText.includes('LUASAN SAWAH') || fullText.includes('SAWAH')) return 'LUASAN_SAWAH';
      if (fullText.includes('BANJIR')) return 'BANJIR_POLY';
    }
    return 'default';
  };


  // ===== FUNGSI BANTU UNTUK CEK BANGUNAN TERDEKAT =====
const getNearestBuilding = useCallback((lat: number, lon: number) => {
  if (!stationPoints || stationPoints.length === 0) return null;

  let minDist = Infinity;
  let nearest: any = null;

  for (const point of stationPoints) {
    if (typeof point.lat !== 'number' || typeof point.lon !== 'number') continue;
    const from = turf.point([lon, lat]);
    const to = turf.point([point.lon, point.lat]);
    const distance = turf.distance(from, to, { units: 'kilometers' });
    if (distance < minDist) {
      minDist = distance;
      nearest = point;
    }
  }

  return nearest;
}, [stationPoints]);
// ===== TERRAIN TOGGLE =====
const toggleTerrain = useCallback(() => {
  setShowTerrain(prev => {
    const newVal = !prev;
    const map = mapRef.current;
    if (map) {
      const tl = (map as any)._terrainLayer;
      if (tl) {
        if (newVal) {
          map.addLayer(tl);
        } else {
          map.removeLayer(tl);
        }
      }
    }
    return newVal;
  });
}, []);



const fetchEnvData = useCallback(async () => {
  try {
    // Ambil koordinat center map
    const center = mapRef.current?.getCenter();
    if (!center) return;
    const lat = center.lat;
    const lon = center.lng;
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.warn('API Key OpenWeather tidak ada, pakai dummy');
      setEnvData({
        aqi: 42,
        windSpeed: 12,
        windDeg: 220,
        temp: 28.5
      });
      return;
    }
    // Air pollution
    const aqiRes = await axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
    const aqi = aqiRes.data.list[0].main.aqi; // 1-5
    // Weather (wind + temp)
    const weatherRes = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
    const windSpeed = weatherRes.data.wind.speed;
    const windDeg = weatherRes.data.wind.deg;
    const temp = weatherRes.data.main.temp;

    setEnvData({ aqi, windSpeed, windDeg, temp });
  } catch (err) {
    console.error('Gagal fetch data lingkungan', err);
    // Dummy fallback
    setEnvData({ aqi: 3, windSpeed: 5, windDeg: 180, temp: 27 });
  }
}, []);

const toggleHeatmap = useCallback(() => {
  setShowHeatmap(prev => !prev);
}, []);

const toggleAQI = useCallback(() => {
  setShowAQI(prev => !prev);
  if (!showAQI) fetchEnvData(); // panggil API saat pertama kali aktif
}, [showAQI]);

const toggleWind = useCallback(() => {
  setShowWind(prev => !prev);
  if (!showWind) fetchEnvData();
}, [showWind]);

const toggleTemperature = useCallback(() => {
  setShowTemperature(prev => !prev);
  if (!showTemperature) fetchEnvData();
}, [showTemperature, fetchEnvData]);  


  // ===== MARKER ICON =====
  const getMarkerIcon = useCallback((point: any, media: any[] = []) => {
    if (!L) return null;
    const cfg = CATEGORY_CONFIG[point.category] || CATEGORY_CONFIG['default'];
    const hasPhoto = media.some(m => m.media_type === 'photo' || m.media_type === 'video');
    const label = point.name.length > 15 ? point.name.slice(0, 12) + '…' : point.name;
    const baseStyle = `width:36px;height:36px;border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:16px;cursor:pointer;`;

    let iconHtml = '';

        // 🚨 SUMBER PENCEMARAN — marker khusus merah biohazard
    if (point.category === 'SUMBER_PENCEMARAN') {
      if (!document.getElementById('pollution-style')) {
        const style = document.createElement('style');
        style.id = 'pollution-style';
        style.textContent = `
          @keyframes pollution-ring {
            0%   { transform: scale(0.6); opacity: 1; }
            100% { transform: scale(2.4); opacity: 0; }
          }
          @keyframes pollution-pulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 4px rgba(220,38,38,0.35), 0 6px 20px rgba(220,38,38,0.6);
            }
            50% {
              transform: scale(1.1);
              box-shadow: 0 0 0 14px rgba(220,38,38,0.15), 0 6px 28px rgba(220,38,38,0.9);
            }
          }
        `;
        document.head.appendChild(style);
      }

      iconHtml = `
        <div style="position:relative;text-align:center;">
          <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:48px;height:48px;border-radius:50%;background:rgba(220,38,38,0.35);animation:pollution-ring 1.8s ease-out infinite;pointer-events:none;"></div>
          <div style="position:relative;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#EF4444,#991B1B);border:3px solid white;box-shadow:0 0 0 3px rgba(220,38,38,0.5),0 6px 20px rgba(220,38,38,0.6);display:flex;align-items:center;justify-content:center;animation:pollution-pulse 1.6s ease-in-out infinite;cursor:pointer;">
            <i class="fa-solid fa-biohazard" style="color:white;font-size:20px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));"></i>
          </div>
          <div style="font-size:9px;font-weight:800;color:white;background:#DC2626;padding:2px 8px;border-radius:10px;margin-top:4px;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.6);letter-spacing:0.3px;">
            ${label}
          </div>
        </div>
      `;
      return L.divIcon({
        className: 'custom-div-icon',
        html: iconHtml,
        iconSize: [48, 72],
        iconAnchor: [24, 36],
        popupAnchor: [0, -36],
      });
    }

    if (hasPhoto) {
      const firstMedia = media.find(m => m.media_type === 'photo' || m.media_type === 'video');
      iconHtml = `
        <div style="position:relative;text-align:center;">
          <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid ${cfg.color};box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;background:#fff;display:flex;align-items:center;justify-content:center;position:relative;">
            <img src="${firstMedia?.file_url || ''}" style="width:100%;height:100%;object-fit:cover;" />
            <div style="position:absolute;bottom:-4px;right:-4px;background:#00c8ff;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;border:2px solid #fff;">
              <i class="fa-solid fa-camera"></i>
            </div>
          </div>
          <div style="font-size:8px;font-weight:600;color:#1a1a2e;background:rgba(255,255,255,0.85);padding:0 4px;border-radius:4px;margin-top:2px;white-space:nowrap;max-width:60px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
            ${label}
          </div>
        </div>
      `;
      return L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [40, 56], iconAnchor: [20, 28], popupAnchor: [0, -28] });
    }

    if (point.category === 'BANGUNAN_LIAR') {
      iconHtml = `
        <div style="position:relative;text-align:center;">
          <div style="${baseStyle}background:#E64A19;color:white;border:2px solid #fff;box-shadow:0 2px 12px rgba(230,74,25,0.4);font-size:18px;">
            <i class="fa-solid fa-user"></i>
          </div>
          <div style="font-size:8px;font-weight:600;color:#1a1a2e;background:rgba(255,255,255,0.85);padding:0 4px;border-radius:4px;margin-top:2px;white-space:nowrap;max-width:60px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
            ${label}
          </div>
        </div>
      `;
      return L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [36, 50], iconAnchor: [18, 25], popupAnchor: [0, -25] });
    }

    if (point.category === 'BANJIR') {
      if (!document.getElementById('banjir-style')) {
        const style = document.createElement('style');
        style.id = 'banjir-style';
        style.textContent = `
          @keyframes pulse-banjir {
            0% { transform: scale(1); box-shadow: 0 2px 12px rgba(30,136,229,0.4); }
            50% { transform: scale(1.15); box-shadow: 0 2px 24px rgba(30,136,229,0.7); }
            100% { transform: scale(1); box-shadow: 0 2px 12px rgba(30,136,229,0.4); }
          }
        `;
        document.head.appendChild(style);
      }
      iconHtml = `
        <div style="position:relative;text-align:center;">
          <div style="${baseStyle}background:#1E88E5;color:white;border:2px solid #fff;box-shadow:0 2px 12px rgba(30,136,229,0.5);animation:pulse-banjir 1.5s infinite;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div style="font-size:8px;font-weight:600;color:#1a1a2e;background:rgba(255,255,255,0.85);padding:0 4px;border-radius:4px;margin-top:2px;white-space:nowrap;max-width:60px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
            ${label}
          </div>
        </div>
      `;
      return L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [36, 50], iconAnchor: [18, 25], popupAnchor: [0, -25] });
    }

    // Default
    iconHtml = `
      <div style="position:relative;text-align:center;">
        <div style="${baseStyle}background:#ffffff;color:${cfg.color};border:2px solid ${cfg.color};box-shadow:0 2px 12px rgba(0,0,0,0.25);">
          <i class="fa-solid ${cfg.icon}"></i>
        </div>
        <div style="font-size:8px;font-weight:600;color:#1a1a2e;background:rgba(255,255,255,0.85);padding:0 4px;border-radius:4px;margin-top:2px;white-space:nowrap;max-width:60px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
          ${label}
        </div>
      </div>
    `;
    return L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [36, 50], iconAnchor: [18, 25], popupAnchor: [0, -25] });
  }, [L]);

  

  // ===== LOAD DATA =====
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await axios.get(`${API_URL}/intake/geodata`, { timeout: 10000 });
        const data = res.data;

        const categorizedPoints = (data.points || []).map((p: any) => {
          const tags = extractHashtags(p.description || '');
          let category = categorizeFeature(p.name, p.description, 'point');

          // 🚨 Deteksi Sumber Pencemaran
          //   - Nama/deskripsi mengandung "pencemar" / "limbah" / "polusi" / "tumpahan"
          //   - ATAU punya hashtag #pencemaran / #sumberpencemaran / #limbah / #polusi
          const POLLUTION_TAGS = ['pencemaran', 'sumberpencemaran', 'limbah', 'polusi', 'tumpahan'];
          const isPollution =
            /pencemar|limbah|polusi|tumpahan/i.test(p.name || '') ||
            /pencemar|limbah|polusi|tumpahan/i.test(p.description || '') ||
            tags.some((t: string) => POLLUTION_TAGS.includes(t.toLowerCase()));

          if (isPollution) category = 'SUMBER_PENCEMARAN';

          return {
            ...p,
            category,
            tags,
          };
        });

        const categorizedLines = (data.lines || []).map((l: any) => ({
          ...l,
          category: categorizeFeature(l.name, l.description || '', 'line'),
          tags: extractHashtags(l.description || ''),
          length: l.length || 0,
        }));

        const categorizedPolygons = (data.polygons || []).map((p: any) => ({
          ...p,
          category: categorizeFeature(p.name, p.description || '', 'polygon'),
          tags: extractHashtags(p.description || ''),
          area_ha: p.area_ha || 0,
        }));

        const categorizedData = {
          points: categorizedPoints,
          lines: categorizedLines,
          polygons: categorizedPolygons,
        };
        setGeoData(categorizedData);
        setStationPoints(categorizedPoints);
        await loadAllMedia(categorizedPoints);

        if (categorizedPoints.length) {
          setActiveStation(categorizedPoints[0]);
          setActiveIdx(0);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Gagal load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ===== CACHE MEDIA =====
  useEffect(() => {
    const cached = sessionStorage.getItem('buildingMedia');
    const timestamp = sessionStorage.getItem('buildingMediaTimestamp');
    const isExpired = !timestamp || (Date.now() - parseInt(timestamp) > 5 * 60 * 1000);
    if (cached && !isExpired) {
      try { setBuildingMedia(JSON.parse(cached)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (Object.keys(buildingMedia).length > 0) {
      sessionStorage.setItem('buildingMedia', JSON.stringify(buildingMedia));
      sessionStorage.setItem('buildingMediaTimestamp', Date.now().toString());
    }
  }, [buildingMedia]);

  useEffect(() => {
  const m: Record<string, any> = {};
  stationPoints.forEach((p: any) => { m[p.name] = p; });
  stationPointsRef.current = m;
}, [stationPoints]);

  // ===== THEME =====
  useEffect(() => {
    const saved = localStorage.getItem('ilookai-theme');
    if (saved === 'dark') setIsDark(true);
    else if (saved === 'light') setIsDark(false);
    else setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  // ===== WEATHER =====
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 28,
    humidity: 75,
    rainfall: 0,
    condition: 'sunny',
    location: 'Cipamingkis'
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setWeather(prev => {
        const temp = 26 + Math.random() * 6;
        const humidity = 60 + Math.random() * 30;
        const rainfall = Math.random() > 0.7 ? Math.random() * 10 : 0;
        let condition: WeatherData['condition'] = 'sunny';
        if (rainfall > 5) condition = 'stormy';
        else if (rainfall > 1) condition = 'rainy';
        else if (humidity > 80) condition = 'cloudy';
        else condition = 'sunny';
        return {
          temperature: Math.round(temp * 10) / 10,
          humidity: Math.round(humidity),
          rainfall: Math.round(rainfall * 10) / 10,
          condition,
          location: 'Cipamingkis'
        };
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ===== MEASUREMENT STATES =====
  const [selectedSempadan, setSelectedSempadan] = useState<any>(null);
  const [selectedSawah, setSelectedSawah] = useState<any>(null);
  const [selectedSaluran, setSelectedSaluran] = useState<any>(null);
  const [measureMode, setMeasureMode] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState<any[]>([]);
  const [measureResult, setMeasureResult] = useState<any>(null);

  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    "INTAKE": true,
    "BCB": true,
    "BME": true,
    "BLE": true,
    "BTM": true,
    "BTE": true,
    "BTS": true,
    "BPE": true,
    "BSA": true,
    "BPP": true,
    "BRB": true,
    "BCK": true,
    "BPL": true,
    "BANJIR": true,
    "BANGUNAN_LIAR": true,
    "BATAS_WILAYAH": true,
    "RUMAH_DINAS": true,
    "RAWA": true,
    "SEMBADAN": true,
    "BATAS": true,
    "LUASAN_SAWAH": true,
    "BANJIR_POLY": true,
    "SALURAN_DEFAULT": true,
    "SUMBER_PENCEMARAN": true,
  });


    useEffect(() => {
    if (session?.user) {
      getUserLocation();
    }
  }, [session, getUserLocation]);


  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL belum dikonfigurasi');
    // ===== BATAS DESA (dari batas-admin.geoit.dev) =====

  // ===== INIT MAP =====
useEffect(() => {
  // Hanya jalankan jika tidak loading, tidak error, L sudah siap, dan map belum ada
  if (loading || error || !L || mapRef.current) return;

  // Jika container belum siap, retry
  if (!containerRef.current) {
    const retry = setTimeout(() => {
      if (containerRef.current && !mapRef.current && L) {
        // Panggil inisialisasi
        initMap();
      }
    }, 300);
    return () => clearTimeout(retry);
  }

  // Fungsi inisialisasi map menggunakan L dari closure
  const initMap = () => {
    if (!containerRef.current || mapRef.current || !L) return;
    console.log('🗺️ Init map...');

    const map = L.map(containerRef.current, {
      zoomControl: false,
      center: [-6.42531, 107.03924],
      zoom: 13,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
    }).addTo(map);
    // 🔥 TERRAIN LAYER (pakai OpenTopoMap)
    const terrainLayer = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      {
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
        maxZoom: 17,
      }
    );
    (map as any)._terrainLayer = terrainLayer;


    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
  // Taruh di file terpisah atau di atas component

    
   


    // Resize handling
    const resizeMap = () => { if (mapRef.current) mapRef.current.invalidateSize(); };
    setTimeout(resizeMap, 100);
    setTimeout(resizeMap, 300);
    setTimeout(resizeMap, 600);
    setTimeout(resizeMap, 1000);

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => resizeMap());
      ro.observe(containerRef.current);
      (map as any)._resizeObserver = ro;
    }

    mapRef.current = map;
    setMapReady(true);
    console.log('✅ Map siap!');
  };

  initMap();

 // Cleanup
  return () => {
      const m = mapRef.current as any;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading, error, L]);
  // ===== TOGGLE LAYER =====
useEffect(() => {
  window.toggleLayer = (key: string) => {
    setLayerVisibility(prev => {
      const newVal = !prev[key];
      const newState = { ...prev, [key]: newVal };
      if (mapRef.current && layerGroupsRef.current[key]) {
        if (newVal) mapRef.current.addLayer(layerGroupsRef.current[key]);
        else mapRef.current.removeLayer(layerGroupsRef.current[key]);
      }
      return newState;
    });
  };
  
  // 🔥 TAMBAHKAN INI
  window.toggleTerrain = toggleTerrain;
  
  return () => {
    window.toggleLayer = undefined;
    window.toggleTerrain = undefined;  // <-- TAMBAH
  };
}, [toggleTerrain]);


// Auto-pause animasi saat user pan/zoom — balik lagi setelah selesai
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const pauseAnim = () => {
      document.querySelectorAll('.flow-active').forEach(el => {
        el.classList.add('flow-paused');
      });
    };

    const resumeAnim = () => {
      document.querySelectorAll('.flow-active').forEach(el => {
        el.classList.remove('flow-paused');
      });
    };

    map.on('movestart', pauseAnim);
    map.on('zoomstart', pauseAnim);
    map.on('moveend', resumeAnim);
    map.on('zoomend', resumeAnim);

    return () => {
      map.off('movestart', pauseAnim);
      map.off('zoomstart', pauseAnim);
      map.off('moveend', resumeAnim);
      map.off('zoomend', resumeAnim);
    };
  }, [mapReady]);

useEffect(() => {
  if (!legendContainerRef.current) return;
  const isMobile = window.innerWidth < 640;
  const el = legendContainerRef.current;
  if (isMobile) {
    el.style.display = isPanelOpen ? 'none' : 'block';
  } else {
    el.style.display = 'block';
  }
}, [isPanelOpen]);

  useEffect(() => {
  const map = mapRef.current;
  if (!mapReady || !map || !villageGeo) {
    // Hapus layer jika ada
    if (villageLayerRef.current && map) {
      map.removeLayer(villageLayerRef.current);
      villageLayerRef.current = null;
    }
    return;
  }

  const isVisible = layerVisibility['BATAS_DESA'] !== false;
  const zoom = map.getZoom();
  const shouldShow = isVisible && zoom >= 13; // threshold zoom

  const currentGroup = villageLayerRef.current;
  const isAdded = currentGroup && map.hasLayer(currentGroup);

  // Jika kondisi sama, tidak perlu rebuild
  if (currentGroup && isAdded === shouldShow) {
    return;
  }

  // Hapus layer lama
  if (currentGroup) {
    map.removeLayer(currentGroup);
    villageLayerRef.current = null;
  }

  if (!shouldShow) return;

  // Buat layer baru dengan tooltip permanen
  const newGroup = L.layerGroup();

  L.geoJSON(villageGeo, {
    style: {
      color: '#8B5CF6',
      weight: 1.8,
      opacity: 0.7,
      fillOpacity: 0.06,
      fillColor: '#8B5CF6',
    },
    onEachFeature: (feature: any, layer: any) => {
      const name = feature.properties?.name ||
                   feature.properties?.NAMA_DESA ||
                   feature.properties?.nama ||
                   'Desa';

      layer.bindTooltip(name, {
        permanent: true,
        direction: 'center',
        className: 'village-label-google',
        offset: [0, 0],
        opacity: 0.85,
      });
      layer.bindPopup(`<b>${name}</b>`);
      // Tidak ada event click yang memicu zoom
    },
  }).addTo(newGroup);

  villageLayerRef.current = newGroup;
  map.addLayer(newGroup);

  // Fungsi untuk update saat zoom berubah
  const updateZoom = () => {
    if (!mapRef.current) return;
    const currentZoom = mapRef.current.getZoom();
    const currentVisible = layerVisibility['BATAS_DESA'] !== false;
    const shouldShowNow = currentVisible && currentZoom >= 13;
    const group = villageLayerRef.current;
    if (!group) return;
    const isAddedNow = mapRef.current.hasLayer(group);
    if (shouldShowNow && !isAddedNow) {
      mapRef.current.addLayer(group);
    } else if (!shouldShowNow && isAddedNow) {
      mapRef.current.removeLayer(group);
    }
  };

  map.on('zoomend', updateZoom);

  // Cleanup
  return () => {
    map.off('zoomend', updateZoom);
    if (villageLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(villageLayerRef.current);
      villageLayerRef.current = null;
    }
  };
}, [villageGeo, mapReady, layerVisibility['BATAS_DESA']]);

  // ============ RENDER DATA ============
  const renderData = useCallback(() => {
    if (!mapReady || !mapRef.current || !geoData || !L) return;
    const map = mapRef.current;
    console.log('📊 Render data...');

    // Hapus semua layer non-tile/control
    map.eachLayer((l: any) => {
      if (!(l instanceof L.TileLayer) &&
          !(l instanceof L.Control) &&
          !(l instanceof L.Control.Zoom) &&
          !(l instanceof L.Control.Scale)) {
        map.removeLayer(l);
      }
    });
    layerGroupsRef.current = {};

    const points = filteredPoints;
    const lines = filteredLines;
    const polygons = filteredPolygons;

      if (showWind && envData?.windSpeed) {
        const windData = {
          header: { lat1: -6.5, lon1: 107.0, lat2: -6.35, lon2: 107.1, nx: 20, ny: 20 },
          data: Array.from({ length: 20 * 20 }, () => ({
            u: (Math.random() - 0.5) * 10,
            v: (Math.random() - 0.5) * 10
          }))
        };
        const windLayer = (L as any).windLayer(windData, { colorScale: 'viridis' });
        windLayer.addTo(map);
        (window as any)._windLayer = windLayer;
      }
        // ===== POLYGONS =====
    const polygonGroups: Record<string, L.LayerGroup> = {};
    polygons.forEach((poly: any) => {
        
      if (!poly?.path || !Array.isArray(poly.path) || poly.path.length === 0) return;
      const category = poly.category || 'default';
      const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];
      let color = cfg.color, fillColor = cfg.color, weight = 2, dashArray = 'none', fillOpacity = 0.3;
      // ===== 🔥 MERCU BENDUNG: WATERFALL ANIMATION =====
      const isMercu = /mercu\s*bendung|bendung\s*mercu/i.test(poly.name || '');
      if (isMercu) {
        const mercuDebit =
          latestDebits?.['Mercu Bendung'] ||
          Object.values(latestDebits || {}).find(
            (f: any) => /mercu/i.test(f.buildingId || '')
          ) ||
          null;
        // Inject style sekali saja
        if (!document.getElementById('mercu-waterfall-style')) {
          const style = document.createElement('style');
          style.id = 'mercu-waterfall-style';
          style.textContent = `
            @keyframes mercu-flow {
              from { stroke-dashoffset: 220; }
              to   { stroke-dashoffset: 0; }
            }
            @keyframes mercu-pulse {
              0%, 100% { fill-opacity: 0.30; }
              50%      { fill-opacity: 0.75; }
            }
            @keyframes mercu-cascade {
              0%   { stroke-dashoffset: 28; opacity: 0.15; }
              40%  { opacity: 1; }
              100% { stroke-dashoffset: 0; opacity: 0.15; }
            }
            @keyframes mercu-spray {
              0%   { r: 2; opacity: 0.9; }
              100% { r: 8; opacity: 0; }
            }
            .mercu-crest-flow {
              animation: mercu-flow 1.6s linear infinite;
              filter: url(#water-turbulence);
            }
            .mercu-foam-pulse {
              animation: mercu-pulse 2.2s ease-in-out infinite;
            }
            .mercu-cascade-line {
              animation: mercu-cascade 1.1s linear infinite;
              filter: url(#water-turbulence);
            }
            .mercu-spray {
              animation: mercu-spray 1.4s ease-out infinite;
            }
          `;
          document.head.appendChild(style);
        }

            // ---- 1. Kolam olak / badan air (dasar) ----
            const mercuPool = L.polygon(poly.path, {
              color: '#0369A1',
              fillColor: '#0EA5E9',
              fillOpacity: 0.55,
              weight: 2,
            });

            // ---- 2. Foam putih berdenyut (buih) ----
            const mercuFoam = L.polygon(poly.path, {
              color: '#FFFFFF',
              fillColor: '#E0F2FE',
              fillOpacity: 0.5,
              weight: 1,
              className: 'mercu-foam-pulse',
              interactive: false,
            });

            // ---- 3. Crest line dengan aliran turbulensi ----
            const mercuCrest = L.polygon(poly.path, {
              color: '#F0F9FF',
              weight: 4,
              fillColor: 'transparent',
              fillOpacity: 0,
              dashArray: '6, 10',
              className: 'mercu-crest-flow',
              interactive: false,
            });

            // ---- 4. Cascade: garis air jatuh tegak lurus crest ----
            const cascadeLayers: L.Polyline[] = [];
            const path = poly.path as number[][];
            const p0 = path[0];
            const pMid = path[Math.floor(path.length / 2)];
            const axisLat = pMid[0] - p0[0];
            const axisLng = pMid[1] - p0[1];
            const axisLen = Math.hypot(axisLat, axisLng) || 1;
            // Perpendicular (rotasi 90°) — arah jatuh air
            const perpLat = -axisLng / axisLen;
            const perpLng =  axisLat / axisLen;
            const dropLen = 0.00022; // ~22 m (jarak visual jatuh)

            const numDrops = 7;
            for (let i = 1; i <= numDrops; i++) {
              const t = i / (numDrops + 1);
              const baseLat = p0[0] + axisLat * (t * 2); // interpolasi 0..1
              const baseLng = p0[1] + axisLng * (t * 2);
              const endLat  = baseLat + perpLat * dropLen;
              const endLng  = baseLng + perpLng * dropLen;

              const cascade = L.polyline(
                [[baseLat, baseLng], [endLat, endLng]],
                {
                  color: '#BAE6FD',
                  weight: 3,
                  opacity: 0.85,
                  dashArray: '2, 6',
                  className: 'mercu-cascade-line',
                  interactive: false,
                }
              );
              cascadeLayers.push(cascade);
            }

            // ---- 5. Spray / percikan di titik jatuh ----
            const sprayGroup = L.layerGroup();
            for (let i = 1; i <= numDrops; i++) {
              const t = i / (numDrops + 1);
              const baseLat = p0[0] + axisLat * (t * 2) + perpLat * dropLen;
              const baseLng = p0[1] + axisLng * (t * 2) + perpLng * dropLen;
              const spray = L.circleMarker([baseLat, baseLng], {
                radius: 4,
                color: '#E0F2FE',
                fillColor: '#FFFFFF',
                fillOpacity: 0.7,
                weight: 1,
                className: 'mercu-spray',
                interactive: false,
              });
              sprayGroup.addLayer(spray);
            }

            // ---- Popup ----
            const popupContent = `
                <div style="font-family:Inter;min-width:230px;">
                  <h4 style="margin:0 0 6px 0;font-size:14px;color:#1a1a2e;">${poly.name || 'Mercu Bendung'}</h4>

                  <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:#e0f2fe;border-radius:8px;border:1px solid #7dd3fc;">
                    <span style="font-size:14px;">💧</span>
                    <span style="font-size:11px;font-weight:700;color:#0284C7;letter-spacing:0.3px;">AIR TERJUN / MERCU</span>
                  </div>

                  ${mercuDebit ? `
                    <div style="margin-top:8px;padding:10px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
                      <div style="font-size:10px;color:#666;margin-bottom:3px;">Debit terbaru</div>
                      <div style="font-size:20px;font-weight:800;color:#0369a1;font-family:monospace;line-height:1.1;">
                        ${Number(mercuDebit.debit).toFixed(2)}
                        <span style="font-size:11px;font-weight:600;">m³/d</span>
                      </div>
                      <div style="font-size:9px;color:#94a3b8;margin-top:4px;">
                        Update: ${mercuDebit.tanggal || '-'} · ${mercuDebit.jam || '-'}
                      </div>
                    </div>
                  ` : `
                    <div style="margin-top:8px;padding:8px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;color:#94a3b8;font-size:10px;">
                      Belum ada data debit hari ini.
                    </div>
                  `}

                  <p style="margin:8px 0 0 0;font-size:10px;color:#666;line-height:1.4;">
                    Aliran air jatuh dari puncak bendung menuju kolam olak.
                  </p>
                </div>
              `;
            mercuPool.bindPopup(popupContent);
            mercuPool.on('click', () => {
              setSelectedFeature({
                name: poly.name,
                category: 'MERCU_BENDUNG',
                description: poly.description,
                tags: poly.tags || [],
                lat: (p0[0] + pMid[0]) / 2,
                lon: (p0[1] + pMid[1]) / 2,

                // 🔥 debit
                debit: mercuDebit?.debit ?? null,
                debitInfo: mercuDebit || null,
                bendungName: 'Mercu Bendung',
              });
              if (!isPanelOpen) setIsPanelOpen(true);
            });

            // ---- Gabung jadi satu layer group ----
            const mercuGroup = L.layerGroup([
              mercuPool,
              mercuFoam,
              mercuCrest,
              ...cascadeLayers,
              sprayGroup,
            ]);

            if (!polygonGroups['default']) polygonGroups['default'] = L.layerGroup();
            polygonGroups['default'].addLayer(mercuGroup);
            return; // skip rendering normal
          }
          // ===== END MERCU =====
      
      // ✅ SESUDAH — pakai warna musim tanam kalau ada
      if (category === 'LUASAN_SAWAH') {
        const mt = musimTanamByPolygon[poly.name];
        if (mt && MUSIM_TANAM_STATUS[mt.status as keyof typeof MUSIM_TANAM_STATUS]) {
          const meta = MUSIM_TANAM_STATUS[mt.status as keyof typeof MUSIM_TANAM_STATUS];
          color = meta.color;
          fillColor = meta.color;
          fillOpacity = 0.55;
        } else {
          color = '#FDD835';
          fillColor = '#FDD835';
          fillOpacity = 0.4;
        }
      } else if (category === 'BANJIR_POLY') {
        color = '#1E88E5'; fillColor = '#1E88E5'; fillOpacity = 0.3;
      }
      const layer = L.polygon(poly.path, { color, weight, dashArray, fillColor, fillOpacity });

      let popupContent = `
        <div style="font-family:Inter;min-width:150px;">
          <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">${poly.name || 'Area'}</h4>
          <p style="margin:0;font-size:11px;color:#666;">${cfg.label}</p>
      `;
        if (category === 'LUASAN_SAWAH' && poly.area_ha) {
          const mt = musimTanamByPolygon[poly.name];
          const statusMeta = mt
            ? MUSIM_TANAM_STATUS[mt.status as keyof typeof MUSIM_TANAM_STATUS]
            : null;

          popupContent += `
            <p style="margin:4px 0 0 0;font-size:12px;color:#FDD835;font-weight:bold;">🌾 Luas: ${Math.round(poly.area_ha)} Ha</p>
          `;

          if (statusMeta) {
            // 🔥 Ambil nama reporter
            const reporterName =
              mt.reporter_name ||
              (mt.reporter_email ? mt.reporter_email.split('@')[0] : null) ||
              'Anonim';
            const reporterRole = mt.reporter_role || null;

            // Format tanggal update
            let updatedAtStr = '';
            if (mt.updated_at) {
              try {
                const d = new Date(mt.updated_at);
                updatedAtStr = d.toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
              } catch {}
            }

            popupContent += `
              <div style="margin-top:6px;padding:8px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="width:12px;height:12px;border-radius:3px;background:${statusMeta.color};display:inline-block;"></span>
                  <span style="font-size:12px;font-weight:600;color:#15803d;">${statusMeta.label}</span>
                </div>
                ${mt.keterangan ? `<div style="font-size:10px;color:#666;margin-top:4px;">${mt.keterangan}</div>` : ''}
              </div>

              <!-- 🔥 TRANSPARANSI: Uploader & Waktu -->
              <div style="margin-top:6px;padding:6px 8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
                <div style="display:flex;align-items:center;gap:5px;">
                  <div style="width:18px;height:18px;border-radius:50%;background:#16A34A;color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;">
                    ${reporterName.charAt(0).toUpperCase()}
                  </div>
                  
                  <span style="font-size:10px;font-weight:700;color:#16A34A;">@${reporterName}</span>
                  ${reporterRole ? `<span style="font-size:8px;background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:8px;font-weight:600;text-transform:uppercase;">${reporterRole}</span>` : ''}
                </div>
                ${updatedAtStr ? `<div style="font-size:9px;color:#94a3b8;margin-top:3px;display:flex;align-items:center;gap:3px;">📅 Update: ${updatedAtStr}</div>` : ''}
              </div>
            `;
          } else {
            popupContent += `<p style="margin:4px 0 0 0;font-size:10px;color:#999;">Belum ada laporan musim tanam</p>`;
          }
        }
      popupContent += `</div>`;
      layer.bindPopup(popupContent);

      if (!polygonGroups[category]) polygonGroups[category] = L.layerGroup();
      polygonGroups[category].addLayer(layer);
    });
    Object.keys(polygonGroups).forEach(key => {
      layerGroupsRef.current[key] = polygonGroups[key];
      if (layerVisibility[key] !== false) map.addLayer(polygonGroups[key]);
    });

    // ===== LINES =====
    const lineGroups: Record<string, L.LayerGroup> = {};
    lines.forEach((line: any) => {
      if (!line?.path || !Array.isArray(line.path) || line.path.length === 0) return;
      const category = line.category || 'SALURAN_DEFAULT';
      // if (category === 'SALURAN_DEFAULT' && line.name && /\bsaluran\b/i.test(line.name)) return;

      const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['SALURAN_DEFAULT'];
      const isKejuron = category === 'KEJURON';
      const isSempadan = category === 'SEMBADAN';
      const isSaluran = category === 'SALURAN_DEFAULT' || category === 'default';

        // 🔥 EFEK GLOW UNTUK SALURAN
          if (isSaluran) {
            const deadCanalPatterns: RegExp[] = [
              /saluran\s*sekunder\s*cilangkara/i,
              /saluran\s*pegadungan/i,
              /saluran\s*sekunder\s*jati/i,

              // B.Sa. 8-10 — Sampora
              /^b\.?\s*sa\.?\s*8\s*[-–—]\s*10/i,

              // B.Pp. — Pasir Pogor (match harus ada "pasir pogor" ATAU diawali "B.Pp")
              /pasir\s*pogor/i,
              /^b\.?\s*pp\.?\s/i,   // diawali "B.Pp " (pakai spasi di akhir biar gak match "Bppp")

              // B.Ts — Tegal Sapi
              /tegal\s*sapi/i,
              /^b\.?\s*ts\.?\s/i,
            ];

          const rawName = (line.name || '').trim();
          const isDeadCanal = deadCanalPatterns.some((re) => re.test(rawName));

            const rawFlow = showFlowAnimation ? saluranFlowMap[line.name] : null;

            // ===== CASE 1: SALURAN MATI (Tanpa Animasi Aliran) =====
            if (isDeadCanal) {
              const base = L.polyline(line.path, {
                color: '#64748B', // Warna abu-abu / mati
                weight: 3,
                opacity: 0.6,
                lineJoin: 'round',
                dashArray: '6 6',  // Garis putus-putus penanda tidak aktif
              });

              base.bindPopup(`
                <div style="font-family:Inter;min-width:180px;">
                  <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">${line.name || 'Saluran'}</h4>
                  <p style="margin:0;font-size:11px;color:#666;">${cfg.label}</p>
                  ${line.length ? `<p style="margin:4px 0 0 0;font-size:12px;color:#64748B;font-weight:bold;">📏 Panjang: ${formatLength(line.length)}</p>` : ''}
                  <div style="margin-top:8px;padding:6px;background:#f1f5f9;border-radius:6px;color:#ef4444;font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;">
                    🚫 Saluran Non-Aktif / Mati
                  </div>
                </div>
              `);

              base.on('click', () => {
                setSelectedSaluran({ name: line.name || 'Saluran', length: line.length || 0 });
                if (!isPanelOpen) setIsPanelOpen(true);
              });

              if (!lineGroups['SALURAN_DEFAULT']) lineGroups['SALURAN_DEFAULT'] = L.layerGroup();
              lineGroups['SALURAN_DEFAULT'].addLayer(base);
              return;
            }

        const defaultFlow = {
          color: '#00E5FF',
          width: 3,
          duration: 8,
          debit: 0,
          from: 'Pintu Air Primary',
          tanggal: 'Test Mode',
          jam: '00:00',
        };

      const flow = rawFlow ? { ...defaultFlow, ...rawFlow } : defaultFlow;

      // 1. BED / DASAR AIR
      const bed = L.polyline(line.path, {
        color: '#0369A1',
        weight: flow.width + 2,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
      });

      // 2. MID CURRENT / ARUS TENGAH
      const mid = L.polyline(line.path, {
        color: '#38BDF8',
        weight: flow.width - 1,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
        dashArray: '20, 15, 45, 10, 60, 20',
        className: 'flow-water-mid',
      });

      // 3. SURFACE / BUIH PERMUKAAN
      const surface = L.polyline(line.path, {
        color: '#E0F2FE',
        weight: Math.max(1, flow.width - 4),
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
        dashArray: '2, 50, 4, 80, 1, 40',
        className: 'flow-water-surface',
        interactive: false,
      });

      // Set CSS var duration ke elemen SVG setelah layer ditambahkan
      [mid, surface].forEach((layer) => {
        layer.on('add', () => {
          const el = (layer as any)._path as SVGPathElement | undefined;
          if (el) {
            el.style.setProperty('--fd', `${flow.duration}s`);
            el.dataset.fd = String(flow.duration);
          }
        });
      });

      // Popup & Click Interaksi
      mid.bindPopup(`
        <div style="font-family:Inter;min-width:220px;">
          <h4 style="margin:0 0 6px 0;font-size:14px;color:#1a1a2e;">${line.name || 'Saluran'}</h4>
          <p style="margin:0 0 6px 0;font-size:11px;color:#666;">💧 Dialiri dari <b>${flow.from}</b></p>
          <div style="padding:10px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
            <div style="font-size:18px;font-weight:700;color:#0369a1;font-family:monospace;">
              ${flow.debit.toFixed(2)} m³/d
            </div>
            <div style="font-size:10px;color:#666;margin-top:4px;">
              Update: ${flow.tanggal} · ${flow.jam}
            </div>
          </div>
          ${line.length ? `<p style="margin:8px 0 0 0;font-size:12px;color:#00E5FF;font-weight:bold;">📏 Panjang: ${formatLength(line.length)}</p>` : ''}
        </div>
      `);

      mid.on('click', () => {
        setSelectedSaluran({ name: line.name || 'Saluran', length: line.length || 0, flow });
        if (!isPanelOpen) setIsPanelOpen(true);
      });

      // Urutan addLayer: bed paling bawah, surface paling atas
      const group = L.layerGroup([bed, mid, surface]);
      if (!lineGroups['SALURAN_DEFAULT']) lineGroups['SALURAN_DEFAULT'] = L.layerGroup();
      lineGroups['SALURAN_DEFAULT'].addLayer(group);

      return;
      }
      // KEJURON
      if (isKejuron) {
        const layer = L.polyline(line.path, { color: '#AAAAAA', weight: 1.5, dashArray: '2, 6', opacity: 0.3, lineJoin: 'round' });
        layer.bindPopup(`
          <div style="font-family:Inter;min-width:150px;">
            <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">${line.name || 'Kejuron'}</h4>
            <p style="margin:0;font-size:11px;color:#666;">✕ Batas Kejuron</p>
            ${line.length ? `<p style="margin:4px 0 0 0;font-size:12px;color:#AAAAAA;font-weight:bold;">📏 Panjang: ${formatLength(line.length)}</p>` : ''}
          </div>
        `);
        layer.on('click', () => {
          if (line.length) {
            setSelectedSaluran({ name: line.name || 'Kejuron', length: line.length });
            if (!isPanelOpen) setIsPanelOpen(true);
          }
        });
        if (!lineGroups['KEJURON']) lineGroups['KEJURON'] = L.layerGroup();
        lineGroups['KEJURON'].addLayer(layer);
        return;
      }

      // SEMPADAN
      if (isSempadan) {
        const dash = '4, 4';
        const mainColor = '#FF0000';
        const glow = L.polyline(line.path, { color: '#FF0000', weight: 6, dashArray: dash, opacity: 0.05, interactive: false });
        const outline = L.polyline(line.path, { color: '#FFFFFF', weight: 3, dashArray: dash, opacity: 0.2, interactive: false });
        const mainLine = L.polyline(line.path, { color: mainColor, weight: 2, dashArray: dash, opacity: 0.15, lineJoin: 'round' });
        mainLine.on('mouseover', function (e: any) { e.target.setStyle({ weight: 3, opacity: 0.7 }); });
        mainLine.on('mouseout', function (e: any) { e.target.setStyle({ weight: 2, opacity: 0.15 }); });
        mainLine.on('click', function (e: any) {
          const latlngs = e.target.getLatLngs();
          let totalLength = 0;
          const segments: { from: number; to: number; distance: number }[] = [];
          for (let i = 0; i < latlngs.length - 1; i++) {
            const dist = map.distance(latlngs[i], latlngs[i + 1]);
            totalLength += dist;
            segments.push({ from: i + 1, to: i + 2, distance: dist });
          }
          setSelectedSempadan({ name: line.name || 'Sempadan', length: totalLength, segments, coordinates: latlngs.map((l: L.LatLng) => [l.lat, l.lng]) });
          if (!isPanelOpen) setIsPanelOpen(true);
          map.fitBounds(e.target.getBounds(), { padding: [50, 50] });
        });
        const group = L.layerGroup([glow, outline, mainLine]);
        if (!lineGroups['SEMBADAN']) lineGroups['SEMBADAN'] = L.layerGroup();
        lineGroups['SEMBADAN'].addLayer(group);
        return;
      }

      // GARIS LAIN
      let color = cfg.color, weight = 3, dashArray = 'none', opacity = 0.95;
      if (category === 'BATAS') { color = '#F57C00'; weight = 3; dashArray = '10, 8'; }
      else if (category === 'SALURAN_DEFAULT' || category === 'default') { color = '#00E5FF'; weight = 3; dashArray = 'none'; }

      const layer = L.polyline(line.path, { color, weight, dashArray, opacity, lineJoin: 'round' });
      let popupContent = `
        <div style="font-family:Inter;min-width:150px;">
          <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">${line.name || 'Saluran'}</h4>
          <p style="margin:0;font-size:11px;color:#666;">${cfg.label}</p>
      `;
      if (line.length) {
        popupContent += `<p style="margin:4px 0 0 0;font-size:12px;color:#00E5FF;font-weight:bold;">📏 Panjang: ${formatLength(line.length)}</p>`;
      }
      popupContent += `</div>`;
      layer.bindPopup(popupContent);
      layer.on('click', () => {
        if (line.length) {
          setSelectedSaluran({ name: line.name || 'Saluran', length: line.length });
          if (!isPanelOpen) setIsPanelOpen(true);
        }
      });

      if (!lineGroups[category]) lineGroups[category] = L.layerGroup();
      lineGroups[category].addLayer(layer);
    });

    Object.keys(lineGroups).forEach(key => {
      layerGroupsRef.current[key] = lineGroups[key];
      if (layerVisibility[key] !== false) map.addLayer(lineGroups[key]);
    });

    // ===== MARKERS =====
    const markerGroups: Record<string, any> = {};
    Object.keys(CATEGORY_CONFIG).forEach(key => {
      if (CATEGORY_CONFIG[key]?.type !== 'point') return;
      markerGroups[key] = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          const cfg = CATEGORY_CONFIG[key];
          return L.divIcon({
            html: `<div style="background:${cfg?.color || '#00c8ff'};color:white;border-radius:50%;width:${count > 9 ? 40 : 34}px;height:${count > 9 ? 40 : 34}px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${count > 9 ? 12 : 13}px;box-shadow:0 2px 12px rgba(0,0,0,0.3);border:2px solid white;">${count}</div>`,
            className: 'custom-cluster-icon',
            iconSize: [count > 9 ? 40 : 34, count > 9 ? 40 : 34],
            iconAnchor: [count > 9 ? 20 : 17, count > 9 ? 20 : 17],
          });
        }
      });
    });

    
// Ambil semua ID bendung


    points.forEach((point: any, idx: number) => {
      if (!point || typeof point.lat !== 'number' || typeof point.lon !== 'number') return;
      loadBuildingMedia(point.name);
      const media = buildingMedia[point.name] || [];
      const icon = getMarkerIcon(point, media);
      const category = point.category || 'default';
      const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];

      const marker = L.marker([point.lat, point.lon], { icon })
        .bindPopup(`
          <div style="min-width:180px;font-family:Inter;">
            <h3 style="font-weight:600;font-size:14px;margin:0 0 4px 0;color:#1a1a2e;">${point.name}</h3>
            <p style="font-size:11px;color:#999;font-family:monospace;margin:0 0 4px 0;">${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}</p>
            <p style="font-size:10px;color:${cfg.color};margin:0;font-weight:500;">🏷️ ${cfg.label}</p>
          </div>
        `)

        
        .on('click', () => {
          console.log('🔍 Session user:', session?.user);
          console.log('📌 Lat:', session?.user?.lat, 'Lon:', session?.user?.lon);
          if (measureMode) {
            if (selectedPoints.length === 0) {
              setSelectedPoints([{ lat: point.lat, lng: point.lon, name: point.name }]);
              L.popup().setLatLng([point.lat, point.lon]).setContent('📍 Titik 1 (klik titik lain untuk mengukur)').openOn(map);
            } else if (selectedPoints.length === 1) {
              const p1 = selectedPoints[0];
              const p2 = { lat: point.lat, lng: point.lon, name: point.name };
              const from = turf.point([p1.lng, p1.lat]);
              const to = turf.point([p2.lng, p2.lat]);
              const distance = turf.distance(from, to, { units: 'meters' });
              setMeasureResult({ distance, from: p1.name, to: p2.name });
              setSelectedPoints([]);
              setMeasureMode(false);
              const line = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], { color: '#FF6B6B', weight: 3, dashArray: '5, 10' }).addTo(map);
              setTimeout(() => map.removeLayer(line), 5000);
              if (!isPanelOpen) setIsPanelOpen(true);
            }
          } else {
          setActiveStation(point);
            setActiveIdx(idx);
            setSelectedFeature(point);

            const role = normalizeRole(session?.user?.role);

            // ===== REPORTER: curah hujan (bangunan terdekat) =====
              const isCHBuilding = /curah\s*hujan/i.test(point.name);

              // A. Bangunan CURAH HUJAN
              if (isCHBuilding) {
                // Reporter: cek bangunan terdekat
                if (role === 'reporter' && canReportCurahHujan(session?.user?.role)) {
                  const reporterLat = session?.user?.lat;
                  const reporterLon = session?.user?.lon;
                  if (reporterLat && reporterLon) {
                    const nearest = getNearestBuilding(reporterLat, reporterLon);
                    if (nearest && nearest.name === point.name) {
                      setSelectedBuildingId(point.name);
                      setSelectedBuildingName(point.name);
                      setShowRainfallInput(true);
                    } else {
                      toast.error(`Anda hanya bisa input di bangunan terdekat: ${nearest?.name || 'tidak ditemukan'}`);
                      setShowRainfallInput(false);
                      if (nearest && mapRef.current) mapRef.current.flyTo([nearest.lat, nearest.lon], 15);
                    }
                  } else {
                    toast.error('Lokasi Anda belum diatur.');
                    setShowRainfallInput(false);
                  }
                  setShowDebitInput(false);
                }
                // Polygon role: cek apakah bangunan di dalam polygon
                else if ((['pob', 'juru', 'supervisor', 'tpop'] as string[]).includes(role ?? '')) {
                  const poly = session?.user?.polygon as number[][] | undefined;
                  let inPoly = false;
                  if (poly && poly.length >= 3) {
                    try {
                      const ring = [...poly];
                      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
                        ring.push(ring[0]);
                      }
                      inPoly = turf.booleanPointInPolygon(
                        turf.point([point.lon, point.lat]),
                        turf.polygon([ring])
                      );
                    } catch (e) {
                      console.warn('polygon check failed:', e);
                    }
                  }
                  if (inPoly) {
                    setSelectedBuildingId(point.name);
                    setSelectedBuildingName(point.name);
                    setShowRainfallInput(true);
                  } else {
                    toast.error('Bangunan ini di luar wilayah kerja Anda.');
                    setShowRainfallInput(false);
                  }
                  setShowDebitInput(false);
                }
                else {
                  setShowRainfallInput(false);
                  setShowDebitInput(false);
                }
              }
              // B. Bangunan BENDUNG (non-curah-hujan)
              else if (
                canReportDebit(session?.user?.role) &&
                isBendungCategory(point.category)
              ) {
                setSelectedBendungId(point.name);
                setSelectedBendungName(point.name);
                setShowDebitInput(true);
                setShowRainfallInput(false);
              }
              // C. Role lain
              else {
                setShowRainfallInput(false);
                setShowDebitInput(false);
              }

            loadBuildingMedia(point.name);
            map.flyTo([point.lat, point.lon], 17, { duration: 1.2 });
          }

          })

      if (markerGroups[category]) markerGroups[category].addLayer(marker);
    });



    Object.keys(markerGroups).forEach(key => {
      layerGroupsRef.current[key] = markerGroups[key];
      if (layerVisibility[key] !== false) map.addLayer(markerGroups[key]);
    });

      // ===== HEATMAP =====
      if ((window as any)._heatLayer) {
        map.removeLayer((window as any)._heatLayer);
        delete (window as any)._heatLayer;
      }

      // Cek apakah L.heat tersedia
      const heatAvailable = typeof (L as any).heat === 'function' || typeof (L as any).heatLayer === 'function';
      const heatFunc = (L as any).heat || (L as any).heatLayer;

      if (showHeatmap && points.length > 0) {
        if (typeof heatFunc === 'function') {
          const heatPoints = points.map(p => [p.lat, p.lon, 1]);
          const heatLayer = heatFunc(heatPoints, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
          });
          heatLayer.addTo(map);
          (window as any)._heatLayer = heatLayer;
        } else {
          // Fallback: tampilkan circle markers dengan opacity berdasarkan kepadatan
          console.warn('⚠️ leaflet.heat tidak tersedia, menggunakan fallback circle markers.');
          const heatGroup = L.layerGroup();
          const density = points.length / 100; // sesuaikan
          points.forEach(p => {
            const radius = 5 + (Math.random() * 5); // variasi radius
            const circle = L.circleMarker([p.lat, p.lon], {
              radius: radius,
              fillColor: '#ff4500',
              color: '#ff4500',
              weight: 0.5,
              opacity: 0.3,
              fillOpacity: 0.2 + (Math.random() * 0.3)
            });
            heatGroup.addLayer(circle);
          });
          heatGroup.addTo(map);
          (window as any)._heatLayer = heatGroup;
        }
      }


    // ===== AQI =====
    if ((window as any)._aqiLayer) {
      map.removeLayer((window as any)._aqiLayer);
      delete (window as any)._aqiLayer;  // perbaiki: hapus kurung tutup berlebih
    }
    if (showAQI && envData?.aqi) {
      const aqiGroup = L.layerGroup();
      const aqiColor = envData.aqi <= 2 ? '#00e400' : envData.aqi <= 3 ? '#ffff00' : '#ff7e00';
      points.slice(0, 10).forEach(p => {
        const circle = L.circleMarker([p.lat, p.lon], {
          radius: 8,
          fillColor: aqiColor,
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }).bindPopup(`<b>${p.name}</b><br>AQI: ${envData.aqi}`);
        aqiGroup.addLayer(circle);
      });
      aqiGroup.addTo(map);
      (window as any)._aqiLayer = aqiGroup;
    }

    // ===== WIND =====
// ===== WIND (leaflet-wind) =====
if ((window as any)._windLayer) {
  map.removeLayer((window as any)._windLayer);
  delete (window as any)._windLayer;
}

if (showWind && envData?.windSpeed) {
  // Cek apakah windLayer tersedia
  const windLayer = (L as any).windLayer;
  if (typeof windLayer === 'function') {
    // Buat grid data angin (dummy)
    const windData = {
      header: {
        lat1: -6.5,
        lon1: 107.0,
        lat2: -6.35,
        lon2: 107.1,
        nx: 30,
        ny: 30
      },
      data: Array.from({ length: 30 * 30 }, () => ({
        u: (Math.random() - 0.5) * 15,
        v: (Math.random() - 0.5) * 15
      }))
    };
    
    const layer = windLayer(windData, {
      colorScale: 'viridis',
      velocityScale: 0.02,
      maxVelocity: 15,
      opacity: 0.8,
      particleAge: 60,
      particleCount: 500
    });
    layer.addTo(map);
    (window as any)._windLayer = layer;
  } else {
    console.warn('leaflet-wind tidak tersedia, pakai fallback panah');
    // Fallback ke panah statis
    const fallbackGroup = L.layerGroup();
    const angle = envData.windDeg || 0;
    const speed = envData.windSpeed || 0;
    points.slice(0, 10).forEach(p => {
      const icon = L.divIcon({
        className: 'wind-arrow',
        html: `<div style="transform: rotate(${angle}deg); font-size: 20px; color: #00aaff;">➤</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      const marker = L.marker([p.lat, p.lon], { icon })
        .bindPopup(`Kecepatan angin: ${speed} m/s`);
      fallbackGroup.addLayer(marker);
    });
    fallbackGroup.addTo(map);
    (window as any)._windLayer = fallbackGroup;
  }
}

if (showWind && envData?.windSpeed) {
  // Buat grid data angin (dummy, tapi bisa disesuaikan dengan data API)
  const windData = {
    header: {
      lat1: -6.5,   // latitude selatan
      lon1: 107.0,  // longitude barat
      lat2: -6.35,  // latitude utara
      lon2: 107.1,  // longitude timur
      nx: 30,       // jumlah grid horizontal
      ny: 30        // jumlah grid vertikal
    },
    data: Array.from({ length: 30 * 30 }, () => ({
      u: (Math.random() - 0.5) * 15, // komponen U (timur-barat)
      v: (Math.random() - 0.5) * 15  // komponen V (utara-selatan)
    }))
  };

  // Cek apakah windLayer tersedia
    }
    // ===== TEMPERATURE =====
    if ((window as any)._tempLayer) {
      map.removeLayer((window as any)._tempLayer);
      delete (window as any)._tempLayer;
    }
    if (showTemperature && envData?.temp) {
      const tempGroup = L.layerGroup();
      const temp = envData.temp;
      points.slice(0, 5).forEach(p => {
        const icon = L.divIcon({
          className: 'temp-label',
          html: `<div style="background: rgba(0,0,0,0.7); color: #fff; padding: 2px 6px; border-radius: 12px; font-size: 11px; font-weight: bold;">${temp}°C</div>`,
          iconSize: [40, 20],
          iconAnchor: [20, 10]
        });
        const marker = L.marker([p.lat, p.lon], { icon });
        tempGroup.addLayer(marker);
      });
      tempGroup.addTo(map);
      (window as any)._tempLayer = tempGroup;
    }

    // ⬆️⬆️⬆️ SAMPAI SINI ⬆️⬆️⬆️
    

    // Fit bounds
    if (points.length > 0 && !initialFitDone.current) {
      const bounds = L.latLngBounds(points.map((p: any) => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [50, 50] });
      initialFitDone.current = true;
    }
    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 300);
    console.log('✅ Data selesai di-render!');
  }, [geoData, mapReady, L, filteredPoints, filteredLines, filteredPolygons, layerVisibility, showHeatmap, showAQI, showWind, showTemperature, envData, saluranFlowMap, showFlowAnimation, musimTanamByPolygon])
  useEffect(() => {
    renderData();
  }, [renderData]);

  // ============ UGV LAYER — render marker + WebRTC popup ============
// ============ UGV LAYER — AUTO-APPEAR saat online ============
useEffect(() => {
  const map = mapRef.current;
  if (!mapReady || !map || !L) return;

  // Cleanup layer lama
  if (ugvLayerRef.current) {
    map.removeLayer(ugvLayerRef.current);
    ugvLayerRef.current = null;
    ugvMarkersRef.current = {};
  }

  // ✅ Hanya render UGV yang tidak offline
  const DEFAULT_UGV_LAT = -6.42531;
const DEFAULT_UGV_LON = 107.03924;

const onlineUgvs = ugvs
  .filter((u) => u.status !== 'offline')
  .map((u) => {
    const gpsOk =
      typeof u.lat === 'number' &&
      typeof u.lon === 'number' &&
      !(u.lat === 0 && u.lon === 0);
    return {
      ...u,
      lat: gpsOk ? u.lat : DEFAULT_UGV_LAT,
      lon: gpsOk ? u.lon : DEFAULT_UGV_LON,
      _gpsFix: gpsOk,
    };
  });

  if (onlineUgvs.length === 0) return;

  // Inject style sekali
  if (!document.getElementById('ugv-marker-style')) {
    const style = document.createElement('style');
    style.id = 'ugv-marker-style';
    style.textContent = `
      @keyframes ugv-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 4px rgba(0,200,255,0.35), 0 4px 16px rgba(0,200,255,0.5); }
        50%      { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(0,200,255,0.15), 0 4px 24px rgba(0,200,255,0.8); }
      }
      @keyframes ugv-ring {
        0%   { transform: scale(0.6); opacity: 1; }
        100% { transform: scale(2.4); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const group = L.layerGroup();

onlineUgvs.forEach((ugv) => {
  const proxyVideo = (ugv as any).proxy_video_url || '';
  const hasGpsFix = (ugv as any)._gpsFix !== false;
  const fullLiveUrl = 'https://ugvilookai.com/';

  const icon = L.divIcon({
    className: 'ugv-marker-div',
    html: `
      <div style="position:relative;text-align:center;">
        <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);
          width:44px;height:44px;border-radius:50%;
          background:rgba(0,200,255,0.35);
          animation:ugv-ring 1.8s ease-out infinite;pointer-events:none;"></div>
        <div style="
          position:relative;width:44px;height:44px;border-radius:50%;
          background:linear-gradient(135deg,#00c8ff,#0077ff);
          border:3px solid white;
          box-shadow:0 0 0 3px rgba(0,200,255,0.4),0 6px 20px rgba(0,200,255,0.6);
          display:flex;align-items:center;justify-content:center;
          animation:ugv-pulse 1.8s ease-in-out infinite;
          cursor:pointer;
        ">
          <i class="fa-solid fa-robot" style="color:white;font-size:20px;"></i>
        </div>
        <div style="
          font-size:9px;font-weight:700;color:white;
          background:#00c8ff;
          padding:2px 8px;border-radius:10px;margin-top:4px;
          white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          border:1px solid rgba(255,255,255,0.5);
        ">${ugv.name}</div>
      </div>
    `,
    iconSize: [44, 68],
    iconAnchor: [22, 34],
    popupAnchor: [0, -34],
  });

  const marker = L.marker([ugv.lat as number, ugv.lon as number], {
    icon,
    zIndexOffset: 900,
  });

  const popupHtml = `
    <div style="font-family:Inter;min-width:300px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="
          background:#00c8ff;color:white;font-size:9px;font-weight:800;
          padding:2px 8px;border-radius:10px;
          display:inline-flex;align-items:center;gap:3px;
        ">
          <span style="width:5px;height:5px;border-radius:50%;background:white;"></span>
          LIVE
        </span>
        ${ugv.battery != null ? `<span style="font-size:10px;color:#666;">🔋 ${ugv.battery}%</span>` : ''}
      </div>

      <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">
        🤖 ${ugv.name}
      </h4>
      <p style="margin:0 0 8px 0;font-size:11px;color:#666;">
        📍 ${hasGpsFix ? `${(ugv.lat as number).toFixed(5)}, ${(ugv.lon as number).toFixed(5)}` : '<span style="color:#ef4444;font-weight:600;">⚠ GPS belum fix</span>'}
      </p>

      ${proxyVideo ? `
        <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;margin-bottom:12px;">
          <img
            src="${proxyVideo}"
            style="width:100%;height:100%;object-fit:cover;display:block;"
            alt="UGV Live"
          />
          <div style="position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.65);padding:3px 8px;border-radius:10px;pointer-events:none;">
            <span style="width:6px;height:6px;background:#ef4444;border-radius:50%;display:inline-block;"></span>
            <span style="color:#fff;font-size:9px;font-weight:800;letter-spacing:0.5px;">LIVE</span>
          </div>
        </div>
        <p style="margin:0 0 12px 0;font-size:9px;color:#94a3b8;text-align:center;">
         
        </p>
      ` : `
        <div style="width:100%;aspect-ratio:16/9;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;margin-bottom:12px;">
          <div style="text-align:center;">
            <i class="fa-solid fa-video-slash" style="font-size:20px;display:block;margin-bottom:4px;"></i>
            ${hasGpsFix ? 'Video belum tersedia' : 'UGV belum kirim video_url'}
          </div>
        </div>
      `}

      <button
        onclick="
          if (window.__openFullLive) {
            window.__openFullLive('${fullLiveUrl}');
          } else {
            window.open('${fullLiveUrl}', '_blank', 'noopener,noreferrer');
          }
        "
        style="
          width:100%;padding:11px 10px;
          background:linear-gradient(135deg,#ef4444,#dc2626);
          color:#fff;border:none;border-radius:8px;
          font-size:12px;font-weight:700;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:6px;
          box-shadow:0 4px 12px rgba(220,38,38,0.35);
          transition:transform 0.15s ease, box-shadow 0.15s ease;
          letter-spacing:0.2px;
        "
        onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 16px rgba(220,38,38,0.5)'"
        onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(220,38,38,0.35)'"
      >
        🎥 Buka Live Full di ugvilookai.com
      </button>
    </div>
  `;

  marker.bindPopup(popupHtml, { maxWidth: 340 });
    ugvMarkersRef.current[ugv.id] = marker;
    group.addLayer(marker);
  });

  group.addTo(map);
  ugvLayerRef.current = group;

  return () => {
    if (ugvLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(ugvLayerRef.current);
      ugvLayerRef.current = null;
      ugvMarkersRef.current = {};
    }
  };
}, [ugvs, mapReady, L]);   // ← hapus showUGVLayer dari deps

// ============ UGV WEBSOCKET — update posisi real-time ============
useEffect(() => {
  if (!session?.accessToken) return; // hanya user login

  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.cipamingkis.com';
  const ws = new WebSocket(`${WS_URL}/ws/frontend`);

  ws.onopen = () => {
    console.log('[UGV WS] connected');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      // Format: { type: "ugv_position", ugv_id, lat, lon, battery?, status? }
      if (msg.type === 'ugv_position' && msg.ugv_id) {
        setUgvs((prev) => {
          const existing = prev.find((u) => u.id === msg.ugv_id);
          if (existing) {
            return prev.map((u) =>
              u.id === msg.ugv_id
                ? {
                    ...u,
                    lat: msg.lat,
                    lon: msg.lon,
                    battery: msg.battery ?? u.battery,
                    status: msg.status ?? 'online',
                    last_update: Date.now(),
                  }
                : u
            );
          }
          // UGV baru terdeteksi
          return [
              ...prev,
              {
                id: msg.ugv_id,
                name: msg.name || msg.ugv_id,
                lat: typeof msg.lat === 'number' ? msg.lat : null,
                lon: typeof msg.lon === 'number' ? msg.lon : null,
                proxy_video_url: msg.proxy_video_url ?? null,
                battery: msg.battery ?? null,
                status: 'online',
                last_update: Date.now(),
              },
            ];  
        });
      }
      // Handle event lain jika perlu (status, disconnect, dll)
      if (msg.type === 'ugv_offline' && msg.ugv_id) {
        setUgvs((prev) =>
          prev.map((u) =>
            u.id === msg.ugv_id ? { ...u, status: 'offline' } : u
          )
        );
      }
    } catch (e) {
      console.warn('[UGV WS] parse error:', e);
    }
  };

  ws.onerror = () => console.warn('[UGV WS] error');
  ws.onclose = () => console.log('[UGV WS] disconnected');

  // Heartbeat biar tidak dianggap idle oleh proxy
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
    }
  }, 25_000);

  return () => {
    clearInterval(pingInterval);
    ws.close();
  };
}, [session?.accessToken]);


// ============ UGV — update posisi tanpa rebuild ============
useEffect(() => {
  if (!mapReady) return;
  ugvs.forEach((ugv) => {
    const marker = ugvMarkersRef.current[ugv.id];
    if (marker && typeof ugv.lat === 'number' && typeof ugv.lon === 'number') {
      marker.setLatLng([ugv.lat, ugv.lon]);
    }
  });
}, [ugvs, mapReady]);


// ============ UGV — initial load via REST (opsional) ============
useEffect(() => {
  if (!session?.accessToken) return;

  const fetchUgvs = async () => {
    try {
      const res = await axios.get(`${API_URL}/ugv/list`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      // Response: { items: [{ id, name, lat, lon, webrtc_url, status, battery }] }
      const items = (res.data?.items || []).map((u: any) => ({
        id: u.id,
        name: u.name || u.id,
        lat: typeof u.lat === 'number' ? u.lat : null,
        lon: typeof u.lon === 'number' ? u.lon : null,
        proxy_video_url: u.proxy_video_url ?? null,
        battery: u.battery ?? null,
        status: u.status || 'online',
        last_update: Date.now(),
      }));
      setUgvs(items);
    } catch (e: any) {
      if (e.response?.status !== 404) {
        console.warn('[UGV] fetch error:', e.message);
      }
    }
  };

  fetchUgvs();
  // Polling tiap 30s sebagai backup
  const interval = setInterval(fetchUgvs, 30_000);
  return () => clearInterval(interval);
}, [session?.accessToken, API_URL]);

// ============ UGV — auto-focus saat UGV baru muncul ============
const knownUgvIdsRef = useRef<Set<string>>(new Set());

useEffect(() => {
  const map = mapRef.current;
  if (!mapReady || !map) return;

  const DEFAULT_UGV_LAT = -6.42531;
  const DEFAULT_UGV_LON = 107.03924;

  // ✅ Filter UGV online + resolve koordinat (fallback ke Cipamingkis kalau GPS belum fix)
  const online = ugvs
    .filter((u) => u.status !== 'offline')
    .map((u) => {
      const gpsOk =
        typeof u.lat === 'number' &&
        typeof u.lon === 'number' &&
        !(u.lat === 0 && u.lon === 0);
      return {
        ...u,
        lat: gpsOk ? (u.lat as number) : DEFAULT_UGV_LAT,
        lon: gpsOk ? (u.lon as number) : DEFAULT_UGV_LON,
      };
    });

  const newOnes = online.filter((u) => !knownUgvIdsRef.current.has(u.id));

  if (newOnes.length > 0) {
    const first = newOnes[0];
    map.flyTo(
      [first.lat as number, first.lon as number],
      Math.max(map.getZoom(), 15),
      { duration: 1.5 }
    );

    toast.success(`🤖 ${first.name} terhubung`, {
      duration: 3000,
      position: 'bottom-center',
    });

    newOnes.forEach((u) => knownUgvIdsRef.current.add(u.id));
  }

  ugvs
    .filter((u) => u.status === 'offline')
    .forEach((u) => knownUgvIdsRef.current.delete(u.id));
}, [ugvs, mapReady]);

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a1a]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Memuat dashboard...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a1a]">
        <div className="text-center max-w-md px-4">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-[#00c8ff] text-white rounded-xl font-medium hover:bg-[#00c8ff]/90 transition-all shadow-lg">
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }


  // ====== FLOW ANIMATION ======

  

  return (
    <div className={`h-screen w-screen overflow-hidden ${isDark ? 'dark' : ''}`}>
      <div className="relative h-full w-full bg-gray-50 dark:bg-[#0a0a1a]">
        {/* MAP CONTAINER */}
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
          <defs>
            <filter id="water-turbulence" x="-20%" y="-20%" width="140%" height="140%">
              {/* <!-- Membuat tekstur riak air (noise) --> */}
              <feTurbulence type="fractalNoise" baseFrequency="0.02 0.08" numOctaves="2" result="noise" />
              {/* <!-- Mendistorsi garis Leaflet mengikuti tekstur noise di atas --> */}
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
              {/* <!-- Melembutkan hasil agar terlihat seperti cairan --> */}
              <feGaussianBlur stdDeviation="0.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
              </feMerge>
            </filter>
          </defs>
        </svg>
                {/* SEARCH BAR & HASHTAG FILTER */}
       {/* SEARCH BAR & HASHTAG FILTER */}
    <div
      className={`absolute top-4 transition-all duration-300
        ${isPanelOpen
          ? 'left-4 right-4 z-[990] sm:right-auto sm:w-[calc(100%-440px)] sm:max-w-lg'
          : 'left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-[1000]'
        }`}
    >
  <div className="relative">
    <input
      type="text"
      placeholder="🔍 Cari stasiun, bangunan, atau hashtag..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onFocus={() => setIsSearchFocused(true)}
      onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
      className="w-full px-4 py-3 pl-10 rounded-xl bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] shadow-lg text-sm text-[#1a1a2e] dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#00c8ff] focus:ring-2 focus:ring-[#00c8ff]/30 transition-all"
    />
    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>

    {/* DROPDOWN GABUNGAN: chip hashtag di atas, hasil pencarian di bawah */}
    {(isSearchFocused || searchQuery) && (allTags.length > 0 || searchQuery) && (
       <div
      onMouseDown={(e) => e.preventDefault()}
      className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl border border-gray-200 dark:border-[#2a2a4e] overflow-hidden z-[1001]"
    >
        {allTags.length > 0 && (
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-[#2a2a4e]">
            <HashtagFilterBar tags={allTags} activeTag={tagFilter} onTagClick={setTagFilter} />
          </div>
        )}

              {searchQuery && (
                <div className="max-h-60 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((point: any, idx: number) => {
                      const cfg = CATEGORY_CONFIG[point.category] || CATEGORY_CONFIG['default'];
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveStation(point);
                            setSelectedFeature(point);
                            const foundIdx = stationPoints.findIndex((p: any) => p.name === point.name);
                            setActiveIdx(foundIdx);
                            if (mapRef.current) mapRef.current.flyTo([point.lat, point.lon], 17, { duration: 1.2 });
                            setSearchQuery('');
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#2a2a4e] transition-colors border-b border-gray-100 dark:border-[#2a2a4e] last:border-0 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${cfg.color}20` }}>
                            <i className={`fa-solid ${cfg.icon}`} style={{ color: cfg.color }}></i>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#1a1a2e] dark:text-white">{point.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{point.description || 'Stasiun'} · {cfg.label}</p>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Tidak ada hasil ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Grup Tombol Tools (seperti Google Maps) */}
    <div className="absolute bottom-4 left-4 z-[990] sm:bottom-24">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setToolsVisible(!toolsVisible)}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1a1a2e] shadow-lg
              border border-gray-200 dark:border-[#2a2a4e] flex items-center justify-center
              text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a4e]
              transition active:scale-95"
            aria-label={toolsVisible ? 'Sembunyikan tools' : 'Tampilkan tools'}
          >
            <i className={`fa-solid ${toolsVisible ? 'fa-chevron-left' : 'fa-chevron-right'}`} />
          </button>

    {toolsVisible && (
        <div className="flex flex-col gap-2 mt-1">
          {showMusimTanam && normalizeRole(session?.user?.role) === 'juru' && (
          <MusimTanamPanel
            polygons={musimTanamPolygons}
            userRole={session?.user?.role}
            onClose={() => setShowMusimTanam(false)}
            onSuccess={fetchMusimTanam}
          />
        )}

        {/* 🧭 LEGEND BUTTON (BARU) */}
        <button
          onClick={() => setShowLegend(!showLegend)}
          className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition ${
            showLegend
              ? 'bg-purple-500 text-white border-purple-500'
              : 'bg-white dark:bg-[#1a1a2e] border-gray-200 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a4e]'
          }`}
          title="Legenda"
        >
          <i className="fa-solid fa-compass"></i>
        </button>

        {/* Terrain */}
        <button
          onClick={toggleTerrain}
          className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition ${
            showTerrain
              ? 'bg-green-500 text-white border-green-500'
              : 'bg-white dark:bg-[#1a1a2e] border-gray-200 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a4e]'
          }`}
          title="Terrain / Satelit"
        >
          <i className={`fa-solid ${showTerrain ? 'fa-globe' : 'fa-mountain'}`}></i>
        </button>


      </div>
    )}

    {/* 🧭 LEGEND PANEL (BARU) */}
    {showLegend && toolsVisible && (
      <div
        className="absolute left-full ml-2 bottom-0 w-[200px] max-h-[60vh] overflow-y-auto
                   bg-white/95 dark:bg-[#1a1a2e]/95 backdrop-blur-xl
                   rounded-xl shadow-2xl border border-gray-200 dark:border-[#2a2a4e]
                   p-3 z-[991]"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-[#2a2a4e]">
          <span className="text-xs font-bold text-gray-800 dark:text-white">🧭 Legenda</span>
          <button
            onClick={() => setShowLegend(false)}
            className="w-5 h-5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white text-xs flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {(() => {
          const HIDDEN_LEGEND = ['BCB', 'BME', 'BLE', 'BTM', 'BTE', 'BTS', 'BPE', 'BPP', 'BRB', 'BCK', 'BPL'];
          const pointKeys = Object.keys(CATEGORY_CONFIG).filter(
            (k) => CATEGORY_CONFIG[k]?.type === 'point' && k !== 'default' && !HIDDEN_LEGEND.includes(k)
          );
          const lineKeys = Object.keys(CATEGORY_CONFIG).filter(
            (k) => CATEGORY_CONFIG[k]?.type === 'line' && k !== 'default' && !HIDDEN_LEGEND.includes(k)
          );
          const polyKeys = Object.keys(CATEGORY_CONFIG).filter(
            (k) => CATEGORY_CONFIG[k]?.type === 'polygon' && k !== 'default' && !HIDDEN_LEGEND.includes(k)
          );
          return [...pointKeys, ...lineKeys, ...polyKeys].map((key) => {
            const cfg = CATEGORY_CONFIG[key];
            if (!cfg) return null;
            const checked = layerVisibility[key] !== false;
            return (
              <div
                key={key}
                className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-gray-100 dark:hover:bg-[#2a2a4e]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => window.toggleLayer?.(key)}
                  className="w-3 h-3 cursor-pointer flex-shrink-0"
                  style={{ accentColor: cfg.color }}
                />
                {cfg.type === 'line' ? (
                  <span className="inline-block w-4 h-1 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                ) : cfg.type === 'polygon' ? (
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: cfg.color, opacity: 0.7, border: `1px solid ${cfg.color}` }}
                  />
                ) : (
                  <span
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: cfg.color, boxShadow: `0 0 0 2px white, 0 0 0 3px ${cfg.color}` }}
                  />
                )}
                <span className="text-[10px] font-medium text-gray-700 dark:text-gray-200 flex-1">
                  {cfg.label}
                </span>
              </div>
            );
          });
        })()}
      </div>
    )}
  </div>
</div>


    {/* LIVE COUNT INDICATOR */}
    {liveRooms.length > 0 && (
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[998]
        flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5
        rounded-full shadow-lg border border-red-500/40 pointer-events-none">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-[11px] font-bold text-white tracking-wide">
          {liveRooms.length} LIVE
        </span>
      </div>
    )}
        {/* SIDE PANEL */}
          <div
            className={`
              fixed 
              ${isPanelOpen ? 'bottom-0' : 'bottom-[-70%]'} 
              right-0 
              w-full 
              h-[60vh]
              translate-x-0
              sm:right-0 sm:top-0 sm:bottom-auto sm:h-full sm:w-[420px]
              ${isPanelOpen ? 'sm:translate-x-0' : 'sm:translate-x-full'}
              transition-all duration-300
              z-[999]
              bg-white/95 dark:bg-[#1a1a2e]/95 backdrop-blur-xl
              border-t sm:border-l border-gray-200 dark:border-[#2a2a4e]
              shadow-2xl
              flex flex-col
              rounded-t-2xl sm:rounded-none
            `}
            style={{
              pointerEvents: 'auto',
              isolation: 'isolate',
            }}
          >
          <div className="flex justify-center pt-2 sm:hidden">
            <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
          </div>


          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#2a2a4e] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#00c8ff]/10 flex items-center justify-center">
                <i className="fa-solid fa-water text-[#00c8ff]"></i>
              </div>

            </div>

            <div className="flex items-center gap-1.5">
              {/* TOMBOL UKUR JARAK */}
              <button
                onClick={() => {
                  setMeasureMode(!measureMode);
                  if (!measureMode) { setSelectedPoints([]); setMeasureResult(null); }
                }}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-all flex items-center gap-1 ${
                  measureMode
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                    : 'bg-gray-200 dark:bg-[#2a2a4e] text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-[#3a3a5e]'
                }`}
              >
                <i className="fa-solid fa-ruler"></i>
                {measureMode ? 'Mengukur' : 'Ukur'}
              </button>

    

              <button
            onClick={getUserLocation}
            disabled={userLocationLoading}
            className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-all flex items-center gap-1 ${
              userLocation
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-gray-200 dark:bg-[#2a2a4e] text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-[#3a3a5e]'
            }`}
          >
            <i className={`fa-solid ${userLocationLoading ? 'fa-spinner fa-spin' : 'fa-location-dot'}`}></i>
            {userLocationLoading ? 'Mencari...' : 'Lokasi'}
          </button>
              <div className="flex items-center gap-1.5">
                <NotificationBell />
                {/* tombol lainnya */}
              </div>
              {/* PROFILE / LOGIN */}
              {session ? (
                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-200 dark:bg-[#2a2a4e] hover:bg-gray-300 dark:hover:bg-[#3a3a5e] transition text-sm font-medium text-[#1a1a2e] dark:text-white"
                  >
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00c8ff] to-blue-600 text-white flex items-center justify-center text-xs font-semibold shadow-md">
                      {session.user?.email?.charAt(0).toUpperCase() || "U"}
                    </span>
                    <span className="hidden sm:inline max-w-[80px] truncate text-xs">
                      {session.user?.email?.split('@')[0] || 'User'}
                    </span>
                    <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}></i>
                  </button>

                  {/* DROPDOWN PROFILE */}
                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl border border-gray-200 dark:border-[#2a2a4e] py-1 z-50 overflow-hidden">
                      <div className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-[#2a2a4e]">
                        <p className="font-medium truncate">{session.user?.email}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Role: {session.user?.role || 'user'}</p>
                      </div>

                      {/* 🔥 TOMBOL PROFIL */}
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          router.push('/profile');
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a4e] transition flex items-center gap-2"
                      >
                        <i className="fa-solid fa-user text-base text-[#00c8ff]"></i>
                        <span>Lihat Profil</span>
                      </button>

                      <button
                        onClick={() => {
                          signOut();
                          setIsProfileOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2 border-t border-gray-100 dark:border-[#2a2a4e]"
                      >
                        <i className="fa-solid fa-right-from-bracket text-base"></i>
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                                  </div>
              ) : (
                <button
                  onClick={() => signIn()}
                  className="px-3 py-1.5 text-[10px] font-medium bg-[#00c8ff] text-white rounded-lg hover:bg-[#00c8ff]/90 transition shadow-lg shadow-[#00c8ff]/20 flex items-center gap-1"
                >
                  <i className="fa-solid fa-right-to-bracket"></i> Login
                </button>
              )}

              {/* CLOSE PANEL */}
              <button
                onClick={() => setIsPanelOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500 dark:text-gray-400"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* Content Panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* FEATURE DETAIL (HASHTAG & INFO) */}
            {selectedFeature && (
              <FeatureDetail
                feature={selectedFeature}
                media={buildingMedia[selectedFeature.name] || []}
                onClose={() => setSelectedFeature(null)}
              />
            )}

            {selectedFeature?.category === 'MERCU_BENDUNG' && (
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-2">
                <i className="fa-solid fa-water"></i> Debit Mercu Bendung
              </h4>

              {selectedFeature.debitInfo ? (
                <>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 font-mono">
                      {Number(selectedFeature.debitInfo.debit).toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">m³/d</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Update: {selectedFeature.debitInfo.tanggal || '-'} ·{' '}
                    {selectedFeature.debitInfo.jam || '-'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Belum ada laporan debit hari ini.
                </p>
              )}
            </div>
          )}

{/* 🔴 MULAI LIVE DI SINI — hanya TPOP + building dalam polygon */}
{selectedFeature &&
  normalizeRole(session?.user?.role) === 'tpop' &&
  isBuildingInMyPolygon(selectedFeature) &&
  !liveByBuilding[selectedFeature.name] && (
    <button
      onClick={() => startLiveAt(selectedFeature)}
      disabled={startingLive}
      className={`w-full py-3 rounded-xl text-sm font-semibold text-white transition flex items-center justify-center gap-2 shadow-lg ${
        startingLive
          ? 'bg-gray-400 cursor-wait'
          : 'bg-gradient-to-r from-red-500 to-rose-600 hover:opacity-95 shadow-red-500/40'
      }`}
    >
      <i className={`fa-solid ${startingLive ? 'fa-spinner fa-spin' : 'fa-video'}`}></i>
      {startingLive ? 'Memulai Live...' : 'Mulai Live di Sini'}
    </button>
  )}

      {/* Sudah ada live di building ini (bukan punya user) */}
      {selectedFeature &&
        liveByBuilding[selectedFeature.name] &&
        !liveByBuilding[selectedFeature.name].is_mine && (
          <button
            onClick={() => setLiveViewerRoom(liveByBuilding[selectedFeature.name].room_id)}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:opacity-95 flex items-center justify-center gap-2 shadow-lg shadow-red-500/40"
          >
            <i className="fa-solid fa-play"></i>
            Tonton Live di Sini
          </button>
        )}

      {/* 🔥 RAB PROGRESS */}
      {selectedFeature && (
        <RABProgressPanel
          buildingId={selectedFeature.name}
          buildingName={selectedFeature.name}
          onRefresh={() => setProgressRefreshKey((k) => k + 1)}
        />
      )}

      {/* Sudah ada live di building ini (bukan punya user) */}
      {selectedFeature &&
      liveByBuilding[selectedFeature.name] &&
      !liveByBuilding[selectedFeature.name].is_mine && (
        <button
          onClick={() => setLiveViewerRoom(liveByBuilding[selectedFeature.name].room_id)}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:opacity-95 flex items-center justify-center gap-2 shadow-lg shadow-red-500/40"
        >
          <i className="fa-solid fa-play"></i>
          Tonton Live di Sini
        </button>
      )}

            {/* 🔥 RAB PROGRESS — muncul untuk non-reporter kalau bangunan punya RAB aktif */}
          {selectedFeature && (
            <RABProgressPanel
              buildingId={selectedFeature.name}
              buildingName={selectedFeature.name}
              onRefresh={() => setProgressRefreshKey((k) => k + 1)}
            />
          )}
          
            {/* BuildingMedia ATAU RainfallHistory - Hanya untuk non-reporter */}
            {/* ===== STASIUN CURAH HUJAN → PUBLIC, tidak butuh login ===== */}
            {activeStation && isRainfallStation(activeStation) && (
              <div className="mt-2 border-t border-gray-200 dark:border-[#2a2a4e] pt-4">
                <RainfallHistory
                  buildingId={activeStation.name}
                  buildingName={activeStation.name}
                  buildingLat={activeStation.lat}
                  buildingLon={activeStation.lon}
                  token={session?.accessToken as string | undefined}
                />
              </div>
            )}

            {/* ===== BUILDING MEDIA → hanya non-reporter & sudah login ===== */}
            {activeStation &&
            !isRainfallStation(activeStation) &&
            normalizeRole(session?.user?.role) !== 'reporter' && (
              <div className="mt-2 border-t border-gray-200 dark:border-[#2a2a4e] pt-4">
                <BuildingMedia
                  buildingId={activeStation.name}
                  buildingName={activeStation.name}
                  buildingLat={activeStation.lat}
                  buildingLon={activeStation.lon}
                  onMediaChange={() => loadBuildingMedia(activeStation.name)}
                  userRole={session?.user?.role}
                  userPolygon={session?.user?.polygon}
                  userLocation={userLocation}
                />
              </div>
            )}


            {/* REPORTER RAINFALL INPUT — HANYA REPORTER */}
            {showRainfallInput &&
              selectedBuildingId &&
              canReportCurahHujan(session?.user?.role) && (
                <div className="mt-2">
                  <ReporterRainfallInput
                    buildingId={selectedBuildingId}
                    buildingName={selectedBuildingName}
                    onSuccess={() => {
                      setShowRainfallInput(false);
                      toast.success('Data curah hujan berhasil disimpan!');
                    }}
                    onClose={() => setShowRainfallInput(false)}
                  />
                </div>
            )}

            {/* PELAPORAN DEBIT — HANYA POB / SUPERVISOR DI BENDUNG */}
            {showDebitInput &&
              selectedBendungId &&
              canReportDebit(session?.user?.role) && (() => {
                const bendungId = selectedBendungId; // <-- capture sebagai string non-null
                return (
                  <div className="mt-2">
                    <PelaporanDebit
                      buildingId={bendungId}
                      buildingName={selectedBendungName}
                      userRole={session?.user?.role}
                      onSuccess={() => {
                        setShowDebitInput(false);
                        loadBuildingMedia(bendungId);
                      }}
                      onClose={() => setShowDebitInput(false)}
                    />
                  </div>
                );
              })()
            }

            {/* SEMPADAN DETAIL */}
            {selectedSempadan && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                      <i className="fa-solid fa-ruler-combined"></i> Detail Sempadan
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">{selectedSempadan.name}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-red-600 dark:text-red-400">{Math.round(selectedSempadan.length)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">meter (total)</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <p className="font-medium mb-1">📏 Rincian Segmen:</p>
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {selectedSempadan.segments.map((seg: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px] border-b border-red-100 dark:border-red-800/30 py-0.5">
                            <span>Titik {seg.from} → {seg.to}</span>
                            <span className="font-mono text-red-600 dark:text-red-400">{Math.round(seg.distance)} m</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedSempadan(null)} className="w-6 h-6 rounded-full hover:bg-red-200 dark:hover:bg-red-700/40 flex items-center justify-center text-red-500 dark:text-red-400 transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            )}

            {/* LUASAN SAWAH */}
          {selectedSawah && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 animate-fadeIn">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                    <i className="fa-solid fa-crop"></i> Luasan Sawah
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                    {selectedSawah.name}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {Math.round(selectedSawah.area_ha)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Hektar</span>
                  </div>

                  {/* 🔥 TRANSPARANSI */}
                  {selectedSawah.musimTanam && (
                    <div className="mt-3 pt-2 border-t border-yellow-200 dark:border-yellow-800">
                      {(() => {
                        const mt = selectedSawah.musimTanam;
                        const name = mt.reporter_name ||
                          (mt.reporter_email ? mt.reporter_email.split('@')[0] : 'Anonim');
                        return (
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Diinput oleh</span>
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              @{name}
                            </span>
                            {mt.reporter_role && (
                              <span className="text-[8px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full uppercase font-medium">
                                {mt.reporter_role}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSawah(null)}
                  className="w-6 h-6 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-700/40 flex items-center justify-center text-yellow-500 dark:text-yellow-400 transition-colors shrink-0"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
          )}

            {/* SALURAN */}
            {selectedSaluran && (
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                      <i className="fa-solid fa-water"></i> Detail Saluran
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">{selectedSaluran.name}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatLength(selectedSaluran.length)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">meter</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedSaluran(null)} className="w-6 h-6 rounded-full hover:bg-cyan-200 dark:hover:bg-cyan-700/40 flex items-center justify-center text-cyan-500 dark:text-cyan-400 transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            )}

            {/* HASIL PENGUKURAN JARAK */}
            {measureResult && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <i className="fa-solid fa-arrows-left-right"></i> Jarak Terukur
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{measureResult.from} → {measureResult.to}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{measureResult.distance.toFixed(2)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">meter</span>
                    </div>
                  </div>
                  <button onClick={() => setMeasureResult(null)} className="w-6 h-6 rounded-full hover:bg-purple-200 dark:hover:bg-purple-700/40 flex items-center justify-center text-purple-500 dark:text-purple-400 transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            )}

            
        {/* 🔥 PANEL MUSIM TANAM — HANYA JURU */}
          {normalizeRole(session?.user?.role) === 'juru' && (
            <button
              onClick={() => setShowMusimTanam(true)}
              className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition ${
                showMusimTanam
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white dark:bg-[#1a1a2e] border-gray-200 dark:border-[#2a2a4e] text-emerald-600 dark:text-emerald-400 hover:bg-gray-100 dark:hover:bg-[#2a2a4e]'
              }`}
             title={
                isJuruBengkok
                  ? 'Input Musim Tanam (Bengkok — #SaluranIndukCibarusah)'
                  : isJuruMengker
                  ? `Input Musim Tanam (Mengker — ${musimTanamPolygons.length} polygon BMe)`
                  : 'Input Musim Tanam (Juru)'
              }
            >
              <i className="fa-solid fa-seedling"></i>
            </button>
          )}


            {/* 🔥 TOMBOL RAB & TAMBAH PEKERJAAN — HANYA JURU/SUPERVISOR */}
            {(normalizeRole(session?.user?.role) === 'juru' || normalizeRole(session?.user?.role) === 'supervisor') && (
              <>
                {/* Upload RAB */}
                <button
                  onClick={() => setShowRABModal(true)}
                  className="w-full py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-file-excel"></i>
                  Upload RAB Excel
                </button>

                {/* Tambah Pekerjaan (Klik Peta) */}
                <button
                  onClick={() => {
                    if (!isPanelOpen) setIsPanelOpen(true);
                    setAddWorkMode(!addWorkMode);
                    if (!addWorkMode) {
                      toast('Klik titik pada peta untuk menandai lokasi pekerjaan', { icon: '📍', duration: 4000 });
                    }
                  }}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                    addWorkMode
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-[#00c8ff] text-white hover:bg-[#00c8ff]/90'
                  }`}
                >
                  <i className={`fa-solid ${addWorkMode ? 'fa-xmark' : 'fa-plus-circle'}`}></i>
                  {addWorkMode ? 'Batal Tambah' : 'Tambah Pekerjaan di Peta'}
                </button>
              </>
            )} 

            {/* WEATHER */}
            <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <i className="fa-solid fa-cloud-sun text-blue-500"></i> Cuaca Lokal
                </h4>
                <span className="text-[10px] text-gray-400 font-mono">{weather.location}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-3xl">
                  {weather.condition === 'sunny' && <i className="fa-solid fa-sun text-yellow-500"></i>}
                  {weather.condition === 'cloudy' && <i className="fa-solid fa-cloud text-gray-400"></i>}
                  {weather.condition === 'rainy' && <i className="fa-solid fa-cloud-rain text-blue-400"></i>}
                  {weather.condition === 'stormy' && <i className="fa-solid fa-cloud-bolt text-purple-500"></i>}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-gray-500 dark:text-gray-400">Suhu</p><p className="font-bold text-[#1a1a2e] dark:text-white">{weather.temperature}°C</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Kelembapan</p><p className="font-bold text-[#1a1a2e] dark:text-white">{weather.humidity}%</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Hujan</p><p className="font-bold text-[#1a1a2e] dark:text-white">{weather.rainfall} mm</p></div>
                </div>
              </div>

                          {/* 🔥 BRANDING & COPYRIGHT */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-[#2a2a4e]">

              {/* Ecosystem Card */}
              <div className="relative overflow-hidden rounded-xl
                              bg-gradient-to-br from-[#00c8ff]/10 via-blue-500/5 to-purple-500/10
                              border border-[#00c8ff]/25 dark:border-[#00c8ff]/30
                              p-3">
                {/* Glow effect */}
                <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-[#00c8ff]/20 blur-3xl pointer-events-none" />

                <div className="relative">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00c8ff] to-blue-600
                                    flex items-center justify-center
                                    shadow-lg shadow-[#00c8ff]/40">
                      <i className="fa-solid fa-droplet text-white text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-gray-800 dark:text-white leading-tight truncate">
                        iLookAi Ecosystem
                      </p>
                      <p className="text-[9px] text-[#00c8ff] font-medium leading-tight">
                        Smart Water Management
                      </p>
                    </div>
                  </div>

                  {/* Tagline */}
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-relaxed mb-2.5">
                    Platform monitoring & analitik sumber daya air terintegrasi
                    untuk wilayah Cipamingkis.
                  </p>

                  {/* Quick Links */}
                  <div className="flex flex-wrap gap-1.5">
                    <a
                      href="https://ugvilookai.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                                 bg-white dark:bg-[#0f0f23]
                                 border border-gray-200 dark:border-[#2a2a4e]
                                 text-[8px] font-semibold text-gray-700 dark:text-gray-300
                                 hover:border-[#00c8ff] hover:text-[#00c8ff] transition-colors"
                    >
                      <i className="fa-solid fa-robot text-[8px]" />
                      UGV Live
                    </a>
                    <a
                      href="https://cipamingkis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                                 bg-white dark:bg-[#0f0f23]
                                 border border-gray-200 dark:border-[#2a2a4e]
                                 text-[8px] font-semibold text-gray-700 dark:text-gray-300
                                 hover:border-[#00c8ff] hover:text-[#00c8ff] transition-colors"
                    >
                      <i className="fa-solid fa-globe text-[8px]" />
                      Portal
                    </a>
                    <a
                      href="https://api.cipamingkis.com/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                                 bg-white dark:bg-[#0f0f23]
                                 border border-gray-200 dark:border-[#2a2a4e]
                                 text-[8px] font-semibold text-gray-700 dark:text-gray-300
                                 hover:border-[#00c8ff] hover:text-[#00c8ff] transition-colors"
                    >
                      <i className="fa-solid fa-code text-[8px]" />
                      API
                    </a>
                  </div>
                </div>
              </div>

              {/* Copyright footer */}
              <div className="mt-3 text-center space-y-1">
                <p className="text-[9px] text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1">
                  <i className="fa-regular fa-copyright text-[8px]" />
                  <span>2026</span>
                  <span className="font-semibold text-gray-600 dark:text-gray-300">
                    iLookAi
                  </span>
                  <span>·</span>
                  <span>All rights reserved</span>
                </p>
                <p className="text-[8px] text-gray-400 dark:text-gray-600">
                  Perum Jasa Tirta II · Cipamingkis
                </p>
                <p className="text-[8px] text-gray-400 dark:text-gray-600 font-mono tracking-wider">
                  v0.1 A (dev)
                </p>
              </div>
            </div>
            </div>
          </div>
        </div>
 
        {/* TOGGLE PANEL BUTTON */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className={`
            fixed z-[1000]
            ${isPanelOpen ? 'hidden' : 'flex'}
            bottom-6 left-1/2 -translate-x-1/2
            sm:top-1/2 sm:right-0 sm:left-auto sm:translate-y-[-50%] sm:translate-x-0
            w-12 h-12 sm:w-8 sm:h-12
            rounded-full sm:rounded-l-lg
            bg-white dark:bg-[#1a1a2e]
            border border-gray-200 dark:border-[#2a2a4e]
            shadow-lg hover:shadow-xl transition-all
            items-center justify-center
            text-gray-600 dark:text-gray-400
          `}
        >
          <i className={`fa-solid ${isPanelOpen ? 'fa-chevron-right' : 'fa-chevron-up'} sm:fa-chevron-left`}></i>
        </button>
      </div>
      
            {/* ===== MODAL RAB & ADD WORK ===== */}
<RABUploadModal
  open={showRABModal}
  onClose={() => setShowRABModal(false)}
  buildingId={activeStation?.name}
  buildingName={activeStation?.name}
  onSuccess={() => setProgressRefreshKey(k => k + 1)}
/>

<AddWorkModal
  open={showAddWorkModal}
  onClose={() => { setShowAddWorkModal(false); setPendingLocation(null); }}
  buildingId={activeStation?.name}
  buildingName={activeStation?.name}
  prefilledLocation={pendingLocation}
  onSuccess={() => setProgressRefreshKey(k => k + 1)}
/>


{/* LIVE STREAMER MODAL */}
{liveStreamerRoom && (
  <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-lg bg-white dark:bg-[#1a1a2e] rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-[#2a2a4e]">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#2a2a4e]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <h3 className="font-semibold text-sm text-[#1a1a2e] dark:text-white">Live Streaming</h3>
        </div>
        <button
          onClick={() => {
            if (confirm('Tutup modal akan menghentikan live. Lanjut?')) {
              stopLive(liveStreamerRoom);
            }
          }}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="p-4">
        <LiveStreamer
          roomId={liveStreamerRoom}
          token={session?.accessToken as string}
          buildingName={selectedFeature?.name}
          onStop={() => {
            stopLive(liveStreamerRoom);
            setLiveStreamerRoom(null);
          }}
        />
      </div>
    </div>
  </div>
)}

{/* LIVE VIEWER MODAL */}
{liveViewerRoom && (
  <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-lg bg-white dark:bg-[#1a1a2e] rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-[#2a2a4e]">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#2a2a4e]">
        <h3 className="font-semibold text-sm text-[#1a1a2e] dark:text-white flex items-center gap-2">
          <i className="fa-solid fa-tower-broadcast text-red-500"></i>
          Menonton Live
        </h3>
        <button
          onClick={() => setLiveViewerRoom(null)}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="p-4">
        <LiveViewer
          roomId={liveViewerRoom}
          token={session?.accessToken as string}
          onClose={() => setLiveViewerRoom(null)}
        />
      </div>
    </div>
  </div>
)}
        {/* FOOTER */}
    <footer className="flex-shrink-0 w-full border-t border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-[#00c8ff]">v0.1 A (dev)</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>
            © 2026 Powered by <span className="font-semibold text-gray-700 dark:text-gray-200">IlookaAi</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
          <i className="fa-solid fa-droplet text-[#00c8ff] text-[9px]" />
          <span>
            <span className="font-medium text-gray-600 dark:text-gray-300">Cipamingkis</span> member of{' '}
            <span className="font-medium text-gray-600 dark:text-gray-300">Perum Jasa Tirta II</span>
          </span>
        </div>
      </div>
    </footer>
    </div>
  );
}