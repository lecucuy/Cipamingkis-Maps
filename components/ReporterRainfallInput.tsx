// components/ReporterRainfallInput.tsx
'use client';

import { useState } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';

interface ReporterRainfallInputProps {
  buildingId: string;
  buildingName: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

// Role yang boleh input curah hujan
const ALLOWED_ROLES = ['reporter', 'pob', 'juru', 'supervisor', 'tpop'];

export default function ReporterRainfallInput({
  buildingId,
  buildingName,
  onSuccess,
  onClose,
}: ReporterRainfallInputProps) {
  const { data: session } = useSession();
  const [rainfall, setRainfall] = useState<number>(0);
  const [waterLevel, setWaterLevel] = useState<number | null>(null);
  const [status, setStatus] = useState<'normal' | 'kering' | 'banjir' | 'siaga'>('normal');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const roleNorm = (session?.user?.role || '').toLowerCase();
  const canInput = ALLOWED_ROLES.includes(roleNorm);

  if (!canInput) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
        <p className="text-yellow-700 dark:text-yellow-300 text-sm">
          ⚠️ Role Anda tidak diizinkan menginput curah hujan.
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(
        `${API_URL}/reporter/rainfall`,
        {
          building_id: buildingId,
          rainfall_mm: rainfall,
          water_level: waterLevel,
          status: status,
          notes: notes,
        },
        {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        }
      );
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-200 dark:border-[#2a2a4e] p-4 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-[#1a1a2e] dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-cloud-rain text-blue-500"></i>
            Input Curah Hujan
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {buildingName}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500 dark:text-gray-400"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      {success ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
          <p className="text-green-600 dark:text-green-400 font-medium">
            ✅ Data berhasil disimpan!
          </p>
        </div>
      ) : (
        <>
          {/* SLIDER CURAH HUJAN */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                🌧️ Curah Hujan
              </label>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {rainfall} mm
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={rainfall}
              onChange={(e) => setRainfall(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-[#2a2a4e] rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: rainfall === 0 ? '#EF4444' : '#00c8ff',
              }}
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>0 (Kering)</span>
              <span>50</span>
              <span>100+ mm</span>
            </div>
          </div>

          {/* STATUS AIR */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              💧 Status Air
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { value: 'normal', label: 'Normal', icon: 'fa-water', color: 'blue' },
                { value: 'kering', label: 'Kering', icon: 'fa-ban', color: 'red' },
                { value: 'siaga', label: 'Siaga', icon: 'fa-triangle-exclamation', color: 'yellow' },
                { value: 'banjir', label: 'Banjir', icon: 'fa-water', color: 'orange' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value as any)}
                  className={`px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all border ${
                    status === opt.value
                      ? `bg-${opt.color}-500 text-white border-${opt.color}-500 shadow-lg shadow-${opt.color}-500/30`
                      : `bg-gray-100 dark:bg-[#2a2a4e] text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-200 dark:hover:bg-[#3a3a5e]`
                  }`}
                >
                  <i className={`fa-solid ${opt.icon} mr-0.5`}></i>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* WATER LEVEL */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              📏 Tinggi Muka Air (opsional)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={waterLevel ?? ''}
                onChange={(e) =>
                  setWaterLevel(e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder="cm"
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#0a0a1a] border border-gray-200 dark:border-[#2a2a4e] text-sm focus:outline-none focus:border-[#00c8ff] focus:ring-2 focus:ring-[#00c8ff]/30"
              />
              <span className="text-xs text-gray-400 font-medium">cm</span>
            </div>
          </div>

          {/* CATATAN */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
              📝 Catatan (opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kondisi lapangan..."
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#0a0a1a] border border-gray-200 dark:border-[#2a2a4e] text-sm focus:outline-none focus:border-[#00c8ff] focus:ring-2 focus:ring-[#00c8ff]/30 resize-none h-16"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mb-3">
              <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-[#00c8ff] to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition shadow-lg shadow-[#00c8ff]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <i className="fa-solid fa-cloud-arrow-up"></i>
                Simpan Data
              </>
            )}
          </button>

          {rainfall === 0 && (
            <div className="mt-3 text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg border border-orange-200 dark:border-orange-800">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>
                Status "Kering" dipilih karena curah hujan 0 mm. Pastikan kondisi
                lapangan memang tidak ada air.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}