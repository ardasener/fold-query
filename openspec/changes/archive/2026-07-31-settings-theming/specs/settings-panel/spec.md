## ADDED Requirements

### Requirement: Settings modal opens from the top bar
The settings icon in the top bar MUST open a settings modal. The modal MUST contain an Appearance section and an Editor section.

#### Scenario: Opening settings
- **WHEN** the user clicks the settings icon
- **THEN** a settings modal opens with Appearance and Editor sections

### Requirement: Theme swatch picker
The Appearance section MUST present the themes as swatch cards showing the theme's palette colors (background, surface, text, primary) and name. The active theme MUST be visually highlighted.

#### Scenario: Selecting a theme from a swatch
- **WHEN** the user clicks a theme swatch card
- **THEN** the theme is selected, the card is highlighted, and the UI re-themes immediately

### Requirement: Appearance controls
The Appearance section MUST provide a UI font selector (Inter, Roboto, Noto Sans) and a UI scale selector (Small, Medium, Large).

#### Scenario: Changing appearance settings
- **WHEN** the user changes the UI font or scale
- **THEN** the UI updates immediately to the new font and scale

### Requirement: Editor controls
The Editor section MUST provide an editor font selector (Fira Code, JetBrains Mono, IBM Plex Mono) and an editor font-size control (numeric, 8–24).

#### Scenario: Changing editor settings
- **WHEN** the user changes the editor font or size
- **THEN** the CodeMirror editor updates immediately

### Requirement: Settings persist and restore
Settings MUST be persisted to localStorage and restored on launch. Invalid or unknown persisted values MUST fall back to defaults.

#### Scenario: Settings survive restart
- **WHEN** the user changes settings, closes the modal, and restarts the app
- **THEN** the saved settings are restored and applied

#### Scenario: Corrupt settings fall back
- **WHEN** persisted settings contain unknown theme/font ids or out-of-range sizes
- **THEN** the app falls back to default values for the invalid fields
