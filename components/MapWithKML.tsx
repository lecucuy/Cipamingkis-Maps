//components/MapWithKML
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

// 1. IMPORT CSS SECARA STATIS DI ATAS (Sangat Aman untuk Next.js / Turbopack)
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

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
const CATEGORY_CONFIG: Record<string, any> = {
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
};

// ============ WEATHER INTERFACE ============
interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  location: string;
}

// ============ MAIN COMPONENT ============
export default function MapWithKML() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const initialFitDone = useRef(false);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [stationPoints, setStationPoints] = useState<any[]>([]);
  const [activeStation, setActiveStation] = useState<any>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [chartData, setChartData] = useState<number[]>(Array(20).fill(280));
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: session } = useSession(); 
  // ===== DI ATAS, TAMBAHKAN STATE =====
  const [buildingMedia, setBuildingMedia] = useState<Record<string, any[]>>({});
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({});
  // Di dalam komponen
  const [L, setL] = useState<any>(null);
  const [turf, setTurf] = useState<any>(null);

useEffect(() => {
  const loadLibraries = async () => {
    const leaflet = await import('leaflet');
    const turfModule = await import('@turf/turf');
    setL(leaflet.default);
    setTurf(turfModule);
  };
  loadLibraries();
}, []);

// ===== FUNGSI LOAD MEDIA PER BUILDING =====
const loadBuildingMedia = useCallback(async (buildingId: string) => {
  if (buildingMedia[buildingId] || loadingMedia[buildingId]) return;
  setLoadingMedia(prev => ({ ...prev, [buildingId]: true }));
  try {
    const res = await axios.get(`${API_URL}/buildings/media/${buildingId}`);
    setBuildingMedia(prev => ({ ...prev, [buildingId]: res.data?.media || [] }));
  } catch (err: any) {
    // 404 itu normal (belum ada data), jangan print error
    if (err.response?.status !== 404) {
      console.error('Error loading media for', buildingId, err);
    }
    // Set ke array kosong agar tidak terus mencoba
    setBuildingMedia(prev => ({ ...prev, [buildingId]: [] }));
  } finally {
    setLoadingMedia(prev => ({ ...prev, [buildingId]: false }));
  }
}, [buildingMedia, loadingMedia]);

// ===== FUNGSI BUAT ICON MARKER DENGAN THUMBNAIL =====
const getMarkerIcon = useCallback((point: any, media: any[] = []) => {
  if (!L) return null;
  const cfg = CATEGORY_CONFIG[point.category] || CATEGORY_CONFIG['default'];
  const hasPhoto = media.some(m => m.media_type === 'photo' || m.media_type === 'video');

  let iconHtml = '';
  const baseStyle = `width:36px;height:36px;border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:16px;cursor:pointer;`;

  if (hasPhoto) {
    const firstMedia = media.find(m => m.media_type === 'photo' || m.media_type === 'video');
    iconHtml = `
      <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid ${cfg.color};box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;background:#fff;display:flex;align-items:center;justify-content:center;position:relative;">
        <img src="${firstMedia?.file_url || ''}" style="width:100%;height:100%;object-fit:cover;" />
        <div style="position:absolute;bottom:-4px;right:-4px;background:#00c8ff;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;border:2px solid #fff;">
          <i class="fa-solid fa-camera"></i>
        </div>
      </div>
    `;
    return L.divIcon({
      className: 'custom-div-icon',
      html: iconHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });
  }

  if (point.category === 'BANGUNAN_LIAR') {
    iconHtml = `
      <div style="${baseStyle}background:#E64A19;color:white;border:2px solid #fff;box-shadow:0 2px 12px rgba(230,74,25,0.4);font-size:18px;">
        <i class="fa-solid fa-user"></i>
      </div>
    `;
  } else if (point.category === 'BANJIR') {
    iconHtml = `
      <div style="${baseStyle}background:#1E88E5;color:white;border:2px solid #fff;box-shadow:0 2px 12px rgba(30,136,229,0.5);animation:pulse-banjir 1.5s infinite;">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
    `;
    // tambahkan keyframe jika belum
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
  } else {
    iconHtml = `
      <div style="${baseStyle}background:#ffffff;color:${cfg.color};border:2px solid ${cfg.color};box-shadow:0 2px 12px rgba(0,0,0,0.25);">
        <i class="fa-solid ${cfg.icon}"></i>
      </div>
    `;
  }

  return L.divIcon({
    className: 'custom-div-icon',
    html: iconHtml,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}, [L]);



  useEffect(() => {
  // Ambil preferensi dari localStorage atau system
  const saved = localStorage.getItem('ilookai-theme');
  if (saved === 'dark') {
    setIsDark(true);
  } else if (saved === 'light') {
    setIsDark(false);
  } else {
    // Cek preferensi sistem
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
  }
}, []);



useEffect(() => {
    // Fungsi async untuk memuat JS Leaflet secara tertunda (Client-Side Only)
    const initLeaflet = async () => {
      if (typeof window !== 'undefined') {
        const L = (await import('leaflet')).default;
        // Import markercluster plugin
        await import('leaflet.markercluster');

        // Pastikan container div map sudah dirender
        if (containerRef.current && !mapRef.current) {
          // Inisialisasi Peta Leaflet Anda di sini
          const map = L.map(containerRef.current).setView([-6.200000, 106.816666], 10);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          mapRef.current = map;
          setMapReady(true);
          setLoading(false);
        }
      }
    };

    initLeaflet();

    // Cleanup saat unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ===== WEATHER =====
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 28,
    humidity: 75,
    rainfall: 0,
    condition: 'sunny',
    location: 'Cipamingkis'
  });

  // ===== MEASUREMENT STATE =====
  const [selectedSempadan, setSelectedSempadan] = useState<{
    name: string;
    length: number;
    segments: { from: number; to: number; distance: number }[];
    coordinates: any[];
  } | null>(null);

  const [selectedSawah, setSelectedSawah] = useState<{
    name: string;
    area_ha: number;
    coordinates: any[];
  } | null>(null);

  const [selectedSaluran, setSelectedSaluran] = useState<{
    name: string;
    length: number;
  } | null>(null);

  // ===== MODE PENGUKURAN JARAK =====
  const [measureMode, setMeasureMode] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState<any[]>([]);
  const [measureResult, setMeasureResult] = useState<{ distance: number; from: string; to: string } | null>(null);

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
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL belum dikonfigurasi');
}

  // ============ FUNGSI KATEGORISASI ============
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
      if (fullText.includes('SEMBADAN')) return 'SEMBADAN';
      if (fullText.includes('BATAS')) return 'BATAS';
      return 'SALURAN_DEFAULT';
    }
    if (type === 'polygon') {
      if (fullText.includes('LUASAN SAWAH') || fullText.includes('SAWAH')) return 'LUASAN_SAWAH';
      if (fullText.includes('BANJIR')) return 'BANJIR_POLY';
    }
    return 'default';
  };

  // ============ LOAD DATA ============
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/intake/geodata`, { timeout: 10000 });
        const data = res.data;
        setGeoData(data);
        const categorizedPoints = (data.points || []).map((p: any) => {
          const category = categorizeFeature(p.name, p.description, 'point');
          return { ...p, category };
        });
        const categorizedLines = (data.lines || []).map((l: any) => {
          const category = categorizeFeature(l.name, '', 'line');
          return { ...l, category, length: l.length || 0 };
        });
        const categorizedPolygons = (data.polygons || []).map((p: any) => {
          const category = categorizeFeature(p.name, '', 'polygon');
          return { ...p, category, area_ha: p.area_ha || 0 };
        });
        const categorizedData = {
          points: categorizedPoints,
          lines: categorizedLines,
          polygons: categorizedPolygons
        };
        setGeoData(categorizedData);
        setStationPoints(categorizedPoints);
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

  // ============ WEATHER SIMULATION ============
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

  // ============ INIT MAP ============
  useEffect(() => {
    if (loading || error || mapRef.current) return;
    if (!containerRef.current) {
      const retry = setTimeout(() => {
        if (containerRef.current && !mapRef.current) initMap();
      }, 300);
      return () => clearTimeout(retry);
    }
    initMap();

    function initMap() {
      if (!containerRef.current || mapRef.current) return;
      console.log('🗺️ Init map...');
      const map = L.map(containerRef.current, {
        zoomControl: false,
        center: [-6.42531, 107.03924],
        zoom: 13,
      });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri',
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // LEGEND
    // LEGEND (ENHANCED)
   // ===== LEGEND DENGAN TOMBOL CLOSE =====
const legend = L.control({ position: 'bottomleft' });
let legendVisible = true;

legend.onAdd = () => {
  const container = L.DomUtil.create('div', 'legend-container');
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

    // ===== TOMBOL CLOSE (✕) =====
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
    closeBtn.style.transition = 'all 0.2s';
    closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(0,0,0,0.1)'; closeBtn.style.color = '#333'; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = 'transparent'; closeBtn.style.color = '#888'; };
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      div.style.display = 'none';
      legendVisible = false;
      // Tampilkan tombol toggle
      toggleBtn.style.display = 'flex';
    };

    const categories = Object.keys(CATEGORY_CONFIG).filter(k => k !== 'default');
    let html = '<div style="font-weight:700;margin-bottom:10px;font-size:13px;color:#1a1a2e;display:flex;align-items:center;gap:6px;">🧭 Legenda</div>';
    
    const pointKeys = categories.filter(k => CATEGORY_CONFIG[k]?.type === 'point');
    const lineKeys = categories.filter(k => CATEGORY_CONFIG[k]?.type === 'line');
    const polyKeys = categories.filter(k => CATEGORY_CONFIG[k]?.type === 'polygon');
    const sorted = [...pointKeys, ...lineKeys, ...polyKeys];
    
    sorted.forEach(key => {
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
    
    // Tambahkan close button ke div
    div.appendChild(closeBtn);

    // ===== TOMBOL TOGGLE (muncul saat legend di-close) =====
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
    toggleBtn.style.transition = 'all 0.2s';
    toggleBtn.style.border = '1px solid rgba(255,255,255,0.2)';
    toggleBtn.onmouseenter = () => { toggleBtn.style.background = 'rgba(255,255,255,1)'; toggleBtn.style.transform = 'scale(1.05)'; };
    toggleBtn.onmouseleave = () => { toggleBtn.style.background = 'rgba(255,255,255,0.95)'; toggleBtn.style.transform = 'scale(1)'; };
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

      const resizeMap = () => {
        if (mapRef.current) mapRef.current.invalidateSize();
      };
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
    }
  }, [loading, error]);

  // ============ RENDER DATA ============
const renderData = useCallback(() => {
  if (!mapReady || !mapRef.current || !geoData || !L) return;
    const map = mapRef.current;
    console.log('📊 Render data...');
    map.eachLayer((l: any) => {
      if (!(l instanceof L.TileLayer) &&
          !(l instanceof L.Control) &&
          !(l instanceof L.Control.Zoom) &&
          !(l instanceof L.Control.Scale)) {
        map.removeLayer(l);
      }
    });
    layerGroupsRef.current = {};
    const points = geoData.points || [];
    const lines = geoData.lines || [];
    const polygons = geoData.polygons || [];

    // ===== POLYGONS =====
    const polygonGroups: Record<string, L.LayerGroup> = {};
    polygons.forEach((poly: any) => {
      if (!poly?.path || !Array.isArray(poly.path) || poly.path.length === 0) return;
      const category = poly.category || 'default';
      const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];
      let color = cfg.color;
      let fillColor = cfg.color;
      let weight = 2;
      let dashArray = 'none';
      let fillOpacity = 0.3;
      if (category === 'LUASAN_SAWAH') {
        color = '#FDD835';
        fillColor = '#FDD835';
        fillOpacity = 0.4;
        // Tampilkan luas di popup
      } else if (category === 'BANJIR_POLY') {
        color = '#1E88E5';
        fillColor = '#1E88E5';
        fillOpacity = 0.3;
      }
      const layer = L.polygon(poly.path, {
        color: color,
        weight: weight,
        dashArray: dashArray,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
      });
      
      let popupContent = `
        <div style="font-family:Inter;min-width:150px;">
          <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">${poly.name || 'Area'}</h4>
          <p style="margin:0;font-size:11px;color:#666;">${cfg.label}</p>
      `;
      if (category === 'LUASAN_SAWAH' && poly.area_ha) {
        popupContent += `
          <p style="margin:4px 0 0 0;font-size:12px;color:#FDD835;font-weight:bold;">
            🌾 Luas: ${poly.area_ha.toFixed(2)} Ha
          </p>
        `;
        // Event click untuk tampilkan di side panel
        layer.on('click', () => {
          setSelectedSawah({
            name: poly.name || 'Luasan Sawah',
            area_ha: poly.area_ha,
            coordinates: poly.path
          });
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
      const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['SALURAN_DEFAULT'];
      
      let color = cfg.color;
      let weight = 3;
      let dashArray = 'none';
      
      if (category === 'SEMBADAN') {
        color = '#D32F2F';
        weight = 4;
        dashArray = '8, 6';
      } else if (category === 'BATAS') {
        color = '#F57C00';
        weight = 3;
        dashArray = '10, 8';
      } else if (category === 'SALURAN_DEFAULT' || category === 'default') {
        color = '#00E5FF';
        weight = 3;
        dashArray = 'none';
      }
      
      const layer = L.polyline(line.path, {
        color: color,
        weight: weight,
        dashArray: dashArray,
        opacity: 0.9,
        lineJoin: 'round',
      });
      
      let popupContent = `
        <div style="font-family:Inter;min-width:150px;">
          <h4 style="margin:0 0 4px 0;font-size:14px;color:#1a1a2e;">${line.name || 'Saluran'}</h4>
          <p style="margin:0;font-size:11px;color:#666;">${cfg.label}</p>
      `;
      if (line.length) {
        popupContent += `
          <p style="margin:4px 0 0 0;font-size:12px;color:#00E5FF;font-weight:bold;">
            📏 Panjang: ${line.length.toFixed(2)} m
          </p>
        `;
      }
      popupContent += `</div>`;
      layer.bindPopup(popupContent);

      // ===== EVENT KLIK UNTUK SEMPADAN =====
      if (category === 'SEMBADAN') {
        layer.on('click', () => {
          const latlngs = layer.getLatLngs();
          let totalLength = 0;
          const segments = [];
          for (let i = 0; i < latlngs.length - 1; i++) {
            const from = latlngs[i];
            const to = latlngs[i+1];
            const dist = map.distance(from, to);
            totalLength += dist;
            segments.push({ from: i+1, to: i+2, distance: dist });
          }
          setSelectedSempadan({
            name: line.name || 'Sempadan',
            length: totalLength,
            segments: segments,
            coordinates: latlngs.map((l: L.LatLng) => [l.lat, l.lng]) // <-- Tambahkan : L.LatLng
          });
          if (!isPanelOpen) setIsPanelOpen(true);
        });
      }

      // Event klik saluran biasa
      if (category === 'SALURAN_DEFAULT' || category === 'default') {
        layer.on('click', () => {
          if (line.length) {
            setSelectedSaluran({
              name: line.name || 'Saluran',
              length: line.length
            });
            if (!isPanelOpen) setIsPanelOpen(true);
          }
        });
      }
      
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

  // Load media untuk marker ini
  loadBuildingMedia(point.name);
  const media = buildingMedia[point.name] || [];
  
  // Icon dari getMarkerIcon (sudah handle semua kasus: thumbnail, kategori, banjir, liar)
  const icon = getMarkerIcon(point, media);

  const category = point.category || 'default';
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];

  const marker = L.marker([point.lat, point.lon], { icon })
    .bindPopup(`
      <div style="min-width:200px;font-family:Inter;">
        <h3 style="font-weight:600;font-size:14px;margin:0 0 4px 0;color:#1a1a2e;">${point.name}</h3>
        <p style="font-size:12px;color:#666;margin:0 0 4px 0;">${point.description || 'Stasiun'}</p>
        <p style="font-size:11px;color:#999;font-family:monospace;">${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}</p>
        <p style="font-size:10px;color:${cfg.color};margin-top:4px;font-weight:500;">🏷️ ${cfg.label}</p>
      </div>
    `)
    .on('click', () => {
      if (measureMode) {
        // Mode pengukuran jarak
        if (selectedPoints.length === 0) {
          setSelectedPoints([{ lat: point.lat, lng: point.lon, name: point.name }]);
          L.popup()
            .setLatLng([point.lat, point.lon])
            .setContent('📍 Titik 1 (klik titik lain untuk mengukur)')
            .openOn(map);
        } else if (selectedPoints.length === 1) {
          const p1 = selectedPoints[0];
          const p2 = { lat: point.lat, lng: point.lon, name: point.name };
          const from = turf.point([p1.lng, p1.lat]);
          const to = turf.point([p2.lng, p2.lat]);
          const distance = turf.distance(from, to, { units: 'meters' });
          setMeasureResult({
            distance: distance,
            from: p1.name,
            to: p2.name
          });
          setSelectedPoints([]);
          setMeasureMode(false);
          const line = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
            color: '#FF6B6B',
            weight: 3,
            dashArray: '5, 10',
          }).addTo(map);
          setTimeout(() => map.removeLayer(line), 5000);
          if (!isPanelOpen) setIsPanelOpen(true);
        }
      } else {
        setActiveStation(point);
        setActiveIdx(idx);
        loadBuildingMedia(point.name);
        map.flyTo([point.lat, point.lon], 17, { duration: 1.2 });
      }
    });

  if (markerGroups[category]) {
    markerGroups[category].addLayer(marker);
  }
});
    Object.keys(markerGroups).forEach(key => {
      layerGroupsRef.current[key] = markerGroups[key];
      if (layerVisibility[key] !== false) map.addLayer(markerGroups[key]);
    });

    if (points.length > 0 && !initialFitDone.current) {
      const bounds = L.latLngBounds(points.map((p: any) => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [50, 50] });
      initialFitDone.current = true;
    }
    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 300);
    console.log('✅ Data selesai di-render!');
  }, [geoData, mapReady, layerVisibility, isPanelOpen, measureMode, selectedPoints, buildingMedia]);

  useEffect(() => {
    renderData();
  }, [renderData]);

  // ============ SIMULASI DEBIT ============
  // useEffect(() => {
  //   if (!activeStation) return;
  //   const interval = setInterval(() => {
  //     const base = 280 + (Math.random() * 60 - 30);
  //     const discharge = Math.max(150, base);
  //     const added = (discharge / 1000) * 1.2;
  //     setChartData(prev => {
  //       const newData = [...prev, discharge];
  //       if (newData.length > 20) newData.shift();
  //       return newData;
  //     });
  //     setActiveStation((prev: any) => {
  //       if (!prev) return prev;
  //       return {
  //         ...prev,
  //         ext: {
  //           ...prev.ext,
  //           discharge,
  //           volume: (prev.ext?.volume || 0) + added
  //         }
  //       };
  //     });
  //   }, 1000);
  //   return () => clearInterval(interval);
  // }, [activeStation]);

  // ============ SEARCH ============
  const filteredPoints = useMemo(() => {
    if (!searchQuery.trim()) return stationPoints;
    const q = searchQuery.toLowerCase();
      return stationPoints.filter((p: any) => 
        p.name.toLowerCase().includes(q) || 
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
  }, [stationPoints, searchQuery]);

  // ============ CHART OPTIONS ============
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(26,26,46,0.95)' : 'rgba(255,255,255,0.95)',
        titleFont: { family: 'Inter', size: 11 },
        bodyFont: { family: 'Inter', size: 11, weight: 'bold' },
        borderColor: isDark ? '#2a2a4e' : '#e5e7eb',
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => `Debit: ${ctx.parsed.y.toFixed(1)} L/s`
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#6b7280', font: { size: 9 }, maxTicksLimit: 5 }
      },
      y: {
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#6b7280', font: { size: 9 } }
      }
    }
  };

  // ============ LOADING / ERROR ============
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

   // ============ RENDER ============
  return (
    <div className={`h-screen w-screen overflow-hidden ${isDark ? 'dark' : ''}`}>
      <div className="relative h-full w-full bg-gray-50 dark:bg-[#0a0a1a]">
        {/* ===== MAP CONTAINER ===== */}
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />

        {/* ===== SEARCH BAR ===== */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-lg">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Cari stasiun, bangunan, atau kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 rounded-xl bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] shadow-lg text-sm text-[#1a1a2e] dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#00c8ff] focus:ring-2 focus:ring-[#00c8ff]/30 transition-all"
            />
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            {searchQuery && filteredPoints.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl border border-gray-200 dark:border-[#2a2a4e] max-h-60 overflow-y-auto z-[1001]">
                {filteredPoints.map((point: any, idx: number) => {
                  const cfg = CATEGORY_CONFIG[point.category] || CATEGORY_CONFIG['default'];
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveStation(point);
                        const idx = stationPoints.findIndex((p: any) => p.name === point.name);
                        setActiveIdx(idx);
                        if (mapRef.current) {
                          mapRef.current.flyTo([point.lat, point.lon], 17, { duration: 1.2 });
                        }
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
                })}
              </div>
            )}
            {searchQuery && filteredPoints.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl border border-gray-200 dark:border-[#2a2a4e] p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Tidak ada hasil ditemukan
              </div>
            )}
          </div>
        </div>

        {/* ===== SIDE PANEL ===== */}
        <div className={`fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white/95 dark:bg-[#1a1a2e]/95 backdrop-blur-xl border-l border-gray-200 dark:border-[#2a2a4e] shadow-2xl transition-all duration-300 z-[999] ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
          {/* Header Panel */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#2a2a4e] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#00c8ff]/10 flex items-center justify-center">
                <i className="fa-solid fa-water text-[#00c8ff]"></i>
              </div>
              <div>
                <h2 className="font-semibold text-[#1a1a2e] dark:text-white text-sm">Sarana & Prasarana Monitoring</h2>
          
              </div>
            </div>
            <div className="flex items-center gap-2">
              {session ? (
                <div className="relative group">
                  <button className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00c8ff] to-blue-600 text-white flex items-center justify-center text-sm font-semibold shadow-md hover:shadow-lg transition-all hover:scale-105">
                    {session.user?.email?.charAt(0).toUpperCase() || "U"}
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a2e] rounded-lg shadow-xl border border-gray-200 dark:border-[#2a2a4e] py-1 z-50 hidden group-hover:block">
                    <div className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-[#2a2a4e]">
                      {session.user?.email}
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-[#2a2a4e] transition"
                    >
                      <i className="fa-solid fa-right-from-bracket mr-2"></i> Logout
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => signIn()}
                  className="px-3 py-1.5 text-[10px] font-medium bg-[#00c8ff] text-white rounded-lg hover:bg-[#00c8ff]/90 transition shadow-lg shadow-[#00c8ff]/20 flex items-center gap-1"
                >
                  <i className="fa-solid fa-right-to-bracket"></i> Login
                </button>
              )}
              <button
                onClick={() => {
                  setMeasureMode(!measureMode);
                  if (!measureMode) {
                    setSelectedPoints([]);
                    setMeasureResult(null);
                  }
                }}
                className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-all flex items-center gap-1 ${
                  measureMode 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                    : 'bg-gray-200 dark:bg-[#2a2a4e] text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-[#3a3a5e]'
                }`}
              >
                <i className="fa-solid fa-ruler"></i>
                {measureMode ? 'Mengukur...' : 'Ukur Jarak'}
              </button>
              <button onClick={() => setIsPanelOpen(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500 dark:text-gray-400">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* Content Panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ACTIVE STATION */}
            {activeStation && (
              <div className="bg-gradient-to-br from-[#00c8ff]/5 to-transparent rounded-xl border border-[#00c8ff]/20 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[#1a1a2e] dark:text-white text-sm">{activeStation.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activeStation.description || 'Stasiun'}</p>
                    <p className="text-xs mt-1" style={{ color: CATEGORY_CONFIG[activeStation.category]?.color || '#666' }}>
                      <i className={`fa-solid ${CATEGORY_CONFIG[activeStation.category]?.icon || 'fa-location-dot'}`}></i> 
                      {CATEGORY_CONFIG[activeStation.category]?.label || 'Lainnya'}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-[#00c8ff]/10 text-[#00c8ff] rounded-lg text-[10px] font-mono font-medium">ACTIVE</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <i className="fa-solid fa-location-dot text-[#00c8ff]"></i>
                  <span className="font-mono">{activeStation.lat.toFixed(5)}, {activeStation.lon.toFixed(5)}</span>
                </div>
              </div>
            )}

            {/* BuildingMedia - Tempat Media & Riwayat */}
            {activeStation && (
              <div className="mt-2 border-t border-gray-200 dark:border-[#2a2a4e] pt-4">
                <BuildingMedia 
                  buildingId={activeStation.name} 
                  buildingName={activeStation.name}
                  onMediaChange={() => loadBuildingMedia(activeStation.name)}
                />
              </div>
            )}

            {/* ===== SEMPADAN DETAIL ===== */}
            {selectedSempadan && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                      <i className="fa-solid fa-ruler-combined"></i> Detail Sempadan
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                      {selectedSempadan.name}
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {selectedSempadan.length.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">meter (total)</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <p className="font-medium mb-1">📏 Rincian Segmen:</p>
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {selectedSempadan.segments.map((seg, i) => (
                          <div key={i} className="flex justify-between text-[10px] border-b border-red-100 dark:border-red-800/30 py-0.5">
                            <span>Titik {seg.from} → {seg.to}</span>
                            <span className="font-mono text-red-600 dark:text-red-400">{seg.distance.toFixed(2)} m</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSempadan(null)}
                    className="w-6 h-6 rounded-full hover:bg-red-200 dark:hover:bg-red-700/40 flex items-center justify-center text-red-500 dark:text-red-400 transition-colors"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            )}

            {/* ===== LUASAN SAWAH ===== */}
            {selectedSawah && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                      <i className="fa-solid fa-crop"></i> Luasan Sawah
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                      {selectedSawah.name}
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {selectedSawah.area_ha.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Hektar</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSawah(null)}
                    className="w-6 h-6 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-700/40 flex items-center justify-center text-yellow-500 dark:text-yellow-400 transition-colors"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            )}

            {/* ===== SALURAN ===== */}
            {selectedSaluran && (
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                      <i className="fa-solid fa-water"></i> Detail Saluran
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                      {selectedSaluran.name}
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                        {selectedSaluran.length.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">meter</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSaluran(null)}
                    className="w-6 h-6 rounded-full hover:bg-cyan-200 dark:hover:bg-cyan-700/40 flex items-center justify-center text-cyan-500 dark:text-cyan-400 transition-colors"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            )}

            {/* ===== HASIL PENGUKURAN JARAK ===== */}
            {measureResult && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <i className="fa-solid fa-arrows-left-right"></i> Jarak Terukur
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {measureResult.from} → {measureResult.to}
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {measureResult.distance.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">meter</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMeasureResult(null)}
                    className="w-6 h-6 rounded-full hover:bg-purple-200 dark:hover:bg-purple-700/40 flex items-center justify-center text-purple-500 dark:text-purple-400 transition-colors"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            )}

            {/* WEATHER WIDGET */}
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
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Suhu</p>
                    <p className="font-bold text-[#1a1a2e] dark:text-white">{weather.temperature}°C</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Kelembapan</p>
                    <p className="font-bold text-[#1a1a2e] dark:text-white">{weather.humidity}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Hujan</p>
                    <p className="font-bold text-[#1a1a2e] dark:text-white">{weather.rainfall} mm</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CHART - HANYA UNTUK INTAKE */}
            {/* {activeStation && activeStation.category === 'INTAKE' && (
              <div className="bg-gray-50 dark:bg-[#0f0f23] rounded-xl border border-gray-200 dark:border-[#2a2a4e] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300">Debit Real-Time</h4>
                  <div className="flex gap-1">
                    {['1s', '1m', '5m'].map(tf => (
                      <button key={tf} className={`px-2 py-0.5 text-[10px] rounded transition ${tf === '1s' ? 'bg-[#00c8ff] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2a2a4e]'}`}>
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-[120px]">
                  <Line
                    data={{
                      labels: Array.from({ length: chartData.length }, (_, i) => i),
                      datasets: [{
                        label: 'Debit (L/s)',
                        data: chartData,
                        borderColor: '#00c8ff',
                        backgroundColor: 'rgba(0,200,255,0.08)',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 0,
                        fill: true
                      }]
                    }}
                    options={chartOptions}
                  />
                </div>
              </div>
            )} */}

            {/* METRIK */}
            {/* <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-[#0f0f23] rounded-xl border border-gray-200 dark:border-[#2a2a4e] p-3">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Debit (Q)</p>
                <p className="text-xl font-bold text-[#00c8ff] mt-0.5">
                  {activeStation?.ext?.discharge?.toFixed(1) || 0}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">L/s</span>
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-[#0f0f23] rounded-xl border border-gray-200 dark:border-[#2a2a4e] p-3">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Volume</p>
                <p className="text-xl font-bold text-[#1a1a2e] dark:text-white mt-0.5">
                  {activeStation?.ext?.volume?.toFixed(1) || 0}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">m³</span>
                </p>
              </div>
            </div> */}

            {/* LOG */}
            <div className="bg-gray-50 dark:bg-[#0f0f23] rounded-xl border border-gray-200 dark:border-[#2a2a4e] p-3">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Telemetry</p>
              <div className="space-y-1 font-mono text-[10px] max-h-[80px] overflow-y-auto">
                <div className="flex gap-2">
                  <span className="text-gray-400">[{new Date().toTimeString().slice(0,8)}]</span>
                  <span className="text-[#00c8ff]">Sistem siap</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-400">[{new Date().toTimeString().slice(0,8)}]</span>
                  <span className="text-gray-600 dark:text-gray-300">Memantau {stationPoints.length} stasiun</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-400">[{new Date().toTimeString().slice(0,8)}]</span>
                  <span className="text-blue-400">☁️ Cuaca: {weather.condition}, {weather.temperature}°C</span>
                </div>
                {selectedSempadan && (
                  <div className="flex gap-2">
                    <span className="text-gray-400">[{new Date().toTimeString().slice(0,8)}]</span>
                    <span className="text-red-400">📏 Sempadan: {selectedSempadan.name} ({selectedSempadan.length.toFixed(2)} m)</span>
                  </div>
                )}
                {selectedSawah && (
                  <div className="flex gap-2">
                    <span className="text-gray-400">[{new Date().toTimeString().slice(0,8)}]</span>
                    <span className="text-yellow-400">🌾 Sawah: {selectedSawah.name} ({selectedSawah.area_ha.toFixed(2)} Ha)</span>
                  </div>
                )}
                {measureResult && (
                  <div className="flex gap-2">
                    <span className="text-gray-400">[{new Date().toTimeString().slice(0,8)}]</span>
                    <span className="text-purple-400">📐 Jarak: {measureResult.from} → {measureResult.to} ({measureResult.distance.toFixed(2)} m)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== TOGGLE PANEL BUTTON ===== */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className={`
            fixed top-1/2 -translate-y-1/2 z-[1000] 
            w-8 h-12 rounded-l-lg 
            bg-white dark:bg-[#1a1a2e] 
            border border-gray-200 dark:border-[#2a2a4e]
            shadow-lg hover:shadow-xl transition-all
            flex items-center justify-center
            text-gray-600 dark:text-gray-400
            ${isPanelOpen ? 'hidden' : 'flex'}
            right-0
          `}
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>

        {/* ===== STATUS BAR ===== */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 dark:bg-[#1a1a2e]/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-[#2a2a4e] px-4 py-2 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00c8ff] animate-pulse"></span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">LIVE</span>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#2a2a4e]"></div>
          <span className="text-gray-500 dark:text-gray-400"><i className="fa-solid fa-wifi mr-1"></i> {stationPoints.length} stasiun</span>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#2a2a4e]"></div>
          <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px]">{new Date().toLocaleTimeString('id-ID', { hour12: false })}</span>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#2a2a4e]"></div>
          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <i className="fa-solid fa-temperature-half text-blue-400"></i> {weather.temperature}°C
          </span>
          {measureMode && (
            <>
              <div className="w-px h-4 bg-gray-200 dark:bg-[#2a2a4e]"></div>
              <span className="text-red-500 flex items-center gap-1 animate-pulse">
                <i className="fa-solid fa-circle"></i> Mengukur...
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}