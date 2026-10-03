'use client';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { userApi } from '@/lib/api/user';

interface Props {
  sessions: any[];
  onSessionRevoked: (id: string) => void;
}

export default function SecurityTab({ sessions, onSessionRevoked }: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changing, setChanging] = useState(false);

  const handleChange = async () => {
    if (!token) return;
    if (newPass.length < 8) return toast.error('Min 8 karakter');
    if (!/[A-Z]/.test(newPass) || !/[0-9]/.test(newPass))
      return toast.error('Butuh huruf besar & angka');
    if (newPass !== confirmPass) return toast.error('Konfirmasi tidak sama');
    setChanging(true);
    try {
      await userApi.changePassword(token, oldPass, newPass);
      toast.success('Password diubah. Login ulang.');
      setOldPass(''); setNewPass(''); setConfirmPass('');
      setTimeout(() => signOut({ callbackUrl: '/login' }), 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal');
    } finally { setChanging(false); }
  };

  const handleRevoke = async (id: string) => {
    if (!token) return;
    try {
      await userApi.revokeSession(token, id);
      onSessionRevoked(id);
      toast.success('Sesi dicabut');
    } catch { toast.error('Gagal'); }
  };

  return (
    <div className="space-y-5">
      {/* Password */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <i className="fa-solid fa-key text-[#00c8ff]"></i> Ubah Password
        </h3>
        <input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder="Password lama"
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]" />
        <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password baru (min 8, huruf besar + angka)"
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]" />
        <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Konfirmasi"
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]" />
        <button onClick={handleChange} disabled={changing}
          className="w-full py-2.5 rounded-lg bg-[#00c8ff] text-white font-medium text-sm hover:bg-[#00c8ff]/90 disabled:opacity-50">
          {changing ? 'Mengubah...' : '🔒 Ubah Password'}
        </button>
      </div>

      {/* Sessions */}
      <div>
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2 mb-2">
          <i className="fa-solid fa-desktop text-[#00c8ff]"></i> Sesi Aktif
        </h3>
        {sessions.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-3">Tidak ada data sesi</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-[#0f0f23] text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-700 dark:text-gray-200 truncate">
                    {s.device || 'Unknown'}
                    {s.current && <span className="text-[9px] text-emerald-500 ml-1">(ini)</span>}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {s.ip} · {s.last_active ? new Date(s.last_active).toLocaleString('id-ID') : '-'}
                  </p>
                </div>
                {!s.current && (
                  <button onClick={() => handleRevoke(s.id)}
                    className="px-2 py-1 text-[10px] rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20">
                    Cabut
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
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