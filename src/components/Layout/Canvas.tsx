import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  Node,
  NodeChange,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { nodeTypes } from '@/nodes';
import DeletableEdge from '@/components/Edges/DeletableEdge';
import { getHandleType, isCompatibleHandleType } from '@/nodes/handleSchema';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Image, Video, Box, Code, Upload, Eye, ChevronDown } from 'lucide-react';
import BottomRightPanel from './FloatingPanels/BottomRightPanel';
import { getHandleColor } from '@/utils/colorUtils';
import { APP_NAME } from '@/config/appName';

interface CanvasInnerProps {
  minimapVisible?: boolean;
  edgesVisible?: boolean;
  onToggleMinimap?: () => void;
  onToggleEdges?: () => void;
  onCanvasClick?: () => void;
}

const CanvasInner: React.FC<CanvasInnerProps> = ({ 
  minimapVisible = true, 
  edgesVisible = true,
  onToggleMinimap,
  onToggleEdges,
  onCanvasClick,
}) => {
  const { t } = useLanguage();
  const {
    getNodes,
    getEdges,
    setEdges,
    setNodes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    removeNode,
    selectedNodeId,
    setSelectedNodeId,
    activeWorkflowId,
  } = useWorkflowStore();
  
  const storeNodes = getNodes();
  const edges = getEdges();
  const { mouseMode } = useUIStore();
  const appearanceConfig = useSettingsStore((s) => s.appearanceConfig);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getZoom, fitView, zoomTo, setCenter } = useReactFlow();
  const [zoom, setZoom] = useState(1);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const menuScrollRef = useRef<HTMLDivElement | null>(null);
  const [showMenuScrollHint, setShowMenuScrollHint] = useState(false);
  const clipboardRef = useRef<{ nodes: Node[] } | null>(null);
  const pasteOffsetRef = useRef(1);
  const altDragRef = useRef(false);
  const prevNodeCountRef = useRef<number>(storeNodes.length);
  const lastWorkflowIdRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setZoom(getZoom());
    }, 100);
    return () => clearInterval(interval);
  }, [getZoom]);

  // Sync selection state with React Flow
  // 使用 useMemo 缓存节点数组，避免不必要的重新创建
  const nodes = useMemo(() => storeNodes, [storeNodes]);

  // 缓存节点映射，只在节点数组变化时重新计算
  const nodesById = useMemo(() => {
    const map = new Map();
    storeNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [storeNodes]);

  // 监听工作流切换：打开/切换工作流时画布自动适应视图
  useEffect(() => {
    if (lastWorkflowIdRef.current !== activeWorkflowId) {
      lastWorkflowIdRef.current = activeWorkflowId;
      // 等节点渲染后再 fitView，使画布适应当前工作流内容
      const t = setTimeout(() => {
        fitView({ padding: 0.2, duration: 200 });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [activeWorkflowId, fitView]);

  // 用户添加第一个节点时：缩放重置为 100%
  useEffect(() => {
    const prev = prevNodeCountRef.current;
    const next = storeNodes.length;
    prevNodeCountRef.current = next;

    // 仅在「从 0 -> 1」的瞬间触发
    if (prev === 0 && next === 1) {
      // 等一帧，确保节点已渲染到画布后再缩放
      requestAnimationFrame(() => {
        zoomTo(1);
      });
    }
  }, [storeNodes.length, zoomTo]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      try {
        const template = JSON.parse(event.dataTransfer.getData('application/reactflow'));

        if (!template || !reactFlowWrapper.current) {
          return;
        }

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode: Node = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: template.type,
          position,
          data: {
            label: t(template.label),
            ...template.defaultData,
          },
          style: {
            width: 240,
            height: 'auto',
          },
        };

        addNode(newNode);
      } catch (error) {
        console.error('Failed to parse dropped node:', error);
      }
    },
    [screenToFlowPosition, addNode, t]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // 更新拖动状态
      const dragChange = changes.find((change) => change.type === 'position' && change.dragging !== undefined);
      if (dragChange && dragChange.type === 'position') {
        // React Flow 会自动处理拖动状态
      }
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const getSelectedNodes = useCallback(() => {
    const selected = storeNodes.filter((node) => node.selected);
    if (selected.length > 0) return selected;
    return selectedNodeId ? storeNodes.filter((node) => node.id === selectedNodeId) : [];
  }, [storeNodes, selectedNodeId]);

  const copySelectedNodes = useCallback(() => {
    const selected = getSelectedNodes();
    if (selected.length === 0) return;
    clipboardRef.current = {
      nodes: selected.map((node) => ({
        ...node,
        data: JSON.parse(JSON.stringify(node.data)),
      })),
    };
    pasteOffsetRef.current = 1;
  }, [getSelectedNodes]);

  const deleteSelectedNodes = useCallback(() => {
    const selected = getSelectedNodes();
    if (selected.length === 0) return;
    selected.forEach((node) => removeNode(node.id));
  }, [getSelectedNodes, removeNode]);

  const duplicateNodes = useCallback(
    (nodesToDuplicate: Node[], offset: number) => {
      if (nodesToDuplicate.length === 0) return;
      const timestamp = Date.now();
      const newNodes = nodesToDuplicate.map((node, index) => ({
        ...node,
        id: `node-${timestamp}-${Math.random().toString(36).substr(2, 9)}-${index}`,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset,
        },
        selected: true,
      }));
      setNodes([
        ...storeNodes.map((node) => ({ ...node, selected: false })),
        ...newNodes,
      ]);
    },
    [setNodes, storeNodes]
  );

  const pasteNodes = useCallback(() => {
    if (!clipboardRef.current) return;
    const offset = 24 * pasteOffsetRef.current;
    pasteOffsetRef.current += 1;
    duplicateNodes(clipboardRef.current.nodes, offset);
  }, [duplicateNodes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      
      const isCtrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const isSelectAll = isCtrl && key === 'a';

      // Ctrl/Cmd + A：上下文感知
      // - 如果当前在输入框/可编辑区域：保留浏览器默认行为（全选文本）
      // - 只有当事件来自画布区域（reactFlowWrapper 内）时，才执行“全选节点”
      if (isSelectAll) {
        if (isInput) return;

        const wrapper = reactFlowWrapper.current;
        const inCanvas = !!(wrapper && target && wrapper.contains(target));
        if (!inCanvas) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const nodes = getNodes();
        if (nodes.length === 0) return;
        setNodes(nodes.map((node) => ({ ...node, selected: true })));
        setSelectedNodeId(null);
        return; // 提前返回，不执行其他逻辑
      }

      // Ctrl+S 保存工作流 - 不阻止，让 Layout 组件处理
      if (isCtrl && key === 's') {
        // 不阻止事件，让 Layout 组件的键盘处理器处理保存
        return;
      }

      // 其他快捷键只在非输入框时生效
      if (isInput) return;

      const isCopy = isCtrl && key === 'c';
      const isPaste = isCtrl && key === 'v';
      const isCut = isCtrl && key === 'x';
      const isDuplicate = isCtrl && key === 'd';

      if (isCopy) {
        event.preventDefault();
        copySelectedNodes();
      }

      if (isPaste) {
        event.preventDefault();
        pasteNodes();
      }

      if (isCut) {
        event.preventDefault();
        copySelectedNodes();
        deleteSelectedNodes();
      }

      if (isDuplicate) {
        event.preventDefault();
        const selected = getSelectedNodes();
        if (selected.length > 0) {
          duplicateNodes(selected, 24);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // 使用捕获阶段确保优先处理
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [copySelectedNodes, pasteNodes, deleteSelectedNodes, duplicateNodes, getSelectedNodes, getNodes, setNodes, setSelectedNodeId]);

  const handleNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!event.altKey || altDragRef.current) return;
      altDragRef.current = true;
      const selected = getSelectedNodes();
      const targets = selected.some((n) => n.id === node.id) ? selected : [node];
      duplicateNodes(targets, 0);
    },
    [duplicateNodes, getSelectedNodes]
  );

  const handleNodeDragStop = useCallback(() => {
    altDragRef.current = false;
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
    setEdgeMenu(null);
    onCanvasClick?.();
  }, [onCanvasClick, setSelectedNodeId, setContextMenu, setEdgeMenu]);

  // 节点模板
  const nodeTemplates = [
    { type: 'textGen', label: 'sidebar.nodes.textGen', icon: <FileText size={16} />, defaultData: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000, prompt: '', image: null } },
    { type: 'imageGen', label: 'sidebar.nodes.imageGen', icon: <Image size={16} />, defaultData: { model: 'nanobanana', prompt: '', aspectRatio: '1:1', quality: '1K' } },
    { type: 'videoGen', label: 'sidebar.nodes.videoGen', icon: <Video size={16} />, defaultData: { model: 'seedream-video', prompt: '', duration: 5, ratio: 'adaptive', watermark: false, generateAudio: false } },
    { type: '3dGen', label: 'sidebar.nodes.3dGen', icon: <Box size={16} />, defaultData: { model: 'seedream-3d', prompt: '', format: 'glb', subdivisionLevel: 'medium' } },
    { type: 'scriptRunner', label: 'sidebar.nodes.scriptRunner', icon: <Code size={16} />, defaultData: { language: 'python', code: '' } },
    { type: 'imageInput', label: 'sidebar.nodes.imageInput', icon: <Upload size={16} />, defaultData: { image: null } },
    { type: 'textInput', label: 'sidebar.nodes.textInput', icon: <FileText size={16} />, defaultData: { text: '' } },
    { type: 'videoInput', label: 'sidebar.nodes.videoInput', icon: <Video size={16} />, defaultData: { video: null } },
    { type: '3dInput', label: 'sidebar.nodes.3dInput', icon: <Box size={16} />, defaultData: { url: '', model: '' } },
    { type: 'textPreview', label: 'sidebar.nodes.textPreview', icon: <Eye size={16} />, defaultData: {} },
    { type: 'imagePreview', label: 'sidebar.nodes.imagePreview', icon: <Eye size={16} />, defaultData: { output: '' } },
    { type: 'videoPreview', label: 'sidebar.nodes.videoPreview', icon: <Eye size={16} />, defaultData: {} },
    { type: '3dPreview', label: 'sidebar.nodes.3dPreview', icon: <Eye size={16} />, defaultData: {} },
  ];

  // 右键菜单添加节点
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleAddNodeFromMenu = useCallback(
    (template: typeof nodeTemplates[0]) => {
      if (!contextMenu) return;
      const position = screenToFlowPosition({
        x: contextMenu.x,
        y: contextMenu.y,
      });
      const newNode: Node = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: template.type,
        position,
        data: {
          label: t(template.label),
          ...template.defaultData,
        },
      };
      addNode(newNode);
      setContextMenu(null);
    },
    [contextMenu, screenToFlowPosition, addNode, t]
  );

  const updateMenuScrollHint = useCallback(() => {
    const el = menuScrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    setShowMenuScrollHint(hasOverflow && !atBottom);
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edgeId: string) => {
    event.preventDefault();
    setEdgeMenu({ x: event.clientX, y: event.clientY, edgeId });
  }, []);

  const handleDeleteEdge = useCallback(() => {
    if (!edgeMenu) return;
    setEdges(edges.filter((edge) => edge.id !== edgeMenu.edgeId));
    setEdgeMenu(null);
  }, [edgeMenu, edges, setEdges]);

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target && connection.source === connection.target) {
        return false;
      }
      const sourceNode = connection.source ? nodesById.get(connection.source) : undefined;
      const targetNode = connection.target ? nodesById.get(connection.target) : undefined;
      const sourceType = getHandleType(sourceNode?.type, connection.sourceHandle, 'output');
      const targetType = getHandleType(targetNode?.type, connection.targetHandle, 'input');
      return isCompatibleHandleType(sourceType, targetType);
    },
    [nodesById]
  );

  const edgeTypes = useMemo(() => ({ deletable: DeletableEdge }), []);

  useEffect(() => {
    if (!contextMenu) return;
    const raf = requestAnimationFrame(updateMenuScrollHint);
    return () => cancelAnimationFrame(raf);
  }, [contextMenu, nodeTemplates.length, updateMenuScrollHint]);

  return (
    <div className="w-full h-full flex flex-col" ref={reactFlowWrapper}>
      <div className="flex-1 relative">
        {/* 顶部弥散光晕 */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none z-[1]"
          style={{
            height: '120px',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 35%, transparent 100%)',
            filter: 'blur(8px)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
          }}
        />
        {/* 底部弥散光晕 */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none z-[1]"
          style={{
            height: '120px',
            background: 'linear-gradient(to top, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 35%, transparent 100%)',
            filter: 'blur(8px)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
          }}
        />
        <ReactFlow
          nodes={nodes}
          edges={
            edgesVisible
              ? edges.map((edge) => {
                  const sourceNode = storeNodes.find((n) => n.id === edge.source);
                  const targetNode = storeNodes.find((n) => n.id === edge.target);
                  const isSourceRunning = sourceNode?.data?.status === 'running';
                  const targetRunning = targetNode?.data?.status === 'running';
                  const isLoading = isSourceRunning || targetRunning;
                  return {
                    ...edge,
                    type: edge.type ?? 'deletable',
                    className: isLoading ? 'edge-loading' : undefined,
                    animated: isLoading, // 运行时启用动画
                    data: { ...edge.data, isLoading },
                  };
                })
              : []
          }
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          isValidConnection={isValidConnection}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          className={`bg-transparent ${mouseMode === 'hand' ? 'mouse-mode-hand' : ''}`}
          onPaneClick={handlePaneClick}
          onPaneContextMenu={handleContextMenu}
          onEdgeContextMenu={(event, edge) => handleEdgeContextMenu(event, edge.id)}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          deleteKeyCode={['Backspace', 'Delete']}
          nodesDraggable={mouseMode === 'pointer'}
          nodesConnectable={true}
          elementsSelectable={true}
          panOnDrag={mouseMode === 'hand' ? [0, 1] : [1]}
          panOnScroll={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
          onlyRenderVisibleElements={true}
          nodeDragThreshold={0}
          connectionRadius={20}
          selectNodesOnDrag={false}
          elevateNodesOnSelect={false}
          elevateEdgesOnSelect={false}
          selectionOnDrag={true}
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Shift"
        >
          {appearanceConfig.canvasBackgroundImage ? (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${appearanceConfig.canvasBackgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.25,
              }}
            />
          ) : null}
          <Background
            variant={BackgroundVariant.Lines}
            gap={24}
            size={1}
            color="rgba(255, 255, 255, 0.08)"
          />
          {minimapVisible && (
            <MiniMap
              className="glass rounded-lg"
              pannable
              onClick={(_, position) => {
                const currentZoom = getZoom();
                setCenter(position.x, position.y, { zoom: currentZoom });
              }}
              nodeColor={(node) => {
                // 使用统一的颜色工具函数
                // 根据节点类型映射到数据类型
                const typeMap: Record<string, string> = {
                  'textGen': 'text',
                  'imageGen': 'image',
                  'videoGen': 'video',
                  '3dGen': '3d',
                };
                const dataType = typeMap[node.type || ''] || '3d';
                return getHandleColor(dataType, node.type);
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                width: 220,
                height: 160,
                position: 'absolute',
                bottom: 'calc(2rem + 42px)',
                right: '1rem',
                zIndex: 10,
              }}
              zoomable={false}
              maskColor="rgba(0, 0, 0, 0.3)"
              nodeStrokeWidth={2}
              nodeBorderRadius={4}
            />
          )}
          <Panel position="top-center" className="glass px-4 py-2 rounded-lg">
            {nodes.length === 0 ? (
              <p className="text-diffusion-text-secondary text-sm">
                右键点击添加节点
              </p>
            ) : (
              <p className="text-diffusion-text-secondary text-sm">
                {APP_NAME}
              </p>
            )}
          </Panel>
          {/* 欢迎提示 - 仅在无节点时显示 */}
          {storeNodes.length === 0 && (
            <div 
              className="react-flow__panel react-flow__panel-center pointer-events-none"
              style={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontFamily: "'Caveat', cursive",
                userSelect: 'none',
                pointerEvents: 'none',
                zIndex: 10
              }}
            >
              <p className="text-gray-400 text-3xl font-handwriting">
                Welcome to the {APP_NAME} Infinite Canvas
              </p>
            </div>
          )}
        </ReactFlow>
      </div>
      {/* 右下角悬浮面板 */}
      <BottomRightPanel
        onToggleMinimap={onToggleMinimap || (() => {})}
        minimapVisible={minimapVisible}
        onToggleEdges={onToggleEdges || (() => {})}
        edgesVisible={edgesVisible}
        zoom={zoom}
        onZoomIn={() => {
          const currentZoom = getZoom();
          zoomTo(currentZoom + 0.1);
        }}
        onZoomOut={() => {
          const currentZoom = getZoom();
          zoomTo(Math.max(0.1, currentZoom - 0.1));
        }}
        onFitView={fitView}
      />
      
      {/* 右键菜单 */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 glass-strong rounded-xl border border-diffusion-border shadow-2xl p-2 min-w-[200px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs text-diffusion-text-secondary px-3 py-2 font-semibold uppercase tracking-wider">
                Add Node
              </div>
              <div className="relative">
                <div
                  ref={menuScrollRef}
                  onScroll={updateMenuScrollHint}
                  className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-hidden"
                >
                {nodeTemplates.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => handleAddNodeFromMenu(template)}
                    className="group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-colors text-left"
                  >
                    <div className="text-diffusion-text-secondary group-hover:text-diffusion-text-primary">
                      {template.icon}
                    </div>
                    <span>{t(template.label)}</span>
                  </button>
                ))}
                </div>
                {showMenuScrollHint && (
                  <>
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-black/40" />
                    <div
                      className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 glass-strong rounded-full px-2 py-0.5 border border-white/10 text-diffusion-text-secondary shadow"
                      style={{
                        background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.92) 0%, rgba(10, 10, 15, 0.96) 100%)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
                      }}
                    >
                      <ChevronDown size={14} />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 连线右键菜单 */}
      <AnimatePresence>
        {edgeMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setEdgeMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 glass-strong rounded-xl border border-diffusion-border shadow-2xl p-2 min-w-[160px]"
              style={{ left: edgeMenu.x, top: edgeMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleDeleteEdge}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-500/10 transition-colors text-left"
              >
                删除连线
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

interface CanvasProps {
  minimapVisible?: boolean;
  edgesVisible?: boolean;
  onToggleMinimap?: () => void;
  onToggleEdges?: () => void;
  onCanvasClick?: () => void;
}

const Canvas: React.FC<CanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default Canvas;
