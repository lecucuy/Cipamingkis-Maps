// lib/realtime.ts
//
// Satu sumber kebenaran untuk URL realtime (live + ugv + ws).
// Ubah di sini kalau URL backend berubah.

export const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:5002/api';

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || REALTIME_URL.replace(/^http/, 'ws');

/** URL WebSocket untuk live streaming (streamer / viewer). */
export function liveWsUrl(
  roomId: string,
  role: 'streamer' | 'viewer',
  token?: string,
): string {
  const params = new URLSearchParams({ role });
  if (token) params.set('token', token);
  return `${WS_URL}/ws/live/${roomId}?${params.toString()}`;
}

/** URL WebSocket untuk channel global frontend (notifikasi / dll). */
export function frontendWsUrl(token?: string): string {
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  const qs = params.toString();
  return `${WS_URL}/ws/frontend${qs ? `?${qs}` : ''}`;
}