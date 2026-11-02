// components/map/MeasurementOverlay.tsx
'use client';
import { useState } from 'react';
import type { useMeasurement } from '@/hooks/useMeasurement';

type Measurement = ReturnType<typeof useMeasurement>;

interface Props {
  measurement: Measurement;
  open: boolean;
  onClose: () => void;
}

export function MeasurementOverlay({ measurement, open, onClose }: Props) {
  const [showResults, setShowResults] = useState(false);
  const { mode, points, results, liveInfo, startMeasure, undoLast, cancel, finish, clearAll, removeResult, formatDistance, formatArea } = measurement;

  if (!open) return null;

  const active = mode !== 'none';
  const pointCount = points.length;
  const canFinish =
    (mode === 'distance' && pointCount >= 2) ||
    (mode === 'area' && pointCount >= 3) ||
    (mode === 'circle' && pointCount >= 2);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[992]
                    bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl
                    border border-gray-200 dark:border-[#2a2a4e]
                    w-[calc(100%-2rem)] max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-[#2a2a4e]">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-ruler-combined text-[#00c8ff] text-sm" />
          <span className="text-xs font-semibold text-gray-800 dark:text-white">
            Alat Ukur
            {results.length > 0 && <span className="ml-1 text-[10px] font-normal text-gray-500">({results.length})</span>}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {results.length > 0 && (
            <button
              onClick={() => setShowResults(!showResults)}
              className="text-[10px] font-medium text-cyan-600 dark:text-cyan-400 px-2 py-1 rounded hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
            >
              {showResults ? 'Sembunyikan' : 'Lihat Hasil'}
            </button>
          )}
          <button
            onClick={() => { cancel(); onClose(); }}
            className="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-2">
        {!active ? (
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => startMeasure('distance')} className="flex flex-col items-center gap-1 p-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
              <i className="fa-solid fa-ruler text-blue-500 text-lg" />
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Jarak</span>
            </button>
            <button onClick={() => startMeasure('area')} className="flex flex-col items-center gap-1 p-2.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition">
              <i className="fa-solid fa-vector-square text-green-500 text-lg" />
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Luas</span>
            </button>
            <button onClick={() => startMeasure('circle')} className="flex flex-col items-center gap-1 p-2.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition">
              <i className="fa-regular fa-circle text-amber-500 text-lg" />
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Radius</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="px-2 py-1.5 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
              <p className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                {mode === 'distance' ? '📏 Ukur Jarak' : mode === 'area' ? '📐 Ukur Luas' : '⭕ Ukur Radius'}
              </p>
              <p className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-0.5">
                {pointCount === 0
                  ? `Klik pada peta untuk ${mode === 'circle' ? 'titik pusat' : 'titik pertama'}`
                  : mode === 'circle' && pointCount === 1
                  ? 'Klik lagi untuk menentukan radius'
                  : `${pointCount} titik • klik lagi untuk lanjut`}
              </p>
              {liveInfo && (
                <p className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 mt-1 font-mono">
                  {mode === 'distance' && liveInfo.distance !== undefined && formatDistance(liveInfo.distance)}
                  {mode === 'area' && liveInfo.area !== undefined && `${formatArea(liveInfo.area)} • keliling ${formatDistance(liveInfo.perimeter)}`}
                  {mode === 'circle' && liveInfo.radius !== undefined && liveInfo.radius > 0 && `r=${formatDistance(liveInfo.radius)} • luas ${formatArea(liveInfo.area)}`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={undoLast} disabled={pointCount === 0} className="py-2 rounded-lg bg-gray-100 dark:bg-[#2a2a4e] hover:bg-gray-200 dark:hover:bg-[#3a3a5e] text-[10px] font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40 flex items-center justify-center gap-1">
                <i className="fa-solid fa-rotate-left" /> Undo
              </button>
              <button onClick={finish} disabled={!canFinish} className="py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 text-[10px] font-semibold disabled:opacity-40 flex items-center justify-center gap-1">
                <i className="fa-solid fa-check" /> Selesai
              </button>
              <button onClick={cancel} className="py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-[10px] font-semibold flex items-center justify-center gap-1">
                <i className="fa-solid fa-xmark" /> Batal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {showResults && results.length > 0 && (
        <div className="border-t border-gray-200 dark:border-[#2a2a4e] max-h-48 overflow-y-auto">
          {results.map(r => (
            <div key={r.id} className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 dark:border-[#2a2a4e] last:border-0">
              <i className={`fa-solid ${r.type === 'distance' ? 'fa-ruler text-blue-500' : r.type === 'area' ? 'fa-vector-square text-green-500' : 'fa-circle text-amber-500'} text-xs mt-1`} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase font-medium">
                  {r.type === 'distance' ? 'Jarak' : r.type === 'area' ? 'Luas' : 'Radius'}
                </p>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {r.type === 'distance' && formatDistance(r.distance)}
                  {r.type === 'area' && formatArea(r.area)}
                  {r.type === 'circle' && formatDistance(r.radius)}
                </p>
              </div>
              <button onClick={() => removeResult(r.id)} className="text-gray-400 hover:text-red-500 text-xs">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ))}
          <button onClick={clearAll} className="w-full py-2 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
            Hapus Semua
          </button>
        </div>
      )}
    </div>
  );
}