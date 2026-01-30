# 模型映射配置说明

## 概述

`modelMapping.ts` 文件用于配置所有生成工具使用的模型名称映射。当用户在节点属性中选择模型类型（如 'openai', 'claude', 'gemini' 等）时，系统会根据此配置将模型类型映射到实际的 API 模型名称。

## 配置文件位置

`src/config/modelMapping.ts`

## 使用方法

### 1. 修改默认模型映射

编辑 `defaultModelMapping` 对象来修改模型映射：

```typescript
export const defaultModelMapping: ModelMappingConfig = {
  text: {
    'claude': 'claude-3-haiku-20240307',  // 修改 Claude 默认模型
    'gemini': 'gemini-2.5-flash-lite',     // 修改 Gemini 默认模型
    // ... 其他模型映射
  },
  image: {
    'nanobanana': 'gemini-2.5-flash-image',
    // ... 其他图像模型映射
  },
  // ...
};
```

### 2. 运行时更新模型映射

使用 `updateModelMapping` 函数在运行时更新模型映射：

```typescript
import { updateModelMapping } from '@/config/modelMapping';

// 更新文本生成模型的映射
updateModelMapping('text', 'claude', 'claude-3-sonnet-20240229');
```

### 3. 获取映射后的模型名称

使用 `getMappedModelName` 函数获取映射后的模型名称：

```typescript
import { getMappedModelName } from '@/config/modelMapping';

// 获取文本生成模型的映射名称
const mappedName = getMappedModelName('claude', 'text');
// 返回: 'claude-3-haiku-20240307'

// 获取图像生成模型的映射名称
const imageModelName = getMappedModelName('nanobanana', 'image');
// 返回: 'gemini-2.5-flash-image'
```

## 模型类别

- **text**: 文本生成模型（OpenAI, Claude, DeepSeek, Qwen, Gemini, Ollama）
- **image**: 图像生成模型（NanoBanana, Seedream, GPTImage）
- **video**: 视频生成模型（Keling, Sora）
- **3d**: 3D 生成模型（Tripo）

## 默认模型映射

### 文本生成模型

| 用户选择 | 实际 API 模型名称 |
|---------|-----------------|
| openai | gpt-4 |
| claude | claude-3-haiku-20240307 |
| deepseek | deepseek-chat |
| qwen | qwen-turbo |
| gemini | gemini-2.5-flash-lite |
| ollama | llama3.2 |

### 图像生成模型

| 用户选择 | 实际 API 模型名称 |
|---------|-----------------|
| nanobanana | gemini-2.5-flash-image |
| nanobananapro | gemini-3-pro-image-preview |
| seedream | seedream |
| gptimage | gptimage |

## 注意事项

1. **模型名称大小写**: 映射配置使用小写模型名称进行匹配，但返回的映射名称保持原始大小写。

2. **直接输入完整模型名称**: 如果用户在节点属性中直接输入了完整的模型名称（如 `deepseek-chat`），且该名称不在映射表中，系统会直接使用用户输入的名称，不会被映射覆盖。

3. **Ollama 特殊处理**: Ollama 模型的默认映射是 `llama3.2`，但实际使用的模型名称可以从设置界面中选择。如果用户在设置中选择了具体的模型名称，会优先使用设置中的模型名称。

4. **修改后需要重启**: 修改配置文件后，需要重启开发服务器才能生效。

## 示例

### 修改 Claude 默认模型为 Sonnet

```typescript
// 在 modelMapping.ts 中修改
text: {
  'claude': 'claude-3-sonnet-20240229',  // 从 haiku 改为 sonnet
  // ...
}
```

### 添加新的模型映射

```typescript
// 在 modelMapping.ts 中添加
text: {
  'my-custom-model': 'actual-api-model-name',
  // ...
}
```

### 运行时动态更新

```typescript
import { updateModelMapping } from '@/config/modelMapping';

// 根据用户选择动态更新
if (userPreference === 'high-quality') {
  updateModelMapping('text', 'claude', 'claude-3-opus-20240229');
} else {
  updateModelMapping('text', 'claude', 'claude-3-haiku-20240307');
}
```
