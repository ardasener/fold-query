# FoldQuery

Convert 3D models into papercraft templates. A desktop app (Tauri + React + Ant Design) that unfolds 3D geometry into flat, print-ready papercraft nets — similar to Unfolder for macOS and Pepakura for Windows.

> Work in progress. This is the initial boilerplate: a runnable app shell with a welcome screen. The CAD pipeline (unfolding, tabs, packing, export) and the agentic workflow are not implemented yet. See [DESIGN.md](./DESIGN.md) for the planned architecture.

## Tech stack

- **Tauri 2** — desktop shell (Rust)
- **React 19 + Ant Design 6** — frontend
- **Vite** — bundler and dev server
- **Bun** — package manager and task runner
- **TypeScript**

Planned (not yet wired): a Python + CadQuery sidecar for CAD operations and an OpenAI-compatible agentic workflow (bring-your-own-key).

## Prerequisites

- [Bun](https://bun.sh) 1.2+
- [Rust](https://rustup.rs) toolchain (rustc/cargo 1.96+)
- macOS / Windows / Linux for desktop development

## Getting started

```sh
bun install
bun tauri dev
```

This starts the Vite dev server and launches the app in a native window.

## Building

```sh
bun tauri build
```

Produces a distributable bundle for the current platform in `src-tauri/target/release/bundle/`.

## Project layout

```
src/          React frontend (Ant Design UI)
src-tauri/    Tauri shell (Rust)
openspec/     OpenSpec change proposals
```

## Development workflow

- Frontend only: `bun dev` (Vite dev server without the Tauri window)
- Type-check and build frontend: `bun build`
