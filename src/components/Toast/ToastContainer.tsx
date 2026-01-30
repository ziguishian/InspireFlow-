import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { toastManager, Toast } from '@/utils/toast';

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToasts);
    return () => { unsubscribe(); };
  }, []);

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} className="text-green-400" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-yellow-400" />;
      case 'info':
        return <Info size={18} className="text-blue-400" />;
    }
  };

  const getBgColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/10 border-green-500/30';
      case 'error':
        return 'bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className={`glass-strong rounded-lg border px-4 py-3 min-w-[300px] max-w-[400px] pointer-events-auto ${getBgColor(toast.type)}`}
            style={{
              background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{getIcon(toast.type)}</div>
              <div className="flex-1 text-sm text-diffusion-text-primary">{toast.message}</div>
              <button
                onClick={() => toastManager.remove(toast.id)}
                className="flex-shrink-0 text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
