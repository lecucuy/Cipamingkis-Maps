'use client';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { profileApi } from '@/lib/api/profile';
import { getPermissions } from '@/lib/permissions';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const fmtIDR = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export default function FinancePanel({ role }: { role?: string | null }) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const perms = getPermissions(role);

  const [summary, setSummary] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        profileApi.financeSummary(token),
        profileApi.financeTransactions(token, { status: filter === 'all' ? undefined : filter }),
      ]);
      setSummary(s);
      setTxs(t.items || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error('Anda tidak memiliki akses ke data keuangan');
      } else {
        toast.error('Gagal memuat data keuangan');
      }
      setSummary(null);
      setTxs([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { load(); }, [load]);

  if (!perms.finance) {
    return (
      <div className="p-8 text-center text-gray-400">
        <i className="fa-solid fa-lock text-3xl mb-2 block"></i>
        <p className="text-sm">Anda tidak memiliki akses ke data keuangan.</p>
      </div>
    );
  }

  const badgeStatus = (s: string) => {
    const map: Record<string, string> = {
      pending:  'bg-amber-500/15 text-amber-600 border-amber-500/30',
      approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      rejected: 'bg-red-500/15 text-red-600 border-red-500/30',
    };
    return map[s] || 'bg-gray-500/15 text-gray-500 border-gray-500/30';
  };

  return (
    <div className="space-y-4">
      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
          <p className="text-[10px] uppercase font-semibold text-blue-600">Anggaran</p>
          <p className="text-xl font-bold text-[#1a1a2e] dark:text-white mt-1">
            {fmtIDR(summary?.budget || 0)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <p className="text-[10px] uppercase font-semibold text-amber-600">Realisasi</p>
          <p className="text-xl font-bold text-[#1a1a2e] dark:text-white mt-1">
            {fmtIDR(summary?.spent || 0)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20">
          <p className="text-[10px] uppercase font-semibold text-emerald-600">Sisa</p>
          <p className="text-xl font-bold text-[#1a1a2e] dark:text-white mt-1">
            {fmtIDR(summary?.remaining || 0)}
          </p>
        </div>
      </div>

      {/* ===== PROGRESS BAR ===== */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#0f0f23] border border-gray-200 dark:border-[#2a2a4e]">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-gray-600 dark:text-gray-300">Penggunaan Anggaran</span>
          <span className="font-mono font-bold text-[#00c8ff]">
            {summary?.budget ? Math.round((summary.spent / summary.budget) * 100) : 0}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00c8ff] to-blue-600 transition-all duration-500"
            style={{ width: `${summary?.budget ? Math.min(100, (summary.spent / summary.budget) * 100) : 0}%` }}
          />
        </div>
      </div>

      {/* ===== FILTER + TAMBAH (kalau punya permission) ===== */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 dark:bg-[#0f0f23] rounded-lg p-1">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[10px] rounded-md font-medium transition ${
                filter === f
                  ? 'bg-white dark:bg-[#1a1a2e] text-[#00c8ff] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'pending' ? 'Pending' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
            </button>
          ))}
        </div>
        {(perms.finance === 'request' || perms.finance === 'full') && (
          <button className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-[#00c8ff] text-white font-medium hover:bg-[#00c8ff]/90 flex items-center gap-1.5">
            <i className="fa-solid fa-plus"></i> Ajukan Transaksi
          </button>
        )}
      </div>

      {/* ===== TRANSACTIONS ===== */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : txs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            <i className="fa-solid fa-inbox text-2xl block mb-2"></i>
            Belum ada transaksi
          </div>
        ) : (
          txs.map((t) => (
            <div
              key={t.id}
              className="p-3 rounded-xl bg-white dark:bg-[#0f0f23] border border-gray-200 dark:border-[#2a2a4e] hover:border-[#00c8ff]/50 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${badgeStatus(t.status)}`}>
                      {t.status}
                    </span>
                    <span className="text-[10px] text-gray-500">{t.category || 'Umum'}</span>
                  </div>
                  <p className="text-sm font-medium text-[#1a1a2e] dark:text-white mt-1 truncate">
                    {t.description || 'Tanpa deskripsi'}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(t.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                    {t.created_by_name && <> · oleh @{t.created_by_name}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#00c8ff] font-mono">{fmtIDR(t.amount)}</p>
                  {t.receipt_url && (
                    <a
                      href={t.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-gray-500 hover:text-[#00c8ff] mt-1 inline-flex items-center gap-1"
                    >
                      <i className="fa-solid fa-receipt"></i> Bukti
                    </a>
                  )}
                </div>
              </div>

              {/* APPROVE / REJECT — khusus approver */}
              {perms.finance === 'approve' || perms.finance === 'full' ? (
                t.status === 'pending' && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-[#2a2a4e]">
                    <button
                      onClick={() => toast.success('Fitur approve — panggil API')}
                      className="flex-1 py-1.5 text-[10px] rounded-md bg-emerald-500 text-white font-medium hover:bg-emerald-600"
                    >
                      ✓ Setujui
                    </button>
                    <button
                      onClick={() => toast.error('Fitur reject — panggil API')}
                      className="flex-1 py-1.5 text-[10px] rounded-md bg-red-500 text-white font-medium hover:bg-red-600"
                    >
                      ✕ Tolak
                    </button>
                  </div>
                )
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* ===== AUDIT NOTICE ===== */}
      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
        <i className="fa-solid fa-shield-halved mt-0.5"></i>
        <span>
          Semua akses & perubahan data keuangan dicatat dalam <strong>audit log</strong>.
          Aktivitas Anda dapat ditinjau oleh admin.
        </span>
      </div>
    </div>
  );
}