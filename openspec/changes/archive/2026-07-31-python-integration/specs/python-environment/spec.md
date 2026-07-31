## ADDED Requirements

### Requirement: Startup Python detection
On startup the application MUST check whether a usable Python 3 (version >= 3.11) is callable on the system, and whether the `venv` and `pip` modules are available. The check MUST identify which component is missing when incomplete.

#### Scenario: Python environment complete
- **WHEN** the app starts and Python 3.11+ with `venv` and `pip` is available
- **THEN** the app proceeds to environment setup

#### Scenario: Component missing
- **WHEN** the app starts and Python, the `venv` module, or `pip` is missing
- **THEN** the app reports exactly which component is missing

#### Scenario: Checking indicator
- **WHEN** the app starts and the environment check is in progress
- **THEN** a modal with a spinner indicates that the environment is being checked, and the workbench is not shown until the check completes

### Requirement: Missing-Python error modal
When Python is missing or incomplete, the application MUST show a non-dismissible error modal containing a link to the Python website, install commands for common operating systems (e.g., Homebrew, apt, winget), and an Exit button that quits the application.

#### Scenario: Python missing
- **WHEN** detection reports Python is missing
- **THEN** an error modal shows the python.org link, per-OS install commands, and an Exit button

#### Scenario: Exit quits the app
- **WHEN** the user clicks Exit
- **THEN** the application exits

#### Scenario: venv module missing
- **WHEN** detection reports only the `venv` module is missing
- **THEN** the error modal explains that the venv module is missing and shows the relevant install commands

### Requirement: Venv bootstrap in the OS cache directory
When Python is available and the venv is absent, the application MUST create a virtual environment in the OS cache directory (e.g., `~/Library/Caches/com.foldquery.app/venv` on macOS) and install the pinned dependencies (CadQuery). The application MUST report progress through the setup steps.

#### Scenario: First-time setup
- **WHEN** the app starts with Python available and no existing venv
- **THEN** a venv is created in the cache directory, dependencies are installed, and the setup completes successfully

#### Scenario: Setup progress reported
- **WHEN** setup is running
- **THEN** the user sees a spinner and progress for each step (detect, create venv, install dependencies, verify)

### Requirement: Skip setup when the venv works
When the venv exists and its Python binary runs, the application MUST skip setup on subsequent starts.

#### Scenario: Existing venv
- **WHEN** the app starts and the cached venv Python runs successfully
- **THEN** no setup runs and the app proceeds directly
