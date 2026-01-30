import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, MoreVertical, Save, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkflowStore, WorkflowData } from '@/stores/workflowStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { exportWorkflow, downloadWorkflow } from '@/utils/workflowIO';
import { APP_NAME } from '@/config/appName';
import { toast } from '@/utils/toast';

const TabBar: React.FC = () => {
  const { t } = useLanguage();
  const {
    workflows,
    openedWorkflowIds,
    activeWorkflowId,
    createWorkflow,
    switchWorkflow,
    closeWorkflow,
    reorderOpenedWorkflows,
    updateWorkflowName,
    saveWorkflow,
    getCurrentWorkflow,
  } = useWorkflowStore();
  
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const menuRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // 只显示已打开的工作流
  const workflowList = openedWorkflowIds
    .map(id => workflows[id])
    .filter(Boolean) as WorkflowData[];
  void getCurrentWorkflow(); // currentWorkflow reserved for future use

  const handleAddTab = () => {
    createWorkflow();
  };

  const handleCloseTab = (e: React.MouseEvent, workflowId: string) => {
    e.stopPropagation();
    closeWorkflow(workflowId); // 只关闭，不删除
  };

  const handleSwitchTab = (workflowId: string) => {
    switchWorkflow(workflowId);
  };

  const handleSave = (workflowId: string) => {
    const workflow = workflows[workflowId];
    if (!workflow) return;
    // 如果工作流为空（没有节点），则不保存
    if (!workflow.nodes || workflow.nodes.length === 0) {
      toast.warning(t('layout.workflowEmpty'), 3000);
      setWorkflowMenuOpen(null);
      return;
    }
    saveWorkflow(workflowId);
    setWorkflowMenuOpen(null);
  };

  const handleSaveAs = (workflowId: string) => {
    const workflow = workflows[workflowId];
    if (!workflow) return;
    // 如果工作流为空（没有节点），则不保存
    if (!workflow.nodes || workflow.nodes.length === 0) {
      toast.warning(t('layout.workflowEmpty'), 3000);
      setWorkflowMenuOpen(null);
      return;
    }
    const data = exportWorkflow(workflow.nodes, workflow.edges);
    downloadWorkflow(data, `${workflow.name || 'workflow'}.json`);
    setWorkflowMenuOpen(null);
  };

  const handleRename = (workflowId: string) => {
    const workflow = workflows[workflowId];
    if (workflow) {
      setRenameValue(workflow.name);
      setIsRenaming(workflowId);
      setWorkflowMenuOpen(null);
    }
  };

  const handleRenameSave = (workflowId: string) => {
    if (renameValue.trim()) {
      updateWorkflowName(workflowId, renameValue.trim());
    }
    setIsRenaming(null);
    setRenameValue('');
  };

  const handleClear = (workflowId: string) => {
    if (confirm(t('canvas.clear') + '? ' + (t('tabBar.confirmClear') || '此操作不可撤销。'))) {
      const workflow = workflows[workflowId];
      if (workflow) {
        // 清空节点和边
        useWorkflowStore.getState().setNodes([]);
        useWorkflowStore.getState().setEdges([]);
      }
      setWorkflowMenuOpen(null);
    }
  };

  // 检查滚动状态并更新箭头显示
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    setShowLeftArrow(container.scrollLeft > 0);
    setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
  };

  // 滚动函数：直接到最左/最右（确保可到最前/最后）
  const scrollLeft = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const scrollRight = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
  };

  // 处理 Shift+滚轮横向滚动
  const handleWheel = (e: React.WheelEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollLeft += e.deltaY;
      }
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      // 监听窗口大小变化
      window.addEventListener('resize', checkScrollButtons);
      return () => {
        container.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
  }, [workflowList.length]); // 当工作流列表变化时重新检查

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workflowMenuOpen) {
        const ref = menuRefs.current[workflowMenuOpen];
        if (ref && !ref.contains(event.target as Node)) {
          const menu = document.querySelector(`[data-workflow-menu-portal="${workflowMenuOpen}"]`);
          if (menu && !menu.contains(event.target as Node)) {
            setWorkflowMenuOpen(null);
          }
        }
      }
    };
    if (workflowMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [workflowMenuOpen]);

  // 当菜单打开时，计算其在 viewport 的位置（用于 Portal 渲染）
  useEffect(() => {
    if (!workflowMenuOpen) {
      setMenuPosition(null);
      return;
    }
    const anchor = menuRefs.current[workflowMenuOpen];
    if (!anchor) return;

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 6,
        left: rect.left,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [workflowMenuOpen]);

  return (
    <div className="relative z-[9999] flex items-center glass-strong border-b border-diffusion-border">
      {/* 品牌 Logo - 高度比标签高 */}
      <div className="px-3 py-2.5 flex items-center justify-center border-r border-diffusion-border-50">
        <div className="text-sm font-semibold tracking-wide text-diffusion-text-primary/90 whitespace-nowrap">
          {APP_NAME}
        </div>
      </div>
      
      {/* 左侧箭头 */}
      {showLeftArrow && (
        <button
          onClick={scrollLeft}
          className="p-1.5 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors flex-shrink-0"
          title="向左滚动"
        >
          <ChevronLeft size={16} />
        </button>
      )}
      
      {/* 可滚动的标签容器 */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hidden"
      >
        {workflowList.map((workflow, index) => (
        <div 
          key={workflow.id} 
          className="relative flex items-center"
          data-tab-item
          draggable
          onDragStart={(e) => {
            setDraggedTabId(workflow.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedTabId && draggedTabId !== workflow.id) {
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedTabId && draggedTabId !== workflow.id) {
              const newOrder = [...openedWorkflowIds];
              const draggedIndex = newOrder.indexOf(draggedTabId);
              const targetIndex = newOrder.indexOf(workflow.id);
              newOrder.splice(draggedIndex, 1);
              newOrder.splice(targetIndex, 0, draggedTabId);
              reorderOpenedWorkflows(newOrder);
            }
            setDraggedTabId(null);
          }}
          onDragEnd={() => {
            setDraggedTabId(null);
          }}
        >
          {/* 竖线分割（第一个标签不显示） */}
          {index > 0 && (
            <div className="h-6 w-px bg-diffusion-border-50 flex-shrink-0" />
          )}
          
          {isRenaming === workflow.id ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameSave(workflow.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSave(workflow.id);
                if (e.key === 'Escape') setIsRenaming(null);
              }}
              className="px-3 py-2 rounded-t-lg text-sm text-diffusion-text-primary bg-diffusion-bg-secondary/90 border-t border-x border-diffusion-border focus:outline-none focus:border-diffusion-glow-cyan whitespace-nowrap flex-shrink-0"
              autoFocus
            />
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSwitchTab(workflow.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-t-lg text-sm transition-all group whitespace-nowrap flex-shrink-0
                ${activeWorkflowId === workflow.id
                  ? 'bg-diffusion-bg-secondary/90 text-diffusion-text-primary border-t border-x border-diffusion-border'
                  : 'text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50'
                }
              `}
            >
              <span className="whitespace-nowrap">{workflow.name}</span>
              {workflow.unsaved && <span className="w-1.5 h-1.5 rounded-full bg-diffusion-text-muted" />}
              <div
                ref={(el) => { menuRefs.current[workflow.id] = el as unknown as HTMLButtonElement; }}
                onClick={(e) => {
                  e.stopPropagation();
                  const nextId = workflowMenuOpen === workflow.id ? null : workflow.id;
                  setWorkflowMenuOpen(nextId);
                }}
                className="p-0.5 hover:bg-diffusion-bg-tertiary/50 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    const nextId = workflowMenuOpen === workflow.id ? null : workflow.id;
                    setWorkflowMenuOpen(nextId);
                  }
                }}
              >
                <MoreVertical size={12} />
              </div>
              <div
                onClick={(e) => handleCloseTab(e, workflow.id)}
                className="p-0.5 hover:text-red-400 transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    handleCloseTab(e as any, workflow.id);
                  }
                }}
              >
                <X size={12} />
              </div>
            </motion.button>
          )}
          
          {/* 菜单使用 Portal 渲染，避免被 overflow-x 裁切 */}
        </div>
        ))}
        
        {/* 新建按钮 */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleAddTab}
          className="p-1.5 rounded text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-colors flex-shrink-0"
          title="新建工作流"
        >
          <Plus size={14} />
        </motion.button>
      </div>
      
      {/* 右侧箭头 */}
      {showRightArrow && (
        <button
          onClick={scrollRight}
          className="p-1.5 text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-colors flex-shrink-0"
          title="向右滚动"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Portal 菜单（保证不被遮挡） */}
      {workflowMenuOpen && menuPosition && !isRenaming && createPortal(
        <AnimatePresence>
          <motion.div
            key={workflowMenuOpen}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            data-workflow-menu-portal={workflowMenuOpen}
            className="fixed glass-strong rounded-lg border border-white/10 shadow-2xl overflow-hidden z-[2147483647] min-w-[150px]"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <button
              onClick={() => handleSave(workflowMenuOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-all"
            >
              <Save size={14} className="text-emerald-300" />
              <span>保存工作流</span>
            </button>
            <button
              onClick={() => handleSaveAs(workflowMenuOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-all"
            >
              <Save size={14} className="text-sky-300" />
              <span>另存为</span>
            </button>
            <button
              onClick={() => handleRename(workflowMenuOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary/50 transition-all"
            >
              <Edit2 size={14} className="text-sky-300" />
              <span>重命名工作流</span>
            </button>
            <button
              onClick={() => handleClear(workflowMenuOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <Trash2 size={14} className="text-rose-400" />
              <span>清空工作流</span>
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default TabBar;
