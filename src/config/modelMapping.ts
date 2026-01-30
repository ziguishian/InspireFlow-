/**
 * 模型名称映射配置
 * 将用户友好的模型名称映射到实际 API 使用的模型名称
 * 
 * 使用方法：
 * - 在节点属性中选择模型类型（如 'openai', 'claude', 'gemini' 等）
 * - 系统会根据此配置将模型类型映射到实际的 API 模型名称
 * - 如果用户在节点属性中直接输入了完整的模型名称，则直接使用用户输入的名称
 */

export interface ModelMappingConfig {
  // 文本生成模型映射
  text: {
    [key: string]: string;
  };
  // 图像生成模型映射
  image: {
    [key: string]: string;
  };
  // 视频生成模型映射
  video: {
    [key: string]: string;
  };
  // 3D 生成模型映射
  '3d': {
    [key: string]: string;
  };
}

/**
 * 默认模型映射配置
 * 可以根据需要修改此配置来调整模型映射
 */
export const defaultModelMapping: ModelMappingConfig = {
  text: {
    // OpenAI 模型
    'openai': 'gpt-4',
    'gpt-4': 'gpt-4',
    'gpt-3.5-turbo': 'gpt-3.5-turbo',
    
    // Claude 模型
    'claude': 'claude-3-haiku-20240307',
    'claude-3-opus': 'claude-3-opus-20240229',
    'claude-3-sonnet': 'claude-3-sonnet-20240229',
    'claude-3-haiku': 'claude-3-haiku-20240307',
    
    // DeepSeek 模型
    'deepseek': 'deepseek-chat',
    'deepseek-chat': 'deepseek-chat',
    'deepseek-coder': 'deepseek-coder',
    
    // Gemini 模型
    'gemini': 'gemini-2.5-flash-lite',
    'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
    'gemini-1.5-flash': 'gemini-1.5-flash',
    'gemini-1.5-pro': 'gemini-1.5-pro',
    
    // Seedream 模型（方舟 API - 文本生成）
    'seedream-text': 'doubao-seed-1-6-251015',
    'seedream-seed': 'doubao-seed-1-6-251015',
    'seedream-seed-1-8': 'doubao-seed-1-8-251228',
    'seedream-seed-1-6': 'doubao-seed-1-6-251015',
    
    // Ollama 模型（默认模型，实际模型名称从设置中获取）
    'ollama': 'llama3.2',
  },
  image: {
    // NanoBanana 模型
    'nanobanana': 'gemini-2.5-flash-image',
    'nanobananapro': 'gemini-3-pro-image-preview',
    
    // Seedream 模型（方舟 API）
    'seedream': 'doubao-seedream-4-5-251128',
    'seedream-4-5': 'doubao-seedream-4-5-251128',
    'seedream-4-0': 'doubao-seedream-4-0-250828',
    
    // GPTImage 模型
    'gptimage': 'gptimage',
  },
  video: {
    // Seedance 模型（方舟 API - 视频生成）
    'seedream-video': 'doubao-seedance-1-5-pro-251215',
    'seedream-seedance': 'doubao-seedance-1-5-pro-251215',
    'seedream-seedance-1-5-pro': 'doubao-seedance-1-5-pro-251215',
    'seedream-seedance-1-0-pro': 'doubao-seedance-1-0-pro-250528',
    'seedream-seedance-1-0-pro-fast': 'doubao-seedance-1-0-pro-fast-251015',
    'seedream-seedance-1-0-lite-t2v': 'doubao-seedance-1-0-lite-t2v-250428',
    'seedream-seedance-1-0-lite-i2v': 'doubao-seedance-1-0-lite-i2v-250428',
  },
  '3d': {
    // Seedream 模型（方舟 API - 3D生成）
    'seedream-3d': 'doubao-seed3d-1-0-250928',
    'seedream-seed3d': 'doubao-seed3d-1-0-250928',
  },
};

/**
 * 获取模型映射后的名称
 * @param modelName 原始模型名称
 * @param category 模型类别（'text' | 'image' | 'video' | '3d'）
 * @param customMapping 自定义映射配置（可选，用于覆盖默认配置）
 * @returns 映射后的模型名称
 */
export function getMappedModelName(
  modelName: string,
  category: 'text' | 'image' | 'video' | '3d' = 'text',
  customMapping?: Partial<ModelMappingConfig>
): string {
  if (!modelName) {
    return '';
  }
  
  const mapping = customMapping?.[category] || defaultModelMapping[category];
  const lowerModelName = modelName.toLowerCase();
  
  // 如果模型名称在映射表中，返回映射后的名称
  if (mapping[lowerModelName]) {
    return mapping[lowerModelName];
  }
  
  // 如果模型名称不在映射表中，说明用户可能已经输入了完整的模型名称，直接返回
  return modelName;
}

/**
 * 获取所有可用的模型映射
 */
export function getAllModelMappings(): ModelMappingConfig {
  return defaultModelMapping;
}

/**
 * 更新模型映射（用于运行时修改）
 */
export function updateModelMapping(
  category: 'text' | 'image' | 'video' | '3d',
  modelName: string,
  mappedName: string
): void {
  defaultModelMapping[category][modelName.toLowerCase()] = mappedName;
}

/**
 * 图像质量选项接口
 */
export interface QualityOption {
  value: string;
  label: string;
}

/**
 * 根据图像生成模型获取可用的质量选项
 * @param modelName 模型名称（原始名称，如 'seedream', 'nanobanana' 等）
 * @returns 质量选项数组
 */
export function getImageQualityOptions(modelName?: string): QualityOption[] {
  if (!modelName) {
    // 默认选项（通用）
    return [
      { value: '1K', label: '1K (标准)' },
      { value: '2K', label: '2K (高清)' },
      { value: '4K', label: '4K (超高清)' },
    ];
  }

  const lowerModelName = modelName.toLowerCase();
  const mappedModelName = getMappedModelName(modelName, 'image');

  // Seedream 4.5：只支持 2K 和 4K
  if (lowerModelName.includes('seedream-4-5') || 
      lowerModelName === 'seedream' || 
      mappedModelName.includes('4-5') || 
      mappedModelName.includes('4.5')) {
    return [
      { value: '2K', label: '2K (高清)' },
      { value: '4K', label: '4K (超高清)' },
    ];
  }

  // Seedream 4.0：支持 1K, 2K, 4K
  if (lowerModelName.includes('seedream-4-0') || 
      mappedModelName.includes('4-0') || 
      mappedModelName.includes('4.0')) {
    return [
      { value: '1K', label: '1K (标准)' },
      { value: '2K', label: '2K (高清)' },
      { value: '4K', label: '4K (超高清)' },
    ];
  }

  // NanoBanana / Gemini 图像模型：支持 1K, 2K, 4K
  if (lowerModelName.includes('nanobanana') || 
      mappedModelName.includes('gemini')) {
    return [
      { value: '1K', label: '1K (标准)' },
      { value: '2K', label: '2K (高清)' },
      { value: '4K', label: '4K (超高清)' },
    ];
  }

  // GPTImage：可能使用不同的选项
  if (lowerModelName.includes('gptimage')) {
    return [
      { value: 'standard', label: 'Standard (标准)' },
      { value: 'hd', label: 'HD (高清)' },
    ];
  }

  // 默认选项（通用）
  return [
    { value: '1K', label: '1K (标准)' },
    { value: '2K', label: '2K (高清)' },
    { value: '4K', label: '4K (超高清)' },
  ];
}
