'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { profileApi } from '@/lib/api/profile';
import { getPermissions } from '@/lib/permissions';

export default function ProgressPanel({ role }: { role?: string | null }) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const perms = getPermissions(role);

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await profileApi.progressList(token);
      setTasks(r.items || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (!perms.progress) {
    return (
      <div className="p-8 text-center text-gray-400">
        <i className="fa-solid fa-lock text-3xl mb-2 block"></i>
        <p className="text-sm">Anda tidak memiliki akses ke tracking pekerjaan.</p>
      </div>
    );
  }

  const statusColor = (s: string) => ({
    planned:   'bg-gray-500/15 text-gray-600 border-gray-500/30',
    ongoing:   'bg-blue-500/15 text-blue-600 border-blue-500/30',
    done:      'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    blocked:   'bg-red-500/15 text-red-600 border-red-500/30',
  }[s] || 'bg-gray-500/15 text-gray-500 border-gray-500/30');

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-xs">
          <i className="fa-solid fa-clipboard-list text-2xl block mb-2"></i>
          Belum ada pekerjaan
        </div>
      ) : (
        tasks.map((task) => (
          <div
            key={task.id}
            className="p-4 rounded-xl bg-white dark:bg-[#0f0f23] border border-gray-200 dark:border-[#2a2a4e]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${statusColor(task.status)}`}>
                    {task.status}
                  </span>
                  <h4 className="text-sm font-semibold text-[#1a1a2e] dark:text-white truncate">
                    {task.title}
                  </h4>
                </div>
                {task.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-[#00c8ff]">{task.progress ?? 0}%</p>
              </div>
            </div>

            <div className="h-1.5 bg-gray-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-[#00c8ff] to-blue-600 transition-all"
                style={{ width: `${Math.min(100, task.progress ?? 0)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-500 mt-2">
              <span>
                <i className="fa-regular fa-calendar mr-1"></i>
                {task.due_date
                  ? new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '-'}
              </span>
              {(perms.progress === 'update' || perms.progress === 'full') && (
                <button
                  onClick={() => setEditing(task)}
                  className="px-2 py-1 rounded-md bg-[#00c8ff]/10 text-[#00c8ff] font-medium hover:bg-[#00c8ff]/20"
                >
                  <i className="fa-solid fa-pen mr-1"></i>Update
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}