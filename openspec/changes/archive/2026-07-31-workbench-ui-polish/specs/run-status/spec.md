## ADDED Requirements

### Requirement: Run status icon in the top bar
The top bar MUST show a run-status icon reflecting the last executed script: a green check on success and a red error icon on failure. Before any run, no status icon MUST appear.

#### Scenario: Successful run
- **WHEN** the last run completed without an error
- **THEN** a green check icon appears in the top bar

#### Scenario: Failed run
- **WHEN** the last run produced an error
- **THEN** a red error icon appears in the top bar with the error message in its tooltip

#### Scenario: No runs yet
- **WHEN** no run has completed
- **THEN** no status icon is shown

### Requirement: Error copy on click
Clicking the error status icon MUST copy the error message to the clipboard.

#### Scenario: Copy error
- **WHEN** the user clicks the error status icon
- **THEN** the error message is copied to the clipboard and a confirmation toast is shown
