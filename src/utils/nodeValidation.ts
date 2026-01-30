import type { Edge, Node } from 'reactflow';

export interface MissingRequiredItem {
  key: string;
  label: string;
}

export interface NodeValidationResult {
  missing: MissingRequiredItem[];
}

const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const hasAnyValue = (value: unknown): boolean => value !== null && value !== undefined;

const isHandleConnected = (nodeId: string, handleId: string, edges: Edge[]): boolean =>
  edges.some((e) => e.target === nodeId && e.targetHandle === handleId);

const getConnectedInputHandleIds = (nodeId: string, edges: Edge[]): Set<string> =>
  new Set(
    edges
      .filter((e) => e.target === nodeId && typeof e.targetHandle === 'string')
      .map((e) => e.targetHandle as string)
  );

/**
 * Validate that the node has all required user-provided values.
 * This is intentionally "static": it checks either
 * - input comes from a connected edge, OR
 * - node.data provides a non-empty value.
 */
export function validateNodeRequired(node: Node, nodes: Node[], edges: Edge[]): NodeValidationResult {
  const missing: MissingRequiredItem[] = [];
  const connectedInputs = getConnectedInputHandleIds(node.id, edges);
  const data = (node.data || {}) as Record<string, any>;

  const requireEitherConnectedOrNonEmpty = (handleId: string, dataKeys: string[], label: string) => {
    const connected = connectedInputs.has(handleId) || isHandleConnected(node.id, handleId, edges);
    if (connected) return;
    const hasLocal = dataKeys.some((k) => hasNonEmptyString(data[k]));
    if (!hasLocal) {
      missing.push({ key: dataKeys[0] || handleId, label });
    }
  };

  const requireNonEmpty = (dataKey: string, label: string) => {
    if (!hasNonEmptyString(data[dataKey])) {
      missing.push({ key: dataKey, label });
    }
  };

  const requireAny = (dataKey: string, label: string) => {
    if (!hasAnyValue(data[dataKey])) {
      missing.push({ key: dataKey, label });
    }
  };

  switch (node.type) {
    case 'textGen':
      requireEitherConnectedOrNonEmpty('text', ['prompt'], '提示词（Prompt）');
      break;
    case 'imageGen':
      requireEitherConnectedOrNonEmpty('text', ['prompt'], '提示词（Prompt）');
      break;
    case 'videoGen':
      requireEitherConnectedOrNonEmpty('text', ['prompt'], '提示词（Prompt）');
      break;
    case '3dGen':
      requireEitherConnectedOrNonEmpty('text', ['prompt'], '提示词（Prompt）');
      break;
    case 'textInput':
      // 对于 textInput 节点，检查 text 或 output 字段（用户可能在预览区域输入，保存到 output）
      if (!hasNonEmptyString(data.text) && !hasNonEmptyString(data.output)) {
        missing.push({ key: 'text', label: '文本' });
      }
      break;
    case 'imageInput':
      requireAny('image', '图像');
      break;
    case 'videoInput':
      requireAny('video', '视频');
      break;
    case '3dInput': {
      const has3dUrl = hasNonEmptyString(data.url) || hasNonEmptyString(data.model) || hasNonEmptyString(data.output);
      if (!has3dUrl) {
        missing.push({ key: 'url', label: 'Seedream 3D 下载链接' });
      }
      break;
    }
    case 'textPreview':
      requireEitherConnectedOrNonEmpty('text', ['text', 'output'], '上游文本输入');
      break;
    case 'imagePreview':
      requireEitherConnectedOrNonEmpty('image', ['image', 'output', 'url', 'src'], '上游图像输入');
      break;
    case 'videoPreview':
      requireEitherConnectedOrNonEmpty('video', ['video', 'output', 'url', 'src'], '上游视频输入');
      break;
    case '3dPreview':
      requireEitherConnectedOrNonEmpty('model', ['model', '3d', 'output', 'url', 'src'], '上游3D输入');
      break;
    case 'scriptRunner':
      // 当前脚本执行未实现，但仍提示用户填写代码/语言，避免“看起来能跑但跑不起来”
      requireNonEmpty('code', '代码');
      if (!hasNonEmptyString(data.language)) {
        missing.push({ key: 'language', label: '语言' });
      }
      break;
    default:
      // Unknown node types: no required validation.
      break;
  }

  // Avoid unused param warning (nodes reserved for future graph-level validation).
  void nodes;
  return { missing };
}

export function formatMissingRequired(missing: MissingRequiredItem[]): string {
  return missing.map((m) => m.label).join('、');
}

