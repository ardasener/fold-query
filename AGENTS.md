# AGENTS.md

Guidance for coding agents working in this repository. Follow this before the shared workflow defaults.

## Project

FoldQuery — a Tauri 2 + React 19 + Ant Design 6 desktop app for converting 3D models into papercraft templates. The current codebase is a boilerplate UI shell; the CAD pipeline and agentic workflow are planned but not implemented. See [DESIGN.md](./DESIGN.md) for the architecture.

## Toolchain

- **Bun** is the package manager and task runner. Use `bun`, never `npm`/`yarn`.
- **Vite** is the bundler. `bun run dev` starts the Vite dev server; `bun tauri dev` runs the full app.
- **Rust** (stable) under `src-tauri/`. `cargo check` from `src-tauri/` for Rust-only checks.
- **TypeScript** for the frontend. Run `bun run build` to type-check and build.

## Commands

| Command | Purpose |
|---|---|
| `bun install` | Install dependencies (keeps `bun.lock`) |
| `bun tauri dev` | Run the app in a native window (Vite + Rust) |
| `bun run dev` | Vite dev server only (no Tauri window) |
| `bun run build` | `tsc` type-check + Vite production build |
| `bun tauri build` | Produce a distributable bundle |

## Conventions

- Keep comments minimal; document intent, not implementation.
- Frontend lives in `src/`, Rust in `src-tauri/`, Python (future) in `python/`.
- Ant Design v6 with React 19. Theme tokens are configured in `src/main.tsx`.
- Do not add new major dependencies without a documented reason.
- Tauri commands are declared in `src-tauri/src/lib.rs` and invoked from the frontend via `@tauri-apps/api/core`'s `invoke`.

## Verification

After changes, run the relevant checks before claiming completion:
- Frontend: `bun run build` (type-check + build)
- Rust: `cargo check` in `src-tauri/`
- Full app smoke test: `bun tauri dev` launches without panics; the welcome screen renders and the Tauri bridge tag shows "connected"

## OpenSpec workflow

Changes are tracked in `openspec/changes/<name>/` (proposal, design, specs, tasks). Use the OpenSpec commands provided in this environment:
- `/opsx:explore` — think through an idea before proposing
- `/opsx:propose "..."` — create a change proposal
- `/opsx:apply` — implement tasks for the active change
- `/opsx:archive` — archive a completed change
