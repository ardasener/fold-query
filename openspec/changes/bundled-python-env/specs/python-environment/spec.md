## ADDED Requirements

### Requirement: Micromamba-first environment detection
The app SHALL prefer a bundled-micromamba-provisioned environment over system Python, checking for it first at startup.

#### Scenario: Micromamba environment ready
- **WHEN** the micromamba-provisioned environment under the cache directory works
- **THEN** the app uses it and reports the environment source as micromamba

#### Scenario: Micromamba unavailable, existing venv works
- **WHEN** no micromamba environment exists but a working `venv` is present
- **THEN** the app uses the existing venv without re-provisioning and reports the source as venv

#### Scenario: Only system Python available
- **WHEN** neither micromamba nor a venv environment exists but system Python 3.11+ with `venv` and `pip` is available
- **THEN** the app provisions a venv via system Python as before and reports the source as system

#### Scenario: Environment source reported
- **WHEN** the environment check completes
- **THEN** the app exposes which environment source is active (micromamba, venv, or system) for the UI to display

### Requirement: Environment setup UI labels the active path
The setup modal SHALL present the environment flow as provisioning and clearly label which environment source is in use.

#### Scenario: Provisioning in progress
- **WHEN** the micromamba environment is being provisioned
- **THEN** the modal shows a spinner with provisioning steps and a note that it happens once

#### Scenario: Existing venv labeled as fallback
- **WHEN** the app is using an existing venv
- **THEN** the modal states "Using existing environment from <path>"

#### Scenario: System Python labeled as fallback
- **WHEN** the app falls back to system Python
- **THEN** the modal states "Using your system Python as a fallback (micromamba unavailable)"

#### Scenario: Both paths failed
- **WHEN** neither micromamba nor system Python could produce a working environment
- **THEN** the error modal explains that micromamba was tried first and system Python second, with retry and manual instructions
