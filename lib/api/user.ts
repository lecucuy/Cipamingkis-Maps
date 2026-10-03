import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const auth = (t?: string | null) => (t ? { Authorization: `Bearer ${t}` } : {});

export const userApi = {
  me: (token?: string | null) =>
    axios.get(`${API_URL}/users/me`, { headers: auth(token) }).then(r => r.data),

  updateMe: (token: string, d: { full_name?: string; phone?: string; avatar?: File | null }) => {
    const fd = new FormData();
    if (d.full_name !== undefined) fd.append('full_name', d.full_name);
    if (d.phone !== undefined) fd.append('phone', d.phone);
    if (d.avatar) fd.append('avatar', d.avatar);
    return axios.put(`${API_URL}/users/me`, fd, {
      headers: { ...auth(token), 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  changePassword: (token: string, o: string, n: string) =>
    axios.put(`${API_URL}/users/me/password`,
      { old_password: o, new_password: n }, { headers: auth(token) }).then(r => r.data),

  activity: (token?: string | null) =>
    axios.get(`${API_URL}/users/me/activity`, { headers: auth(token) }).then(r => r.data),

  sessions: (token: string) =>
    axios.get(`${API_URL}/users/me/sessions`, { headers: auth(token) }).then(r => r.data),

  revokeSession: (token: string, id: string) =>
    axios.delete(`${API_URL}/users/me/sessions/${id}`, { headers: auth(token) }).then(r => r.data),

  logoutAll: (token: string) =>
    axios.post(`${API_URL}/users/me/logout-all`, {}, { headers: auth(token) }).then(r => r.data),
};