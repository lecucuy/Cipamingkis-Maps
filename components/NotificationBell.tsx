// components/NotificationBell.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

// ============ TYPES ============
export interface Notification {
  id: string;
  title: string;
  message?: string;
  body?: string;
  description?: string;
  created_at?: string;
  timestamp?: string;
  read?: boolean;
  is_read?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  action_url?: string;
  [key: string]: any;
}

// ============ HELPERS ============
function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000); // detik

    if (diff < 60) return 'baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getNotificationIcon(type?: string): { icon: string; color: string; bg: string } {
  switch (type) {
    case 'success':
      return { icon: 'fa-circle-check', color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
    case 'warning':
      return { icon: 'fa-triangle-exclamation', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
    case 'error':
      return { icon: 'fa-circle-xmark', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
    default:
      return { icon: 'fa-circle-info', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
  }
}

// ============ COMPONENT ============
export default function NotificationBell() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const unreadCount = notifications.filter((n) => !(n.read ?? n.is_read)).length;

  // ===== FETCH NOTIFICATIONS =====
  const fetchNotifications = useCallback(async () => {
    if (!session?.accessToken || !API_URL) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        params: { limit: 20 },
      });
      // Backend bisa return: array langsung, atau { items: [] }, atau { data: [] }
      const items: Notification[] =
        Array.isArray(res.data) ? res.data :
        res.data?.items ?? res.data?.data ?? [];
      setNotifications(items);
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.warn('[NotificationBell] fetch error:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, API_URL]);

  // ===== INITIAL + POLLING =====
  useEffect(() => {
    if (!session?.accessToken) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000); // polling 30s
    return () => clearInterval(interval);
  }, [session?.accessToken, fetchNotifications]);

  // ===== CLOSE ON ESC / OUTSIDE CLICK =====
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // ===== MARK AS READ (per item) =====
  const markAsRead = useCallback(async (n: Notification) => {
    if (!session?.accessToken || !API_URL) return;
    if (n.read ?? n.is_read) return; // sudah dibaca
    try {
      await axios.post(
        `${API_URL}/notifications/${n.id}/read`,
        {},
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      );
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read: true, is_read: true } : x
        )
      );
    } catch (e) {
      console.warn('[NotificationBell] mark as read failed');
    }
  }, [session?.accessToken, API_URL]);

  // ===== MARK ALL AS READ =====
  const markAllAsRead = useCallback(async () => {
    if (!session?.accessToken || !API_URL || unreadCount === 0) return;
    try {
      setMarkingAll(true);
      await axios.post(
        `${API_URL}/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      );
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true, is_read: true })));
      toast.success('Semua notifikasi ditandai sudah dibaca');
    } catch (e) {
      toast.error('Gagal menandai notifikasi');
    } finally {
      setMarkingAll(false);
    }
  }, [session?.accessToken, API_URL, unreadCount]);

  // ===== HANDLE CLICK ON NOTIFICATION =====
  const handleNotificationClick = (n: Notification) => {
    markAsRead(n);
    const link = n.link || n.action_url;
    if (link) {
      // Bisa URL eksternal atau path internal
      if (/^https?:\/\//.test(link)) {
        window.open(link, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = link;
      }
      setOpen(false);
    }
  };

  // ===== RENDER =====
  return (
    <div ref={wrapperRef} className="relative">
      {/* 🔔 TOMBOL BELL */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition
          ${open
            ? 'bg-gray-200 dark:bg-[#2a2a4e] text-[#00c8ff]'
            : 'bg-gray-200 dark:bg-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#3a3a5e]'
          }`}
        aria-label="Notifikasi"
        title="Notifikasi"
      >
        <i className={`fa-solid ${unreadCount > 0 ? 'fa-bell' : 'fa-bell'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 🔥 MODAL/DROPDOWN RESPONSIVE */}
      {open && (
        <>
          {/* Backdrop untuk mobile — tap untuk tutup */}
          <div
            className="fixed inset-0 z-[9990] bg-black/40 sm:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div
            className="
              fixed left-2 right-2 top-16 z-[9991]
              max-h-[70vh] overflow-hidden
              sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2
              sm:w-[360px] sm:max-h-[480px]
              rounded-xl shadow-2xl
              bg-white dark:bg-[#1a1a2e]
              border border-gray-200 dark:border-[#2a2a4e]
              flex flex-col
            "
            role="dialog"
            aria-label="Panel Notifikasi"
          >
            {/* Header — fixed */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-[#2a2a4e] flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                  Notifikasi
                </h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={markingAll}
                    className="text-[10px] font-medium text-[#00c8ff] hover:text-[#00c8ff]/80 px-1.5 py-1 rounded disabled:opacity-50"
                    title="Tandai semua sudah dibaca"
                  >
                    {markingAll ? 'Memproses...' : 'Baca semua'}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a4e] flex items-center justify-center text-gray-500 dark:text-gray-400"
                  aria-label="Tutup"
                >
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading && notifications.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="text-4xl mb-2 opacity-40">🔔</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada notifikasi
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-[#2a2a4e]">
                  {notifications.map((n) => {
                    const isRead = n.read ?? n.is_read;
                    const meta = getNotificationIcon(n.type);
                    const messageText = n.message || n.body || n.description || '';
                    const timeText = formatRelativeTime(n.created_at || n.timestamp);

                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => handleNotificationClick(n)}
                          className={`w-full text-left p-3 transition flex items-start gap-2.5
                            ${isRead
                              ? 'bg-transparent hover:bg-gray-50 dark:hover:bg-[#22223e]'
                              : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            }`}
                        >
                          {/* Icon */}
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: meta.bg }}
                          >
                            <i
                              className={`fa-solid ${meta.icon} text-sm`}
                              style={{ color: meta.color }}
                            />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-[13px] leading-snug break-words ${
                                isRead
                                  ? 'text-gray-700 dark:text-gray-300'
                                  : 'text-gray-900 dark:text-white font-semibold'
                              }`}>
                                {n.title}
                              </p>
                              {!isRead && (
                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                              )}
                            </div>
                            {messageText && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 break-words">
                                {messageText}
                              </p>
                            )}
                            {timeText && (
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                {timeText}
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer — optional */}
            {notifications.length > 0 && (
              <div className="flex-shrink-0 border-t border-gray-200 dark:border-[#2a2a4e] px-3 py-2 text-center">
                <button
                  onClick={() => {
                    setOpen(false);
                    window.location.href = '/notifications';
                  }}
                  className="text-[11px] font-medium text-[#00c8ff] hover:underline"
                >
                  Lihat semua notifikasi →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}