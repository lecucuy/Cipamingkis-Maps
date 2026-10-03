'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { progressApi, ProgressTask, ProgressStatus } from '@/lib/api/progress';
import { getPermissions } from '@/lib/permissions';

const STATUS_META: Record<ProgressStatus, { label: string; color: string; icon: string }> = {
  planned: { label: 'Direncanakan', color: '#64748b', icon: 'fa-calendar' },
  ongoing: { label: 'Berjalan',     color: '#00c8ff', icon: 'fa-spinner' },
  done:    { label: 'Selesai',      color: '#10b981', icon: 'fa-check' },
  blocked: { label: 'Terhambat',    color: '#ef4444', icon: 'fa-triangle-exclamation' },
};

const fmtIDR = (n?: number) =>
  n != null ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n) : '-';

export default function ProgressTab({ role }: { role?: string | null }) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const perms = getPermissions(role);

  const [items, setItems] = useState<ProgressTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ProgressStatus | 'all'>('all');
  const [editing, setEditing] = useState<ProgressTask | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await progressApi.list(token, filter === 'all' ? {} : { status: filter });
      setItems(r.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { load(); }, [load]);

  if (!perms.progress) {
    return (
      <div className="text-center py-10 text-gray-400">
        <i className="fa-solid fa-lock text-3xl mb-2 block"></i>
        <p className="text-sm">Tidak ada akses ke pekerjaan</p>
      </div>
    );
  }

  const handleQuickUpdate = async (task: ProgressTask, progress: number) => {
    if (!token) return;
    try {
      await progressApi.update(token, task.id, { progress });
      setItems(p => p.map(x => x.id === task.id ? { ...x, progress } : x));
      toast.success(`Progress: ${progress}%`);
    } catch { toast.error('Gagal update'); }
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[#0f0f23] rounded-lg p-1 overflow-x-auto">
        {(['all', 'planned', 'ongoing', 'done', 'blocked'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 min-w-fit px-3 py-1.5 text-xs rounded-md font-medium transition whitespace-nowrap ${
              filter === f
                ? 'bg-white dark:bg-[#1a1a2e] text-[#00c8ff] shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {f === 'all' ? 'Semua' : STATUS_META[f as ProgressStatus].label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <i className="fa-solid fa-clipboard-list text-3xl mb-2 block"></i>
          <p className="text-sm">Belum ada pekerjaan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(task => {
            const meta = STATUS_META[task.status];
            return (
              <div key={task.id} className="p-4 rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23]">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${meta.color}20`, color: meta.color }}
                  >
                    <i className={`fa-solid ${meta.icon} text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#1a1a2e] dark:text-white">
                        {task.title}
                      </h4>
                      <span
                        className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: `${meta.color}20`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                    )}

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-gray-500">
                      {task.building_name && (
                        <span className="flex items-center gap-1">
                          <i className="fa-solid fa-location-dot"></i> {task.building_name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <i className="fa-regular fa-calendar"></i>
                          {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {task.budget != null && (
                        <span className="flex items-center gap-1 font-mono">
                          <i className="fa-solid fa-coins"></i> {fmtIDR(task.budget)}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-mono font-bold" style={{ color: meta.color }}>{task.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{ width: `${task.progress}%`, background: meta.color }}
                        />
                      </div>
                    </div>

                    {/* Quick actions (kalau punya permission update) */}
                    {(perms.progress === 'update' || perms.progress === 'full') && (
                      <div className="flex gap-1.5 mt-3">
                        {[25, 50, 75, 100].map(pct => (
                          <button
                            key={pct}
                            onClick={() => handleQuickUpdate(task, pct)}
                            className="flex-1 py-1 text-[10px] rounded-md border border-gray-200 dark:border-[#2a2a4e] hover:border-[#00c8ff] hover:text-[#00c8ff] transition"
                          >
                            {pct}%
                          </button>
                        ))}
                        <button
                          onClick={() => setEditing(task)}
                          className="px-3 py-1 text-[10px] rounded-md bg-[#00c8ff] text-white hover:bg-[#00c8ff]/90"
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}