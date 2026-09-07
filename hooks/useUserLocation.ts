// hooks/useUserLocation.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';

interface UseUserLocationOptions {
  autoFetch?: boolean; // apakah otomatis meminta lokasi saat mount
}

export function useUserLocation(map: L.Map | null, L: any, options: UseUserLocationOptions = {}) {
  const { autoFetch = false } = options;
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null); // opsional: lingkaran akurasi

  const clearLocation = useCallback(() => {
    if (markerRef.current && map) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (circleRef.current && map) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }
    setLocation(null);
    setError(null);
  }, [map]);

  const fetchLocation = useCallback(() => {
    if (!map || !L) {
      toast.error('Peta belum siap.');
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolokasi tidak didukung.');
      toast.error('Geolokasi tidak didukung.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const latLng = { lat: latitude, lng: longitude };
        setLocation(latLng);
        setLoading(false);
        toast.success('Lokasi ditemukan.');

        // Buat atau update marker
        updateMarker(latLng, accuracy);
      },
      (err) => {
        let msg = 'Gagal mendapatkan lokasi.';
        if (err.code === 1) msg = 'Izin lokasi ditolak. Berikan akses di pengaturan peramban.';
        else if (err.code === 2) msg = 'Posisi tidak tersedia.';
        else if (err.code === 3) msg = 'Waktu permintaan lokasi habis.';
        setError(msg);
        setLoading(false);
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [map, L]);

  const updateMarker = useCallback((latLng: { lat: number; lng: number }, accuracy?: number) => {
    if (!map || !L) return;

    // Hapus marker lama
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }

    // Buat ikon kustom dengan animasi pulsing
    const iconHtml = `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;width:24px;height:24px;background:#1E88E5;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(30,136,229,0.4);"></div>
        <div style="position:absolute;top:-4px;left:-4px;width:32px;height:32px;border-radius:50%;background:rgba(30,136,229,0.2);animation:pulse-ring 2s infinite;pointer-events:none;"></div>
      </div>
    `;
    // Tambahkan style animasi jika belum ada
    if (!document.getElementById('user-location-style')) {
      const style = document.createElement('style');
      style.id = 'user-location-style';
      style.textContent = `
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          70% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(2); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: iconHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([latLng.lat, latLng.lng], { icon: userIcon })
      .bindPopup('📍 Anda di sini');
    marker.addTo(map);
    markerRef.current = marker;

    // Jika ada akurasi, tampilkan lingkaran
    if (accuracy && accuracy < 1000) { // hanya jika akurasi wajar
      const circle = L.circle([latLng.lat, latLng.lng], {
        radius: accuracy,
        color: '#1E88E5',
        fillColor: '#1E88E5',
        fillOpacity: 0.1,
        weight: 1,
        opacity: 0.4,
      });
      circle.addTo(map);
      circleRef.current = circle;
    }
  }, [map, L]);

  // Efek untuk auto-fetch jika diinginkan
  useEffect(() => {
    if (autoFetch && map && L) {
      fetchLocation();
    }
  }, [autoFetch, map, L, fetchLocation]);

  // Efek untuk membersihkan marker saat unmount atau map berubah
  useEffect(() => {
    return () => {
      if (markerRef.current && map) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (circleRef.current && map) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
    };
  }, [map]);

  return {
    userLocation: location,
    userLocationLoading: loading,
    userLocationError: error,
    getUserLocation: fetchLocation,
    clearUserLocation: clearLocation,
  };
}