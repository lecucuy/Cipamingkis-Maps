'use client';
interface Props {
  fullName: string;
  phone: string;
  profile: any;
  saving: boolean;
  onChange: (p: { fullName?: string; phone?: string }) => void;
  onSave: () => void;
}

export default function InfoTab({ fullName, phone, profile, saving, onChange, onSave }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nama Lengkap</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label>
        <input
          type="email" value={profile?.email || ''} disabled
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-gray-50 dark:bg-[#0f0f23]/50 text-gray-500 cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">No. HP</label>
        <input
          type="tel" value={phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="08xx-xxxx-xxxx"
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
        />
      </div>

      {profile?.polygon?.length > 0 && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
            <i className="fa-solid fa-draw-polygon"></i> Wilayah Kerja
          </div>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">
            {profile.polygon.length} titik polygon
          </p>
        </div>
      )}

      <button
        onClick={onSave} disabled={saving}
        className="w-full py-2.5 rounded-lg bg-[#00c8ff] text-white font-medium text-sm hover:bg-[#00c8ff]/90 disabled:opacity-50"
      >
        {saving ? 'Menyimpan...' : '💾 Simpan'}
      </button>
    </div>
  );
}