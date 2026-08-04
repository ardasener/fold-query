## ADDED Requirements

### Requirement: Paper size selector
The Print Preview pane SHALL display a settings bar below the print sheet containing a paper size selector with the options A5, A4, A3, US Letter, US Legal, and Tabloid (portrait only).

#### Scenario: Selector shows current size
- **WHEN** the Print Preview pane is visible
- **THEN** the selector displays the currently selected paper size

#### Scenario: Changing paper size
- **WHEN** the user selects a different paper size
- **THEN** the selection is persisted and the preview re-lays out the net for the new size without re-running the unfold

### Requirement: Paper size is a global preference
The paper size SHALL be stored in the app's global settings (default A4) and survive app restarts.

#### Scenario: Default is A4
- **WHEN** no paper size has ever been chosen
- **THEN** the effective paper size is A4

#### Scenario: Persisted across restarts
- **WHEN** the user changes the paper size and restarts the app
- **THEN** the chosen size is restored

#### Scenario: Invalid stored value
- **WHEN** the stored paper size is not one of the known sizes
- **THEN** the app falls back to A4

### Requirement: Reserved flap settings slot
The settings bar SHALL reserve space for a future glue-flap configuration cluster without changing the bar's structure.

#### Scenario: Bar structure accommodates future controls
- **WHEN** the bar is rendered
- **THEN** there is a horizontal region between the paper selector and the print button that a future flap settings cluster can occupy
