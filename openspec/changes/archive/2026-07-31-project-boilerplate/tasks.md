## 1. Scaffold the app

- [x] 1.1 Scaffold Tauri 2 + React + TypeScript + Vite app from the official create-tauri-app template
- [x] 1.2 Point the project at Bun (`bun install`, `bun.lock`, bun task runner)
- [x] 1.3 Verify the scaffolded app runs via `bun tauri dev` before modification

## 2. Add Ant Design frame

- [x] 2.1 Install Ant Design 6 and React 19-compatible deps; resolve peer conflicts
- [x] 2.2 Replace the template's sample screen with an AntD `Layout` frame (header with app name, sider with placeholder nav, content area)
- [x] 2.3 Configure the theme via `ConfigProvider` with a token set
- [x] 2.4 Add the placeholder welcome screen in the content area describing the app's purpose
- [x] 2.5 Wire a minimal Tauri command invoke from the frontend to verify the Tauri bridge

## 3. Project files

- [x] 3.1 Write `.gitignore` covering Node/Bun, Rust/Tauri, and OS/editor artifacts
- [x] 3.2 Write `README.md` (project description, prerequisites, `bun install` / `bun tauri dev` / `bun tauri build`)
- [x] 3.3 Write `DESIGN.md` capturing the agreed architecture (agent in Rust, thin Python sidecar, stdio JSON-RPC, uv-managed venv, BYOK in Rust) and open decisions
- [x] 3.4 Write `AGENTS.md` with toolchain commands and conventions for coding agents

## 4. Verification

- [x] 4.1 `bun install` completes cleanly
- [x] 4.2 `bun tauri dev` launches the window with the frame and welcome screen; theme tokens render
- [x] 4.3 `bun tauri build` produces a distributable bundle
- [x] 4.4 Confirm git status (once initialized) ignores build artifacts while tracking source files
