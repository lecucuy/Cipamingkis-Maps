'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { userApi } from '@/lib/api/user';
import { getPermissions, normalizeRole, visibleSections, SectionKey } from '@/lib/permissions';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileSidebar from '@/components/profile/ProfileSidebar';
import InfoTab from '@/components/profile/tabs/InfoTab';
import UploadsTab from '@/components/profile/tabs/UploadsTab';
import ProgressTab from '@/components/profile/tabs/ProgressTab';
import FinanceTab from '@/components/profile/tabs/FinanceTab';
import ActivityTab from '@/components/profile/tabs/ActivityTab';
import SecurityTab from '@/components/profile/tabs/SecurityTab';
import LiveTab from '@/components/profile/tabs/LiveTab';   // 🔥 TAMBAH


export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const token = (session as any)?.accessToken as string | undefined;
  const role = session?.user?.role as string | undefined;

  const [tab, setTab] = useState<SectionKey>('info');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowed = visibleSections(role);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [me, act] = await Promise.all([
        userApi.me(token),
        userApi.activity(token).catch(() => null),
      ]);
      setProfile(me);
      setActivity(act);
      setFullName(me.full_name || me.name || '');
      setPhone(me.phone || '');
      setAvatarPreview(me.avatar_url || null);
    } catch {
      const u: any = session?.user;
      setProfile({
        email: u?.email, name: u?.name || u?.email?.split('@')[0],
        full_name: u?.name, role: u?.role, polygon: u?.polygon,
        avatar_url: u?.image || null,
      });
      setFullName(u?.name || '');
    } finally { setLoading(false); }
  }, [token, session]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      const r = await userApi.sessions(token);
      setSessions(r.items || []);
    } catch { setSessions([]); }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'security') loadSessions(); }, [tab, loadSessions]);
  useEffect(() => { if (!allowed.includes(tab)) setTab('info'); }, [allowed, tab]);

  const handleAvatar = (f: File) => {
    setAvatarFile(f);
    const r = new FileReader();
    r.onloadend = () => setAvatarPreview(r.result as string);
    r.readAsDataURL(f);
  };

  const handleSaveInfo = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await userApi.updateMe(token, { full_name: fullName, phone, avatar: avatarFile });
      setProfile((p: any) => ({ ...p, ...updated }));
      setAvatarFile(null);
      await updateSession?.();
      toast.success('✅ Profil tersimpan');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal');
    } finally { setSaving(false); }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a1a]">
        <div className="text-center">
          <i className="fa-solid fa-lock text-4xl text-gray-400 mb-3"></i>
          <p className="text-gray-500 mb-4">Silakan login</p>
          <button onClick={() => router.push('/')} className="px-5 py-2 bg-[#00c8ff] text-white rounded-xl font-medium">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const roleLabel = normalizeRole(role);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a1a] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#0f0f23]/90 backdrop-blur-xl border-b border-gray-200 dark:border-[#2a2a4e]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMobileSidebar(true)}
            className="lg:hidden w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] flex items-center justify-center text-gray-600 dark:text-gray-300"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
          {/* Back (desktop) */}
          <button
            onClick={() => router.back()}
            className="hidden lg:flex w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] items-center justify-center text-gray-600 dark:text-gray-300"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h1 className="text-base font-semibold text-[#1a1a2e] dark:text-white flex-1">Profil Saya</h1>
        </div>
      </div>

      {/* Layout: sidebar + content */}
      <div className="max-w-6xl mx-auto px-4 py-5 flex gap-6">
        <ProfileSidebar
          active={tab}
          onChange={setTab}
          allowed={allowed}
          mobileOpen={mobileSidebar}
          onMobileClose={() => setMobileSidebar(false)}
        />

        <main className="flex-1 min-w-0 space-y-4">
          {/* Header card */}
          {profile && (
            <ProfileHeader
              profile={profile}
              role={roleLabel}
              avatarPreview={avatarPreview}
              onAvatarChange={handleAvatar}
            />
          )}

          {/* Content card */}
          <div className="bg-white dark:bg-[#0f0f23] rounded-2xl border border-gray-200 dark:border-[#2a2a4e] overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="p-5">
                {tab === 'info' && (
                  <InfoTab
                    fullName={fullName}
                    phone={phone}
                    profile={profile}
                    saving={saving}
                    onChange={(p) => {
                      if (p.fullName !== undefined) setFullName(p.fullName);
                      if (p.phone !== undefined) setPhone(p.phone);
                    }}
                    onSave={handleSaveInfo}
                  />
                )}
                {tab === 'uploads'  && <UploadsTab />}
                {tab === 'progress' && <ProgressTab role={role} />}
                {tab === 'finance'  && <FinanceTab role={role} />}
                {tab === 'activity' && <ActivityTab profile={profile} activity={activity} />}
                {tab === 'security' && (
                  <SecurityTab
                    sessions={sessions}
                    onSessionRevoked={(id) => setSessions(p => p.filter(x => x.id !== id))}
                  />
                )}

              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}