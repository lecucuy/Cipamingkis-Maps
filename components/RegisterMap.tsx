// components/RegisterMap.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    // 🔥 Jika container tidak ada, skip
    if (!mapRef.current) return;

    // 🔥 Jika sudah ada instance map, hapus dulu
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Bersihkan container secara total
    mapRef.current.innerHTML = '';
    mapRef.current.style.height = '100%';
    mapRef.current.style.width = '100%';

    let L: any;
    let marker: any = null;
    let drawnPolygon: any = null;
    let featureGroup: any = null;
    let isMounted = true;

    const initMap = async () => {
      try {
        L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        if (mode === 'polygon') {
          await import('leaflet-draw');
          await import('leaflet-draw/dist/leaflet.draw.css');
        }

        if (!mapRef.current || !isMounted) return;

        // Tentukan center
        let center: [number, number] = [-6.42531, 107.03924];
        if (geoData?.points?.length) {
          const p = geoData.points[0];
          center = [
            p.lat || p.geometry?.coordinates?.[1] || -6.42531,
            p.lon || p.geometry?.coordinates?.[0] || 107.03924,
          ];
        }

        // Buat map
        const map = L.map(mapRef.current, {
          center,
          zoom: 14,
          zoomControl: true,
          scrollWheelZoom: true,
        });
        mapInstanceRef.current = map;

        // Tile layer
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

        // ===== MODE POLYGON =====
        if (mode === 'polygon') {
          featureGroup = new L.FeatureGroup().addTo(map);

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
              }
            });
          }

          const drawControl = new (L as any).Draw.Draw({
            draw: {
              polygon: {
                allowIntersection: false,
                drawError: { color: '#e74c3c', message: 'Tidak boleh saling berpotongan!' },
                shapeOptions: { color: '#00c8ff', fillColor: '#00c8ff', fillOpacity: 0.2, weight: 3 },
              },
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
            },
            edit: {
              featureGroup: featureGroup,
              remove: true,
            },
          });
          map.addControl(drawControl);

          map.on('draw:created', (e: any) => {
            const layer = e.layer;
            if (drawnPolygon) featureGroup.removeLayer(drawnPolygon);
            drawnPolygon = layer;
            featureGroup.addLayer(layer);
            const coords = layer.getLatLngs()[0].map((p: any) => [p.lng, p.lat]);
            const data = { type: 'polygon', coordinates: coords, custom: true };
            setSelectedData(data);
            onLocationSelect(data);
            map.fitBounds(layer.getBounds());
          });

          map.on('draw:edited', (e: any) => {
            e.layers.eachLayer((layer: any) => {
              const coords = layer.getLatLngs()[0].map((p: any) => [p.lng, p.lat]);
              const data = { type: 'polygon', coordinates: coords, custom: true };
              setSelectedData(data);
              onLocationSelect(data);
            });
          });

          map.on('draw:deleted', (e: any) => {
            e.layers.eachLayer((layer: any) => {
              if (layer === drawnPolygon) {
                drawnPolygon = null;
                setSelectedData(null);
                onLocationSelect(null);
              }
            });
          });
        }

        // Trigger resize agar map sesuai container
        setTimeout(() => map.invalidateSize(), 200);

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    // Cleanup
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
          : 'Gambar polygon atau klik polygon yang sudah ada'}
      </div>
    </div>
  );
}