// components/RegisterForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import RegisterMap from './RegisterMap';

export default function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [emailCadangan, setEmailCadangan] = useState('');
  const [role, setRole] = useState<
  'supervisor' | 'juru' | 'pob' | 'tpop' | 'reporter'
  >('reporter');

  const [locationData, setLocationData] = useState<any>(null); // <- data lokasi
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Data geo untuk map (misal dari server, atau bisa dikosongkan)
  const geoData = {
    points: [],
    polygons: [], // bisa diisi dari API nanti
  };

  const handleLocationSelect = (data: any) => {
    console.log('📍 Lokasi dipilih:', data);
    setLocationData(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validasi lokasi harus dipilih
    if (!locationData) {
      setError('Silakan pilih lokasi terlebih dahulu!');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/register', {
        email,
        password,
        username,
        emailCadangan,
        role,
        location: locationData, // kirim data lokasi
      });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-xl p-8">
      <h1 className="text-2xl font-bold text-center text-[#1a1a2e] dark:text-white mb-6">Daftar Akun</h1>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">✅ Registrasi berhasil! Mengalihkan...</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pilihan role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daftar sebagai</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
          >
             <option value="reporter">Pelapor Curah Hujan (Titik)</option>
              <option value="pob">POB (Debit Bendung + Media)</option>
              <option value="juru">Juru (Media + Area)</option>
              <option value="supervisor">Supervisor (Full Akses)</option>
              <option value="tpop">TPOP (Area Tetap)</option>
          </select>
        </div>

        {/* MAP */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi *</label>
          <RegisterMap
            onLocationSelect={handleLocationSelect}
            mode={role === 'reporter' ? 'point' : 'polygon'}
            geoData={geoData}
          />
          {locationData && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              {role === 'reporter' ? (
                <span>📍 Titik: {locationData.lat?.toFixed(5)}, {locationData.lon?.toFixed(5)}</span>
              ) : (
                <span>🟦 Area: {locationData.coordinates?.length} titik sudut</span>
              )}
            </div>
          )}
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username *</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Utama (@cipamingkis.com) *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
            required
          />
          <p className="text-xs text-gray-500 mt-1">* Gunakan email dengan domain @cipamingkis.com</p>
        </div>

        {/* Email Cadangan */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Cadangan (untuk verifikasi) *</label>
          <input
            type="email"
            value={emailCadangan}
            onChange={(e) => setEmailCadangan(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
            required
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password (min 6) *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff]"
            required
          />
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
        Sudah punya akun? <a href="/login" className="text-[#00c8ff] hover:underline">Masuk</a>
      </p>
    </div>
  );
}