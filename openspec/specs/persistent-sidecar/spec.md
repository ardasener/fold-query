# persistent-sidecar Specification

## Requirements

### Requirement: Persistent Python sidecar
The application MUST spawn a persistent Python process (once the environment is ready) that imports CadQuery once and serves requests over NDJSON/JSON-RPC on stdio, restarting it on demand if it dies.

#### Scenario: Sidecar serves run_script
- **WHEN** a `run_script` request is sent with a source string
- **THEN** the sidecar executes it and returns the script result (stdout, error, tessellated objects)

#### Scenario: Sidecar serves get_docs
- **WHEN** a `get_docs` request is sent with a symbol path (e.g. `Workplane.box`)
- **THEN** the sidecar returns the symbol's docstring, or a not-found error

#### Scenario: Sidecar restart
- **WHEN** the sidecar process has died
- **THEN** the next request spawns a fresh sidecar and is served

### Requirement: Run uses the sidecar
The Run button MUST execute scripts through the persistent sidecar rather than spawning a fresh Python process per run.

#### Scenario: Run via sidecar
- **WHEN** the user clicks Run
- **THEN** the script executes through the persistent sidecar and the result is returned
