# InspireFlow（灵感流动） · 快速上手的节点式 AI 创作桌面应用

[English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Repo](https://img.shields.io/badge/github-ziguishian/InspireFlow--_lightgrey)](https://github.com/ziguishian/InspireFlow-)
[![Node.js](https://img.shields.io/badge/Node-18%2B-green)](https://nodejs.org/)

InspireFlow 是一个基于节点（node-based）的桌面与 Web 混合应用，用于可视化编排 AI 内容生成与自动化工作流。支持文本、图像、视频与 3D 生成，强调易用的节点拖拽体验、可扩展的节点类型与本地化支持。

---

## 目录
- [主要特性](#主要特性)
- [界面预览](#界面预览)
- [示例输出](#示例输出)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
  - [环境要求](#环境要求)
  - [安装与运行](#安装与运行)
- [项目结构](#项目结构)
- [配置说明](#配置说明)
- [使用指南（简要）](#使用指南简要)
- [节点类型](#节点类型)
- [开发与扩展](#开发与扩展)
- [贡献](#贡献)
- [许可](#许可)

---

## 主要特性
- 现代且美观的玻璃拟态 UI，支持深色模式
- 节点式工作流编辑（类似 ComfyUI / Dify），可视化编排 AI 任务
- 支持多模态生成：文本、图像、视频、3D 模型
- 工作流保存/加载（JSON 导出/导入），本地持久化
- 可扩展节点系统：易于新增自定义节点与模型提供器
- 多语言（内置 i18next），内置中/英等语言包

---

## 界面预览
<img width="100%" alt="screenshot-1" src="https://github.com/user-attachments/assets/ec7f349a-2754-4e55-9cd9-7f4e66addcfa" />
<img width="100%" alt="screenshot-2" src="https://github.com/user-attachments/assets/3bf3ad48-c865-4679-8eb9-9e8b282efae4" />
<img width="100%" alt="screenshot-3" src="https://github.com/user-attachments/assets/ddb0b5b9-455f-41a7-97e4-3b1152e7bd6b" />

---

## 示例输出
<img width="70%" alt="outputs" src="https://github.com/user-attachments/assets/ad28aadd-cd66-4384-9035-3e2fc851edeb" />
可生成多种风格的图像、文本与 3D 预览。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、Vite、TypeScript |
| 节点编辑器 | React Flow |
| 样式 | Tailwind CSS、Framer Motion |
| 状态管理 | Zustand |
| 桌面 | Electron |
| 国际化 | i18next |

---

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装与运行
```bash
# 克隆仓库（或下载 ZIP）
git clone https://github.com/ziguishian/InspireFlow-.git
cd InspireFlow-

# 安装依赖
npm install
# 或使用 yarn
# yarn

# 仅启动 Web 开发服务（用于快速调试前端）
npm run dev

# 桌面应用（开发模式：Vite + Electron）
npm run electron:dev

# 生产构建
npm run build
# 构建 Electron 安装包（macOS / Linux / Windows）
npm run electron:build
# Windows 专用构建（可选）
# npm run build:win
```

提示：
- 开发时建议同时观察终端输出（Vite & Electron 主进程）以排查问题。
- 若遇到依赖或构建问题，先尝试删除 node_modules 与 lock 文件并重新安装。

---

## 项目结构（简要）
```
mxinspireFlows/
├── docs/                    # 文档（节点开发、模型 API 配置）
├── electron/                # Electron 主进程（main / preload）
├── public/                  # 静态资源
├── scripts/                 # 构建脚本（如 prebuild-win.cjs）
├── src/
│   ├── components/          # UI 组件（3D、Edges、Layout、Modals、Settings…）
│   ├── config/              # 应用配置、模型映射、提供商列表
│   ├── contexts/            # 语言、主题上下文
│   ├── i18n/                # i18next 配置与语言包
│   ├── nodes/               # 节点定义与注册（文本/图像/视频/3D 等）
│   ├── services/            # API 服务、工作流执行器
│   ├── stores/              # Zustand stores（工作流、UI、设置）
│   ├── types/               # 类型定义
│   └── utils/               # IO、文件保存、节点校验等工具
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 配置说明
在应用右上角的“设置”（齿轮）中配置模型 API：

- Base URL — 模型/代理接口地址
- API Key — 认证密钥
- Provider — OpenAI / Claude / DeepSeek / Gemini / Seedream / Ollama / 自定义

详细配置与示例请查看：docs/MODEL_API_CONFIG.md

---

## 使用指南（简要）
1. 从左侧栏拖拽节点到画布
2. 将节点的输出端连到其他节点的输入端（类型须匹配或为 `any`）
3. 点击画布上的节点，在右侧面板编辑属性（提示：大多数节点都支持默认值）
4. 点击右上角 “运行” 执行当前工作流
5. 使用工具栏保存 / 加载工作流（JSON 导入/导出）

---

## 节点类型
- 生成：文本生成 / 图像生成 / 视频生成 / 3D 生成 / 脚本执行器
- 工具：文本/图像/视频/3D 输入
- 预览：文本/图像/视频/3D 预览

新增节点请参考：docs/NODE_DEVELOPMENT.md

---

## 开发与扩展
- 新增节点：参考 docs/NODE_DEVELOPMENT.md（包含 schema、执行器、注册方式）
- 主题定制：修改 tailwind.config.js 与样式变量
- 翻译：在 src/i18n/locales/ 中添加或更新语言包
- 执行器逻辑：src/services/workflowExecutor.ts

开发流程建议：
- 小步提交、保持变更聚焦
- 为新增节点或复杂逻辑添加示例与测试
- 在 Issues 中先讨论大型设计或破坏性变更

---

## 贡献
欢迎任何形式的贡献：修复 bug、改进文档、添加节点、示例或多语言支持。  
常见流程：
1. 开 Issue 描述你的想法
2. Fork 仓库并创建分支
3. 提交 PR，填写变更说明与复现步骤

我们欢迎使用 AI & Copilot 等工具进行协作开发，只需确保提交清晰且可审阅。

---

## 许可证
MIT © ziguishian

---

## 致谢
感谢社区贡献者、节点生态的灵感（如 ComfyUI/Dify）以及所有测试与反馈者。若你有建议或想一起开发某个节点，欢迎在仓库中打开 Issue！
