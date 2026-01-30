# InspireFlow (灵感流动)

**Other languages:** [简体中文](README.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

A node-based AI content creation and automation desktop application. Build workflows by connecting nodes for text, image, video, and 3D generation.

---

## Features

- **Diffusion-style UI** — Glassmorphism design, dark mode
- **Node-based workflow** — Visual editor similar to ComfyUI/Dify
- **AI generation** — Text, image, video, and 3D model generation
- **Multi-language** — Switch between 5 languages (see links above)
- **Save / load** — Export and import workflows as JSON; local persistence
- **Extensible** — Add new node types; see [Node Development](docs/NODE_DEVELOPMENT.md)

## Tech Stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, Vite, TypeScript |
| Node editor | React Flow |
| Styling | Tailwind CSS, Framer Motion |
| State | Zustand |
| Desktop | Electron |
| i18n | i18next |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install & run

```bash
# Install dependencies
npm install

# Web dev server only
npm run dev

# Desktop app (Vite + Electron)
npm run electron:dev

# Build for production
npm run build
npm run electron:build   # or: npm run build:win (Windows)
```

## Project Structure

```
mxinspireFlows/
├── docs/                    # Documentation
│   ├── NODE_DEVELOPMENT.md  # Node development guide
│   └── MODEL_API_CONFIG.md  # Model API configuration
├── electron/                # Electron main process
│   ├── main.js
│   └── preload.js
├── public/
├── scripts/                 # Build scripts (e.g. prebuild-win.cjs)
├── src/
│   ├── components/
│   │   ├── 3D/              # 3D viewer, GLB preview
│   │   ├── Edges/           # DeletableEdge
│   │   ├── Layout/          # Canvas, TabBar, LeftSidebar, Toolbar, Panels
│   │   ├── Modals/          # Help, Shortcuts
│   │   ├── Settings/        # Settings modal
│   │   ├── Toast/
│   │   └── UI/              # CustomSelect, etc.
│   ├── config/             # appName, modelMapping, modelProviders
│   ├── contexts/            # Language, Theme
│   ├── i18n/                # i18next config & locales (en-US, zh-CN)
│   ├── nodes/               # Node definitions
│   │   ├── text-gen/        # Text generation
│   │   ├── image-gen/       # Image generation
│   │   ├── video-gen/       # Video generation
│   │   ├── 3d-gen/          # 3D generation
│   │   ├── script-runner/   # Script execution
│   │   ├── *-input/         # text/image/video/3d input
│   │   ├── preview/         # Text/Image/Video/3D preview
│   │   ├── BaseNode.tsx
│   │   ├── handleSchema.ts
│   │   ├── index.ts         # nodeTypes registry
│   │   └── modelOptions.ts
│   ├── services/            # apiService, workflowExecutor
│   ├── stores/              # workflowStore, uiStore, settingsStore
│   ├── types/
│   └── utils/               # fileSave, workflowIO, nodeValidation, etc.
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Configuration

Configure API credentials in **Settings** (gear icon):

- **Base URL** — API endpoint
- **API Key** — Authentication key
- **Provider** — OpenAI, Claude, DeepSeek, Gemini, Seedream, Ollama, or Custom

See [Model API configuration](docs/MODEL_API_CONFIG.md) for detailed setup and developer notes.

## Usage

1. **Add nodes** — Drag nodes from the left sidebar onto the canvas.
2. **Connect** — Connect output handles to input handles (same type or `any`).
3. **Configure** — Select a node to edit properties in the right panel.
4. **Run** — Click **Run** in the top-right to execute the workflow.
5. **Save / load** — Use toolbar or sidebar to save/load workflows and export JSON.

## Node Types

| Category | Nodes |
|----------|--------|
| **Generation** | Text Gen, Image Gen, Video Gen, 3D Gen, Script Runner |
| **Utility** | Text/Image/Video/3D Input |
| **Preview** | Text/Image/Video/3D Preview |

See [Node Development](docs/NODE_DEVELOPMENT.md) for adding new nodes.

## Development

- **New nodes:** Follow [docs/NODE_DEVELOPMENT.md](docs/NODE_DEVELOPMENT.md) (schema, index, sidebar, executor, validation).
- **Theme:** `tailwind.config.js`
- **Translations:** `src/i18n/locales/`
- **Execution:** `src/services/workflowExecutor.ts`

## License

MIT

## Contributing

**We welcome everyone to participate in building InspireFlow.**

We encourage contributors to use modern, efficient workflows when contributing:

- **Vibe coding & AI-assisted development** — Use AI pair programming (e.g. Cursor, GitHub Copilot, or similar) to iterate on ideas, explore implementations, and refine code. We value clear intent and good structure; feel free to collaborate with AI to get there faster.
- **Iterative and open** — Prefer small, focused changes and discussions. Open an issue to propose ideas or ask questions; open a PR when you're ready. We're happy to iterate together in review.
- **Docs and code** — Improvements to docs, examples, and tests are as welcome as new features. If you add a node or feature, consider updating [Node Development](docs/NODE_DEVELOPMENT.md) or README so others can follow.

Whether you fix a typo, add a node, improve i18n, or suggest a new direction — thank you for helping make InspireFlow better. Open an issue or pull request when you're ready.
