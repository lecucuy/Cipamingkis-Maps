// frontend/components/Map3DViewer.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Konfigurasi Web Worker MapLibre v6 (Wajib di Next.js agar tidak error "Worker failed to load")
if (typeof window !== 'undefined') {
  try {
    maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
  } catch {
    // fallback
  }
}

interface PointItem {
  lat: number;
  lon: number;
  name: string;
  category?: string;
  description?: string;
  tags?: string[];
}

interface Map3DViewerProps {
  initialCenter?: [number, number]; // [lon, lat]
  initialZoom?: number;
  points?: PointItem[];
  activeStation?: PointItem | null;
  onSelectPoint?: (point: PointItem) => void;
  onClose: (center?: [number, number], zoom?: number) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  BENDUNG: '#0284c7',
  INTAKE: '#059669',
  BAGI: '#f59e0b',
  BAGI_SADAP: '#d97706',
  SADAP: '#ea580c',
  TALANG: '#8b5cf6',
  SIPHON: '#6366f1',
  GORONG: '#0d9488',
  JEMBATAN: '#64748b',
  PELIMPAH: '#ec4899',
  PINTU_AIR: '#06b6d4',
  SUNGAI: '#3b82f6',
  SALURAN: '#10b981',
  default: '#00c8ff',
};

export default function Map3DViewer({
  initialCenter = [107.06539, -6.48881],
  initialZoom = 14,
  points = [],
  activeStation,
  onSelectPoint,
  onClose,
}: Map3DViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const [basemap, setBasemap] = useState<'satellite' | 'street'>('satellite');
  const [pitch, setPitch] = useState<number>(60);
  const [isRotating, setIsRotating] = useState(false);
  const [exaggeration, setExaggeration] = useState(1.8);
  const [loading, setLoading] = useState(true);

  // Inisialisasi MapLibre 3D Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    } catch {
      // ignore
    }

    // Gaya MapLibre dengan Raster DEM 3D Terrain & Basemap Satelit Esri (100% Free)
    const style: maplibregl.StyleSpecification = {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
          maxzoom: 19,
        },
        'osm-streets': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
          maxzoom: 19,
        },
        // 3D Terrain DEM dari AWS Open Data / Terrarium (100% Free global elevation)
        'terrain-dem': {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 15,
        },
      },
      layers: [
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 22,
          layout: {
            visibility: basemap === 'satellite' ? 'visible' : 'none',
          },
        },
        {
          id: 'street-layer',
          type: 'raster',
          source: 'osm-streets',
          minzoom: 0,
          maxzoom: 22,
          layout: {
            visibility: basemap === 'street' ? 'visible' : 'none',
          },
        },
        // Hillshade halus untuk mempertegas lereng dan lembah sungai
        {
          id: 'hills',
          type: 'hillshade',
          source: 'terrain-dem',
          layout: { visibility: 'visible' },
          paint: {
            'hillshade-exaggeration': 0.35,
            'hillshade-shadow-color': '#020a1a',
            'hillshade-highlight-color': '#ffffff',
          },
        },
      ],
      sky: {
        'sky-color': '#071830',
        'sky-horizon-blend': 0.5,
        'horizon-color': '#00c8ff',
        'horizon-fog-blend': 0.5,
        'fog-color': '#020a1a',
        'fog-ground-blend': 0.7,
      },
      terrain: {
        source: 'terrain-dem',
        exaggeration: 1.8,
      },
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: style,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 60,
      bearing: -20,
      maxPitch: 85,
      canvasContextAttributes: { antialias: true },
    });

    mapRef.current = map;

    // Tambah kontrol navigasi (zoom + pitch rotation compass)
    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      'bottom-right'
    );

    map.on('load', () => {
      setLoading(false);
    });

    map.on('pitch', () => {
      setPitch(Math.round(map.getPitch()));
    });

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Update Basemap Layer visibility saat toggle berubah
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('satellite-layer')) {
      map.setLayoutProperty(
        'satellite-layer',
        'visibility',
        basemap === 'satellite' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('street-layer')) {
      map.setLayoutProperty(
        'street-layer',
        'visibility',
        basemap === 'street' ? 'visible' : 'none'
      );
    }
  }, [basemap]);

  // Update Exaggeration 3D
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      map.setTerrain({ source: 'terrain-dem', exaggeration });
    } catch {
      // ignore
    }
  }, [exaggeration]);

  // Render 3D Markers untuk titik bangunan
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Bersihkan marker lama
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    points.forEach((pt) => {
      if (typeof pt.lat !== 'number' || typeof pt.lon !== 'number') return;

      const catColor = CATEGORY_COLORS[pt.category || 'default'] || CATEGORY_COLORS['default'];
      const isActive = activeStation && activeStation.name === pt.name;

      // Custom 3D Marker Element
      const el = document.createElement('div');
      el.className = 'group cursor-pointer relative';
      el.innerHTML = `
        <div style="
          width: ${isActive ? '28px' : '22px'};
          height: ${isActive ? '28px' : '22px'};
          background: ${catColor};
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 10px ${catColor}88;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: ${isActive ? '11px' : '9px'};
          font-weight: bold;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        " class="hover:scale-125">
          <i class="fa-solid fa-water"></i>
        </div>
        <div style="
          position: absolute;
          bottom: -18px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(2, 10, 26, 0.85);
          color: #ffffff;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 1px solid rgba(0, 200, 255, 0.3);
        ">
          ${pt.name}
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectPoint?.(pt);
        map.flyTo({
          center: [pt.lon, pt.lat],
          pitch: 65,
          zoom: Math.max(map.getZoom(), 16),
          duration: 1200,
        });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pt.lon, pt.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [points, activeStation, onSelectPoint]);

  // Rotasi Otomatis (Drone Orbit 360)
  const toggleAutoRotate = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isRotating) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      setIsRotating(false);
    } else {
      setIsRotating(true);
      const rotateCamera = () => {
        const curBearing = map.getBearing();
        map.setBearing(curBearing + 0.15);
        animationFrameRef.current = requestAnimationFrame(rotateCamera);
      };
      rotateCamera();
    }
  }, [isRotating]);

  // Set Sudut Kamera Preset
  const setCameraPreset = (targetPitch: number, targetBearing?: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (isRotating) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setIsRotating(false);
    }
    map.easeTo({
      pitch: targetPitch,
      bearing: targetBearing !== undefined ? targetBearing : map.getBearing(),
      duration: 1000,
    });
  };

  // Kembali ke 2D (Leaflet)
  const handleBackTo2D = () => {
    const map = mapRef.current;
    if (map) {
      const center = map.getCenter();
      const zoom = Math.round(map.getZoom());
      onClose([center.lng, center.lat], zoom);
    } else {
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-[1000] w-full h-full bg-[#020a1a] flex flex-col overflow-hidden animate-fadeIn select-none">
      {/* 3D Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#020a1a]/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 pointer-events-none">
          <div className="w-12 h-12 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin mb-3 shadow-lg shadow-[#00c8ff]/30" />
          <p className="text-white text-sm font-semibold tracking-wide">Memuat Peta 3D &amp; Elevasi Tanah...</p>
          <p className="text-[#00c8ff]/80 text-xs mt-1 font-mono">Terrarium DEM · Esri Satellite</p>
        </div>
      )}

      {/* Top Bar: Tombol Kembali 2D & Indikator 3D */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleBackTo2D}
            className="px-4 py-2 bg-white/95 dark:bg-[#12122b]/95 backdrop-blur-md rounded-xl border border-white/20 dark:border-[#2a2a4e] shadow-xl text-xs font-bold text-gray-800 dark:text-white flex items-center gap-2 hover:bg-[#00c8ff] hover:text-white dark:hover:bg-[#00c8ff] transition-all active:scale-95 group"
          >
            <i className="fa-solid fa-arrow-left text-xs transition-transform group-hover:-translate-x-0.5"></i>
            <span>Kembali ke 2D</span>
          </button>

          <div className="px-3 py-1.5 bg-[#00c8ff]/15 border border-[#00c8ff]/40 text-[#00c8ff] text-xs font-bold rounded-xl backdrop-blur-md flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#00c8ff] animate-ping" />
            <span>3D TERRAIN VIEW</span>
          </div>
        </div>

        {/* Sudut Pitch Kamera Saat Ini */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-white/90 text-xs font-mono border border-white/10 pointer-events-auto">
          <i className="fa-solid fa-video text-[#00c8ff] text-[10px]"></i>
          <span>Pitch: {pitch}°</span>
        </div>
      </div>

      {/* Floating 3D Control Bar (Kiri Bawah) */}
      <div className="absolute bottom-6 left-4 z-10 flex flex-col gap-2 pointer-events-auto">
        <div className="bg-white/90 dark:bg-[#12122b]/90 backdrop-blur-xl border border-gray-200 dark:border-[#2a2a4e] rounded-2xl p-2 shadow-2xl flex flex-col gap-1.5 w-44">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-0.5 flex items-center justify-between">
            <span>Kontrol 3D</span>
            <i className="fa-solid fa-cube text-[#00c8ff]"></i>
          </div>

          {/* Preset Kamera */}
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setCameraPreset(0, 0)}
              className={`py-1.5 text-[10px] font-semibold rounded-lg border transition ${
                pitch === 0
                  ? 'bg-[#00c8ff] text-white border-[#00c8ff]'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
              title="Tampak Atas (0°)"
            >
              Atas
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset(60, -20)}
              className={`py-1.5 text-[10px] font-semibold rounded-lg border transition ${
                pitch >= 55 && pitch <= 65
                  ? 'bg-[#00c8ff] text-white border-[#00c8ff]'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
              title="Drone Angle (60°)"
            >
              Drone
            </button>
            <button
              type="button"
              onClick={() => setCameraPreset(78)}
              className={`py-1.5 text-[10px] font-semibold rounded-lg border transition ${
                pitch > 65
                  ? 'bg-[#00c8ff] text-white border-[#00c8ff]'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
              title="Horizon Rendah (78°)"
            >
              Horizon
            </button>
          </div>

          {/* Toggle Auto Orbit / Rotate 360 */}
          <button
            type="button"
            onClick={toggleAutoRotate}
            className={`w-full py-1.5 px-2.5 text-xs font-semibold rounded-xl border flex items-center justify-between transition ${
              isRotating
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <i className={`fa-solid ${isRotating ? 'fa-pause' : 'fa-rotate'} text-[11px]`}></i>
              <span>{isRotating ? 'Jeda Rotasi' : 'Putar 360°'}</span>
            </span>
            <span className="text-[9px] opacity-75">{isRotating ? 'ON' : 'OFF'}</span>
          </button>

          {/* Toggle Basemap (Satelit / Jalan) */}
          <div className="flex gap-1 pt-1 border-t border-gray-200/60 dark:border-white/10">
            <button
              type="button"
              onClick={() => setBasemap('satellite')}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-lg border transition flex items-center justify-center gap-1 ${
                basemap === 'satellite'
                  ? 'bg-[#00c8ff] text-white border-[#00c8ff]'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-transparent'
              }`}
            >
              <i className="fa-solid fa-satellite text-[9px]"></i>
              <span>Satelit</span>
            </button>
            <button
              type="button"
              onClick={() => setBasemap('street')}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-lg border transition flex items-center justify-center gap-1 ${
                basemap === 'street'
                  ? 'bg-[#00c8ff] text-white border-[#00c8ff]'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-transparent'
              }`}
            >
              <i className="fa-solid fa-road text-[9px]"></i>
              <span>Peta</span>
            </button>
          </div>

          {/* Toggle Elevasi / Relief */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 dark:border-white/10 text-[10px] text-gray-500 dark:text-gray-400 px-1">
            <span>Tingkat Lembah:</span>
            <div className="flex gap-1">
              {[1.2, 2.0].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setExaggeration(ex)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    exaggeration === ex
                      ? 'bg-[#00c8ff] text-white'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {ex === 1.2 ? 'Normal' : 'Tinggi'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Petunjuk Interaksi 3D */}
        <div className="bg-black/60 backdrop-blur-md text-white/70 text-[9px] px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 max-w-xs">
          <i className="fa-regular fa-hand-pointer text-[#00c8ff] text-xs"></i>
          <span>Klik kanan + geser mouse untuk bebas atur kemiringan &amp; putar arah 3D.</span>
        </div>
      </div>
    </div>
  );
}
