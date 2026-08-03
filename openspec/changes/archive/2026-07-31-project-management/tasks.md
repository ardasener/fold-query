## 1. Rust storage

- [x] 1.1 Add `uuid` crate; create `src-tauri/src/project.rs`: data-dir projects root, UUID-keyed project dirs, atomic writes, `ProjectInfo`/`ProjectData` types, read/write of `model.py`, `chat.json`, `meta.json`
- [x] 1.2 Commands: `list_projects` (sorted by updatedAt desc), `create_project(name)`, `load_project(id)` (flush current session chat, swap session, return `{id, name, source, messages}`), `save_project_source(id, source)`, `rename_project(id, name)`, `delete_project(id)`
- [x] 1.3 `AgentSession` gains `project_id`; after each completed agent turn, Rust saves `chat.json` + refreshes `meta.json.updatedAt` for the active project
- [x] 1.4 Register commands in `lib.rs`; `cargo check` passes

## 2. Frontend selector UI

- [x] 2.1 Add `unique-names-generator`; create `src/components/projects/ProjectSelector.tsx` (Popover: search Input + create button + scrollable list; active highlight; per-row edit button) and `ProjectEditModal.tsx` (rename Input + delete with Popconfirm)
- [x] 2.2 Wire `TopBar.tsx` to use `ProjectSelector` instead of the mock dropdown

## 3. App wiring

- [x] 3.1 `App.tsx`: project list + active project state; on ready, ensure a default project exists (create + load when none)
- [x] 3.2 Switch flow: flush pending source save → `load_project` → update source + pass loaded chat to `ChatPanel`
- [x] 3.3 Debounced `save_project_source` on editor source changes
- [x] 3.4 Delete flow: if active deleted, switch to most recently used remaining project (or create + load a default)
- [x] 3.5 `ChatPanel.tsx`: rebuild display entries from loaded project messages (user/assistant bubbles + "Tool result" Think blocks)

## 4. Verification

- [x] 4.1 `cargo check` and `bun run build` pass
- [x] 4.2 First launch creates and activates a default project
- [x] 4.3 Create, switch, rename, and delete projects work via the popover; search filters live
- [x] 4.4 Editor edits and agent turns auto-save; switching flushes and restores script + chat
- [x] 4.5 Project files exist under the data dir with the UUID layout
