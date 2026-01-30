import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { APP_NAME } from '@/config/appName';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong menu-surface rounded-2xl w-[90vw] h-[85vh] max-w-4xl overflow-hidden flex flex-col border border-white/10"
        >
          <div className="p-6 border-b border-diffusion-border flex items-center justify-between">
            <h2 className="text-xl font-semibold text-diffusion-text-primary">帮助中心</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6 text-diffusion-text-secondary">
              <div>
                <h3 className="text-lg font-medium text-diffusion-text-primary mb-3">欢迎使用 {APP_NAME}</h3>
                <p className="text-sm">这是一个基于节点的AI内容创建和自动化工具。</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-diffusion-text-primary mb-3">快速开始</h3>
                <ul className="space-y-2 text-sm list-disc list-inside">
                  <li>右键点击画布添加节点</li>
                  <li>拖拽节点连接点创建连接</li>
                  <li>点击节点查看和编辑属性</li>
                  <li>使用右上角的运行按钮执行工作流</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default HelpModal;
