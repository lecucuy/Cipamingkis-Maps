'use client';

// app/page.tsx
import dynamic from 'next/dynamic';

const MapWithKML = dynamic(
  () => import('@/components/MapWithKML'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a1a]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Memuat peta...</p>
        </div>
      </div>
    )
  }
);

export default function HomePage() {
  return <MapWithKML />;
}