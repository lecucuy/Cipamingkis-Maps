'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { rabApi, RABDetail, RABListItemDetail } from '@/lib/api/rab';
import RABItemMediaModal from './RABItemMediaModal';
import MediaPreview from './MediaPreview';
import { normalizeRole } from '@/types/pelaporan';

const MIN_PHOTOS = 3;
const MIN_VIDEOS = 1;

// Roles yang boleh lihat progress & capture
const PROGRESS_ROLES = ['admin', 'supervisor', 'juru'];

interface Props {
  rabId: string;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export default function RABDetailModal({ rabId, open, onClose, onChanged }: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  // 🔥 GATING role
  const role = normalizeRole(session?.user?.role);
  const canSeeProgress = !!role && PROGRESS_ROLES.includes(role);

  // === state ===
  const [detail, setDetail] = useState<RABDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openMedia, setOpenMedia] = useState<string | null>(null);

  // 🔥 preview media (semua role, tidak butuh login)
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    type: 'photo' | 'video';
    description?: string;
    filename?: string;
  } | null>(null);

  // 🔥 ownership — harus SETELAH `detail` & `canSeeProgress`
  const isOwner = !!detail?.is_owner;
  const canEdit  = canSeeProgress && isOwner;


  const load = async () => {
    setLoading(true);
    try {
      const r = token
        ? await rabApi.detail(token, rabId)
        : await rabApi.detail(rabId);
      setDetail(r);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal memuat detail RAB');
    } finally {
      setLoading(false);
    }
  };
    useEffect(() => { if (open) load(); }, [open, rabId]);

  const handleStart = async () => {
    if (!token || !detail) return;
    setBusy(true);
    try {
      await rabApi.start(token, rabId);
      toast.success('RAB mulai dikerjakan');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal memulai RAB');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateItem = async (item: RABListItemDetail, progress: number) => {
    if (!token) return;

    if (progress >= 100) {
      const photos = (item.media || []).filter(m => m.type === 'photo').length;
      const videos = (item.media || []).filter(m => m.type === 'video').length;
      if (photos < MIN_PHOTOS || videos < MIN_VIDEOS) {
        toast.error(
          `Bukti belum cukup: ${photos}/${MIN_PHOTOS} foto, ${videos}/${MIN_VIDEOS} video. Upload dulu.`,
        );
        setOpenMedia(item.kode_unik);
        return;
      }
    }

    setBusy(true);
    try {
      const r = await rabApi.updateItem(token, rabId, item.kode_unik, progress);
      toast.success(`Progress ${item.kode_unik}: ${progress}%`);
      await load();
      onChanged?.();
      if (r.rab_status === 'selesai') {
        toast.success('🎉 RAB selesai 100%!', { duration: 5000 });
      }
    } catch (e: any) {
      const d = e.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : d?.message || 'Gagal update progress');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-[#2a2a4e] flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-white">
            <i className="fa-solid fa-file-invoice-dollar text-[#00c8ff]" />
            {detail?.judul || 'Detail RAB'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !detail ? (
            <p className="text-center text-gray-400 text-sm">RAB tidak ditemukan</p>
          ) : (
            <>
              {/* SUMMARY */}
              <div className="rounded-xl p-3 bg-gray-50 dark:bg-[#0f0f23] border border-gray-200 dark:border-[#2a2a4e]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    Status:{' '}
                    <b className="text-gray-700 dark:text-gray-200 uppercase">
                      {detail.status}
                    </b>
                  </span>
                  {canSeeProgress && (
                    <span className="font-mono font-bold text-[#00c8ff]">
                      {(detail.progress ?? 10).toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Progress bar RAB — hanya role berwenang */}
                {canSeeProgress && (
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500 bg-[#00c8ff]"
                      style={{ width: `${detail.progress ?? 10}%` }}
                    />
                  </div>
                )}
              </div>

              {canSeeProgress && !isOwner && detail.status !== 'draft' && (
                <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#0f0f23] border border-slate-200 dark:border-[#2a2a4e] text-[10px] text-slate-500 flex items-center gap-2">
                  <i className="fa-solid fa-eye" />
                  Mode lihat — hanya uploader RAB yang bisa update progress & bukti.
                </div>
              )}

              {/* TOMBOL MULAI */}
              {detail.status === 'draft' && canSeeProgress && (
                <button
                  onClick={handleStart}
                  disabled={busy}
                  className="w-full py-2.5 text-xs rounded-lg bg-[#00c8ff] text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <><i className="fa-solid fa-spinner fa-spin" /> Memproses...</>
                  ) : (
                    <><i className="fa-solid fa-play" /> Mulai Kerjakan</>
                  )}
                </button>
              )}

              {/* GROUPS */}
              {detail.groups.map(g => (
                <div key={g.kode} className="border border-gray-200 dark:border-[#2a2a4e] rounded-xl overflow-hidden">
                  <div className="bg-gray-50 dark:bg-[#252540] px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                    <span className="font-mono mr-1">{g.kode}.</span>
                    {g.nama}
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-[#2a2a4e]">
                    {g.items.map(it => {
                      const isOpen = expanded === it.kode_unik;
                      const itemStatus = it.status;
                      const sColor =
                        itemStatus === 'done' ? '#10b981'
                        : itemStatus === 'ongoing' ? '#00c8ff'
                        : '#64748b';

                      const photos = (it.media || []).filter(m => m.type === 'photo').length;
                      const videos = (it.media || []).filter(m => m.type === 'video').length;
                      const can100 = photos >= MIN_PHOTOS && videos >= MIN_VIDEOS;

                      return (
                        <div key={it.kode_unik} className="p-3">
                          <div
                            className="flex items-start gap-2 cursor-pointer"
                            onClick={() => setExpanded(isOpen ? null : it.kode_unik)}
                          >
                            <span className="text-[10px] font-mono text-gray-500 mt-0.5 shrink-0">
                              {it.kode_unik}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                                {it.uraian}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-500">
                                <span className="font-mono">
                                  {it.volume} {it.satuan}
                                </span>
                                <span
                                  className="px-1.5 py-0.5 rounded-full font-semibold uppercase"
                                  style={{ background: `${sColor}20`, color: sColor }}
                                >
                                  {itemStatus}
                                </span>
                              </div>

                              {/* Progress bar item — hanya role berwenang */}
                              {canSeeProgress && (
                                <div className="mt-2">
                                  <div className="h-1 bg-gray-100 dark:bg-[#1a1a2e] rounded-full overflow-hidden">
                                    <div
                                      className="h-full transition-all"
                                      style={{
                                        width: `${it.progress ?? 0}%`,
                                        background: sColor,
                                      }}
                                    />
                                  </div>
                                  <p className="text-[10px] font-mono mt-0.5" style={{ color: sColor }}>
                                    {it.progress ?? 0}%
                                  </p>
                                </div>
                              )}
                            </div>
                            <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-gray-400 text-[10px] mt-1`} />
                          </div>

                          {/* Detail expand */}
                          {isOpen && (
                            <div className="mt-3 pl-6 space-y-2">
                              {it.bahan.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Bahan</p>
                                  {it.bahan.map((b, i) => (
                                    <div key={i} className="flex justify-between text-[10px] text-gray-600 dark:text-gray-400">
                                      <span>{b.nama}</span>
                                      <span className="font-mono">{b.volume} {b.satuan}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {it.upah.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Upah</p>
                                  {it.upah.map((u, i) => (
                                    <div key={i} className="flex justify-between text-[10px] text-gray-600 dark:text-gray-400">
                                      <span>{u.nama}</span>
                                      <span className="font-mono">{u.oh} OH × {u.hari} hari</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* BUKTI MEDIA — klik thumbnail untuk preview (semua role) */}
                              <div className="pt-1">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase">
                                    Bukti Pekerjaan
                                  </p>
                                  {canSeeProgress && (
                                    <div className="flex gap-2 text-[10px]">
                                      <span className={photos >= MIN_PHOTOS ? 'text-emerald-600' : 'text-gray-400'}>
                                        <i className="fa-solid fa-image mr-1" />
                                        {photos}/{MIN_PHOTOS}
                                      </span>
                                      <span className={videos >= MIN_VIDEOS ? 'text-emerald-600' : 'text-gray-400'}>
                                        <i className="fa-solid fa-video mr-1" />
                                        {videos}/{MIN_VIDEOS}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {(it.media || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {(it.media || []).slice(0, 8).map(m => (
                                      <div
                                        key={m.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewMedia({
                                            url: m.url,
                                            type: m.type as 'photo' | 'video',
                                            description: m.description,
                                            filename: m.filename,
                                          });
                                        }}
                                        className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 dark:border-[#2a2a4e] cursor-pointer hover:border-[#00c8ff] transition"
                                        title={m.type === 'photo' ? 'Lihat foto' : 'Lihat video'}
                                      >
                                        {m.type === 'photo' ? (
                                          <img src={m.url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full bg-black flex items-center justify-center text-white text-[10px]">
                                            <i className="fa-solid fa-play" />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {(it.media || []).length > 8 && (
                                      <div className="w-10 h-10 rounded-md border border-dashed border-gray-300 dark:border-[#2a2a4e] flex items-center justify-center text-[9px] text-gray-400">
                                        +{(it.media || []).length - 8}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* AKSI PROGRESS & CAPTURE — hanya role berwenang */}
                              {canSeeProgress && detail.status !== 'draft' && (
                                <>
                                  <div className="flex gap-1.5 pt-2">
                                    <button
                                      onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/*';
                                        (input as any).capture = 'environment';
                                        input.onchange = async (e: any) => {
                                          const file = e.target.files?.[0];
                                          if (!file || !token) return;
                                          setBusy(true);
                                          try {
                                            await rabApi.uploadItemMedia(
                                              token, rabId, it.kode_unik, file, 'photo',
                                              `Capture ${new Date().toLocaleString('id-ID')}`,
                                            );
                                            toast.success('📸 Foto tersimpan');
                                            await load();
                                            onChanged?.();
                                          } catch (err: any) {
                                            const d = err.response?.data?.detail;
                                            toast.error(typeof d === 'string' ? d : d?.message || 'Gagal upload');
                                          } finally {
                                            setBusy(false);
                                          }
                                        };
                                        input.click();
                                      }}
                                      disabled={busy}
                                      className="flex-1 py-1.5 text-[10px] rounded-md bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      <i className="fa-solid fa-camera" /> Foto
                                    </button>

                                    <button
                                      onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'video/*';
                                        (input as any).capture = 'environment';
                                        input.onchange = async (e: any) => {
                                          const file = e.target.files?.[0];
                                          if (!file || !token) return;
                                          setBusy(true);
                                          try {
                                            await rabApi.uploadItemMedia(
                                              token, rabId, it.kode_unik, file, 'video',
                                              `Capture ${new Date().toLocaleString('id-ID')}`,
                                            );
                                            toast.success('🎥 Video tersimpan');
                                            await load();
                                            onChanged?.();
                                          } catch (err: any) {
                                            const d = err.response?.data?.detail;
                                            toast.error(typeof d === 'string' ? d : d?.message || 'Gagal upload');
                                          } finally {
                                            setBusy(false);
                                          }
                                        };
                                        input.click();
                                      }}
                                      disabled={busy}
                                      className="flex-1 py-1.5 text-[10px] rounded-md bg-purple-500 text-white font-semibold hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      <i className="fa-solid fa-video" /> Video
                                    </button>

                                    <button
                                      onClick={() => setOpenMedia(it.kode_unik)}
                                      className="flex-1 py-1.5 text-[10px] rounded-md border border-gray-300 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:border-[#00c8ff] hover:text-[#00c8ff] flex items-center justify-center gap-1"
                                    >
                                      <i className="fa-solid fa-folder-open" /> Kelola
                                    </button>
                                  </div>

                                  <div className="flex gap-1 pt-1.5">
                                    {[25, 50, 75, 100].map(pct => {
                                      const is100 = pct === 100;
                                      const disabled = busy || (is100 && !can100);

                                      return (
                                        <button
                                          key={pct}
                                          onClick={() => handleUpdateItem(it, pct)}
                                          disabled={disabled}
                                          title={is100 && !can100
                                            ? `Perlu ${MIN_PHOTOS} foto + ${MIN_VIDEOS} video dulu`
                                            : ''}
                                          className={`flex-1 py-1 text-[10px] rounded-md border transition ${
                                            disabled
                                              ? 'border-gray-200 dark:border-[#2a2a4e] text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                              : 'border-gray-200 dark:border-[#2a2a4e] hover:border-[#00c8ff] hover:text-[#00c8ff]'
                                          }`}
                                        >
                                          {pct}%{is100 && !can100 && ' 🔒'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-[#2a2a4e]">
          <button
            onClick={onClose}
            className="w-full py-2 text-xs rounded-lg border border-gray-300 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* MODAL MEDIA — hanya role berwenang untuk upload/kelola */}
      {openMedia && detail && canSeeProgress && (() => {
        const item = detail.groups.flatMap(g => g.items).find(it => it.kode_unik === openMedia);
        if (!item) return null;
        const photos = (item.media || []).filter(m => m.type === 'photo').length;
        const videos = (item.media || []).filter(m => m.type === 'video').length;
        return (
          <RABItemMediaModal
            open={true}
            onClose={() => setOpenMedia(null)}
            rabId={rabId}
            kodeUnik={openMedia}
            itemUraian={item.uraian}
            existingMedia={item.media || []}
            stats={{
              photo_count: photos,
              video_count: videos,
              can_done: photos >= MIN_PHOTOS && videos >= MIN_VIDEOS,
              min_photos: MIN_PHOTOS,
              min_videos: MIN_VIDEOS,
            }}
            onChanged={load}
          />
        );
      })()}

      {/* PREVIEW FOTO/VIDEO — untuk SEMUA role, tidak butuh login */}
      {previewMedia && (
        <MediaPreview
          url={previewMedia.url}
          type={previewMedia.type}
          description={previewMedia.description}
          filename={previewMedia.filename}
          onClose={() => setPreviewMedia(null)}
        />
      )}
    </div>
  );
}