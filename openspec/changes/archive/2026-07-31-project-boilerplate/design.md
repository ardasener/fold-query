## Context

FoldQuery is a desktop app for converting 3D models into papercraft templates, targeting macOS and Windows. The eventual stack has four layers: a React + Ant Design frontend, a Tauri (Rust) shell, a Python sidecar running CadQuery, and an OpenAI-compatible agentic workflow (bring-your-own-key). The project is currently an empty directory with only OpenSpec structure. This change scaffolds the frontend + shell and records the agreed architecture so later changes build on consistent decisions.

## Goals / Non-Goals

**Goals:**
- A runnable Tauri 2 app with a React 19 + Ant Design 6 frame (header/sider/content), theme config, and welcome screen.
- Vite as bundler/dev-server; Bun as package manager and task runner; TypeScript.
- Standard project files: `.gitignore`, `README.md`, `DESIGN.md`, `AGENTS.md`.
- Document the agreed architecture in `DESIGN.md` for future changes.

**Non-Goals:**
- No Python scaffolding or sidecar.
- No 3D viewport, model loading, or CAD functionality.
- No agent or LLM integration.
- No git repository initialization.
- No code editor integration (editor choice is an open decision).

## Decisions

### D1: Scaffold via create-tauri-app template, then adjust
Start from the official Tauri React + TypeScript + Vite template and adjust (add Ant Design, trim the template's sample code). Rationale: the template is the battle-tested path for Tauri + Vite wiring; hand-rolling it invites configuration drift.

### D2: Vite as bundler, Bun as package manager/runtime
Bun runs `vite` (dev server and build) and manages `node_modules` via `bun install`/`bun.lock`. Alternatives considered: Bun's native bundler — no first-class Tauri template support and more manual config, rejected. Vite is what the Tauri template and its docs assume.

### D3: Ant Design 6 with React 19
`antd` 6.x is current and supports React 19. Theme via AntD's `ConfigProvider` token customization (algorithm for light/dark as needed). Alternatives: React 18 + older AntD — rejected, both current majors are compatible.

### D4: App frame only — header, sider, content
The frame uses AntD `Layout` with a `Header` (app title), `Sider` (placeholder navigation), and `Content` (welcome screen). This proves the toolchain and gives future changes (viewport, part tree, settings, agent chat) a place to land. No functionality beyond placeholders.

### D5: Standard project files at repo root
- `.gitignore` — Node/Bun (`node_modules`, `dist`, `*.log`, `bun.lock` is committed), Rust/Tauri (`target/`, `src-tauri/gen`), OS junk, IDE dirs.
- `README.md` — what the project is, prerequisites, how to run (`bun install`, `bun tauri dev`), how to build.
- `DESIGN.md` — the agreed architecture described below plus explicitly open decisions.
- `AGENTS.md` — workflow guidance for coding agents (consistent with the repo's tooling).

### D6: DESIGN.md records the agreed architecture

Captured decisions from the exploration:
- **Two-stage pipeline**: model authoring (an agent writes CadQuery code to produce 3D geometry) then mechanical conversion (unfold → tabs → pack → export).
- **Agent lives in Rust, not Python.** Rationale: Python is the only uncontrolled runtime dependency (not bundled, client's version unknown), so the product's core logic must not depend on it. The agent loop (LLM calls, conversation state, tool dispatch) runs in the compiled Rust binary. The sidecar is a thin, replaceable execution engine.
- **Thin Python sidecar**: executes CadQuery scripts and returns stdout/stderr/exit; runs the mechanical pipeline (which inherently requires CadQuery).
- **JSON-RPC over stdio** between Rust and the sidecar: private single-client IPC, native bidirectional streaming for progress/token events, identical behavior on macOS and Windows, no port/firewall/sandbox surface. Transport will be abstracted on both sides so it can be swapped (e.g., HTTP) if the agent goes remote.
- **Managed Python venv** bootstrapped on first run via `uv`: the app creates an isolated venv and installs pinned/locked deps (CadQuery, sidecar package), so version drift from the client's system Python is controlled without bundling a Python runtime.
- **BYOK key handling in Rust** (OS keychain), never in the webview.
- **Executing LLM-generated code** needs a sandbox/consent design (subprocess, timeout, restricted working dir, user approval) — deferred.

Explicitly open decisions (recorded, not decided):
- Code editor integration (Monaco or alternatives) — deferred to the editor spec.
- Sidecar transport details (stdio framing, fd reservation) — deferred to the sidecar spec.

## Risks / Trade-offs

- [Tauri template pins specific Vite/TS versions; upgrades can lag] → Pin the versions the template ships; bump deliberately.
- [AntD 6 + React 19 peer-dep friction with the template's dependencies] → Install AntD after scaffolding and resolve peer conflicts with `bun` at install time.
- [macOS first-run of a Tauri dev app may prompt for permissions in later changes] → Not applicable to this change (no native features used).
- [Designing the architecture before the sidecar exists risks over-speccing] → DESIGN.md marks deferred decisions explicitly; later changes revisit them.
