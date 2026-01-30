// Core Node Types
export interface NodeHandle {
  id: string;
  type: 'source' | 'target';
  dataType: 'string' | 'image' | 'video' | '3d' | 'number' | 'boolean' | 'any';
  label?: string;
}

export interface NodeParam {
  id: string;
  type: 'text' | 'number' | 'select' | 'slider' | 'checkbox' | 'image' | 'color';
  label: string;
  value: any;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface BaseNodeData {
  id: string;
  type: string;
  label: string;
  inputs: NodeHandle[];
  outputs: NodeHandle[];
  params: NodeParam[];
  position: { x: number; y: number };
}

export interface WorkflowNode extends BaseNodeData {
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface Workflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: {
    version: string;
    created: string;
    modified: string;
  };
}

// API Configuration
export interface APIConfig {
  baseURL: string;
  apiKey: string;
  provider: 'openai' | 'anthropic' | 'comfy' | 'custom';
}

// 模型配置（每个模型独立的 API 配置）
export interface ModelAPIConfig {
  baseURL: string;
  apiKey: string;
  modelName?: string; // 可选：特定模型名称（如 Ollama 的模型名称）
}

// 模型提供商分组
export interface ModelProviderGroup {
  id: string;
  label: string;
  unifiedConfigKey: string; // 统一配置的键名
  models: string[]; // 属于该提供商的模型列表
}

// 统一配置开关状态
export interface UnifiedConfigSwitches {
  [providerId: string]: boolean; // true = 使用统一配置, false = 使用单独配置
}

// 所有模型的 API 配置
export interface ModelConfigs {
  // 文本模型
  openai?: ModelAPIConfig;
  claude?: ModelAPIConfig;
  deepseek?: ModelAPIConfig;
  gemini?: ModelAPIConfig;
  ollama?: ModelAPIConfig;
  // 图像模型
  nanobanana?: ModelAPIConfig;
  nanobananapro?: ModelAPIConfig;
  seedream?: ModelAPIConfig;
  gptimage?: ModelAPIConfig;
  // 统一配置（用于同一提供商的所有模型）
  'openai-unified'?: ModelAPIConfig;
  'claude-unified'?: ModelAPIConfig;
  'deepseek-unified'?: ModelAPIConfig;
  'google-gemini-unified'?: ModelAPIConfig; // Google / Gemini（gemini, nanobanana, nanobananapro, gptimage）
  'seedream-ark'?: ModelAPIConfig; // Seedream 统一配置（用于所有 Seedream 能力：文本、图像、视频、3D）
}

// Settings
export interface AppSettings {
  theme: 'dark' | 'light';
  language: 'zh-CN' | 'en-US';
  api: APIConfig;
}

// Execution Context
export interface ExecutionContext {
  nodeId: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
}
