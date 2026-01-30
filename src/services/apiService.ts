import { APIConfig } from '@/types';
import { getMappedModelName } from '@/config/modelMapping';

export interface APIRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export class APIService {
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  async request<T = any>(request: APIRequest): Promise<T> {
    // 构建 URL，在开发模式下使用代理解决 CORS 问题
    let url = `${this.config.baseURL}${request.endpoint}`;
    
    // 开发模式下，将外部 API 请求通过 Vite 代理
    // 注意：特殊处理只对 api.openai-proxy.org 生效，其他代理和原生 API 直接使用标准格式
    if (import.meta.env.DEV) {
      const baseURL = this.config.baseURL.trim();
      // 只对 api.openai-proxy.org 这个特定代理进行特殊处理
      const isOpenAIProxyOrg = baseURL.includes('api.openai-proxy.org');
      
      if (isOpenAIProxyOrg) {
        // 检查是否是 Google API（/google 后缀或 endpoint 包含 :generateContent）
        const isGoogleAPI = baseURL.includes('/google') || request.endpoint.includes(':generateContent');
        
        if (isGoogleAPI) {
          // 提取路径部分（去掉 https://api.openai-proxy.org/google 或 https://api.openai-proxy.org）
          let basePath = '';
          if (baseURL.includes('/google')) {
            const pathMatch = baseURL.match(/https?:\/\/api\.openai-proxy\.org\/google(.*)/);
            basePath = pathMatch ? pathMatch[1] : '';
          } else {
            // 如果没有 /google 但 endpoint 是 Google API，需要添加 /google
            const pathMatch = baseURL.match(/https?:\/\/api\.openai-proxy\.org(.*)/);
            basePath = pathMatch ? pathMatch[1] : '';
            // 确保使用 /api-proxy-google
          }
          url = `/api-proxy-google${basePath}${request.endpoint}`;
        } else {
          // 提取路径部分（去掉 https://api.openai-proxy.org）
          const pathMatch = baseURL.match(/https?:\/\/api\.openai-proxy\.org(.*)/);
          let basePath = pathMatch ? pathMatch[1] : '';
          
          // 处理 Anthropic API 的特殊情况（仅针对 api.openai-proxy.org）
          // 如果 basePath 是 /anthropic，endpoint 是 /v1/messages，最终 URL 应该是 /api-proxy/anthropic/v1/messages
          // 如果 basePath 是 /v1，endpoint 是 /messages，最终 URL 应该是 /api-proxy/v1/messages
          if (basePath === '/anthropic' && request.endpoint.startsWith('/v1/')) {
            // Anthropic 原生协议：basePath = /anthropic, endpoint = /v1/messages
            url = `/api-proxy${basePath}${request.endpoint}`;
          } else if (basePath === '/v1' && request.endpoint === '/messages') {
            // OpenAI 兼容协议：basePath = /v1, endpoint = /messages
            url = `/api-proxy${basePath}${request.endpoint}`;
          } else if (basePath === '/v1' && request.endpoint.startsWith('/v1/')) {
            // 如果 basePath 是 /v1，而 endpoint 也以 /v1 开头，避免重复
            basePath = '';
            url = `/api-proxy${request.endpoint}`;
          } else {
            // 其他情况正常拼接
            url = `/api-proxy${basePath}${request.endpoint}`;
          }
        }
      }
      // 对于其他代理和原生 API，在开发模式下直接使用原始 URL（不通过代理）
      // 如果需要在开发模式下也使用代理，可以添加通用的代理处理逻辑
      // 但为了兼容性，这里保持直接调用，让浏览器处理 CORS（如果 API 服务器支持）
    }
    
    // 检测是否是 Google API 调用
    const isGoogleAPI = this.config.baseURL.includes('/google') || request.endpoint.includes(':generateContent');
    
    // 检查是否是 FormData（文件上传）
    const isFormData = request.body instanceof FormData;
    
    const headers: Record<string, string> = {
      // FormData 会自动设置 Content-Type（包括 boundary），不需要手动设置
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...request.headers,
    };

    // 检查是否是 Ollama（不需要认证）
    const isOllamaRequest = this.config.baseURL.includes('localhost:11434') ||
                            this.config.baseURL.includes('127.0.0.1:11434');
    
    if (this.config.apiKey && !isOllamaRequest) {
      if (this.config.provider === 'openai') {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      } else if (this.config.provider === 'anthropic') {
        headers['x-api-key'] = this.config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (this.config.provider === 'custom') {
        // 对于 Google API 和方舟 API（Seedream），优先使用 Bearer token 认证
        // 某些代理服务也接受 query parameter，但我们先尝试标准方式
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
    }

    console.log('[APIService] 发起请求:', {
      url,
      method: request.method,
      baseURL: this.config.baseURL,
      endpoint: request.endpoint,
      headers: { ...headers, Authorization: headers.Authorization ? '***' : undefined },
      bodyPreview: request.body ? JSON.stringify(request.body).substring(0, 200) + '...' : undefined,
    });

    let response: Response;
    try {
      // 如果是 FormData，直接传递；否则序列化为 JSON
      const body = request.body instanceof FormData 
        ? request.body 
        : (request.body ? JSON.stringify(request.body) : undefined);
      
      response = await fetch(url, {
        method: request.method,
        headers,
        body,
      });
    } catch (fetchError) {
      // 捕获网络错误（如 ERR_CONNECTION_RESET）
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error('[APIService] 网络请求失败:', {
        url,
        error: errorMessage,
        isGoogleAPI,
      });
      
      // 提供更友好的错误消息
      if (errorMessage.includes('ERR_CONNECTION_RESET') || errorMessage.includes('Failed to fetch')) {
        throw new Error(
          `网络连接失败：无法连接到 API 服务器。\n` +
          `请检查：\n` +
          `1. 网络连接是否正常\n` +
          `2. API 服务器地址是否正确\n` +
          `3. 如果使用代理，请确认代理配置正确\n` +
          `\n原始错误: ${errorMessage}`
        );
      }
      throw new Error(`API 请求失败: ${errorMessage}`);
    }

    if (!response.ok) {
      // 尝试获取详细的错误信息
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorText = await response.text();
        console.error('[APIService] API 错误响应:', {
          status: response.status,
          statusText: response.statusText,
          url,
          errorText,
        });
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            const apiErrorMessage = errorData.error.message || JSON.stringify(errorData.error);
            // 如果是模型不存在的错误，提供更友好的提示
            if (apiErrorMessage.toLowerCase().includes('model not exist') || 
                apiErrorMessage.toLowerCase().includes('model not found') ||
                apiErrorMessage.toLowerCase().includes('invalid model')) {
              errorMessage = `模型不存在：${apiErrorMessage}\n\n` +
                `请检查：\n` +
                `1. 模型名称是否正确（例如：deepseek-chat, deepseek-coder, qwen-turbo 等）\n` +
                `2. 在节点属性中设置正确的模型名称\n` +
                `3. 确认该模型在您的 API 服务中可用`;
            } else {
              errorMessage = apiErrorMessage;
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
      } catch {
        // 如果无法解析响应，使用默认错误信息
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Text Generation (OpenAI/Anthropic/Custom)
  async generateText(prompt: string, options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    context?: string;
    imageInput?: string | string[]; // 支持图像输入（用于视觉模型）
  }): Promise<string> {
    if (this.config.provider === 'openai' || this.config.provider === 'custom') {
      // 使用模型映射配置获取实际模型名称
      const rawModelName = options.model || 'gpt-4';
      const modelName = getMappedModelName(rawModelName, 'text');
      
      // OpenAI 兼容格式（适用于 OpenAI API 和大多数代理服务）
      const messages: any[] = [];
      
      // 添加系统消息（如果有）
      if (options.context) {
        messages.push({ role: 'system', content: options.context });
      }
      
      // 构建用户消息
      const userMessage: any = { role: 'user' };
      
      // 如果有图像输入，使用 Vision API 格式
      if (options.imageInput) {
        const imageInputs = Array.isArray(options.imageInput) ? options.imageInput : [options.imageInput];
        const content: any[] = [{ type: 'text', text: prompt }];
        
        // 添加图像
        for (const imageInput of imageInputs) {
          if (typeof imageInput === 'string') {
            content.push({
              type: 'image_url',
              image_url: {
                url: imageInput.startsWith('data:') ? imageInput : `data:image/png;base64,${imageInput}`,
              },
            });
          }
        }
        
        userMessage.content = content;
      } else {
        // 纯文本消息
        userMessage.content = prompt;
      }
      
      messages.push(userMessage);
      
      const baseURL = this.config.baseURL.trim();
      const lowerModelName = rawModelName.toLowerCase();
      
      // Ollama 使用特殊的端点格式
      if (lowerModelName === 'ollama' || baseURL.includes('localhost:11434') || baseURL.includes('127.0.0.1:11434')) {
        // Ollama API 格式：POST http://localhost:11434/api/chat
        // 使用模型映射配置获取 Ollama 模型名称
        let ollamaModelName = getMappedModelName(rawModelName, 'text');
        // 如果配置中有 modelName，优先使用配置中的
        if ((this.config as any).modelName) {
          ollamaModelName = (this.config as any).modelName;
        }
        const endpoint = '/api/chat';
        const response = await this.request({
          endpoint: endpoint,
          method: 'POST',
          body: {
            model: ollamaModelName,
            messages: messages,
            stream: false,
            options: {
              temperature: options.temperature || 0.7,
              num_predict: options.maxTokens || 1000,
            },
          },
        });
        // Ollama 响应格式：{ message: { content: "..." } }
        return response.message?.content || response.content || '';
      }
      
      // Seedream 文本生成使用方舟 API Chat API 格式
      const isSeedreamTextModel = lowerModelName.includes('seedream-text') || 
                                  lowerModelName.includes('seedream-seed') ||
                                  modelName.includes('doubao-seed');
      
      if (isSeedreamTextModel) {
        // 方舟 API Chat API 格式：POST /api/v3/chat/completions
        const endpoint = '/chat/completions';
        const response = await this.request({
          endpoint: endpoint,
          method: 'POST',
          body: {
            model: modelName,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2000,
            thinking: {
              type: 'disabled', // 默认禁用深度思考
            },
          },
        });
        // 方舟 API 响应格式：{ choices: [{ message: { content: "..." } }] }
        return response.choices?.[0]?.message?.content || '';
      }
      
      // Gemini 文本生成使用 Google GenAI 格式
      if (lowerModelName.includes('gemini') || baseURL.includes('/google')) {
        // 使用 Google GenAI generateContent 格式
        const parts: any[] = [{ text: prompt }];
        
        // 如果有图像输入，添加到 parts
        if (options.imageInput) {
          const imageInputs = Array.isArray(options.imageInput) ? options.imageInput : [options.imageInput];
          for (const imageInput of imageInputs) {
            if (typeof imageInput === 'string') {
              let base64Data: string;
              let mimeType: string = 'image/png';
              
              if (imageInput.startsWith('data:')) {
                const [header, data] = imageInput.split(',');
                base64Data = data;
                const mimeMatch = header.match(/data:([^;]+)/);
                if (mimeMatch) {
                  mimeType = mimeMatch[1];
                }
              } else {
                base64Data = imageInput;
              }
              
              parts.push({
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              });
            }
          }
        }
        
        // 使用模型映射配置获取 Gemini 模型名称
        const geminiModelName = getMappedModelName(rawModelName, 'text');
        
        // 确定端点
        // 特殊处理只对 api.openai-proxy.org 生效，其他代理和原生 Google API 使用标准格式
        let endpoint: string;
        const isOpenAIProxyOrg = baseURL.includes('api.openai-proxy.org');
        
        if (baseURL.includes('/google')) {
          // 如果 baseURL 已经包含 /google（可能是 api.openai-proxy.org/google 或其他代理），使用标准端点
          endpoint = `/v1beta/models/${geminiModelName}:generateContent`;
        } else if (isOpenAIProxyOrg) {
          // 如果使用 api.openai-proxy.org 但没有 /google，使用标准端点
          // 注意：baseURL 转换应该在 workflowExecutor 中处理，这里作为备用
          endpoint = `/v1beta/models/${geminiModelName}:generateContent`;
        } else {
          // 标准 Google GenAI API 或其他代理（使用 OpenAI 兼容格式）
          // 检查 baseURL 是否已包含 /v1，决定使用哪个端点格式
          const hasV1Suffix = baseURL.endsWith('/v1') || baseURL.endsWith('/v1/');
          endpoint = hasV1Suffix 
            ? `/models/${geminiModelName}:generateContent`
            : `/v1beta/models/${geminiModelName}:generateContent`;
        }
        
        const requestBody: any = {
          contents: [{ parts: parts }],
        };
        
        if (options.context) {
          requestBody.systemInstruction = {
            parts: [{ text: options.context }],
          };
        }
        
        const response = await this.request({
          endpoint: endpoint,
          method: 'POST',
          body: requestBody,
        });
        
        // 解析 Google GenAI 响应格式
        if (response.candidates && response.candidates[0] && response.candidates[0].content) {
          const parts = response.candidates[0].content.parts || [];
          const textParts = parts.filter((part: any) => part.text).map((part: any) => part.text);
          return textParts.join('\n');
        }
        
        throw new Error('Gemini API 响应格式错误');
      }
      
      // 标准 OpenAI 兼容格式
      // 检查 baseURL 是否已包含 /v1，避免重复
      const hasV1Suffix = baseURL.endsWith('/v1') || baseURL.endsWith('/v1/');
      const endpoint = hasV1Suffix ? '/chat/completions' : '/v1/chat/completions';
      
      const response = await this.request({
        endpoint: endpoint,
        method: 'POST',
        body: {
          model: modelName,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000,
        },
      });
      return response.choices[0]?.message?.content || '';
    } else if (this.config.provider === 'anthropic') {
      // 使用模型映射配置获取 Claude 模型名称
      const rawModelName = options.model || 'claude';
      const claudeModelName = getMappedModelName(rawModelName, 'text');
      
      // 构建消息（支持图像输入）
      const messages: any[] = [];
      
      // 如果有图像输入，使用多模态格式
      if (options.imageInput) {
        const imageInputs = Array.isArray(options.imageInput) ? options.imageInput : [options.imageInput];
        const content: any[] = [{ type: 'text', text: prompt }];
        
        for (const imageInput of imageInputs) {
          if (typeof imageInput === 'string') {
            let base64Data: string;
            let mimeType: string = 'image/png';
            
            if (imageInput.startsWith('data:')) {
              const [header, data] = imageInput.split(',');
              base64Data = data;
              const mimeMatch = header.match(/data:([^;]+)/);
              if (mimeMatch) {
                mimeType = mimeMatch[1];
              }
            } else {
              base64Data = imageInput;
            }
            
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data,
              },
            });
          }
        }
        
        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: 'user', content: prompt });
      }
      
      // Anthropic API 的 endpoint 是 /v1/messages
      // 特殊处理只对 api.openai-proxy.org 生效，其他代理和原生 Anthropic API 使用标准格式
      const baseURL = this.config.baseURL.trim();
      const isOpenAIProxyOrg = baseURL.includes('api.openai-proxy.org');
      
      let endpoint: string;
      if (isOpenAIProxyOrg) {
        // 只对 api.openai-proxy.org 进行特殊处理
        // 检查是否使用 Anthropic 原生协议（包含 /anthropic 后缀）
        if (baseURL.includes('/anthropic')) {
          // Anthropic 原生协议：baseURL 包含 /anthropic，endpoint 是 /v1/messages
          endpoint = '/v1/messages';
        } else {
          // OpenAI 兼容协议：检查 baseURL 是否以 /v1 结尾
          const hasV1Suffix = baseURL.endsWith('/v1') || baseURL.endsWith('/v1/');
          endpoint = hasV1Suffix ? '/messages' : '/v1/messages';
        }
      } else {
        // 对于其他代理和原生 Anthropic API（如 api.anthropic.com），使用标准格式
        // 标准 Anthropic API 格式：endpoint 是 /v1/messages
        endpoint = '/v1/messages';
      }
      
      console.log('[Claude API] 请求配置:', {
        baseURL: this.config.baseURL,
        endpoint: endpoint,
        isAnthropicProtocol: baseURL.includes('/anthropic'),
        isOpenAICompatible: baseURL.includes('/v1') && !baseURL.includes('/anthropic'),
        model: claudeModelName,
      });
      
      const response = await this.request({
        endpoint: endpoint,
        method: 'POST',
        body: {
          model: claudeModelName,
          max_tokens: options.maxTokens || 1000,
          messages: messages,
          ...(options.context && { system: options.context }),
        },
      });
      return response.content[0]?.text || '';
    }
    throw new Error('Unsupported provider for text generation');
  }

  // Image Generation (OpenAI DALL-E / Google GenAI / Custom)
  async generateImage(prompt: string, options: {
    model?: string;
    size?: string;
    n?: number;
    aspectRatio?: string;
    quality?: string;
    imageInput?: string | string[]; // 支持单张或多张图像输入
  }): Promise<string[]> {
    const baseURL = this.config.baseURL.trim();
    
    // 使用模型映射配置获取图像模型名称
    const rawModelName = options.model || 'nanobanana';
    const mappedModelName = getMappedModelName(rawModelName, 'image');
    
    // 检测是否是 Nano Banana 模型（需要使用原生 Gemini 协议）
    const modelName = rawModelName.toLowerCase();
    const isNanoBananaModel = modelName === 'nanobanana' || modelName === 'nanobananapro';
    const geminiModelName = isNanoBananaModel ? mappedModelName : null;
    
    // 检测是否是 Seedream 模型（方舟 API）
    const isSeedreamModel = modelName.includes('seedream') || 
                            mappedModelName.includes('seedream') ||
                            mappedModelName.includes('doubao-seedream');
    
    // 检测是否使用 Google GenAI API（基于 baseURL 或模型名称）
    // Nano Banana 模型必须使用原生 Gemini 协议
    const isGoogleGenAI = isNanoBananaModel || 
                          baseURL.includes('generativelanguage.googleapis.com') || 
                          baseURL.includes('genai.googleapis.com') ||
                          baseURL.includes('/google') ||
                          (this.config.provider === 'custom' && (
                            options.model?.includes('gemini') ||
                            options.model?.includes('nanobanana')
                          ));
    
    // OpenAI 兼容格式的模型（非 Nano Banana，非 Seedream）
    const openAICompatibleModels = ['gptimage'];
    const shouldUseOpenAIFormat = this.config.provider === 'openai' || 
                                   (!isGoogleGenAI && !isSeedreamModel && options.model && openAICompatibleModels.some(m => options.model?.toLowerCase().includes(m.toLowerCase())));
    
    // Seedream 模型使用方舟 API
    if (isSeedreamModel) {
      // 方舟 API 端点：/api/v3/images/generations
      // 检查 baseURL 是否已包含 /api/v3
      let endpoint: string;
      if (baseURL.endsWith('/api/v3') || baseURL.endsWith('/api/v3/')) {
        endpoint = '/images/generations';
      } else if (baseURL.endsWith('/v3') || baseURL.endsWith('/v3/')) {
        endpoint = '/images/generations';
      } else {
        endpoint = '/api/v3/images/generations';
      }
      
      // 构建请求体（方舟 API 格式）
      const requestBody: any = {
        model: mappedModelName, // 使用映射后的模型名称，如 doubao-seedream-4-5-251128
        prompt,
        response_format: 'url', // 默认返回 URL，也可以使用 'b64_json'
        watermark: false, // 默认不添加水印
      };
      
      // 添加图像输入（支持单张或多张）
      if (options.imageInput) {
        const imageInputs = Array.isArray(options.imageInput) ? options.imageInput : [options.imageInput];
        // 方舟 API 支持最多 14 张参考图
        const imageInputsToUse = imageInputs.slice(0, 14);
        
        // 处理图像输入：如果是 base64，需要转换为 URL 或保持 base64
        // 方舟 API 支持 image_url 格式
        const imageUrls: string[] = [];
        for (const imageInput of imageInputsToUse) {
          if (typeof imageInput === 'string') {
            if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
              // 已经是 URL，直接使用
              imageUrls.push(imageInput);
            } else if (imageInput.startsWith('data:')) {
              // base64 data URL，方舟 API 也支持
              imageUrls.push(imageInput);
            } else {
              // 纯 base64 字符串，转换为 data URL
              imageUrls.push(`data:image/png;base64,${imageInput}`);
            }
          }
        }
        
        if (imageUrls.length === 1) {
          requestBody.image = imageUrls[0];
        } else if (imageUrls.length > 1) {
          requestBody.image = imageUrls;
        }
      }
      
      // 检测 Seedream 模型版本
      const isSeedream45 = mappedModelName.includes('4-5') || mappedModelName.includes('4.5');
      const _isSeedream40 = mappedModelName.includes('4-0') || mappedModelName.includes('4.0');
      void _isSeedream40;
      // 添加尺寸参数
      if (options.size) {
        // 支持 '1K', '2K', '4K' 或像素值如 '2048x2048'
        let sizeValue = options.size;
        // Seedream 4.5 不支持 '1K'，自动转换为 '2K'
        if (isSeedream45 && sizeValue === '1K') {
          console.warn('[generateImage] Seedream 4.5 不支持 1K，自动转换为 2K');
          sizeValue = '2K';
        }
        requestBody.size = sizeValue;
      } else if (options.aspectRatio) {
        // 根据宽高比映射到尺寸（Seedream 4.5 支持自定义宽高比）
        // 默认使用 2K 分辨率
        const aspectRatioToSize: Record<string, string> = {
          '1:1': '2048x2048',
          '16:9': '2048x1152',
          '9:16': '1152x2048',
          '4:3': '2048x1536',
          '3:4': '1536x2048',
        };
        requestBody.size = aspectRatioToSize[options.aspectRatio] || '2048x2048';
      } else {
        // 默认使用 2K
        requestBody.size = '2K';
      }
      
      // 添加画质参数（如果提供）
      if (options.quality) {
        // Seedream 4.0 支持 '1K', '2K', '4K'
        // Seedream 4.5 只支持 '2K', '4K'（不支持 '1K'）
        const qualityMap: Record<string, string> = {
          '1K': isSeedream45 ? '2K' : '1K', // Seedream 4.5 将 1K 转换为 2K
          '2K': '2K',
          '4K': '4K',
          '标准': '2K',
          'standard': '2K',
          'hd': '2K',
        };
        const mappedQuality = qualityMap[options.quality] || options.quality;
        // 如果 mappedQuality 是 '1K' 且是 Seedream 4.5，转换为 '2K'
        const finalQuality = (isSeedream45 && mappedQuality === '1K') ? '2K' : mappedQuality;
        // 如果 size 是 '2K' 格式，quality 会覆盖它
        if (finalQuality === '1K' || finalQuality === '2K' || finalQuality === '4K') {
          requestBody.size = finalQuality;
          if (isSeedream45 && finalQuality === '1K') {
            console.warn('[generateImage] Seedream 4.5 不支持 1K，自动转换为 2K');
            requestBody.size = '2K';
          }
        }
      }
      
      // 组图生成支持（如果需要）
      // sequential_image_generation: 'auto' 或 'disabled'
      // sequential_image_generation_options: { max_images: number }
      // 这里暂时不启用，如果需要可以在节点属性中添加
      
      console.log('[generateImage] Seedream (方舟 API) 格式请求:', { 
        endpoint, 
        model: requestBody.model,
        prompt: requestBody.prompt.substring(0, 50) + '...',
        size: requestBody.size,
        hasImageInput: !!requestBody.image,
        imageInputCount: Array.isArray(requestBody.image) ? requestBody.image.length : (requestBody.image ? 1 : 0),
        response_format: requestBody.response_format,
        watermark: requestBody.watermark,
      });
      
      const response = await this.request({
        endpoint,
        method: 'POST',
        body: requestBody,
      });
      
      // 处理响应（方舟 API 响应格式与 OpenAI 类似）
      if (response.data && Array.isArray(response.data)) {
        return response.data.map((item: any) => {
          // 可能返回 url 或 b64_json
          if (item.url) {
            return item.url;
          } else if (item.b64_json) {
            return `data:image/png;base64,${item.b64_json}`;
          }
          return '';
        }).filter((url: string) => url);
      }
      
      throw new Error('图像生成失败：响应格式错误');
    }
    
    if (shouldUseOpenAIFormat || (this.config.provider === 'openai' || (this.config.provider === 'custom' && !isGoogleGenAI && !isSeedreamModel))) {
      // OpenAI 兼容格式（适用于大多数 API 代理）
      // 注意：标准 OpenAI API 不支持图像输入，如果有图像输入，需要提示用户
      if (options.imageInput) {
        throw new Error('当前 API 格式不支持图像输入。如需使用图像输入功能，请使用 Google GenAI API 或支持图像输入的 API 端点。');
      }
      
      // 检查 baseURL 是否已包含 /v1
      const hasV1Suffix = baseURL.endsWith('/v1');
      const endpoint = hasV1Suffix ? '/images/generations' : '/v1/images/generations';
      
      // 构建请求体
      const requestBody: any = {
        model: options.model || 'dall-e-3',
        prompt,
        n: options.n || 1,
      };
      
      // 添加尺寸参数
      if (options.size) {
        requestBody.size = options.size;
      } else if (options.aspectRatio) {
        // 根据宽高比映射到尺寸
        const aspectRatioToSize: Record<string, string> = {
          '1:1': '1024x1024',
          '16:9': '1792x1024',
          '9:16': '1024x1792',
          '4:3': '1024x768',
          '3:4': '768x1024',
        };
        requestBody.size = aspectRatioToSize[options.aspectRatio] || '1024x1024';
      } else {
        requestBody.size = '1024x1024';
      }
      
      // 注意：OpenAI DALL-E API 只支持 'standard' 和 'hd' 两种画质
      // 如果 quality 参数存在，尝试映射
      if (options.quality) {
        // 只对 dall-e-3 模型支持 quality 参数
        if (requestBody.model === 'dall-e-3' || requestBody.model?.includes('dall-e-3')) {
          requestBody.quality = options.quality === '2K' || options.quality === 'hd' ? 'hd' : 'standard';
        }
        // 对于其他模型，quality 参数可能不被支持，暂时忽略
      }
      
      console.log('[generateImage] OpenAI 格式请求:', { 
        endpoint, 
        model: requestBody.model,
        prompt: requestBody.prompt.substring(0, 50) + '...',
        size: requestBody.size,
        n: requestBody.n,
        quality: requestBody.quality,
      });
      
      const response = await this.request({
        endpoint,
        method: 'POST',
        body: requestBody,
      });
      
      // 处理响应
      if (response.data && Array.isArray(response.data)) {
        return response.data.map((item: any) => {
          // 可能返回 url 或 b64_json
          if (item.url) {
            return item.url;
          } else if (item.b64_json) {
            return `data:image/png;base64,${item.b64_json}`;
          }
          return '';
        }).filter((url: string) => url);
      }
      
      throw new Error('图像生成失败：响应格式错误');
    } else if (isGoogleGenAI) {
      // Google GenAI API 格式
      // 根据文档：
      // - 纯文本生成：contents 可以是字符串或 [{ parts: [{ text: "..." }] }]
      // - 有图像输入：contents 是 [{ parts: [{ text: "..." }, { inlineData: {...} }] }]
      
      // 确定模型名称（如果使用 Nano Banana 模型，使用映射后的 Gemini 模型名）
      // 否则使用映射后的模型名称
      const modelName = geminiModelName || mappedModelName || getMappedModelName(options.model || 'nanobanana', 'image');
      
      // 构建 contents
      let contents: any;
      
      if (options.imageInput) {
        // 有图像输入：使用 parts 数组格式
        const parts: any[] = [{ text: prompt }];
        
        // 处理图像输入（支持单张或多张，最多14张）
        const imageInputs = Array.isArray(options.imageInput) ? options.imageInput : [options.imageInput];
        const imageInputsToUse = imageInputs.slice(0, 14);
        
        console.log('[generateImage] 处理图像输入:', {
          imageInputType: typeof options.imageInput,
          isArray: Array.isArray(options.imageInput),
          imageInputsCount: imageInputs.length,
          imageInputsToUseCount: imageInputsToUse.length,
        });
        
        for (const imageInput of imageInputsToUse) {
          if (typeof imageInput === 'string') {
            let base64Data: string;
            let mimeType: string = 'image/png';
            
            if (imageInput.startsWith('data:')) {
              const [header, data] = imageInput.split(',');
              base64Data = data;
              const mimeMatch = header.match(/data:([^;]+)/);
              if (mimeMatch) {
                mimeType = mimeMatch[1];
              }
            } else {
              base64Data = imageInput;
            }
            
            parts.push({
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            });
          } else {
            console.warn('[generateImage] 跳过非字符串类型的图像输入:', typeof imageInput);
          }
        }
        
        console.log('[generateImage] 构建的 parts 数量:', parts.length, '(包含', parts.length - 1, '张图像)');
        
        contents = [{ parts: parts }];
      } else {
        // 纯文本生成：根据文档，可以直接使用字符串或数组格式
        // 为了兼容性，使用数组格式
        contents = [{ parts: [{ text: prompt }] }];
      }
      
      // 构建请求体（Google GenAI API 格式）
      const requestBody: any = {
        contents: contents,
      };
      
      // 添加 generationConfig
      const generationConfig: any = {
        responseModalities: ['TEXT', 'IMAGE'],
      };
      
      // 添加图像配置
      if (options.aspectRatio || options.quality) {
        generationConfig.imageConfig = {};
        if (options.aspectRatio) {
          generationConfig.imageConfig.aspectRatio = options.aspectRatio;
        }
        // 只有 Gemini 3 Pro Image Preview 支持 imageSize 参数
        // Gemini 2.5 Flash Image 不支持 imageSize，只支持 aspectRatio
        if (options.quality && modelName === 'gemini-3-pro-image-preview') {
          const qualityMap: Record<string, string> = {
            '1K': '1K',
            '2K': '2K',
            '4K': '4K',
            '标准': '1K',
            'standard': '1K',
          };
          generationConfig.imageConfig.imageSize = qualityMap[options.quality] || options.quality;
        }
      }
      
      requestBody.generationConfig = generationConfig;
      
      // 确定端点
      // 此逻辑对所有代理和原生 Google API 都适用，使用标准格式
      let endpoint: string;
      
      // 检查 baseURL 格式（适用于所有代理，包括 api.openai-proxy.org 和其他代理）
      if (baseURL.includes('/google')) {
        // 使用 /google 后缀的情况（可能是 api.openai-proxy.org/google 或其他代理）
        if (baseURL.endsWith('/google')) {
          endpoint = `/v1beta/models/${modelName}:generateContent`;
        } else if (baseURL.endsWith('/google/')) {
          endpoint = `v1beta/models/${modelName}:generateContent`;
        } else {
          endpoint = `/v1beta/models/${modelName}:generateContent`;
        }
      } else {
        // 标准 Google API 格式（原生 API 或其他代理）
        const hasV1Suffix = baseURL.endsWith('/v1');
        endpoint = hasV1Suffix 
          ? `/models/${modelName}:generateContent`
          : `/v1beta/models/${modelName}:generateContent`;
      }
      
      // 计算 parts 数量用于日志
      const partsCount = options.imageInput 
        ? (Array.isArray(options.imageInput) ? options.imageInput.length : 1) + 1 // +1 for text prompt
        : 1; // only text prompt
      
      console.log('[generateImage] Google GenAI 格式请求:', {
        baseURL,
        endpoint,
        model: modelName,
        hasImageInput: !!options.imageInput,
        imageInputCount: Array.isArray(options.imageInput) ? options.imageInput.length : (options.imageInput ? 1 : 0),
        partsCount: partsCount,
        generationConfig,
        promptPreview: prompt.substring(0, 50) + '...',
      });
      
      // 尝试多种端点格式
      const endpointsToTry = [
        endpoint,
        // 备用格式：使用 chat/completions 样式（某些代理支持）
        `/v1/chat/completions`,
      ];
      
      let lastError: Error | null = null;
      
      for (const tryEndpoint of endpointsToTry) {
        try {
          let requestBodyToUse = requestBody;
          
          // 如果是 chat/completions 端点，转换为 OpenAI 格式
          if (tryEndpoint.includes('chat/completions')) {
            // 构建 OpenAI Vision 格式的消息
            const content: any[] = [{ type: 'text', text: prompt }];
            
            // 添加图像
            if (options.imageInput) {
              const imageInputs = Array.isArray(options.imageInput) ? options.imageInput : [options.imageInput];
              for (const imageInput of imageInputs.slice(0, 14)) {
                if (typeof imageInput === 'string') {
                  content.push({
                    type: 'image_url',
                    image_url: {
                      url: imageInput.startsWith('data:') ? imageInput : `data:image/png;base64,${imageInput}`,
                    },
                  });
                }
              }
            }
            
            requestBodyToUse = {
              model: modelName,
              messages: [{ role: 'user', content }],
              max_tokens: 4096,
            };
            
            console.log('[generateImage] 尝试 OpenAI Chat Completions 格式:', {
              endpoint: tryEndpoint,
              model: modelName,
              messageContentTypes: content.map(c => c.type),
            });
          }
          
          const response = await this.request({
            endpoint: tryEndpoint,
            method: 'POST',
            body: requestBodyToUse,
          });
          
          // 根据响应格式解析
          if (response.candidates && Array.isArray(response.candidates)) {
            // Google GenAI 响应格式
            // 遍历所有 candidates，提取所有图像
            const images: string[] = [];
            for (const candidate of response.candidates) {
              if (candidate.content && candidate.content.parts) {
                const responseParts = candidate.content.parts || [];
                for (const part of responseParts) {
                  if (part.inlineData && part.inlineData.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    images.push(`data:${mimeType};base64,${part.inlineData.data}`);
                  }
                }
              }
            }
            
            if (images.length > 0) {
              console.log(`[generateImage] 成功提取 ${images.length} 张图像`);
              return images;
            }
          } else if (response.choices && response.choices[0]) {
            // OpenAI Chat Completions 响应格式
            const choice = response.choices[0];
            if (choice.message && choice.message.content) {
              // 某些模型返回 base64 图像数据在 content 中
              const content = choice.message.content;
              if (typeof content === 'string' && content.startsWith('data:image')) {
                return [content];
              }
              // 尝试从 JSON 响应中提取图像
              try {
                const parsed = JSON.parse(content);
                if (parsed.image || parsed.images || parsed.url || parsed.data) {
                  const imageData = parsed.image || parsed.images?.[0] || parsed.url || parsed.data;
                  if (imageData) {
                    return [imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`];
                  }
                }
              } catch {
                // 不是 JSON，继续
              }
            }
          } else if (response.data && Array.isArray(response.data)) {
            // OpenAI Image Generation 响应格式
            return response.data.map((item: any) => {
              if (item.url) return item.url;
              if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
              return '';
            }).filter((url: string) => url);
          }
          
          // 如果到这里还没返回，说明响应格式不匹配，继续尝试下一个端点
          console.warn('[generateImage] 响应格式不匹配，尝试下一个端点');
          lastError = new Error('响应格式不匹配');
          
        } catch (error) {
          console.warn(`[generateImage] 端点 ${tryEndpoint} 失败:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
          // 继续尝试下一个端点
        }
      }
      
      // 所有端点都失败了
      throw lastError || new Error('图像生成失败：所有端点都无法访问');
    }
    
    throw new Error('Unsupported provider for image generation');
  }

  // Video Generation (Seedance/方舟 API)
  // 根据图片数量选择模式：0=文生视频，1=图生视频-首帧，2=图生视频-首尾帧，3-4=图生视频-参考图
  // 所有模型自适应图片：base64 先上传为 URL 再请求；Pro Fast 仅支持首帧，多图时只取第一张
  async generateVideo(prompt: string, options: {
    model?: string;
    imageInput?: string | string[]; // 首帧/首尾帧/参考图（数量决定模式）
    ratio?: string; // 宽高比
    duration?: number; // 时长（秒）
    resolution?: string; // 分辨率
    generateAudio?: boolean; // 是否生成音频（仅 Seedance 1.5 pro）
    watermark?: boolean; // 是否包含水印
    seed?: number; // 种子值
    cameraFixed?: boolean; // 是否固定摄像头
    returnLastFrame?: boolean; // 是否返回尾帧
    serviceTier?: 'default' | 'flex'; // 服务层级
  }): Promise<string> {
    const rawModelName = options.model || 'seedream-video';
    const modelName = getMappedModelName(rawModelName, 'video');

    // 图片统一为 API 接受的格式：HTTP URL 原样使用，否则使用 base64（data:image/<格式>;base64,<编码>，格式小写）
    const toImageUrl = (img: string): string => {
      if (img.startsWith('http://') || img.startsWith('https://')) return img;
      if (img.startsWith('data:image/')) return img;
      return `data:image/png;base64,${img}`;
    };

    // Seedance 1.0 Lite T2V 仅支持文生视频，带图会触发 flf2v 报错
    const isT2vLiteOnly = /lite-t2v|doubao-seedance-1-0-lite-t2v/i.test(modelName);
    // Seedance 1.0 Pro Fast 仅支持文生视频 + 图生视频-首帧（1 张），不支持首尾帧/参考图
    const isProFastOnly = /1-0-pro-fast|seedance-1-0-pro-fast/i.test(modelName);
    // 仅 Seedance 1.0 Lite I2V 支持参考图（3-4 张）；1.5 pro / 1.0 pro 不支持参考图，3-4 张时按首尾帧处理（取前 2 张）
    const isLiteI2v = /lite-i2v|doubao-seedance-1-0-lite-i2v/i.test(modelName);

    let imageInputs: string[] = isT2vLiteOnly
      ? []
      : options.imageInput
        ? Array.isArray(options.imageInput)
          ? options.imageInput.filter((x): x is string => typeof x === 'string')
          : [options.imageInput]
        : [];

    if (isProFastOnly && imageInputs.length > 1) imageInputs = imageInputs.slice(0, 1);
    else if (!isLiteI2v && imageInputs.length >= 3) imageInputs = imageInputs.slice(0, 2); // 非 Lite I2V 不支持参考图，按首尾帧取前 2 张
    const imageCount = imageInputs.length;

    const imageUrls = imageCount > 0 ? imageInputs.map(toImageUrl) : [];

    // 构建 content：先文本，再按图片数量决定角色
    const content: any[] = [{ type: 'text', text: prompt }];

    if (imageCount === 0) {
      // 文生视频：仅文本（或 T2V Lite 强制仅文本）
    } else if (imageCount === 1) {
      // 图生视频-首帧：1 张图，无 role，直接传 base64 或 URL
      content.push({
        type: 'image_url',
        image_url: { url: imageUrls[0] },
      });
    } else if (imageCount === 2) {
      // 图生视频-首尾帧：2 张图，first_frame + last_frame
      content.push({
        type: 'image_url',
        image_url: { url: imageUrls[0] },
        role: 'first_frame',
      });
      content.push({
        type: 'image_url',
        image_url: { url: imageUrls[1] },
        role: 'last_frame',
      });
    } else if (imageCount >= 3 && imageCount <= 4) {
      // 图生视频-参考图：3-4 张图，均为 reference_image
      for (let i = 0; i < imageCount; i++) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrls[i] },
          role: 'reference_image',
        });
      }
    } else if (imageCount > 4) {
      // 文档仅支持 1-4 张参考图，多余取前 4 张
      for (let i = 0; i < 4; i++) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrls[i] },
          role: 'reference_image',
        });
      }
    }
    
    // 创建视频生成任务
    const endpoint = '/contents/generations/tasks';
    const requestBody: any = {
      model: modelName,
      content: content,
    };
    
    // ratio：参考图场景、Seedance 1.0 系列文生视频均不支持 adaptive，改为 16:9
    const is10Series = !/1-5-pro|seedance-1-5-pro/i.test(modelName);
    const isRefImageMode = isLiteI2v && imageCount >= 3;
    const noAdaptive = (imageCount === 0 && is10Series) || isRefImageMode;
    let ratioValue = options.ratio;
    if (ratioValue === 'adaptive' && noAdaptive) ratioValue = '16:9';
    if (ratioValue && !isT2vLiteOnly) requestBody.ratio = ratioValue;
    if (options.duration) requestBody.duration = options.duration;
    if (options.resolution) requestBody.resolution = options.resolution;
    // generate_audio 仅 Seedance 1.5 Pro 支持，其他模型传此参数会报错，故仅 1.5 Pro 时写入
    const supportsGenerateAudio = /1-5-pro|seedance-1-5-pro/i.test(modelName);
    if (supportsGenerateAudio && options.generateAudio !== undefined) requestBody.generate_audio = options.generateAudio;
    if (options.watermark !== undefined) requestBody.watermark = options.watermark;
    if (options.seed !== undefined) requestBody.seed = options.seed;
    if (options.cameraFixed !== undefined) requestBody.camera_fixed = options.cameraFixed;
    if (options.returnLastFrame !== undefined) requestBody.return_last_frame = options.returnLastFrame;
    if (options.serviceTier) requestBody.service_tier = options.serviceTier;
    
    const createResponse = await this.request({
      endpoint: endpoint,
      method: 'POST',
      body: requestBody,
    });
    
    const taskId = createResponse.id;
    if (!taskId) {
      throw new Error('创建视频生成任务失败：未返回任务 ID');
    }
    
    // 轮询查询任务状态
    const maxAttempts = 120; // 最多轮询 120 次（20分钟，每次10秒）
    const pollInterval = 10000; // 10秒
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const getEndpoint = `/contents/generations/tasks/${taskId}`;
      const statusResponse = await this.request({
        endpoint: getEndpoint,
        method: 'GET',
      });
      
      const status = statusResponse.status;
      
      if (status === 'succeeded') {
        // 任务成功，返回视频 URL
        const videoUrl = statusResponse.content?.video_url;
        if (!videoUrl) {
          throw new Error('视频生成成功，但未返回视频 URL');
        }
        return videoUrl;
      } else if (status === 'failed') {
        const error = statusResponse.error;
        throw new Error(`视频生成失败：${error?.message || error?.code || '未知错误'}`);
      } else if (status === 'expired') {
        throw new Error('视频生成任务已过期');
      }
      // 继续轮询（queued, running 状态）
    }
    
    throw new Error('视频生成超时，请稍后手动查询任务状态');
  }

  // 3D Generation (Seedream/方舟 API)
  /**
   * 上传文件到方舟 API 并获取文件 URL
   * 根据文档：https://www.volcengine.com/docs/82379/1870405
   */
  async uploadFile(fileData: string | Blob, fileName?: string): Promise<string> {
    // 如果已经是 URL，直接返回
    if (typeof fileData === 'string' && (fileData.startsWith('http://') || fileData.startsWith('https://'))) {
      return fileData;
    }
    
    // 准备文件数据
    let blob: Blob;
    if (typeof fileData === 'string') {
      // 如果是 data URL，转换为 Blob
      if (fileData.startsWith('data:')) {
        const response = await fetch(fileData);
        blob = await response.blob();
      } else {
        // 假设是 base64 字符串
        const byteCharacters = atob(fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'image/png' });
      }
    } else {
      blob = fileData;
    }
    
    // 上传文件到方舟 API
    const endpoint = '/files';
    const formData = new FormData();
    formData.append('file', blob, fileName || 'image.png');
    formData.append('purpose', 'user_data'); // 方舟 Files API 要求 purpose 为 user_data
    
    console.log('[uploadFile] 上传文件到方舟 API:', {
      endpoint,
      fileName: fileName || 'image.png',
      fileSize: blob.size,
      fileType: blob.type,
    });
    
    const uploadResponse = await this.request<{ id: string; url?: string; object?: string; bytes?: number; created_at?: number; filename?: string; purpose?: string; status?: string; status_details?: string }>({
      endpoint: endpoint,
      method: 'POST',
      body: formData,
      headers: {
        // FormData 会自动设置 Content-Type，不需要手动设置
      },
    });
    
    console.log('[uploadFile] 文件上传响应:', uploadResponse);
    
    // 根据文档，上传后需要等待文件处理完成，然后获取文件 URL
    // 文件 URL 格式通常是：https://ark-project.tos-cn-beijing.volces.com/doc_image/{filename}
    // 但实际应该从响应中获取，或者通过文件 ID 查询
    
    // 如果响应中包含 URL，直接返回；否则根据 id/filename 构建
    if (uploadResponse.id) {
      if (uploadResponse.url && (uploadResponse.url.startsWith('http://') || uploadResponse.url.startsWith('https://'))) {
        console.log('[uploadFile] 使用响应中的 URL:', uploadResponse.url);
        return uploadResponse.url;
      }
      const fileUrl = `https://ark-project.tos-cn-beijing.volces.com/doc_image/${uploadResponse.filename || uploadResponse.id}`;
      console.log('[uploadFile] 构建的文件 URL:', fileUrl);
      return fileUrl;
    }
    
    throw new Error('文件上传失败：未返回文件 ID');
  }

  async generate3D(imageInput: string, options: {
    model?: string;
    prompt?: string; // 可选提示词（用于参数设置）
    subdivisionLevel?: 'low' | 'medium' | 'high'; // 细分级别
    fileFormat?: 'glb' | 'obj' | 'usd' | 'usdz'; // 文件格式
  }): Promise<string> {
    const rawModelName = options.model || 'seedream-3d';
    const modelName = getMappedModelName(rawModelName, '3d');
    
    // 处理图像输入
    // 根据文档，image_url 的 url 字段支持：
    // 1. HTTP/HTTPS URL（推荐）
    // 2. data URL（base64编码的图片数据）
    // 对于本地文件，我们优先尝试上传获取 URL，如果上传失败则使用 data URL
    let imageUrl: string;
    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      // 已经是 URL，直接使用
      imageUrl = imageInput;
      console.log('[generate3D] 使用已有的 HTTP URL:', imageUrl.substring(0, 100) + '...');
    } else {
      // 本地文件（data URL 或 base64）
      // 根据文档，方舟 API 支持 data URL，所以我们可以直接使用
      // 但为了更好的性能和可靠性，可以尝试上传文件获取 URL（可选）
      // 目前先使用 data URL，如果后续需要可以启用上传功能
      if (imageInput.startsWith('data:')) {
        imageUrl = imageInput;
        console.log('[generate3D] 使用 data URL（长度:', imageUrl.length, '字符）');
      } else {
        imageUrl = `data:image/png;base64,${imageInput}`;
        console.log('[generate3D] 将 base64 转换为 data URL（长度:', imageUrl.length, '字符）');
      }
      
      // 可选：如果 data URL 太大（>1MB），尝试上传获取 URL
      // 注意：方舟 API 的文件上传可能需要额外的配置，暂时先使用 data URL
      // if (imageUrl.length > 1024 * 1024) {
      //   try {
      //     console.log('[generate3D] data URL 较大，尝试上传到方舟 API...');
      //     imageUrl = await this.uploadFile(imageInput);
      //     console.log('[generate3D] 文件上传成功，使用 URL:', imageUrl);
      //   } catch (uploadError) {
      //     console.warn('[generate3D] 文件上传失败，继续使用 data URL:', uploadError);
      //   }
      // }
    }
    
    // 构建 content 数组：文档要求先图片信息，再文本参数（选填）
    const content: any[] = [
      {
        type: 'image_url',
        image_url: { url: imageUrl },
      },
    ];
    
    // 添加参数文本（选填）：文档默认 subdivisionlevel=medium, fileformat=glb
    const params: string[] = [];
    params.push(`--subdivisionlevel ${options.subdivisionLevel || 'medium'}`);
    params.push(`--fileformat ${options.fileFormat || 'glb'}`);
    if (options.prompt && options.prompt.trim()) {
      params.push(options.prompt.trim());
    }
    content.push({ type: 'text', text: params.join(' ') });
    
    // 创建3D生成任务
    const endpoint = '/contents/generations/tasks';
    const requestBody = {
      model: modelName,
      content: content,
    };
    
    console.log('[generate3D] 创建3D生成任务请求:', {
      endpoint,
      model: modelName,
      contentLength: content.length,
      content: content.map(c => ({
        type: c.type,
        text: c.text?.substring(0, 100),
        image_url: c.image_url ? '...' : undefined,
      })),
    });
    
    const createResponse = await this.request({
      endpoint: endpoint,
      method: 'POST',
      body: requestBody,
    });
    
    console.log('[generate3D] 创建任务响应:', {
      id: createResponse.id,
      status: createResponse.status,
      response: createResponse,
    });
    
    const taskId = createResponse.id;
    if (!taskId) {
      throw new Error('创建3D生成任务失败：未返回任务 ID');
    }
    
    // 轮询查询任务状态
    const maxAttempts = 60; // 最多轮询 60 次（10分钟，每次10秒）
    const pollInterval = 10000; // 10秒
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const getEndpoint = `/contents/generations/tasks/${taskId}`;
      const statusResponse = await this.request({
        endpoint: getEndpoint,
        method: 'GET',
      });
      
      const status = statusResponse.status;
      
      console.log(`[generate3D] 轮询任务状态 (尝试 ${attempt + 1}/${maxAttempts}):`, {
        taskId,
        status,
        content: statusResponse.content,
        error: statusResponse.error,
      });
      
      if (status === 'succeeded') {
        // 任务成功，返回3D资源 URL（content.file_url 为压缩包，内含 pbr/ 与 rgb/ 下的 GLB）
        const fileUrl = statusResponse.content?.file_url;
        console.log('[generate3D] 任务成功，解析响应:', {
          content: statusResponse.content,
          file_url: fileUrl,
          fullResponse: statusResponse,
        });
        
        if (!fileUrl) {
          console.error('[generate3D] 响应中没有 file_url 字段:', statusResponse);
          throw new Error('3D生成成功，但未返回文件 URL。响应内容: ' + JSON.stringify(statusResponse.content));
        }
        return fileUrl;
      } else if (status === 'failed') {
        const error = statusResponse.error;
        throw new Error(`3D生成失败：${error?.message || error?.code || '未知错误'}`);
      } else if (status === 'expired') {
        throw new Error('3D生成任务已过期');
      }
      // 继续轮询（queued, running 状态）
    }
    
    throw new Error('3D生成超时，请稍后手动查询任务状态');
  }
}
