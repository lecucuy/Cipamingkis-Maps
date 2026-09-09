// components/NotificationBell.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { showNotification } from './Notification';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  related_id?: string;
  action_url?: string;
  sender_id?: string;
  read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Fetch notifications
const fetchNotifications = async () => {
  try {
    const res = await axios.get(`${API_URL}/notifications`, {
      headers: {
        Authorization: `Bearer ${session?.accessToken}` // sesuaikan dengan cara Anda menyimpan token
      }
    });
    setNotifications(res.data.notifications);
  } catch (err) {
    console.error('Gagal load notifikasi', err);
    // Tampilkan error ke user jika perlu
  }
};

  // Fetch unread count secara periodik
  const fetchUnreadCount = async () => {
    if (!session) return;
    try {
      const res = await axios.get(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      setUnreadCount(res.data.unread_count);
    } catch (err) {
      console.error('Gagal load unread count', err);
    }
  };

  useEffect(() => {
    if (session) {
      fetchNotifications();
      // Polling setiap 30 detik
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Mark as read
  const markAsRead = async (notificationId: string) => {
    if (!session) return;
    try {
      await axios.post(`${API_URL}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Gagal mark as read', err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!session) return;
    try {
      await axios.post(`${API_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      showNotification('Semua notifikasi telah dibaca', 'success');
    } catch (err) {
      console.error('Gagal mark all as read', err);
    }
  };

  // Handle klik di luar dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(); // refresh saat buka
        }}
        className="relative w-9 h-9 rounded-full bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2a2a4e] transition"
      >
        <i className="fa-regular fa-bell text-gray-600 dark:text-gray-300"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl border border-gray-200 dark:border-[#2a2a4e] overflow-hidden z-[1002]">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#2a2a4e]">
            <h4 className="font-semibold text-sm text-[#1a1a2e] dark:text-white">Notifikasi</h4>
            {notifications.some(n => !n.read) && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-[#00c8ff] hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                <i className="fa-regular fa-bell-slash text-2xl block mb-2"></i>
                Tidak ada notifikasi
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`p-3 border-b border-gray-100 dark:border-[#2a2a4e] hover:bg-gray-50 dark:hover:bg-[#2a2a4e] transition cursor-pointer ${
                    !notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => {
                    if (!notif.read) markAsRead(notif._id);
                    if (notif.action_url) {
                      window.location.href = notif.action_url;
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {notif.type === 'success' && <i className="fa-regular fa-circle-check text-green-500"></i>}
                      {notif.type === 'error' && <i className="fa-regular fa-circle-xmark text-red-500"></i>}
                      {notif.type === 'warning' && <i className="fa-regular fa-triangle-exclamation text-yellow-500"></i>}
                      {notif.type === 'info' && <i className="fa-regular fa-circle-info text-blue-500"></i>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1a1a2e] dark:text-white truncate">{notif.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}