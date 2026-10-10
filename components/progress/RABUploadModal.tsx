'use client';
import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { rabApi, RABParseResponse, UnmatchedItem } from '@/lib/api/rab';

interface Props {
  open: boolean;
  onClose: () => void;
  buildingId?: string;
  buildingName?: string;
  onSuccess?: (rabId: string) => void;
}

type Phase = 'pick' | 'preview' | 'commit';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(n || 0);

export default function RABUploadModal({
  open, onClose, buildingId = '', buildingName = '', onSuccess,
}: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<RABParseResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setPhase('pick');
    setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handlePick = (f: File | null) => {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('File harus Excel (.xlsx / .xls)');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error('Maksimal 20 MB');
      return;
    }
    setFile(f);
    setPreview(null);
    setPhase('pick');
  };

  // ============ FASE 1: PARSE (dry-run) ============
  const handleParse = async () => {
    if (!file || !token) return;
    setBusy(true);
    try {
      const res = await rabApi.parse(token, file);
      setPreview(res);
      setPhase('preview');

      if (res.ok) {
        toast.success(
          `Preview OK · ${res.summary.matched}/${res.summary.total_items} item match`,
        );
      } else {
        toast.error(
          `${res.summary.unmatched} item lokasinya tidak cocok dengan geodata`,
        );
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : detail?.message || 'Gagal parse RAB';
      toast.error(msg);
      console.error('[RAB parse error]', e.response?.data || e);
    } finally {
      setBusy(false);
    }
  };

  // ============ FASE 2: COMMIT (simpan) ============
  const handleCommit = async () => {
    if (!file || !token) return;
    if (!preview?.ok) {
      toast.error('Perbaiki dulu lokasi yang tidak cocok');
      return;
    }
    setBusy(true);
    try {
      const res = await rabApi.commit(token, file);
      toast.success(res.message || 'RAB berhasil disimpan');
      onSuccess?.(res.rab_id);
      reset();
      onClose();
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : detail?.message || 'Gagal menyimpan RAB';
      toast.error(msg);
      console.error('[RAB commit error]', e.response?.data || e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#2a2a4e]">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-white">
            <i className="fa-solid fa-file-excel text-emerald-500"></i>
            Upload RAB Excel
            {phase === 'preview' && (
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Preview
              </span>
            )}
          </h3>
          <button
            onClick={handleClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* DROPZONE — selalu tampil, tapi disable saat preview */}
          {phase === 'pick' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                handlePick(e.dataTransfer.files?.[0] || null);
              }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                drag
                  ? 'border-[#00c8ff] bg-[#00c8ff]/5'
                  : 'border-gray-300 dark:border-[#2a2a4e] hover:border-[#00c8ff]'
              }`}
            >
              <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2"></i>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {file ? (
                  <span className="font-semibold text-[#00c8ff]">{file.name}</span>
                ) : (
                  'Drag & drop Excel, atau klik untuk pilih'
                )}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Format: .xlsx / .xls · Maks 20MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handlePick(e.target.files?.[0] || null)}
              />
            </div>
          )}

          {/* RINGKASAN PREVIEW */}
          {preview && (
            <div className="space-y-3">
              {/* Stats */}
              <div
                className={`rounded-xl p-3 text-xs border ${
                  preview.ok
                    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                    : 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold mb-1">
                  {preview.ok ? (
                    <>
                      <i className="fa-solid fa-circle-check text-emerald-600"></i>
                      <span className="text-emerald-700 dark:text-emerald-300">
                        Semua lokasi cocok — siap disimpan
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                      <span className="text-rose-700 dark:text-rose-300">
                        {preview.summary.unmatched} item lokasinya tidak cocok
                      </span>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-700 dark:text-gray-300">
                  <div>Item match: <b>{preview.summary.matched}/{preview.summary.total_items}</b></div>
                  <div>Sheet: <b>{preview.sheet_name}</b></div>
                  <div>Total bahan: <b>{formatRp(preview.total_bahan)}</b></div>
                  <div>Total upah: <b>{formatRp(preview.total_upah)}</b></div>
                  <div className="col-span-2 pt-1 border-t border-gray-200 dark:border-[#2a2a4e] mt-1">
                    Total: <b className="text-[#00c8ff] text-sm">{formatRp(preview.total)}</b>
                  </div>
                </div>
              </div>

              {/* Unmatched list */}
              {!preview.ok && preview.unmatched.length > 0 && (
                <div className="border border-rose-200 dark:border-rose-800 rounded-xl overflow-hidden">
                  <div className="bg-rose-100 dark:bg-rose-900/30 px-3 py-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                    <i className="fa-solid fa-list mr-1"></i>
                    Lokasi yang harus diperbaiki
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-rose-100 dark:divide-rose-900/30">
                    {preview.unmatched.map((u: UnmatchedItem) => (
                      <div key={u.kode_unik} className="p-2 text-[11px]">
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-rose-600 dark:text-rose-400 shrink-0">
                            {u.kode_unik}
                          </span>
                          <div className="flex-1">
                            <div className="text-gray-800 dark:text-gray-200 font-medium">
                              {u.uraian}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                              Lokasi di RAB:{' '}
                              <b className="text-rose-600 dark:text-rose-400">
                                {u.lokasi_raw || '(kosong)'}
                              </b>
                            </div>
                            <div className="text-gray-400 mt-0.5">{u.reason}</div>
                            {u.candidates && u.candidates.length > 0 && (
                              <div className="text-gray-500 mt-0.5">
                                Kandidat: {u.candidates.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-[10px] text-rose-700 dark:text-rose-300">
                    <i className="fa-solid fa-circle-info mr-1"></i>
                    Perbaiki nama lokasi di Excel agar sama dengan nama building di
                    geodata, lalu upload ulang.
                  </div>
                </div>
              )}

              {/* Building list */}
              {preview.ok && (
                <div className="border border-gray-200 dark:border-[#2a2a4e] rounded-xl overflow-hidden">
                  <div className="bg-gray-50 dark:bg-[#252540] px-3 py-2 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    <i className="fa-solid fa-building mr-1"></i>
                    Building yang ter-link
                  </div>
                  <div className="p-3 flex flex-wrap gap-1.5">
                    {Array.from(
                      new Set(
                        preview.groups
                          .flatMap((g) => g.items)
                          .map((it) => it.building_id)
                          .filter(Boolean) as string[],
                      ),
                    ).map((b) => (
                      <span
                        key={b}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info building hint */}
          {phase === 'pick' && (buildingId || buildingName) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-[10px] text-blue-700 dark:text-blue-300">
              <i className="fa-solid fa-info-circle mr-1"></i>
              Hint: bangunan sekitar <b>{buildingName || buildingId}</b>. Lokasi
              tiap item tetap divalidasi ke geodata.
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-[#2a2a4e] flex gap-2">
          {phase === 'pick' && (
            <>
              <button
                onClick={handleClose}
                disabled={busy}
                className="flex-1 py-2 text-xs rounded-lg border border-gray-300 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleParse}
                disabled={busy || !file}
                className="flex-1 py-2 text-xs rounded-lg bg-[#00c8ff] text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {busy ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Mengurai...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-magnifying-glass"></i> Preview
                  </>
                )}
              </button>
            </>
          )}

          {phase === 'preview' && (
            <>
              <button
                onClick={() => {
                  setPreview(null);
                  setPhase('pick');
                }}
                disabled={busy}
                className="flex-1 py-2 text-xs rounded-lg border border-gray-300 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 disabled:opacity-50"
              >
                <i className="fa-solid fa-arrow-left mr-1"></i> Ganti File
              </button>
              <button
                onClick={handleCommit}
                disabled={busy || !preview.ok}
                className="flex-1 py-2 text-xs rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                {busy ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Menyimpan...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk"></i> Simpan RAB
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}