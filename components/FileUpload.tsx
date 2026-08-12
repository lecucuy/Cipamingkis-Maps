'use client';

import { useState } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

export default function FileUpload({ userId, onUploadSuccess }: { userId: string, onUploadSuccess?: (file: any) => void }) {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setMessage("Pilih file dulu!");
      return;
    }
    if (!session?.accessToken) {
      setMessage("Login dulu!");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);

    setUploading(true);
    setMessage("");

    try {
      const res = await axios.post(`${API_URL}/files/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${session.accessToken}`
        },
      });
      setMessage("✅ Upload sukses!");
      if (onUploadSuccess) onUploadSuccess(res.data);
      setFile(null);
      setDescription("");
    } catch (err: any) {
      setMessage(`❌ Gagal: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-[#0f0f23] rounded-xl border border-gray-200 dark:border-[#2a2a4e] p-3">
      <h4 className="text-xs font-semibold mb-2">Upload File</h4>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      {file && <p className="text-xs text-gray-500 mt-1">📄 {file.name}</p>}
      <textarea
        placeholder="Deskripsi (opsional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full mt-2 px-2 py-1 text-xs bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] rounded"
        rows={2}
      />
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-2 w-full py-1.5 text-xs bg-[#00c8ff] text-white rounded hover:bg-[#00c8ff]/90 disabled:opacity-50 transition"
      >
        {uploading ? "⏳ Uploading..." : "📤 Upload"}
      </button>
      {message && <p className="mt-1 text-xs">{message}</p>}
    </div>
  );
}