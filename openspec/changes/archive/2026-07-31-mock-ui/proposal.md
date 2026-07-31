## Why

The boilerplate shell has only a welcome screen. To get a feel for how FoldQuery will work before building real functionality, we need an interactive mock of the main workbench: a top bar, a draggable split with a code editor / AI chat on the left and a 3D viewer / print preview on the right. This mock validates the layout and establishes the UI component patterns later changes will build on.

## What Changes

- Add a thin top bar with a (non-functional) settings icon on the left and a project dropdown on the right.
- On macOS, integrate the top bar into the window titlebar via Tauri's overlay titlebar (`titleBarStyle: "Overlay"`, `hiddenTitle: true`), with the traffic lights floating over the bar.
- Replace the welcome screen with a horizontal, draggable split (default 40/60) using `react-resizable-panels`; the split position persists across restarts.
- Left pane: two switchable views — a CodeMirror 6 editor (`@uiw/react-codemirror` + `@codemirror/lang-python`) showing a sample CadQuery script with highlighting, and a mock AI chat built from `@ant-design/x` components.
- Right pane: two switchable views — a 3D viewer (`@react-three/fiber` + drei) showing a sample object with orbit controls, and a print-preview placeholder.
- Each pane has a slim header with a single icon button in the top-right corner that switches between its two views (no tab bar).
- No real functionality: no model loading, no LLM calls, no editor-to-agent wiring.

## Capabilities

### New Capabilities
- `workbench-shell`: The main window shows a top bar (settings icon, project dropdown, macOS overlay titlebar) and a draggable horizontal split with two panes.
- `pane-views`: Each pane hosts two switchable views, toggled by an icon button in the pane header — editor/chat on the left, 3D viewer/print preview on the right.

### Modified Capabilities
<!-- None — no existing specs. -->

## Impact

- New dependencies: `@uiw/react-codemirror`, `@codemirror/lang-python`, `@ant-design/x`, `react-resizable-panels`, `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`.
- Frontend components under `src/components/` plus an updated `src/App.tsx`.
- Window config change in `src-tauri/tauri.conf.json` (macOS-only titlebar fields).
- The welcome screen is replaced by the workbench mock.
