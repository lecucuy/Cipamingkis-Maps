'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { userApi } from '@/lib/api/user';

interface Props {
  /** Opsional — dipakai kalau parent ingin reaksi saat sesi dicabut */
  onSessionRevoked?: (id: string) => void;
}

type SessionItem = {
  id: string;
  device: string;
  ip: string;
  last_active: string;
  created_at: string;
  current: boolean;
};

type HistoryItem = {
  id: string;
  ip: string;
  device: string;
  timestamp: string;
};

const fmtDateTime = (iso?: string) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function SecurityTab({ onSessionRevoked }: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  // ===== Data =====
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!token) {
      setLoadingSessions(false);
      return;
    }
    setLoadingSessions(true);
    try {
      const data = await userApi.getSessions(token);
      setSessions(data);
    } catch (err: any) {
      console.warn('[SecurityTab] sessions gagal:', err?.response?.status);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await userApi.getLoginHistory(token, 20);
      setHistory(data);
    } catch (err: any) {
      console.warn('[SecurityTab] history gagal:', err?.response?.status);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ===== Handlers =====
  const handleRevoke = async (id: string) => {
    if (!token) return;
    if (!confirm('Cabut sesi ini? Perangkat tersebut akan logout.')) return;
    try {
      await userApi.revokeSession(token, id);
      toast.success('Sesi dicabut');
      onSessionRevoked?.(id);
      // Optimistic update
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal mencabut sesi');
    }
  };

  const handleRevokeAll = async () => {
    if (!token) return;
    if (!confirm('Cabut semua sesi lain? Semua perangkat lain akan logout.')) return;
    try {
      await userApi.revokeAllOtherSessions(token);
      toast.success('Semua sesi lain dicabut');
      loadSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal');
    }
  };

  return (
    <div className="space-y-5">
      {/* ================= SESI AKTIF ================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <i className="fa-solid fa-desktop text-[#00c8ff]"></i> Sesi Aktif
            {!loadingSessions && sessions.length > 0 && (
              <span className="text-[9px] font-normal text-gray-400">
                ({sessions.length})
              </span>
            )}
          </h3>
          <button
            onClick={loadSessions}
            disabled={loadingSessions}
            className="text-[10px] text-[#00c8ff] hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <i
              className={`fa-solid fa-rotate ${
                loadingSessions ? 'animate-spin' : ''
              }`}
            ></i>
            Refresh
          </button>
        </div>

        {loadingSessions ? (
          <div className="flex items-center justify-center py-4 text-gray-400 text-[11px] gap-2">
            <i className="fa-solid fa-spinner animate-spin"></i> Memuat sesi…
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-3">
            Tidak ada sesi aktif
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-[#0f0f23] text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-700 dark:text-gray-200 truncate flex items-center gap-1.5">
                    <i className="fa-solid fa-laptop text-[10px] text-gray-400"></i>
                    <span className="truncate">{s.device || 'Unknown'}</span>
                    {s.current && (
                      <span className="text-[9px] text-emerald-500 font-normal shrink-0">
                        (ini)
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {s.ip} · {fmtDateTime(s.last_active)}
                  </p>
                </div>
                {!s.current && (
                  <button
                    onClick={() => handleRevoke(s.id)}
                    className="px-2 py-1 text-[10px] rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 ml-2 shrink-0"
                  >
                    Cabut
                  </button>
                )}
              </div>
            ))}
            {sessions.some((s) => !s.current) && (
              <button
                onClick={handleRevokeAll}
                className="w-full mt-1 py-1.5 text-[10px] rounded-md border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <i className="fa-solid fa-ban mr-1"></i> Cabut semua sesi lain
              </button>
            )}
          </div>
        )}
      </div>

      {/* ================= RIWAYAT LOGIN ================= */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-[#00c8ff]"></i>
            Riwayat Login
          </h3>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="text-[10px] text-[#00c8ff] hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <i
              className={`fa-solid fa-rotate ${
                loadingHistory ? 'animate-spin' : ''
              }`}
            ></i>
            Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-4 text-gray-400 text-[11px] gap-2">
            <i className="fa-solid fa-spinner animate-spin"></i> Memuat riwayat…
          </div>
        ) : history.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-3">
            Belum ada riwayat login
          </p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-start justify-between gap-2 p-2 rounded-lg bg-gray-50 dark:bg-[#0f0f23] text-[11px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-gray-700 dark:text-gray-200 truncate">
                    <i className="fa-solid fa-right-to-bracket text-[9px] text-emerald-500 mr-1"></i>
                    {h.device || 'Unknown'}
                  </p>
                  <p className="text-[9px] text-gray-400">
                    {h.ip} · {fmtDateTime(h.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= DANGER ZONE ================= */}
      <div className="pt-3 border-t border-gray-200 dark:border-[#2a2a4e]">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full py-2.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <i className="fa-solid fa-right-from-bracket mr-2"></i> Logout
        </button>
      </div>
    </div>
  );
}