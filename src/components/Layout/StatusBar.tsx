import React, { useState, useEffect } from 'react';
import { Minimize2, Maximize2 } from 'lucide-react';

interface StatusBarProps {
  zoom?: number;
  onFitView?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({ zoom = 1, onFitView }) => {
  const [_fps, setFps] = useState(60);
  const [ms, setMs] = useState(17);
  const [showMinimap, setShowMinimap] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate performance metrics (in real app, get from actual render loop)
      setFps(Math.floor(50 + Math.random() * 10));
      setMs(Math.floor(15 + Math.random() * 5));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-strong border-t border-diffusion-border px-4 py-1.5 flex items-center justify-between text-xs text-diffusion-text-secondary">
      {/* Left: Performance Metrics */}
      <div className="flex items-center gap-4">
        <span>1: {Math.round(zoom * 100)}%</span>
        <span>_fps</span>
        <span>{ms} ms</span>
      </div>

      {/* Right: Canvas Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onFitView}
          className="glass px-2 py-1 rounded text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-colors"
        >
          Fit View
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setShowMinimap(!showMinimap)}
          className="glass px-2 py-1 rounded text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-colors"
        >
          {showMinimap ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
