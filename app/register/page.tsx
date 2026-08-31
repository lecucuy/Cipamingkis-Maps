// app/register/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import dynamic from 'next/dynamic';

const RegisterMap = dynamic(() => import('@/components/RegisterMap'), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-200 dark:bg-[#1a1a2e] rounded-xl animate-pulse" />,
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailCadangan, setEmailCadangan] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // 👈 TAMBAH
  const [role, setRole] = useState<'reporter' | 'tpop'>('reporter');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<{ points: any[]; polygons: any[] }>({ points: [], polygons: [] });
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

  const handleLocationSelect = useCallback((data: any) => {
    setSelectedLocation(data);
    setLocationError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validasi password dan konfirmasi
    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak sama');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    // Validasi email
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
      setLocationError(role === 'reporter' ? 'Pilih titik lokasi' : 'Pilih area TPOP');
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
      if (role === 'reporter' && selectedLocation.type === 'point') {
        payload.lat = selectedLocation.lat;
        payload.lon = selectedLocation.lon;
      } else if (role === 'tpop' && selectedLocation.type === 'polygon') {
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

    console.log('selectedLocation:', selectedLocation);
  };

  if (dataLoading) return <div className="min-h-screen flex items-center justify-center">Loading data...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a1a] p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-xl p-6 md:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a2e] dark:text-white">Daftar Akun</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {role === 'reporter' ? 'Pilih titik lokasi' : 'Pilih area/wilayah TPOP'}
          </p>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">✅ Registrasi berhasil! Cek email cadangan Anda untuk verifikasi.</div>}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Daftar sebagai</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="reporter" checked={role === 'reporter'} onChange={() => setRole('reporter')} className="accent-[#00c8ff]" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Pelapor Curah Hujan (Titik)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="tpop" checked={role === 'tpop'} onChange={() => setRole('tpop')} className="accent-[#00c8ff]" />
              <span className="text-sm text-gray-700 dark:text-gray-300">TPOP (Area/Wilayah)</span>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lokasi <span className="text-red-500">*</span></label>
          <RegisterMap
            onLocationSelect={handleLocationSelect}
            mode={role === 'tpop' ? 'polygon' : 'point'}
            geoData={geoData}
          />
          {locationError && <p className="text-red-500 text-xs mt-1">{locationError}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username <span className="text-red-500">*</span></label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Utama (@cipamingkis.com) <span className="text-red-500">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]" placeholder="nama@cipamingkis.com" required />
            <p className="text-xs text-gray-400 mt-1">* Gunakan email dengan domain @cipamingkis.com</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Cadangan (untuk verifikasi) <span className="text-red-500">*</span></label>
            <input type="email" value={emailCadangan} onChange={(e) => setEmailCadangan(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]" placeholder="emailpribadi@gmail.com" required />
            <p className="text-xs text-gray-400 mt-1">* Kode verifikasi akan dikirim ke email ini</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password (min 6) <span className="text-red-500">*</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]" required />
          </div>

          {/* 👇 FIELD KONFIRMASI PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Konfirmasi Password <span className="text-red-500">*</span></label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]" required />
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-red-500 text-xs mt-1">Password tidak sama</p>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#00c8ff] text-white rounded-lg font-medium hover:bg-[#00c8ff]/90 disabled:opacity-50 transition-all shadow-lg shadow-[#00c8ff]/20">
            {loading ? 'Mendaftar...' : 'Daftar'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Sudah punya akun? <a href="/login" className="text-[#00c8ff] hover:underline">Masuk</a>
        </p>
      </div>
    </div>
  );
}