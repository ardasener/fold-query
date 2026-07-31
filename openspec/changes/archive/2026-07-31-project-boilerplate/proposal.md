## Why

FoldQuery is a desktop app for converting 3D models into papercraft templates (Unfolder/Pepakura-style). The project is a blank directory with no application code. Before any feature work, we need a working toolchain and a runnable UI shell so future changes (3D viewport, Python sidecar, agent) land on a solid, documented foundation.

## What Changes

- Scaffold a Tauri 2 desktop app with a React 19 + Ant Design 6 frontend.
- Use Vite as the bundler and dev server; Bun as the package manager and task runner.
- Ship a minimal Ant Design app frame: header, sider, and content areas with a theme configuration and a placeholder welcome screen.
- Add standard project files:
  - `.gitignore` covering Node, Bun, Rust, Tauri, and OS artifacts.
  - `README.md` describing what the project is and how to run it.
  - `DESIGN.md` capturing the agreed architecture (agent in Rust, thin Python sidecar, stdio JSON-RPC, managed Python venv) and explicitly open decisions.
  - `AGENTS.md` with workflow guidance for coding agents.
- Establish build/run tasks (dev, build, typecheck, lint) runnable via Bun.
- No git repository is initialized. No Python scaffolding. No features beyond the UI frame.

## Capabilities

### New Capabilities
- `app-shell`: The application launches a window with a minimal Ant Design frame (header/sider/content), a configured theme, and a placeholder welcome screen.
- `project-setup`: The project has a runnable Tauri + React + Ant Design toolchain using Vite and Bun, with standard project files (`.gitignore`, `README.md`, `DESIGN.md`, `AGENTS.md`) and consistent task scripts.

### Modified Capabilities
<!-- None — no existing specs. -->

## Impact

- New code: React frontend under `src/`, Tauri shell under `src-tauri/`, config files at repo root.
- Toolchain requirements: Rust toolchain (rustc/cargo 1.96+), Node/Bun (bun 1.2+), and the Tauri CLI.
- New dependencies: Tauri 2 (@tauri-apps/cli, @tauri-apps/api), React 19, Ant Design 6, Vite, TypeScript.
- No Python, no Rust app logic beyond the default Tauri window bootstrap.
