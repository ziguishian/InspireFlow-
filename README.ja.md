# InspireFlow（灵感流动）

**他の言語 / Other languages:** [简体中文](README.md) · [English](README.en.md) · [한국어](README.ko.md) · [Español](README.es.md)

ノードベースの AI コンテンツ作成・自動化デスクトップアプリ。テキスト・画像・動画・3D 生成のためのワークフローをノード接続で構築できます。

---

## 機能

- **拡散スタイル UI** — グラスモーフィズム、ダークモード対応
- **ノードベースワークフロー** — ComfyUI/Dify 風のビジュアルエディタ
- **AI 生成** — テキスト・画像・動画・3D モデル生成
- **多言語** — 5 言語切り替え（上記リンク参照）
- **保存・読み込み** — ワークフロー JSON のエクスポート/インポート、ローカル永続化
- **拡張** — 新ノード追加可能。[ノード開発](docs/NODE_DEVELOPMENT.md) 参照

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロント | React 18、Vite、TypeScript |
| ノードエディタ | React Flow |
| スタイル | Tailwind CSS、Framer Motion |
| 状態 | Zustand |
| デスクトップ | Electron |
| i18n | i18next |

## はじめに

### 必要環境

- Node.js 18+
- npm または yarn

### インストール・実行

```bash
# 依存関係のインストール
npm install

# Web 開発サーバーのみ
npm run dev

# デスクトップアプリ（Vite + Electron）
npm run electron:dev

# 本番ビルド
npm run build
npm run electron:build   # または Windows: npm run build:win
```

## プロジェクト構造

```
mxinspireFlows/
├── docs/                    # ドキュメント
│   ├── NODE_DEVELOPMENT.md  # ノード開発ガイド
│   └── MODEL_API_CONFIG.md  # モデル API 設定
├── electron/                # Electron メインプロセス
│   ├── main.js
│   └── preload.js
├── public/
├── scripts/                 # ビルドスクリプト
├── src/
│   ├── components/
│   │   ├── 3D/              # 3D ビューア、GLB プレビュー
│   │   ├── Edges/           # 削除可能エッジ
│   │   ├── Layout/          # キャンバス、タブ、左サイドバー、ツールバー、パネル
│   │   ├── Modals/          # ヘルプ、ショートカット
│   │   ├── Settings/        # 設定モーダル
│   │   ├── Toast/
│   │   └── UI/
│   ├── config/             # アプリ名、モデルマッピング、プロバイダ
│   ├── contexts/            # 言語、テーマ
│   ├── i18n/                # i18next 設定・ロケール
│   ├── nodes/               # ノード定義
│   │   ├── text-gen/        # テキスト生成
│   │   ├── image-gen/       # 画像生成
│   │   ├── video-gen/       # 動画生成
│   │   ├── 3d-gen/          # 3D 生成
│   │   ├── script-runner/   # スクリプト実行
│   │   ├── *-input/         # テキスト/画像/動画/3D 入力
│   │   ├── preview/         # テキスト/画像/動画/3D プレビュー
│   │   ├── BaseNode.tsx
│   │   ├── handleSchema.ts
│   │   ├── index.ts
│   │   └── modelOptions.ts
│   ├── services/           # API サービス、ワークフロー実行
│   ├── stores/              # ワークフロー、UI、設定 store
│   ├── types/
│   └── utils/
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 設定

**設定**（歯車アイコン）で API を設定：

- **Base URL** — API エンドポイント
- **API Key** — 認証キー
- **Provider** — OpenAI、Claude、DeepSeek、Gemini、Seedream、Ollama またはカスタム

詳細な設定と開発者向け説明は [モデル API 設定](docs/MODEL_API_CONFIG.md) を参照。

## 使い方

1. **ノード追加** — 左サイドバーからキャンバスへドラッグ
2. **接続** — 出力ハンドルを入力ハンドルに接続（同タイプまたは any）
3. **設定** — ノード選択後、右パネルでプロパティ編集
4. **実行** — 右上 **Run** でワークフロー実行
5. **保存・読み込み** — ツールバー/サイドバーでワークフロー保存・JSON エクスポート

## ノード種類

| カテゴリ | ノード |
|----------|--------|
| **生成** | テキスト/画像/動画/3D 生成、スクリプト実行 |
| **ユーティリティ** | テキスト/画像/動画/3D 入力 |
| **プレビュー** | テキスト/画像/動画/3D プレビュー |

新規ノードは [ノード開発](docs/NODE_DEVELOPMENT.md) を参照。

## 開発

- **新ノード**: [docs/NODE_DEVELOPMENT.md](docs/NODE_DEVELOPMENT.md) に従う
- **テーマ**: `tailwind.config.js`
- **翻訳**: `src/i18n/locales/`
- **実行**: `src/services/workflowExecutor.ts`

## ライセンス

MIT

## コントリビューション

**InspireFlow の構築に参加する皆さんを歓迎します。**

以下のようなモダンで効率的な開発スタイルでの参加を推奨しています。

- **Vibe coding・AI 活用** — Cursor、GitHub Copilot などの AI ペアプログラミングでアイデアを反復し、実装を探り、コードを磨いてください。意図の明確さと良い構造を大切にしています。AI と協力して素早く形にすることは大歓迎です。
- **小さく・オープンに** — 小さく焦点を絞った変更と議論を推奨します。アイデアや質問は Issue で、準備ができたら PR を。レビューで一緒に改善していきましょう。
- **ドキュメントもコード同様に** — ドキュメント・サンプル・テストの改善も、新機能と同様に歓迎します。ノードや機能を追加した際は [ノード開発](docs/NODE_DEVELOPMENT.md) や README の更新も検討してください。

typo 修正、ノード追加、i18n の改善、新しい方向性の提案など、どんな形でも貢献を歓迎します。Issue や Pull Request をお待ちしています。
