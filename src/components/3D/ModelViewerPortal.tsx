/**
 * 将 3D 预览通过 Portal 渲染到 body，完全脱离 React Flow 的 DOM 树，
 * 从而避免事件冲突，使 OrbitControls 旋转/平移/缩放正常工作。
 * 占位 div 保留在节点内，实际 3D 内容用 fixed 定位覆盖在占位区域上方。
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ModelViewer from './ModelViewer';
import ZipGLBPreview from './ZipGLBPreview';

interface ModelViewerPortalProps {
  /** 单 GLB/GLTF URL */
  url?: string;
  /** 或 zip URL（与 url 二选一） */
  zipUrl?: string;
  nodeColor?: string;
  /** 下载链接（GLB 时与 url 相同） */
  downloadHref?: string;
  className?: string;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const ModelViewerPortal: React.FC<ModelViewerPortalProps> = ({
  url,
  zipUrl,
  nodeColor = '#6366f1',
  downloadHref,
  className = '',
}) => {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const hasContent = Boolean(url || zipUrl);

  // 初始位置用 state，保证首帧能显示；之后每帧用 ref 直接改 DOM，避免 setState 导致的一帧延迟
  useEffect(() => {
    if (!hasContent) return;

    const updateRect = () => {
      const el = placeholderRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setRect((prev) => {
          const next = { left: r.left, top: r.top, width: r.width, height: r.height };
          if (
            prev &&
            prev.left === next.left &&
            prev.top === next.top &&
            prev.width === next.width &&
            prev.height === next.height
          )
            return prev;
          return next;
        });
      }
    };

    const syncOverlayPosition = () => {
      const placeholder = placeholderRef.current;
      const overlay = overlayRef.current;
      if (!placeholder || !overlay) return;
      const r = placeholder.getBoundingClientRect();
      overlay.style.left = `${r.left}px`;
      overlay.style.top = `${r.top}px`;
      overlay.style.width = `${r.width}px`;
      overlay.style.height = `${r.height}px`;
    };

    updateRect();

    const ro = new ResizeObserver(updateRect);
    const placeholderEl = placeholderRef.current;
    if (placeholderEl) ro.observe(placeholderEl);

    const rafId = { current: 0 };
    const tick = () => {
      syncOverlayPosition();
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [hasContent]);

  if (!hasContent) {
    return (
      <div className={`w-full h-full flex items-center justify-center text-xs text-diffusion-text-muted ${className}`}>
        运行后显示 3D 模型...
      </div>
    );
  }

  const portalContent =
    rect &&
    rect.width > 0 &&
    rect.height > 0 &&
    createPortal(
      <div
        ref={overlayRef}
        className="fixed z-[9998] rounded overflow-hidden bg-diffusion-bg-primary border border-white/10 shadow-xl"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }}
      >
        {zipUrl ? (
          <ZipGLBPreview zipUrl={zipUrl} nodeColor={nodeColor} className="h-full w-full" />
        ) : url ? (
          <ModelViewer url={url} className="h-full w-full" />
        ) : null}
        {downloadHref && (
          <div className="absolute top-2 right-2 z-10">
            <a
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="text-[10px] px-2 py-1 rounded border bg-diffusion-bg-primary/80 backdrop-blur-sm text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors"
              style={{
                borderColor: `${nodeColor}40`,
                boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              下载
            </a>
          </div>
        )}
      </div>,
      document.body
    );

  return (
    <>
      <div
        ref={placeholderRef}
        className={`w-full h-full min-h-[6rem] rounded overflow-hidden relative nodrag nopan bg-diffusion-bg-tertiary/30 ${className}`}
      >
        {/* 仅占位，实际 3D 内容在 Portal 中渲染，避免双实例 */}
      </div>
      {portalContent}
    </>
  );
};

export default ModelViewerPortal;
