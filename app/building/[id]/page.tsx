// app/building/[id]/page.tsx
'use client';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const MapWithKML = dynamic(() => import('@/components/MapWithKML'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function BuildingPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  // bisa pass sebagai prop kalau mau
  return <MapWithKML />;
}