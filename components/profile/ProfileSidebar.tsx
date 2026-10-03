'use client';
import { SectionKey } from '@/lib/permissions';

const ITEMS: { key: SectionKey; label: string; icon: string; color: string }[] = [
  { key: 'info',     label: 'Profil',      icon: 'fa-user',           color: '#00c8ff' },
  { key: 'uploads',  label: 'Upload Saya', icon: 'fa-images',         color: '#a855f7' },
  { key: 'progress', label: 'Pekerjaan',   icon: 'fa-list-check',     color: '#10b981' },
  { key: 'finance',  label: 'Finansial',   icon: 'fa-wallet',         color: '#f59e0b' },
  { key: 'activity', label: 'Aktivitas',   icon: 'fa-clock-rotate-left', color: '#ec4899' },
  { key: 'security', label: 'Keamanan',    icon: 'fa-shield-halved',  color: '#ef4444' },
];

interface Props {
  active: SectionKey;
  onChange: (key: SectionKey) => void;
  allowed: SectionKey[];
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function ProfileSidebar({ active, onChange, allowed, mobileOpen, onMobileClose }: Props) {
  const items = ITEMS.filter(i => allowed.includes(i.key));

  const Nav = (
    <nav className="space-y-1">
      {items.map(item => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => { onChange(item.key); onMobileClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'bg-[#00c8ff]/10 text-[#00c8ff] border border-[#00c8ff]/30 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a1a2e] border border-transparent'
            }`}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: isActive ? `${item.color}20` : 'transparent',
                color: isActive ? item.color : undefined,
              }}
            >
              <i className={`fa-solid ${item.icon} text-sm`}></i>
            </span>
            <span className="truncate">{item.label}</span>
            {isActive && <i className="fa-solid fa-chevron-right text-[10px] ml-auto opacity-60"></i>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-24 self-start">
        <div className="bg-white dark:bg-[#0f0f23] rounded-2xl border border-gray-200 dark:border-[#2a2a4e] p-3">
          <p className="text-[10px] uppercase font-semibold text-gray-400 px-3 py-2">Menu</p>
          {Nav}
        </div>
      </aside>

      {/* Mobile: drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[2000]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onMobileClose} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-[#0f0f23] shadow-2xl p-4 overflow-y-auto animate-[slideInLeft_0.25s_ease]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#1a1a2e] dark:text-white">Menu</p>
              <button
                onClick={onMobileClose}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a1a2e] flex items-center justify-center text-gray-500"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            {Nav}
          </div>
        </div>
      )}
    </>
  );
}