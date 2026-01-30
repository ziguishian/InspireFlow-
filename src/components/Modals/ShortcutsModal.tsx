import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + N', description: '新建工作流' },
    { key: 'Ctrl + O', description: '打开工作流' },
    { key: 'Ctrl + S', description: '保存工作流' },
    { key: 'Ctrl + Shift + S', description: '另存为工作流' },
    { key: 'Ctrl + Z', description: '撤销' },
    { key: 'Ctrl + Shift + Z', description: '重做' },
    { key: 'Ctrl + Y', description: '重做 (备用)' },
    { key: 'Ctrl + A', description: '全选节点' },
    { key: 'Ctrl + C', description: '复制节点' },
    { key: 'Ctrl + X', description: '剪切节点' },
    { key: 'Ctrl + V', description: '粘贴节点' },
    { key: 'Ctrl + D', description: '复制一份节点' },
    { key: 'Delete', description: '删除选中节点' },
    { key: 'Alt + 拖拽', description: '拖拽复制节点' },
    { key: 'Ctrl + Enter', description: '运行工作流' },
    { key: 'Esc', description: '停止运行' },
    { key: 'Space + 拖拽', description: '平移画布' },
    { key: 'Ctrl + 滚轮', description: '缩放画布' },
    { key: 'F', description: '适应视图' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong rounded-2xl w-[90vw] h-[85vh] max-w-4xl overflow-hidden flex flex-col"
          style={{
            background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="p-6 border-b border-diffusion-border flex items-center justify-between">
            <h2 className="text-xl font-semibold text-diffusion-text-primary">{t('shortcuts.title')}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hidden p-6">
            <div className="space-y-4">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-diffusion-bg-tertiary/30 border border-white/5">
                  <span className="text-sm text-diffusion-text-secondary">{shortcut.description}</span>
                  <kbd className="px-3 py-1.5 text-xs font-mono text-diffusion-text-primary bg-diffusion-bg-secondary border border-white/10 rounded">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShortcutsModal;
