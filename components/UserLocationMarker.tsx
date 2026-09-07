// components/UserLocationMarker.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import L from 'leaflet';

interface UserLocationMarkerProps {
  map: L.Map | null;
  L: typeof L | null;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

export function useUserLocation(map: L.Map | null, L: typeof L | null) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationError, setUserLocationError] = useState<string | null>(null);
  const [userLocationLoading, setUserLocationLoading] = useState(false);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);

  // Fungsi untuk mendapatkan lokasi
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolokasi tidak didukung oleh peramban ini.');
      return;
    }

    setUserLocationLoading(true);
    setUserLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setUserLocationLoading(false);
        if (map) {
          map.flyTo([latitude, longitude], 15, { duration: 1.5 });
        }
        toast.success('Lokasi Anda ditemukan!');
      },
      (err) => {
        let msg = 'Gagal mendapatkan lokasi.';
        if (err.code === 1) msg = 'Izin lokasi ditolak. Berikan akses di pengaturan peramban.';
        else if (err.code === 2) msg = 'Posisi tidak tersedia.';
        else if (err.code === 3) msg = 'Waktu permintaan lokasi habis.';
        setUserLocationError(msg);
        setUserLocationLoading(false);
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [map]);

  // Efek untuk menggambar marker
  useEffect(() => {
    if (!map || !L || !userLocation) {
      // Hapus marker dan circle jika ada
      if (userMarkerRef.current) {
        map?.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (userCircleRef.current) {
        map?.removeLayer(userCircleRef.current);
        userCircleRef.current = null;
      }
      return;
    }

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
        .user-marker-icon {
          position: relative;
          width: 24px;
          height: 24px;
        }
        .user-marker-dot {
          width: 18px;
          height: 18px;
          background: #1E88E5;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 4px rgba(30, 136, 229, 0.4);
        }
        .user-marker-ring {
          position: absolute;
          top: -3px;
          left: -3px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(30, 136, 229, 0.2);
          animation: pulse-ring 2s infinite;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }

    const iconHtml = `
      <div class="user-marker-icon">
        <div class="user-marker-dot"></div>
        <div class="user-marker-ring"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: iconHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    // Buat atau update marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .bindPopup('📍 Anda di sini');
      marker.addTo(map);
      userMarkerRef.current = marker;
    }

    // Tambahkan lingkaran akurasi (opsional)
    // Bisa diambil dari posisi akurasi, tapi kita tidak simpan di state
    // Untuk contoh, kita gambar lingkaran radius 50 meter
    if (userCircleRef.current) {
      userCircleRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      const circle = L.circle([userLocation.lat, userLocation.lng], {
        radius: 50,
        color: '#1E88E5',
        fillColor: '#1E88E5',
        fillOpacity: 0.1,
        weight: 1,
        opacity: 0.3,
      }).addTo(map);
      userCircleRef.current = circle;
    }

    return () => {
      if (userMarkerRef.current && map) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (userCircleRef.current && map) {
        map.removeLayer(userCircleRef.current);
        userCircleRef.current = null;
      }
    };
  }, [map, L, userLocation]);

  // Reset lokasi (opsional)
  const clearUserLocation = useCallback(() => {
    setUserLocation(null);
    if (userMarkerRef.current && map) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    if (userCircleRef.current && map) {
      map.removeLayer(userCircleRef.current);
      userCircleRef.current = null;
    }
  }, [map]);

  return {
    userLocation,
    userLocationError,
    userLocationLoading,
    getUserLocation,
    clearUserLocation,
  };
}