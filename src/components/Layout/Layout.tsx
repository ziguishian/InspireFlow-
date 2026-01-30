import React, { useCallback, useEffect, useRef, useState } from 'react';
import Canvas from './Canvas';
import PropertiesPanel from './PropertiesPanel';
import TabBar from './TabBar';
import LeftSidebar from './LeftSidebar';
import TopLeftPanel from './FloatingPanels/TopLeftPanel';
import BottomLeftPanel from './FloatingPanels/BottomLeftPanel';
import TopRightPanel from './FloatingPanels/TopRightPanel';
import { useUIStore } from '@/stores/uiStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { exportWorkflow, downloadWorkflow, importWorkflow, loadWorkflowFromFile } from '@/utils/workflowIO';
import { toast } from '@/utils/toast';

const Layout: React.FC = () => {
  const { t } = useLanguage();
  const [propertiesVisible, setPropertiesVisible] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [edgesVisible, setEdgesVisible] = useState(true);
  const { setLeftSidebarContent } = useUIStore();
  const {
    activeWorkflowId,
    workflows,
    createWorkflow,
    updateWorkflowName,
    saveWorkflow,
    setNodes,
    setEdges,
    undo,
    redo,
  } = useWorkflowStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleToggleProperties = (e: CustomEvent) => {
      setPropertiesVisible(e.detail.show);
    };
    window.addEventListener('toggle-properties', handleToggleProperties as EventListener);
    return () => window.removeEventListener('toggle-properties', handleToggleProperties as EventListener);
  }, []);

  const handleCanvasClick = useCallback(() => {
    setLeftSidebarContent(null);
    setPropertiesVisible(false);
  }, [setLeftSidebarContent]);

  const handleSave = useCallback(() => {
    if (!activeWorkflowId) return;
    const workflow = workflows[activeWorkflowId];
    if (!workflow) return;
    // 如果工作流为空（没有节点），则不保存
    if (!workflow.nodes || workflow.nodes.length === 0) {
      toast.warning(t('layout.workflowEmpty'), 3000);
      return;
    }
    saveWorkflow(activeWorkflowId);
  }, [activeWorkflowId, workflows, saveWorkflow, t]);

  const handleSaveAs = useCallback(() => {
    if (!activeWorkflowId) return;
    const workflow = workflows[activeWorkflowId];
    if (!workflow) return;
    // 如果工作流为空（没有节点），则不保存
    if (!workflow.nodes || workflow.nodes.length === 0) {
      toast.warning(t('layout.workflowEmpty'), 3000);
      return;
    }
    const data = exportWorkflow(workflow.nodes, workflow.edges);
    downloadWorkflow(data, `${workflow.name || 'workflow'}.json`);
  }, [activeWorkflowId, workflows]);

  const handleOpen = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleNew = useCallback(() => {
    createWorkflow();
  }, [createWorkflow]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const workflow = await loadWorkflowFromFile(file);
        const { nodes, edges } = importWorkflow(workflow);
        const id = createWorkflow(file.name.replace(/\.[^/.]+$/, '') || t('layout.importWorkflow'));
        setNodes(nodes);
        setEdges(edges);
        updateWorkflowName(id, file.name.replace(/\.[^/.]+$/, '') || t('layout.importWorkflow'));
      } catch (error) {
        alert(t('layout.loadFailed') + (error instanceof Error ? error.message : 'Unknown error'));
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [createWorkflow, setNodes, setEdges, updateWorkflowName, t]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      
      const key = event.key.toLowerCase();
      const isCtrl = event.ctrlKey || event.metaKey;

      // Ctrl+S 保存 - 即使是在输入框中也要处理（但允许输入框的默认行为）
      if (isCtrl && key === 's' && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        handleSaveAs();
        return;
      }

      if (isCtrl && key === 's') {
        event.preventDefault();
        event.stopPropagation();
        handleSave();
        return;
      }

      // 其他快捷键只在非输入框时生效
      if (isInput) return;

      if (isCtrl && key === 'o') {
        event.preventDefault();
        handleOpen();
        return;
      }

      if (isCtrl && key === 'n') {
        event.preventDefault();
        handleNew();
        return;
      }

      if (isCtrl && key === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      if (isCtrl && key === 'z') {
        event.preventDefault();
        undo();
        return;
      }

      if (isCtrl && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (isCtrl && key === 'enter') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('run-workflow'));
        return;
      }

      if (key === 'escape') {
        window.dispatchEvent(new CustomEvent('stop-workflow'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleOpen, handleNew, undo, redo]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeWorkflowId) return;
      const workflow = workflows[activeWorkflowId];
      if (!workflow || !workflow.unsaved) return;
      // 如果工作流为空（没有节点），则不自动保存
      if (!workflow.nodes || workflow.nodes.length === 0) return;
      saveWorkflow(activeWorkflowId);
    }, 60_000);
    return () => clearInterval(interval);
  }, [activeWorkflowId, workflows, saveWorkflow]);

  return (
    <div className="flex flex-col h-screen">
      {/* 标签栏 */}
      <TabBar />
      
      {/* 主内容区域 */}
      <div className="flex-1 overflow-hidden relative">
        {/* 画布 */}
        <div className="w-full h-full relative">
          <Canvas 
            minimapVisible={minimapVisible}
            edgesVisible={edgesVisible}
            onToggleMinimap={() => setMinimapVisible(!minimapVisible)}
            onToggleEdges={() => setEdgesVisible(!edgesVisible)}
            onCanvasClick={handleCanvasClick}
          />
          
          {/* 悬浮面板 */}
          <TopLeftPanel />
          <BottomLeftPanel />
          <TopRightPanel 
            onToggleProperties={() => setPropertiesVisible(!propertiesVisible)}
            propertiesVisible={propertiesVisible}
          />
        </div>
        
        {/* 属性面板（默认隐藏） */}
        <PropertiesPanel 
          isVisible={propertiesVisible} 
          onClose={() => setPropertiesVisible(false)}
        />
        
        {/* 左侧边栏 */}
        <LeftSidebar />
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default Layout;
