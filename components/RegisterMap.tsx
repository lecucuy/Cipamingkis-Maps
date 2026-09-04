// components/RegisterMap.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RegisterMapProps {
  onLocationSelect: (data: any) => void;
  mode?: 'point' | 'polygon';
  geoData?: {
    points: any[];
    polygons: any[];
  };
}

export default function RegisterMap({
  onLocationSelect,
  mode = 'point',
  geoData,
}: RegisterMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [selectedData, setSelectedData] = useState<any>(null);

  // Untuk custom drawing polygon
  const drawingRef = useRef<{
    isDrawing: boolean;
    points: [number, number][];
    tempPolygon: any; // L.Polygon
    tempLine: any; // L.Polyline
    markers: any[];
  }>({
    isDrawing: false,
    points: [],
    tempPolygon: null,
    tempLine: null,
    markers: [],
  });

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    mapRef.current.innerHTML = '';
    mapRef.current.style.height = '100%';
    mapRef.current.style.width = '100%';

    let marker: any = null;
    let isMounted = true;
    const drawnPolygons: any[] = []; // menyimpan polygon yang sudah selesai digambar (custom)
    const existingPolygons: any[] = []; // dari geoData

    const initMap = () => {
      try {
        if (!mapRef.current || !isMounted) return;

        let center: [number, number] = [-6.42531, 107.03924];
        if (geoData?.points?.length) {
          const p = geoData.points[0];
          center = [
            p.lat || p.geometry?.coordinates?.[1] || -6.42531,
            p.lon || p.geometry?.coordinates?.[0] || 107.03924,
          ];
        }

        const map = L.map(mapRef.current, {
          center,
          zoom: 14,
          zoomControl: true,
          scrollWheelZoom: true,
        });
        mapInstanceRef.current = map;

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri',
        }).addTo(map);

        // ===== MODE POINT =====
        if (mode === 'point') {
          if (geoData?.points) {
            geoData.points.forEach((p: any) => {
              const lat = p.lat || p.geometry?.coordinates?.[1];
              const lng = p.lon || p.geometry?.coordinates?.[0];
              if (lat && lng) {
                const m = L.marker([lat, lng]).addTo(map);
                m.bindPopup(p.name || 'Titik');
                m.on('click', () => {
                  const data = { type: 'point', lat, lon: lng, name: p.name };
                  setSelectedData(data);
                  onLocationSelect(data);
                });
              }
            });
          }

          map.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lng]).addTo(map);
            const data = { type: 'point', lat, lon: lng, custom: true };
            setSelectedData(data);
            onLocationSelect(data);
          });
        }

        // ===== MODE POLYGON (custom drawing) =====
        if (mode === 'polygon') {
          // ===== Tampilkan polygon dari geoData =====
          if (geoData?.polygons) {
            geoData.polygons.forEach((p: any) => {
              const coords = p.geometry?.coordinates?.[0]?.map((c: any) => [c[1], c[0]]);
              if (coords) {
                const poly = L.polygon(coords, {
                  color: '#00c8ff',
                  fillColor: '#00c8ff',
                  fillOpacity: 0.1,
                  weight: 2,
                }).addTo(map);
                poly.bindPopup(p.name || 'Area');
                poly.on('click', () => {
                  const data = { type: 'polygon', coordinates: coords.map((c: any) => [c[1], c[0]]), name: p.name };
                  setSelectedData(data);
                  onLocationSelect(data);
                  map.fitBounds(poly.getBounds());
                });
                existingPolygons.push(poly);
              }
            });
          }

          // ===== FUNGSI DRAWING =====
          const startDrawing = () => {
            if (drawingRef.current.isDrawing) return;
            drawingRef.current.isDrawing = true;
            drawingRef.current.points = [];
            drawingRef.current.markers = [];

            // Instruksi
            L.popup()
              .setLatLng(map.getCenter())
              .setContent('🖱️ Klik untuk tambah titik, <b>double‑click</b> atau <b>klik kanan</b> untuk selesai.')
              .openOn(map);

            // Event listener
            map.on('click', onMapClick);
            map.on('dblclick', finishDrawing);
            map.on('contextmenu', finishDrawing);
          };

          const onMapClick = (e: any) => {
            const { lat, lng } = e.latlng;
            const point: [number, number] = [lat, lng];
            drawingRef.current.points.push(point);

            // Tandai titik dengan marker kecil
            const marker = L.circleMarker([lat, lng], {
              radius: 4,
              color: '#00c8ff',
              fillColor: '#00c8ff',
              fillOpacity: 1,
            }).addTo(map);
            drawingRef.current.markers.push(marker);

            // Update garis sementara
            if (drawingRef.current.tempLine) {
              map.removeLayer(drawingRef.current.tempLine);
            }
            if (drawingRef.current.points.length > 1) {
              drawingRef.current.tempLine = L.polyline(drawingRef.current.points, {
                color: '#00c8ff',
                weight: 2,
                dashArray: '5, 5',
              }).addTo(map);
            }
          };

          const finishDrawing = () => {
            if (!drawingRef.current.isDrawing) return;
            if (drawingRef.current.points.length < 3) {
              // Kurang dari 3 titik, batal
              resetDrawing();
              L.popup()
                .setLatLng(map.getCenter())
                .setContent('⚠️ Minimal 3 titik untuk polygon.')
                .openOn(map);
              return;
            }

            // Buat polygon permanen
            const poly = L.polygon(drawingRef.current.points, {
              color: '#00c8ff',
              fillColor: '#00c8ff',
              fillOpacity: 0.2,
              weight: 3,
            }).addTo(map);
            poly.bindPopup('Polygon baru (klik untuk pilih)');
            poly.on('click', () => {
              const coords = poly.getLatLngs()[0].map((p: any) => [p.lng, p.lat]);
              const data = { type: 'polygon', coordinates: coords, custom: true };
              setSelectedData(data);
              onLocationSelect(data);
              map.fitBounds(poly.getBounds());
            });
            drawnPolygons.push(poly);

            // Simpan koordinat untuk callback
            const coords = drawingRef.current.points.map((p) => [p[1], p[0]]);
            const data = { type: 'polygon', coordinates: coords, custom: true };
            setSelectedData(data);
            onLocationSelect(data);
            map.fitBounds(poly.getBounds());

            resetDrawing();
          };

          const resetDrawing = () => {
            drawingRef.current.isDrawing = false;
            drawingRef.current.points = [];
            if (drawingRef.current.tempLine) {
              map.removeLayer(drawingRef.current.tempLine);
              drawingRef.current.tempLine = null;
            }
            drawingRef.current.markers.forEach((m) => map.removeLayer(m));
            drawingRef.current.markers = [];
            map.off('click', onMapClick);
            map.off('dblclick', finishDrawing);
            map.off('contextmenu', finishDrawing);
          };

          // ===== TOMBOL MULAI GAMBAR =====
          // Tambahkan kontrol custom di pojok kiri bawah
          const controlContainer = L.control({ position: 'bottomleft' });
          controlContainer.onAdd = () => {
            const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
            div.style.padding = '5px';
            const btn = L.DomUtil.create('button', 'leaflet-control-button');
            btn.innerHTML = '✏️ Gambar Polygon';
            btn.style.background = '#00c8ff';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.padding = '6px 12px';
            btn.style.cursor = 'pointer';
            btn.style.fontWeight = 'bold';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            btn.onclick = (e) => {
              L.DomEvent.stopPropagation(e);
              if (drawingRef.current.isDrawing) {
                finishDrawing();
              } else {
                startDrawing();
              }
            };
            div.appendChild(btn);
            return div;
          };
          controlContainer.addTo(map);

          // Tombol hapus semua polygon custom (opsional)
          const clearBtn = L.control({ position: 'bottomleft' });
          clearBtn.onAdd = () => {
            const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
            div.style.padding = '5px';
            const btn = L.DomUtil.create('button', 'leaflet-control-button');
            btn.innerHTML = '🗑️ Hapus Semua';
            btn.style.background = '#e74c3c';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.padding = '6px 12px';
            btn.style.cursor = 'pointer';
            btn.style.fontWeight = 'bold';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            btn.onclick = (e) => {
              L.DomEvent.stopPropagation(e);
              drawnPolygons.forEach((p) => map.removeLayer(p));
              drawnPolygons.length = 0;
              setSelectedData(null);
              onLocationSelect(null);
              resetDrawing();
            };
            div.appendChild(btn);
            return div;
          };
          clearBtn.addTo(map);
        }

        setTimeout(() => map.invalidateSize(), 200);
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.innerHTML = '';
      }
    };
  }, [onLocationSelect, mode, geoData]);

  return (
    <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden border border-gray-200 dark:border-[#2a2a4e]">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '100%' }} />
      {selectedData && mode === 'point' && (
        <div className="absolute bottom-2 left-2 bg-white dark:bg-[#1a1a2e] px-3 py-1 rounded-lg shadow text-xs">
          📍 {selectedData.lat?.toFixed(5)}, {selectedData.lon?.toFixed(5)}
          {selectedData.name && ` (${selectedData.name})`}
        </div>
      )}
      {selectedData && mode === 'polygon' && (
        <div className="absolute bottom-2 left-2 bg-white dark:bg-[#1a1a2e] px-3 py-1 rounded-lg shadow text-xs">
          🟦 Area terpilih ({selectedData.coordinates?.length} titik sudut)
          {selectedData.name && ` (${selectedData.name})`}
        </div>
      )}
      <div className="absolute top-2 left-2 bg-white/90 dark:bg-[#1a1a2e]/90 px-2 py-1 rounded text-[10px] shadow text-gray-600 dark:text-gray-300">
        {mode === 'point'
          ? 'Klik peta untuk tentukan titik (atau klik marker yang sudah ada)'
          : 'Klik tombol "Gambar Polygon" untuk mulai, double‑click untuk selesai'}
      </div>
    </div>
  );
}