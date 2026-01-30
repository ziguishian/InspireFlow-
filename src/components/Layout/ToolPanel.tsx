import React, { useState } from 'react';
import { MousePointer2, Hand, ZoomIn, History, Settings, Grid3x3 } from 'lucide-react';
import { motion } from 'framer-motion';

type ToolType = 'select' | 'pan' | 'zoom' | 'history' | 'settings' | 'grid';

interface Tool {
  id: ToolType;
  icon: React.ReactNode;
  label: string;
}

const tools: Tool[] = [
  { id: 'select', icon: <MousePointer2 size={20} />, label: 'Select' },
  { id: 'pan', icon: <Hand size={20} />, label: 'Pan' },
  { id: 'zoom', icon: <ZoomIn size={20} />, label: 'Zoom' },
  { id: 'history', icon: <History size={20} />, label: 'History' },
  { id: 'settings', icon: <Settings size={20} />, label: 'Settings' },
  { id: 'grid', icon: <Grid3x3 size={20} />, label: 'Grid' },
];

const ToolPanel: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  return (
    <div className="w-12 glass-strong menu-surface border-r border-white/10 flex flex-col items-center py-4 gap-2">
      {tools.map((tool) => (
        <motion.button
          key={tool.id}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveTool(tool.id)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            activeTool === tool.id
              ? 'bg-diffusion-glow-cyan/20 text-diffusion-glow-cyan border border-diffusion-glow-cyan/50'
              : 'text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary'
          }`}
          title={tool.label}
        >
          {tool.icon}
        </motion.button>
      ))}
    </div>
  );
};

export default ToolPanel;
