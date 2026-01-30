import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import { X } from 'lucide-react';
import NodeProperties from './NodeProperties';

interface PropertiesPanelProps {
  isVisible: boolean;
  onClose?: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ isVisible, onClose }) => {
  const { t } = useLanguage();
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const nodes = useWorkflowStore((state) => state.workflows[state.activeWorkflowId || '']?.nodes || []);

  // 使用 useMemo 缓存选中的节点，避免每次渲染都查找
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="properties-panel"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="absolute right-0 top-0 w-80 h-full glass-strong menu-surface border-l border-white/10 overflow-hidden z-20 flex flex-col"
        >
          <div className="p-4 border-b border-diffusion-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold text-diffusion-text-primary">
              {t('properties.title')}
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-diffusion-bg-tertiary text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar glass-scrollbar">
            <div className="p-4">
              {selectedNode ? (
                <NodeProperties node={selectedNode} />
              ) : (
                <div className="text-center py-8 text-diffusion-text-secondary">
                  {t('properties.noSelection')}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PropertiesPanel;
