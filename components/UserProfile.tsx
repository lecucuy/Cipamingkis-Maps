'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface UserProfileProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'info' | 'stats' | 'security';

export default function UserProfile({ open, onClose }: UserProfileProps) {
  const { data: session, update: updateSession } = useSession();
  const [tab, setTab] = useState<Tab>('info');

  // ===== LOAD PROFILE DARI API =====
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ===== FORM STATE =====
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== PASSWORD =====
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const token = (session as any)?.accessToken;

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const p = res.data;
      setProfile(p);
      setFullName(p.full_name || p.name || '');
      setPhone(p.phone || '');
      setAvatarPreview(p.avatar_url || null);
    } catch (err: any) {
      // Fallback ke session kalau API belum ada
      const u: any = session?.user;
      setProfile({
        email: u?.email,
        name: u?.name || u?.email?.split('@')[0],
        full_name: u?.name,
        role: u?.role,
        polygon: u?.polygon,
        avatar_url: u?.image || null,
      });
      setFullName(u?.name || '');
    } finally {
      setLoading(false);
    }
  }, [token, session]);

  useEffect(() => {
    if (open) loadProfile();
  }, [open, loadProfile]);

  // ===== ESC TO CLOSE =====
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = orig;
    };
  }, [open, saving, onClose]);

  // ===== AVATAR =====
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Avatar maksimal 5MB');
      return;
    }
    if (!f.type.startsWith('image/')) {
      toast.error('File harus gambar');
      return;
    }
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  // ===== SAVE INFO =====
  const handleSaveInfo = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('full_name', fullName);
      formData.append('phone', phone);
      if (avatarFile) formData.append('avatar', avatarFile);

      const res = await axios.put(`${API_URL}/users/me`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setProfile((p: any) => ({ ...p, ...res.data }));
      setAvatarFile(null);
      toast.success('✅ Profil berhasil diperbarui');

      // Refresh session supaya nama/avatar baru langsung kepakai
      await updateSession?.();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '❌ Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  // ===== CHANGE PASSWORD =====
  const handleChangePassword = async () => {
    if (!token) return;
    if (newPass.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Konfirmasi password tidak sama');
      return;
    }
    setChangingPass(true);
    try {
      await axios.put(
        `${API_URL}/users/me/password`,
        { old_password: oldPass, new_password: newPass },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('✅ Password berhasil diubah');
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '❌ Gagal mengubah password');
    } finally {
      setChangingPass(false);
    }
  };

  if (!open) return null;

  const role = (profile?.role || session?.user?.role || 'user') as string;
  const roleColor: Record<string, string> = {
    admin: 'bg-red-500/15 text-red-500 border-red-500/30',
    supervisor: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
    tpop: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
    pob: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
    juru: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    reporter: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  };
  const roleClass = roleColor[role.toLowerCase()] || 'bg-gray-500/15 text-gray-500 border-gray-500/30';
  const initial = (profile?.full_name || profile?.name || profile?.email || 'U')
    .charAt(0)
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white dark:bg-[#1a1a2e] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-[#2a2a4e] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== HEADER ===== */}
        <div className="relative bg-gradient-to-br from-[#00c8ff] to-blue-600 px-5 pt-5 pb-14 text-white shrink-0">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            title="Tutup"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
          <div className="text-xs opacity-80">Profil Saya</div>
        </div>

        {/* ===== AVATAR ===== */}
        <div className="px-5 -mt-12 relative shrink-0">
          <div className="flex items-end gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-white dark:bg-[#0f0f23] shadow-xl border-4 border-white dark:border-[#1a1a2e] flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-[#00c8ff]">{initial}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#00c8ff] text-white flex items-center justify-center shadow-lg hover:bg-[#00c8ff]/90 transition"
                title="Ganti foto"
              >
                <i className="fa-solid fa-camera text-xs"></i>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="pb-1 min-w-0">
              <h3 className="text-base font-semibold text-[#1a1a2e] dark:text-white truncate">
                {profile?.full_name || profile?.name || 'User'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {profile?.email}
              </p>
              <span
                className={`inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${roleClass}`}
              >
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* ===== TABS ===== */}
        <div className="flex gap-1 px-3 mt-4 border-b border-gray-200 dark:border-[#2a2a4e] shrink-0">
          {[
            { key: 'info', label: 'Info', icon: 'fa-user' },
            { key: 'stats', label: 'Statistik', icon: 'fa-chart-simple' },
            { key: 'security', label: 'Keamanan', icon: 'fa-lock' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as Tab)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition flex items-center justify-center gap-1.5 border-b-2 ${
                tab === t.key
                  ? 'text-[#00c8ff] border-[#00c8ff]'
                  : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <i className={`fa-solid ${t.icon}`}></i>
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== CONTENT ===== */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : tab === 'info' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama lengkap"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-gray-50 dark:bg-[#0f0f23]/50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-[10px] text-gray-400 mt-1">Email tidak bisa diubah</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  No. HP
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xx-xxxx-xxxx"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                />
              </div>

              {profile?.polygon?.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                    <i className="fa-solid fa-draw-polygon"></i>
                    Wilayah Kerja
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">
                    Anda memiliki polygon wilayah kerja dengan {profile.polygon.length} titik.
                  </p>
                </div>
              )}
            </>
          ) : tab === 'stats' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-gradient-to-br from-[#00c8ff]/10 to-blue-500/10 border border-[#00c8ff]/20">
                  <div className="flex items-center gap-2 text-[#00c8ff]">
                    <i className="fa-solid fa-images"></i>
                    <span className="text-[10px] uppercase font-semibold">Total Upload</span>
                  </div>
                  <p className="text-2xl font-bold text-[#1a1a2e] dark:text-white mt-2">
                    {profile?.stats?.total_media ?? 0}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-500">
                    <i className="fa-solid fa-heart"></i>
                    <span className="text-[10px] uppercase font-semibold">Total Like</span>
                  </div>
                  <p className="text-2xl font-bold text-[#1a1a2e] dark:text-white mt-2">
                    {profile?.stats?.total_likes ?? 0}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-500">
                    <i className="fa-solid fa-share"></i>
                    <span className="text-[10px] uppercase font-semibold">Total Share</span>
                  </div>
                  <p className="text-2xl font-bold text-[#1a1a2e] dark:text-white mt-2">
                    {profile?.stats?.total_shares ?? 0}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-purple-500">
                    <i className="fa-solid fa-calendar"></i>
                    <span className="text-[10px] uppercase font-semibold">Bergabung</span>
                  </div>
                  <p className="text-sm font-bold text-[#1a1a2e] dark:text-white mt-2">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#0f0f23] border border-gray-200 dark:border-[#2a2a4e]">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <i className="fa-solid fa-circle-info"></i>
                  Statistik dihitung otomatis dari aktivitas Anda.
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Password Lama
                </label>
                <input
                  type="password"
                  value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                />
              </div>
            </>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        <div className="p-4 border-t border-gray-200 dark:border-[#2a2a4e] flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || changingPass}
            className="flex-1 py-2 text-xs rounded-lg border border-gray-300 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a4e] disabled:opacity-50"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={saving || changingPass || loading}
            onClick={tab === 'security' ? handleChangePassword : handleSaveInfo}
            className="flex-1 py-2 text-xs rounded-lg bg-[#00c8ff] text-white font-medium hover:bg-[#00c8ff]/90 disabled:opacity-50"
          >
            {saving || changingPass ? (
              <span>Menyimpan...</span>
            ) : tab === 'security' ? (
              <span>🔒 Ubah Password</span>
            ) : (
              <span>💾 Simpan</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}