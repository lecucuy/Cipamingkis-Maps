import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const auth = (t?: string | null) => (t ? { Authorization: `Bearer ${t}` } : {});

export type ProgressStatus = 'planned' | 'ongoing' | 'done' | 'blocked';

export interface ProgressTask {
  id: string;
  title: string;
  description?: string;
  status: ProgressStatus;
  progress: number;           // 0-100
  building_id?: string;
  building_name?: string;
  assignee_id?: string;
  assignee_name?: string;
  budget?: number;
  spent?: number;
  start_date?: string;
  due_date?: string;
  updated_at?: string;
  photos?: string[];
}

export interface ProgressUpdatePayload {
  status?: ProgressStatus;
  progress?: number;
  note?: string;
  photos?: File[];
}

export const progressApi = {
  list: (token: string, params?: { status?: ProgressStatus; assigned_to_me?: boolean }) =>
    axios.get(`${API_URL}/progress/tasks`, { headers: auth(token), params })
      .then(r => r.data as { items: ProgressTask[] }),

  detail: (token: string, id: string) =>
    axios.get(`${API_URL}/progress/tasks/${id}`, { headers: auth(token) }).then(r => r.data),

  update: (token: string, id: string, body: Partial<ProgressTask>) =>
    axios.patch(`${API_URL}/progress/tasks/${id}`, body, { headers: auth(token) }).then(r => r.data),

  addUpdate: (token: string, id: string, payload: ProgressUpdatePayload) => {
    const fd = new FormData();
    if (payload.status) fd.append('status', payload.status);
    if (payload.progress != null) fd.append('progress', String(payload.progress));
    if (payload.note) fd.append('note', payload.note);
    (payload.photos || []).forEach(f => fd.append('photos', f));
    return axios.post(`${API_URL}/progress/tasks/${id}/updates`, fd, {
      headers: { ...auth(token), 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};