/**
 * 数据兼容性工具函数
 * 确保不同类型的数据可以在节点之间正确传递
 */

export type DataType = 'text' | 'image' | 'video' | '3d' | 'any';

/**
 * 统一的数据格式
 */
export interface UnifiedData {
  type: DataType;
  value: string | string[] | null;
  metadata?: Record<string, any>;
}

/**
 * 将任意数据转换为统一的文本格式
 */
export function normalizeToText(data: any): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number') return String(data);
  if (typeof data === 'boolean') return String(data);
  if (Array.isArray(data)) {
    // 如果是字符串数组，连接它们
    if (data.every(item => typeof item === 'string')) {
      return data.join('\n');
    }
    // 否则转换为 JSON 字符串
    return JSON.stringify(data);
  }
  if (typeof data === 'object') {
    // 尝试提取常见的文本字段
    if ('text' in data) return normalizeToText(data.text);
    if ('content' in data) return normalizeToText(data.content);
    if ('message' in data) return normalizeToText(data.message);
    if ('output' in data) return normalizeToText(data.output);
    // 否则转换为 JSON 字符串
    return JSON.stringify(data);
  }
  return String(data);
}

/**
 * 将任意数据转换为统一的图像格式（字符串或字符串数组）
 */
export function normalizeToImage(data: any): string | string[] | null {
  if (data === null || data === undefined) return null;
  
  // 如果是字符串，直接返回
  if (typeof data === 'string') {
    // 检查是否是有效的图像 URL 或 data URL
    if (data.startsWith('data:image/') || 
        data.startsWith('http://') || 
        data.startsWith('https://') ||
        data.startsWith('file://')) {
      return data;
    }
    return null;
  }
  
  // 如果是数组
  if (Array.isArray(data)) {
    const images: string[] = [];
    for (const item of data) {
      const normalized = normalizeToImage(item);
      if (normalized) {
        if (Array.isArray(normalized)) {
          images.push(...normalized);
        } else {
          images.push(normalized);
        }
      }
    }
    return images.length > 0 ? images : null;
  }
  
  // 如果是对象，尝试提取图像字段
  if (typeof data === 'object') {
    // 尝试常见的图像字段名
    const imageFields = ['image', 'url', 'src', 'output', 'data', 'result'];
    for (const field of imageFields) {
      if (field in data) {
        const normalized = normalizeToImage(data[field]);
        if (normalized) return normalized;
      }
    }
    
    // 如果对象有 data 字段且是 base64
    if ('data' in data && typeof data.data === 'string') {
      const mimeType = data.mimeType || data.mime_type || 'image/png';
      return `data:${mimeType};base64,${data.data}`;
    }
  }
  
  return null;
}

/**
 * 将任意数据转换为统一的视频格式
 */
export function normalizeToVideo(data: any): string | null {
  if (data === null || data === undefined) return null;
  
  if (typeof data === 'string') {
    if (data.startsWith('data:video/') || 
        data.startsWith('http://') || 
        data.startsWith('https://') ||
        data.startsWith('file://')) {
      return data;
    }
    return null;
  }
  
  if (Array.isArray(data) && data.length > 0) {
    return normalizeToVideo(data[0]);
  }
  
  if (typeof data === 'object') {
    const videoFields = ['video', 'url', 'src', 'output', 'data', 'result'];
    for (const field of videoFields) {
      if (field in data) {
        const normalized = normalizeToVideo(data[field]);
        if (normalized) return normalized;
      }
    }
  }
  
  return null;
}

/**
 * 将任意数据转换为统一的 3D 格式
 */
export function normalizeTo3D(data: any): string | null {
  if (data === null || data === undefined) return null;
  
  if (typeof data === 'string') {
    if (data.startsWith('data:model/') || 
        data.startsWith('data:application/octet-stream') ||
        data.startsWith('http://') || 
        data.startsWith('https://') ||
        data.startsWith('file://')) {
      return data;
    }
    return null;
  }
  
  if (Array.isArray(data) && data.length > 0) {
    return normalizeTo3D(data[0]);
  }
  
  if (typeof data === 'object') {
    const modelFields = ['model', 'url', 'src', 'output', 'data', 'result', '3d'];
    for (const field of modelFields) {
      if (field in data) {
        const normalized = normalizeTo3D(data[field]);
        if (normalized) return normalized;
      }
    }
  }
  
  return null;
}

/**
 * 根据类型规范化数据
 */
export function normalizeData(data: any, type: DataType): any {
  switch (type) {
    case 'text':
      return normalizeToText(data);
    case 'image':
      return normalizeToImage(data);
    case 'video':
      return normalizeToVideo(data);
    case '3d':
      return normalizeTo3D(data);
    case 'any':
      return data;
    default:
      return data;
  }
}

/**
 * 从节点数据中提取指定类型的值
 */
export function extractDataFromNode(nodeData: Record<string, any>, type: DataType): any {
  // 直接检查 output 字段
  if (nodeData.output !== undefined) {
    const normalized = normalizeData(nodeData.output, type);
    if (normalized !== null && normalized !== '') {
      return normalized;
    }
  }
  
  // 根据类型检查特定字段
  switch (type) {
    case 'text':
      return normalizeToText(
        nodeData.text || 
        nodeData.content || 
        nodeData.message || 
        nodeData.prompt ||
        nodeData.output
      );
    case 'image':
      return normalizeToImage(
        nodeData.image || 
        nodeData.url || 
        nodeData.src || 
        nodeData.output
      );
    case 'video':
      return normalizeToVideo(
        nodeData.video || 
        nodeData.url || 
        nodeData.src || 
        nodeData.output
      );
    case '3d':
      return normalizeTo3D(
        nodeData.model || 
        nodeData['3d'] || 
        nodeData.url || 
        nodeData.src || 
        nodeData.output
      );
    default:
      return nodeData.output || nodeData;
  }
}
