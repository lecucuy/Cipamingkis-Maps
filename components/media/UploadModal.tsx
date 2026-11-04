'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import MentionInput from './MentionInput';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ⏱ 15 menit — samakan dengan nginx proxy_read_timeout
const UPLOAD_TIMEOUT_MS = 900_000;
const CONCURRENCY = 2;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

type FilePhase = 'queued' | 'uploading' | 'processing' | 'done' | 'error';

interface FileItem {
  id: string;
  file: File;
  preview: string;
  phase: FilePhase;
  progress: number;      // 0-100, hanya bermakna saat uploading
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  buildingName: string;
  mediaType: 'photo' | 'video' | 'maintenance' | 'model_3d';
  token?: string;
  canUpload: boolean;
  outsideReason?: string | null;
  onSuccess: () => void | Promise<void>;
  onError?: (message: string) => void;
}

const genId = () =>
  `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function extractErrorMessage(err: any): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => (typeof d === 'string' ? d : d?.msg || JSON.stringify(d)))
      .join('; ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    return 'Server terlalu lama memproses. Coba file lebih kecil atau ulangi.';
  }
  if (err?.response?.status === 413) return 'File terlalu besar untuk server.';
  if (err?.response?.status === 401 || err?.response?.status === 403) {
    return 'Sesi berakhir. Silakan login ulang.';
  }
  if (err?.response?.status === 504) return 'Gateway timeout — server sibuk. Coba lagi.';
  return err?.message || 'Upload gagal';
}

export default function UploadModal({
  open, onClose, buildingId, buildingName, mediaType, token,
  canUpload, outsideReason, onSuccess, onError,
}: Props) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [description, setDescription] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState('');
  const [uploading, setUploading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<FileItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Reset + cleanup saat modal dibuka
  useEffect(() => {
    if (!open) return;
    // revoke blob lama
    itemsRef.current.forEach((i) => {
      if (i.preview?.startsWith('blob:')) URL.revokeObjectURL(i.preview);
    });
    setItems([]);
    setDescription('');
    setMentions([]);
    setTimestamp('');
    setCurrentIdx(0);
    setUploading(false);
  }, [open]);

  // Esc + body lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, uploading, onClose]);

  // Cleanup on unmount
  useEffect(() => () => {
    itemsRef.current.forEach((i) => {
      if (i.preview?.startsWith('blob:')) URL.revokeObjectURL(i.preview);
    });
    abortRef.current?.abort();
  }, []);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);

    if (mediaType === 'model_3d') {
      const bad = arr.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return !['glb', 'gltf'].includes(ext || '');
      });
      if (bad.length > 0) {
        toast.error('Hanya .glb atau .gltf untuk model 3D');
        return;
      }
    }

    const valid = arr.filter((f) => f.size <= MAX_FILE_BYTES);
    if (valid.length !== arr.length) {
      toast.error(`Beberapa file >${MAX_FILE_BYTES / 1024 / 1024}MB diabaikan`);
    }
    if (valid.length === 0) return;

    const newItems: FileItem[] = await Promise.all(
      valid.map(async (f) => {
        let preview = '';
        if (f.type.startsWith('image/')) {
          preview = await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onloadend = () => resolve((r.result as string) || '');
            r.readAsDataURL(f);
          });
        } else if (f.type.startsWith('video/')) {
          preview = URL.createObjectURL(f);
        }
        return {
          id: genId(),
          file: f,
          preview,
          phase: 'queued' as FilePhase,
          progress: 0,
        };
      }),
    );

    setItems((prev) => [...prev, ...newItems]);
  }, [mediaType]);

  const removeFile = (idx: number) => {
    setItems((prev) => {
      const target = prev[idx];
      if (target?.preview?.startsWith('blob:')) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== idx);
    });
    setCurrentIdx((c) => (c >= idx && c > 0 ? c - 1 : c));
  };

  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    if (file.type === 'image/heic' || file.type === 'image/heif') return file;
    try {
      return await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
    } catch {
      return file;
    }
  };

  // ==== Upload 1 file: phase queued → uploading → processing → done/error
  const uploadOne = useCallback(async (item: FileItem): Promise<boolean> => {
    const patch = (p: Partial<FileItem>) =>
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...p } : i)));

    patch({ phase: 'uploading', progress: 0, error: undefined });

    let file = item.file;
    if (
      mediaType !== 'model_3d' &&
      file.type.startsWith('image/') &&
      file.type !== 'image/heic' &&
      file.type !== 'image/heif'
    ) {
      try { file = await compressImage(file); } catch {}
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('building_id', buildingId);
    fd.append('media_type', mediaType);
    fd.append('description', description);
    if (timestamp) fd.append('timestamp', timestamp);
    if (mentions.length > 0) fd.append('mentions', JSON.stringify(mentions));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await axios.post(`${API_URL}/buildings/media/upload`, fd, {
        // ⚠️ JANGAN set Content-Type — biar axios pasang boundary sendiri
        headers: { Authorization: `Bearer ${token}` },
        timeout: UPLOAD_TIMEOUT_MS,
        signal: ctrl.signal,
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.min(99, Math.round((e.loaded * 100) / e.total));
          // 100% byte → masuk fase processing, JANGAN tampilkan 100 dulu
          patch({ progress: pct, phase: 'uploading' });
        },
      });

      // ↳ Response baru datang setelah backend selesai transcode + poster + NSFW
      patch({ phase: 'done', progress: 100 });
      return true;
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError') {
        patch({ phase: 'error', error: 'Dibatalkan' });
        return false;
      }
      patch({ phase: 'error', error: extractErrorMessage(err) });
      return false;
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [buildingId, mediaType, description, timestamp, mentions, token]);

  // ==== Batch runner: hanya proses item berphase 'queued'
  const runQueue = useCallback(async () => {
    const queue = itemsRef.current.filter((i) => i.phase === 'queued');
    if (queue.length === 0) return;

    setUploading(true);
    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        const my = queue[cursor++];
        await uploadOne(my);
      }
    };

    const n = Math.min(CONCURRENCY, queue.length);
    await Promise.all(Array.from({ length: n }, worker));

    setUploading(false);

    // Baca state terbaru dari ref setelah semua selesai
    // (setItems asynchronous — baca via setItems callback)
    setItems((prev) => {
      const total = prev.length;
      const done = prev.filter((i) => i.phase === 'done').length;
      const errored = prev.filter((i) => i.phase === 'error').length;

      if (done === total && total > 0) {
        toast.success(`✅ ${done} file berhasil diupload`);
        // beri jeda singkat supaya user lihat success state
        setTimeout(() => {
          void Promise.resolve(onSuccess()).finally(() => onClose());
        }, 600);
      } else if (done > 0 && errored > 0) {
        toast.error(`${done} sukses, ${errored} gagal — cek daftar di bawah`);
      } else if (errored > 0 && done === 0) {
        toast.error(`Semua ${errored} file gagal`);
        onError?.(prev.find((i) => i.phase === 'error')?.error || 'Upload gagal');
      }
      return prev;
    });
  }, [uploadOne, onSuccess, onClose, onError]);

  const handleUpload = () => {
    if (!token || items.length === 0) return;
    if (!canUpload) {
      toast.error(outsideReason || 'Upload tidak diizinkan di sini');
      return;
    }
    void runQueue();
  };

  const handleRetry = () => {
    setItems((prev) =>
      prev.map((i) =>
        i.phase === 'error' ? { ...i, phase: 'queued', progress: 0, error: undefined } : i,
      ),
    );
    // beri tick supaya ref ke-update, lalu jalankan
    setTimeout(() => { void runQueue(); }, 0);
  };

  // ==== Derived state
  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.phase === 'done').length;
    const errored = items.filter((i) => i.phase === 'error').length;
    const uploading = items.filter((i) => i.phase === 'uploading').length;
    const processing = items.filter((i) => i.phase === 'processing').length;
    const queued = items.filter((i) => i.phase === 'queued').length;

    let pct = 0;
    if (total > 0) {
      const doneC = done * 100;
      const procC = processing * 100;
      const upC = items
        .filter((i) => i.phase === 'uploading')
        .reduce((s, i) => s + i.progress, 0);
      pct = Math.round((doneC + procC + upC) / total);
    }
    return { total, done, errored, uploading, processing, queued, pct };
  }, [items]);

  const statusText = useMemo(() => {
    if (stats.total === 0) return '';
    if (!uploading && stats.done === stats.total) return `Selesai — ${stats.done} file`;
    if (!uploading && stats.errored > 0 && stats.done + stats.errored === stats.total) {
      return `${stats.done} sukses, ${stats.errored} gagal`;
    }
    if (stats.uploading > 0) {
      return `Mengunggah ${stats.done + 1} dari ${stats.total}…`;
    }
    if (stats.processing > 0) return 'Server sedang memproses…';
    if (stats.queued > 0 && uploading) return `Menunggu ${stats.queued} file…`;
    return '';
  }, [stats, uploading]);

  if (!open || !mounted) return null;

  const activeItem = items[currentIdx];

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-4"
      onClick={() => !uploading && onClose()}
      style={{ isolation: 'isolate' }}
    >
      <div
        className="bg-white dark:bg-[#0f0f23] w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============ LEFT: PREVIEW ============ */}
        <div className="relative bg-black flex-1 min-h-[45vh] sm:min-h-[500px] sm:max-w-[60%] flex items-center justify-center">
          {items.length === 0 ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void addFiles(e.dataTransfer.files);
              }}
              className={`absolute inset-0 flex flex-col items-center justify-center text-center px-6 transition ${
                dragging ? 'bg-[#00c8ff]/10' : ''
              }`}
            >
              <div className="text-white/80 space-y-4">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                  <i className={`fa-solid ${
                    mediaType === 'video' ? 'fa-video'
                    : mediaType === 'model_3d' ? 'fa-cube'
                    : mediaType === 'maintenance' ? 'fa-wrench'
                    : 'fa-camera'
                  } text-3xl text-white`}></i>
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Seret file ke sini</p>
                  <p className="text-white/60 text-xs">atau</p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-[#00c8ff] text-white text-sm font-medium hover:bg-[#00c8ff]/90"
                >
                  Pilih File
                </button>
                <p className="text-white/40 text-[10px]">
                  {mediaType === 'video' ? 'MP4, WebM, MOV — max 100MB'
                    : mediaType === 'model_3d' ? 'GLB, GLTF — max 100MB'
                    : mediaType === 'maintenance' ? 'PDF, Gambar — max 100MB'
                    : 'JPG, PNG, GIF, WebP, HEIC — max 100MB'}
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={
                  mediaType === 'video' ? 'video/*'
                  : mediaType === 'maintenance' ? 'application/pdf,image/*'
                  : mediaType === 'model_3d' ? '.glb,.gltf'
                  : 'image/*,image/heic,image/heif'
                }
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="hidden"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4">
              {activeItem?.file.type.startsWith('image/') && (
                <img src={activeItem.preview} alt="" className="max-w-full max-h-full object-contain" />
              )}
              {activeItem?.file.type.startsWith('video/') && (
                <video src={activeItem.preview} controls className="max-w-full max-h-full" />
              )}
              {activeItem &&
                !activeItem.file.type.startsWith('image/') &&
                !activeItem.file.type.startsWith('video/') && (
                  <div className="text-white/80 text-center">
                    <i className="fa-solid fa-file text-6xl mb-3 block"></i>
                    <p className="text-sm font-medium">{activeItem.file.name}</p>
                  </div>
                )}
            </div>
          )}

          {/* Thumbnail strip */}
          {items.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((it, i) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setCurrentIdx(i)}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                      i === currentIdx
                        ? 'border-[#00c8ff]'
                        : it.phase === 'error'
                          ? 'border-red-500'
                          : 'border-white/20'
                    }`}
                  >
                    {it.preview && it.file.type.startsWith('image/') ? (
                      <img src={it.preview} alt="" className="w-full h-full object-cover" />
                    ) : it.file.type.startsWith('video/') ? (
                      <div className="w-full h-full bg-black flex items-center justify-center">
                        <i className="fa-solid fa-play text-white/80"></i>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <i className="fa-solid fa-file text-white/80 text-xs"></i>
                      </div>
                    )}

                    {/* Per-file overlay */}
                    {it.phase === 'uploading' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">{it.progress}%</span>
                      </div>
                    )}
                    {it.phase === 'processing' && (
                      <div className="absolute inset-0 bg-amber-500/70 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {it.phase === 'done' && (
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px]">
                        <i className="fa-solid fa-check" />
                      </div>
                    )}
                    {it.phase === 'error' && (
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px]">
                        <i className="fa-solid fa-exclamation" />
                      </div>
                    )}
                  </button>
                ))}

                {!uploading && (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="w-14 h-14 rounded-lg border-2 border-dashed border-white/30 hover:border-[#00c8ff] flex items-center justify-center text-white/60 shrink-0"
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mobile back */}
          <button
            type="button"
            onClick={() => !uploading && onClose()}
            className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center hover:bg-black/70 sm:hidden"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>

          {/* Remove current */}
          {items.length > 0 && !uploading && (
            <button
              type="button"
              onClick={() => removeFile(currentIdx)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-red-500/80 backdrop-blur text-white flex items-center justify-center hover:bg-red-500"
              title="Hapus file ini"
            >
              <i className="fa-solid fa-trash text-xs"></i>
            </button>
          )}
        </div>

        {/* ============ RIGHT: FORM ============ */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2a2a4e] shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-[#1a1a2e] dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-cloud-arrow-up text-[#00c8ff]"></i>
                Upload {mediaType === 'photo' ? 'Foto' : mediaType === 'video' ? 'Video' : mediaType === 'model_3d' ? 'Model 3D' : 'Perbaikan'}
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                <i className="fa-solid fa-location-dot mr-0.5"></i> {buildingName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => !uploading && onClose()}
              className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#1a1a2e] flex items-center justify-center text-gray-500"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!canUpload && outsideReason && (
              <div className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 flex items-start gap-2">
                <i className="fa-solid fa-lock mt-0.5"></i>
                <span>{outsideReason}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Caption
              </label>
              <MentionInput
                value={description}
                onChange={setDescription}
                onMentionsChange={setMentions}
                token={token}
                placeholder="Ceritakan momen ini... Tag @user untuk kolaborasi tim"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Tanggal & Waktu
              </label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
              />
            </div>

            {/* Error list per-file */}
            {items.some((i) => i.phase === 'error') && (
              <div className="space-y-1.5">
                {items
                  .filter((i) => i.phase === 'error')
                  .map((i) => (
                    <div
                      key={i.id}
                      className="text-[11px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 flex items-start gap-2 text-red-700 dark:text-red-300"
                    >
                      <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{i.file.name}</p>
                        <p className="text-[10px] opacity-80 break-words">{i.error}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="text-[11px] text-gray-500 bg-gray-50 dark:bg-[#0f0f23] rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-images text-[#00c8ff]"></i>
                  <span><strong>{items.length}</strong> file dipilih</span>
                  {mentions.length > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <i className="fa-solid fa-at text-[#00c8ff]"></i>
                      <span><strong>{mentions.length}</strong> di-tag</span>
                    </>
                  )}
                </div>
                {uploading && statusText && (
                  <div className="flex items-center gap-1.5 text-[#00c8ff] font-medium">
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>{statusText}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-[#2a2a4e] shrink-0 space-y-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={items.length === 0 || uploading || !canUpload || stats.done === stats.total}
              className={`w-full py-3 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
                items.length === 0 || uploading || !canUpload || stats.done === stats.total
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#00c8ff] to-blue-600 text-white hover:shadow-lg hover:shadow-[#00c8ff]/30'
              }`}
            >
              {uploading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>{statusText || 'Mengunggah…'}</span>
                </>
              ) : stats.done === stats.total && stats.total > 0 ? (
                <>
                  <i className="fa-solid fa-check"></i>
                  <span>Selesai</span>
                </>
              ) : !canUpload ? (
                <>
                  <i className="fa-solid fa-lock"></i>
                  <span>Tidak diizinkan di sini</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>Upload {items.length > 0 ? `${items.length} File` : ''}</span>
                </>
              )}
            </button>

            {/* Retry button — muncul kalau ada error */}
            {stats.errored > 0 && !uploading && (
              <button
                type="button"
                onClick={handleRetry}
                className="w-full py-2 text-xs rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <i className="fa-solid fa-rotate-right mr-1"></i>
                Coba lagi {stats.errored} file yang gagal
              </button>
            )}

            {/* Overall progress bar */}
            {uploading && (
              <>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00c8ff] to-blue-600 transition-all duration-300"
                    style={{ width: `${stats.pct}%` }}
                  />
                </div>
                {stats.processing > 0 && stats.uploading === 0 && (
                  <p className="text-[10px] text-center text-amber-600 dark:text-amber-400">
                    <i className="fa-solid fa-circle-notch fa-spin mr-1"></i>
                    Server sedang memproses ({stats.processing} file) — jangan tutup tab ini
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}