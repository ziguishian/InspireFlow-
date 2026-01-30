import React, { useEffect, useMemo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import { X } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { getHandleType } from '@/nodes/handleSchema';
import { getEdgeColor } from '@/utils/colorUtils';

type EdgePropsWithHandles = EdgeProps & { sourceHandle?: string; targetHandle?: string };

const DeletableEdge: React.FC<EdgePropsWithHandles> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  source,
  target,
  sourceHandle,
  data,
}) => {
  const { getEdges, setEdges, getNodes } = useWorkflowStore();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  // 从 data 或节点状态获取加载状态
  const nodes = getNodes();
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);
  const isSourceRunning = sourceNode?.data?.status === 'running';
  const isTargetRunning = targetNode?.data?.status === 'running';
  const isLoading = data?.isLoading || isSourceRunning || isTargetRunning;

  // 根据源节点的输出类型获取连线颜色（使用统一的颜色工具函数）
  // 确保连线颜色与源节点输出抓手的颜色完全一致
  const edgeColor = useMemo(() => {
    // 节点类型映射
    const nodeTypeMap: Record<string, 'text' | 'image' | 'video' | '3d' | 'other'> = {
      'textGen': 'text',
      'imageGen': 'image',
      'videoGen': 'video',
      '3dGen': '3d',
      'textInput': 'text',
      'imageInput': 'image',
      'videoInput': 'video',
      '3dInput': '3d',
      'textPreview': 'text',
      'imagePreview': 'image',
      'videoPreview': 'video',
      '3dPreview': '3d',
      'scriptRunner': 'other',
    };
    
    // 如果 sourceNode 不存在，尝试从 edge id 或使用默认颜色
    if (!sourceNode) {
      console.warn('DeletableEdge: sourceNode not found', { 
        id, 
        source, 
        nodesCount: nodes.length,
        allNodeIds: nodes.map(n => n.id),
      });
      // 尝试从 edge id 推断节点类型（edge id 格式：edge-{source}-{sourceHandle}-{target}-{targetHandle}）
      // 或者使用灰色作为后备
      return 'rgba(107, 114, 128, 0.6)';
    }
    
    // 获取源节点输出抓手的类型（与 BaseNode 中抓手的逻辑完全一致）
    // getHandleType 从 NODE_HANDLE_SCHEMAS 中查找，返回 'text' | 'image' | 'video' | '3d' | 'any'
    const handleType = sourceHandle ? getHandleType(sourceNode.type, sourceHandle, 'output') : null;
    
    // 从节点类型推断 nodeType（与 BaseNode 中传递的 nodeType 一致）
    const nodeType = nodeTypeMap[sourceNode.type || ''] || 'other';
    
    // 如果成功获取到类型，使用与 BaseNode 完全相同的逻辑
    let finalColor: string;
    if (handleType) {
      // 使用与 BaseNode 中输出抓手完全相同的逻辑
      // BaseNode: backgroundColor: getHandleColor(output.type, nodeType)
      // 这里: getEdgeColor(handleType, nodeType, 0.6) - handleType 对应 output.type
      finalColor = getEdgeColor(handleType, nodeType, 0.6);
    } else {
      // 如果无法从 handleSchema 获取类型，使用节点类型作为后备
      const fallbackType = nodeTypeMap[sourceNode.type || ''];
      if (fallbackType && fallbackType !== 'other') {
        finalColor = getEdgeColor(fallbackType, nodeType, 0.6);
      } else {
        // 最后的默认值（灰色，对应 'any' 类型）
        finalColor = 'rgba(107, 114, 128, 0.6)'; // #6b7280 的 rgba 格式，透明度 0.6
      }
    }

    return finalColor;
  }, [sourceNode, sourceHandle, id, nodes]);

  // 应用连线颜色（确保颜色始终可见）
  // 持续监控并应用颜色，确保颜色始终正确
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let rafId: number;
    
    const applyColor = () => {
      // 查找所有路径元素，通过路径数据匹配
      const allPaths = document.querySelectorAll('path.react-flow__edge-path');
      
      for (const pathEl of allPaths) {
        const svgPath = pathEl as SVGPathElement;
        const pathD = svgPath.getAttribute('d');
        
        // 通过路径数据精确匹配
        if (pathD && pathD === edgePath) {
          const parentEdge = svgPath.closest('.react-flow__edge');
          const isHovered = parentEdge?.matches(':hover');
          const isSelected = parentEdge?.classList.contains('selected');

          const HOVER_RED = 'rgba(239, 68, 68, 1)';
          const HOVER_GLOW = 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))';

          if (isHovered || isSelected) {
            // hover/选中：红色线条 + 红色光晕（内联样式保证覆盖）
            svgPath.setAttribute('stroke', HOVER_RED);
            svgPath.setAttribute('stroke-width', isSelected ? '4' : '5');
            svgPath.style.setProperty('stroke', HOVER_RED, 'important');
            svgPath.style.setProperty('stroke-width', isSelected ? '4' : '5', 'important');
            svgPath.style.stroke = HOVER_RED;
            svgPath.style.strokeWidth = String(isSelected ? 4 : 5);
            svgPath.style.filter = HOVER_GLOW;
          } else {
            // 默认：类型颜色、实线，不整段清除 style 避免闪动
            svgPath.setAttribute('stroke', edgeColor);
            svgPath.setAttribute('stroke-width', '3');
            svgPath.style.setProperty('stroke', edgeColor, 'important');
            svgPath.style.setProperty('stroke-width', '3', 'important');
            svgPath.style.stroke = edgeColor;
            svgPath.style.strokeWidth = '3';
            svgPath.style.filter = '';
            svgPath.style.strokeDasharray = '';
          }

          break; // 找到并处理了，退出循环
        }
      }
    };
    
    // 使用 requestAnimationFrame 确保 DOM 已渲染
    rafId = requestAnimationFrame(() => {
      applyColor();
      // 降低频率减少闪动，仅用于同步 hover/颜色
      intervalId = setInterval(applyColor, 350);
    });
    
    return () => {
      cancelAnimationFrame(rafId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [edgeColor, id, edgePath]);

  // 通过 DOM 查询来应用动画样式（因为内联样式不支持 CSS 动画）
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout | null = null;
    
    const applyAnimation = () => {
      // 查找所有边路径，通过检查路径数据来匹配当前边
      const allPaths = document.querySelectorAll('.react-flow__edge-path');
      allPaths.forEach((pathEl) => {
        const svgPath = pathEl as SVGPathElement;
        // 通过路径数据匹配（edgePath 是完整的路径字符串）
        const pathD = svgPath.getAttribute('d');
        if (pathD && pathD === edgePath) {
          if (isLoading) {
            svgPath.setAttribute('stroke', edgeColor);
            svgPath.setAttribute('stroke-width', '3');
            svgPath.style.setProperty('stroke', edgeColor, 'important');
            svgPath.style.setProperty('stroke-width', '3', 'important');
            svgPath.style.strokeDasharray = '16, 8';
            svgPath.style.willChange = 'stroke-dashoffset';
            const colorMatch = edgeColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (colorMatch) {
              const [, r, g, b] = colorMatch;
              svgPath.style.filter = `drop-shadow(0 0 5px rgba(${r}, ${g}, ${b}, 0.35))`;
            }
            svgPath.style.animation = 'edge-flow-magic 5s linear infinite';
            svgPath.classList.add('edge-loading-active');
          } else {
            // 非加载：恢复默认或保留 hover/选中（由颜色 effect 负责 stroke/filter）
            const edgeElement = svgPath.closest('.react-flow__edge');
            const isHovered = edgeElement?.matches(':hover');
            const isSelected = edgeElement?.classList.contains('selected');

            svgPath.style.strokeDasharray = '';
            svgPath.style.animation = '';
            svgPath.classList.remove('edge-loading-active');

            if (!isHovered && !isSelected) {
              svgPath.setAttribute('stroke', edgeColor);
              svgPath.setAttribute('stroke-width', '3');
              svgPath.style.setProperty('stroke', edgeColor, 'important');
              svgPath.style.setProperty('stroke-width', '3', 'important');
              svgPath.style.stroke = edgeColor;
              svgPath.style.strokeWidth = '3';
              svgPath.style.filter = '';
            }
            // hover/selected 的红色与光晕由上面的颜色 effect 统一设置
          }
        }
      });
    };

    // 延迟执行以确保 DOM 已渲染
    timer = setTimeout(() => {
      applyAnimation();
      // 只在加载状态时定期检查并应用
      if (isLoading) {
        intervalId = setInterval(applyAnimation, 500); // 降低频率到 500ms
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (intervalId) clearInterval(intervalId);
      // 清理动画样式，但保持颜色
      const allPaths = document.querySelectorAll('.react-flow__edge-path');
      allPaths.forEach((pathEl) => {
        const svgPath = pathEl as SVGPathElement;
        const pathD = svgPath.getAttribute('d');
        if (pathD && pathD === edgePath) {
          const edgeElement = svgPath.closest('.react-flow__edge');
          const isHovered = edgeElement?.matches(':hover');
          const isSelected = edgeElement?.classList.contains('selected');
          
            if (!isHovered && !isSelected) {
              svgPath.setAttribute('stroke', edgeColor);
              svgPath.setAttribute('stroke-width', '3');
              svgPath.style.setProperty('stroke', edgeColor, 'important');
              svgPath.style.setProperty('stroke-width', '3', 'important');
              svgPath.style.stroke = edgeColor;
              svgPath.style.strokeWidth = '3';
              svgPath.style.filter = '';
            }
          svgPath.style.strokeDasharray = '';
          svgPath.style.animation = '';
          svgPath.classList.remove('edge-loading-active');
        }
      });
    };
  }, [isLoading, edgePath, edgeColor]);

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    const edges = getEdges();
    setEdges(edges.filter((edge) => edge.id !== id));
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor,
          strokeWidth: 3,
        }}
      />
      {isLoading && (
        <g className="edge-particles" aria-hidden>
          <circle r="3" fill="rgba(255,255,255,0.95)">
            <animateMotion dur="2.2s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="2.5" fill="rgba(139, 92, 246, 0.9)">
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} begin="0.7s" />
          </circle>
          <circle r="2" fill="rgba(6, 182, 212, 0.85)">
            <animateMotion dur="1.8s" repeatCount="indefinite" path={edgePath} begin="1.4s" />
          </circle>
        </g>
      )}
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <button
              onClick={handleDelete}
              className="flex items-center justify-center w-5 h-5 rounded-full border border-red-400/80 bg-red-500/90 text-white shadow-[0_0_10px_rgba(239,68,68,0.7)] hover:bg-red-500 transition-colors"
              title="删除连线"
            >
              <X size={12} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default DeletableEdge;
