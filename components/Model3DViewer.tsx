'use client';

import { useState, useEffect, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ===== COMPONENT MODEL =====
function Model({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} />;
}

// ===== MAIN VIEWER =====
export default function Model3DViewer({ url, className = '' }: { url: string | null; className?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Reset state setiap kali URL berubah
  useEffect(() => {
    if (url) {
      setIsLoading(true);
      setError(null);
      setIsReady(false);
    } else {
      setIsLoading(false);
      setIsReady(false);
    }
  }, [url]);

  // Handler saat model selesai dimuat
  const handleLoad = () => {
    setIsLoading(false);
    setIsReady(true);
  };

  // Handler error
  const handleError = (err: any) => {
    console.error('Model 3D load error:', err);
    setError('Gagal memuat model 3D');
    setIsLoading(false);
  };

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-[#111] rounded-xl ${className}`}>
        <p className="text-gray-400 text-sm">Pilih model 3D untuk ditampilkan</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl ${className}`}>
        <p className="text-red-500 text-sm">❌ {error}</p>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-xl overflow-hidden ${className}`}>
      {/* ===== CANVAS 3D ===== */}
      <Canvas
        key={url} // 🔥 FORCE RE-MOUNT SAAT URL BERUBAH
        camera={{ position: [2, 2, 5], fov: 45 }}
        gl={{ antialias: true }}
        onError={handleError}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment preset="city" />
        <OrbitControls enablePan={true} enableZoom={true} rotateSpeed={0.8} />
        <Suspense fallback={null}>
          <Model url={url} />
        </Suspense>
      </Canvas>

      {/* ===== LOADING OVERLAY ===== */}
      {isLoading && !isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white/70 text-xs font-medium">Memuat model 3D...</p>
          </div>
        </div>
      )}

      {/* ===== LABEL ===== */}
      <div className="absolute bottom-2 left-2 text-white/30 text-xs font-mono pointer-events-none">
        3D Viewer
      </div>
    </div>
  );
}