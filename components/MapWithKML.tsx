// components/MapWithKML.tsx
'use client';

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

// Hapus baris ini: declare module 'leaflet.heat';
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
"BATAS_DESA": {
  icon: "fa-house",
  color: "#8B5CF6",
  label: "Desa/Kelurahan",
  type: "polygon"
}
 };

interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  location: string;
}

export default function MapWithKML() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const initialFitDone = useRef(false);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const legendContainerRef = useRef<HTMLDivElement | null>(null);
  const villageLayerRef = useRef<L.LayerGroup | null>(null);
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
const [selectedBendungId, setSelectedBendungId] = useState<string | null>(null);
const [selectedBendungName, setSelectedBendungName] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
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
  // Data lingkungan (dummy atau dari API)
  const [envData, setEnvData] = useState<any>(null);
  const [showTemperature, setShowTemperature] = useState(false);
  const formatLength = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };


const {
  userLocation,
  userLocationError,
  userLocationLoading,
  getUserLocation,
  clearUserLocation,
} = useUserLocation(mapRef.current, L);

    const userRole = session?.user?.role;
    const userPolygon = session?.user?.polygon; // hanya ada untuk TPOP
    const userLat = session?.user?.lat;
    const userLon = session?.user?.lon;
    

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


Fetch data desa
useEffect(() => {
  const fetchVillage = async () => {
    setVillageLoading(true);
    setVillageError(null);
    try {
      const url = `${API_URL}/geojson/villages`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('✅ Data desa loaded:', data.features?.length, 'fitur');
      setVillageGeo(data);
    } catch (err: any) {
      console.error('❌ Gagal load desa:', err);
      setVillageError(err.message);
      setVillageGeo(null);
    } finally {
      setVillageLoading(false);
    }
  };

  fetchVillage();
}, [API_URL]); 




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


useEffect(() => {
  const style = document.createElement('style');
  style.textContent = `
    .village-label-google {
      background: rgba(255, 255, 255, 0.85) !important;
      backdrop-filter: blur(2px) !important;
      color: #222 !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      padding: 2px 6px !important;
      border-radius: 3px !important;
      border: none !important;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15) !important;
      font-family: 'Segoe UI', Roboto, Arial, sans-serif !important;
      text-shadow: none !important;
      pointer-events: none !important;
      white-space: nowrap !important;
      letter-spacing: 0.2px !important;
    }
  `;
  document.head.appendChild(style);
  return () => { document.head.removeChild(style); };
}, []);

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

        const categorizedPoints = (data.points || []).map((p: any) => ({
          ...p,
          category: categorizeFeature(p.name, p.description, 'point'),
          tags: extractHashtags(p.description || ''),
        }));

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
    "BATAS_DESA": true
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
    


    
    // ===== LEGEND (sama seperti sebelumnya, menggunakan L dan CATEGORY_CONFIG) =====
    const legend = L.control({ position: 'bottomleft' });
    let legendVisible = true;
    legend.onAdd = () => {
      const container = L.DomUtil.create('div', 'legend-container');
      legendContainerRef.current = container;
      container.style.position = 'relative';

      const div = L.DomUtil.create('div', 'info legend');
      div.style.background = 'rgba(255,255,255,0.95)';
      div.style.backdropFilter = 'blur(4px)';
      div.style.padding = '12px 16px';
      div.style.borderRadius = '12px';
      div.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      div.style.fontSize = '12px';
      div.style.fontFamily = 'Inter, sans-serif';
      div.style.minWidth = '160px';
      div.style.maxHeight = '350px';
      div.style.overflowY = 'auto';
      div.style.border = '1px solid rgba(255,255,255,0.2)';
      div.style.color = '#1a1a2e';
      div.style.position = 'relative';

      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '6px';
      closeBtn.style.right = '8px';
      closeBtn.style.background = 'transparent';
      closeBtn.style.border = 'none';
      closeBtn.style.fontSize = '14px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.color = '#888';
      closeBtn.style.padding = '2px 6px';
      closeBtn.style.borderRadius = '4px';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        div.style.display = 'none';
        legendVisible = false;
        toggleBtn.style.display = 'flex';
      };

      const categories = Object.keys(CATEGORY_CONFIG).filter(k => k !== 'default');
      let html = '<div style="font-weight:700;margin-bottom:10px;font-size:13px;color:#1a1a2e;display:flex;align-items:center;gap:6px;">🧭 Legenda</div>';
      const pointKeys = categories.filter(k => CATEGORY_CONFIG[k]?.type === 'point');
      const lineKeys = categories.filter(k => CATEGORY_CONFIG[k]?.type === 'line');
      const polyKeys = categories.filter(k => CATEGORY_CONFIG[k]?.type === 'polygon');
      const sorted = [...pointKeys, ...lineKeys, ...polyKeys];

        // ===== KATEGORI YANG DISEMBUNYIKAN DARI LEGENDA =====
      const hiddenLegendKeys = [
        'BCB', 'BME', 'BLE', 'BTM', 'BTE', 'BTS',
        'BPE', 'BPP', 'BRB', 'BCK', 'BPL'
      ];

      sorted.forEach(key => {
        if (hiddenLegendKeys.includes(key)) return;

        const cfg = CATEGORY_CONFIG[key];
        if (!cfg) return;
        const checked = layerVisibility[key] !== false ? 'checked' : '';
        const isLine = cfg.type === 'line';
        const isPoly = cfg.type === 'polygon';

        let displayStyle = '';
        if (isLine) {
          displayStyle = `display:inline-block;width:24px;height:4px;background:${cfg.color};border-radius:2px;margin-right:8px;vertical-align:middle;`;
        } else if (isPoly) {
          displayStyle = `display:inline-block;width:18px;height:18px;background:${cfg.color};border:2px solid ${cfg.color};border-radius:3px;margin-right:8px;vertical-align:middle;opacity:0.7;`;
        } else {
          displayStyle = `display:inline-block;width:14px;height:14px;border-radius:50%;background:${cfg.color};margin-right:8px;vertical-align:middle;box-shadow:0 0 0 2px white, 0 0 0 3px ${cfg.color};`;
        }

        html += `
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:5px;cursor:pointer;padding:2px 4px;border-radius:6px;transition:background 0.2s;"
              onmouseover="this.style.background='rgba(0,0,0,0.05)'"
              onmouseout="this.style.background='transparent'">
            <input type="checkbox" id="chk-${key}" ${checked}
              style="accent-color:${cfg.color};width:15px;height:15px;cursor:pointer;flex-shrink:0;"
              onchange="window.toggleLayer('${key}')"
            />
            <span style="${displayStyle}"></span>
            <span style="flex:1;font-size:11px;font-weight:500;color:#1a1a2e;">${cfg.label}</span>
          </div>
        `;
      });

      div.innerHTML = html;
      div.appendChild(closeBtn);

      const toggleBtn = document.createElement('button');
      toggleBtn.innerHTML = '🧭';
      toggleBtn.style.display = 'none';
      toggleBtn.style.position = 'absolute';
      toggleBtn.style.bottom = '0';
      toggleBtn.style.left = '0';
      toggleBtn.style.background = 'rgba(255,255,255,0.95)';
      toggleBtn.style.backdropFilter = 'blur(4px)';
      toggleBtn.style.border = 'none';
      toggleBtn.style.borderRadius = '12px';
      toggleBtn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      toggleBtn.style.padding = '8px 12px';
      toggleBtn.style.fontSize = '16px';
      toggleBtn.style.cursor = 'pointer';
      toggleBtn.onclick = () => {
        div.style.display = 'block';
        toggleBtn.style.display = 'none';
        legendVisible = true;
      };

      container.appendChild(div);
      container.appendChild(toggleBtn);
      return container;
    };
    legend.addTo(map);

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
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  };
}, [loading, error, L]); // <-- tambahkan L sebagai dependensi

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

  useEffect(() => {
    if (!legendContainerRef.current) return;
    const isMobile = window.innerWidth < 640;
    const el = legendContainerRef.current;
    if (isMobile) el.style.display = isPanelOpen ? 'none' : 'block';
    else el.style.display = 'block';
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
      if (category === 'LUASAN_SAWAH') {
        color = '#FDD835'; fillColor = '#FDD835'; fillOpacity = 0.4;
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
        popupContent += `<p style="margin:4px 0 0 0;font-size:12px;color:#FDD835;font-weight:bold;">🌾 Luas: ${Math.round(poly.area_ha)} Ha</p>`;
        layer.on('click', () => {
          setSelectedSawah({ name: poly.name || 'Luasan Sawah', area_ha: poly.area_ha, coordinates: poly.path });
          if (!isPanelOpen) setIsPanelOpen(true);
        });
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
          const glow = L.polyline(line.path, {
            color: '#00E5FF',
            weight: 8,
            opacity: 0.1,
            interactive: false,
          });
          const main = L.polyline(line.path, {
            color: '#00E5FF',
            weight: 3,
            opacity: 0.9,
            lineJoin: 'round',
          });
          const center = L.polyline(line.path, {
            color: '#FFFFFF',
            weight: 1,
            opacity: 0.3,
            interactive: false,
          });
          const group = L.layerGroup([glow, center, main]);

          // Bind popup & event ke main
          let popupContent = `
            <div style="font-family:Inter;min-width:150px;">
              <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">${line.name || 'Saluran'}</h4>
              <p style="margin:0;font-size:11px;color:#666;">${cfg.label}</p>
          `;
          if (line.length) {
            popupContent += `<p style="margin:4px 0 0 0;font-size:12px;color:#00E5FF;font-weight:bold;">📏 Panjang: ${formatLength(line.length)}</p>`;
          }
          popupContent += `</div>`;
          main.bindPopup(popupContent);
          main.on('click', () => {
            if (line.length) {
              setSelectedSaluran({ name: line.name || 'Saluran', length: line.length });
              if (!isPanelOpen) setIsPanelOpen(true);
            }
          });

          if (!lineGroups['SALURAN_DEFAULT']) lineGroups['SALURAN_DEFAULT'] = L.layerGroup();
          lineGroups['SALURAN_DEFAULT'].addLayer(group);
          return; // <-- LANGSUNG SKIP ke line berikutnya
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
                  toast.error(
                    `Anda hanya bisa input di bangunan terdekat: ${nearest?.name || 'tidak ditemukan'}`
                  );
                  setShowRainfallInput(false);
                  if (nearest && mapRef.current) {
                    mapRef.current.flyTo([nearest.lat, nearest.lon], 15);
                  }
                }
              } else {
                toast.error('Lokasi Anda belum diatur. Hubungi admin.');
                setShowRainfallInput(false);
              }
              setShowDebitInput(false);
            }
            // ===== POB / SUPERVISOR: debit bendung =====
            else if (
              canReportDebit(session?.user?.role) &&
              isBendungCategory(point.category)
            ) {
              setSelectedBendungId(point.name);
              setSelectedBendungName(point.name);
              setShowDebitInput(true);
              setShowRainfallInput(false);
            }
            // ===== Role lain: sembunyikan semua form =====
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
  }, [geoData, mapReady, layerVisibility, isPanelOpen, measureMode, selectedPoints, buildingMedia, tagFilter, filteredPoints, filteredLines, filteredPolygons, L, villageGeo, showHeatmap, showAQI, showWind, showTemperature, envData]);
  useEffect(() => {
    renderData();
  }, [renderData]);

  

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

  

  return (
    <div className={`h-screen w-screen overflow-hidden ${isDark ? 'dark' : ''}`}>
      <div className="relative h-full w-full bg-gray-50 dark:bg-[#0a0a1a]">
        {/* MAP CONTAINER */}
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />

        {/* SEARCH BAR & HASHTAG FILTER */}
       {/* SEARCH BAR & HASHTAG FILTER */}
<div className={`absolute top-4 w-[90%] max-w-lg 
  ${isPanelOpen ? 'left-4 translate-x-0 z-[990]' : 'left-1/2 -translate-x-1/2 z-[1000]'}`}>
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
      </div>{/* Grup Tombol Tools (seperti Google Maps) */}
      <div className="absolute bottom-24 left-4 z-[990]">
        <div className="flex flex-col gap-2">
    {/* Tombol toggle collapse */}
    <button
      onClick={() => setToolsVisible(!toolsVisible)}
      className="w-10 h-10 rounded-full bg-white dark:bg-[#1a1a2e] shadow-lg border border-gray-200 dark:border-[#2a2a4e] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a4e] transition"
    >
      <i className={`fa-solid ${toolsVisible ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
    </button>

    {/* Tombol-tombol mode (muncul jika toolsVisible true) */}
    {toolsVisible && (
      <div className="flex flex-col gap-2 mt-1">
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

        {/* Heatmap */}
        <button
          onClick={toggleHeatmap}
          className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition ${
            showHeatmap
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white dark:bg-[#1a1a2e] border-gray-200 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a4e]'
          }`}
          title="Heatmap"
        >
          <i className="fa-solid fa-fire"></i>
        </button>

        {/* AQI */}


        {/* Wind */}


        {/* Temperature (toggle) */}

      </div>
    )}
  </div>
</div>

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
                      <button
                        onClick={() => {
                          signOut();
                          setIsProfileOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2"
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
 
           {/* BuildingMedia - Hanya untuk non-reporter */}
            {activeStation &&
         normalizeRole(session?.user?.role) !== 'reporter' && (
              <div className="mt-2 border-t border-gray-200 dark:border-[#2a2a4e] pt-4">
                <BuildingMedia 
                  buildingId={activeStation.name} 
                  buildingName={activeStation.name}
                  onMediaChange={() => loadBuildingMedia(activeStation.name)}
                  userRole={session?.user?.role}
                  userPolygon={session?.user?.polygon}
                  userLocation={userLocation}
                />
              </div>
            )}

            {/* REPORTER RAINFALL INPUT */}
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
              canReportDebit(session?.user?.role) && (
                <div className="mt-2">
                  <PelaporanDebit
                    buildingId={selectedBendungId}
                    buildingName={selectedBendungName}
                    userRole={session?.user?.role}
                    onSuccess={() => {
                      setShowDebitInput(false);
                      loadBuildingMedia(selectedBendungId);
                    }}
                    onClose={() => setShowDebitInput(false)}
                  />
                </div>
            )}

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
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                      <i className="fa-solid fa-crop"></i> Luasan Sawah
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">{selectedSawah.name}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{Math.round(selectedSawah.area_ha)}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Hektar</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedSawah(null)} className="w-6 h-6 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-700/40 flex items-center justify-center text-yellow-500 dark:text-yellow-400 transition-colors">
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
    </div>
  );
}