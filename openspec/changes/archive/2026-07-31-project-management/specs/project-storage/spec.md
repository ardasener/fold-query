## ADDED Requirements

### Requirement: Projects stored as UUID-keyed directories
Projects MUST be stored as directories under the OS app-data directory, each named by a UUID4. Each project MUST contain `model.py` (the script), `chat.json` (the conversation messages), and `meta.json` (id, name, created/updated timestamps). File writes MUST be atomic.

#### Scenario: Project directory layout
- **WHEN** a project is created
- **THEN** a UUID-named directory appears under the projects root with `model.py`, `chat.json`, and `meta.json`

#### Scenario: Rename does not move files
- **WHEN** a project is renamed
- **THEN** only `meta.json`'s name changes and the directory path stays the same

#### Scenario: No partial writes
- **WHEN** a project file is saved
- **THEN** it is written atomically (temp file + rename)
