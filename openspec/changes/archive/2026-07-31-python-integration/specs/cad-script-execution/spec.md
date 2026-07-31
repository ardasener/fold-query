## ADDED Requirements

### Requirement: Auto-run on first load
When the workbench becomes ready, the application MUST run the editor source once automatically, before the user presses Run.

#### Scenario: First load auto-run
- **WHEN** the workbench becomes ready (Python setup complete)
- **THEN** the editor source is executed once automatically and the result is applied

### Requirement: Run button in the top bar
The top bar MUST show a Run button next to the settings icon. It MUST be disabled while Python is not ready or a run is in progress. Clicking it MUST execute the current editor source.

#### Scenario: Run executes the editor source
- **WHEN** the user clicks Run with Python ready
- **THEN** the current editor source is executed by the venv Python and the result is returned

#### Scenario: Run disabled while executing
- **WHEN** a run is in progress
- **THEN** the Run button is disabled until the run completes

#### Scenario: Run disabled without Python
- **WHEN** Python setup has not completed
- **THEN** the Run button is disabled

### Requirement: Single-shot execution with result payload
The execution MUST run the script through the venv Python once, with a timeout that terminates runaway scripts. The result MUST include the script's stdout, any error (including traceback), and tessellated mesh data (vertices and faces) for every object the script shows.

#### Scenario: Successful run returns mesh
- **WHEN** the script runs successfully and calls `show_object`
- **THEN** the result contains the stdout and tessellated vertices/faces for the shown objects

#### Scenario: Script error captured
- **WHEN** the script raises an exception
- **THEN** the result contains the error with traceback, and the app does not crash

#### Scenario: Runaway script killed
- **WHEN** a script runs longer than the timeout
- **THEN** the process is terminated and the run reports a timeout error

### Requirement: Output strip in the editor pane
The editor pane MUST show a compact output strip at its bottom displaying the last run's stdout and error (if any), with a dismiss control.

#### Scenario: Output shown after run
- **WHEN** a run completes
- **THEN** the output strip shows the script's stdout and any error

#### Scenario: Output dismissed
- **WHEN** the user dismisses the output strip
- **THEN** it hides until the next run
