# typography Specification

## Requirements

### Requirement: UI font selection
The application MUST offer Inter, Roboto, and Noto Sans as UI fonts, loaded via fontsource. The selected UI font MUST be applied to the Ant Design components via the theme font token.

#### Scenario: UI font changes apply
- **WHEN** the user selects a UI font
- **THEN** Ant Design components render with the selected font family

### Requirement: UI scale selection
The application MUST offer Small, Medium, and Large UI scales. The scale MUST change the Ant Design base font-size token (13 / 14 / 16) so UI text sizes scale proportionally.

#### Scenario: Scale changes UI text
- **WHEN** the user selects a larger scale
- **THEN** UI text renders larger across Ant Design components, including derived small/large sizes

### Requirement: Editor font selection
The application MUST offer Fira Code, JetBrains Mono, and IBM Plex Mono as editor fonts, loaded via fontsource. The selected font MUST apply to the CodeMirror editor.

#### Scenario: Editor font changes apply
- **WHEN** the user selects an editor font
- **THEN** the CodeMirror editor renders code in the selected monospace font

### Requirement: Editor font size
The application MUST offer a numeric editor font size from 8 to 24. The selected size MUST apply to the CodeMirror editor text.

#### Scenario: Editor size changes apply
- **WHEN** the user sets the editor font size
- **THEN** the editor text renders at the selected size
