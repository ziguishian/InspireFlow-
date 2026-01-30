import { Node, Edge } from 'reactflow';
import { topologicalSort, getNodeInputs } from '@/utils/graphExecution';
import { APIService } from './apiService';
import { NODE_HANDLE_SCHEMAS, HandleType } from '@/nodes/handleSchema';
import { normalizeData, extractDataFromNode, normalizeToText, normalizeToImage, normalizeToVideo, normalizeTo3D } from '@/utils/dataCompatibility';
import { saveGeneratedFile } from '@/utils/fileSave';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatMissingRequired, validateNodeRequired } from '@/utils/nodeValidation';
import { getModelProvider, getModelConfigKey } from '@/config/modelProviders';

export interface ExecutionResult {
  nodeId: string;
  success: boolean;
  output?: any;
  outputs?: Record<string, any>;
  skipped?: boolean;
  error?: string;
}

const buildOutputMap = (nodeType: string | undefined, output: any): Record<string, any> => {
  if (!nodeType) return {};
  const schema = NODE_HANDLE_SCHEMAS[nodeType];
  // 3D 预览节点无 output handle，但需将上游解析结果写入 model/3d 供 BaseNode 展示（zip URL 解压预览）
  if (nodeType === '3dPreview' && output != null) {
    const normalized = normalizeTo3D(output);
    if (normalized != null) {
      return { model: normalized, '3d': normalized };
    }
    return {};
  }
  if (!schema || schema.outputs.length === 0) {
    return {};
  }
  const result = schema.outputs.reduce<Record<string, any>>((acc, handle) => {
    // 根据输出类型规范化数据，确保兼容性
    const normalized = normalizeData(output, handle.type);
    acc[handle.id] = normalized;
    // 同时设置通用字段以保持兼容性
    if (handle.type === 'text') {
      acc.text = normalized;
    } else if (handle.type === 'image') {
      acc.image = normalized;
    } else if (handle.type === 'video') {
      acc.video = normalized;
    } else if (handle.type === '3d') {
      acc.model = normalized;
      console.log(`[buildOutputMap] 3D类型输出处理:`, {
        nodeType,
        output,
        outputType: typeof output,
        handleId: handle.id,
        normalized,
        normalizedType: typeof normalized,
      });
    }
    return acc;
  }, {});
  
  if (nodeType === '3dGen' || nodeType === '3dPreview') {
    console.log(`[buildOutputMap] 3D节点输出映射结果:`, {
      nodeType,
      output,
      result,
    });
  }
  
  return result;
};

const resolveNodeOutput = async (
  node: Node,
  inputs: Record<string, any>,
  _apiService: APIService | null
): Promise<any> => {
  // 根据模型创建 APIService 实例
  const createApiServiceForModel = (model: string): APIService => {
    const { getModelConfig, getUnifiedConfigSwitch } = useSettingsStore.getState();
    
    // 使用 modelProviders 配置来获取正确的配置键
    const modelProvider = getModelProvider(model);
    
    // 获取统一配置开关状态
    const unifiedConfigSwitches: Record<string, boolean> = {};
    if (modelProvider) {
      unifiedConfigSwitches[modelProvider.id] = getUnifiedConfigSwitch(modelProvider.id);
    }
    
    // 根据统一配置开关状态获取配置键
    const configKey = getModelConfigKey(model, unifiedConfigSwitches);
    let config = getModelConfig(configKey);
    
    // 如果统一配置不存在，尝试使用模型特定的配置（向后兼容）
    if (!config && modelProvider) {
      config = getModelConfig(model);
    }
    
    // 检查是否为本地模型（Ollama）
    const isLocalModel = model.toLowerCase() === 'ollama';
    
    // 对于本地模型，需要单独验证（不需要 API Key）
    if (isLocalModel) {
      if (!config) {
        throw new Error(`模型 "${model}" 未配置，请前往设置配置该模型的 API Base URL（例如: http://localhost:11434）`);
      }
      if (!config.baseURL || config.baseURL.trim() === '') {
        throw new Error(`模型 "${model}" 配置不完整，请前往设置配置该模型的 API Base URL（例如: http://localhost:11434）`);
      }
      // 本地模型不需要 API Key，直接通过验证
    } else {
      // 非本地模型的验证
      if (!config) {
        throw new Error(`模型 "${model}" 未配置，请前往设置配置该模型的 API Base URL 和 API Key`);
      }
      if (!config.baseURL || config.baseURL.trim() === '') {
        throw new Error(`模型 "${model}" 配置不完整，请前往设置配置该模型的 API Base URL`);
      }
      if (!config.apiKey || config.apiKey.trim() === '') {
        throw new Error(`模型 "${model}" 配置不完整，请前往设置配置该模型的 API Key`);
      }
    }
    
    // 检查是否为 Ollama（基于 baseURL 检测，用于后续处理）
    const isOllamaModel = model.toLowerCase() === 'ollama' ||
                          (config.baseURL && (
                            config.baseURL.includes('localhost:11434') ||
                            config.baseURL.includes('127.0.0.1:11434')
                          ));
    
    // 检测是否为 Gemini 图像生成模型（使用 Google GenAI 图像生成协议）
    const isGeminiImageModel = model.includes('nanobanana') || 
                                model.includes('gptimage');
    
    // 检测是否为 Seedream 模型
    // 包括：文本生成（seedream-text, doubao-seed）、图像生成（seedream）、视频生成（seedream-video, doubao-seedance）、3D生成（seedream-3d, doubao-seed3d）
    const isSeedreamModel = model.includes('seedream') || 
                            model.includes('doubao-seed') ||
                            model.includes('doubao-seedance') ||
                            model.includes('doubao-seed3d');
    
    // 检测是否为 Gemini 文本生成模型
    const isGeminiTextModel = model.toLowerCase() === 'gemini' || 
                              (model.includes('gemini') && !isGeminiImageModel);
    
    // 根据模型名称推断 provider
    let provider: 'openai' | 'anthropic' | 'comfy' | 'custom' = 'custom';
    let baseURL = config.baseURL;
    
    if (model.includes('gpt') || model.includes('openai')) {
      provider = 'openai';
    } else if (model.includes('claude') || model.includes('anthropic')) {
      provider = 'anthropic';
      // 特殊处理只对 api.openai-proxy.org 这个特定代理生效
      // 对于其他代理和原生 Anthropic API，使用标准格式
      const isOpenAIProxyOrg = baseURL.includes('api.openai-proxy.org');
      if (isOpenAIProxyOrg) {
        // 如果 baseURL 是 api.openai-proxy.org，需要确保使用 /anthropic 后缀（Anthropic 原生协议）
        if (baseURL.includes('/v1') && !baseURL.includes('/anthropic')) {
          // 如果 baseURL 是 api.openai-proxy.org/v1，改为 api.openai-proxy.org/anthropic
          baseURL = baseURL.replace(/\/v1$/, '/anthropic').replace(/\/v1\//, '/anthropic/');
        } else if (!baseURL.includes('/anthropic') && !baseURL.includes('/v1')) {
          // 如果 baseURL 是 api.openai-proxy.org（没有后缀），添加 /anthropic 后缀
          if (baseURL === 'https://api.openai-proxy.org' || baseURL === 'http://api.openai-proxy.org') {
            baseURL = baseURL + '/anthropic';
          }
        }
      }
      // 对于其他代理和原生 API（如 api.anthropic.com），保持 baseURL 不变，使用标准格式
    } else if (isSeedreamModel) {
      // Seedream 模型使用 custom provider，使用方舟 API
      provider = 'custom';
      // 方舟 API baseURL 应该是 https://ark.cn-beijing.volces.com/api/v3
      // 如果用户配置的 baseURL 不包含 /api/v3，需要确保正确
      if (!baseURL.includes('/api/v3') && !baseURL.includes('ark.cn-beijing.volces.com')) {
        // 如果 baseURL 是根域名，添加 /api/v3
        if (baseURL.endsWith('volces.com') || baseURL.endsWith('volces.com/')) {
          baseURL = baseURL.replace(/\/?$/, '/api/v3');
        }
      }
      // 对于已正确配置的方舟 API baseURL，保持 baseURL 不变
    } else if (isGeminiImageModel) {
      // Gemini 图像生成模型使用 custom provider
      provider = 'custom';
      // 特殊处理只对 api.openai-proxy.org 这个特定代理生效
      // 对于其他代理和原生 Google API，使用标准格式
      const isOpenAIProxyOrg = baseURL.includes('api.openai-proxy.org');
      if (isOpenAIProxyOrg) {
        // 如果 baseURL 是 api.openai-proxy.org/v1，转换为 /google 后缀
        if (!baseURL.includes('/google')) {
          baseURL = baseURL.replace(/\/v1$/, '/google').replace(/\/v1\//, '/google/');
        }
      }
      // 对于其他代理和原生 Google API，保持 baseURL 不变
    } else if (isGeminiTextModel) {
      // Gemini 文本生成模型使用 custom provider
      provider = 'custom';
      // 特殊处理只对 api.openai-proxy.org 这个特定代理生效
      // 对于其他代理和原生 Google API，使用标准格式
      const isOpenAIProxyOrg = baseURL.includes('api.openai-proxy.org');
      if (isOpenAIProxyOrg) {
        // 如果 baseURL 是 api.openai-proxy.org/v1，转换为 /google 后缀
        if (!baseURL.includes('/google')) {
          baseURL = baseURL.replace(/\/v1$/, '/google').replace(/\/v1\//, '/google/');
        }
      }
      // 对于其他代理和原生 Google API，保持 baseURL 不变
    } else if (isOllamaModel) {
      // Ollama 使用 custom provider
      provider = 'custom';
    } else {
      // 其他模型（deepseek, qwen 等）使用 custom provider，但使用 OpenAI 兼容格式
      // 对于这些模型，所有代理和原生 API 都使用标准 OpenAI 兼容格式，无需特殊处理
      provider = 'custom';
    }
    
    // 创建 APIService 配置，包含 modelName（如果存在）
    const apiConfig: any = {
      baseURL: baseURL,
      // 对于 Ollama，不传递 apiKey（设为空字符串，即使配置中有默认值）
      // 对于其他模型，使用配置中的 apiKey
      apiKey: isOllamaModel ? '' : (config.apiKey || ''),
      provider,
    };
    
    // 如果是 Ollama 且配置中有 modelName，传递它
    if (isOllamaModel && (config as any).modelName) {
      apiConfig.modelName = (config as any).modelName;
    }
    
    return new APIService(apiConfig);
  };

  switch (node.type) {
    case 'textGen': {
      let model = node.data.model || 'openai';
      const modelApiService = createApiServiceForModel(model);
      
      // 对于 Ollama，如果节点中的 model 是 'ollama'，尝试从配置中获取具体的模型名称
      if (model.toLowerCase() === 'ollama') {
        const { getModelConfig } = useSettingsStore.getState();
        const config = getModelConfig('ollama');
        if (config && (config as any).modelName) {
          model = (config as any).modelName;
        }
      }
      
      // 文本生成节点可以从 'text' 输入（来自文本输入节点）或 'prompt' 输入获取提示词
      const prompt = inputs.text || inputs.prompt || node.data.prompt || '';
      // 如果有图像输入，用于图像分析
      const imageInput = inputs.image || node.data.image || undefined;
      return modelApiService.generateText(prompt, {
        model,
        temperature: node.data.temperature,
        maxTokens: node.data.maxTokens,
        context: inputs.context || node.data.context,
        imageInput, // 传递图像输入用于图像分析
      });
    }
    case 'imageGen': {
      const model = node.data.model || 'nanobanana';
      const modelApiService = createApiServiceForModel(model);
      // 图像生成节点可以从 'text' 输入（来自文本生成节点）或 'prompt' 输入获取提示词
      // 优先使用连接的文本输入，其次使用节点自身的 prompt 属性
      const prompt = inputs.text || inputs.prompt || node.data.prompt || '';
      if (!prompt || prompt.trim().length === 0) {
        throw new Error('图像生成节点需要输入提示词（prompt），请在前置节点提供文本输入或在节点属性中设置提示词');
      }
      
      // 获取画面比例和画质设置
      const aspectRatio = node.data.aspectRatio || '1:1';
      const quality = node.data.quality || node.data.imageSize || undefined;
      
      // 获取图像输入（支持多张图像）
      const imageInput = inputs.image || node.data.image || undefined;
      
      console.log('[workflowExecutor] imageGen 节点图像输入:', {
        nodeId: node.id,
        hasImageInput: !!imageInput,
        imageInputType: typeof imageInput,
        isArray: Array.isArray(imageInput),
        imageInputLength: Array.isArray(imageInput) ? imageInput.length : (imageInput ? 1 : 0),
        inputsKeys: Object.keys(inputs),
        inputsImageValue: inputs.image,
        inputsImageType: typeof inputs.image,
        inputsImageIsArray: Array.isArray(inputs.image),
        inputsImageLength: Array.isArray(inputs.image) ? inputs.image.length : (inputs.image ? 1 : 0),
      });
      
      return modelApiService.generateImage(prompt, {
        model,
        size: node.data.size || undefined, // 保留 size 以兼容旧格式
        aspectRatio: aspectRatio,
        quality: quality,
        imageInput: imageInput, // 支持图像输入（可以是数组）
      });
    }
    case 'videoGen': {
      const model = node.data.model || 'seedream-video';
      const modelApiService = createApiServiceForModel(model);
      
      // 视频生成节点可以从 'text' 输入（来自文本生成节点）或 'prompt' 输入获取提示词
      const prompt = inputs.text || inputs.prompt || node.data.prompt || '';
      if (!prompt || prompt.trim().length === 0) {
        throw new Error('视频生成节点需要输入提示词（prompt），请在前置节点提供文本输入或在节点属性中设置提示词');
      }
      
      // 获取图像输入：支持单图、多图数组，或首尾帧 (firstFrame/lastFrame)。数量决定模式：0=文生视频，1=首帧，2=首尾帧，3-4=参考图
      let imageInput: string | string[] | undefined;
      if (inputs.image !== undefined && inputs.image !== null) {
        imageInput = Array.isArray(inputs.image) ? inputs.image : [inputs.image];
      } else if (node.data.firstFrame != null && node.data.lastFrame != null) {
        imageInput = [node.data.firstFrame, node.data.lastFrame];
      } else if (node.data.image !== undefined && node.data.image !== null) {
        imageInput = Array.isArray(node.data.image) ? node.data.image : [node.data.image];
      } else {
        imageInput = undefined;
      }
      
      // 获取视频生成参数
      const ratio = node.data.ratio || 'adaptive';
      const duration = node.data.duration || 5;
      const resolution = node.data.resolution || undefined;
      const generateAudio = node.data.generateAudio || false;
      const watermark = node.data.watermark !== undefined ? node.data.watermark : false;
      const seed = node.data.seed || undefined;
      const cameraFixed = node.data.cameraFixed || false;
      const returnLastFrame = node.data.returnLastFrame || false;
      const serviceTier = node.data.serviceTier || 'default';
      
      return modelApiService.generateVideo(prompt, {
        model,
        imageInput,
        ratio,
        duration,
        resolution,
        generateAudio,
        watermark,
        seed,
        cameraFixed,
        returnLastFrame,
        serviceTier,
      });
    }
    case '3dGen': {
      const model = node.data.model || 'seedream-3d';
      const modelApiService = createApiServiceForModel(model);
      
      // 3D生成节点需要图像输入
      const imageInput = inputs.image || node.data.image || undefined;
      if (!imageInput) {
        throw new Error('3D生成节点需要输入图像，请在前置节点提供图像输入或在节点属性中设置图像');
      }
      
      // 获取3D生成参数（与文档一致：subdivisionlevel 默认 medium，fileformat 默认 glb）
      const prompt = inputs.text || inputs.prompt || node.data.prompt || '';
      const subdivisionLevel = node.data.subdivisionLevel ?? node.data.quality ?? 'medium';
      const fileFormat = node.data.fileFormat ?? node.data.format ?? 'glb';
      
      // 将图像输入转换为字符串格式（如果是数组，取第一个）
      const imageInputStr = Array.isArray(imageInput) ? imageInput[0] : imageInput;
      
      const result = await modelApiService.generate3D(imageInputStr, {
        model,
        prompt,
        subdivisionLevel,
        fileFormat,
      });
      
      console.log(`[resolveNodeOutput] 3dGen节点 ${node.id} 生成结果:`, {
        result,
        resultType: typeof result,
        isArray: Array.isArray(result),
      });
      
      // 规范化3D输出，确保格式正确
      const normalizedResult = normalizeTo3D(result);
      console.log(`[resolveNodeOutput] 3dGen节点 ${node.id} 规范化后的结果:`, {
        normalizedResult,
        normalizedResultType: typeof normalizedResult,
      });
      
      return normalizedResult || result;
    }
    case 'scriptRunner':
      return { message: 'Script execution not yet implemented' };
    case 'textInput': {
      // 文本输入节点：返回规范化后的文本
      const textValue = node.data.text ?? inputs.text ?? null;
      return normalizeToText(textValue);
    }
    case 'imageInput': {
      // 图像输入节点：返回规范化后的图像（兼容多种格式）
      const imageValue = node.data.image ?? inputs.image ?? null;
      return normalizeToImage(imageValue);
    }
    case 'videoInput': {
      // 视频输入节点：返回规范化后的视频
      const videoValue = node.data.video ?? inputs.video ?? null;
      return normalizeToVideo(videoValue);
    }
    case '3dInput': {
      // Seedream 3D 加载节点：输入下载链接（zip URL），输出供预览/3dGen 使用
      const urlOrModel = node.data.url ?? node.data.model ?? node.data.output ?? null;
      return normalizeTo3D(urlOrModel);
    }
    case 'textPreview': {
      // 文本预览节点：兼容多种文本格式
      const textValue = normalizeToText(
        inputs.text || 
        inputs.prompt || 
        inputs.content || 
        inputs.message || 
        node.data.output || 
        node.data.text || 
        node.data.prompt ||
        null
      );
      return textValue || null;
    }
    case 'imagePreview': {
      // 图像预览节点：兼容多种图像格式
      const imageValue = normalizeToImage(
        inputs.image || 
        inputs.url || 
        inputs.src || 
        node.data.output || 
        node.data.image ||
        null
      );
      console.log(`[resolveNodeOutput] imagePreview节点 ${node.id} 输出:`, {
        inputsImage: inputs.image,
        inputsUrl: inputs.url,
        inputsSrc: inputs.src,
        nodeDataOutput: node.data.output,
        nodeDataImage: node.data.image,
        imageValue,
        imageValueType: Array.isArray(imageValue) ? 'array' : typeof imageValue,
      });
      return imageValue;
    }
    case 'videoPreview': {
      // 视频预览节点：兼容多种视频格式
      const videoValue = normalizeToVideo(
        inputs.video || 
        inputs.url || 
        inputs.src || 
        node.data.output || 
        node.data.video ||
        null
      );
      return videoValue;
    }
    case '3dPreview': {
      // 3D预览节点：兼容多种3D格式
      const modelValue = normalizeTo3D(
        inputs.model || 
        inputs['3d'] || 
        inputs.url || 
        inputs.src || 
        node.data.output || 
        node.data.model ||
        null
      );
      return modelValue;
    }
    default:
      // 默认：尝试从所有可能的输入中提取数据
      return inputs.text || inputs.image || inputs.video || inputs.model || node.data.output || null;
  }
};

/**
 * 自动保存节点输出
 */
async function autoSaveNodeOutput(
  node: Node,
  output: any,
  _outputMap: Record<string, any>,
  saveConfig: { enabled: boolean; useRelativePath: boolean; path: string },
  workflowId?: string
): Promise<void> {
  // 只对生成节点保存，不对预览节点和输入节点保存，避免重复保存
  // 预览节点只是显示生成节点的输出，不应该重复保存
  // 输入节点是用户输入的内容，不需要保存
  
  // 检查是否是预览节点，如果是则跳过保存
  if (node.type === 'imagePreview' || node.type === 'videoPreview' || node.type === '3dPreview' || node.type === 'textPreview') {
    console.log(`[autoSaveNodeOutput] 跳过预览节点 ${node.id} (${node.type})，避免重复保存`);
    return;
  }
  
  // 检查是否是输入节点，如果是则跳过保存
  if (node.type === 'imageInput' || node.type === 'videoInput' || node.type === 'textInput' || node.type === '3dInput') {
    console.log(`[autoSaveNodeOutput] 跳过输入节点 ${node.id} (${node.type})，不需要保存`);
    return;
  }

  // 即使 saveConfig.enabled 为 false，也要提取 URL 以便添加到历史记录
  // 但只有在 saveConfig.enabled 为 true 时才保存文件

  try {
    // 确定输出类型
    const schema = node.type ? NODE_HANDLE_SCHEMAS[node.type] : undefined;
    
    let url: string;
    let type: 'text' | 'image' | 'video' | '3d';
    let outputType: HandleType | null = null;

    // 从 schema 中获取输出类型（只处理生成节点，预览节点已在开头被过滤）
    if (!schema || schema.outputs.length === 0) {
      return; // 没有输出的节点，不保存
    }

    // 获取第一个输出类型（通常节点只有一个主要输出）
    outputType = schema.outputs[0]?.type;
    if (!outputType || outputType === 'any') {
      return; // 不支持的类型，不保存
    }

    // 根据类型提取输出
    if (outputType === 'text') {
      type = 'text';
      // 文本输出：直接使用文本内容
      url = normalizeToText(output) || '';
      if (!url || url.trim().length === 0) {
        return; // 空文本不保存
      }
    } else if (outputType === 'image') {
      type = 'image';
      // 对于 imageGen 节点，output 可能是字符串数组
      let imageResult: string | string[] | null = null;
      
      // 如果 output 本身就是字符串数组（imageGen 返回的格式）
      if (Array.isArray(output) && output.length > 0) {
        // 检查数组元素是否是有效的图像 URL
        const validImages = output.filter(item => 
          typeof item === 'string' && (
            item.startsWith('data:image/') || 
            item.startsWith('http://') || 
            item.startsWith('https://') ||
            item.startsWith('file://')
          )
        );
        if (validImages.length > 0) {
          imageResult = validImages;
        } else {
          // 如果数组元素不是直接的 URL，尝试规范化
          imageResult = normalizeToImage(output[0]);
        }
      } else {
        // 否则使用 normalizeToImage 处理
        imageResult = normalizeToImage(output);
      }
      
      // 处理数组情况：如果是数组，取第一个元素
      if (Array.isArray(imageResult)) {
        url = imageResult.length > 0 ? imageResult[0] : '';
      } else {
        url = imageResult || '';
      }
      
      // 调试日志
      console.log(`[autoSaveNodeOutput] imageGen节点 ${node.id}`, {
        output,
        outputType: typeof output,
        isArray: Array.isArray(output),
        imageResult,
        url,
        urlLength: url?.length,
        urlPreview: url?.substring(0, 100),
      });
      
      if (!url) {
        console.warn(`[autoSaveNodeOutput] imageGen节点 ${node.id} 没有找到有效的图像 URL`);
        return;
      }
    } else if (outputType === 'video') {
      type = 'video';
      url = normalizeToVideo(output) || '';
      if (!url) {
        return;
      }
    } else if (outputType === '3d') {
      type = '3d';
      url = normalizeTo3D(output) || '';
      if (!url) {
        return;
      }
    } else {
      return; // 不支持的类型
    }

    // 保存文件（如果启用）
    let savedPath: string | null = null;
    if (saveConfig.enabled) {
      console.log(`[autoSaveNodeOutput] 准备保存节点 ${node.id} (${node.type})`, {
        type,
        urlLength: url?.length,
        urlPreview: url?.substring(0, 50),
        workflowId,
        nodeId: node.id,
      });
      
      savedPath = await saveGeneratedFile(
        url,
        type,
        saveConfig,
        {
          workflowId,
          nodeId: node.id,
          nodeType: node.type,
          label: node.data?.label || node.type,
        }
      );

      if (savedPath) {
        console.log(`[autoSaveNodeOutput] 节点 ${node.id} (${node.type}) 保存成功:`, savedPath);
      } else {
        console.warn(`[autoSaveNodeOutput] 节点 ${node.id} (${node.type}) 保存返回 null`);
      }
    }
    
    // 添加到历史记录
    // 优化策略：
    // - Electron 环境：如果保存了文件，只保存 filePath，不保存 base64 URL（节省数据库空间）
    // - 浏览器环境：即使保存了文件，也保留原始 URL 用于立即显示（因为 IndexedDB 读取可能慢）
    try {
      // 检查是否在 Electron 环境中
      const isElectron = typeof window !== 'undefined' && 
                         (window as any).electronAPI && 
                         typeof (window as any).electronAPI.readFileAsDataUrl === 'function';
      
      // 确保 URL 是有效的
      if (!url || (typeof url === 'string' && url.trim().length === 0)) {
        console.warn(`[autoSaveNodeOutput] 节点 ${node.id} (${node.type}) 没有有效的 URL，跳过添加到历史记录`);
        return;
      }
      
      if (savedPath && saveConfig.enabled) {
        // 保存了文件的情况
        if (isElectron) {
          // Electron 环境：只保存 filePath，不保存 base64 URL（节省数据库空间，文件系统访问快）
          const historyItem = {
            type,
            url: '', // 不保存 base64 URL，节省数据库空间
            filePath: savedPath, // 只保存文件路径
            workflowId,
            nodeId: node.id,
            nodeType: node.type,
            label: node.data?.label || node.type,
          };
          
          console.log(`[autoSaveNodeOutput] 准备添加到历史记录（Electron，仅文件路径）:`, {
            nodeId: node.id,
            nodeType: node.type,
            type,
            filePath: savedPath,
          });
          
          await useSettingsStore.getState().addGenerationHistory(historyItem);
          console.log(`[autoSaveNodeOutput] 已成功添加到历史记录（Electron，仅文件路径）: ${node.id} (${node.type})`);
        } else {
          // 浏览器环境：同时保存 filePath 和原始 URL（保留 URL 用于立即显示，filePath 用于持久化）
          // 注意：虽然保存了 URL，但主要使用 filePath，URL 仅作为备用
          const historyItem = {
            type,
            url: url, // 保留原始 URL 用于立即显示
            filePath: savedPath, // 保存文件路径用于持久化
            workflowId,
            nodeId: node.id,
            nodeType: node.type,
            label: node.data?.label || node.type,
          };
          
          console.log(`[autoSaveNodeOutput] 准备添加到历史记录（浏览器，文件路径+URL）:`, {
            nodeId: node.id,
            nodeType: node.type,
            type,
            filePath: savedPath,
            urlLength: url?.length,
          });
          
          await useSettingsStore.getState().addGenerationHistory(historyItem);
          console.log(`[autoSaveNodeOutput] 已成功添加到历史记录（浏览器，文件路径+URL）: ${node.id} (${node.type})`);
        }
      } else {
        // 没有保存文件的情况：保存原始 URL
        // 对于大文件（base64 超过 1MB），建议启用保存功能
        if (typeof url === 'string' && url.length > 1024 * 1024) {
          console.warn(`[autoSaveNodeOutput] 节点 ${node.id} (${node.type}) 的 URL 很大 (${Math.round(url.length / 1024)}KB)，建议启用保存功能以节省数据库空间`);
        }
        
        const historyItem = {
          type,
          url: url, // 使用原始 URL（data URL 或 HTTP URL）
          filePath: undefined, // 没有保存文件
          workflowId,
          nodeId: node.id,
          nodeType: node.type,
          label: node.data?.label || node.type,
        };
        
        console.log(`[autoSaveNodeOutput] 准备添加到历史记录（包含 URL）:`, {
          nodeId: node.id,
          nodeType: node.type,
          type,
          urlLength: url?.length,
          urlPreview: typeof url === 'string' ? url.substring(0, 100) : url,
        });
        
        await useSettingsStore.getState().addGenerationHistory(historyItem);
        console.log(`[autoSaveNodeOutput] 已成功添加到历史记录（包含 URL）: ${node.id} (${node.type})`);
      }
    } catch (error) {
      console.error(`[autoSaveNodeOutput] 添加到历史记录失败:`, error);
      // 不抛出错误，继续执行
    }
  } catch (error) {
    console.error(`[autoSaveNodeOutput] 保存节点 ${node.id} (${node.type}) 输出失败:`, error);
    // 不抛出错误，避免影响工作流执行
  }
}

/**
 * Execute a workflow graph
 */
export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  options: { 
    shouldStop?: () => boolean; 
    onProgress?: (current: number, total: number) => void;
    onNodeStart?: (nodeId: string) => void; // 节点开始执行时调用
    onNodeComplete?: (nodeId: string, success: boolean) => void; // 节点完成时调用
    saveConfig?: { enabled: boolean; useRelativePath: boolean; path: string }; // 保存配置
    workflowId?: string; // 工作流 ID
  } = {}
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  const executionOrder = topologicalSort(nodes, edges);
  // apiService 不再需要全局创建，而是在 resolveNodeOutput 中根据模型动态创建

  // Execution context to store outputs
  const context: Record<string, Record<string, any>> = {};

  for (let i = 0; i < executionOrder.length; i++) {
    const node = executionOrder[i];
    options.onProgress?.(i + 1, executionOrder.length);
    if (options.shouldStop?.()) {
      break;
    }
    
    // 通知节点开始执行
    options.onNodeStart?.(node.id);
    
    try {
      // 运行前：必填项校验（缺值直接报错，避免“看起来能跑但实际失败”）
      if (!node.data?.skip) {
        const { missing } = validateNodeRequired(node, nodes, edges);
        if (missing.length > 0) {
          throw new Error(`节点「${node.data?.label || node.type || node.id}」缺少必填项：${formatMissingRequired(missing)}。请先输入对应的值再运行。`);
        }
      }
      // 首先从 context 中获取输入（这是主要的数据源）
      const inputs: Record<string, any> = {};
      
      // 查找所有指向当前节点的连线
      const incomingEdges = edges.filter((e) => e.target === node.id);
      
      // 获取当前节点的输入 schema
      const nodeSchema = node.type ? NODE_HANDLE_SCHEMAS[node.type] : undefined;
      
      for (const edge of incomingEdges) {
        if (edge.targetHandle) {
          const sourceNodeId = edge.source;
          const sourceOutputKey = edge.sourceHandle || 'default';
          
          // 获取目标输入的类型
          const targetInputHandle = nodeSchema?.inputs.find((h: { id: string }) => h.id === edge.targetHandle);
          const targetType = targetInputHandle?.type || 'any';
          
          // 优先从 context 中获取（这是执行后的输出）
          let value = null;
          if (context[sourceNodeId]?.[sourceOutputKey]) {
            value = context[sourceNodeId][sourceOutputKey];
          } else {
            // 如果 context 中没有，尝试从 node.data 中获取（可能是初始值或跳过节点的值）
            const sourceNode = nodes.find((n) => n.id === sourceNodeId);
            if (sourceNode) {
              // 尝试从多个可能的字段中提取数据
              value = extractDataFromNode(sourceNode.data, targetType);
            }
          }
          
          // 规范化数据以确保兼容性
          if (value !== null && value !== undefined) {
            const normalized = normalizeData(value, targetType);
            const targetHandle = edge.targetHandle;
            
            // 如果这个 handle 已经有值，合并它们（支持多图输入）
            if (inputs[targetHandle] !== undefined) {
              const existingValue = inputs[targetHandle];
              if (Array.isArray(existingValue)) {
                // 已经是数组，添加新值
                if (Array.isArray(normalized)) {
                  existingValue.push(...normalized);
                } else {
                  existingValue.push(normalized);
                }
              } else {
                // 转换为数组
                if (Array.isArray(normalized)) {
                  inputs[targetHandle] = [existingValue, ...normalized];
                } else {
                  inputs[targetHandle] = [existingValue, normalized];
                }
              }
            } else {
              // 第一个值
              inputs[targetHandle] = normalized;
            }
            
            // 同时设置通用字段以保持兼容性（对于图像类型，支持数组）
            if (targetType === 'text') {
              // 文本类型：如果已有值，合并（连接）
              if (inputs.text !== undefined && inputs.text !== normalized) {
                const existingText = Array.isArray(inputs.text) ? inputs.text.join('\n') : inputs.text;
                const newText = Array.isArray(normalized) ? normalized.join('\n') : normalized;
                inputs.text = existingText + '\n' + newText;
              } else {
                inputs.text = normalized;
              }
              inputs.prompt = inputs.text; // 文本也可以作为 prompt
            } else if (targetType === 'image') {
              // 图像类型：支持数组
              if (inputs.image !== undefined) {
                const existingImage = inputs.image;
                if (Array.isArray(existingImage)) {
                  if (Array.isArray(normalized)) {
                    existingImage.push(...normalized);
                  } else {
                    existingImage.push(normalized);
                  }
                } else {
                  if (Array.isArray(normalized)) {
                    inputs.image = [existingImage, ...normalized];
                  } else {
                    inputs.image = [existingImage, normalized];
                  }
                }
              } else {
                inputs.image = normalized;
              }
            } else if (targetType === 'video') {
              inputs.video = normalized;
            } else if (targetType === '3d') {
              inputs.model = normalized;
            }
          }
        }
      }
      
      // 也保留 getNodeInputs 的逻辑作为后备（用于没有连线的情况）
      const fallbackInputs = getNodeInputs(node.id, nodes, edges);
      Object.keys(fallbackInputs).forEach((key) => {
        if (!inputs[key]) {
          const targetInputHandle = nodeSchema?.inputs.find((h: { id: string }) => h.id === key);
          const targetType = targetInputHandle?.type || 'any';
          inputs[key] = normalizeData(fallbackInputs[key], targetType);
        }
      });

      if (node.data?.skip) {
        const output = node.data?.output ?? inputs.text ?? inputs.image ?? inputs.video ?? inputs.model ?? null;
        const outputMap = buildOutputMap(node.type, output);
        if (!context[node.id]) {
          context[node.id] = {};
        }
        context[node.id]['default'] = output;
        Object.keys(outputMap).forEach((key) => {
          context[node.id][key] = outputMap[key];
        });
        results.push({
          nodeId: node.id,
          success: true,
          output,
          outputs: outputMap,
          skipped: true,
        });
        continue;
      }

      const output = await resolveNodeOutput(node, inputs, null);
      const outputMap = buildOutputMap(node.type, output);
      
      console.log(`[executeNode] 节点 ${node.id} (${node.type}) 输出处理:`, {
        output,
        outputType: typeof output,
        isArray: Array.isArray(output),
        outputMap,
        nodeType: node.type,
      });

      node.data = {
        ...node.data,
        output,
        ...outputMap,
      };
      
      console.log(`[executeNode] 节点 ${node.id} 更新后的 data:`, {
        output: node.data.output,
        model: node.data.model,
        '3d': node.data['3d'],
        url: node.data.url,
      });

      // Store output in context
      if (!context[node.id]) {
        context[node.id] = {};
      }
      context[node.id]['default'] = output;
      Object.keys(outputMap).forEach((key) => {
        context[node.id][key] = outputMap[key];
      });
      if (node.data.outputs) {
        node.data.outputs.forEach((out: any) => {
          context[node.id][out.id] = output;
        });
      }

      results.push({
        nodeId: node.id,
        success: true,
        output,
        outputs: outputMap,
      });
      
      // 自动保存节点输出（如果启用）
      // 注意：对于预览节点，output 可能已经是规范化后的数据（字符串或数组）
      // 对于生成节点，output 可能是数组，需要传递给 autoSaveNodeOutput 处理
      if (options.saveConfig) {
        try {
          // 传递最新的 output 和更新后的 node（包含 outputMap）
          await autoSaveNodeOutput(node, output, outputMap, options.saveConfig, options.workflowId);
        } catch (error) {
          console.error(`[executeWorkflow] 保存节点 ${node.id} (${node.type}) 输出失败:`, error);
        }
      }
      
      // 通知节点执行成功
      options.onNodeComplete?.(node.id, true);
    } catch (error) {
      results.push({
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // 通知节点执行失败
      options.onNodeComplete?.(node.id, false);
    }
  }

  return results;
}

export async function executeNode(
  node: Node,
  nodes: Node[],
  edges: Edge[],
  options: { 
    shouldStop?: () => boolean;
    saveConfig?: { enabled: boolean; useRelativePath: boolean; path: string };
    workflowId?: string;
  } = {}
): Promise<ExecutionResult> {
  // apiService 不再需要全局创建，而是在 resolveNodeOutput 中根据模型动态创建
  try {
    if (options.shouldStop?.()) {
      return {
        nodeId: node.id,
        success: false,
        error: 'Execution stopped',
      };
    }
    const inputs = getNodeInputs(node.id, nodes, edges);
    if (node.data?.skip) {
      const output = node.data?.output ?? inputs.text ?? inputs.image ?? inputs.video ?? inputs.model ?? null;
      return {
        nodeId: node.id,
        success: true,
        output,
        outputs: buildOutputMap(node.type, output),
        skipped: true,
      };
    }
    // 单节点运行前：必填项校验
    const { missing } = validateNodeRequired(node, nodes, edges);
    if (missing.length > 0) {
      return {
        nodeId: node.id,
        success: false,
        error: `节点「${node.data?.label || node.type || node.id}」缺少必填项：${formatMissingRequired(missing)}。请先输入对应的值再运行。`,
      };
    }
    const output = await resolveNodeOutput(node, inputs, null);
    const outputMap = buildOutputMap(node.type, output);
    
    // 更新节点数据
    node.data = {
      ...node.data,
      output,
      ...outputMap,
    };
    
    // 自动保存节点输出（如果提供了 saveConfig）
    if (options.saveConfig) {
      try {
        await autoSaveNodeOutput(node, output, outputMap, options.saveConfig, options.workflowId);
      } catch (error) {
        console.error(`[executeNode] 保存节点 ${node.id} (${node.type}) 输出失败:`, error);
        // 不抛出错误，继续返回结果
      }
    }
    
    return {
      nodeId: node.id,
      success: true,
      output,
      outputs: outputMap,
    };
  } catch (error) {
    return {
      nodeId: node.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
