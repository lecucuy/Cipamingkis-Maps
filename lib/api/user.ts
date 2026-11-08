// lib/api/user.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const auth = (t?: string | null) =>
  t ? { Authorization: `Bearer ${t}` } : {};

// ============ Types ============
export type SessionItem = {
  id: string;
  device: string;
  ip: string;
  last_active: string;
  created_at: string;
  current: boolean;
};

export type LoginHistoryItem = {
  id: string;
  ip: string;
  device: string;
  timestamp: string;
};

export type MeProfile = {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  phone?: string;
  avatar_url?: string;
  lat?: number | null;
  lon?: number | null;
  polygon?: number[][] | null;
  created_at?: string;
  last_login?: string;
};

// ============ API ============
export const userApi = {
  // -------- PROFILE --------
  me: (token?: string | null): Promise<MeProfile> =>
    axios
      .get(`${API_URL}/users/me`, { headers: auth(token) })
      .then((r) => r.data),

  updateMe: (
    token: string,
    d: { full_name?: string; phone?: string; avatar?: File | null },
  ) => {
    const fd = new FormData();
    if (d.full_name !== undefined) fd.append('full_name', d.full_name);
    if (d.phone !== undefined) fd.append('phone', d.phone);
    if (d.avatar) fd.append('avatar', d.avatar);
    return axios
      .put(`${API_URL}/users/me`, fd, {
        headers: { ...auth(token), 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  changePassword: (token: string, o: string, n: string) =>
    axios
      .put(
        `${API_URL}/users/me/password`,
        { old_password: o, new_password: n },
        { headers: auth(token) },
      )
      .then((r) => r.data),

  activity: (token?: string | null) =>
    axios
      .get(`${API_URL}/users/me/activity`, { headers: auth(token) })
      .then((r) => r.data),

  // -------- SESSIONS (routes/auth.py → /api/auth/sessions) --------
  getSessions: (token: string): Promise<SessionItem[]> =>
    axios
      .get(`${API_URL}/auth/sessions`, { headers: auth(token) })
      .then((r) => r.data?.sessions ?? []),

  revokeSession: (token: string, id: string) =>
    axios
      .delete(`${API_URL}/auth/sessions/${encodeURIComponent(id)}`, {
        headers: auth(token),
      })
      .then((r) => r.data),

  revokeAllOtherSessions: (token: string) =>
    axios
      .post(`${API_URL}/auth/sessions/revoke-all`, {}, { headers: auth(token) })
      .then((r) => r.data),

  // -------- LOGIN HISTORY (routes/auth.py → /api/auth/login-history) --------
  getLoginHistory: (
    token: string,
    limit = 20,
  ): Promise<LoginHistoryItem[]> =>
    axios
      .get(`${API_URL}/auth/login-history`, {
        params: { limit },
        headers: auth(token),
      })
      .then((r) => r.data?.history ?? []),

  // -------- LOGOUT --------
  logout: (token: string) =>
    axios
      .post(`${API_URL}/auth/logout`, {}, { headers: auth(token) })
      .then((r) => r.data),
};

// ============ Backward-compat aliases ============
// (untuk file lama yang masih panggil nama method versi sebelumnya)
Object.assign(userApi, {
  sessions: userApi.getSessions,           // lama: userApi.sessions(token)
  logoutAll: userApi.revokeAllOtherSessions, // lama: userApi.logoutAll(token)
});