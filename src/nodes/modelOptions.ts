import { MODEL_PROVIDER_GROUPS } from '@/config/modelProviders';

export type ModelOption = {
  value: string;
  label: string;
  category: 'text' | 'image' | 'video' | '3d';
  /** 可选：模型说明/用途提示（视频节点等会展示在模型选择下方） */
  tip?: string;
};

// 文本生成模型（兼容 OpenAI 协议）
const TEXT_MODEL_OPTIONS: ModelOption[] = [
  { value: 'openai', label: 'OpenAI', category: 'text' },
  { value: 'claude', label: 'Claude', category: 'text' },
  { value: 'deepseek', label: 'DeepSeek', category: 'text' },
  { value: 'gemini', label: 'Gemini', category: 'text' },
  { value: 'seedream-text', label: 'Seedream (文本)', category: 'text' },
  { value: 'ollama', label: 'Ollama', category: 'text' },
];

// 图像生成模型（兼容 OpenAI 协议）
const IMAGE_MODEL_OPTIONS: ModelOption[] = [
  { value: 'nanobanana', label: 'NanoBanana', category: 'image' },
  { value: 'nanobananapro', label: 'NanoBanana Pro', category: 'image' },
  { value: 'seedream', label: 'Seedream', category: 'image' },
  { value: 'gptimage', label: 'GPTImage', category: 'image' },
];

// 视频生成模型（Seedance/方舟 API）及用途提示
const VIDEO_MODEL_OPTIONS: ModelOption[] = [
  {
    value: 'seedream-video',
    label: 'Seedance 1.5 Pro (音画同生)',
    category: 'video',
    tip: '最高品质，支持有声视频（音画同生）、文生视频、图生视频（首帧/首尾帧），可开启「有声视频」',
  },
  {
    value: 'seedream-seedance-1-5-pro',
    label: 'Seedance 1.5 Pro',
    category: 'video',
    tip: '最高品质，支持有声视频（音画同生）、文生视频、图生视频（首帧/首尾帧），可开启「有声视频」',
  },
  {
    value: 'seedream-seedance-1-0-pro',
    label: 'Seedance 1.0 Pro',
    category: 'video',
    tip: '文生视频、图生视频（首帧/首尾帧），不支持有声；画质与能力均衡',
  },
  {
    value: 'seedream-seedance-1-0-pro-fast',
    label: 'Seedance 1.0 Pro Fast',
    category: 'video',
    tip: '文生视频、图生视频（首帧），生成更快、成本更低，适合对速度敏感场景',
  },
  {
    value: 'seedream-seedance-1-0-lite-t2v',
    label: 'Seedance 1.0 Lite (文生视频)',
    category: 'video',
    tip: '仅支持文生视频（纯文本生成），不支持上传图片；轻量、成本低',
  },
  {
    value: 'seedream-seedance-1-0-lite-i2v',
    label: 'Seedance 1.0 Lite (图生视频)',
    category: 'video',
    tip: '支持 1～4 张参考图生视频、首帧/首尾帧生视频；多参考图风格一致时选此模型',
  },
];

// 3D 生成模型（方舟 API - doubao-seed3d 图生3D）
const MODEL_3D_OPTIONS: ModelOption[] = [
  {
    value: 'seedream-3d',
    label: 'Doubao Seed3D',
    category: '3d',
    tip: '图生3D：根据 1 张图片生成带纹理和 PBR 材质的 3D 文件，支持 GLB/OBJ/USD/USDZ',
  },
];

const MODEL_OPTIONS_BY_CATEGORY: Record<string, ModelOption[]> = {
  text: TEXT_MODEL_OPTIONS,
  image: IMAGE_MODEL_OPTIONS,
  video: VIDEO_MODEL_OPTIONS,
  '3d': MODEL_3D_OPTIONS,
};

const MODEL_OPTIONS_BY_NODE_TYPE: Record<string, ModelOption[]> = {
  textGen: TEXT_MODEL_OPTIONS,
  imageGen: IMAGE_MODEL_OPTIONS,
  videoGen: VIDEO_MODEL_OPTIONS,
  '3dGen': MODEL_3D_OPTIONS,
};

export const getModelOptions = (params: { nodeCategory?: string; nodeType?: string } = {}): ModelOption[] => {
  const { nodeCategory, nodeType } = params;
  if (nodeCategory && MODEL_OPTIONS_BY_CATEGORY[nodeCategory]) {
    return MODEL_OPTIONS_BY_CATEGORY[nodeCategory];
  }
  if (nodeType && MODEL_OPTIONS_BY_NODE_TYPE[nodeType]) {
    return MODEL_OPTIONS_BY_NODE_TYPE[nodeType];
  }
  return [];
};

/** 获取视频模型用途提示（用于视频生成节点下方展示） */
export function getVideoModelTip(modelValue: string | undefined): string | undefined {
  if (!modelValue) return undefined;
  const opt = VIDEO_MODEL_OPTIONS.find((o) => o.value === modelValue);
  return opt?.tip;
}

/** 获取 3D 模型用途提示（用于 3D 生成节点下方展示） */
export function get3DModelTip(modelValue: string | undefined): string | undefined {
  if (!modelValue) return undefined;
  const opt = MODEL_3D_OPTIONS.find((o) => o.value === modelValue);
  return opt?.tip;
}

// 获取所有模型选项（用于设置界面）
export const getAllModelOptions = (): ModelOption[] => {
  return [
    ...TEXT_MODEL_OPTIONS,
    ...IMAGE_MODEL_OPTIONS,
    ...VIDEO_MODEL_OPTIONS,
    ...MODEL_3D_OPTIONS,
  ];
};

export type ModelOptionsGroupedByProvider = { providerLabel: string; models: ModelOption[] };

// 按提供商分组返回某类别的模型选项（用于设置界面）
export function getModelOptionsGroupedByProvider(
  category: 'text' | 'image' | 'video' | '3d'
): ModelOptionsGroupedByProvider[] {
  const options = getModelOptions({ nodeCategory: category });
  const used = new Set<string>();
  const result: ModelOptionsGroupedByProvider[] = [];

  for (const group of MODEL_PROVIDER_GROUPS) {
    const models = options.filter((m) => group.models.includes(m.value));
    if (models.length > 0) {
      models.forEach((m) => used.add(m.value));
      result.push({ providerLabel: group.label, models });
    }
  }

  const ungrouped = options.filter((m) => !used.has(m.value));
  if (ungrouped.length > 0) {
    result.push({ providerLabel: '其他', models: ungrouped });
  }
  return result;
}
