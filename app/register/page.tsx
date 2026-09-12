// app/register/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import dynamic from 'next/dynamic';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrength, { evaluatePassword } from '@/components/PasswordStrength';

const RegisterMap = dynamic(() => import('@/components/RegisterMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full bg-gray-200 dark:bg-[#1a1a2e] rounded-xl animate-pulse" />
  ),
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// ===== ROLE =====
type UserRole = 'supervisor' | 'juru' | 'pob' | 'tpop' | 'reporter';

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'reporter',
    label: 'Pelapor Curah Hujan',
    description: 'Lapor curah hujan (titik)',
  },
  {
    value: 'pob',
    label: 'POB',
    description: 'Debit bendung + media sekitar bendung',
  },
  {
    value: 'juru',
    label: 'Juru',
    description: 'Upload media & gambar area luas',
  },
  {
    value: 'supervisor',
    label: 'Supervisor',
    description: 'Akses penuh (Setu / Cibarusah)',
  },
  {
    value: 'tpop',
    label: 'TPOP',
    description: 'Hanya area/wilayah tetap',
  },
];

// Mode map per role
function getMapMode(role: UserRole): 'point' | 'polygon' {
  return role === 'reporter' ? 'point' : 'polygon';
}

// Deskripsi lokasi yang harus dipilih
function getLocationHint(role: UserRole): string {
  switch (role) {
    case 'reporter':
      return 'Pilih titik lokasi (bangunan terdekat)';
    case 'pob':
      return 'Gambar area di sekitar bendung';
    case 'juru':
      return 'Gambar area kerja Anda';
    case 'supervisor':
      return 'Gambar wilayah kerja Anda (Setu / Cibarusah)';
    case 'tpop':
      return 'Pilih area/wilayah TPOP yang telah ditentukan';
  }
}

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailCadangan, setEmailCadangan] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('reporter');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<{ points: any[]; polygons: any[] }>({
    points: [],
    polygons: [],
  });
  const [dataLoading, setDataLoading] = useState(true);
  const router = useRouter();

  // Load geoData
  useEffect(() => {
    const loadGeoData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/intake/geodata`);
        setGeoData({
          points: res.data.points || [],
          polygons: res.data.polygons || [],
        });
      } catch (err) {
        console.error('Gagal load geodata', err);
      } finally {
        setDataLoading(false);
      }
    };
    loadGeoData();
  }, []);

  // Reset lokasi kalau role berubah
  useEffect(() => {
    setSelectedLocation(null);
    setLocationError(null);
  }, [role]);

  const handleLocationSelect = useCallback((data: any) => {
    setSelectedLocation(data);
    setLocationError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ===== VALIDASI =====
    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak sama');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }
    if (!email.endsWith('@cipamingkis.com')) {
      setError('Email utama harus menggunakan domain @cipamingkis.com');
      return;
    }
    if (emailCadangan === email) {
      setError('Email cadangan harus berbeda');
      return;
    }
    if (!emailCadangan.includes('@')) {
      setError('Email cadangan tidak valid');
      return;
    }
    if (!selectedLocation) {
      setLocationError(getLocationHint(role));
      return;
    }

    const strength = evaluatePassword(password);
    if (strength.score < 2) {
      setError('Password terlalu lemah. Tambahkan huruf besar, angka, atau simbol.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        username,
        email,
        email_cadangan: emailCadangan,
        password,
        role,
      };

      // Payload lokasi sesuai role
      if (role === 'reporter') {
        if (selectedLocation.type !== 'point') {
          setError('Reporter harus memilih titik lokasi');
          setLoading(false);
          return;
        }
        payload.lat = selectedLocation.lat;
        payload.lon = selectedLocation.lon;
      } else {
        // pob, juru, supervisor, tpop
        if (selectedLocation.type !== 'polygon') {
          setError('Silakan gambar area terlebih dahulu');
          setLoading(false);
          return;
        }
        payload.polygon = selectedLocation.coordinates;
      }

      await axios.post(`${API_BASE_URL}/auth/register`, payload);
      setSuccess(true);
      setTimeout(() => router.push('/verify-pending'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading data...
      </div>
    );
  }

  const currentOption = ROLE_OPTIONS.find((r) => r.value === role);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a1a] p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-xl p-6 md:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a2e] dark:text-white">
            Daftar Akun
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {currentOption?.description}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">
            ✅ Registrasi berhasil! Cek email cadangan Anda untuk verifikasi.
          </div>
        )}

        {/* ===== PILIHAN ROLE ===== */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Daftar sebagai
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.description}
              </option>
            ))}
          </select>
        </div>

        {/* ===== MAP ===== */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Lokasi <span className="text-red-500">*</span>
          </label>
          <RegisterMap
            key={role} /* re-mount saat role berubah supaya map reset */
            onLocationSelect={handleLocationSelect}
            mode={getMapMode(role)}
            role={role}
            geoData={geoData}
          />
          {locationError && (
            <p className="text-red-500 text-xs mt-1">{locationError}</p>
          )}
        </div>

        {/* ===== FORM ===== */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Utama (@cipamingkis.com){' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
              placeholder="nama@cipamingkis.com"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              * Gunakan email dengan domain @cipamingkis.com
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Cadangan (untuk verifikasi){' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={emailCadangan}
              onChange={(e) => setEmailCadangan(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
              placeholder="emailpribadi@gmail.com"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              * Kode verifikasi akan dikirim ke email ini
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              minLength={8}
              required
              autoComplete="new-password"
            />
            <PasswordStrength password={password} />
          </div>

          {/* Konfirmasi Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Konfirmasi Password <span className="text-red-500">*</span>
            </label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              minLength={8}
              required
              autoComplete="new-password"
            />
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <i className="fa-solid fa-circle-exclamation text-[10px]" />
                Password tidak sama
              </p>
            )}
            {password && confirmPassword && password === confirmPassword && password.length > 0 && (
              <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
                <i className="fa-solid fa-circle-check text-[10px]" />
                Password cocok
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#00c8ff] text-white rounded-lg font-medium hover:bg-[#00c8ff]/90 disabled:opacity-50 transition-all shadow-lg shadow-[#00c8ff]/20"
          >
            {loading ? 'Mendaftar...' : 'Daftar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Sudah punya akun?{' '}
          <a href="/login" className="text-[#00c8ff] hover:underline">
            Masuk
          </a>
        </p>
      </div>
    </div>
  );
}