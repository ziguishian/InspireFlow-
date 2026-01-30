import React, { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Play, Square, Trash2, Save, FolderOpen, Settings, Share2, Link2, Undo2, Redo2, User, Maximize2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import SettingsModal from '@/components/Settings/SettingsModal';
import { exportWorkflow, importWorkflow, downloadWorkflow, loadWorkflowFromFile } from '@/utils/workflowIO';
import { executeWorkflow } from '@/services/workflowExecutor';
import { toast } from '@/utils/toast';

const Toolbar: React.FC = () => {
  const { t } = useLanguage();
  const { getNodes, getEdges, clearWorkflow, setNodes, setEdges, activeWorkflowId } = useWorkflowStore();
  const nodes = getNodes();
  const edges = getEdges();
  const { saveConfig, loadSettings } = useSettingsStore();
  const [isRunning, setIsRunning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRun = async () => {
    if (nodes.length === 0) return;
    setIsRunning(true);
    try {
      const results = await executeWorkflow(nodes, edges, {
        saveConfig,
        workflowId: activeWorkflowId || undefined,
      });
      console.log('Execution results:', results);
      
      // 如果保存功能已启用，重新加载历史记录以显示新保存的文件
      if (saveConfig.enabled) {
        await loadSettings();
      }
      
      const ok = results.filter((r) => r.success).length;
      alert(t('toolbar.executed') + String(ok) + '/' + results.length + t('toolbar.succeeded'));
    } catch (error) {
      console.error('Workflow execution failed:', error);
      alert(t('toolbar.execFailed') + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleClear = () => {
    if (confirm(t('canvas.clear') + '?')) {
      clearWorkflow();
    }
  };

  const handleSave = () => {
    if (nodes.length === 0) {
      toast.warning(t('toolbar.workflowEmpty'), 3000);
      return;
    }
    const workflow = exportWorkflow(nodes, edges);
    downloadWorkflow(workflow);
  };

  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workflow = await loadWorkflowFromFile(file);
      const { nodes: importedNodes, edges: importedEdges } = importWorkflow(workflow);
      setNodes(importedNodes);
      setEdges(importedEdges);
    } catch (error) {
      alert(t('toolbar.loadFailed') + (error instanceof Error ? error.message : 'Unknown error'));
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSettings = () => {
    setIsSettingsOpen(true);
  };

  return (
    <div className="glass-strong border-b border-diffusion-border px-4 py-2 flex items-center justify-between">
      {/* Left: Workflow Tabs */}
      <div className="flex items-center gap-2">
        <div className="glass px-3 py-1.5 rounded text-sm text-diffusion-text-primary border border-accent/30 bg-accent/10">
          Unsaved Workflow ({nodes.length})
        </div>
        <button className="glass px-3 py-1.5 rounded text-sm text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-colors">
          +
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="glass p-2 rounded-lg text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <Link2 size={16} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSave}
          className="glass px-3 py-1.5 rounded-lg text-sm text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          {t('canvas.save')}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="glass px-3 py-1.5 rounded-lg text-sm text-diffusion-text-primary hover:bg-diffusion-bg-tertiary flex items-center gap-1"
        >
          <Share2 size={14} />
          Share
        </motion.button>

        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="glass px-3 py-1.5 rounded-lg text-sm text-diffusion-text-primary hover:bg-diffusion-bg-tertiary flex items-center gap-1"
          >
            View
            <ChevronDown size={14} />
          </motion.button>
        </div>

        <div className="w-px h-6 bg-diffusion-border mx-1" />

        <div className="glass px-2 py-1 rounded text-xs text-diffusion-text-secondary">
          {nodes.filter((n: { selected?: boolean }) => n.selected).length || 0}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="glass p-2 rounded-lg text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <Undo2 size={16} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="glass p-2 rounded-lg text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <Redo2 size={16} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClear}
          className="glass p-2 rounded-lg text-diffusion-text-secondary hover:text-red-400 hover:bg-diffusion-bg-tertiary"
        >
          <Trash2 size={16} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="glass p-2 rounded-lg text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <User size={16} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="glass p-2 rounded-lg text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <Maximize2 size={16} />
        </motion.button>

        <div className="w-px h-6 bg-diffusion-border mx-1" />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRun}
          disabled={isRunning || nodes.length === 0}
          className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-diffusion-text-primary hover:bg-diffusion-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed bg-accent/10 border border-accent/30"
        >
          <Play size={16} />
          {t('canvas.run')}
        </motion.button>

        {isRunning && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStop}
            className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
          >
            <Square size={16} />
            {t('canvas.stop')}
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRun}
          disabled={isRunning || nodes.length === 0}
          className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-diffusion-text-primary hover:bg-diffusion-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={16} />
          {t('canvas.run')}
        </motion.button>

        {isRunning && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStop}
            className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
          >
            <Square size={16} />
            {t('canvas.stop')}
          </motion.button>
        )}

        <div className="w-px h-6 bg-diffusion-border mx-2" />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSave}
          className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <Save size={16} />
          {t('canvas.save')}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLoad}
          className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <FolderOpen size={16} />
          {t('canvas.load')}
        </motion.button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClear}
          className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <Trash2 size={16} />
          {t('canvas.clear')}
        </motion.button>

        <div className="w-px h-6 bg-diffusion-border mx-2" />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSettings}
          className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-diffusion-text-primary hover:bg-diffusion-bg-tertiary"
        >
          <Settings size={16} />
        </motion.button>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default Toolbar;
