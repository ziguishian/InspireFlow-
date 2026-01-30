import { ModelProviderGroup } from '@/types';

// 定义模型提供商分组
export const MODEL_PROVIDER_GROUPS: ModelProviderGroup[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    unifiedConfigKey: 'openai-unified',
    models: ['openai'],
  },
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    unifiedConfigKey: 'claude-unified',
    models: ['claude'],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    unifiedConfigKey: 'deepseek-unified',
    models: ['deepseek'],
  },
  {
    id: 'google-gemini',
    label: 'Google / Gemini',
    unifiedConfigKey: 'google-gemini-unified',
    models: ['gemini', 'nanobanana', 'nanobananapro', 'gptimage'],
  },
  {
    id: 'seedream',
    label: 'Seedream (方舟 API)',
    unifiedConfigKey: 'seedream-ark',
    models: ['seedream', 'seedream-text', 'seedream-video', 'seedream-3d'],
  },
];

// 根据模型名称获取所属的提供商分组
export function getModelProvider(modelValue: string): ModelProviderGroup | null {
  const byList = MODEL_PROVIDER_GROUPS.find(group =>
    group.models.includes(modelValue)
  );
  if (byList) return byList;
  // 所有 seedream-* 模型（含 seedream-seedance-*-*）统一归入 Seedream 分组，共用同一配置
  if (modelValue.startsWith('seedream-') || modelValue.startsWith('seedream')) {
    return MODEL_PROVIDER_GROUPS.find(g => g.id === 'seedream') || null;
  }
  return null;
}

// 获取模型应该使用的配置键名（根据统一配置开关状态）
export function getModelConfigKey(
  modelValue: string,
  unifiedConfigSwitches: Record<string, boolean>
): string {
  const provider = getModelProvider(modelValue);
  if (!provider) {
    return modelValue; // 没有分组的模型（如 ollama）直接返回模型名称
  }
  // Seedream 系列统一使用系统级配置 seedream-ark，不按模型拆分
  if (provider.id === 'seedream') {
    return provider.unifiedConfigKey;
  }
  // 检查是否启用统一配置
  const useUnified = unifiedConfigSwitches[provider.id] ?? false;
  return useUnified ? provider.unifiedConfigKey : modelValue;
}
