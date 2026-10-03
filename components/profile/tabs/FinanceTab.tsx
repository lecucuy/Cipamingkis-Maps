'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { financeApi, FinanceSummary, FinanceTransaction, TxStatus } from '@/lib/api/finance';
import { getPermissions } from '@/lib/permissions';

const fmtIDR = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const STATUS_META: Record<TxStatus, { color: string; label: string }> = {
  pending:  { color: '#f59e0b', label: 'Pending' },
  approved: { color: '#10b981', label: 'Disetujui' },
  rejected: { color: '#ef4444', label: 'Ditolak' },
  paid:     { color: '#00c8ff', label: 'Dibayar' },
};

export default function FinanceTab({ role }: { role?: string | null }) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const perms = getPermissions(role);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [txs, setTxs] = useState<FinanceTransaction[]>([]);
  const [filter, setFilter] = useState<TxStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        financeApi.summary(token),
        financeApi.transactions(token, filter === 'all' ? {} : { status: filter }),
      ]);
      setSummary(s); setTxs(t.items || []);
    } catch (err: any) {
      if (err.response?.status === 403) toast.error('Akses ditolak');
      setSummary(null); setTxs([]);
    } finally { setLoading(false); }
  }, [token, filter]);

  useEffect(() => { load(); }, [load]);

  if (!perms.finance) {
    return (
      <div className="text-center py-10 text-gray-400">
        <i className="fa-solid fa-lock text-3xl mb-2 block"></i>
        <p className="text-sm">Tidak ada akses keuangan</p>
      </div>
    );
  }

  const handleApprove = async (id: string) => {
    if (!token) return;
    try {
      await financeApi.approve(token, id);
      toast.success('Disetujui');
      load();
    } catch { toast.error('Gagal approve'); }
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    const note = prompt('Alasan tolak:');
    if (!note) return;
    try {
      await financeApi.reject(token, id, note);
      toast.success('Ditolak');
      load();
    } catch { toast.error('Gagal reject'); }
  };

  const pct = summary?.budget ? Math.min(100, (summary.spent / summary.budget) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-[9px] uppercase font-semibold text-blue-600">Anggaran</p>
          <p className="text-sm font-bold text-[#1a1a2e] dark:text-white mt-1">{fmtIDR(summary?.budget || 0)}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-[9px] uppercase font-semibold text-amber-600">Realisasi</p>
          <p className="text-sm font-bold text-[#1a1a2e] dark:text-white mt-1">{fmtIDR(summary?.spent || 0)}</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="text-[9px] uppercase font-semibold text-emerald-600">Sisa</p>
          <p className="text-sm font-bold text-[#1a1a2e] dark:text-white mt-1">{fmtIDR(summary?.remaining || 0)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="p-3 rounded-xl bg-white dark:bg-[#0f0f23] border border-gray-200 dark:border-[#2a2a4e]">
        <div className="flex justify-between text-[10px] mb-2">
          <span className="text-gray-500">Penggunaan</span>
          <span className="font-mono font-bold text-[#00c8ff]">{Math.round(pct)}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00c8ff] to-blue-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[#0f0f23] rounded-lg p-1 overflow-x-auto">
        {(['all', 'pending', 'approved', 'rejected', 'paid'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 min-w-fit px-3 py-1.5 text-xs rounded-md font-medium transition whitespace-nowrap ${
              filter === f ? 'bg-white dark:bg-[#1a1a2e] text-[#00c8ff] shadow-sm'
                           : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {f === 'all' ? 'Semua' : STATUS_META[f as TxStatus].label}
          </button>
        ))}
      </div>

      {/* Transactions */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : txs.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <i className="fa-solid fa-receipt text-3xl mb-2 block"></i>
          <p className="text-sm">Belum ada transaksi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {txs.map(t => {
            const meta = STATUS_META[t.status];
            const canApprove = (perms.finance === 'approve' || perms.finance === 'full') && t.status === 'pending';
            return (
              <div key={t.id} className="p-3 rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
                        style={{ background: `${meta.color}20`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {t.category && <span className="text-[10px] text-gray-500">{t.category}</span>}
                    </div>
                    <p className="text-sm font-medium text-[#1a1a2e] dark:text-white mt-1 truncate">
                      {t.description || '—'}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {t.created_by_name && <> · @{t.created_by_name}</>}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#00c8ff] font-mono shrink-0">{fmtIDR(t.amount)}</p>
                </div>

                {canApprove && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-[#2a2a4e]">
                    <button
                      onClick={() => handleApprove(t.id)}
                      className="flex-1 py-1.5 text-[10px] rounded-md bg-emerald-500 text-white font-medium hover:bg-emerald-600"
                    >
                      ✓ Setujui
                    </button>
                    <button
                      onClick={() => handleReject(t.id)}
                      className="flex-1 py-1.5 text-[10px] rounded-md bg-red-500 text-white font-medium hover:bg-red-600"
                    >
                      ✕ Tolak
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}