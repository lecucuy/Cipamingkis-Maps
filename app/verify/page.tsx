// app/verify/page.tsx
import { Suspense } from 'react';
import VerifyContent from './VerifyContent';

export default function VerifyPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-gray-500">Memuat halaman verifikasi...</div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}