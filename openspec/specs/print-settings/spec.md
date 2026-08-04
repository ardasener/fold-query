# print-settings Specification

## Purpose

Provide print settings — paper size selection (global preference, A4 default), a reserved slot for glue-flap configuration, and the target face count for mesh simplification — in a bar below the print preview.

## Requirements

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

### Requirement: Target face count setting
The print settings SHALL include a "target faces" control backed by a global `unfoldTargetFaces` preference with a default of 100 and a clamped range.

#### Scenario: Default value
- **WHEN** no target face count has ever been chosen
- **THEN** the effective target is 100

#### Scenario: Persisted across restarts
- **WHEN** the user changes the target face count and restarts the app
- **THEN** the chosen value is restored

#### Scenario: Out-of-range value clamped
- **WHEN** a stored or entered target falls outside the allowed range
- **THEN** the value is clamped to the range

### Requirement: Target change triggers re-unfold
Changing the target face count SHALL re-run the unfold pipeline with the new target (not merely re-lay-out), because simplification changes the mesh itself.

#### Scenario: Re-unfold on target change
- **WHEN** the user changes the target face count
- **THEN** a new unfold is requested with the updated target and the print preview reflects the new result
