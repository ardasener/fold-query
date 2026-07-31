# theme-system Specification

## Requirements

### Requirement: Palette-driven theme engine
The application MUST define a palette type with semantic color roles (background, surface, border, text, secondary text, primary) and syntax color roles (keyword, string, comment, number, function, type, operator, and related). A single palette MUST drive the Ant Design theme, the CodeMirror editor theme, and the three.js viewer colors.

#### Scenario: One palette, three targets
- **WHEN** a palette is defined
- **THEN** the Ant Design theme, the CodeMirror theme, and the viewer scene colors all derive from that palette

### Requirement: Built-in themes
The application MUST ship seven themes: Nord, Catppuccin Latte, Catppuccin Mocha, Monokai, Dracula, Solarized Light, and Solarized Dark. Each theme MUST specify whether it is light or dark, and the Ant Design theme MUST use the matching algorithm (dark algorithm for dark themes).

#### Scenario: All themes available
- **WHEN** the theme picker is opened
- **THEN** all seven themes are listed with their names

#### Scenario: Dark themes use dark algorithm
- **WHEN** a dark theme (e.g., Monokai or Dracula) is selected
- **THEN** the Ant Design theme uses the dark algorithm and dark palette colors

### Requirement: Theme selection affects the whole UI
Selecting a theme MUST re-theme the Ant Design components, the CodeMirror editor (including syntax highlighting), and the three.js viewer background and grid without a restart.

#### Scenario: Editor and viewer follow theme
- **WHEN** the user selects a theme
- **THEN** the editor background, text, and syntax colors change to the theme's palette and the viewer background and grid change to the theme's scene colors

### Requirement: Catppuccin Latte is the default
On first launch with no saved settings, the active theme MUST be Catppuccin Latte.

#### Scenario: First launch
- **WHEN** the app launches with no persisted settings
- **THEN** the active theme is Catppuccin Latte
