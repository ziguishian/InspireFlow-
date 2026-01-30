# 模型 API 配置说明

本文档说明如何在 InspireFlow 中配置各模型提供商的 API（Base URL、API Key），以及配置的存储与使用方式。

---

## 一、在哪里配置

1. 打开应用，点击右上角 **设置**（齿轮图标）。
2. 在设置弹窗左侧选择 **「模型 API」**（或 **Models API**）。
3. 按提供商填写 **API Base URL** 与 **API Key**，点击弹窗底部 **保存** 后生效。

配置会持久化到本地（IndexedDB），下次启动自动加载。

---

## 二、提供商与字段说明

### 2.1 统一配置（推荐）

同一提供商的多个模型**共用一套 Base URL 与 API Key**。例如勾选「统一配置」时，Google / Gemini 下所有模型（Gemini 文本、NanoBanana 图像、GPTImage 等）都使用同一组 URL 与 Key，配置一次即可在所有相关节点中使用。

| 提供商 | 说明 | 涉及节点/能力 |
|--------|------|----------------|
| **OpenAI** | OpenAI 文本 API | 文本生成（GPT 系列） |
| **Claude (Anthropic)** | Anthropic Claude API | 文本生成（Claude 系列） |
| **DeepSeek** | DeepSeek API | 文本生成（DeepSeek 系列） |
| **Google / Gemini** | Google AI / Gemini API | 文本生成（Gemini）、图像生成（NanoBanana / NanoBanana Pro）、GPTImage |
| **Seedream (方舟 API)** | 字节方舟多模态 API | 文本（Seedream 文本）、图像（Seedream）、视频（Seedream Video）、3D（Seedream 3D） |

每个提供商区块内有两个输入框：

- **API Base URL**：该提供商的 API 根地址。例如：
  - OpenAI: `https://api.openai.com/v1`
  - Claude: `https://api.anthropic.com`
  - DeepSeek: `https://api.deepseek.com`
  - Google/Gemini: `https://generativelanguage.googleapis.com` 或你使用的 Gemini 端点
  - Seedream（方舟）: 方舟控制台提供的 Base URL（如 `https://ark.cn-beijing.volces.com/api/v3` 等，以实际控制台为准）
- **API Key**：该提供商对应的密钥。从各服务商控制台或账号设置中获取。

**统一配置开关**：默认开启。关闭后，该提供商下每个模型可使用单独配置（当前 UI 仍按「统一配置」展示，单独配置多为兼容旧数据或高级用法）。

### 2.2 Ollama（本地模型）

在 **「其他模型」** 区域单独配置：

- **Base URL**：本机 Ollama 服务地址，默认 `http://localhost:11434`。
- **检测模型**：点击后根据 Base URL 拉取当前 Ollama 已拉取的模型列表，并在下拉中选择本次要使用的默认模型名称（如 `llama3.2`）。  
  文本生成节点若选择「Ollama」，将使用此处选中的模型名称；若未选，则使用内置默认（如 `llama3.2`）。

Ollama 不需要真实 API Key，应用内会使用占位符。

---

## 三、配置如何被使用

- **运行工作流时**：执行器根据节点所选模型（如 `openai`、`nanobanana`、`seedream-video`）解析其所属提供商，再根据「统一配置」开关决定使用统一配置键（如 `openai-unified`、`google-gemini-unified`、`seedream-ark`）还是模型自身键，并从 `modelConfigs` 中取出对应的 `baseURL` 与 `apiKey` 调用 API。
- **模型名称映射**：节点上显示的模型名称（如 `seedream-video`）会通过 `src/config/modelMapping.ts` 映射为实际 API 使用的模型 ID（如 `doubao-seedance-1-5-pro-251215`）。仅改 API 配置即可，一般无需改映射，除非要切换同一提供商下的具体模型版本。

---

## 四、开发者：配置从哪里来、到哪里去

- **类型定义**：`src/types/index.ts` 中的 `ModelAPIConfig`（`baseURL`、`apiKey`、可选 `modelName`）、`ModelConfigs`、`UnifiedConfigSwitches`。
- **提供商分组**：`src/config/modelProviders.ts` 的 `MODEL_PROVIDER_GROUPS`。每个分组有 `id`、`label`、`unifiedConfigKey`、`models`（该提供商下模型列表）。执行时通过 `getModelProvider(model)`、`getModelConfigKey(model, unifiedConfigSwitches)` 决定用哪个配置键。
- **持久化**：设置（含 `modelConfigs`、`unifiedConfigSwitches`）由 `src/stores/settingsStore.ts` 写入 `database.saveSettings('main', ...)`，从 `database.getSettings('main')` 读取；实际存贮在 IndexedDB（如 `mxinspireFlows` 库）。
- **UI**：`src/components/Settings/SettingsModal.tsx` 中「模型 API」区块根据 `MODEL_PROVIDER_GROUPS` 渲染每个提供商的 Base URL / API Key 输入框及统一配置开关；Ollama 单独一块，使用 `detectOllamaModels` 拉取模型列表并写入 `ollama.modelName`。

---

## 五、开发者：新增一个模型提供商

若要支持新的提供商（例如新文本/图像服务）：

1. **在 `modelProviders.ts` 中增加分组**  
   在 `MODEL_PROVIDER_GROUPS` 中新增一项，填写 `id`、`label`、`unifiedConfigKey`、`models`（该提供商下所有模型 key）。执行器会通过 `getModelProvider` / `getModelConfigKey` 使用该分组。

2. **（可选）在 `modelMapping.ts` 中增加映射**  
   若节点上使用的模型名与 API 实际模型 ID 不一致，在 `defaultModelMapping` 的 `text` / `image` / `video` / `3d` 中增加对应映射。

3. **在节点与执行器中接好模型 key**  
   在 `src/nodes/modelOptions.ts`（或各节点）中把新模型的 key 加入选项；在 `src/services/workflowExecutor.ts` 的 `resolveNodeOutput` 中，若有特殊参数或调用方式，为新模型加分支或复用现有分支并传入正确 `model`。

4. **Settings UI**  
   当前设置页按 `MODEL_PROVIDER_GROUPS` 自动渲染，因此只要在 `modelProviders.ts` 里加了新分组，设置里就会出现新提供商的 Base URL / API Key 与统一配置开关，无需改 Settings 组件（除非要为该提供商做单独 UI，例如像 Ollama 那样「检测模型」）。

5. **类型（可选）**  
   若希望在 `ModelConfigs` 里为统一配置键或单独模型键加类型提示，可在 `src/types/index.ts` 的 `ModelConfigs` 中增加对应键的类型。

按以上步骤即可在构建设置中完整接入新模型 API 配置并在运行中使用。
