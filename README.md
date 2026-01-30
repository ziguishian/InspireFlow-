# InspireFlow（灵感流动）

**其他语言 / Other languages:** [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

基于节点的 AI 内容创作与自动化桌面应用。通过连接节点编排工作流，支持文本、图像、视频与 3D 生成。

**开源仓库：** [https://github.com/ziguishian/InspireFlow-](https://github.com/ziguishian/InspireFlow-)

---

## 功能特点

- **扩散风格界面** — 玻璃拟态设计，支持深色模式
- **节点式工作流** — 类似 ComfyUI/Dify 的可视化编排
- **AI 生成** — 文本、图像、视频、3D 模型生成
- **多语言** — 支持五种语言切换（见上方链接）
- **保存与加载** — 工作流 JSON 导出/导入，本地持久化
- **可扩展** — 可新增节点类型，详见 [节点开发](docs/NODE_DEVELOPMENT.md)

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、Vite、TypeScript |
| 节点编辑器 | React Flow |
| 样式 | Tailwind CSS、Framer Motion |
| 状态 | Zustand |
| 桌面 | Electron |
| 国际化 | i18next |

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装与运行

```bash
# 安装依赖
npm install

# 仅启动 Web 开发服务
npm run dev

# 桌面应用（Vite + Electron）
npm run electron:dev

# 生产构建
npm run build
npm run electron:build   # 或 Windows：npm run build:win
```

## 项目结构

```
mxinspireFlows/
├── docs/                    # 文档
│   ├── NODE_DEVELOPMENT.md  # 节点开发指南
│   └── MODEL_API_CONFIG.md  # 模型 API 配置
├── electron/                # Electron 主进程
│   ├── main.js
│   └── preload.js
├── public/
├── scripts/                 # 构建脚本（如 prebuild-win.cjs）
├── src/
│   ├── components/
│   │   ├── 3D/              # 3D 预览、GLB 预览
│   │   ├── Edges/           # 可删除连线
│   │   ├── Layout/          # 画布、标签栏、左侧栏、工具栏、面板
│   │   ├── Modals/          # 帮助、快捷键
│   │   ├── Settings/        # 设置弹窗
│   │   ├── Toast/
│   │   └── UI/              # 自定义选择等
│   ├── config/             # 应用名、模型映射、模型提供商
│   ├── contexts/            # 语言、主题
│   ├── i18n/               # i18next 配置与语言包（en-US、zh-CN）
│   ├── nodes/               # 节点定义
│   │   ├── text-gen/        # 文本生成
│   │   ├── image-gen/       # 图像生成
│   │   ├── video-gen/       # 视频生成
│   │   ├── 3d-gen/          # 3D 生成
│   │   ├── script-runner/   # 脚本执行
│   │   ├── *-input/         # 文本/图像/视频/3D 输入
│   │   ├── preview/         # 文本/图像/视频/3D 预览
│   │   ├── BaseNode.tsx
│   │   ├── handleSchema.ts
│   │   ├── index.ts         # 节点类型注册
│   │   └── modelOptions.ts
│   ├── services/            # API 服务、工作流执行器
│   ├── stores/              # 工作流、UI、设置 store
│   ├── types/
│   └── utils/               # 文件保存、工作流 IO、节点校验等
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 配置

在 **设置**（齿轮图标）中配置 API：

- **Base URL** — 接口地址
- **API Key** — 认证密钥
- **Provider** — OpenAI、Claude、DeepSeek、Gemini、Seedream、Ollama 或自定义

详细说明与开发者说明见 [模型 API 配置](docs/MODEL_API_CONFIG.md)。

## 使用说明

1. **添加节点** — 从左侧栏拖拽节点到画布
2. **连线** — 将输出把手连到输入把手（类型一致或 `any`）
3. **配置** — 选中节点后在右侧面板编辑属性
4. **运行** — 点击右上角 **运行** 执行工作流
5. **保存/加载** — 通过工具栏或侧栏保存/加载工作流，导出 JSON

## 节点类型

| 分类 | 节点 |
|------|------|
| **生成** | 文本生成、图像生成、视频生成、3D 生成、脚本运行器 |
| **工具** | 文本/图像/视频/3D 输入 |
| **预览** | 文本/图像/视频/3D 预览 |

新增节点请参考 [节点开发](docs/NODE_DEVELOPMENT.md)。

## 开发

- **新增节点**：按 [docs/NODE_DEVELOPMENT.md](docs/NODE_DEVELOPMENT.md) 操作（schema、index、侧栏、执行器、校验）
- **主题**：`tailwind.config.js`
- **翻译**：`src/i18n/locales/`
- **执行逻辑**：`src/services/workflowExecutor.ts`

## 许可证

MIT

## 参与贡献

**欢迎大家参与构建 InspireFlow。**

我们鼓励贡献者用更现代、高效的方式参与开发：

- **Vibe coding 与 AI 辅助开发** — 欢迎使用 AI 结对编程（如 Cursor、GitHub Copilot 等）来迭代想法、探索实现、打磨代码。我们看重清晰的意图与良好的结构，用 AI 加速实现完全没问题。
- **小步迭代、开放讨论** — 更推荐小而聚焦的改动与讨论。有想法或疑问可以先开 Issue；准备好后再开 PR，我们乐意在 Review 中一起迭代。
- **文档与代码并重** — 对文档、示例、测试的改进与对新功能的贡献同样欢迎。若你新增了节点或功能，欢迎顺带更新 [节点开发](docs/NODE_DEVELOPMENT.md) 或 README，方便他人跟上。

无论你是修一个 typo、加一个节点、完善多语言，还是提出新方向，都感谢你帮助 InspireFlow 变得更好。准备好时，直接开 Issue 或 Pull Request 即可。
