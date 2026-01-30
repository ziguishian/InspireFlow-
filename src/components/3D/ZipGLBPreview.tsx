/**
 * 3D 预览：接收方舟 3D 生成返回的 file_url（zip 压缩包）时：
 * - 下载并解压 zip，按目录结构识别 pbr/ 与 rgb/ 下的 .glb
 * - 结构：压缩包名/pbr/*.glb、压缩包名/rgb/*.glb
 * - 在节点内预览选中的 GLB（可切换 PBR / RGB），底部提供「下载压缩包」
 */
import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ModelViewer from './ModelViewer';

export interface GlbEntry {
  path: string;
  label: string;
}

interface ZipGLBPreviewProps {
  zipUrl: string;
  nodeColor?: string;
  className?: string;
}

// 方舟 3D 生成返回的 file_url 模板：host + path(.zip) + 签名 query（X-Tos-*，24h 有效）
// 示例：https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/doubao-seed3d-1-0/doubao-seed3d-1-0-xxx.zip?X-Tos-Algorithm=...
const ARK_CDN_HOST = 'ark-content-generation-cn-beijing.tos-cn-beijing.volces.com';

/** 开发环境下通过 Vite 代理请求方舟 CDN zip（保留 path + query），避免 CORS */
function getZipFetchUrl(zipUrl: string): string {
  if (typeof zipUrl !== 'string' || !zipUrl.startsWith('http')) return zipUrl;
  try {
    const u = new URL(zipUrl);
    if (import.meta.env.DEV && u.hostname === ARK_CDN_HOST) {
      return `${window.location.origin}/api-proxy-ark-zip${u.pathname}${u.search}`;
    }
  } catch (_) {}
  return zipUrl;
}

/** 从 zip 内路径得到展示标签（PBR / RGB） */
function getLabel(path: string): string {
  const lower = path.toLowerCase().replace(/\\/g, '/');
  if (lower.includes('pbr/') || lower.includes('pbr\\')) return 'PBR';
  if (lower.includes('rgb/') || lower.includes('rgb\\')) return 'RGB';
  const name = path.split(/[/\\]/).pop() || path;
  if (name.includes('pbr')) return 'PBR';
  if (name.includes('rgb') || name.includes('textured')) return 'RGB';
  return name.replace(/\.glb$/i, '');
}

const ZipGLBPreview: React.FC<ZipGLBPreviewProps> = ({
  zipUrl,
  nodeColor = '#6366f1',
  className = '',
}) => {
  const [entries, setEntries] = useState<GlbEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const zipRef = useRef<JSZip | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [glbSelectOpen, setGlbSelectOpen] = useState(false);
  const glbSelectRef = useRef<HTMLDivElement>(null);

  // 释放之前的 blob URL
  const revokeBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  };

  // 加载 zip 并列出 .glb 文件
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    revokeBlobUrl();
    setEntries([]);
    setSelectedPath(null);

    const load = async () => {
      try {
        const fetchUrl = getZipFetchUrl(zipUrl);
        console.log('[ZipGLBPreview] 开始加载 zip', {
          zipUrl: zipUrl.substring(0, 80) + '...',
          fetchUrl: fetchUrl.substring(0, 80) + (fetchUrl.length > 80 ? '...' : ''),
          isProxy: fetchUrl !== zipUrl,
        });
        const res = await fetch(fetchUrl);
        console.log('[ZipGLBPreview] fetch 响应', { ok: res.ok, status: res.status, statusText: res.statusText, url: res.url?.substring(0, 60) });
        if (!res.ok) throw new Error(`下载压缩包失败: ${res.status} ${res.statusText}`);
        const arrayBuffer = await res.arrayBuffer();
        console.log('[ZipGLBPreview] 下载完成', { bytes: arrayBuffer.byteLength });
        if (cancelled) return;
        const zip = await JSZip.loadAsync(arrayBuffer);
        zipRef.current = zip;

        const allPaths: string[] = [];
        zip.forEach((p) => allPaths.push(p));
        console.log('[ZipGLBPreview] zip 内文件列表', { count: allPaths.length, paths: allPaths });

        const glbPaths: string[] = [];
        zip.forEach((relativePath) => {
          if (/\.glb$/i.test(relativePath)) glbPaths.push(relativePath);
        });
        console.log('[ZipGLBPreview] .glb 文件', { count: glbPaths.length, paths: glbPaths });

        // 排序：pbr 优先，然后 rgb
        glbPaths.sort((a, b) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();
          if (aLower.includes('pbr') && !bLower.includes('pbr')) return -1;
          if (!aLower.includes('pbr') && bLower.includes('pbr')) return 1;
          if (aLower.includes('rgb') && !bLower.includes('rgb')) return -1;
          if (!aLower.includes('rgb') && bLower.includes('rgb')) return 1;
          return a.localeCompare(b);
        });

        const list: GlbEntry[] = glbPaths.map((path) => ({
          path,
          label: getLabel(path),
        }));
        if (cancelled) return;
        setEntries(list);
        if (list.length > 0) setSelectedPath(list[0].path);
        console.log('[ZipGLBPreview] 解压完成，已选第一个 GLB', { first: list[0]?.path });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        console.error('[ZipGLBPreview] 加载 zip 失败', { error: msg, stack });
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      revokeBlobUrl();
      zipRef.current = null;
    };
  }, [zipUrl]);

  // 根据选中的 path 从 zip 解压出 blob 并生成 object URL
  useEffect(() => {
    if (!selectedPath || !zipRef.current) {
      revokeBlobUrl();
      return;
    }
    const zip = zipRef.current;
    const file = zip.file(selectedPath);
    if (!file) {
      console.warn('[ZipGLBPreview] zip 内未找到文件', { selectedPath });
      revokeBlobUrl();
      return;
    }
    let cancelled = false;
    console.log('[ZipGLBPreview] 正在解压 GLB', { selectedPath });
    file.async('blob').then((blob) => {
      if (cancelled) return;
      revokeBlobUrl();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setBlobUrl(url);
      console.log('[ZipGLBPreview] GLB blob URL 已创建', { selectedPath, blobSize: blob.size, blobUrl: url.substring(0, 50) + '...' });
    }).catch((e) => {
      console.error('[ZipGLBPreview] 解压 GLB 失败', { selectedPath, error: e?.message ?? e });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPath]);

  // 组件卸载时释放 blob URL
  useEffect(() => () => revokeBlobUrl(), []);

  // 点击外部关闭 GLB 下拉（必须在所有条件 return 之前调用，保证 Hooks 顺序一致）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (glbSelectRef.current && !glbSelectRef.current.contains(e.target as Node)) {
        setGlbSelectOpen(false);
      }
    };
    if (glbSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [glbSelectOpen]);

  // 加载中：解压完成后在节点内预览 GLB，底部有下载压缩包
  if (loading) {
    return (
      <div 
        className={`flex flex-col w-full h-full gap-2 ${className}`}
      >
        <div
          className="flex-1 flex flex-col items-center justify-center gap-2 p-4"
          style={{ minHeight: '10rem' }}
        >
          <span className="text-xs text-diffusion-text-muted">正在解压并加载 GLB 模型...</span>
        </div>
        <div className="flex-shrink-0 pt-1 border-t border-white/10">
          <a
            href={getZipFetchUrl(zipUrl)}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center text-[10px] px-3 py-1.5 rounded border text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors w-full justify-center"
            style={{
              background: `${nodeColor}14`,
              borderColor: `${nodeColor}40`,
              boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            下载压缩包
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={`flex flex-col w-full h-full gap-2 ${className}`}
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
          <span className="text-xs text-red-400 text-center">{error}</span>
        </div>
        <div className="flex-shrink-0 pt-1 border-t border-white/10">
          <a
            href={getZipFetchUrl(zipUrl)}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center justify-center text-[10px] px-3 py-1.5 rounded border text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors w-full"
            style={{
              background: `${nodeColor}14`,
              borderColor: `${nodeColor}40`,
              boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            下载压缩包
          </a>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div 
        className={`flex flex-col w-full h-full gap-2 ${className}`}
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
          <span className="text-xs text-diffusion-text-muted">压缩包内未找到 .glb 文件</span>
        </div>
        <div className="flex-shrink-0 pt-1 border-t border-white/10">
          <a
            href={getZipFetchUrl(zipUrl)}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center justify-center text-[10px] px-3 py-1.5 rounded border text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors w-full"
            style={{
              background: `${nodeColor}14`,
              borderColor: `${nodeColor}40`,
              boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            下载压缩包
          </a>
        </div>
      </div>
    );
  }

  const selectedEntry = entries.find((e) => e.path === selectedPath);

  // 解压完成：节点内预览选中的 GLB，底部提供下载压缩包
  return (
    <div 
      className={`flex flex-col w-full h-full ${className}`}
    >
      <div className="flex items-center gap-2 flex-shrink-0 mb-1">
        <span className="text-[10px] text-diffusion-text-secondary">选择要预览的 GLB:</span>
        <div ref={glbSelectRef} className="relative nodrag">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setGlbSelectOpen((v) => !v);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="解压后选择 PBR 或 RGB 中的 GLB 进行预览"
            className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border border-diffusion-border bg-transparent text-diffusion-text-primary nodrag glass-strong shadow-2xl min-w-[120px] justify-between hover:bg-diffusion-bg-tertiary/50 transition-colors"
          >
            <span>{selectedEntry?.label ?? '选择'}</span>
            <ChevronDown
              size={12}
              className={`text-diffusion-text-muted transition-transform ${glbSelectOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence>
            {glbSelectOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-1.5 z-[100] glass-strong rounded-xl border border-diffusion-border shadow-2xl p-2 min-w-[140px] max-h-[220px] overflow-y-auto"
              >
                {entries.map(({ path, label }) => (
                  <button
                    key={path}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPath(path);
                      setGlbSelectOpen(false);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`nodrag w-full text-left text-[10px] px-3 py-2 rounded-lg transition-colors ${
                      path === selectedPath
                        ? 'bg-diffusion-glow-cyan/15 text-diffusion-glow-cyan border border-diffusion-glow-cyan/30'
                        : 'text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/60 border border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div 
        className="flex-1 min-h-0 rounded overflow-hidden relative"
      >
        {blobUrl ? (
          <ModelViewer url={blobUrl} className="w-full h-full" />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-diffusion-text-muted">
            正在加载 GLB 模型...
          </div>
        )}
      </div>
      <div className="flex-shrink-0 pt-1 mt-1 border-t border-white/10">
        <a
          href={getZipFetchUrl(zipUrl)}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="inline-flex items-center justify-center text-[10px] px-3 py-1.5 rounded border text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors w-full"
          style={{
            background: `${nodeColor}14`,
            borderColor: `${nodeColor}40`,
            boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          下载压缩包
        </a>
      </div>
    </div>
  );
};

export default ZipGLBPreview;
