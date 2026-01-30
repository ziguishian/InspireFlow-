import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Bounds } from '@react-three/drei';
import { Box, AlertCircle } from 'lucide-react';

// 3D模型加载组件（必须在 Canvas 内，因 useGLTF 是 R3F hook）
// useGLTF 在加载中会抛出 Promise 给 Suspense，不能当作错误处理，需重新抛出
const Model: React.FC<{ url: string; onError?: (error: Error) => void; onLoad?: () => void }> = ({ url, onError, onLoad }) => {
  try {
    const { scene } = useGLTF(url);
    // 使用 useEffect 监听模型加载完成
    useEffect(() => {
      if (scene && onLoad) {
        // 延迟一下确保模型完全加载
        const timer = setTimeout(() => {
          onLoad();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [scene, onLoad]);
    return <primitive object={scene} />;
  } catch (thrown: unknown) {
    // Suspense：useGLTF 会抛出 Promise，必须重新抛出让 Suspense 处理
    if (thrown != null && typeof (thrown as Promise<unknown>)?.then === 'function') {
      throw thrown;
    }
    if (onError) {
      onError(thrown instanceof Error ? thrown : new Error(String(thrown)));
    }
    return null;
  }
};

// 加载占位：纯 HTML，不用任何 drei/R3F hooks，可放在 Canvas 内外
const LoadingOverlay: React.FC = () => (
  <div className="flex flex-col items-center justify-center gap-2 p-4 w-full h-full">
    <Box size={32} className="text-diffusion-text-muted animate-pulse" />
    <span className="text-xs text-diffusion-text-muted">加载3D模型中...</span>
  </div>
);

interface ModelViewerProps {
  url: string;
  className?: string;
}

const ModelViewer: React.FC<ModelViewerProps> = ({ url, className = '' }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const modelLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 重置加载状态
    setIsLoading(true);
    setError(null);
    
    // 清除之前的超时
    if (modelLoadTimeoutRef.current) {
      clearTimeout(modelLoadTimeoutRef.current);
      modelLoadTimeoutRef.current = null;
    }
    
    const urlPreview = url.startsWith('blob:') ? url.substring(0, 50) + '...' : url.substring(0, 80) + (url.length > 80 ? '...' : '');
    console.log('[ModelViewer] 挂载/更新', { url: urlPreview, isBlob: url.startsWith('blob:') });
    
    // 预加载模型以检测错误（blob: URL 跳过预检查，直接由 useGLTF 加载）
    const loadModel = async () => {
      if (url.startsWith('blob:')) return;
      try {
        const response = await fetch(url, { method: 'HEAD', mode: 'cors' });
        if (!response.ok && response.status !== 0) {
          throw new Error(`无法加载模型文件: ${response.status} ${response.statusText}`);
        }
      } catch (err) {
        console.warn('[ModelViewer] 预检查警告:', err);
      }
    };
    
    loadModel();
    
    // 设置超时，如果模型加载时间过长，自动隐藏加载状态
    modelLoadTimeoutRef.current = setTimeout(() => {
      console.warn('[ModelViewer] 模型加载超时，隐藏加载状态');
      setIsLoading(false);
    }, 30000); // 30秒超时
    
    return () => {
      if (modelLoadTimeoutRef.current) {
        clearTimeout(modelLoadTimeoutRef.current);
        modelLoadTimeoutRef.current = null;
      }
    };
  }, [url]);

  const handleModelLoad = () => {
    console.log('[ModelViewer] 模型加载完成');
    if (modelLoadTimeoutRef.current) {
      clearTimeout(modelLoadTimeoutRef.current);
      modelLoadTimeoutRef.current = null;
    }
    setIsLoading(false);
  };

  const handleModelError = (err: Error) => {
    console.error('[ModelViewer] 模型加载失败', { url: url.substring(0, 60) + '...', error: err.message, stack: err.stack });
    if (modelLoadTimeoutRef.current) {
      clearTimeout(modelLoadTimeoutRef.current);
      modelLoadTimeoutRef.current = null;
    }
    setError(err.message);
    setIsLoading(false);
  };

  return (
    <div
      className={`w-full h-full relative ${className}`}
      style={{ touchAction: 'none' }}
    >
      {error ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
          <AlertCircle size={32} className="text-red-400" />
          <span className="text-xs text-red-400 text-center">加载失败</span>
          <span className="text-[10px] text-diffusion-text-muted text-center">{error}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="text-[10px] px-3 py-1.5 rounded border text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors mt-2"
          >
            直接下载文件
          </a>
        </div>
      ) : (
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            <Bounds fit clip margin={1.2}>
              <Model url={url} onError={handleModelError} onLoad={handleModelLoad} />
            </Bounds>
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={0.5}
              maxDistance={50}
            />
            <Environment preset="sunset" />
          </Suspense>
        </Canvas>
      )}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-diffusion-bg-primary/50 backdrop-blur-sm">
          <LoadingOverlay />
        </div>
      )}
    </div>
  );
};

export default ModelViewer;
