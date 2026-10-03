'use client';
interface Props { profile: any; activity: any; }

export default function ActivityTab({ profile, activity }: Props) {
  const stats = activity?.stats || {};
  const recent = Array.isArray(activity?.recent) ? activity.recent : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon="fa-images"   label="Total Upload"  value={stats.total_media ?? 0}  color="#00c8ff" />
        <StatCard icon="fa-heart"    label="Total Like"    value={stats.total_likes ?? 0}  color="#ef4444" />
        <StatCard icon="fa-share"    label="Total Share"   value={stats.total_shares ?? 0} color="#10b981" />
        <StatCard
          icon="fa-calendar" label="Bergabung"
          value={profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
            : '-'}
          color="#8b5cf6"
        />
      </div>

      {recent.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 mt-4">Aktivitas Terbaru</h4>
          <div className="space-y-2">
            {recent.slice(0, 15).map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-[#0f0f23] text-xs">
                <div className="w-7 h-7 rounded-full bg-[#00c8ff]/10 text-[#00c8ff] flex items-center justify-center shrink-0">
                  <i className={`fa-solid ${a.icon || 'fa-circle'} text-[10px]`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 dark:text-gray-300 truncate">{a.text}</p>
                  <p className="text-[10px] text-gray-400">
                    {a.time ? new Date(a.time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-gray-50/50 dark:bg-[#0f0f23]">
      <div className="flex items-center gap-2" style={{ color }}>
        <i className={`fa-solid ${icon}`}></i>
        <span className="text-[10px] uppercase font-semibold">{label}</span>
      </div>
      <p className="text-xl font-bold text-[#1a1a2e] dark:text-white mt-2">{value}</p>
    </div>
  );
}