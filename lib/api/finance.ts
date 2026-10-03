import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const auth = (t?: string | null) => (t ? { Authorization: `Bearer ${t}` } : {});

export type TxStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface FinanceSummary {
  budget: number;
  spent: number;
  remaining: number;
  pending_count: number;
}

export interface FinanceTransaction {
  id: string;
  amount: number;
  category?: string;
  description?: string;
  status: TxStatus;
  building_id?: string;
  building_name?: string;
  receipt_url?: string;
  created_by_name?: string;
  created_at: string;
  approved_by_name?: string;
  approved_at?: string;
}

export const financeApi = {
  summary: (token: string, params?: { building_id?: string; from?: string; to?: string }) =>
    axios.get(`${API_URL}/finance/summary`, { headers: auth(token), params })
      .then(r => r.data as FinanceSummary),

  transactions: (
    token: string,
    params?: { status?: TxStatus; building_id?: string; page?: number; limit?: number }
  ) =>
    axios.get(`${API_URL}/finance/transactions`, { headers: auth(token), params })
      .then(r => r.data as { items: FinanceTransaction[]; total: number }),

  create: (token: string, body: Partial<FinanceTransaction> & { receipt?: File }) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (v == null) return;
      if (k === 'receipt' && v instanceof File) fd.append('receipt', v);
      else fd.append(k, String(v));
    });
    return axios.post(`${API_URL}/finance/transactions`, fd, {
      headers: { ...auth(token), 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  approve: (token: string, id: string, note?: string) =>
    axios.post(`${API_URL}/finance/transactions/${id}/approve`,
      { note }, { headers: auth(token) }).then(r => r.data),

  reject: (token: string, id: string, note: string) =>
    axios.post(`${API_URL}/finance/transactions/${id}/reject`,
      { note }, { headers: auth(token) }).then(r => r.data),
};