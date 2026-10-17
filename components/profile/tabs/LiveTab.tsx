'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import LiveStreamer from '@/components/live/LiveStreamer';
import LiveViewer from '@/components/live/LiveViewer';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Room {
  room_id: string;
  streamer_id: string;
  streamer_name: string;
  building_id: string;
  building_name: string;
  title: string;
  started_at: string;
  viewers: number;
  is_mine: boolean;
}

interface Props {
  role?: string | null;
  buildings?: string[];
}

export default function LiveTab({ role, buildings = [] }: Props) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string | undefined;

  const roleNorm = (role || '').toLowerCase();
  const canLive = roleNorm === 'tpop';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [myRoomId, setMyRoomId] = useState<string | null>(null);

  // form mulai live
  const [showStartForm, setShowStartForm] = useState(false);
  const [buildingId, setBuildingId] = useState(buildings[0] || '');
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);

  const loadRooms = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/live/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRooms(r.data.items || []);
    } catch (e: any) {
      if (e.response?.status === 403) {
        setRooms([]);
      } else {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadRooms(); }, [loadRooms]);
  useEffect(() => {
    const t = setInterval(loadRooms, 10000);
    return () => clearInterval(t);
  }, [loadRooms]);

  if (!canLive) {
    return (
      <div className="text-center py-10 text-gray-400">
        <i className="fa-solid fa-lock text-3xl mb-2 block" />
        <p className="text-sm">Menu ini khusus untuk TPOP</p>
      </div>
    );
  }

  const handleStart = async () => {
    if (!token) return;
    if (!buildingId) {
      toast.error('Pilih bangunan dulu');
      return;
    }
    setStarting(true);
    try {
      const r = await axios.post(
        `${API_URL}/live/start`,
        { building_id: buildingId, building_name: buildingId, title },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMyRoomId(r.data.room_id);
      setShowStartForm(false);
      toast.success('🔴 Live dimulai!');
      await loadRooms();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal mulai live');
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!token || !myRoomId) return;
    try {
      await axios.post(
        `${API_URL}/live/${myRoomId}/stop`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMyRoomId(null);
      toast.success('Live dihentikan');
      await loadRooms();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal stop live');
    }
  };

  // ============ MODE STREAMER ============
  if (myRoomId && token) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-satellite-dish text-rose-500" />
            Sedang Live
          </h3>
          <button
            onClick={() => setMyRoomId(null)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            <i className="fa-solid fa-xmark mr-1" /> Sembunyikan
          </button>
        </div>
        <LiveStreamer
          roomId={myRoomId}
          token={token}
          buildingName={buildingId}
          onStop={handleStop}
        />
      </div>
    );
  }

  // ============ MODE VIEWER ============
  if (activeRoom && token) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white truncate">
              {activeRoom.title}
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              <i className="fa-solid fa-user mr-1" />
              {activeRoom.streamer_name} · {activeRoom.building_name}
            </p>
          </div>
          <button
            onClick={() => setActiveRoom(null)}
            className="text-xs text-gray-500 hover:text-gray-700 shrink-0"
          >
            <i className="fa-solid fa-arrow-left mr-1" /> Kembali
          </button>
        </div>
        <LiveViewer
          roomId={activeRoom.room_id}
          token={token}
          onClose={() => setActiveRoom(null)}
        />
      </div>
    );
  }

  // ============ MODE LIST ============
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <i className="fa-solid fa-satellite-dish text-[#00c8ff]" />
          Live Streaming
        </h3>
        {!showStartForm && (
          <button
            onClick={() => setShowStartForm(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-600 flex items-center gap-1.5"
          >
            <i className="fa-solid fa-circle-dot" /> Mulai Live
          </button>
        )}
      </div>

      {showStartForm && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              <i className="fa-solid fa-circle-dot mr-1" /> Mulai Siaran Baru
            </p>
            <button
              onClick={() => setShowStartForm(false)}
              className="text-rose-400 hover:text-rose-600"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-300 mb-1">
              Bangunan / Lokasi
            </label>
            {buildings.length > 0 ? (
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-gray-800 dark:text-gray-200"
              >
                {buildings.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                placeholder="Nama bangunan..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-gray-800 dark:text-gray-200"
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-300 mb-1">
              Judul (opsional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Inspeksi saluran induk..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-gray-800 dark:text-gray-200"
            />
          </div>

          <button
            onClick={handleStart}
            disabled={starting || !buildingId}
            className="w-full py-2.5 text-xs rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {starting ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Memulai...</>
            ) : (
              <><i className="fa-solid fa-circle-play" /> Mulai Siaran</>
            )}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-3 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <i className="fa-solid fa-satellite-dish text-3xl mb-2 block" />
          <p className="text-sm">Belum ada siaran live</p>
          <p className="text-[10px] mt-1">Klik "Mulai Live" untuk memulai</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map(room => (
            <div
              key={room.room_id}
              onClick={() => setActiveRoom(room)}
              className="p-3 rounded-xl border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] hover:border-rose-400 transition cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 relative">
                  <i className="fa-solid fa-satellite-dish text-rose-500" />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">
                      {room.title}
                    </p>
                    <span className="text-[9px] font-bold uppercase bg-rose-500 text-white px-1.5 py-0.5 rounded-full shrink-0">
                      LIVE
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <i className="fa-solid fa-user" /> {room.streamer_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="fa-solid fa-location-dot" /> {room.building_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="fa-solid fa-eye" /> {room.viewers}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}