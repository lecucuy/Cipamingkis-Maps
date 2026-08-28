// app/api/upload-radius-config/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    // Bisa ambil dari database atau hardcode
    // Misal ambil dari collection 'config' atau dari env
    const centerLat = parseFloat(process.env.UPLOAD_CENTER_LAT || '-6.427655');
    const centerLon = parseFloat(process.env.UPLOAD_CENTER_LON || '107.04462');
    const radius = parseFloat(process.env.UPLOAD_RADIUS_METERS || '500');

    return NextResponse.json({
      center: [centerLat, centerLon],
      radius,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal load config' }, { status: 500 });
  }
}