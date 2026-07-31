# FoldQuery Design

This document records the agreed architecture and the reasoning behind it. It is a living document: decisions here are made deliberately, and open questions are tracked explicitly.

## Product vision

FoldQuery is a desktop app for converting 3D models into papercraft templates (similar to Unfolder on macOS and Pepakura on Windows). The user loads or generates a 3D model, unfolds it into a flat net with glue tabs, packs the parts onto sheets, and exports print-ready templates.

## Tech stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 + Ant Design 6 | UI: viewport, part tree, settings, agent chat |
| Shell | Tauri 2 (Rust) | Window, native services, **application brain** |
| CAD | Python + CadQuery | 3D model generation and mechanical conversion |
| Agent | OpenAI-compatible API (BYOK) | Writes CadQuery code to produce models |

Toolchain: Bun (package manager/runner), Vite (bundler).

## The two-stage pipeline

The core workflow splits into two distinct stages:

```
  model authoring              mechanical conversion
┌───────────────────┐      ┌────────────────────────────┐
│  agent writes     │      │  unfold → tabs → pack →    │
│  CadQuery code →  │ ───▶ │  export                    │
│  valid 3D geometry│      │  (deterministic algorithms)│
└───────────────────┘      └────────────────────────────┘
```

1. **Model authoring** — an agent writes CadQuery source code; the code is executed and iterated until it produces valid 3D geometry. The CadQuery script is the artifact the user can review, edit, and re-run.
2. **Mechanical conversion** — a deterministic pipeline converts the finished geometry into flat nets: unfold into faces, generate glue tabs, pack parts onto sheets, export SVG/PDF/PNG.

Reference algorithms for the mechanical stage:
- **Blender `export_paper_model.py`** — unfolding math, angle thresholds, and flap generation (blueprint).
- **`osresearch/papercraft`** (C) — STL-to-SVG unfolding with collision-checked part packing.
- **`rodrigorc/papercraft`** (C++/OpenGL) — full interactive unwrapper; a UX reference.

## Agreed decisions

### D1: The agent lives in Rust, not Python

The agent loop (LLM calls, conversation state, tool dispatch) runs in the compiled Rust binary.

**Why:** Python is the only uncontrolled runtime dependency — we do not bundle a Python interpreter, so the client's Python version is unknown and outside our control. The product's core logic must not depend on an environment we don't own. The agent is the most important logic in the app, so it lives in the one place we fully control: the bundled binary.

The LLM API is plain HTTP/JSON, so Rust (`reqwest`) hosts the loop naturally. An additional benefit: the BYOK key is handled in Rust (read from the OS keychain) and never exposed to the webview.

### D2: The Python sidecar is thin

Python runs only what inherently requires CadQuery:
- Execute a CadQuery script and return stdout/stderr/exit status (the agent's "run" tool).
- Run the mechanical pipeline (unfold/tabs/pack/export), which is CadQuery-bound.

No conversation state, no agent logic, no decision-making in Python. The sidecar is a replaceable execution engine.

### D3: JSON-RPC over stdio between Rust and the sidecar

The Rust ↔ Python transport is JSON-RPC framed as newline-delimited JSON over the sidecar's stdio.

**Why:** it is private single-client IPC (only the Rust shell talks to the sidecar), so HTTP's discoverability buys nothing. stdio gives:
- Native full-duplex bidirectional streaming (token streaming, progress events) with correlation IDs.
- Identical behavior on macOS and Windows.
- No ports, no firewall/sandbox/entitlement surface, no auth token needed.
- No extra Python dependencies.

**Framing discipline:** protocol on stdout as NDJSON; all logs to stderr. If native libraries still pollute stdout, reserve a dedicated fd (e.g., fd 3) for the protocol.

**Hedge:** the transport is abstracted on both sides (a `SidecarClient` trait in Rust, a transport module in Python) so it can be swapped for HTTP if the agent ever goes remote or needs multi-client.

### D4: Managed Python venv bootstrapped via `uv`

To control Python/CadQuery version drift without bundling a Python runtime, the app bootstraps an isolated environment on first run:

```
detect system Python → uv venv (app data dir) → uv pip install pinned/locked deps
→ spawn sidecar from the venv's python
```

`uv` can fetch a known-good standalone CPython if the system one is unusable. Deps (CadQuery, the sidecar package) are pinned via a lockfile.

### D5: BYOK key handling in Rust

The user's API key and base URL for the OpenAI-compatible provider are stored via the OS keychain and handled by Rust. The webview never holds the key. Provider configuration is a future settings capability.

## Open questions

- **Code editor integration** — whether/how to embed a code editor for the CadQuery script (e.g., Monaco) is undecided; explore when the editor spec is written.
- **Sidecar transport details** — stdio framing specifics and fd reservation are decided at a high level above; exact protocol messages are deferred to the sidecar spec.
- **Sandboxing agent-generated code** — executing LLM-generated Python needs a consent/sandbox design (subprocess with timeout, restricted working directory, user approval to run). Deferred.
- **Geometry preview** — how the sidecar produces a 3D preview for the viewport (exported mesh format, event flow) is undecided.

## Risks and trade-offs

- **Agent-generated code execution** — the sidecar executes LLM-written Python on the user's machine. Needs the consent/sandbox design above.
- **Python/CadQuery compatibility** — CadQuery/OCP wheels lag newest CPython releases. Mitigated by the pinned, `uv`-managed venv (D4).
- **Python runtime absent or broken** — first-run bootstrap must degrade gracefully with a clear setup flow.
- **Single-stdio bottleneck** — one pipe multiplexes all traffic; fine for a local single-user app but the abstraction (D3 hedge) keeps an escape hatch.
