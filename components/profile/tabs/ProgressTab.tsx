'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { rabApi } from '@/lib/api/rab';
import { profileApi } from '@/lib/api/profile';
import RABDetailModal from '@/components/profile/tabs/RABDetailModal';
import TaskDetailModal from '@/components/progress/TaskDetailModal';

const fmtIDR = (n?: number) =>
  n != null
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
      }).format(n)
    : 'Rp 0';

const fmtShort = (n?: number) => {
  if (!n) return 'Rp 0';
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
  return `Rp ${n}`;
};

type ViewMode = 'all' | 'rab' | 'task';
type RABFilter = 'all' | 'draft' | 'berjalan' | 'selesai';
type TaskFilter = 'all' | 'planned' | 'ongoing' | 'done' | 'blocked';

const RAB_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft:    { label: 'Draft',    color: 'text-gray-600 dark:text-gray-300',  bg: 'bg-gray-500/15 border-gray-500/30',      icon: 'fa-file' },
  berjalan: { label: 'Berjalan', color: 'text-blue-600 dark:text-blue-300',  bg: 'bg-blue-500/15 border-blue-500/30',      icon: 'fa-gears' },
  selesai:  { label: 'Selesai',  color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30', icon: 'fa-circle-check' },
};

const TASK_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  planned: { label: 'Rencana',  color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-500/15 border-gray-500/30', icon: 'fa-clock' },
  ongoing: { label: 'Berjalan', color: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-500/15 border-blue-500/30', icon: 'fa-gears' },
  done:    { label: 'Selesai',  color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30', icon: 'fa-circle-check' },
  blocked: { label: 'Terhambat', color: 'text-red-600 dark:text-red-300', bg: 'bg-red-500/15 border-red-500/30', icon: 'fa-ban' },
};

export default function ProgressTab({ role }: { role?: string | null }) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [rabs, setRabs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingRAB, setLoadingRAB] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [errorRAB, setErrorRAB] = useState<string | null>(null);
  const [errorTasks, setErrorTasks] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('all');
  const [rabFilter, setRabFilter] = useState<RABFilter>('all');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  const [detailRABId, setDetailRABId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);

  // ===== LOAD RAB =====
  const loadRABs = useCallback(async () => {
    if (!token) { setLoadingRAB(false); return; }
    setLoadingRAB(true);
    setErrorRAB(null);
    try {
      // rabApi.list mendeteksi JWT → single arg = token mode, tanpa building filter
      const r = await rabApi.list(token);
      const items = r.items || [];
      // console.log('[ProgressTab] RAB loaded:', items.length, items);
      setRabs(items);
    } catch (e: any) {
      console.error('[ProgressTab] Load RAB error:', e);
      setErrorRAB(
        typeof e?.response?.data?.detail === 'string'
          ? e.response.data.detail
          : e?.message || 'Gagal memuat RAB',
      );
      setRabs([]);
    } finally {
      setLoadingRAB(false);
    }
  }, [token]);

  // ===== LOAD TASKS =====
  const loadTasks = useCallback(async () => {
    if (!token) { setLoadingTasks(false); return; }
    setLoadingTasks(true);
    setErrorTasks(null);
    try {
      const r = await profileApi.progressList(token);
      const items = r.items || [];
      // console.log('[ProgressTab] Tasks loaded:', items.length, items);
      setTasks(items);
    } catch (e: any) {
      console.error('[ProgressTab] Load tasks error:', e);
      setErrorTasks(
        typeof e?.response?.data?.detail === 'string'
          ? e.response.data.detail
          : e?.message || 'Gagal memuat pekerjaan',
      );
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [token]);

  useEffect(() => { loadRABs(); }, [loadRABs]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ===== STATS =====
  const stats = useMemo(() => {
    const totalRAB = rabs.length;
    const activeRAB = rabs.filter(r => r.status === 'berjalan').length;
    const doneRAB = rabs.filter(r => r.status === 'selesai').length;
    const totalBudget = rabs.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const avgProgress = rabs.length > 0
      ? rabs.reduce((s, r) => s + (Number(r.progress) || 0), 0) / rabs.length
      : 0;

    const totalTask = tasks.length;
    const doneTask = tasks.filter(t => t.status === 'done').length;
    const ongoingTask = tasks.filter(t => t.status === 'ongoing').length;

    return { totalRAB, activeRAB, doneRAB, totalBudget, avgProgress, totalTask, doneTask, ongoingTask };
  }, [rabs, tasks]);

  const filteredRABs = useMemo(
    () => (rabFilter === 'all' ? rabs : rabs.filter(r => r.status === rabFilter)),
    [rabs, rabFilter],
  );

  const filteredTasks = useMemo(
    () => (taskFilter === 'all' ? tasks : tasks.filter(t => t.status === taskFilter)),
    [tasks, taskFilter],
  );

  const showRAB = view === 'all' || view === 'rab';
  const showTask = view === 'all' || view === 'task';

  const canEditTask = ['juru', 'supervisor', 'admin'].includes((role || '').toLowerCase());

  return (
    <div className="space-y-5">
      {/* ===== HERO STATS ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          icon="fa-file-invoice-dollar"
          color="from-[#00c8ff] to-blue-600"
          label="Total RAB"
          value={String(stats.totalRAB)}
          sub={`${stats.activeRAB} berjalan · ${stats.doneRAB} selesai`}
          loading={loadingRAB}
        />
        <StatCard
          icon="fa-sack-dollar"
          color="from-emerald-500 to-teal-600"
          label="Total Anggaran"
          value={fmtShort(stats.totalBudget)}
          sub="Akumulasi seluruh RAB"
          loading={loadingRAB}
        />
        <StatCard
          icon="fa-chart-line"
          color="from-purple-500 to-fuchsia-600"
          label="Rata-rata Progress"
          value={`${stats.avgProgress.toFixed(1)}%`}
          sub="Dari semua RAB"
          loading={loadingRAB}
        />
        <StatCard
          icon="fa-clipboard-check"
          color="from-amber-500 to-orange-600"
          label="Pekerjaan"
          value={String(stats.totalTask)}
          sub={`${stats.ongoingTask} berjalan · ${stats.doneTask} selesai`}
          loading={loadingTasks}
        />
      </div>

      {/* ===== VIEW SWITCHER + REFRESH ===== */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="inline-flex bg-gray-100 dark:bg-[#0f0f23] rounded-lg p-0.5 border border-gray-200 dark:border-[#2a2a4e]">
          {([
            { key: 'all',  label: 'Semua',     icon: 'fa-layer-group' },
            { key: 'rab',  label: 'RAB',       icon: 'fa-file-invoice-dollar' },
            { key: 'task', label: 'Pekerjaan', icon: 'fa-clipboard-check' },
          ] as { key: ViewMode; label: string; icon: string }[]).map(o => (
            <button
              key={o.key}
              onClick={() => setView(o.key)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition flex items-center gap-1 ${
                view === o.key
                  ? 'bg-white dark:bg-[#1a1a2e] text-[#00c8ff] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <i className={`fa-solid ${o.icon} text-[10px]`} />
              {o.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { loadRABs(); loadTasks(); }}
          disabled={loadingRAB || loadingTasks}
          className="px-2.5 py-1.5 text-[10px] rounded-lg bg-gray-100 dark:bg-[#0f0f23] border border-gray-200 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:border-[#00c8ff] transition flex items-center gap-1 disabled:opacity-50"
          title="Muat ulang data"
        >
          <i className={`fa-solid fa-rotate ${loadingRAB || loadingTasks ? 'fa-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ===== RAB SECTION ===== */}
      {showRAB && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#00c8ff]/15 flex items-center justify-center">
                <i className="fa-solid fa-file-invoice-dollar text-[#00c8ff] text-[10px]" />
              </span>
              RAB
              {rabs.length > 0 && (
                <span className="text-[10px] font-normal text-gray-400">({rabs.length})</span>
              )}
            </h3>

            {rabs.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {(['all', 'draft', 'berjalan', 'selesai'] as RABFilter[]).map(f => {
                  const count = f === 'all' ? rabs.length : rabs.filter(r => r.status === f).length;
                  if (count === 0 && f !== 'all') return null;
                  return (
                    <button
                      key={f}
                      onClick={() => setRabFilter(f)}
                      className={`px-2 py-0.5 text-[10px] rounded-full border transition ${
                        rabFilter === f
                          ? 'bg-[#00c8ff] text-white border-[#00c8ff]'
                          : 'border-gray-200 dark:border-[#2a2a4e] text-gray-500 hover:border-[#00c8ff]'
                      }`}
                    >
                      {f === 'all' ? 'Semua' : RAB_STATUS_META[f]?.label || f}
                      <span className="ml-1 opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loadingRAB ? (
            <LoadingSkeleton />
          ) : errorRAB ? (
            <ErrorState message={errorRAB} onRetry={loadRABs} />
          ) : filteredRABs.length === 0 ? (
            <RABEmptyState filter={rabFilter} hasAnyRAB={rabs.length > 0} />
          ) : (
            <div className="grid gap-2.5">
              {filteredRABs.map(rab => (
                <RABCard
                  key={rab.id}
                  rab={rab}
                  onClick={() => setDetailRABId(rab.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== PEKERJAAN SECTION ===== */}
      {showTask && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
                <i className="fa-solid fa-clipboard-check text-amber-500 text-[10px]" />
              </span>
              Pekerjaan
              {tasks.length > 0 && (
                <span className="text-[10px] font-normal text-gray-400">({tasks.length})</span>
              )}
            </h3>

            {tasks.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {(['all', 'planned', 'ongoing', 'done', 'blocked'] as TaskFilter[]).map(f => {
                  const count = f === 'all' ? tasks.length : tasks.filter(t => t.status === f).length;
                  if (count === 0 && f !== 'all') return null;
                  return (
                    <button
                      key={f}
                      onClick={() => setTaskFilter(f)}
                      className={`px-2 py-0.5 text-[10px] rounded-full border transition ${
                        taskFilter === f
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'border-gray-200 dark:border-[#2a2a4e] text-gray-500 hover:border-amber-500'
                      }`}
                    >
                      {f === 'all' ? 'Semua' : TASK_STATUS_META[f]?.label || f}
                      <span className="ml-1 opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loadingTasks ? (
            <LoadingSkeleton />
          ) : errorTasks ? (
            <ErrorState message={errorTasks} onRetry={loadTasks} />
          ) : filteredTasks.length === 0 ? (
            <TaskEmptyState hasAnyTask={tasks.length > 0} />
          ) : (
            <div className="grid gap-2.5">
              {filteredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={canEditTask}
                  onClick={() => canEditTask && setEditingTask(task)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== MODAL RAB DETAIL ===== */}
      {detailRABId && (
        <RABDetailModal
          rabId={detailRABId}
          open={!!detailRABId}
          onClose={() => setDetailRABId(null)}
          onChanged={() => {
            loadRABs();
            loadTasks();
          }}
        />
      )}

      {/* ===== MODAL TASK DETAIL ===== */}
      {editingTask && (
        <TaskDetailModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onChanged={() => {
            loadTasks();
            loadRABs();
          }}
        />
      )}
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function StatCard({ icon, color, label, value, sub, loading }: {
  icon: string; color: string; label: string; value: string; sub?: string; loading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-3">
      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${color} opacity-10 blur-2xl pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`w-6 h-6 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
            <i className={`fa-solid ${icon} text-white text-[10px]`} />
          </span>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </span>
        </div>
        {loading ? (
          <div className="h-6 w-20 bg-gray-200 dark:bg-[#1a1a2e] rounded animate-pulse" />
        ) : (
          <p className="text-lg font-bold text-gray-800 dark:text-white leading-tight tabular-nums">
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className="text-[9px] text-gray-400 mt-0.5 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

function RABCard({ rab, onClick }: { rab: any; onClick: () => void }) {
  const meta = RAB_STATUS_META[rab.status] || RAB_STATUS_META.draft;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-3 hover:border-[#00c8ff]/50 hover:shadow-sm transition group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} border`}>
          <i className={`fa-solid ${meta.icon} ${meta.color} text-sm`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-gray-800 dark:text-white truncate group-hover:text-[#00c8ff] transition">
              {rab.judul || '(tanpa judul)'}
            </p>
            <span className={`shrink-0 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="font-mono">{fmtIDR(rab.total)}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>{(rab.building_ids || []).length} bangunan</span>
            {rab.created_at && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span>
                  {new Date(rab.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              </>
            )}
          </div>

          <div className="mt-2">
            <div className="flex justify-between text-[9px] text-gray-500 dark:text-gray-400 mb-0.5">
              <span>Progress</span>
              <span className="font-mono font-bold text-[#00c8ff]">
                {(Number(rab.progress) || 0).toFixed(1)}%
              </span>
            </div>
            <div className="h-1 bg-gray-200 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00c8ff] to-purple-500 transition-all"
                style={{ width: `${Math.min(100, Number(rab.progress) || 0)}%` }}
              />
            </div>
          </div>
        </div>

        <i className="fa-solid fa-chevron-right text-gray-300 dark:text-gray-600 text-xs shrink-0 self-center group-hover:text-[#00c8ff] transition" />
      </div>
    </button>
  );
}

function TaskCard({ task, canEdit, onClick }: {
  task: any; canEdit: boolean; onClick: () => void;
}) {
  const meta = TASK_STATUS_META[task.status] || TASK_STATUS_META.planned;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <button
      onClick={onClick}
      disabled={!canEdit}
      className={`w-full text-left rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-3 transition group ${
        canEdit ? 'hover:border-amber-500/50 hover:shadow-sm cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} border`}>
          <i className={`fa-solid ${meta.icon} ${meta.color} text-sm`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-gray-800 dark:text-white truncate group-hover:text-amber-500 transition">
              {task.title || '(tanpa judul)'}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                {meta.label}
              </span>
              <span className="text-xs font-bold text-amber-500 tabular-nums">
                {task.progress ?? 0}%
              </span>
            </div>
          </div>

          {task.description && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
              {task.description}
            </p>
          )}

          <div className="h-1 bg-gray-200 dark:bg-[#1a1a2e] rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
              style={{ width: `${Math.min(100, task.progress ?? 0)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
              <i className="fa-regular fa-calendar" />
              {task.due_date
                ? new Date(task.due_date).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })
                : 'Tanpa target'}
              {isOverdue && <span className="text-[8px]">• lewat</span>}
            </span>
            {canEdit && (
              <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                <i className="fa-solid fa-pen text-[9px]" />
                Update
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2].map(i => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] p-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-[#1a1a2e] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-[#1a1a2e] rounded w-2/3 animate-pulse" />
              <div className="h-2 bg-gray-100 dark:bg-[#1a1a2e] rounded w-1/2 animate-pulse" />
              <div className="h-1 bg-gray-200 dark:bg-[#1a1a2e] rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-center">
      <i className="fa-solid fa-triangle-exclamation text-2xl text-red-500 mb-2 block" />
      <p className="text-xs text-red-700 dark:text-red-300 mb-3">{message}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-[11px] rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition"
      >
        <i className="fa-solid fa-rotate-right mr-1" />
        Coba Lagi
      </button>
    </div>
  );
}

function RABEmptyState({ filter, hasAnyRAB }: { filter: RABFilter; hasAnyRAB: boolean }) {
  if (hasAnyRAB) {
    return (
      <div className="text-center py-8 rounded-xl border border-dashed border-gray-200 dark:border-[#2a2a4e]">
        <i className="fa-solid fa-filter text-2xl text-gray-300 dark:text-gray-600 mb-2 block" />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tidak ada RAB dengan status <b>{RAB_STATUS_META[filter]?.label || filter}</b>
        </p>
        <p className="text-[10px] text-gray-400 mt-1">Coba filter lain</p>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-[#00c8ff]/30 bg-gradient-to-br from-[#00c8ff]/5 to-purple-500/5 p-6 text-center">
      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-[#00c8ff]/20 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#00c8ff]/20 to-blue-500/20 flex items-center justify-center">
          <i className="fa-solid fa-file-circle-plus text-2xl text-[#00c8ff]" />
        </div>
        <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-1">Belum ada RAB</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
          Upload RAB Excel dari panel map bangunan untuk mulai tracking progress pekerjaan.
        </p>
        <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-[#00c8ff] bg-[#00c8ff]/10 px-2.5 py-1 rounded-full">
          <i className="fa-solid fa-lightbulb" />
          Buka bangunan di peta → tombol "Upload RAB Excel"
        </div>
      </div>
    </div>
  );
}

function TaskEmptyState({ hasAnyTask }: { hasAnyTask: boolean }) {
  if (hasAnyTask) {
    return (
      <div className="text-center py-8 rounded-xl border border-dashed border-gray-200 dark:border-[#2a2a4e]">
        <i className="fa-solid fa-filter text-2xl text-gray-300 dark:text-gray-600 mb-2 block" />
        <p className="text-xs text-gray-500 dark:text-gray-400">Tidak ada pekerjaan dengan filter ini</p>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6 text-center">
      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <i className="fa-solid fa-clipboard-list text-2xl text-amber-500" />
        </div>
        <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-1">Belum ada pekerjaan</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
          Tambahkan pekerjaan dari peta dengan klik titik, atau dari menu bangunan.
        </p>
        <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
          <i className="fa-solid fa-lightbulb" />
          Aktifkan mode "Tambah Pekerjaan" lalu klik di peta
        </div>
      </div>
    </div>
  );
}