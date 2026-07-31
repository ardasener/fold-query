## 1. Dependencies

- [x] 1.1 Add `@uiw/react-codemirror`, `@codemirror/lang-python`, `@ant-design/x`, `react-resizable-panels`, `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` via `bun add`
- [x] 1.2 Confirm `bun install` resolves without peer conflicts

## 2. Window config

- [x] 2.1 Set `titleBarStyle: "Overlay"` and `hiddenTitle: true` on the window in `src-tauri/tauri.conf.json`

## 3. Shell and split

- [x] 3.1 Create `src/lib/platform.ts` with a macOS detection helper
- [x] 3.2 Create `src/components/TopBar.tsx`: drag region, macOS traffic-light padding, settings icon (non-functional), project dropdown with mock projects
- [x] 3.3 Create `src/components/Pane.tsx`: slim header with label + single switch icon button (top-right) that toggles between two views
- [x] 3.4 Replace `src/App.tsx` content with the workbench: `TopBar` + split (40/60, min sizes, persisted) with left/right `Pane`s

## 4. Left pane views

- [x] 4.1 Create `src/components/code-editor/CodeEditor.tsx`: CodeMirror 6 with Python highlighting and a sample CadQuery script
- [x] 4.2 Create `src/components/chat/ChatPanel.tsx`: `@ant-design/x` mock chat (Bubble.List, Prompts, Sender with local canned reply)

## 5. Right pane views

- [x] 5.1 Create `src/components/viewer/ViewerPanel.tsx`: `@react-three/fiber` Canvas, drei Grid + OrbitControls, flat-shaded icosahedron with edges, lights
- [x] 5.2 Create `src/components/print/PrintPreview.tsx`: paper-sheet placeholder

## 6. Verification

- [x] 6.1 `bun run build` passes (tsc type-check + Vite build)
- [x] 6.2 `bun tauri dev` launches; top bar renders with settings + project dropdown
- [x] 6.3 Pane switch icons toggle editor/chat and viewer/print
- [x] 6.4 Drag divider resizes panes; split position persists after restart
- [x] 6.5 On macOS, traffic lights float over the top bar and the bar drags the window
