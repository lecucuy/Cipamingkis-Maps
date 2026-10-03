import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const auth = (t?: string | null) => (t ? { Authorization: `Bearer ${t}` } : {});

export interface MyUploadItem {
  _id: string;
  building_id: string;
  building_name?: string;
  building_lat?: number;
  building_lon?: number;
  media_type: 'photo' | 'video' | 'maintenance' | 'model_3d';
  file_type: string;
  file_url: string;
  description: string;
  timestamp: string;
  created_at: string;
  like_count?: number;
  share_count?: number;
}

export const uploadsApi = {
  /** Daftar upload milik user, filter by type, paginated */
  list: (
    token: string,
    params?: {
      media_type?: 'photo' | 'video' | 'maintenance' | 'model_3d';
      page?: number;
      limit?: number;
      q?: string;
    }
  ) =>
    axios.get(`${API_URL}/users/me/uploads`, { headers: auth(token), params })
      .then(r => r.data as { items: MyUploadItem[]; total: number; page: number }),

  /** Hapus */
  remove: (token: string, id: string) =>
    axios.delete(`${API_URL}/buildings/media/${id}`, { headers: auth(token) }).then(r => r.data),

  /** Buka lokasi di map (return url untuk share atau koordinat) */
  locate: (item: MyUploadItem) => ({
    lat: item.building_lat ?? null,
    lon: item.building_lon ?? null,
  }),
};


// lib/api/uploads.ts — tambahkan
export const mentionApi = {
  search: (token: string, q: string) =>
    axios.get(`${API_URL}/users/me/search`, {
      headers: auth(token),
      params: { q, limit: 8 },
    }).then(r => r.data as { items: MentionUser[] }),
};

export interface MentionUser {
  id: string;
  username: string;
  full_name?: string;
  role?: string;
  avatar_url?: string;
  tags?: string[];
}