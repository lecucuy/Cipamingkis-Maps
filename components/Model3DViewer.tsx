'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense, Component, ReactNode } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ===== ERROR BOUNDARY KHUSUS MODEL 3D =====
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
  resetKey?: unknown;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

// ===== COMPONENT MODEL =====
function Model({ url, onLoad }: { url: string; onLoad?: (url: string) => void }) {
  const gltf = useLoader(GLTFLoader, url);

  useEffect(() => {
    if (gltf) {
      onLoad?.(url);
    }
  }, [gltf, url, onLoad]);

  // Clone scene agar aman saat reuse/re-render tanpa merusak scene tree internal GLTFLoader
  const clonedScene = useMemo(() => {
    if (!gltf?.scene) return null;
    return gltf.scene.clone(true);
  }, [gltf]);

  if (!clonedScene) return null;
  return <primitive object={clonedScene} />;
}

// ===== MAIN VIEWER =====
function Model3DViewerComponent({
  url,
  className = '',
  onClose,
}: {
  url: string | null;
  className?: string;
  onClose?: () => void;
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derivasi status loading dan ready tanpa trigger cascading render via setState di effect
  const isReady = !!url && loadedUrl === url;
  const isLoading = !!url && !isReady && !error;

  // Handler saat model selesai dimuat
  const handleLoad = useCallback((loaded: string) => {
    setLoadedUrl(loaded);
    setError(null);
  }, []);

  // Handler error
  const handleError = useCallback((err: unknown) => {
    console.error('Model 3D load error:', err);
    const msg = err instanceof Error ? err.message : 'Gagal memuat model 3D';
    setError(msg);
  }, []);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-[#111] rounded-xl border border-dashed border-gray-300 dark:border-gray-700 ${className}`}>
        <p className="text-gray-400 text-sm">Pilih model 3D untuk ditampilkan</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800 ${className}`}>
        <p className="text-red-500 text-sm font-semibold mb-1">❌ Gagal memuat model 3D</p>
        <p className="text-red-400/80 text-xs text-center max-w-xs">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoadedUrl(null);
          }}
          className="mt-3 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition cursor-pointer"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <ModelErrorBoundary
      resetKey={url}
      onError={handleError}
      fallback={(err) => (
        <div className={`flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800 ${className}`}>
          <p className="text-red-500 text-sm font-semibold mb-1">❌ Gagal merender model 3D</p>
          <p className="text-red-400/80 text-xs text-center max-w-xs">{err?.message || 'Format tidak didukung'}</p>
        </div>
      )}
    >
      <div className={`relative bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 ${className}`}>
        {/* ===== CANVAS 3D (Lokal lighting tanpa download HDR, frameloop on demand agar ringan) ===== */}
        <Canvas
          frameloop="demand"
          camera={{ position: [3, 3, 6], fov: 45 }}
          gl={{ antialias: true, powerPreference: 'low-power' }}
          onError={handleError}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[6, 12, 8]} intensity={1.5} />
          <directionalLight position={[-6, -6, -6]} intensity={0.4} />
          <hemisphereLight intensity={0.5} groundColor="#222222" />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            rotateSpeed={0.8}
            enableDamping={true}
            dampingFactor={0.05}
            makeDefault
          />
          <Suspense fallback={null}>
            <Center>
              <Model key={url} url={url} onLoad={handleLoad} />
            </Center>
          </Suspense>
        </Canvas>

        {/* ===== LOADING OVERLAY ===== */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white/80 text-xs font-medium">Merender objek 3D...</p>
            </div>
          </div>
        )}

        {/* ===== CONTROLS OVERLAY ===== */}
        {onClose && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-black/60 hover:bg-black/80 text-white/90 border border-white/10 transition flex items-center gap-1 cursor-pointer backdrop-blur-sm"
              title="Tutup 3D untuk menghemat memori"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
              <span>Tutup 3D</span>
            </button>
          </div>
        )}

        {/* ===== HINT / LABEL ===== */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 text-white/50 text-[10px] font-mono pointer-events-none bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/5">
          <span>🧊 Drag: Putar • Scroll: Zoom • Kanan: Geser</span>
        </div>
      </div>
    </ModelErrorBoundary>
  );
}

const Model3DViewer = React.memo(Model3DViewerComponent);
export default Model3DViewer;
