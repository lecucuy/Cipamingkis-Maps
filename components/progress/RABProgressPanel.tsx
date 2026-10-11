'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { rabApi, RABDetail, RABListItemDetail } from '@/lib/api/rab';
import RABDetailModal from '@/components/profile/tabs/RABDetailModal';
import { normalizeRole } from '@/types/pelaporan';

interface Props {
  buildingId: string;
  buildingName: string;
  onRefresh?: () => void;
}

const PROGRESS_ROLES = ['admin', 'supervisor', 'juru'];

const fmtIDR = (n?: number) =>
  n != null
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
      }).format(n)
    : '-';

export default function RABProgressPanel({ buildingId, buildingName, onRefresh }: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  // 🔥 GATING
  const role = normalizeRole(session?.user?.role);
  const canSeeProgress = !!role && PROGRESS_ROLES.includes(role);

  const [rabs, setRabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<RABDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const loadRabs = async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      // guest mode: kirim hanya buildingId
      const r = token
        ? await rabApi.list(token, buildingId)
        : await rabApi.list(buildingId);

      const active = (r.items || []).filter(
        (x: any) => x.status === 'berjalan' || x.status === 'selesai'
      );
      setRabs(active);
    } catch (e: any) {
      console.error('Load RAB error:', e);
      setRabs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, token]);

  const loadDetail = async (rabId: string) => {
    try {
      const r = token
        ? await rabApi.detail(token, rabId)
        : await rabApi.detail(rabId);
      setDetail(r);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal load detail RAB');
    }
  };

  // 🔥 Sembunyikan total kalau masih loading ATAU nggak ada RAB aktif
  if (loading) return null;
  if (rabs.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        {rabs.map((rab) => (
          <div
            key={rab.id}
            className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] rounded-xl overflow-hidden"
          >
            {/* HEADER RAB */}
            <div className="px-3 py-2 bg-gradient-to-r from-[#00c8ff]/10 to-purple-500/10 border-b border-gray-200 dark:border-[#2a2a4e]">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">
                    <i className="fa-solid fa-file-invoice-dollar text-[#00c8ff] mr-1" />
                    {rab.judul}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {canSeeProgress ? `${fmtIDR(rab.total)} · ` : ''}
                    {rab.status}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await loadDetail(rab.id);
                    setShowDetail(true);
                  }}
                  className="px-2 py-1 text-[10px] rounded-md bg-[#00c8ff] text-white font-semibold hover:opacity-90"
                >
                  Detail
                </button>
              </div>

              {/* Progress bar RAB — hanya role berwenang */}
              {canSeeProgress && (
                <div className="mt-2">
                  <div className="flex justify-between text-[9px] mb-1">
                    <span className="text-gray-500">Progress RAB</span>
                    <span className="font-mono font-bold text-[#00c8ff]">
                      {(rab.progress ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-[#0f0f23] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00c8ff] to-purple-500 transition-all"
                      style={{ width: `${rab.progress ?? 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* QUICK INFO */}
            <div className="px-3 py-2 bg-amber-500/5 border-b border-amber-500/20">
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                <i className="fa-solid fa-camera mr-1" />
                {canSeeProgress ? (
                  <>Buka <b>Detail</b> untuk capture foto/video per item</>
                ) : (
                  <>Lihat detail untuk melihat bukti pekerjaan</>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DETAIL */}
      {showDetail && detail && (
        <RABDetailModal
          rabId={detail.id}
          open={showDetail}
          onClose={() => {
            setShowDetail(false);
            setDetail(null);
            loadRabs();
          }}
          onChanged={() => {
            loadDetail(detail.id);
            loadRabs();
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}