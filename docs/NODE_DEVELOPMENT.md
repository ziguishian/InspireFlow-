# 节点开发文档

本文档说明如何在 InspireFlow 中开发新节点，包括开发规范与需要修改/添加的文件位置。

---

## 一、节点架构概览

- **节点组件**：基于 React Flow 的 `NodeProps`，通常复用 `BaseNode` 并传入 `inputs`/`outputs`（来自 handle schema）、`icon`、`color`、`nodeType`。
- **Handle 定义**：在 `handleSchema.ts` 中为每种节点类型定义输入/输出把手（id、label、type），用于连线类型校验与执行时数据映射。
- **执行逻辑**：在 `workflowExecutor.ts` 的 `resolveNodeOutput` 中根据 `node.type` 分支，调用对应 API 或处理输入并写回 `node.data`。
- **校验逻辑**：在 `nodeValidation.ts` 中为每种节点类型定义“运行前必填项”（如 prompt、连接的上游等）。

新增节点需要：**新增组件 → 注册 handle schema → 注册 nodeTypes → 侧栏模板与 i18n → 执行分支 → 校验分支**（若需）。可选：模型/API 配置、BaseNode 内对该类型的 UI 分支。

---

## 二、需要修改/添加的位置

| 步骤 | 位置 | 说明 |
|------|------|------|
| 1 | `src/nodes/<category>/<NodeName>.tsx` | 新建节点组件（见下方目录规范） |
| 2 | `src/nodes/handleSchema.ts` | 在 `NODE_HANDLE_SCHEMAS` 中增加该节点类型的 `inputs`/`outputs` |
| 3 | `src/nodes/index.ts` | 在 `nodeTypes` 中注册：`nodeTypeKey: NodeComponent` |
| 4 | `src/components/Layout/LeftSidebar.tsx` | 在 `nodeTemplates` 中增加一项：`type`、`label`、`icon`、`category`、`defaultData` |
| 5 | `src/i18n/locales/zh-CN.json` 与 `en-US.json` | 在 `sidebar.nodes` 中增加 `nodeTypeKey` 的文案 |
| 6 | `src/services/workflowExecutor.ts` | 在 `resolveNodeOutput` 的 `switch (node.type)` 中增加该类型的执行逻辑 |
| 7 | `src/utils/nodeValidation.ts` | 在 `validateNodeRequired` 的 `switch (node.type)` 中增加该校验（若有必填/必连） |
| 8（可选） | `src/nodes/BaseNode.tsx` | 若该类型有特殊 UI（如专用表单、预览区），按 `type === 'xxx'` 增加分支 |
| 9（可选） | `src/config/modelProviders.ts`、`modelMapping.ts` 等 | 若节点使用新模型/API，需在此配置 |

---

## 三、目录与命名规范

### 3.1 节点文件位置

- 路径：`src/nodes/<category>/<NodeName>.tsx`
- `<category>` 建议与侧栏分类一致：
  - **generation**：生成类（如 text-gen、image-gen、video-gen、3d-gen、script-runner）
  - **utility**：工具/输入类（如 text-input、image-input、video-input、3d-input）
  - **preview**：预览类（如 text-preview、image-preview、video-preview、3d-preview）
- 组件名：PascalCase，如 `TextGenNode`、`ImageInputNode`。
- 节点类型 key（`node.type`）：camelCase，与 `nodeTypes` 的 key 一致，如 `textGen`、`imageInput`、`3dGen`（数字开头用引号 `'3dGen'`）。

### 3.2 Handle 类型

- 定义在 `handleSchema.ts`：`HandleType = 'text' | 'image' | 'video' | '3d' | 'any'`。
- 连线兼容规则：`text`↔`text`，`image`↔`image`，`video`↔`video`，`3d`↔`3d`；`any` 可与任意类型连接。
- 输出到下游时，执行器会按 handle 的 `type` 做规范化（见 `workflowExecutor` 中 `buildOutputMap`、`normalizeData`）。

### 3.3 侧栏分类与 defaultData

- `nodeTemplates` 中 `category` 取值：`generation` | `utility` | `preview`（与 `LeftSidebar` 的 `categories` 一致）。
- `defaultData`：该节点类型的 `node.data` 初始值，需包含运行与 UI 所需字段（如 `model`、`prompt`、`image` 等），以便新拖入的节点可直接使用。

---

## 四、开发步骤详解

### 4.1 新建节点组件

在 `src/nodes/<category>/` 下新建文件，例如 `MyNode.tsx`：

```tsx
import React from 'react';
import { NodeProps } from 'reactflow';
import BaseNode from '../BaseNode';
import { NODE_HANDLE_SCHEMAS } from '../handleSchema';
import { SomeIcon } from 'lucide-react';

const MyNode: React.FC<NodeProps> = (props) => {
  const schema = NODE_HANDLE_SCHEMAS.myNode; // 与 handleSchema 中的 key 一致
  return (
    <BaseNode
      {...props}
      icon={<SomeIcon size={16} />}
      color="blue"           // 'blue' | 'purple' | 'cyan'
      nodeType="text"       // 'text' | 'image' | 'video' | '3d' | 'other'
      inputs={schema.inputs}
      outputs={schema.outputs}
    />
  );
};

export default MyNode;
```

- 多数节点只需如上委托给 `BaseNode`；若该类型需要单独 UI，再在 `BaseNode.tsx` 里用 `type === 'myNode'` 加分支。

### 4.2 注册 Handle Schema

在 `src/nodes/handleSchema.ts` 的 `NODE_HANDLE_SCHEMAS` 中增加：

```ts
myNode: {
  inputs: [
    { id: 'text', label: 'Text', type: 'text' },
    // ...
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'text' },
  ],
},
```

- `id` 会作为连线时的 `sourceHandle`/`targetHandle`，执行时通过 `inputs[handleId]` 取上游数据。

### 4.3 注册节点类型

在 `src/nodes/index.ts` 中：

```ts
import MyNode from './<category>/MyNode';

export const nodeTypes: NodeTypes = {
  // ...
  myNode: MyNode,
};
```

- key 必须与侧栏 `nodeTemplates[].type`、handleSchema key、`workflowExecutor` / `nodeValidation` 中的 `node.type` 一致。

### 4.4 侧栏与 i18n

- **LeftSidebar.tsx** 的 `nodeTemplates` 中增加：

```ts
{
  type: 'myNode',
  label: 'sidebar.nodes.myNode',
  icon: SomeIcon,
  category: 'generation', // 或 'utility' | 'preview'
  defaultData: { model: 'xxx', prompt: '', /* 其他默认 data 字段 */ },
}
```

- **zh-CN.json / en-US.json** 的 `sidebar.nodes` 下增加：

```json
"myNode": "我的节点"
```

### 4.5 执行逻辑

在 `src/services/workflowExecutor.ts` 的 `resolveNodeOutput` 里，在 `switch (node.type)` 中增加：

```ts
case 'myNode': {
  const prompt = inputs.text || inputs.prompt || node.data.prompt || '';
  // 调用 API 或处理 inputs，返回该节点的输出（与 outputs[0].type 对应）
  return someApiCall(prompt, node.data);
}
```

- 返回值会被 `buildOutputMap` 按该节点的 `outputs` 映射到 `node.data`（如 `output`、`image`、`text` 等），供下游节点或 BaseNode 展示。

### 4.6 运行前校验（可选）

在 `src/utils/nodeValidation.ts` 的 `validateNodeRequired` 的 `switch (node.type)` 中增加：

```ts
case 'myNode':
  requireEitherConnectedOrNonEmpty('text', ['prompt'], '提示词（Prompt）');
  break;
```

- 用于在点击“运行”时提示用户补全必填项或连接必连输入。

---

## 五、规范小结

1. **类型 key 统一**：`handleSchema`、`nodeTypes`、`nodeTemplates[].type`、`workflowExecutor`、`nodeValidation` 中使用的节点类型字符串必须一致（如一律用 `myNode`）。
2. **Handle id 稳定**：执行器与 BaseNode 会通过 handle 的 `id` 读写数据，不要随意改名；新增 handle 需同步改 schema 与执行/UI 逻辑。
3. **defaultData 完整**：新拖入节点的 `data` 来自 `defaultData`，需包含该类型所有用到的字段，避免运行时为 `undefined`。
4. **连线类型**：仅相同类型或 `any` 可连；新增 HandleType 需在 `handleSchema.ts` 与 `getHandleType`/`isCompatibleHandleType` 中考虑。
5. **BaseNode 扩展**：通用表单项（如 `model`、`prompt`）由 BaseNode 根据 `data.*` 统一渲染；仅当该类型需要独有 UI 时再在 BaseNode 内写 `type === 'myNode'` 分支。
6. **模型/API**：若新节点使用新模型，需在 `modelProviders.ts`、`modelMapping.ts` 及设置界面相关配置中注册，并在执行器中通过 `getModelConfigKey`/`getModelConfig` 获取配置。

---

## 六、参考现有节点

| 节点类型 | 组件路径 | 说明 |
|----------|----------|------|
| textGen | `src/nodes/text-gen/TextGenNode.tsx` | 生成类，有 model/prompt，可参考执行与校验 |
| imageInput | `src/nodes/image-input/ImageInputNode.tsx` | 输入类，无输入 handle，单输出 |
| imagePreview | `src/nodes/preview/ImagePreviewNode.tsx` | 预览类，仅输入 handle，BaseNode 内有 `type === 'imagePreview'` 的预览 UI |
| scriptRunner | `src/nodes/script-runner/ScriptRunnerNode.tsx` | 工具类，多输入/输出，校验要求 code 与 language |

按上述位置与规范新增或修改即可保持与现有节点一致、可维护。
