'use client';
import { useRef } from 'react';
import { ROLE_META, Role } from '@/lib/permissions';

interface Props {
  profile: any;
  role: string;
  avatarPreview: string | null;
  onAvatarChange: (f: File) => void;
}

export default function ProfileHeader({ profile, role, avatarPreview, onAvatarChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const roleMeta = ROLE_META[role as Role] || { label: role, color: '#00c8ff', icon: 'fa-user' };
  const initial = (profile?.full_name || profile?.name || 'U').charAt(0).toUpperCase();
  const displayName = profile?.full_name || profile?.name || 'User';

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('id-ID', {
        month: 'long', year: 'numeric',
      })
    : null;

  const polygonCount = Array.isArray(profile?.polygon) ? profile.polygon.length : 0;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] shadow-sm">
      {/* Gradient hero */}
      <div
        className="h-24 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${roleMeta.color}40 0%, ${roleMeta.color}10 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, ${roleMeta.color}40 0%, transparent 50%), radial-gradient(circle at 80% 30%, ${roleMeta.color}30 0%, transparent 40%)`,
          }}
        />
      </div>

      {/* Body */}
      <div className="px-5 pb-5 -mt-12">
        <div className="flex items-end gap-4">
          {/* Avatar */}
          <div className="relative group">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-[#0f0f23] shadow-lg overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${roleMeta.color}, ${roleMeta.color}cc)` }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-[#1a1a2e] border-2 border-white dark:border-[#0f0f23] shadow-md flex items-center justify-center text-[#00c8ff] hover:scale-110 transition"
              title="Ganti foto"
            >
              <i className="fa-solid fa-camera text-xs"></i>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAvatarChange(f);
              }}
            />
          </div>

          {/* Name + Role */}
          <div className="flex-1 min-w-0 pb-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#1a1a2e] dark:text-white truncate">
              {displayName}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold"
                style={{
                  background: `${roleMeta.color}15`,
                  color: roleMeta.color,
                  border: `1px solid ${roleMeta.color}30`,
                }}
              >
                <i className={`fa-solid ${roleMeta.icon} text-[9px]`}></i>
                {roleMeta.label}
              </span>
              {polygonCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold border border-emerald-500/20">
                  <i className="fa-solid fa-draw-polygon text-[9px]"></i>
                  {polygonCount} titik wilayah
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row — tanpa email/phone */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-[#2a2a4e]/60">
          {joined && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-[#1a1a2e]">
              <i className="fa-solid fa-calendar-check text-sm text-[#00c8ff]"></i>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 uppercase font-semibold">Bergabung</p>
                <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">
                  {joined}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-[#1a1a2e]">
            <i className="fa-solid fa-circle-check text-sm text-emerald-500"></i>
            <div className="min-w-0">
              <p className="text-[9px] text-gray-400 uppercase font-semibold">Status</p>
              <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Aktif</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-[#1a1a2e]">
            <i className="fa-solid fa-shield-halved text-sm text-purple-500"></i>
            <div className="min-w-0">
              <p className="text-[9px] text-gray-400 uppercase font-semibold">Keamanan</p>
              <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Terverifikasi</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}