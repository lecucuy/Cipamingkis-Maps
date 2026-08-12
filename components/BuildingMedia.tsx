'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import imageCompression from 'browser-image-compression'; // import library

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

interface MediaItem {
  _id: string;
  building_id: string;
  media_type: 'photo' | 'video' | 'maintenance';
  file_type: string;
  file_url: string;
  description: string;
  timestamp: string;
  created_at: string;
}

export default function BuildingMedia({
  buildingId,
  buildingName,
  onMediaChange,
}: {
  buildingId: string;
  buildingName: string;
  onMediaChange?: () => void;
}) {
  const { data: session } = useSession();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'maintenance'>('photo');
  const [timestamp, setTimestamp] = useState('');
  const [activeTab, setActiveTab] = useState<'photo' | 'video' | 'maintenance'>('photo');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null); // <-- state preview
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);

  const loadMedia = useCallback(async () => {
    if (!buildingId) return;
    try {
      const res = await axios.get(`${API_URL}/buildings/media/${buildingId}`);
      setMedia(res.data?.media || []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setMedia([]);
      } else {
        console.error('Gagal load media:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);


    // ===== KOMPRESI GAMBAR =====
  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    // Jika HEIC, skip kompresi di frontend (backend handle)
    if (file.type === 'image/heic' || file.type === 'image/heif') return file;
    try {
      const options = {
        maxSizeMB: 2,          // target ukuran maks 2MB
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressed = await imageCompression(file, options);
      return compressed;
    } catch (e) {
      console.warn('Kompresi gagal, pakai file asli:', e);
      return file;
    }
  };

  // ===== HANDLE FILE SELECT MULTIPLE =====
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    // Filter ukuran > 100MB
    const validFiles = fileArray.filter(f => f.size <= 100 * 1024 * 1024);
    if (validFiles.length !== fileArray.length) {
      alert('Beberapa file >100MB, akan diabaikan.');
    }
    setSelectedFiles(prev => [...prev, ...validFiles]);
    // Reset input agar bisa pilih ulang
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ===== UPLOAD MULTIPLE =====
  const handleMultipleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Pilih file dulu!');
      return;
    }
    if (!session?.accessToken) {
      alert('Login dulu!');
      return;
    }

    setUploading(true);
    setUploadIndex(0);
    setTotalProgress(0);

    for (let i = 0; i < selectedFiles.length; i++) {
      let file = selectedFiles[i];
      // Kompresi gambar sebelum upload
      if (file.type.startsWith('image/') && file.type !== 'image/heic' && file.type !== 'image/heif') {
        try {
          file = await compressImage(file);
        } catch (e) {
          console.warn('Kompresi gagal, lanjut tanpa kompresi');
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('building_id', buildingId);
      formData.append('media_type', mediaType);
      formData.append('description', description);
      if (timestamp) formData.append('timestamp', timestamp);

      try {
        await axios.post(`${API_URL}/buildings/media/upload`, formData, {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        setUploadIndex(i + 1);
        setTotalProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      } catch (err: any) {
        console.error('Upload error for', file.name, err);
        alert(`Gagal upload ${file.name}: ${err.response?.data?.detail || err.message}`);
      }
    }

    // Selesai
    setSelectedFiles([]);
    setUploading(false);
    setUploadIndex(0);
    setTotalProgress(0);
    loadMedia(); // refresh list
    if (onMediaChange) onMediaChange();
    alert('✅ Semua file berhasil diupload!');
  };



 // ===== HAPUS FILE DARI DAFTAR =====
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (selectedFile.size > 100 * 1024 * 1024) {
      alert('File terlalu besar! Maksimal 100MB.');
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith('video/')) {
      setFilePreview(URL.createObjectURL(selectedFile));
    } else {
      setFilePreview(null);
    }
  };

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const selectedFile = e.target.files?.[0] || null;
//     handleFileSelect(selectedFile);
//     if (fileInputRef.current) fileInputRef.current.value = '';
//   };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0] || null;
    handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Pilih file dulu!');
      return;
    }
    if (!session?.accessToken) {
      alert('Login dulu!');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('building_id', buildingId);
    formData.append('media_type', mediaType);
    formData.append('description', description);
    if (timestamp) formData.append('timestamp', timestamp);

    setUploading(true);
    setUploadProgress(0);

    try {
      await axios.post(`${API_URL}/buildings/media/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });
      setFile(null);
      setFilePreview(null);
      setDescription('');
      setTimestamp('');
      setUploadProgress(0);
      loadMedia();
      alert('✅ Upload berhasil!');
    } catch (err: any) {
      console.error('Upload error:', err);
      console.error('Response:', err.response?.data);
      alert(err.response?.data?.detail || '❌ Gagal upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus media ini?')) return;
    try {
      await axios.delete(`${API_URL}/buildings/media/${id}`, {
        headers: { 'Authorization': `Bearer ${session?.accessToken}` },
      });
      loadMedia();
      alert('✅ Media berhasil dihapus!');
    } catch (err) {
      console.error('Gagal hapus:', err);
      alert('❌ Gagal hapus media');
    }
  };

  const filtered = media.filter((item) => item.media_type === activeTab);

  if (!buildingId) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
        <span className="text-lg">📸</span> Media & Riwayat {buildingName}
      </h4>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'photo', label: '📷 Foto' },
          { key: 'video', label: '🎥 Video' },
          { key: 'maintenance', label: '🔧 Perbaikan' },
        ].map((tab) => {
          const count = media.filter(m => m.media_type === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                setMediaType(tab.key as any);
              }}
              className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all flex items-center gap-1 ${
                activeTab === tab.key
                  ? 'bg-[#00c8ff] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-h-64 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Belum ada {activeTab === 'photo' ? 'foto' : activeTab === 'video' ? 'video' : 'riwayat perbaikan'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((item) => (
              <div
                key={item._id}
                className="relative group bg-white dark:bg-[#1a1a2e] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
              >
                {/* Badge tipe media */}
                <div className="absolute top-1 left-1 z-10 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1">
                  {item.media_type === 'photo' && '📷'}
                  {item.media_type === 'video' && '🎥'}
                  {item.media_type === 'maintenance' && '🔧'}
                </div>

                {/* Konten media - ukuran lebih besar */}
                {(item.file_type === 'images' || item.file_type === 'image') && (
                  <img
                    src={item.file_url}
                    alt={item.description || 'Media'}
                    className="w-full h-32 object-cover cursor-pointer"
                    onClick={() => setPreviewMedia(item)}
                  />
                )}
                {(item.file_type === 'videos' || item.file_type === 'video') && (
                  <video
                    src={item.file_url}
                    className="w-full h-40 object-cover rounded-t-lg cursor-pointer"
                    controls
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewMedia(item);
                    }}
                  />
                )}
                {(item.file_type === 'documents' || item.file_type === 'document') && (
                  <div className="w-full h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                    <i className="fa-solid fa-file-pdf text-3xl"></i>
                  </div>
                )}
                {!['images','image','videos','video','documents','document'].includes(item.file_type) && (
                  <div className="w-full h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                    <i className="fa-solid fa-file text-3xl"></i>
                  </div>
                )}

                <div className="p-2">
                  <p className="text-xs font-medium truncate text-gray-700 dark:text-gray-300">
                    {item.description || 'Tanpa deskripsi'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString('id-ID') : '-'}
                  </p>
                </div>

                {session && (
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Form */}
 {/* Upload Form */}
      {session && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
            Tambah {activeTab === 'maintenance' ? 'Perbaikan' : activeTab === 'video' ? 'Video' : 'Foto'}
          </p>

          {/* Drag & Drop Area (multiple) */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
              isDragging
                ? 'border-[#00c8ff] bg-[#00c8ff]/5'
                : 'border-gray-300 dark:border-gray-600 hover:border-[#00c8ff]'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = e.dataTransfer.files;
              if (files && files.length) {
                const validFiles = Array.from(files).filter(f => f.size <= 100 * 1024 * 1024);
                setSelectedFiles(prev => [...prev, ...validFiles]);
              }
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple // <-- multiple
              accept={
                activeTab === 'video'
                  ? 'video/*'
                  : activeTab === 'maintenance'
                  ? 'application/pdf,image/*'
                  : 'image/*,image/heic,image/heif'
              }
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 pointer-events-none">
              {selectedFiles.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-medium">{selectedFiles.length} file siap diupload</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {selectedFiles.slice(0, 5).map((f, idx) => (
                      <span key={idx} className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-[10px]">
                        {f.name} ({(f.size/1024/1024).toFixed(1)}MB)
                      </span>
                    ))}
                    {selectedFiles.length > 5 && <span className="text-gray-400">+{selectedFiles.length-5} lagi</span>}
                  </div>
                  <div className="flex justify-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-red-500 text-[10px] hover:underline"
                    >
                      Hapus semua
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-upload-alt text-2xl text-gray-300 dark:text-gray-500 mb-1 block"></i>
                  <span className="font-medium">Seret file ke sini atau klik untuk pilih</span>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {activeTab === 'video'
                      ? 'MP4, WebM, MOV (max 100MB, otomatis dikompres ke MP4)'
                      : activeTab === 'maintenance'
                      ? 'PDF, Gambar (max 100MB)'
                      : 'JPG, PNG, GIF, WebP, HEIC (max 100MB, HEIC otomatis ke JPEG)'}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <input
              type="text"
              placeholder="Deskripsi (opsional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
            />

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <i className="fa-solid fa-calendar-alt absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#00c8ff]"
                  placeholder="Pilih tanggal & waktu"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
                  setTimestamp(local.toISOString().slice(0, 16));
                }}
                className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition whitespace-nowrap"
              >
                Sekarang
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <button
              onClick={handleMultipleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              className={`w-full py-2 text-xs font-medium rounded-lg transition-all ${
                selectedFiles.length === 0 || uploading
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-[#00c8ff] text-white hover:bg-[#00c8ff]/90 shadow-md hover:shadow-lg'
              }`}
            >
              {uploading ? (
                <span>
                  Uploading {uploadIndex}/{selectedFiles.length} ({totalProgress}%)
                </span>
              ) : (
                <span>📤 Upload {selectedFiles.length} file</span>
              )}
            </button>
            {uploading && (
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00c8ff] transition-all duration-300 rounded-full"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* PREVIEW MODAL - tanpa syarat login */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="max-w-4xl w-full max-h-[90vh] bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {previewMedia.file_type === 'videos' && (
              <video
                src={previewMedia.file_url}
                controls
                autoPlay
                className="w-full h-auto max-h-[80vh]"
              />
            )}
            {previewMedia.file_type === 'images' && (
              <img
                src={previewMedia.file_url}
                alt={previewMedia.description || 'Media'}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
            <div className="p-4 text-white">
              <p>{previewMedia.description || 'Tanpa deskripsi'}</p>
              <p className="text-sm text-gray-400">
                {new Date(previewMedia.timestamp).toLocaleDateString('id-ID')}
              </p>
              <button
                className="mt-2 px-4 py-2 bg-red-500 rounded hover:bg-red-600 transition"
                onClick={() => setPreviewMedia(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}