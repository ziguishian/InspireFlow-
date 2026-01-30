import React from 'react';
import { MousePointer2, Hand, Maximize2, ZoomIn, ZoomOut, Map, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';

interface BottomRightPanelProps {
  onToggleMinimap: () => void;
  minimapVisible: boolean;
  onToggleEdges: () => void;
  edgesVisible: boolean;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
}

const BottomRightPanel: React.FC<BottomRightPanelProps> = ({
  onToggleMinimap,
  minimapVisible,
  onToggleEdges,
  edgesVisible,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onFitView,
}) => {
  const { mouseMode, setMouseMode } = useUIStore();

  const handleZoomIn = () => {
    onZoomIn?.();
  };

  const handleZoomOut = () => {
    onZoomOut?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-4 right-4 z-10 flex items-center gap-2"
    >
      {/* 鼠标模式 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setMouseMode(mouseMode === 'pointer' ? 'hand' : 'pointer')}
        className={`glass-strong rounded-lg p-2.5 border backdrop-blur-2xl transition-all h-[42px] flex items-center justify-center ${
          mouseMode === 'hand' 
            ? 'border-diffusion-glow-cyan/30 text-diffusion-glow-cyan bg-diffusion-glow-cyan/10' 
            : 'border-white/10 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50'
        }`}
        style={{
          background: mouseMode === 'hand'
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(18, 18, 26, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        title={mouseMode === 'pointer' ? '箭头模式' : '拖拽模式'}
      >
        {mouseMode === 'pointer' ? <MousePointer2 size={18} /> : <Hand size={18} />}
      </motion.button>

      {/* 适应视图 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={onFitView}
        className="glass-strong rounded-lg p-2.5 border border-white/10 backdrop-blur-2xl text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-all h-[42px] flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        title="适应视图"
      >
        <Maximize2 size={18} />
      </motion.button>

      {/* 缩放控制 */}
      <div className="flex flex-col items-stretch gap-0">
        {/* 高倍缩放提示：大于等于 250% 时出现，显示在按钮上方 */}
        {zoom >= 2.5 && (
          <div className="mb-0.5 text-[9px] leading-tight text-amber-300/80 text-center px-1">
            高倍缩放模式，缩放步长已减小，画面可能略有放大感
          </div>
        )}
        <div
          className="glass-strong rounded-lg border border-white/10 backdrop-blur-2xl flex items-center gap-1 px-2 h-[42px]"
          style={{
            background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          }}
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleZoomOut}
            className="p-1.5 text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors h-full flex items-center"
          >
            <ZoomOut size={14} />
          </motion.button>
          <span className="text-xs text-diffusion-text-primary min-w-[3rem] text-center">
            {Math.round((zoom || 1) * 100)}%
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleZoomIn}
            className="p-1.5 text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors h-full flex items-center"
          >
            <ZoomIn size={14} />
          </motion.button>
        </div>
      </div>

      {/* 小地图开关 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleMinimap}
        className="glass-strong rounded-lg p-2.5 border border-white/10 backdrop-blur-2xl text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-all h-[42px] flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        title={minimapVisible ? '隐藏小地图' : '显示小地图'}
      >
        <Map size={18} />
      </motion.button>

      {/* 隐藏链接 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggleEdges}
        className="glass-strong rounded-lg p-2.5 border border-white/10 backdrop-blur-2xl text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-all h-[42px] flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
        title={edgesVisible ? '隐藏链接' : '显示链接'}
      >
        {edgesVisible ? <Eye size={18} /> : <EyeOff size={18} />}
      </motion.button>
    </motion.div>
  );
};

export default BottomRightPanel;
