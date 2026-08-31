// app/verify/VerifyContent.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
                     process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || 
                     'http://localhost:5001';

export default function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'invalid'>('verifying');
  const hasVerified = useRef(false);


  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    // 🔥 KALAU UDAH DIPANGGIL, LANGSUNG RETURN
    if (hasVerified.current) return;
    hasVerified.current = true;

    const verify = async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/auth/verify`, { token });
        setStatus('success');
        setTimeout(() => router.push('/login'), 3000);
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };
    verify();
  }, [token, router]);

  

  if (status === 'verifying') {
    return <div className="min-h-screen flex items-center justify-center">Memverifikasi akun...</div>;
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg text-center">
          <p className="text-green-600 dark:text-green-400 text-xl">✅ Verifikasi berhasil!</p>
          <p className="text-gray-500 mt-2">Anda akan dialihkan ke halaman login...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg text-center">
          <p className="text-red-600 dark:text-red-400 text-xl">❌ Token tidak valid atau sudah kadaluwarsa.</p>
          <p className="text-gray-500 mt-2">Silakan daftar ulang atau minta kirim ulang verifikasi.</p>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center">Token tidak ditemukan.</div>;
}