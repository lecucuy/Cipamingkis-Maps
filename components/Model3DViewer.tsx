'use client';

import { useState, useEffect, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function Model({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} />;
}

export default function Model3DViewer({ url, className = '' }: { url: string | null; className?: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [url]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-[#111] rounded-xl ${className}`}>
        <p className="text-gray-400 text-sm">Pilih model 3D untuk ditampilkan</p>
      </div>
    );
  }

  // 🔥 TAMPILKAN ERROR DI LUAR CANVAS
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl ${className}`}>
        <p className="text-red-500 text-sm">❌ Gagal memuat model: {error}</p>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-xl overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [2, 2, 5], fov: 45 }}
        gl={{ antialias: true }}
        onError={() => setError('Gagal memuat model')}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment preset="city" />
        <OrbitControls enablePan={true} enableZoom={true} rotateSpeed={0.8} />
        <Suspense fallback={null}>
          <Model url={url} />
        </Suspense>
      </Canvas>
      <div className="absolute bottom-2 left-2 text-white/30 text-xs font-mono pointer-events-none">3D Viewer</div>
    </div>
  );
}