'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { progressApi } from '@/lib/api/progress';

interface Props {
  open: boolean;
  onClose: () => void;
  buildingId?: string;
  buildingName?: string;
  prefilledLocation?: { lat: number; lon: number } | null;
  onSuccess?: () => void;
}

export default function AddWorkModal({ open, onClose, buildingId = '', buildingName = '', prefilledLocation, onSuccess }: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'planned'|'ongoing'|'done'|'blocked'>('planned');
  const [budget, setBudget] = useState('');
  const [unit, setUnit] = useState('');
  const [volume, setVolume] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(''); setDescription(''); setStatus('planned');
      setBudget(''); setUnit(''); setVolume('');
      setStartDate(''); setDueDate('');
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || !token) { toast.error('Judul wajib diisi'); return; }
    setBusy(true);
    try {
      await progressApi.create(token, {
        title: title.trim(),
        description,
        status,
        progress: 0,
        building_id: buildingId,
        building_name: buildingName,
        location: prefilledLocation || null,
        budget: parseFloat(budget) || 0,
        volume: parseFloat(volume) || 0,
        unit,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
      });
      toast.success('Pekerjaan ditambahkan');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-white">
            <i className="fa-solid fa-plus-circle text-[#00c8ff]"></i>
            Tambah Pekerjaan
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark"></i></button>
        </div>

        {prefilledLocation && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-[10px] text-blue-700 dark:text-blue-300 font-mono">
            📍 {prefilledLocation.lat.toFixed(5)}, {prefilledLocation.lon.toFixed(5)}
          </div>
        )}
        {buildingName && (
          <div className="bg-gray-50 dark:bg-[#0f0f23] rounded-lg p-2 text-[10px] text-gray-600 dark:text-gray-300">
            🏢 {buildingName}
          </div>
        )}

        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">Judul *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Galian saluran"
            className="w-full px-3 py-2 text-xs rounded-lg bg-gray-50 dark:bg-[#0f0f1e] border border-gray-200 dark:border-[#2a2a4e] focus:outline-none focus:border-[#00c8ff]" />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">Deskripsi</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full px-3 py-2 text-xs rounded-lg bg-gray-50 dark:bg-[#0f0f1e] border border-gray-200 dark:border-[#2a2a4e] focus:outline-none focus:border-[#00c8ff] resize-none" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Volume</label>
            <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="0"
              className="w-full px-2 py-2 text-xs rounded-lg bg-gray-50 dark:bg-[#0f0f1e] border border-gray-200 dark:border-[#2a2a4e]" />
          </div>
          <div className="col-span-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Satuan</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="m³"
              className="w-full px-2 py-2 text-xs rounded-lg bg-gray-50 dark:bg-[#0f0f1e] border border-gray-200 dark:border-[#2a2a4e]" />
          </div>
          <div className="col-span-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-2 py-2 text-xs rounded-lg bg-gray-50 dark:bg-[#0f0f1e] border border-gray-200 dark:border-[#2a2a4e]">
              <option value="planned">Rencana</option>
              <option value="ongoing">Berjalan</option>
              <option value="done">Selesai</option>
              <option value="blocked">Terhambat</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Anggaran (Rp)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0"
              className="w-full px-2 py-2 text-xs rounded-lg bg-gray-50 dark:bg-[#0f0f1e] border border-gray-200 dark:border-[#2a2a4e]" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Target Selesai</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-2 py-2 text-xs rounded-lg bg-gray-50 dark:bg-[#0f0f1e] border border-gray-200 dark:border-[#2a2a4e]" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2 text-xs rounded-lg border border-gray-300 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300">Batal</button>
          <button onClick={submit} disabled={busy}
            className="flex-1 py-2 text-xs rounded-lg bg-[#00c8ff] text-white font-semibold hover:bg-[#00c8ff]/90 disabled:opacity-50 flex items-center justify-center gap-1">
            {busy ? <><i className="fa-solid fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fa-solid fa-check"></i> Simpan</>}
          </button>
        </div>
      </div>
    </div>
  );
}