// components/ReporterRainfallInput.tsx
'use client';

import { useState, useMemo } from 'react';
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

type WaterStatus = 'normal' | 'siaga' | 'banjir' | 'kering';

// ============================================================
// THRESHOLD (mm) — sesuaikan dengan standar lapangan kamu
// ============================================================
const THRESHOLD = {
  normal_max: 10,   // 0.1 – 10 mm → Normal (aman)
  siaga_max: 30,    // 10.1 – 30 mm → Siaga
  // > 30 mm → Banjir
  // == 0 mm → Kering
};

// ============================================================
// METADATA STATUS (untuk warna, ikon, posisi di bar)
// Urutan keparahan: normal → siaga → banjir → kering
// ============================================================
const STATUS_META: Record<
  WaterStatus,
  { label: string; icon: string; color: string; position: number; desc: string }
> = {
  normal: {
    label: 'Normal',
    icon: 'fa-water',
    color: '#22C55E',
    position: 0,
    desc: 'Kondisi aman',
  },
  siaga: {
    label: 'Siaga',
    icon: 'fa-triangle-exclamation',
    color: '#EAB308',
    position: 33,
    desc: 'Perlu waspada',
  },
  banjir: {
    label: 'Banjir',
    icon: 'fa-house-flood-water',
    color: '#F97316',
    position: 66,
    desc: 'Debit tinggi',
  },
  kering: {
    label: 'Kering',
    icon: 'fa-ban',
    color: '#EF4444',
    position: 100,
    desc: 'Tidak ada air',
  },
};

// ============================================================
// AUTO-DERIVE STATUS dari nilai curah hujan
// ============================================================
function getStatusFromRainfall(mm: number): WaterStatus {
  if (mm <= 0) return 'kering';
  if (mm <= THRESHOLD.normal_max) return 'normal';
  if (mm <= THRESHOLD.siaga_max) return 'siaga';
  return 'banjir';
}

export default function ReporterRainfallInput({
  buildingId,
  buildingName,
  onSuccess,
  onClose,
}: ReporterRainfallInputProps) {
  const { data: session } = useSession();
  const [rainfall, setRainfall] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const roleNorm = (session?.user?.role || '').toLowerCase();
  const canInput = ALLOWED_ROLES.includes(roleNorm);

  // ===== DERIVED STATE (auto, tidak perlu useState) =====
  const rainfallNum = useMemo(() => {
    const n = parseFloat(rainfall);
    return isFinite(n) && n >= 0 ? n : 0;
  }, [rainfall]);

  const status: WaterStatus = useMemo(
    () => getStatusFromRainfall(rainfallNum),
    [rainfallNum]
  );

  const currentMeta = STATUS_META[status];

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
          rainfall_mm: rainfallNum,
          status,            // ← status otomatis dari nilai rainfall
          notes,
        },
        {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        }
      );
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{buildingName}</p>
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
          {/* ===== INPUT CURAH HUJAN ===== */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              🌧️ Curah Hujan
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="500"
                step="0.5"
                inputMode="decimal"
                value={rainfall}
                onChange={(e) => setRainfall(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(rainfall);
                  if (!isFinite(v) || v < 0) setRainfall('0');
                }}
                placeholder="0"
                className="w-full px-3 py-2.5 pr-12 rounded-lg bg-gray-50 dark:bg-[#0a0a1a] border border-gray-200 dark:border-[#2a2a4e] text-sm font-semibold text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff] focus:ring-2 focus:ring-[#00c8ff]/30"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                mm
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Masukkan angka curah hujan (contoh: 12.5). Status akan ditentukan otomatis.
            </p>
          </div>

          {/* ===== BAR AUTO-SYNC DENGAN NILAI ===== */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                💧 Status Air (otomatis)
              </label>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white transition-colors duration-300"
                style={{ backgroundColor: currentMeta.color }}
              >
                <i className={`fa-solid ${currentMeta.icon} mr-1`}></i>
                {currentMeta.label}
              </span>
            </div>

            {/* Bar gradient hijau → merah */}
            <div className="relative h-3 rounded-full overflow-visible mb-2">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'linear-gradient(to right, #22C55E 0%, #84CC16 25%, #EAB308 50%, #F97316 75%, #EF4444 100%)',
                }}
              />
              {/* Marker auto geser */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-lg border-2 transition-all duration-500 ease-out"
                style={{
                  left: `${currentMeta.position}%`,
                  borderColor: currentMeta.color,
                  boxShadow: `0 0 0 3px ${currentMeta.color}33, 0 2px 6px rgba(0,0,0,0.25)`,
                }}
              >
                <div
                  className="absolute inset-0 rounded-full m-0.5 transition-colors duration-300"
                  style={{ backgroundColor: currentMeta.color }}
                />
              </div>
            </div>

            {/* Keterangan status + threshold */}
            <div className="flex items-center justify-between text-[9px] text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                Normal ≤ {THRESHOLD.normal_max}mm
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#EAB308]"></span>
                Siaga ≤ {THRESHOLD.siaga_max}mm
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#F97316]"></span>
                Banjir &gt; {THRESHOLD.siaga_max}mm
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                Kering = 0mm
              </span>
            </div>

            {/* Info singkat status saat ini */}
            <div
              className="mt-2 px-3 py-2 rounded-lg text-[11px] transition-colors duration-300 flex items-center gap-2"
              style={{
                backgroundColor: `${currentMeta.color}1a`,
                borderLeft: `3px solid ${currentMeta.color}`,
                color: currentMeta.color,
              }}
            >
              <i className={`fa-solid ${currentMeta.icon}`}></i>
              <span className="font-medium">
                {currentMeta.desc} — input {rainfallNum} mm
              </span>
            </div>
          </div>

          {/* ===== CATATAN ===== */}
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
        </>
      )}
    </div>
  );
}