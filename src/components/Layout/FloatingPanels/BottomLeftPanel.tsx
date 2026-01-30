import React from 'react';
import { HelpCircle, Keyboard, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsModal from '@/components/Settings/SettingsModal';
import HelpModal from '@/components/Modals/HelpModal';
import ShortcutsModal from '@/components/Modals/ShortcutsModal';

const BottomLeftPanel: React.FC = () => {
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  const items = [
    { id: 'help', icon: HelpCircle, label: '帮助中心', onClick: () => setHelpOpen(true) },
    { id: 'shortcuts', icon: Keyboard, label: '快捷键提示', onClick: () => setShortcutsOpen(true) },
    { id: 'settings', icon: Settings, label: '设置', onClick: () => setSettingsOpen(true) },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute bottom-4 left-4 z-10 glass-strong rounded-xl border border-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex flex-col p-1.5 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="relative">
                <motion.button
                  whileHover={{ scale: 1.05, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={item.onClick}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-sm transition-all text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50"
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
                      className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-20 glass-strong px-3 py-1.5 rounded-lg text-xs text-diffusion-text-primary whitespace-nowrap pointer-events-none"
                      style={{
                        background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                      }}
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

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
};

export default BottomLeftPanel;
