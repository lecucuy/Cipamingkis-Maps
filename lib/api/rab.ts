// lib/api/rab.ts
import axios from 'axios';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// ============ BASE TYPES ============
export interface RABItem {
  kode_unik: string;
  no_item?: number | string;
  lokasi_raw: string | null;
  building_id: string | null;
  match_status: string | null;
  uraian: string;
  volume: number;
  satuan: string;
  bahan: Array<{
    nama: string;
    volume: number;
    satuan: string;
    harga_satuan: number;
    jumlah: number;
  }>;
  upah: Array<{
    nama: string;
    oh: number;
    hari: number;
    volume: number;
    satuan: string;
    upah_harian: number;
    jumlah: number;
  }>;
  subtotal_bahan: number;
  subtotal_upah: number;
  subtotal: number;
}

export interface RABGroup {
  kode: string;
  nama: string;
  items: RABItem[];
  subtotal_bahan: number;
  subtotal_upah: number;
  subtotal: number;
}

// ============ MEDIA ============
export interface RABMedia {
  id: string;
  type: 'photo' | 'video';
  filename: string;
  url: string;
  file_key: string;
  size: number;
  mime: string;
  description?: string;
  uploaded_by?: string;
  uploaded_by_email?: string;
  uploaded_at?: string;
}

export interface RABMediaStats {
  photo_count: number;
  video_count: number;
  can_done: boolean;
  min_photos: number;
  min_videos: number;
}

// ============ PARSE / COMMIT ============
export interface UnmatchedItem {
  kode_unik: string;
  uraian: string;
  lokasi_raw: string | null;
  reason: string;
  candidates?: string[];
}

export interface RABParseResponse {
  ok: boolean;
  file_hash: string;
  filename: string;
  sheet_name: string;
  summary: {
    total_items: number;
    matched: number;
    unmatched: number;
    total_bahan: number;
    total_upah: number;
    total: number;
  };
  unmatched: UnmatchedItem[];
  groups: RABGroup[];
  total_bahan: number;
  total_upah: number;
  total: number;
}

export interface RABCommitResponse {
  message: string;
  rab_id: string;
  building_ids: string[];
  total: number;
  summary: RABParseResponse['summary'];
}

// ============ LIST / DETAIL ============
export interface RABListItem {
  id: string;
  judul: string;
  filename: string;
  building_ids: string[];
  total: number;
  total_bahan: number;
  total_upah: number;
  status: 'draft' | 'berjalan' | 'selesai';
  progress: number;
  created_at: string;
}

export interface RABListItemDetail {
  kode_unik: string;
  uraian: string;
  building_id: string | null;
  lokasi_raw: string | null;
  volume: number;
  satuan: string;
  status: 'pending' | 'ongoing' | 'done';
  progress: number;
  bobot: number;
  subtotal: number;
  subtotal_bahan: number;
  subtotal_upah: number;
  bahan: RABItem['bahan'];
  upah: RABItem['upah'];
  media?: RABMedia[];
  notes?: string;
}

export interface RABDetail {
  id: string;
  judul: string;
  filename: string;
  sheet_name: string;
  building_ids: string[];
  groups: Array<{
    kode: string;
    nama: string;
    subtotal: number;
    items: RABListItemDetail[];
  }>;
  total: number;
  total_bahan: number;
  total_upah: number;
  status: 'draft' | 'berjalan' | 'selesai';
  progress: number;
  created_at: string;
}

// ============ API ============
export const rabApi = {
  // -------- parse / commit --------
  async parse(token: string, file: File): Promise<RABParseResponse> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await client.post<RABParseResponse>(
      '/rab/parse',
      fd,
      authHeader(token),
    );
    return data;
  },

  async commit(token: string, file: File): Promise<RABCommitResponse> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await client.post<RABCommitResponse>(
      '/rab/commit',
      fd,
      authHeader(token),
    );
    return data;
  },

  // -------- list / detail --------
async list(
  tokenOrBuildingId?: string,
  buildingIdMaybe?: string,
): Promise<{ items: RABListItem[] }> {
  let token: string | undefined;
  let buildingId: string | undefined;

  if (buildingIdMaybe !== undefined) {
    // dipanggil: list(token, buildingId)
    token = tokenOrBuildingId;
    buildingId = buildingIdMaybe;
  } else {
    // dipanggil: list(buildingId) — guest mode
    buildingId = tokenOrBuildingId;
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const { data } = await client.get('/rab', {
    headers,
    params: buildingId ? { building_id: buildingId } : {},
  });
  return data;
},

async detail(
  tokenOrRabId: string,
  rabIdMaybe?: string,
): Promise<RABDetail> {
  let token: string | undefined;
  let rabId: string;

  if (rabIdMaybe !== undefined) {
    // dipanggil: detail(token, rabId)
    token = tokenOrRabId;
    rabId = rabIdMaybe;
  } else {
    // dipanggil: detail(rabId) — guest mode
    rabId = tokenOrRabId;
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const { data } = await client.get(`/rab/${rabId}`, { headers });
  return data;
},


  // -------- workflow --------
  async start(token: string, rabId: string) {
    const { data } = await client.post(
      `/rab/${rabId}/start`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data;
  },

  async updateItem(
    token: string,
    rabId: string,
    kodeUnik: string,
    progress: number,
    notes?: string,
  ) {
    const { data } = await client.patch(
      `/rab/${rabId}/items/${encodeURIComponent(kodeUnik)}`,
      { progress, notes },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data;
  },

  // -------- media bukti --------
  async uploadItemMedia(
    token: string,
    rabId: string,
    kodeUnik: string,
    file: File,
    mediaType: 'photo' | 'video',
    description: string = '',
  ): Promise<{ media: RABMedia; stats: RABMediaStats }> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('media_type', mediaType);
    fd.append('description', description);
    const { data } = await client.post(
      `/rab/${rabId}/items/${encodeURIComponent(kodeUnik)}/media`,
      fd,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data;
  },

  async deleteItemMedia(
    token: string,
    rabId: string,
    kodeUnik: string,
    mediaId: string,
  ): Promise<{ stats: RABMediaStats }> {
    const { data } = await client.delete(
      `/rab/${rabId}/items/${encodeURIComponent(kodeUnik)}/media/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data;
  },
};