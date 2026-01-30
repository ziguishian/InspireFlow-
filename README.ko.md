# InspireFlow (灵感流动)

**다른 언어 / Other languages:** [简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [Español](README.es.md)

노드 기반 AI 콘텐츠 제작·자동화 데스크톱 앱. 텍스트, 이미지, 비디오, 3D 생성을 위한 워크플로를 노드 연결로 구성합니다.

---

## 기능

- **디퓨전 스타일 UI** — 글래스모피즘, 다크 모드
- **노드 기반 워크플로** — ComfyUI/Dify 스타일 시각 편집기
- **AI 생성** — 텍스트·이미지·비디오·3D 모델 생성
- **다국어** — 5개 언어 전환 (위 링크 참고)
- **저장·불러오기** — 워크플로 JSON 내보내기/가져오기, 로컬 저장
- **확장** — 새 노드 추가 가능. [노드 개발](docs/NODE_DEVELOPMENT.md) 참고

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트 | React 18, Vite, TypeScript |
| 노드 에디터 | React Flow |
| 스타일 | Tailwind CSS, Framer Motion |
| 상태 | Zustand |
| 데스크톱 | Electron |
| i18n | i18next |

## 시작하기

### 요구 사항

- Node.js 18+
- npm 또는 yarn

### 설치 및 실행

```bash
# 의존성 설치
npm install

# Web 개발 서버만
npm run dev

# 데스크톱 앱 (Vite + Electron)
npm run electron:dev

# 프로덕션 빌드
npm run build
npm run electron:build   # 또는 Windows: npm run build:win
```

## 프로젝트 구조

```
mxinspireFlows/
├── docs/                    # 문서
│   ├── NODE_DEVELOPMENT.md  # 노드 개발 가이드
│   └── MODEL_API_CONFIG.md  # 모델 API 설정
├── electron/                # Electron 메인 프로세스
│   ├── main.js
│   └── preload.js
├── public/
├── scripts/                 # 빌드 스크립트
├── src/
│   ├── components/
│   │   ├── 3D/              # 3D 뷰어, GLB 미리보기
│   │   ├── Edges/           # 삭제 가능 엣지
│   │   ├── Layout/          # 캔버스, 탭바, 왼쪽 사이드바, 툴바, 패널
│   │   ├── Modals/          # 도움말, 단축키
│   │   ├── Settings/        # 설정 모달
│   │   ├── Toast/
│   │   └── UI/
│   ├── config/             # 앱 이름, 모델 매핑, 프로바이더
│   ├── contexts/           # 언어, 테마
│   ├── i18n/                # i18next 설정 및 로케일
│   ├── nodes/               # 노드 정의
│   │   ├── text-gen/        # 텍스트 생성
│   │   ├── image-gen/       # 이미지 생성
│   │   ├── video-gen/       # 비디오 생성
│   │   ├── 3d-gen/          # 3D 생성
│   │   ├── script-runner/   # 스크립트 실행
│   │   ├── *-input/         # 텍스트/이미지/비디오/3D 입력
│   │   ├── preview/         # 텍스트/이미지/비디오/3D 미리보기
│   │   ├── BaseNode.tsx
│   │   ├── handleSchema.ts
│   │   ├── index.ts
│   │   └── modelOptions.ts
│   ├── services/           # API 서비스, 워크플로 실행
│   ├── stores/             # 워크플로, UI, 설정 store
│   ├── types/
│   └── utils/
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 설정

**설정**(톱니 아이콘)에서 API 구성:

- **Base URL** — API 엔드포인트
- **API Key** — 인증 키
- **Provider** — OpenAI, Claude, DeepSeek, Gemini, Seedream, Ollama 또는 사용자 지정

자세한 설정 및 개발자 노트는 [모델 API 설정](docs/MODEL_API_CONFIG.md) 참고.

## 사용법

1. **노드 추가** — 왼쪽 사이드바에서 캔버스로 드래그
2. **연결** — 출력 핸들을 입력 핸들에 연결 (동일 타입 또는 any)
3. **설정** — 노드 선택 후 오른쪽 패널에서 속성 편집
4. **실행** — 우측 상단 **Run** 클릭
5. **저장·불러오기** — 툴바/사이드바에서 워크플로 저장, JSON 내보내기

## 노드 유형

| 카테고리 | 노드 |
|----------|------|
| **생성** | 텍스트/이미지/비디오/3D 생성, 스크립트 실행 |
| **유틸** | 텍스트/이미지/비디오/3D 입력 |
| **미리보기** | 텍스트/이미지/비디오/3D 미리보기 |

새 노드 추가는 [노드 개발](docs/NODE_DEVELOPMENT.md) 참고.

## 개발

- **새 노드**: [docs/NODE_DEVELOPMENT.md](docs/NODE_DEVELOPMENT.md) 참고
- **테마**: `tailwind.config.js`
- **번역**: `src/i18n/locales/`
- **실행**: `src/services/workflowExecutor.ts`

## 라이선스

MIT

## 기여

**InspireFlow를 함께 만들어 가실 분들을 환영합니다.**

다음과 같은 현대적이고 효율적인 방식으로 기여해 주시면 좋습니다.

- **바이브 코딩·AI 활용** — Cursor, GitHub Copilot 등 AI 페어 프로그래밍으로 아이디어를 반복하고, 구현을 탐색하고, 코드를 다듬어 보세요. 의도가 분명하고 구조가 좋은 것을 중요하게 봅니다. AI와 협업해 빠르게 구현하는 것을 환영합니다.
- **작은 단위·열린 논의** — 작고 집중된 변경과 논의를 권합니다. 아이디어나 질문은 Issue로, 준비되면 PR로 보내 주세요. 리뷰 과정에서 함께 개선해 나가면 됩니다.
- **문서와 코드 함께** — 문서·예제·테스트 개선도 새 기능만큼 환영합니다. 노드나 기능을 추가하셨다면 [노드 개발](docs/NODE_DEVELOPMENT.md)이나 README 업데이트를 고려해 주세요.

오타 수정, 노드 추가, i18n 보완, 새 방향 제안 등 어떤 형태든 기여를 환영합니다. Issue나 Pull Request를 보내 주세요.
