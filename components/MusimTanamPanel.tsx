// components/MusimTanamPanel.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  MUSIM_TANAM_STATUS,
  MusimTanamStatus,
  useMusimTanam,
} from '@/hooks/useMusimTanam';



interface Polygon {
  name: string;
  area_ha?: number;
  path?: number[][];
}

interface MusimTanamPanelProps {
  polygons: Polygon[];
  userRole?: string;
  onClose?: () => void;
  onSuccess?: () => void;   // 🔥 BARU
}



const ALLOWED_ROLES = ['juru', 'supervisor', 'admin'];

export default function MusimTanamPanel({
  polygons,
  userRole,
  onClose,
  onSuccess,                 // 🔥 BARU
}: MusimTanamPanelProps) {
  const { reports, reportByPolygon, periodeInfo, compare, loading, submitting, submit } =
    useMusimTanam();

  const allowed = ALLOWED_ROLES.includes((userRole || '').toLowerCase());
  
  // State input per polygon
  type DraftRow = { status: MusimTanamStatus; keterangan: string };
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});

  // Load existing periode ini ke draft
  useEffect(() => {
    const next: Record<string, DraftRow> = {};
    polygons.forEach((p, idx) => {
      const rowKey = `${p.name}__${idx}`;
      const existing = reportByPolygon[p.name];
      next[rowKey] = {
        status: existing?.status || 'tidak_ada',
        keterangan: existing?.keterangan || '',
      };
    });
    setDraft(next);
  }, [polygons, reportByPolygon]);

  const updateDraft = (name: string, patch: Partial<DraftRow>) => {
    setDraft((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...patch },
    }));
  };

const handleSubmit = async () => {
  if (!allowed) {
    toast.error('Hanya Juru / Supervisor yang bisa input musim tanam.');
    return;
  }
  if (submitting) return;

  const items = polygons.map((p, idx) => {
    const rowKey = `${p.name}__${idx}`;
    return {
      polygon_id: p.name,
      polygon_name: p.name,
      status: draft[rowKey]?.status || 'tidak_ada',
      luas_ha: p.area_ha || 0,
      keterangan: draft[rowKey]?.keterangan || '',
    };
  });

  try {
    const res = await submit(items);
    toast.success(res.message || 'Musim tanam tersimpan');
    onSuccess?.();           // 🔥 Trigger refresh di parent
  } catch (e: any) {
    toast.error(e.response?.data?.detail || e.message || 'Gagal menyimpan');
  }
};


  // Summary periode ini (dari draft, live)
  const summaryCurrent = useMemo(() => {
    const map: Record<MusimTanamStatus, { luas: number; count: number }> = {
      bibit: { luas: 0, count: 0 },
      garap: { luas: 0, count: 0 },
      tanam: { luas: 0, count: 0 },
      panen: { luas: 0, count: 0 },
      tidak_ada: { luas: 0, count: 0 },
    };
    polygons.forEach((p, idx) => {
      const rowKey = `${p.name}__${idx}`;
      const s = draft[rowKey]?.status || 'tidak_ada';
      map[s].luas += p.area_ha || 0;
      map[s].count += 1;
    });
    Object.keys(map).forEach((k) => {
      (map as any)[k].luas = Math.round((map as any)[k].luas * 100) / 100;
    });
    return map;
  }, [draft, polygons]);

  const prevSummary = compare?.previous?.summary;

  return (
    <div className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-gray-200 dark:border-[#2a2a4e]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2a2a4e] bg-gradient-to-r from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <i className="fa-solid fa-seedling text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-white">
                Musim Tanam — Laporan Periode
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {periodeInfo?.current?.label || '—'} · Update tiap 2 minggu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500 dark:text-gray-400"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* NOT ALLOWED */}
        {!allowed && (
          <div className="m-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
            <i className="fa-solid fa-eye" />
            Role Anda hanya bisa melihat. Input musim tanam hanya untuk Juru &amp; Supervisor.
          </div>
        )}

        {/* SUMMARY COMPARE */}
        <div className="px-3 pt-3">
          <div className="rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-gray-50/50 dark:bg-[#0f0f23]/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <i className="fa-solid fa-chart-simple text-emerald-500" />
                Perbandingan Luas (Ha)
              </h4>
              <div className="flex items-center gap-2 text-[9px] text-gray-400">
                <span>← {compare?.previous?.periode?.label || '—'}</span>
                <span className="text-emerald-500">→ {periodeInfo?.current?.label || '—'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(MUSIM_TANAM_STATUS) as MusimTanamStatus[]).map((s) => {
                const meta = MUSIM_TANAM_STATUS[s];
                const curr = summaryCurrent[s];
                const prev = prevSummary?.[s] || { luas: 0, count: 0 };
                const delta = Math.round((curr.luas - prev.luas) * 100) / 100;
                return (
                  <div
                    key={s}
                    className="rounded-lg bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] px-2 py-1.5"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: meta.color }}
                      />
                      <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate">
                        {meta.label}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-gray-900 dark:text-white">
                      {curr.luas} Ha
                    </div>
                    <div
                      className={`text-[9px] font-mono ${
                        delta > 0
                          ? 'text-emerald-600'
                          : delta < 0
                          ? 'text-red-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta} Ha
                      <span className="text-gray-400 ml-1">
                        ({prev.luas})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BODY — LIST POLYGON */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : polygons.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Belum ada polygon luasan sawah
            </div>
          ) : (
            polygons.map((poly, idx) => {
              const rowKey = `${poly.name}__${idx}`;
              const row = draft[rowKey] || {
                status: 'tidak_ada' as MusimTanamStatus,
                keterangan: '',
              };
              const existing = reportByPolygon[poly.name];
              const meta = MUSIM_TANAM_STATUS[row.status];
              return (
                <div
                  key={poly.name}
                  className="rounded-xl border border-gray-200 dark:border-[#2a2a4e] p-3 bg-gray-50/50 dark:bg-[#0f0f23]/40"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ background: meta.color }}
                      />
                      <span className="text-xs font-semibold text-[#1a1a2e] dark:text-white truncate">
                        {poly.name}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                        {poly.area_ha ? `${Math.round(poly.area_ha)} Ha` : '—'}
                      </span>
                    </div>
                    {existing && (
                      <span className="text-[9px] text-emerald-600 flex items-center gap-1">
                        <i className="fa-solid fa-circle-check" />
                        Terisi
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
                    <select
                      disabled={!allowed}
                      value={row.status}
                      onChange={(e) =>
                    updateDraft(rowKey, { status: e.target.value as MusimTanamStatus })
                      }
                      className="px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-emerald-500"
                    >
                      {(Object.keys(MUSIM_TANAM_STATUS) as MusimTanamStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {MUSIM_TANAM_STATUS[s].label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      disabled={!allowed}
                      value={row.keterangan}
                      onChange={(e) => updateDraft(rowKey, { keterangan: e.target.value })}
                      placeholder="Keterangan (opsional)"
                      className="px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        {allowed && (
          <div className="flex items-center justify-between gap-2 p-3 border-t border-gray-200 dark:border-[#2a2a4e]">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Total {polygons.length} polygon · 1 laporan per periode
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting || polygons.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" /> Menyimpan…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" /> Simpan Musim Tanam
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}