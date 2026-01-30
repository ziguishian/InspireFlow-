import React, { useLayoutEffect, useRef, useState, memo, useMemo, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { getModelOptions, getVideoModelTip, get3DModelTip } from '@/nodes/modelOptions';
import { getImageQualityOptions } from '@/config/modelMapping';
import { Trash2, Settings2, Palette, SkipForward, Play, Copy, Check, Info } from 'lucide-react';
import { executeNode } from '@/services/workflowExecutor';
import { getHandleColor } from '@/utils/colorUtils';
import { toast } from '@/utils/toast';
import CustomSelect from '@/components/UI/CustomSelect';
import { formatMissingRequired, validateNodeRequired } from '@/utils/nodeValidation';
import ModelViewerPortal from '@/components/3D/ModelViewerPortal';

interface BaseNodeData {
  label: string;
  model?: string;
  prompt?: string;
  [key: string]: any;
}

interface BaseNodeProps extends NodeProps {
  data: BaseNodeData;
  inputs?: Array<{ id: string; label?: string; type?: string }>;
  outputs?: Array<{ id: string; label?: string; type?: string }>;
  icon?: React.ReactNode;
  color?: 'blue' | 'purple' | 'cyan';
  nodeType?: 'text' | 'image' | 'video' | '3d' | 'other';
}

const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  inputs = [],
  outputs = [],
  icon,
  selected,
  id,
  type, // 节点的实际类型（如 'imageGen', 'imageInput'）
  nodeType = 'other',
}) => {
  const { t } = useLanguage();
  const { removeNode, setSelectedNodeId, updateNodeData, getEdges, getNodes } = useWorkflowStore();
  const saveConfig = useSettingsStore((state) => state.saveConfig);
  const isSkipped = Boolean(data.skip);
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isComposing, setIsComposing] = useState(false); // 标记是否正在使用输入法
  const nodeStatus = (data.status as 'idle' | 'running' | 'success' | 'error') || 'idle';
  const nodeColor = typeof data.nodeColor === 'string' ? data.nodeColor : '#4b5563';
  const edges = getEdges();
  const nodesSnapshotForValidation = getNodes();
  const currentNodeForValidation = nodesSnapshotForValidation.find((n) => n.id === id);
  const missingRequired = currentNodeForValidation && !isSkipped
    ? validateNodeRequired(currentNodeForValidation, nodesSnapshotForValidation, edges).missing
    : [];

  // 根据模型动态获取质量选项（仅图像生成节点）
  const qualityOptions = useMemo(() => {
    if (data.quality === undefined) return [];
    return getImageQualityOptions(data.model);
  }, [data.model, data.quality]);

  // 如果当前 quality 值不在选项中，自动调整为第一个选项
  useEffect(() => {
    if (data.quality !== undefined && qualityOptions.length > 0) {
      const isValidQuality = qualityOptions.some(opt => opt.value === data.quality);
      if (!isValidQuality) {
        updateNodeData(id, { quality: qualityOptions[0].value });
      }
    }
  }, [data.model, qualityOptions, data.quality, id, updateNodeData]);

  // 统一的输入框和按钮样式
  const inputBaseStyle: React.CSSProperties = {
    background: `${nodeColor}12`,
    borderColor: `${nodeColor}40`,
    boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
    userSelect: 'text',
    WebkitUserSelect: 'text',
    MozUserSelect: 'text',
    msUserSelect: 'text',
  };

  const inputBaseClassName = 'nodrag w-full px-2 py-1 text-xs text-diffusion-text-primary rounded border focus:outline-none select-text';
  const textareaBaseClassName = 'nodrag w-full px-2 py-1 text-xs text-diffusion-text-primary rounded border focus:outline-none resize-none custom-scrollbar select-text';
  const buttonBaseClassName = 'nodrag px-2 py-1 text-xs text-diffusion-text-secondary hover:text-diffusion-text-primary rounded border transition-colors flex items-center gap-1';
  const buttonBaseStyle: React.CSSProperties = {
    background: `${nodeColor}14`,
    borderColor: `${nodeColor}40`,
    boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
  };
  const allNodes = getNodes();
  const selectedNodes = allNodes.filter((node) => node.selected);
  const targetIds = (selectedNodes.length > 0 ? selectedNodes.map((node) => node.id) : [id]).filter(
    (value, index, self) => self.indexOf(value) === index
  );
  const isGroupSelection = selectedNodes.length > 1;
  const isGroupLeader = !isGroupSelection || selectedNodes[0]?.id === id;
  const areAllSkipped = isGroupSelection
    ? selectedNodes.every((node) => Boolean(node.data?.skip))
    : isSkipped;
  const getDownloadName = (kind: 'image' | 'video' | '3d', output: string | string[] | any) => {
    // 处理数组情况：如果是数组，取第一个元素
    let outputStr: string;
    if (Array.isArray(output)) {
      outputStr = output.length > 0 ? String(output[0]) : '';
    } else if (typeof output === 'string') {
      outputStr = output;
    } else {
      // 如果不是字符串也不是数组，尝试转换为字符串
      outputStr = String(output || '');
    }

    // 如果输出为空，使用默认扩展名
    if (!outputStr) {
      const ext = kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'glb';
      const baseName = `${kind}-${Date.now()}`;
      if (!saveConfig.enabled) {
        return `${baseName}.${ext}`;
      }
      const rawPath = saveConfig.path?.trim() || 'outputs';
      const normalized = saveConfig.useRelativePath
        ? rawPath.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '')
        : rawPath.replace(/\\/g, '/').replace(/\/$/, '');
      return `${normalized}/${baseName}.${ext}`;
    }

    const now = Date.now();
    const baseName = `${kind}-${now}`;
    let ext = '';

    if (outputStr.startsWith('data:')) {
      const match = outputStr.match(/^data:([^;]+);/);
      if (match?.[1]) {
        const type = match[1].split('/')[1];
        if (type) ext = type;
      }
    } else {
      try {
        const url = new URL(outputStr);
        const parts = url.pathname.split('.');
        if (parts.length > 1) {
          ext = parts[parts.length - 1];
        }
      } catch {
        // ignore parse errors for non-URL outputs
      }
    }

    if (!ext) {
      ext = kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'glb';
    }

    if (!saveConfig.enabled) {
      return `${baseName}.${ext}`;
    }

    const rawPath = saveConfig.path?.trim() || 'outputs';
    const normalized = saveConfig.useRelativePath
      ? rawPath.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '')
      : rawPath.replace(/\\/g, '/').replace(/\/$/, '');
    return `${normalized}/${baseName}.${ext}`;
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(isGroupSelection ? '确定要删除所选节点吗？' : '确定要删除这个节点吗？')) {
      targetIds.forEach((targetId) => removeNode(targetId));
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSkip = isGroupSelection ? !areAllSkipped : !isSkipped;
    targetIds.forEach((targetId) => updateNodeData(targetId, { skip: nextSkip }));
  };

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const edges = getEdges();
    const nodesSnapshot = getNodes();
    const missingByNode: Array<{ nodeId: string; label: string; missingText: string }> = [];
    for (const targetId of targetIds) {
      const n = nodesSnapshot.find((x) => x.id === targetId);
      if (!n || n.data?.skip) continue;
      const { missing } = validateNodeRequired(n, nodesSnapshot, edges);
      if (missing.length > 0) {
        missingByNode.push({
          nodeId: targetId,
          label: n.data?.label || n.type || targetId,
          missingText: formatMissingRequired(missing),
        });
      }
    }
    if (missingByNode.length > 0) {
      for (const item of missingByNode) {
        updateNodeData(item.nodeId, { status: 'error' });
      }
      const preview = missingByNode
        .slice(0, 3)
        .map((x) => `「${x.label}」${x.missingText}`)
        .join('；');
      toast.warning(
        `节点缺少必填项：${preview}${missingByNode.length > 3 ? '…' : ''}。请先输入对应的值再运行。`,
        5000
      );
      return;
    }
    targetIds.forEach((targetId) => updateNodeData(targetId, { status: 'running' }));
    for (const targetId of targetIds) {
      const currentNode = nodesSnapshot.find((n) => n.id === targetId);
      if (!currentNode) {
        updateNodeData(targetId, { status: 'error' });
        continue;
      }
    // 获取保存配置和工作流 ID
    const saveConfig = useSettingsStore.getState().saveConfig;
    const activeWorkflowId = useWorkflowStore.getState().activeWorkflowId;
    
    const result = await executeNode(currentNode, nodesSnapshot, edges, {
      saveConfig,
      workflowId: activeWorkflowId || undefined,
    });
      if (result.success) {
        if (result.skipped) {
          updateNodeData(targetId, { status: 'idle' });
          continue;
        }
        updateNodeData(targetId, {
          output: result.output,
          ...(result.outputs || {}),
          status: 'success',
        });
        // 保存到生成历史：支持预览节点和生成节点
        // 无论 saveConfig.enabled 是否为 true，都要添加到历史记录
        const nodeTypeName = currentNode.type || '';
        
        // 提取图像/视频/3D URL（供历史记录等使用，保存逻辑由 workflowExecutor 统一处理）
        let _mediaUrl: string | null = null;
        let _mediaType: 'image' | 'video' | '3d' | null = null;
        
        if (nodeTypeName === 'imagePreview' || nodeTypeName === 'imageGen') {
          _mediaType = 'image';
          // 处理多种格式：字符串、数组、对象
          if (typeof result.output === 'string') {
            _mediaUrl = result.output;
          } else if (Array.isArray(result.output) && result.output.length > 0) {
            _mediaUrl = typeof result.output[0] === 'string' ? result.output[0] : null;
          } else if (result.output && typeof result.output === 'object') {
            if ('url' in result.output && typeof result.output.url === 'string') {
              _mediaUrl = result.output.url;
            } else if ('data' in result.output && typeof result.output.data === 'string') {
              const mimeType = result.output.mimeType || result.output.mime_type || 'image/png';
              _mediaUrl = `data:${mimeType};base64,${result.output.data}`;
            }
          }
        } else if (nodeTypeName === 'videoPreview' || nodeTypeName === 'videoGen') {
          _mediaType = 'video';
          if (typeof result.output === 'string') {
            _mediaUrl = result.output;
          } else if (Array.isArray(result.output) && result.output.length > 0) {
            _mediaUrl = typeof result.output[0] === 'string' ? result.output[0] : null;
          } else if (result.output && typeof result.output === 'object' && 'url' in result.output) {
            _mediaUrl = typeof result.output.url === 'string' ? result.output.url : null;
          }
        } else if (nodeTypeName === '3dPreview' || nodeTypeName === '3dGen') {
          _mediaType = '3d';
          if (typeof result.output === 'string') {
            _mediaUrl = result.output;
          } else if (Array.isArray(result.output) && result.output.length > 0) {
            _mediaUrl = typeof result.output[0] === 'string' ? result.output[0] : null;
          } else if (result.output && typeof result.output === 'object' && 'url' in result.output) {
            _mediaUrl = typeof result.output.url === 'string' ? result.output.url : null;
          }
        }
        void _mediaUrl;
        void _mediaType;
        // 注意：保存逻辑已由 workflowExecutor.ts 中的 autoSaveNodeOutput 统一处理
        // 对于单个节点执行，如果节点是生成节点（imageGen, videoGen, 3dGen, textGen），
        // 也会通过 executeNode -> executeWorkflow -> autoSaveNodeOutput 自动保存
        // 这里不再重复保存，避免重复记录
      } else {
        updateNodeData(targetId, { status: 'error' });
      }
    }
  };

  const incomingHandles = new Set(
    edges
      .filter((edge) => edge.target === id)
      .map((edge) => edge.targetHandle)
      .filter((handleId): handleId is string => Boolean(handleId))
  );
  const isHandleConnected = (handleId: string) => incomingHandles.has(handleId);

  const handleEditField = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const handleSaveField = () => {
    if (editingField) {
      updateNodeData(id, { [editingField]: editValue });
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const HANDLE_SIZE = 16;
  const HANDLE_SPACING = 24;
  const HANDLE_ALIGN_OFFSET = 10;
  const getHandleOffset = (index: number, total: number, spacing = HANDLE_SPACING) => {
    if (total <= 1) return 0;
    const start = -(total - 1) / 2;
    return (start + index) * spacing;
  };

  const nodeWrapperRef = useRef<HTMLDivElement | null>(null);
  const firstPropertyRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [inputHandleBaseTop, setInputHandleBaseTop] = useState<number | null>(null);
  const [outputHandleBaseTop, setOutputHandleBaseTop] = useState<number | null>(null);
  firstPropertyRef.current = null;

  let firstPropertyAssigned = false;
  const maybeFirstPropertyRef = () => {
    if (firstPropertyAssigned) return undefined;
    firstPropertyAssigned = true;
    return firstPropertyRef;
  };

  useLayoutEffect(() => {
    if (!nodeWrapperRef.current) {
      if (inputHandleBaseTop !== null) {
        setInputHandleBaseTop(null);
      }
      if (outputHandleBaseTop !== null) {
        setOutputHandleBaseTop(null);
      }
      return;
    }
    const wrapperRect = nodeWrapperRef.current.getBoundingClientRect();
    if (headerRef.current) {
      const headerBottom = headerRef.current.offsetTop + headerRef.current.offsetHeight;
      const anchorCenterTop = headerBottom + HANDLE_ALIGN_OFFSET + HANDLE_SIZE / 2;
      const nextInputTop = anchorCenterTop + ((inputs.length - 1) * HANDLE_SPACING) / 2;
      const nextOutputTop = anchorCenterTop + ((outputs.length - 1) * HANDLE_SPACING) / 2;
      if (!Number.isNaN(nextInputTop) && nextInputTop !== inputHandleBaseTop) {
        setInputHandleBaseTop(nextInputTop);
      }
      if (!Number.isNaN(nextOutputTop) && nextOutputTop !== outputHandleBaseTop) {
        setOutputHandleBaseTop(nextOutputTop);
      }
      return;
    }
    if (!firstPropertyRef.current) {
      if (inputHandleBaseTop !== null) {
        setInputHandleBaseTop(null);
      }
      if (outputHandleBaseTop !== null) {
        setOutputHandleBaseTop(null);
      }
      return;
    }
    const propertyRect = firstPropertyRef.current.getBoundingClientRect();
    const anchorCenterTop = propertyRect.top - wrapperRect.top + propertyRect.height / 2;
    const nextInputTop = anchorCenterTop + ((inputs.length - 1) * HANDLE_SPACING) / 2;
    const nextOutputTop = anchorCenterTop + ((outputs.length - 1) * HANDLE_SPACING) / 2;
    if (!Number.isNaN(nextInputTop) && nextInputTop !== inputHandleBaseTop) {
      setInputHandleBaseTop(nextInputTop);
    }
    if (!Number.isNaN(nextOutputTop) && nextOutputTop !== outputHandleBaseTop) {
      setOutputHandleBaseTop(nextOutputTop);
    }
  }, [
    inputs.length,
    outputs.length,
    nodeType,
    data?.label,
    data?.model,
    data?.prompt,
    data?.language,
    data?.output,
    inputHandleBaseTop,
    outputHandleBaseTop,
  ]);

  return (
    <div className="relative inline-block">
      {/* 节点外部的操作按钮 - 在节点上方，水平居中 */}
      <AnimatePresence>
        {selected && isGroupLeader && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 flex items-center gap-1 glass-strong rounded-lg px-2 py-1.5 border border-white/10 whitespace-nowrap"
            style={{
              top: '-3rem',
              left: 0,
              right: 0,
              marginLeft: 'auto',
              marginRight: 'auto',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(18, 18, 26, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDelete}
              className="p-1.5 rounded text-diffusion-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="删除"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(!isEditing);
                // 触发属性面板显示
                const event = new CustomEvent('toggle-properties', { detail: { show: !isEditing } });
                window.dispatchEvent(event);
              }}
              className={`p-1.5 rounded transition-all ${
                isEditing
                  ? 'text-diffusion-glow-cyan bg-diffusion-glow-cyan/10'
                  : 'text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary'
              }`}
              title="节点属性"
            >
              <Settings2 size={14} />
            </button>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColorPicker(!showColorPicker);
                }}
                className="p-1.5 rounded text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary transition-all"
                title="颜色修改"
              >
                <Palette size={14} />
              </button>
              {showColorPicker && (
                <div
                  className="absolute top-full left-0 mt-1 glass-strong rounded-lg p-2 border border-white/10 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    {['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'].map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          targetIds.forEach((targetId) => updateNodeData(targetId, { nodeColor: c }));
                          setShowColorPicker(false);
                        }}
                        className={`w-6 h-6 rounded ${
                          nodeColor === c ? 'ring-2 ring-white' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="h-6 w-px bg-white/10" />
                    <input
                      type="color"
                      value={nodeColor}
                      onChange={(e) =>
                        targetIds.forEach((targetId) => updateNodeData(targetId, { nodeColor: e.target.value }))
                      }
                      onBlur={() => setShowColorPicker(false)}
                      className="w-8 h-6 p-0 bg-transparent border border-white/20 rounded"
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleSkip}
              className={`p-1.5 rounded transition-all ${
                areAllSkipped
                  ? 'text-yellow-400 bg-yellow-500/10'
                  : 'text-diffusion-text-secondary hover:text-diffusion-text-primary hover:bg-diffusion-bg-tertiary'
              }`}
              title="跳过当前节点"
            >
              <SkipForward size={14} />
            </button>
            <button
              onClick={handleRun}
              className="p-1.5 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
              title="运行当前节点"
            >
              <Play size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="relative"
        onClick={() => setSelectedNodeId(id)}
        ref={nodeWrapperRef}
      >
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: selected
              ? `0 0 24px ${nodeColor}88, 0 0 60px ${nodeColor}33`
              : `0 0 6px ${nodeColor}33`,
          }}
        />
        {/* 节点主体 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ 
            opacity: isSkipped ? 0.5 : 1, 
            scale: 1,
          }}
          transition={{ 
            duration: 0.15,
            ease: [0.4, 0, 0.2, 1] 
          }}
          className={`
            relative overflow-visible rounded-2xl cursor-pointer glass-strong
            border min-w-[240px] max-w-[320px] shadow-2xl
            transition-all duration-150
          `}
          style={{
            background: selected
              ? `linear-gradient(160deg, rgba(26, 27, 33, 0.94) 0%, rgba(14, 15, 20, 0.98) 100%),
                 radial-gradient(140% 90% at 10% 0%, ${nodeColor}20 0%, transparent 70%)`
              : `linear-gradient(160deg, rgba(24, 25, 30, 0.9) 0%, rgba(14, 15, 20, 0.95) 100%),
                 radial-gradient(140% 90% at 10% 0%, ${nodeColor}12 0%, transparent 75%)`,
            backdropFilter: 'blur(12px) saturate(140%)',
            borderColor: selected ? `${nodeColor}CC` : `${nodeColor}55`,
            boxShadow: selected
              ? `0 16px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4)`
              : `0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.35)`,
            filter: isSkipped ? 'grayscale(0.3)' : 'none',
          }}
        >
          {/* 内容遮罩（保持圆角与裁切） */}
          <div className="relative overflow-hidden rounded-2xl">
            {/* 顶部内发光效果 */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none" />
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: `radial-gradient(120% 80% at 20% 0%, ${nodeColor}18 0%, transparent 75%)`,
              }}
            />

            {/* 内容区域 */}
            <div className="relative">
            {/* 头部：标题和图标 */}
            <div
              className="flex items-center gap-2 px-4 py-3 border-b border-white/10 relative"
              ref={headerRef}
              style={{ borderBottomColor: `${nodeColor}66` }}
            >
              {icon && (
                <div
                  className="text-diffusion-text-secondary flex-shrink-0"
                  style={{ color: nodeColor }}
                >
                  {icon}
                </div>
              )}
              <h3 className="text-sm font-medium text-diffusion-text-primary truncate flex-1">
                {data.label}
              </h3>
              {/* 运行状态信号灯 */}
              <div 
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
                  missingRequired.length > 0 ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]' :
                  isSkipped ? 'bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.6)]' :
                  nodeStatus === 'running' ? 'bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)]' :
                  nodeStatus === 'success' ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                  nodeStatus === 'error' ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                  'bg-gray-500/50'
                }`} 
                title={
                  missingRequired.length > 0 ? `缺少必填项：${formatMissingRequired(missingRequired)}。请先输入对应的值再运行。` :
                  isSkipped ? '已跳过' :
                  nodeStatus === 'running' ? '运行中' :
                  nodeStatus === 'success' ? '运行成功' :
                  nodeStatus === 'error' ? '运行失败' :
                  '未运行'
                }
              />
            </div>
            
            {/* 缺失必填项提醒 - 显示在头部下方 */}
            <AnimatePresence>
              {missingRequired.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-3 py-2 bg-red-500/15 border-b border-red-500/30 overflow-hidden"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-red-300 font-medium leading-tight">
                        缺少必填项
                      </p>
                      <p className="text-[10px] text-red-400/80 leading-tight mt-0.5 break-words">
                        请输入：{formatMissingRequired(missingRequired)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 可编辑属性区域 */}
            <div className="relative px-4 py-3 space-y-2">
            {/* 文本输入节点 - 显示为输入框 */}
            {type === 'textInput' && (
              <div className="mb-2" ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">文本输入</label>
                <textarea
                  value={(() => {
                    // 对于 textInput 节点，优先使用 text 字段（这是输入字段）
                    if (typeof data.text === 'string') return data.text;
                    if (typeof data.output === 'string') return data.output;
                    return '';
                  })()}
                  onChange={(e) => {
                    // 对于 textInput 节点，同时更新 text 和 output 字段
                    updateNodeData(id, { text: e.target.value, output: e.target.value });
                  }}
                  placeholder={t('nodeParams.placeholderText')}
                  className={`${textareaBaseClassName} max-h-32 min-h-[4rem]`}
                  rows={6}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // 阻止节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = 'none';
                      (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // 恢复节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = '';
                    }
                  }}
                  onCompositionStart={(e) => {
                    setIsComposing(true);
                    e.stopPropagation();
                  }}
                  onCompositionEnd={(e) => {
                    setIsComposing(false);
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 如果正在使用输入法，不阻止事件传播
                    if (!isComposing && (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'TEXTAREA')) {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }}
                  onMouseMove={(e) => {
                    e.stopPropagation();
                  }}
                  onDragStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={inputBaseStyle}
                />
              </div>
            )}

            {/* 文本节点预览 - 兼容不同格式的文本输入（非textInput节点） */}
            {nodeType === 'text' && type !== 'textInput' && (
              <div className="mb-2" ref={maybeFirstPropertyRef()}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-diffusion-text-secondary">预览</label>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const textValue = (() => {
                        // 兼容多种文本格式
                        if (typeof data.output === 'string') return data.output;
                        if (typeof data.text === 'string') return data.text;
                        if (data.output && typeof data.output === 'object') {
                          if ('text' in data.output) return String(data.output.text);
                          if ('content' in data.output) return String(data.output.content);
                          if ('message' in data.output) return String(data.output.message);
                          return JSON.stringify(data.output);
                        }
                        if (Array.isArray(data.output)) {
                          return data.output.map(item => String(item)).join('\n');
                        }
                        return '';
                      })();
                      
                      if (!textValue || textValue.trim().length === 0) {
                        toast.warning('没有可复制的内容');
                        return;
                      }
                      
                      try {
                        await navigator.clipboard.writeText(textValue);
                        toast.success('已复制到剪贴板');
                      } catch (error) {
                        console.error('复制失败:', error);
                        // 降级方案：使用传统方法
                        const textArea = document.createElement('textarea');
                        textArea.value = textValue;
                        textArea.style.position = 'fixed';
                        textArea.style.opacity = '0';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        try {
                          const successful = document.execCommand('copy');
                          if (successful) {
                            toast.success('已复制到剪贴板');
                          } else {
                            toast.error('复制失败，请手动选择文本复制');
                          }
                        } catch (err) {
                          console.error('降级复制方法也失败:', err);
                          toast.error('复制失败，请手动选择文本复制');
                        }
                        document.body.removeChild(textArea);
                      }
                    }}
                    className={buttonBaseClassName}
                    style={buttonBaseStyle}
                    title="复制文本"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Copy size={12} />
                    <span>复制</span>
                  </button>
                </div>
                <textarea
                  value={(() => {
                    // 兼容多种文本格式
                    if (typeof data.output === 'string') return data.output;
                    if (typeof data.text === 'string') return data.text;
                    if (data.output && typeof data.output === 'object') {
                      if ('text' in data.output) return String(data.output.text);
                      if ('content' in data.output) return String(data.output.content);
                      if ('message' in data.output) return String(data.output.message);
                      return JSON.stringify(data.output);
                    }
                    if (Array.isArray(data.output)) {
                      return data.output.map(item => String(item)).join('\n');
                    }
                    return '';
                  })()}
                  onChange={(e) => {
                    updateNodeData(id, { output: e.target.value });
                  }}
                  placeholder={t('nodeParams.runResult')}
                  className={`${textareaBaseClassName} max-h-32 min-h-[4rem]`}
                  rows={6}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // 阻止节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = 'none';
                      (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // 恢复节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = '';
                    }
                  }}
                  onCompositionStart={(e) => {
                    setIsComposing(true);
                    e.stopPropagation();
                  }}
                  onCompositionEnd={(e) => {
                    setIsComposing(false);
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 如果正在使用输入法，不阻止事件传播
                    if (!isComposing && (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'TEXTAREA')) {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }}
                  onMouseMove={(e) => {
                    e.stopPropagation();
                  }}
                  onDragStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={inputBaseStyle}
                />
              </div>
            )}

            {/* 图像预览节点 - 显示预览和下载按钮 */}
            {type === 'imagePreview' && (data.output !== undefined || data.image !== undefined) && (
              <div className="mb-2" ref={maybeFirstPropertyRef()}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-diffusion-text-secondary">预览</label>
                  {(() => {
                    // 兼容多种图像格式：output, image, url, src 等
                    let imageValue: string | null = null;
                    if (data.output) {
                      if (Array.isArray(data.output)) {
                        imageValue = data.output[0] || null;
                      } else if (typeof data.output === 'string') {
                        imageValue = data.output;
                      } else if (typeof data.output === 'object' && 'url' in data.output) {
                        imageValue = data.output.url;
                      } else if (typeof data.output === 'object' && 'data' in data.output) {
                        const mimeType = data.output.mimeType || data.output.mime_type || 'image/png';
                        imageValue = `data:${mimeType};base64,${data.output.data}`;
                      }
                    } else if (data.image) {
                      if (Array.isArray(data.image)) {
                        imageValue = data.image[0] || null;
                      } else if (typeof data.image === 'string') {
                        imageValue = data.image;
                      }
                    } else if (data.url) {
                      imageValue = data.url;
                    } else if (data.src) {
                      imageValue = data.src;
                    }
                    
                    return imageValue && (
                      <a
                        href={imageValue}
                        download={getDownloadName('image', imageValue)}
                        className={buttonBaseClassName}
                        onClick={(e) => e.stopPropagation()}
                        style={buttonBaseStyle}
                      >
                        下载
                      </a>
                    );
                  })()}
                </div>
                <div
                  className="px-2 py-2 rounded border min-h-[6rem] w-full"
                  style={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}40`,
                    boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
                  }}
                >
                  {(() => {
                    // 兼容多种图像格式
                    let imageValue: string | null = null;
                    if (data.output) {
                      if (Array.isArray(data.output)) {
                        imageValue = data.output[0] || null;
                      } else if (typeof data.output === 'string') {
                        imageValue = data.output;
                      } else if (typeof data.output === 'object' && 'url' in data.output) {
                        imageValue = data.output.url;
                      } else if (typeof data.output === 'object' && 'data' in data.output) {
                        const mimeType = data.output.mimeType || data.output.mime_type || 'image/png';
                        imageValue = `data:${mimeType};base64,${data.output.data}`;
                      }
                    } else if (data.image) {
                      if (Array.isArray(data.image)) {
                        imageValue = data.image[0] || null;
                      } else if (typeof data.image === 'string') {
                        imageValue = data.image;
                      }
                    } else if (data.url) {
                      imageValue = data.url;
                    } else if (data.src) {
                      imageValue = data.src;
                    }
                    
                    return imageValue ? (
                      <img src={imageValue} alt="preview" className="w-full h-auto rounded" onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const errorMsg = document.createElement('span');
                          errorMsg.className = 'text-xs text-red-400';
                          errorMsg.textContent = '图像加载失败';
                          parent.appendChild(errorMsg);
                        }
                      }} />
                    ) : (
                      <span className="text-xs text-diffusion-text-secondary">运行后显示图像...</span>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 图像生成节点预览 - 只显示预览，不显示下载按钮和文件选择 */}
            {type === 'imageGen' && data.output !== undefined && (
              <div className="mb-2" ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">预览</label>
                <div
                  className="px-2 py-2 rounded border min-h-[6rem] w-full"
                  style={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}40`,
                    boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
                  }}
                >
                  {(() => {
                    // 兼容多种图像格式
                    let imageValue: string | null = null;
                    if (data.output) {
                      if (Array.isArray(data.output)) {
                        imageValue = data.output[0] || null;
                      } else if (typeof data.output === 'string') {
                        imageValue = data.output;
                      } else if (typeof data.output === 'object' && 'url' in data.output) {
                        imageValue = data.output.url;
                      } else if (typeof data.output === 'object' && 'data' in data.output) {
                        const mimeType = data.output.mimeType || data.output.mime_type || 'image/png';
                        imageValue = `data:${mimeType};base64,${data.output.data}`;
                      }
                    }
                    
                    return imageValue ? (
                      <img src={imageValue} alt="preview" className="w-full h-auto rounded" onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const errorMsg = document.createElement('span');
                          errorMsg.className = 'text-xs text-red-400';
                          errorMsg.textContent = '图像加载失败';
                          parent.appendChild(errorMsg);
                        }
                      }} />
                    ) : (
                      <span className="text-xs text-diffusion-text-secondary">运行后显示图像...</span>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 图像输入节点 - 显示文件选择和预览，不显示下载按钮 */}
            {type === 'imageInput' && (
              <div className="mb-2" ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">图像</label>
                <input
                  id={`${id}-image-upload`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isHandleConnected('image')}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const imageData = reader.result as string;
                      console.log(`[BaseNode] 图像上传完成，准备更新节点数据:`, {
                        nodeId: id,
                        imageDataLength: imageData?.length,
                        imageDataPreview: imageData?.substring(0, 50),
                      });
                      // 强制更新节点数据，确保立即渲染
                      updateNodeData(id, { image: imageData });
                      // 重置 input 值，允许重复选择同一文件
                      e.target.value = '';
                    };
                    reader.onerror = (error) => {
                      console.error('[BaseNode] 读取图像文件失败:', error);
                    };
                    reader.readAsDataURL(file);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor={`${id}-image-upload`}
                  className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border cursor-pointer transition-colors mb-2 ${
                    isHandleConnected('image')
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:text-diffusion-text-primary'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: `${nodeColor}14`,
                    borderColor: `${nodeColor}55`,
                    color: 'var(--diffusion-text-secondary)',
                    boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
                  }}
                >
                  选择文件
                </label>
                {data.image && (
                  <div className="mt-2">
                    <img 
                      src={data.image} 
                      alt="input" 
                      className="w-full h-auto rounded border border-white/10"
                      key={data.image?.substring(0, 100)} // 使用 key 强制重新渲染
                      onError={(e) => {
                        console.error('[BaseNode] 图像加载失败:', data.image?.substring(0, 50));
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const errorMsg = document.createElement('span');
                          errorMsg.className = 'text-xs text-red-400';
                          errorMsg.textContent = '图像加载失败';
                          parent.appendChild(errorMsg);
                        }
                      }}
                      onLoad={() => {
                        console.log('[BaseNode] 图像加载成功');
                      }}
                    />
                  </div>
                )}
                {isHandleConnected('image') && (
                  <div className="mt-1 text-[10px] text-diffusion-text-secondary">
                    外部输入已连接，内部输入失效
                  </div>
                )}
              </div>
            )}

            {/* Seedream 3D 加载节点 - 输入下载链接（zip）用于测试预览 */}
            {type === '3dInput' && (
              <div className="mb-2" ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">Seedream 3D 下载链接</label>
                <textarea
                  value={data.url ?? data.model ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    updateNodeData(id, { url: v || undefined, model: v || undefined, output: v || undefined });
                  }}
                  placeholder="粘贴方舟 3D 生成返回的 file_url（zip 链接）"
                  className={`${textareaBaseClassName} font-mono text-[10px]`}
                  rows={3}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isHandleConnected('model')}
                />
                {isHandleConnected('model') && (
                  <div className="mt-1 text-[10px] text-diffusion-text-secondary">
                    外部输入已连接，内部输入失效
                  </div>
                )}
              </div>
            )}
            
            {/* 视频节点预览 - 展示来自上游节点的视频（videoPreview 仅展示输入连线视频，无上传） */}
            {nodeType === 'video' && (
              <div className="mb-2" ref={maybeFirstPropertyRef()}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-diffusion-text-secondary">预览</label>
                  {(() => {
                    // 兼容多种视频格式：output, video, url, src 等
                    let videoValue: string | null = null;
                    if (data.output) {
                      if (Array.isArray(data.output)) {
                        videoValue = data.output[0] || null;
                      } else if (typeof data.output === 'string') {
                        videoValue = data.output;
                      } else if (typeof data.output === 'object' && 'url' in data.output) {
                        videoValue = data.output.url;
                      }
                    } else if (data.video) {
                      if (Array.isArray(data.video)) {
                        videoValue = data.video[0] || null;
                      } else if (typeof data.video === 'string') {
                        videoValue = data.video;
                      }
                    } else if (data.url) {
                      videoValue = data.url;
                    } else if (data.src) {
                      videoValue = data.src;
                    }
                    
                    return videoValue && (
                      <a
                        href={videoValue}
                        download={getDownloadName('video', videoValue)}
                        className="text-[10px] px-2 py-0.5 rounded border text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: `${nodeColor}14`,
                          borderColor: `${nodeColor}40`,
                          boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
                        }}
                      >
                        下载
                      </a>
                    );
                  })()}
                </div>
                <div
                  className="px-2 py-2 rounded border min-h-[6rem] w-full"
                  style={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}40`,
                    boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
                  }}
                >
                  {(() => {
                    // 兼容多种视频格式
                    let videoValue: string | null = null;
                    if (data.output) {
                      if (Array.isArray(data.output)) {
                        videoValue = data.output[0] || null;
                      } else if (typeof data.output === 'string') {
                        videoValue = data.output;
                      } else if (typeof data.output === 'object' && 'url' in data.output) {
                        videoValue = data.output.url;
                      }
                    } else if (data.video) {
                      if (Array.isArray(data.video)) {
                        videoValue = data.video[0] || null;
                      } else if (typeof data.video === 'string') {
                        videoValue = data.video;
                      }
                    } else if (data.url) {
                      videoValue = data.url;
                    } else if (data.src) {
                      videoValue = data.src;
                    }
                    
                    return videoValue ? (
                      <video src={videoValue} className="w-full h-auto rounded" controls onError={(e) => {
                        const target = e.target as HTMLVideoElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const errorMsg = document.createElement('span');
                          errorMsg.className = 'text-xs text-red-400';
                          errorMsg.textContent = '视频加载失败';
                          parent.appendChild(errorMsg);
                        }
                      }} />
                    ) : (
                      <span className="text-xs text-diffusion-text-secondary">运行后显示视频...</span>
                    );
                  })()}
                </div>
              </div>
            )}
            
            {/* 3D 节点预览（3dGen / 3dPreview 共用）：支持 zip（file_url 含 .zip 或无后缀）解压后预览 pbr/rgb 下 GLB，直链 .glb/.gltf 直接预览 */}
            {nodeType === '3d' && (
              <div className="mb-2" ref={maybeFirstPropertyRef()}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-diffusion-text-secondary">预览</label>
                  {(() => {
                    // 兼容多种3D格式：output, model, url, src 等
                    let modelValue: string | null = null;
                    if (data.output) {
                      if (Array.isArray(data.output)) {
                        modelValue = data.output[0] || null;
                      } else if (typeof data.output === 'string') {
                        modelValue = data.output;
                      } else if (typeof data.output === 'object' && 'url' in data.output) {
                        modelValue = data.output.url;
                      }
                    } else if (data.model) {
                      if (Array.isArray(data.model)) {
                        modelValue = data.model[0] || null;
                      } else if (typeof data.model === 'string') {
                        modelValue = data.model;
                      }
                    } else if (data['3d']) {
                      if (Array.isArray(data['3d'])) {
                        modelValue = data['3d'][0] || null;
                      } else if (typeof data['3d'] === 'string') {
                        modelValue = data['3d'];
                      }
                    } else if (data.url) {
                      modelValue = data.url;
                    } else if (data.src) {
                      modelValue = data.src;
                    }
                    
                    const isZipLike = modelValue && (/\.zip(\?|$)/i.test(modelValue) || ((modelValue.startsWith('http://') || modelValue.startsWith('https://')) && !/\.(glb|gltf)(\?|$)/i.test(modelValue)));
                    return modelValue && (
                      <a
                        href={modelValue}
                        download={getDownloadName('3d', modelValue)}
                        className="text-[10px] px-2 py-0.5 rounded border text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: `${nodeColor}14`,
                          borderColor: `${nodeColor}40`,
                          boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
                        }}
                      >
                        {isZipLike ? '下载压缩包' : '下载'}
                      </a>
                    );
                  })()}
                </div>
                <div
                  className="px-2 py-2 rounded border min-h-[6rem] w-full"
                  style={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}40`,
                    boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
                  }}
                >
                  {(() => {
                    // 兼容多种3D格式
                    let modelValue: string | null = null;
                    if (data.output) {
                      if (Array.isArray(data.output)) {
                        modelValue = data.output[0] || null;
                      } else if (typeof data.output === 'string') {
                        modelValue = data.output;
                      } else if (typeof data.output === 'object' && 'url' in data.output) {
                        modelValue = data.output.url;
                      }
                    } else if (data.model) {
                      if (Array.isArray(data.model)) {
                        modelValue = data.model[0] || null;
                      } else if (typeof data.model === 'string') {
                        modelValue = data.model;
                      }
                    } else if (data['3d']) {
                      if (Array.isArray(data['3d'])) {
                        modelValue = data['3d'][0] || null;
                      } else if (typeof data['3d'] === 'string') {
                        modelValue = data['3d'];
                      }
                    } else if (data.url) {
                      modelValue = data.url;
                    } else if (data.src) {
                      modelValue = data.src;
                    }
                    
                    // file_url 可能无 .zip 后缀：方舟 3D 返回的压缩包，结构为 压缩包/pbr/*.glb、压缩包/rgb/*.glb，一律按 zip 解压预览
                    const isDirectGlb = modelValue && /\.(glb|gltf)(\?|$)/i.test(modelValue);
                    const isZipUrl =
                      modelValue &&
                      (/\.zip(\?|$)/i.test(modelValue) ||
                        (modelValue.startsWith('http://') || modelValue.startsWith('https://')) && !isDirectGlb);

                    return modelValue ? (
                      <div className="w-full h-64 rounded overflow-hidden relative nodrag nopan">
                        {isZipUrl ? (
                          <ModelViewerPortal zipUrl={modelValue} nodeColor={nodeColor} className="h-full" />
                        ) : isDirectGlb ? (
                          <ModelViewerPortal
                            url={modelValue}
                            nodeColor={nodeColor}
                            downloadHref={modelValue}
                            className="h-full"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-2">
                            <span className="text-xs text-diffusion-text-primary text-center px-2">
                              3D模型文件已生成
                            </span>
                            <span className="text-[10px] text-diffusion-text-muted text-center px-2 break-all">
                              {modelValue.split('/').pop() || modelValue}
                            </span>
                            <span className="text-[10px] text-diffusion-text-muted text-center px-2">
                              格式: {modelValue.split('.').pop()?.toUpperCase() || '未知'}
                            </span>
                            <a
                              href={modelValue}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="text-[10px] px-3 py-1.5 rounded border text-diffusion-text-secondary hover:text-diffusion-text-primary transition-colors"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                background: `${nodeColor}14`,
                                borderColor: `${nodeColor}40`,
                                boxShadow: `inset 0 0 0 1px ${nodeColor}1A`,
                              }}
                            >
                              在新窗口打开/下载
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-diffusion-text-secondary">运行后显示3D模型...</span>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 文本输入 - 文本生成节点不显示 */}
            {data.text !== undefined && nodeType !== 'text' && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">文本</label>
                <textarea
                  value={data.text || ''}
                  onChange={(e) => updateNodeData(id, { text: e.target.value })}
                  className={textareaBaseClassName}
                  rows={3}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // 阻止节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = 'none';
                      (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // 恢复节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = '';
                    }
                  }}
                  onCompositionStart={(e) => {
                    setIsComposing(true);
                    e.stopPropagation();
                  }}
                  onCompositionEnd={(e) => {
                    setIsComposing(false);
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 如果正在使用输入法，不阻止事件传播
                    if (!isComposing && (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'TEXTAREA')) {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }}
                  onMouseMove={(e) => {
                    e.stopPropagation();
                  }}
                  onDragStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={inputBaseStyle}
                />
                {isHandleConnected('text') && (
                  <div className="mt-1 text-[10px] text-diffusion-text-secondary">
                    外部输入已连接，内部输入失效
                  </div>
                )}
              </div>
            )}

            {/* 其他节点中的图像输入（非 imageInput 节点） */}
            {data.image !== undefined && type !== 'imageInput' && type !== 'imageGen' && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">图像</label>
                <input
                  id={`${id}-image-upload`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isHandleConnected('image')}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      updateNodeData(id, { image: reader.result as string });
                    };
                    reader.readAsDataURL(file);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor={`${id}-image-upload`}
                  className={`${buttonBaseClassName} inline-flex ${isHandleConnected('image') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={(e) => e.stopPropagation()}
                  style={buttonBaseStyle}
                >
                  选择文件
                </label>
                {data.image && (
                  <div className="mt-2">
                    <img src={data.image} alt="input" className="w-full h-auto rounded border border-white/10" />
                  </div>
                )}
                {isHandleConnected('image') && (
                  <div className="mt-1 text-[10px] text-diffusion-text-secondary">
                    外部输入已连接，内部输入失效
                  </div>
                )}
              </div>
            )}

            {/* 视频上传区域（videoGen / videoPreview 不显示：videoGen 无上传，videoPreview 仅预览上游输入） */}
            {data.video !== undefined && type !== 'videoGen' && type !== 'videoPreview' && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">视频</label>
                <input
                  id={`${id}-video-upload`}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={isHandleConnected('video')}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = URL.createObjectURL(file);
                    updateNodeData(id, { video: url });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor={`${id}-video-upload`}
                  className={`${buttonBaseClassName} inline-flex ${isHandleConnected('video') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={(e) => e.stopPropagation()}
                  style={buttonBaseStyle}
                >
                  选择文件
                </label>
                {data.video && (
                  <div className="mt-2">
                    <video src={data.video} className="w-full h-auto rounded border border-white/10" controls />
                  </div>
                )}
                {isHandleConnected('video') && (
                  <div className="mt-1 text-[10px] text-diffusion-text-secondary">
                    外部输入已连接，内部输入失效
                  </div>
                )}
              </div>
            )}
            {/* 模型选择/编辑 */}
            {data.model !== undefined && (
              <div ref={maybeFirstPropertyRef()} onClick={(e) => e.stopPropagation()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">{t('nodeParams.model')}</label>
                <CustomSelect
                  value={data.model || ''}
                  onChange={(val) => updateNodeData(id, { model: val })}
                  options={[
                    { value: '', label: t('nodeParams.selectModel') },
                    ...getModelOptions({ nodeCategory: nodeType }).map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    })),
                  ]}
                  size="sm"
                  customStyle={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}55`,
                    textColor: 'rgba(229, 231, 235, 0.95)',
                  }}
                />
                {type === 'videoGen' && getVideoModelTip(data.model) && (
                  <div className="mt-1.5 flex gap-1.5 rounded px-2 py-1.5 text-[11px] leading-snug text-diffusion-text-secondary/90 bg-black/5 border border-black/5">
                    <Info size={12} className="shrink-0 mt-0.5 text-diffusion-text-secondary/70" aria-hidden />
                    <span>{getVideoModelTip(data.model)}</span>
                  </div>
                )}
                {type === '3dGen' && get3DModelTip(data.model) && (
                  <div className="mt-1.5 flex gap-1.5 rounded px-2 py-1.5 text-[11px] leading-snug text-diffusion-text-secondary/90 bg-black/5 border border-black/5">
                    <Info size={12} className="shrink-0 mt-0.5 text-diffusion-text-secondary/70" aria-hidden />
                    <span>{get3DModelTip(data.model)}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* 语言选择（脚本运行器） */}
            {data.language !== undefined && (
              <div ref={maybeFirstPropertyRef()} onClick={(e) => e.stopPropagation()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">{t('nodeParams.language')}</label>
                <CustomSelect
                  value={data.language || 'python'}
                  onChange={(val) => updateNodeData(id, { language: val })}
                  options={[
                    { value: 'python', label: t('nodeParams.lang_python') },
                    { value: 'javascript', label: t('nodeParams.lang_javascript') },
                    { value: 'typescript', label: t('nodeParams.lang_typescript') },
                    { value: 'bash', label: t('nodeParams.lang_bash') },
                  ]}
                  size="sm"
                  customStyle={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}55`,
                    textColor: 'rgba(229, 231, 235, 0.95)',
                  }}
                />
              </div>
            )}

            {/* 提示词编辑 */}
            {data.prompt !== undefined && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">{t('nodeParams.prompt')}</label>
                {editingField === 'prompt' ? (
                  <div className="flex flex-col gap-1">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={(e) => {
                        if (!isComposing) {
                          handleSaveField();
                        }
                        // 恢复节点拖动
                        const nodeElement = e.currentTarget.closest('.react-flow__node');
                        if (nodeElement) {
                          (nodeElement as HTMLElement).style.pointerEvents = '';
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape' && !isComposing) handleCancelEdit();
                      }}
                      className={textareaBaseClassName}
                      rows={3}
                      autoFocus
                      disabled={isHandleConnected('text')}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => {
                        e.stopPropagation();
                        // 阻止节点拖动
                        const nodeElement = e.currentTarget.closest('.react-flow__node');
                        if (nodeElement) {
                          (nodeElement as HTMLElement).style.pointerEvents = 'none';
                          (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                        }
                      }}
                      onCompositionStart={(e) => {
                        setIsComposing(true);
                        e.stopPropagation();
                      }}
                      onCompositionEnd={(e) => {
                        setIsComposing(false);
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        // 如果正在使用输入法，不阻止事件传播
                        if (!isComposing && (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'TEXTAREA')) {
                          e.nativeEvent.stopImmediatePropagation();
                        }
                      }}
                      onMouseMove={(e) => {
                        e.stopPropagation();
                      }}
                      onDragStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      style={inputBaseStyle}
                    />
                    <button
                      onClick={handleCancelEdit}
                      className={`${buttonBaseClassName} self-end`}
                      style={buttonBaseStyle}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      if (!isHandleConnected('text')) handleEditField('prompt', data.prompt || '');
                    }}
                    className={`${inputBaseClassName} cursor-text transition-colors min-h-[2rem]`}
                    onMouseDown={(e) => {
                      // 如果双击，允许文本选择
                      if (e.detail === 2) {
                        e.stopPropagation();
                      }
                    }}
                    style={inputBaseStyle}
                  >
                    {isHandleConnected('text') ? '外部输入已连接，内部输入失效' : data.prompt || '点击编辑提示词...'}
                  </div>
                )}
              </div>
            )}

            {/* 温度参数（文本生成节点） */}
            {data.temperature !== undefined && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">温度 (Temperature)</label>
                <input
                  type="number"
                  value={data.temperature ?? 0.7}
                  onChange={(e) => updateNodeData(id, { temperature: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="2"
                  step="0.1"
                  className={inputBaseClassName}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // 阻止节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = 'none';
                      (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // 恢复节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = '';
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 只阻止节点拖动，不阻止输入
                    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'INPUT') {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }}
                  style={inputBaseStyle}
                />
              </div>
            )}

            {/* 最大Token数（文本生成节点） */}
            {data.maxTokens !== undefined && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">最大Token数 (Max Tokens)</label>
                <input
                  type="number"
                  value={data.maxTokens ?? 1000}
                  onChange={(e) => updateNodeData(id, { maxTokens: parseInt(e.target.value) || 0 })}
                  min="1"
                  step="1"
                  className={inputBaseClassName}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // 阻止节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = 'none';
                      (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // 恢复节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = '';
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 只阻止节点拖动，不阻止输入
                    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'INPUT') {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }}
                  style={inputBaseStyle}
                />
              </div>
            )}

            {/* 画面比例（图像生成节点） */}
            {data.aspectRatio !== undefined && (
              <div ref={maybeFirstPropertyRef()} onClick={(e) => e.stopPropagation()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">{t('nodeParams.aspectRatio')}</label>
                <CustomSelect
                  value={data.aspectRatio || '1:1'}
                  onChange={(val) => updateNodeData(id, { aspectRatio: val })}
                  options={[
                    { value: '1:1', label: t('nodeParams.aspect_1_1') },
                    { value: '16:9', label: t('nodeParams.aspect_16_9') },
                    { value: '9:16', label: t('nodeParams.aspect_9_16') },
                    { value: '4:3', label: t('nodeParams.aspect_4_3') },
                    { value: '3:4', label: t('nodeParams.aspect_3_4') },
                    { value: '2:3', label: t('nodeParams.aspect_2_3') },
                    { value: '3:2', label: t('nodeParams.aspect_3_2') },
                    { value: '4:5', label: t('nodeParams.aspect_4_5') },
                    { value: '5:4', label: t('nodeParams.aspect_5_4') },
                    { value: '21:9', label: t('nodeParams.aspect_21_9') },
                  ]}
                  size="sm"
                  customStyle={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}55`,
                    textColor: 'rgba(229, 231, 235, 0.95)',
                  }}
                />
              </div>
            )}

            {/* 画质（图像生成节点） */}
            {data.quality !== undefined && qualityOptions.length > 0 && (
              <div ref={maybeFirstPropertyRef()} onClick={(e) => e.stopPropagation()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">{t('nodeParams.quality')}</label>
                <CustomSelect
                  value={data.quality || qualityOptions[0]?.value || '2K'}
                  onChange={(val) => updateNodeData(id, { quality: val })}
                  options={qualityOptions}
                  size="sm"
                  customStyle={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}55`,
                    textColor: 'rgba(229, 231, 235, 0.95)',
                  }}
                />
              </div>
            )}

            {/* 时长（视频生成节点） */}
            {data.duration !== undefined && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">时长 (Duration, 秒)</label>
                <input
                  type="number"
                  value={data.duration ?? 5}
                  onChange={(e) => updateNodeData(id, { duration: parseInt(e.target.value) || 0 })}
                  min="1"
                  step="1"
                  className={inputBaseClassName}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // 阻止节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = 'none';
                      (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // 恢复节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = '';
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 只阻止节点拖动，不阻止输入
                    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'INPUT') {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }}
                  style={inputBaseStyle}
                />
              </div>
            )}

            {/* 宽高比 / 分辨率 / 有声 / 水印（视频生成节点 - Seedance） */}
            {type === 'videoGen' && (
              <>
                <div ref={maybeFirstPropertyRef()} onClick={(e) => e.stopPropagation()}>
                  <label className="text-xs text-diffusion-text-secondary mb-1 block">宽高比 (Ratio)</label>
                  <CustomSelect
                    value={data.ratio || 'adaptive'}
                    onChange={(val) => updateNodeData(id, { ratio: val })}
                    options={[
                      { value: 'adaptive', label: '自适应' },
                      { value: '16:9', label: '16:9' },
                      { value: '4:3', label: '4:3' },
                      { value: '1:1', label: '1:1' },
                      { value: '3:4', label: '3:4' },
                      { value: '9:16', label: '9:16' },
                      { value: '21:9', label: '21:9' },
                    ]}
                    size="sm"
                    customStyle={{
                      background: `${nodeColor}12`,
                      borderColor: `${nodeColor}55`,
                      textColor: 'rgba(229, 231, 235, 0.95)',
                    }}
                  />
                </div>
                <div ref={maybeFirstPropertyRef()} onClick={(e) => e.stopPropagation()}>
                  <label className="text-xs text-diffusion-text-secondary mb-1 block">分辨率 (Resolution)</label>
                  <CustomSelect
                    value={data.resolution || ''}
                    onChange={(val) => updateNodeData(id, { resolution: val || undefined })}
                    options={[
                      { value: '', label: '默认' },
                      { value: '480p', label: '480p' },
                      { value: '720p', label: '720p' },
                      { value: '1080p', label: '1080p' },
                    ]}
                    size="sm"
                    customStyle={{
                      background: `${nodeColor}12`,
                      borderColor: `${nodeColor}55`,
                      textColor: 'rgba(229, 231, 235, 0.95)',
                    }}
                  />
                </div>
                <label
                  className="nodrag flex cursor-pointer items-center gap-2.5 py-1 rounded transition-colors hover:bg-black/5"
                  onClick={(e) => e.stopPropagation()}
                  htmlFor={`${id}-generate-audio`}
                  style={{ borderRadius: 6 }}
                >
                  <input
                    type="checkbox"
                    id={`${id}-generate-audio`}
                    checked={Boolean(data.generateAudio)}
                    onChange={(e) => updateNodeData(id, { generateAudio: e.target.checked })}
                    className="sr-only"
                  />
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors"
                    style={{
                      borderColor: `${nodeColor}66`,
                      backgroundColor: data.generateAudio ? nodeColor : 'transparent',
                      boxShadow: data.generateAudio ? `inset 0 0 0 1px ${nodeColor}40` : undefined,
                    }}
                  >
                    {data.generateAudio && <Check size={12} strokeWidth={2.5} className="text-white" />}
                  </span>
                  <span className="text-xs text-diffusion-text-secondary select-none">有声视频 (仅 1.5 Pro)</span>
                </label>
                <label
                  className="nodrag flex cursor-pointer items-center gap-2.5 py-1 rounded transition-colors hover:bg-black/5"
                  onClick={(e) => e.stopPropagation()}
                  htmlFor={`${id}-watermark`}
                  style={{ borderRadius: 6 }}
                >
                  <input
                    type="checkbox"
                    id={`${id}-watermark`}
                    checked={Boolean(data.watermark)}
                    onChange={(e) => updateNodeData(id, { watermark: e.target.checked })}
                    className="sr-only"
                  />
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors"
                    style={{
                      borderColor: `${nodeColor}66`,
                      backgroundColor: data.watermark ? nodeColor : 'transparent',
                      boxShadow: data.watermark ? `inset 0 0 0 1px ${nodeColor}40` : undefined,
                    }}
                  >
                    {data.watermark && <Check size={12} strokeWidth={2.5} className="text-white" />}
                  </span>
                  <span className="text-xs text-diffusion-text-secondary select-none">包含水印</span>
                </label>
              </>
            )}

            {/* 帧率（视频生成节点） */}
            {data.fps !== undefined && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">帧率 (FPS)</label>
                <input
                  type="number"
                  value={data.fps ?? 24}
                  onChange={(e) => updateNodeData(id, { fps: parseInt(e.target.value) || 0 })}
                  min="1"
                  step="1"
                  className={inputBaseClassName}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // 阻止节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = 'none';
                      (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // 恢复节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = '';
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 只阻止节点拖动，不阻止输入
                    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'INPUT') {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }}
                  style={inputBaseStyle}
                />
              </div>
            )}

            {/* 格式（3D生成节点）：API 支持 glb / obj / usd / usdz */}
            {data.format !== undefined && (
              <div ref={maybeFirstPropertyRef()} onClick={(e) => e.stopPropagation()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">{t('nodeParams.format')}</label>
                <CustomSelect
                  value={data.format || 'glb'}
                  onChange={(val) => updateNodeData(id, { format: val })}
                  options={
                    type === '3dGen'
                      ? [
                          { value: 'glb', label: t('nodeParams.format_glb') },
                          { value: 'obj', label: t('nodeParams.format_obj') },
                          { value: 'usd', label: t('nodeParams.format_usd') },
                          { value: 'usdz', label: t('nodeParams.format_usdz') },
                        ]
                      : [
                          { value: 'glb', label: t('nodeParams.format_glb') },
                          { value: 'gltf', label: t('nodeParams.format_gltf') },
                          { value: 'obj', label: t('nodeParams.format_obj') },
                          { value: 'fbx', label: t('nodeParams.format_fbx') },
                        ]
                  }
                  size="sm"
                  customStyle={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}55`,
                    textColor: 'rgba(229, 231, 235, 0.95)',
                  }}
                />
              </div>
            )}

            {/* 细分级别（3D生成节点）：多边形面数 high 20万 / medium 10万 / low 3万 */}
            {type === '3dGen' && data.subdivisionLevel !== undefined && (
              <div ref={maybeFirstPropertyRef()} onClick={(e) => e.stopPropagation()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">{t('nodeParams.subdivisionLevel')}</label>
                <CustomSelect
                  value={data.subdivisionLevel || 'medium'}
                  onChange={(val) => updateNodeData(id, { subdivisionLevel: val })}
                  options={[
                    { value: 'low', label: t('nodeParams.subdiv_low') },
                    { value: 'medium', label: t('nodeParams.subdiv_medium') },
                    { value: 'high', label: t('nodeParams.subdiv_high') },
                  ]}
                  size="sm"
                  customStyle={{
                    background: `${nodeColor}12`,
                    borderColor: `${nodeColor}55`,
                    textColor: 'rgba(229, 231, 235, 0.95)',
                  }}
                />
              </div>
            )}

            {/* 代码编辑（脚本运行器） */}
            {data.code !== undefined && (
              <div ref={maybeFirstPropertyRef()}>
                <label className="text-xs text-diffusion-text-secondary mb-1 block">代码</label>
                <textarea
                  value={data.code || ''}
                  onChange={(e) => updateNodeData(id, { code: e.target.value })}
                  className={textareaBaseClassName}
                  rows={6}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // 阻止节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = 'none';
                      (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // 恢复节点拖动
                    const nodeElement = e.currentTarget.closest('.react-flow__node');
                    if (nodeElement) {
                      (nodeElement as HTMLElement).style.pointerEvents = '';
                    }
                  }}
                  onCompositionStart={(e) => {
                    setIsComposing(true);
                    e.stopPropagation();
                  }}
                  onCompositionEnd={(e) => {
                    setIsComposing(false);
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // 如果正在使用输入法，不阻止事件传播
                    if (!isComposing && (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'TEXTAREA')) {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                  }}
                  onMouseMove={(e) => {
                    e.stopPropagation();
                  }}
                  onDragStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={inputBaseStyle}
                />
              </div>
            )}

            </div>
          </div>
          </div>
        </motion.div>

        {/* 输入连接点 */}
        {inputs.map((input, index) => (
          <Handle
            key={input.id}
            type="target"
            position={Position.Left}
            id={input.id}
            className="!border-2 !border-white/30 !w-4 !h-4 !rounded-full !shadow-lg !transition-transform"
            style={{
              backgroundColor: getHandleColor(input.type, nodeType),
              top: inputHandleBaseTop !== null
                ? `${inputHandleBaseTop + getHandleOffset(index, inputs.length) - HANDLE_SIZE / 2}px`
                : `calc(50% + ${getHandleOffset(index, inputs.length)}px - ${HANDLE_SIZE / 2}px)`,
              left: `-${HANDLE_SIZE / 2}px`,
              ...({ '--handle-glow': getHandleColor(input.type, nodeType) } as React.CSSProperties),
            }}
          />
        ))}

        {/* 输出连接点 */}
        {outputs.map((output, index) => (
          <Handle
            key={output.id}
            type="source"
            position={Position.Right}
            id={output.id}
            className="!border-2 !border-white/30 !w-4 !h-4 !rounded-full !shadow-lg !transition-transform"
            style={{
              backgroundColor: getHandleColor(output.type, nodeType),
              top: outputHandleBaseTop !== null
                ? `${outputHandleBaseTop + getHandleOffset(index, outputs.length) - HANDLE_SIZE / 2}px`
                : `calc(50% + ${getHandleOffset(index, outputs.length)}px - ${HANDLE_SIZE / 2}px)`,
              right: `-${HANDLE_SIZE / 2}px`,
              ...({ '--handle-glow': getHandleColor(output.type, nodeType) } as React.CSSProperties),
            }}
          />
        ))}
      </div>
    </div>
  );
};

// 使用 memo 优化，减少不必要的重新渲染
// 比较函数：只在关键属性变化时重新渲染
// 重要：拖动时的位置变化不会触发重新渲染，这由 React Flow 内部通过 CSS transform 处理
export default memo(BaseNode, (prevProps, nextProps) => {
  // 如果节点 ID 或类型变化，必须重新渲染
  if (prevProps.id !== nextProps.id || prevProps.type !== nextProps.type) {
    return false;
  }
  
  // 如果选中状态变化，必须重新渲染
  if (prevProps.selected !== nextProps.selected) {
    return false;
  }
  
  // 如果输入输出数量变化，必须重新渲染
  if (
    prevProps.inputs?.length !== nextProps.inputs?.length ||
    prevProps.outputs?.length !== nextProps.outputs?.length
  ) {
    return false;
  }
  
  // 比较数据对象
  const prevData = prevProps.data;
  const nextData = nextProps.data;
  
  // 如果数据对象引用相同，可能没有变化
  if (prevData === nextData) {
    // 引用相同，可能是没有变化，或者只是位置变化
    // 对于拖动操作，React Flow 会创建新的节点对象，所以引用相同通常意味着没有变化
    return true;
  }
  
  // 数据对象引用不同，进行浅比较
  // 排除位置相关字段（这些由 React Flow 通过 CSS transform 处理）
  const positionFields = new Set(['position', 'x', 'y', 'zIndex', 'width', 'height']);
  
  // 获取所有数据字段的键
  const prevKeys = Object.keys(prevData || {});
  const nextKeys = Object.keys(nextData || {});
  
  // 过滤掉位置字段
  const prevDataKeys = prevKeys.filter(k => !positionFields.has(k));
  const nextDataKeys = nextKeys.filter(k => !positionFields.has(k));
  
  // 如果键的数量不同，说明有内容变化
  if (prevDataKeys.length !== nextDataKeys.length) {
    return false;
  }
  
  // 比较所有非位置字段的值（浅比较）
  for (const key of nextDataKeys) {
    const prevValue = prevData?.[key];
    const nextValue = nextData?.[key];
    
    // 如果值不同，需要重新渲染
    if (prevValue !== nextValue) {
      // 对于基本类型（null, undefined, string, number, boolean, symbol），直接比较
      // 对于对象和数组，只比较引用（浅比较）
      // 如果引用不同，假设有变化，需要重新渲染
      return false;
    }
  }
  
  // 所有非位置字段都相同（引用相同），可以跳过重新渲染
  // React Flow 会通过 CSS transform 直接更新位置，不需要重新渲染组件
  return true;
});
