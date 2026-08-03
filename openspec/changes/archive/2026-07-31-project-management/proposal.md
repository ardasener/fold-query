## Why

The top bar's project dropdown is a mock: the project names are hardcoded, switching does nothing, and there is no way to persist work. Projects are the natural unit of work in FoldQuery — a CadQuery script and the conversation around it. This change makes projects real: stored on disk, switchable, creatable, renamable, and deletable, with auto-save so no work is lost.

## What Changes

- Projects are stored as directories in the OS app-data directory, keyed by UUID4 (so renames never touch paths): `model.py` (the script), `chat.json` (the LLM conversation history), and `meta.json` (id, name, timestamps). Writes are atomic (temp file + rename).
- The top-bar project dropdown is replaced by a project popover with a live search box, a "+" create button (generating a name via `unique-names-generator`), a scrollable project list (click to switch), and an edit button per project.
- The edit button opens a modal for renaming and deleting (delete confirmed via Popconfirm).
- First launch auto-creates a default project with a generated name.
- Auto-save: the editor source saves debounced; the chat history saves after each completed agent turn; switching projects flushes the current project before loading the target.
- On switch, the editor and chat rebuild from the loaded project (chat display derived from the LLM history).

## Capabilities

### New Capabilities
- `project-storage`: Projects persist as UUID-keyed directories in the app-data directory with `model.py`, `chat.json`, and `meta.json`, written atomically.
- `project-management`: A project popover in the top bar with search, create, switch, rename, and delete.
- `project-persistence`: Auto-save of source and chat, and restoration on project switch.

### Modified Capabilities
<!-- None — no existing spec behavior changes. -->

## Impact

- New dependency: `unique-names-generator`.
- Rust: new `project.rs` module (storage + commands), `AgentSession` gains a project id; commands `list_projects`, `create_project`, `load_project`, `save_project_source`, `rename_project`, `delete_project`; chat auto-save after agent turns.
- Frontend: new `ProjectSelector` popover + `ProjectEditModal`, `TopBar` rewired, `App.tsx` (project state, load/switch flows, debounced source save), `ChatPanel` (rebuild entries from loaded history).
