import React, { useState } from 'react';
import { History, FolderTree, Workflow, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';

const TopLeftPanel: React.FC = () => {
  const { leftSidebarContent, setLeftSidebarContent } = useUIStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const items = [
    { id: 'history', icon: History, label: '生成历史' },
    { id: 'nodes', icon: FolderTree, label: '节点库' },
    { id: 'workflow', icon: Workflow, label: '工作流' },
    { id: 'template', icon: FileText, label: '模板' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 left-4 z-10 glass-strong menu-surface rounded-xl border border-white/10 shadow-2xl overflow-hidden"
    >
      {/* Logo占位 */}
      <div className="p-2 border-b border-white/10 flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg bg-diffusion-bg-tertiary/60 border border-white/10 flex items-center justify-center text-diffusion-text-primary font-semibold text-xs shadow">
          MX
        </div>
      </div>
      
      <div className="flex flex-col p-1.5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = leftSidebarContent === item.id;
          return (
            <div key={item.id} className="relative">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => setLeftSidebarContent(isActive ? null : item.id as any)}
                className={`
                  w-10 h-10 flex items-center justify-center rounded-lg text-sm transition-all relative
                  ${isActive
                    ? 'bg-diffusion-bg-tertiary/60 text-diffusion-text-primary border border-white/10'
                    : 'text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50'
                  }
                `}
              >
                <Icon size={18} />
              </motion.button>
              
              {/* Hover 文字提示 */}
              <AnimatePresence>
                {hoveredItem === item.id && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-20 glass-strong menu-surface px-3 py-1.5 rounded-lg text-xs text-diffusion-text-primary whitespace-nowrap pointer-events-none border border-white/10 shadow"
                  >
                    {item.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default TopLeftPanel;
