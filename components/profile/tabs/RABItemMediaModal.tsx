// components/profile/tabs/RABItemMediaModal.tsx
'use client';
import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { rabApi, RABMedia, RABMediaStats } from '@/lib/api/rab';

const fmtSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  rabId: string;
  kodeUnik: string;
  itemUraian: string;
  existingMedia: RABMedia[];
  stats: RABMediaStats;
  onChanged: () => void;
}

export default function RABItemMediaModal({
  open, onClose, rabId, kodeUnik, itemUraian,
  existingMedia, stats, onChanged,
}: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState('');
  const [tab, setTab] = useState<'photo' | 'video'>('photo');
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const photos = existingMedia.filter(m => m.type === 'photo');
  const videos = existingMedia.filter(m => m.type === 'video');
  const readyToDone = stats.can_done;

  const handleUpload = async (f: File | null, type: 'photo' | 'video') => {
    if (!f || !token) return;
    setBusy(true);
    try {
      await rabApi.uploadItemMedia(token, rabId, kodeUnik, f, type, desc);
      toast.success(type === 'photo' ? 'Foto tersimpan' : 'Video tersimpan');
      setDesc('');
      onChanged();
    } catch (e: any) {
      const d = e.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : d?.message || 'Gagal upload');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (m: RABMedia) => {
    if (!token) return;
    if (!confirm(`Hapus ${m.type === 'photo' ? 'foto' : 'video'} ini?`)) return;
    setBusy(true);
    try {
      await rabApi.deleteItemMedia(token, rabId, kodeUnik, m.id);
      toast.success('Media dihapus');
      onChanged();
    } catch (e: any) {
      const d = e.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : d?.message || 'Gagal hapus');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-[#2a2a4e] flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-white">
              <i className="fa-solid fa-camera text-[#00c8ff]" />
              Bukti Pekerjaan
            </h3>
            <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">
              <span className="font-mono mr-1">{kodeUnik}</span> · {itemUraian}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 shrink-0"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* STATUS SYARAT */}
        <div
          className={`px-5 py-3 border-b border-gray-200 dark:border-[#2a2a4e] ${
            readyToDone
              ? 'bg-emerald-50 dark:bg-emerald-900/20'
              : 'bg-amber-50 dark:bg-amber-900/20'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            {readyToDone ? (
              <>
                <i className="fa-solid fa-circle-check text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-300">
                  Bukti lengkap — item siap ditandai 100%
                </span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-triangle-exclamation text-amber-600" />
                <span className="text-amber-700 dark:text-amber-300">
                  Belum cukup bukti untuk tandai selesai
                </span>
              </>
            )}
          </div>
          <div className="flex gap-3 mt-2 text-[10px]">
            <span className={photos.length >= stats.min_photos ? 'text-emerald-600' : 'text-rose-600'}>
              <i className="fa-solid fa-image mr-1" />
              Foto {photos.length}/{stats.min_photos}
            </span>
            <span className={videos.length >= stats.min_videos ? 'text-emerald-600' : 'text-rose-600'}>
              <i className="fa-solid fa-video mr-1" />
              Video {videos.length}/{stats.min_videos}
            </span>
          </div>
        </div>

        {/* TABS */}
        <div className="px-5 flex gap-1 border-b border-gray-200 dark:border-[#2a2a4e]">
          <button
            onClick={() => setTab('photo')}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ${
              tab === 'photo'
                ? 'border-[#00c8ff] text-[#00c8ff]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <i className="fa-solid fa-image mr-1" /> Foto ({photos.length})
          </button>
          <button
            onClick={() => setTab('video')}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ${
              tab === 'video'
                ? 'border-[#00c8ff] text-[#00c8ff]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <i className="fa-solid fa-video mr-1" /> Video ({videos.length})
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Form upload */}
          <div className="space-y-2">
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Keterangan (opsional) — mis. sebelum/sesudah dikerjakan"
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#00c8ff]"
            />

            {tab === 'photo' && (
              <>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={e => {
                    handleUpload(e.target.files?.[0] || null, 'photo');
                    if (photoRef.current) photoRef.current.value = '';
                  }}
                />
                <button
                  onClick={() => photoRef.current?.click()}
                  disabled={busy}
                  className="w-full py-2.5 text-xs rounded-lg bg-[#00c8ff] text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <><i className="fa-solid fa-spinner fa-spin" /> Upload...</>
                  ) : (
                    <><i className="fa-solid fa-plus" /> Tambah Foto</>
                  )}
                </button>
                <p className="text-[10px] text-gray-400 text-center">
                  Format: jpg/png/webp/heic · Maks 15 MB
                </p>
              </>
            )}

            {tab === 'video' && (
              <>
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={e => {
                    handleUpload(e.target.files?.[0] || null, 'video');
                    if (videoRef.current) videoRef.current.value = '';
                  }}
                />
                <button
                  onClick={() => videoRef.current?.click()}
                  disabled={busy}
                  className="w-full py-2.5 text-xs rounded-lg bg-[#00c8ff] text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <><i className="fa-solid fa-spinner fa-spin" /> Upload...</>
                  ) : (
                    <><i className="fa-solid fa-plus" /> Tambah Video</>
                  )}
                </button>
                <p className="text-[10px] text-gray-400 text-center">
                  Format: mp4/mov/webm · Maks 200 MB · Penjelasan singkat (30-60 detik cukup)
                </p>
              </>
            )}
          </div>

          {/* Gallery */}
          {tab === 'photo' && (
            <>
              {photos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="fa-solid fa-image text-2xl mb-2 block" />
                  <p className="text-xs">Belum ada foto</p>
                  <p className="text-[10px] mt-1">Upload minimal {stats.min_photos} foto</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map(m => (
                    <div
                      key={m.id}
                      className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-[#2a2a4e]"
                    >
                      <img
                        src={m.url}
                        alt={m.description || m.filename}
                        className="w-full aspect-square object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={() => handleDelete(m)}
                        disabled={busy}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-500 text-white text-[10px] opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                        title="Hapus"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                      {m.description && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 truncate">
                          {m.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'video' && (
            <>
              {videos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="fa-solid fa-video text-2xl mb-2 block" />
                  <p className="text-xs">Belum ada video</p>
                  <p className="text-[10px] mt-1">Upload minimal {stats.min_videos} video penjelasan</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {videos.map(m => (
                    <div
                      key={m.id}
                      className="rounded-lg overflow-hidden border border-gray-200 dark:border-[#2a2a4e]"
                    >
                      <video
                        src={m.url}
                        controls
                        preload="metadata"
                        className="w-full max-h-64 bg-black"
                      />
                      <div className="p-2 flex items-center justify-between text-[10px] text-gray-500">
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{m.filename}</p>
                          <p className="text-[9px] text-gray-400">
                            {fmtSize(m.size)}
                            {m.description && ` · ${m.description}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(m)}
                          disabled={busy}
                          className="ml-2 px-2 py-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-50"
                          title="Hapus"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-[#2a2a4e]">
          <button
            onClick={onClose}
            disabled={busy}
            className={`w-full py-2 text-xs rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${
              readyToDone
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'border border-gray-300 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300'
            }`}
          >
            {readyToDone ? (
              <>
                <i className="fa-solid fa-check" />
                Selesai — Bukti Lengkap
              </>
            ) : (
              <>
                <i className="fa-solid fa-clock" />
                Belum Cukup Bukti
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}