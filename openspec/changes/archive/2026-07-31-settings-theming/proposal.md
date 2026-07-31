## Why

The mock workbench has a fixed light look and hardcoded fonts. To let users (and us) experience the app in different moods and typography, we need a settings system: a palette-driven theming engine that colors the whole UI (Ant Design), the code editor (CodeMirror), and the 3D viewer consistently, plus UI/editor font and size controls.

## What Changes

- Add a palette-driven theme engine with 7 themes: Nord, Catppuccin Latte, Catppuccin Mocha, Monokai, Dracula, Solarized Light, Solarized Dark. Default: Catppuccin Latte.
- One palette definition maps to three targets: Ant Design theme (tokens + dark/light algorithm), a CodeMirror theme (syntax colors via `@lezer/highlight` tags), and the three.js viewer (background + grid colors).
- Add font settings via fontsource packages: editor fonts (Fira Code, JetBrains Mono, IBM Plex Mono), UI fonts (Inter, Roboto, Noto Sans).
- Add UI text-size scale (Small / Medium / Large) that changes the Ant Design base font-size token so all UI text scales proportionally.
- Add an editor font-size control (numeric, 8–24).
- Add a settings modal opened from the top-bar settings icon: Appearance section (theme swatch cards, UI font, UI scale) and Editor section (font, size). Changes apply live.
- Persist settings to localStorage; restore on launch with validation.

## Capabilities

### New Capabilities
- `theme-system`: A palette defines semantic and syntax colors that consistently theme the Ant Design UI, the CodeMirror editor, and the three.js viewer. Seven built-in themes.
- `typography`: UI font (Inter/Roboto/Noto Sans), UI scale (small/medium/large), editor font (Fira Code/JetBrains Mono/IBM Plex Mono), and editor size (8–24) applied across the app.
- `settings-panel`: A settings modal opened from the top-bar settings icon with swatch-based theme picker and font/size controls; settings persist and restore.

### Modified Capabilities
<!-- None — no existing spec behavior changes. -->

## Impact

- New dependencies: `@uiw/codemirror-themes`, `@fontsource/fira-code`, `@fontsource/jetbrains-mono`, `@fontsource/ibm-plex-mono`, `@fontsource/inter`, `@fontsource/roboto`, `@fontsource/noto-sans`.
- New modules: `src/themes/` (palettes, antd/codemirror/scene derivation), `src/settings/` (context, persistence), `src/fonts.ts`, settings modal component.
- Modified: `src/main.tsx` (provider + themed ConfigProvider), `src/App.tsx` (settings modal state), `src/components/TopBar.tsx` (settings button opens modal), `src/components/code-editor/CodeEditor.tsx` (themed), `src/components/viewer/ViewerPanel.tsx` (scene colors).
- The current hardcoded light theme is replaced by the palette engine.
