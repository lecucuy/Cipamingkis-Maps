'use client';
import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { progressApi, ProgressTask } from '@/lib/api/progress';

interface Props {
  task: ProgressTask | null;
  onClose: () => void;
  onChanged?: () => void;
}

export default function TaskDetailModal({ task, onClose, onChanged }: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!task) return null;

  const save = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await progressApi.update(token, task.id, { progress });
      toast.success('Progress disimpan');
      onChanged?.();
      onClose();
    } catch { toast.error('Gagal menyimpan'); }
    finally { setBusy(false); }
  };

  const handlePhoto = async (f: File | null) => {
    if (!f || !token) return;
    setUploading(true);
    try {
      await progressApi.uploadPhoto(token, task.id, f, 'Dokumentasi progress');
      toast.success('Foto tersimpan');
      onChanged?.();
    } catch { toast.error('Gagal upload foto'); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-[2100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{task.title}</h3>
            {task.building_name && (
              <p className="text-[10px] text-gray-500 mt-0.5"><i className="fa-solid fa-location-dot mr-1"></i>{task.building_name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark"></i></button>
        </div>

        {task.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400">{task.description}</p>
        )}

        {/* Progress Slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Progress</label>
            <span className="text-sm font-bold text-[#00c8ff] tabular-nums">{progress}%</span>
          </div>
          <input type="range" min="0" max="100" step="5" value={progress}
            onChange={(e) => setProgress(parseInt(e.target.value))}
            className="w-full accent-[#00c8ff]" />
          <div className="flex gap-1.5 mt-2">
            {[0, 25, 50, 75, 100].map(p => (
              <button key={p} onClick={() => setProgress(p)}
                className={`flex-1 py-1 text-[10px] rounded border transition ${progress === p ? 'bg-[#00c8ff] text-white border-[#00c8ff]' : 'border-gray-200 dark:border-[#2a2a4e] hover:border-[#00c8ff]'}`}>
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* Dokumentasi Foto */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Foto Dokumentasi</label>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-[10px] px-2 py-1 rounded bg-[#00c8ff]/10 text-[#00c8ff] hover:bg-[#00c8ff]/20 font-medium">
              {uploading ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i>Upload</> : <><i className="fa-solid fa-camera mr-1"></i>+ Foto</>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0] || null)} />
          </div>
          {task.photos && task.photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {task.photos.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer"
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-[#0f0f1e] border border-gray-200 dark:border-[#2a2a4e]">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 text-center py-3">Belum ada foto dokumentasi</p>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-[#2a2a4e]">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-2 text-xs rounded-lg border border-gray-300 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300">
            Tutup
          </button>
          <button onClick={save} disabled={busy}
            className="flex-1 py-2 text-xs rounded-lg bg-[#00c8ff] text-white font-semibold disabled:opacity-50">
            {busy ? 'Menyimpan...' : 'Simpan Progress'}
          </button>
        </div>
      </div>
    </div>
  );
}