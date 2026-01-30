/**
 * 统一的颜色工具函数
 * 用于确保节点抓手和连线颜色的一致性
 */

/**
 * 根据节点类型获取抓手颜色（十六进制格式）
 * @param type - 数据类型（'text' | 'image' | 'video' | '3d' | 'any' | 'string'）
 * @param nodeType - 节点类型（'text' | 'image' | 'video' | '3d' | 'other'）
 * @returns 十六进制颜色值（如 '#3b82f6'）
 */
export const getHandleColor = (type?: string, nodeType?: string): string => {
  const normalized = type === 'string' ? 'text' : type;
  
  if (normalized === 'text') {
    return '#3b82f6'; // 蓝色
  }
  if (normalized === 'image') {
    return '#8b5cf6'; // 紫色
  }
  if (normalized === 'video') {
    return '#ec4899'; // 粉色
  }
  if (normalized === '3d') {
    return '#06b6d4'; // 青色
  }
  if (normalized === 'any') {
    return '#6b7280'; // 灰色
  }
  
  // 如果 type 未定义，尝试使用 nodeType
  if (nodeType === 'text') {
    return '#3b82f6';
  }
  if (nodeType === 'image') {
    return '#8b5cf6';
  }
  if (nodeType === 'video') {
    return '#ec4899';
  }
  if (nodeType === '3d') {
    return '#06b6d4';
  }
  
  return '#6b7280'; // 默认灰色
};

/**
 * 将十六进制颜色转换为 rgba 格式
 * @param hex - 十六进制颜色值（如 '#3b82f6'）
 * @param alpha - 透明度（0-1），默认 0.5
 * @returns rgba 颜色字符串（如 'rgba(59, 130, 246, 0.5)'）
 */
export const hexToRgba = (hex: string, alpha: number = 0.5): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * 获取连线颜色（带透明度）
 * @param type - 数据类型
 * @param nodeType - 节点类型
 * @param alpha - 透明度（0-1），默认 0.6，使连线更明显
 * @returns rgba 颜色字符串
 */
export const getEdgeColor = (type?: string, nodeType?: string, alpha: number = 0.6): string => {
  const hexColor = getHandleColor(type, nodeType);
  return hexToRgba(hexColor, alpha);
};
