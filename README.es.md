# InspireFlow (灵感流动)

**Otros idiomas / Other languages:** [简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Aplicación de escritorio para creación y automatización de contenido con IA basada en nodos. Construye flujos de trabajo conectando nodos para texto, imagen, vídeo y 3D.

---

## Características

- **UI estilo difusión** — Diseño glassmorphism, modo oscuro
- **Flujo por nodos** — Editor visual tipo ComfyUI/Dify
- **Generación IA** — Texto, imagen, vídeo y modelos 3D
- **Multilingüe** — Cambio entre 5 idiomas (enlaces arriba)
- **Guardar / cargar** — Exportar e importar flujos como JSON; persistencia local
- **Extensible** — Añadir nuevos nodos. Ver [Desarrollo de nodos](docs/NODE_DEVELOPMENT.md)

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18, Vite, TypeScript |
| Editor de nodos | React Flow |
| Estilos | Tailwind CSS, Framer Motion |
| Estado | Zustand |
| Escritorio | Electron |
| i18n | i18next |

## Primeros pasos

### Requisitos

- Node.js 18+
- npm o yarn

### Instalación y ejecución

```bash
# Instalar dependencias
npm install

# Solo servidor web de desarrollo
npm run dev

# App de escritorio (Vite + Electron)
npm run electron:dev

# Build de producción
npm run build
npm run electron:build   # o Windows: npm run build:win
```

## Estructura del proyecto

```
mxinspireFlows/
├── docs/                    # Documentación
│   ├── NODE_DEVELOPMENT.md  # Guía de desarrollo de nodos
│   └── MODEL_API_CONFIG.md  # Configuración de API de modelos
├── electron/                # Proceso principal Electron
│   ├── main.js
│   └── preload.js
├── public/
├── scripts/                 # Scripts de build
├── src/
│   ├── components/
│   │   ├── 3D/              # Visor 3D, vista previa GLB
│   │   ├── Edges/           # Aristas eliminables
│   │   ├── Layout/          # Canvas, pestañas, barra lateral, barra de herramientas, paneles
│   │   ├── Modals/          # Ayuda, atajos
│   │   ├── Settings/        # Modal de configuración
│   │   ├── Toast/
│   │   └── UI/
│   ├── config/             # Nombre de app, mapeo de modelos, proveedores
│   ├── contexts/           # Idioma, tema
│   ├── i18n/                # Config i18next y locales
│   ├── nodes/               # Definición de nodos
│   │   ├── text-gen/        # Generación de texto
│   │   ├── image-gen/       # Generación de imagen
│   │   ├── video-gen/       # Generación de vídeo
│   │   ├── 3d-gen/          # Generación 3D
│   │   ├── script-runner/   # Ejecución de scripts
│   │   ├── *-input/         # Entrada texto/imagen/vídeo/3D
│   │   ├── preview/         # Vista previa texto/imagen/vídeo/3D
│   │   ├── BaseNode.tsx
│   │   ├── handleSchema.ts
│   │   ├── index.ts
│   │   └── modelOptions.ts
│   ├── services/           # API, ejecutor de flujos
│   ├── stores/             # workflow, UI, settings
│   ├── types/
│   └── utils/
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Configuración

En **Configuración** (icono de engranaje) configurar API:

- **Base URL** — Endpoint de la API
- **API Key** — Clave de autenticación
- **Provider** — OpenAI, Claude, DeepSeek, Gemini, Seedream, Ollama o personalizado

Ver [Configuración de API de modelos](docs/MODEL_API_CONFIG.md) para detalles y notas para desarrolladores.

## Uso

1. **Añadir nodos** — Arrastrar desde la barra lateral al canvas
2. **Conectar** — Conectar salidas a entradas (mismo tipo o any)
3. **Configurar** — Seleccionar nodo y editar propiedades en el panel derecho
4. **Ejecutar** — Pulsar **Run** arriba a la derecha
5. **Guardar / cargar** — Usar barra de herramientas o lateral para guardar/cargar y exportar JSON

## Tipos de nodos

| Categoría | Nodos |
|-----------|--------|
| **Generación** | Texto, imagen, vídeo, 3D, script |
| **Utilidad** | Entrada texto/imagen/vídeo/3D |
| **Vista previa** | Vista previa texto/imagen/vídeo/3D |

Añadir nodos: [Desarrollo de nodos](docs/NODE_DEVELOPMENT.md).

## Desarrollo

- **Nuevos nodos**: Seguir [docs/NODE_DEVELOPMENT.md](docs/NODE_DEVELOPMENT.md)
- **Tema**: `tailwind.config.js`
- **Traducciones**: `src/i18n/locales/`
- **Ejecución**: `src/services/workflowExecutor.ts`

## Licencia

MIT

## Contribuir

**Todo el mundo está invitado a participar en el desarrollo de InspireFlow.**

Animamos a usar flujos de trabajo modernos y eficientes al contribuir:

- **Vibe coding y desarrollo con IA** — Usa programación en pareja con IA (Cursor, GitHub Copilot, etc.) para iterar ideas, explorar implementaciones y refinar código. Valoramos la claridad de intención y una buena estructura; no dudes en colaborar con IA para avanzar más rápido.
- **Iteración abierta** — Preferimos cambios pequeños y enfocados y el debate en abierto. Abre un issue para proponer ideas o preguntar; abre un PR cuando estés listo. Nos encanta iterar juntos en la revisión.
- **Documentación y código** — Mejoras en documentación, ejemplos y tests son tan bienvenidas como nuevas funcionalidades. Si añades un nodo o feature, considera actualizar [Desarrollo de nodos](docs/NODE_DEVELOPMENT.md) o el README.

Ya sea corrigiendo un typo, añadiendo un nodo, mejorando i18n o sugiriendo una nueva dirección: gracias por ayudar a mejorar InspireFlow. Abre un issue o pull request cuando quieras.
