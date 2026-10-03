'use client';
import { useRef } from 'react';
import { toast } from 'react-hot-toast';

interface Props {
  profile: any;
  role: string;
  avatarPreview: string | null;
  onAvatarChange: (file: File) => void;
}

export default function ProfileHeader({ profile, role, avatarPreview, onAvatarChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const initial = (profile?.full_name || profile?.name || profile?.email || 'U').charAt(0).toUpperCase();

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error('Maks 5MB');
    if (!f.type.startsWith('image/')) return toast.error('Harus gambar');
    onAvatarChange(f);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23]">
      <div className="h-24 bg-gradient-to-br from-[#00c8ff] to-blue-600" />
      <div className="px-5 -mt-12 pb-5">
        <div className="flex items-end gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-[#0f0f23] border-4 border-white dark:border-[#0f0f23] shadow-lg flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-[#00c8ff]">{initial}</span>
              )}
            </div>
            <button
              onClick={() => ref.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#00c8ff] text-white flex items-center justify-center shadow-lg hover:bg-[#00c8ff]/90"
            >
              <i className="fa-solid fa-camera text-xs"></i>
            </button>
            <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" />
          </div>
          <div className="pb-1 min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[#1a1a2e] dark:text-white truncate">
              {profile?.full_name || profile?.name || 'User'}
            </h2>
            <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
            <span className="inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#00c8ff]/15 text-[#00c8ff] border border-[#00c8ff]/30">
              {role}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}