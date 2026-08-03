## Context

The top-bar project dropdown is a mock (hardcoded names, no switching). Projects are the unit of work: a CadQuery script + the conversation around it. Exploration decisions: store projects as directories in the OS app-data directory (not cache — cache holds the disposable venv) keyed by UUID4; the script is a plain `model.py`, the chat is `chat.json` (the LLM history array, the source of truth), and `meta.json` holds id/name/timestamps; the dropdown becomes a searchable popover with create/switch/rename/delete; auto-save everywhere.

## Goals / Non-Goals

**Goals:**
- Persist projects (script + chat) in the app-data directory, UUID-keyed, atomic writes.
- Real project switching that restores the editor and chat; the agent session follows the active project.
- Create (with generated names), rename, and delete projects.
- Auto-save source (debounced) and chat (after each agent turn) with no data loss.
- First-launch default project.

**Non-Goals:**
- No per-project settings (theme, fonts, provider) — those stay global.
- No project export/import or sharing.
- No per-project sidecar/pipeline state beyond the script and chat.

## Decisions

### D1: Data directory, not cache
Projects live in `app.path().app_data_dir()/projects/`. The cache directory is for disposable artifacts (the Python venv); projects are user data that must survive OS cache purges and be backed up.

### D2: UUID4 directory keys
Each project directory is a UUID4 (e.g. `8f3a…/`). Display names live only in `meta.json`, so renaming never touches the filesystem layout and no slug sanitization is needed. `meta.json` = `{ id, name, createdAt, updatedAt }`; `model.py` = the script; `chat.json` = the conversation messages array (user/assistant/tool, no system prompt).

### D3: LLM history is the chat source of truth
`chat.json` stores the same message array the agent session uses. On load, Rust restores the session from it (prepending a fresh system prompt); the frontend derives the display entries (user bubbles, assistant bubbles, and a "Tool result" Think block per tool message). Trade-off: derived tool blocks use a generic title rather than the original "Running script" etc. — accepted.

### D4: Atomic writes
All file writes go to a temp file in the same directory then rename over the target, so a crash never leaves a truncated project file.

### D5: Auto-save
- Editor source: the frontend saves debounced (~1s) via `save_project_source`.
- Chat: Rust writes `chat.json` (and refreshes `meta.json.updatedAt`) after each completed agent turn.
- Switching projects: the frontend flushes the pending source save, then `load_project` (which first flushes the current session's chat) swaps the session and returns the loaded project's data.

### D6: Agent session follows the active project
`AgentSession` gains `project_id`. `load_project(id)` replaces the session's history and source with the project's data. The trim counter resets per project (the boundary note is per-conversation).

### D7: Popover selector UI
The top bar button (folder icon + active name + caret) opens an AntD `Popover` containing: a search `Input` (case-insensitive name filter) with a `+` button beside it; below, a scrollable list of matching projects. Clicking a row (other than the active one) switches; the active row is highlighted. Each row has an edit (pencil) button. `unique-names-generator` (verified 4.7.1) creates initial names (adjective-noun, e.g. `fierce-fox`).

### D8: Edit modal
The pencil opens an AntD `Modal` with a rename `Input` and a danger-zone delete button wrapped in a `Popconfirm`. Deleting removes the directory; if the deleted project was active, the frontend switches to the most recently used remaining project (or creates and loads a new default when none remain).

### D9: First-launch default
When the app becomes ready, if no projects exist, the frontend creates one with a generated name and loads it, so there is always an active project.

## Risks / Trade-offs

- [Chat display derived from history loses think-block titles] → Accepted; functional and consistent with D3.
- [Debounced source save could lose the last edit if the app closes mid-debounce] → The switch flow flushes explicitly; window-close flushing could be added later.
- [UUID dirs are opaque to humans] → `meta.json` carries the name; a future "reveal in file manager" could help.
- [Delete is destructive] → Popconfirm confirmation; the directory is removed, no trash.
