'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import MentionInput from './MentionInput';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Props {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  buildingName: string;
  mediaType: 'photo' | 'video' | 'maintenance' | 'model_3d';
  token?: string;
  canUpload: boolean;
  outsideReason?: string | null;
  onSuccess: () => void;
}

export default function UploadModal({
  open, onClose, buildingId, buildingName, mediaType, token,
  canUpload, outsideReason, onSuccess,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);   // 🆕

  // 🆕 SSR guard
  useEffect(() => { setMounted(true); }, []);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setFiles([]); setPreviews([]); setDescription('');
      setMentions([]); setTimestamp(''); setProgress({});
      setCurrentIdx(0); setUploading(false);
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) onClose();
    };
    window.addEventListener('keydown', onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = orig;
    };
  }, [open, uploading, onClose]);

  const addFiles = useCallback(async (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);

    if (mediaType === 'model_3d') {
      const invalid = arr.filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return !['glb', 'gltf'].includes(ext || '');
      });
      if (invalid.length > 0) {
        toast.error('Hanya file .glb atau .gltf untuk model 3D');
        return;
      }
    }

    const valid = arr.filter(f => f.size <= 100 * 1024 * 1024);
    if (valid.length !== arr.length) {
      toast.error('Beberapa file >100MB diabaikan');
    }

    const newPreviews = await Promise.all(valid.map(f => new Promise<string>((resolve) => {
      if (f.type.startsWith('image/')) {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.readAsDataURL(f);
      } else if (f.type.startsWith('video/')) {
        resolve(URL.createObjectURL(f));
      } else {
        resolve('');
      }
    })));

    setFiles(prev => [...prev, ...valid]);
    setPreviews(prev => [...prev, ...newPreviews]);
  }, [mediaType]);

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
    if (currentIdx >= idx && currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    if (file.type === 'image/heic' || file.type === 'image/heif') return file;
    try {
      return await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
    } catch { return file; }
  };

  const handleUpload = async () => {
    if (!token || files.length === 0) return;
    if (!canUpload) {
      toast.error(outsideReason || 'Upload tidak diizinkan di sini');
      return;
    }

    setUploading(true);
    setProgress({});

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      let f = files[i];
      if (mediaType !== 'model_3d' && f.type.startsWith('image/') && f.type !== 'image/heic' && f.type !== 'image/heif') {
        try { f = await compressImage(f); } catch {}
      }

      const fd = new FormData();
      fd.append('file', f);
      fd.append('building_id', buildingId);
      fd.append('media_type', mediaType);
      fd.append('description', description);
      if (timestamp) fd.append('timestamp', timestamp);
      if (mentions.length > 0) fd.append('mentions', JSON.stringify(mentions));

      try {
        await axios.post(`${API_URL}/buildings/media/upload`, fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) {
              const pct = Math.round((e.loaded * 100) / e.total);
              setProgress(prev => ({ ...prev, [i]: pct }));
            }
          },
        });
        successCount++;
      } catch (err: any) {
        toast.error(`Gagal upload ${f.name}: ${err.response?.data?.detail || 'error'}`);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`✅ ${successCount} file berhasil diupload`);
      onSuccess();
      onClose();
    }
  };

  // 🆕 RETURN EARLY — HARUS DI ATAS sebelum return JSX
  if (!open) return null;
  if (!mounted) return null;

  const activeFile = files[currentIdx];
  const activePreview = previews[currentIdx];

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
        {/* ===== LEFT: MEDIA PREVIEW ===== */}
        <div className="relative bg-black flex-1 min-h-[45vh] sm:min-h-[500px] sm:max-w-[60%] flex items-center justify-center">
          {files.length === 0 ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
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
          if (e.target.files) addFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = '';
        }}
        className="hidden"
      />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4">
              {activeFile?.type.startsWith('image/') && (
                <img src={activePreview} alt="" className="max-w-full max-h-full object-contain" />
              )}
              {activeFile?.type.startsWith('video/') && (
                <video src={activePreview} controls className="max-w-full max-h-full" />
              )}
              {activeFile && !activeFile.type.startsWith('image/') && !activeFile.type.startsWith('video/') && (
                <div className="text-white/80 text-center">
                  <i className="fa-solid fa-file text-6xl mb-3 block"></i>
                  <p className="text-sm font-medium">{activeFile.name}</p>
                </div>
              )}
            </div>
          )}

          {/* Thumbnail strip */}
          {files.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {files.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentIdx(i)}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                      i === currentIdx ? 'border-[#00c8ff]' : 'border-white/20'
                    }`}
                  >
                    {previews[i] && f.type.startsWith('image/') ? (
                      <img src={previews[i]} alt="" className="w-full h-full object-cover" />
                    ) : f.type.startsWith('video/') ? (
                      <div className="w-full h-full bg-black flex items-center justify-center">
                        <i className="fa-solid fa-play text-white/80"></i>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <i className="fa-solid fa-file text-white/80 text-xs"></i>
                      </div>
                    )}
                    {uploading && progress[i] != null && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">{progress[i]}%</span>
                      </div>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-14 h-14 rounded-lg border-2 border-dashed border-white/30 hover:border-[#00c8ff] flex items-center justify-center text-white/60 shrink-0"
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>
          )}

          {/* Back button on mobile */}
          <button
            type="button"
            onClick={() => !uploading && onClose()}
            className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center hover:bg-black/70 sm:hidden"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>

          {/* Remove current */}
          {files.length > 0 && !uploading && (
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

        {/* ===== RIGHT: FORM ===== */}
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

            {files.length > 0 && (
              <div className="text-[11px] text-gray-500 bg-gray-50 dark:bg-[#0f0f23] rounded-lg px-3 py-2 flex items-center gap-2">
                <i className="fa-solid fa-images text-[#00c8ff]"></i>
                <span><strong>{files.length}</strong> file dipilih</span>
                {mentions.length > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <i className="fa-solid fa-at text-[#00c8ff]"></i>
                    <span><strong>{mentions.length}</strong> user di-tag</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-[#2a2a4e] shrink-0">
            <button
              type="button"
              onClick={handleUpload}
              disabled={files.length === 0 || uploading || !canUpload}
              className={`w-full py-3 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
                files.length === 0 || uploading || !canUpload
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#00c8ff] to-blue-600 text-white hover:shadow-lg hover:shadow-[#00c8ff]/30'
              }`}
            >
              {uploading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Mengupload... ({Object.keys(progress).length}/{files.length})</span>
                </>
              ) : !canUpload ? (
                <>
                  <i className="fa-solid fa-lock"></i>
                  <span>Tidak diizinkan di sini</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>Upload {files.length > 0 ? `${files.length} File` : ''}</span>
                </>
              )}
            </button>

            {uploading && (
              <div className="mt-3 w-full h-1.5 bg-gray-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00c8ff] to-blue-600 transition-all duration-300"
                  style={{
                    width: `${
                      files.length > 0
                        ? Math.round((Object.values(progress).reduce((a, b) => a + b, 0) / (files.length * 100)) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );

  return createPortal(modalContent, document.body);   // 🆕
}