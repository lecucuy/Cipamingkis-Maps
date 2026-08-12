'use client';

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

export default function FileGallery() {
  const { data: session } = useSession();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = async () => {
    if (!session?.accessToken) return;
    try {
      const res = await axios.get(`${API_URL}/files/list`, {
        headers: { 'Authorization': `Bearer ${session.accessToken}` }
      });
      setFiles(res.data.files);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Yakin hapus?')) return;
    try {
      await axios.delete(`${API_URL}/files/${fileId}`, {
        headers: { 'Authorization': `Bearer ${session.accessToken}` }
      });
      loadFiles();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  useEffect(() => {
  if (session?.accessToken) {
    loadFiles();
  }
}, [session]);

  useEffect(() => {
    loadFiles();
  }, [session]);

  if (!session) return null;
  if (loading) return <p className="text-xs text-gray-500">Loading files...</p>;

  return (
    <div className="mt-2">
      <h4 className="text-xs font-semibold mb-2">File Saya ({files.length})</h4>
      {files.length === 0 ? (
        <p className="text-xs text-gray-500">Belum ada file.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {files.map((file) => (
            <div key={file._id} className="bg-white dark:bg-[#1a1a2e] rounded border p-2 relative group">
              {file.file_type === 'images' && (
                <img src={file.file_url} alt={file.filename} className="w-full h-16 object-cover rounded" />
              )}
              {file.file_type === 'videos' && (
                <video className="w-full h-16 object-cover rounded" controls>
                  <source src={file.file_url} />
                </video>
              )}
              {(file.file_type === 'documents' || !file.file_type) && (
                <div className="w-full h-16 bg-gray-100 flex items-center justify-center text-2xl">
                  <i className="fa-solid fa-file"></i>
                </div>
              )}
              <p className="text-[10px] truncate mt-1">{file.filename}</p>
              <button
                onClick={() => handleDelete(file._id)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}