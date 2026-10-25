'use client';
import { ROLE_META, Role } from '@/lib/permissions';

interface Props {
  fullName: string;
  phone: string;
  profile: any;
  saving: boolean;
  onChange: (p: { fullName?: string; phone?: string }) => void;
  onSave: () => void;
}

function maskEmail(email?: string) {
  if (!email) return '—';
  const [user, domain] = email.split('@');
  if (!domain || !user) return email;
  const masked = user.length <= 2
    ? '*'.repeat(user.length)
    : user.charAt(0) + '*'.repeat(Math.min(user.length - 2, 4)) + user.charAt(user.length - 1);
  return `${masked}@${domain}`;
}

function maskPhone(phone?: string) {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

export default function InfoTab({ fullName, phone, profile, saving, onChange, onSave }: Props) {
  const roleMeta = ROLE_META[(profile?.role || 'user') as Role] || {
    label: 'User', color: '#00c8ff', icon: 'fa-user',
  };

  return (
    <div className="space-y-4">
      {/* Full Name */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
          <i className="fa-solid fa-user mr-1 text-[#00c8ff]"></i>
          Nama Lengkap
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0a0a1a] text-[#1a1a2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00c8ff]/30 focus:border-[#00c8ff] transition"
          placeholder="Nama lengkap Anda"
        />
      </div>

      {/* Email (masked, readonly) */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
          <i className="fa-solid fa-envelope mr-1 text-[#a855f7]"></i>
          Email
          <span className="ml-1 text-[9px] text-gray-400 normal-case font-normal">
            (tidak dapat diubah)
          </span>
        </label>
        <div className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-gray-50 dark:bg-[#1a1a2e] text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
          <i className="fa-solid fa-lock text-[10px] opacity-60"></i>
          {maskEmail(profile?.email)}
        </div>
      </div>

      {/* Phone (editable, masked preview) */}

      {/* Role (readonly) */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
          <i className="fa-solid fa-user-tag mr-1 text-[#f59e0b]"></i>
          Role
        </label>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: `${roleMeta.color}15`,
            color: roleMeta.color,
            border: `1px solid ${roleMeta.color}30`,
          }}
        >
          <i className={`fa-solid ${roleMeta.icon} text-[10px]`}></i>
          {roleMeta.label}
        </div>
      </div>

      {/* Save */}
      <div className="pt-3 border-t border-gray-100 dark:border-[#2a2a4e]/60">
        <button
          onClick={onSave}
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#00c8ff] to-[#0099ff] text-white text-sm font-semibold shadow-lg shadow-[#00c8ff]/30 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i>
              Menyimpan...
            </>
          ) : (
            <>
              <i className="fa-solid fa-check"></i>
              Simpan Perubahan
            </>
          )}
        </button>
      </div>
    </div>
  );
}