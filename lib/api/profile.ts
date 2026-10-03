import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const auth = (token?: string | null) =>
  token ? { Authorization: `Bearer ${token}` } : {};

export const profileApi = {
  // ===== PROFILE =====
  me: (token?: string | null) =>
    axios.get(`${API_URL}/users/me`, { headers: auth(token) }).then(r => r.data),

  updateMe: (token: string, data: { full_name?: string; phone?: string; avatar?: File | null }) => {
    const fd = new FormData();
    if (data.full_name !== undefined) fd.append('full_name', data.full_name);
    if (data.phone !== undefined) fd.append('phone', data.phone);
    if (data.avatar) fd.append('avatar', data.avatar);
    return axios.put(`${API_URL}/users/me`, fd, {
      headers: { ...auth(token), 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  changePassword: (token: string, oldPass: string, newPass: string) =>
    axios.put(
      `${API_URL}/users/me/password`,
      { old_password: oldPass, new_password: newPass },
      { headers: auth(token) }
    ).then(r => r.data),

  // ===== ACTIVITY / STATS =====
  activity: (token?: string | null, params?: any) =>
    axios.get(`${API_URL}/users/me/activity`, { headers: auth(token), params }).then(r => r.data),

  // ===== FINANCE (role-gated di backend) =====
  financeSummary: (token: string, params?: any) =>
    axios.get(`${API_URL}/finance/summary`, { headers: auth(token), params }).then(r => r.data),

  financeTransactions: (token: string, params?: any) =>
    axios.get(`${API_URL}/finance/transactions`, { headers: auth(token), params }).then(r => r.data),

  financeCreate: (token: string, body: any) =>
    axios.post(`${API_URL}/finance/transactions`, body, { headers: auth(token) }).then(r => r.data),

  // ===== PROGRESS / PEKERJAAN =====
  progressList: (token?: string | null, params?: any) =>
    axios.get(`${API_URL}/progress/tasks`, { headers: auth(token), params }).then(r => r.data),

  progressUpdate: (token: string, taskId: string, body: any) =>
    axios.patch(`${API_URL}/progress/tasks/${taskId}`, body, { headers: auth(token) }).then(r => r.data),

  // ===== SECURITY / SESSIONS =====
  sessions: (token: string) =>
    axios.get(`${API_URL}/users/me/sessions`, { headers: auth(token) }).then(r => r.data),

  revokeSession: (token: string, sessionId: string) =>
    axios.delete(`${API_URL}/users/me/sessions/${sessionId}`, { headers: auth(token) }).then(r => r.data),
};