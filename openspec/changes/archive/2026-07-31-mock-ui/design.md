## Context

The boilerplate (`project-boilerplate` change) shipped a runnable Tauri 2 + React 19 + Ant Design 6 app with only a welcome screen. This change replaces that shell with an interactive mock of the main workbench so the layout and interactions can be evaluated before real features are built. The architecture (agent in Rust, thin Python sidecar, stdio JSON-RPC, uv-managed venv) is documented in `DESIGN.md` but is out of scope here — this change is frontend-only and entirely mocked.

## Goals / Non-Goals

**Goals:**
- A thin top bar with settings icon and project dropdown; macOS overlay titlebar integration.
- A draggable horizontal split (default 40/60) between two panes, position persisted.
- Left pane: CodeMirror editor (sample CadQuery script, Python highlighting) ↔ mock AI chat.
- Right pane: 3D viewer (sample object, orbit controls) ↔ print-preview placeholder.
- Icon-only view switching per pane (no tab bar).
- Establish reusable component patterns (`Pane` shell, platform detection) for future changes.

**Non-Goals:**
- No real model loading, CAD, or agent/LLM wiring.
- No dark theme or theming system (deferred to a later spec).
- No persistence beyond the split layout position.
- No changes to the Rust backend beyond window config.

## Decisions

### D1: macOS overlay titlebar via base config
Set `titleBarStyle: "Overlay"` and `hiddenTitle: true` in the base `src-tauri/tauri.conf.json` window config. Rationale: these fields are macOS-only, so other platforms ignore them; putting them in `tauri.macos.conf.json` would be wrong because platform configs merge via JSON Merge Patch (RFC 7396), which replaces the `windows` array wholesale and would drop the base window's title/size. The frontend top bar carries `data-tauri-drag-region` for dragging.

### D2: macOS platform detection without a new plugin
Detect macOS in the frontend via a small helper (`navigator.userAgent` check) and apply ~80px left padding in the top bar so the settings icon clears the traffic lights. Rationale: the `os` plugin would need Rust + JS changes for one boolean; a userAgent check is adequate for the mock. Revisit with the `os` plugin when a real need arises.

### D3: `react-resizable-panels` for the split
Use `react-resizable-panels` (v4) `Group`/`Panel`/`Separator` with the `useDefaultLayout` hook (persisting to `localStorage` by group id) for the draggable split. Rationale: current standard for resizable split panes; supports percentage defaults, min/max constraints, and localStorage persistence out of the box. (Note: the v2/v3 `PanelGroup`/`autoSaveId` API was superseded in v4.)

### D4: Single toggle-icon view switching per pane
Each pane renders a generic `Pane` shell (label + content + one icon button top-right). The button shows the icon of the view it switches to, with a tooltip; clicking toggles between the two views. Rationale: matches the requirement for a small icon instead of a tab bar, keeps the pane header minimal, and is reusable.

### D5: CodeMirror 6 via `@uiw/react-codemirror`
Use `@uiw/react-codemirror` with the `python()` extension from `@codemirror/lang-python` for syntax highlighting. Content is a small sample CadQuery script. No custom language config; default light theme and basic setup for now.

### D6: Mock AI chat via `@ant-design/x`
Use `@ant-design/x` components: a `Bubble.List` of mock messages, `Prompts` suggestion chips, and a `Sender` input. On send, append a user bubble and a canned assistant response locally. Rationale: gives a realistic chat feel without any backend; `@ant-design/x` 2.x is compatible with antd 6 / React 19.

### D7: 3D viewer via `@react-three/fiber` + drei
Use a `Canvas` from `@react-three/fiber` with drei's `OrbitControls` and `Grid`, a sample flat-shaded icosahedron with edge lines, and ambient + directional lights. Rationale: declarative React wrapper will scale to real mesh rendering later; drei provides controls/grid helpers out of the box.

### D8: Print preview placeholder
A styled placeholder: a white "paper sheet" card on a gray backdrop with a subtle grid pattern and a caption. Rationale: signals the print view without implying real export behavior.

### D9: Light theme (current default)
Keep the existing light AntD theme. No theming work in this change (deferred).

## Risks / Trade-offs

- [macOS overlay titlebar behavior varies with OS version] → Fallback: `decorations` remain standard; if the overlay renders poorly on the test machine, revert the two titlebar fields and keep the bar below the native titlebar (small config change only).
- [userAgent-based macOS detection is fragile] → Adequate for the mock; replace with the `os` plugin when platform logic grows.
- [`@ant-design/x` mock may imply agent functionality that doesn't exist] → Accepted for a mock; clearly non-functional sender.
- [three.js bundle size] → Not a concern for the mock; revisit code-splitting when real meshes render.
