## ADDED Requirements

### Requirement: Project toolchain installed and documented
The project MUST use Bun as the package manager and task runner, Vite as the bundler/dev server, React 19 with TypeScript, and Tauri 2. The `README.md` MUST document prerequisites and how to run the app.

#### Scenario: Dependencies install
- **WHEN** a developer runs `bun install` in the project root
- **THEN** all frontend and Tauri CLI dependencies install successfully

#### Scenario: Dev server runs
- **WHEN** a developer runs `bun tauri dev`
- **THEN** Vite serves the frontend and Tauri compiles and opens the app window

#### Scenario: Production build
- **WHEN** a developer runs `bun tauri build`
- **THEN** the app builds and produces a distributable bundle

### Requirement: Standard project files exist
The repository MUST contain `.gitignore`, `README.md`, `DESIGN.md`, and `AGENTS.md` at the root.

#### Scenario: Files present
- **WHEN** the repository is inspected at the root
- **THEN** `.gitignore`, `README.md`, `DESIGN.md`, and `AGENTS.md` exist

### Requirement: .gitignore covers the toolchain
The `.gitignore` MUST exclude Node/Bun, Rust/Tauri, and OS/editor artifacts while keeping source files tracked.

#### Scenario: Build artifacts ignored
- **WHEN** the project is built
- **THEN** `node_modules/`, `dist/`, `src-tauri/target/`, and other build artifacts are ignored by git

### Requirement: DESIGN.md records the architecture
The `DESIGN.md` MUST document the agreed architecture, including: the two-stage pipeline (model authoring, then mechanical conversion), the agent living in Rust, a thin Python sidecar, JSON-RPC over stdio for sidecar transport, a `uv`-managed Python venv, and BYOK handling in Rust. It MUST also explicitly list open decisions.

#### Scenario: Architecture captured
- **WHEN** `DESIGN.md` is read
- **THEN** it contains the agreed architecture decisions and a list of explicitly open decisions

### Requirement: AGENTS.md provides workflow guidance
The `AGENTS.md` MUST describe how coding agents should work in this repository (toolchain commands, conventions, verification steps).

#### Scenario: Guidance present
- **WHEN** `AGENTS.md` is read
- **THEN** it lists the commands and conventions agents should follow
