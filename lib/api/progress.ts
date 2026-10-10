import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type ProgressStatus = 'planned' | 'ongoing' | 'done' | 'blocked';

export interface ProgressTask {
  id: string;
  title: string;
  description?: string;
  status: ProgressStatus;
  progress: number;
  building_id?: string;
  building_name?: string;
  location?: { lat: number; lon: number } | null;
  budget?: number;
  volume?: number;
  unit?: string;
  start_date?: string;
  due_date?: string;
  category?: string;
  photos?: Array<{ url: string; description?: string; created_at?: string }>;
  created_at?: string;
}

const h = (t?: string) => (t ? { Authorization: `Bearer ${t}` } : {});

export const progressApi = {
  list: async (token: string, params: Record<string, string> = {}) => {
    const r = await axios.get(`${API_URL}/progress/tasks`, { headers: h(token), params });
    return r.data;
  },
  create: async (token: string, body: Partial<ProgressTask>) => {
    const r = await axios.post(`${API_URL}/progress/tasks`, body, { headers: h(token) });
    return r.data;
  },
  update: async (token: string, id: string, body: Partial<ProgressTask>) => {
    const r = await axios.put(`${API_URL}/progress/tasks/${id}`, body, { headers: h(token) });
    return r.data;
  },
  uploadRAB: async (token: string, file: File, buildingId: string, buildingName: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('building_id', buildingId);
    fd.append('building_name', buildingName);
    const r = await axios.post(`${API_URL}/progress/upload-rab`, fd, {
      headers: { ...h(token), 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },
  uploadPhoto: async (token: string, taskId: string, file: File, description = '') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('description', description);
    const r = await axios.post(`${API_URL}/progress/tasks/${taskId}/photos`, fd, {
      headers: { ...h(token), 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },
};