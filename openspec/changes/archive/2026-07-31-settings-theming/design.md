## Context

The workbench mock (`mock-ui`, archived) ships a fixed light Ant Design theme with a hardcoded font stack and an always-white 3D viewport. This change introduces the first real settings system: a palette-driven theme engine that guarantees visual consistency across Ant Design, CodeMirror, and the three.js viewer, plus typography controls. Decisions from exploration: settings live in a modal (opened from the top-bar settings icon), the theme picker uses swatch cards, editor size is a numeric 8–24 control, and the default theme is Catppuccin Latte (the current custom light theme is dropped).

## Goals / Non-Goals

**Goals:**
- One palette definition per theme drives AntD tokens, CodeMirror highlighting, and the 3D scene.
- 7 built-in themes (Nord, Catppuccin Latte/Mocha, Monokai, Dracula, Solarized Light/Dark), default Catppuccin Latte.
- UI font, UI scale (S/M/L), editor font, editor size (8–24) settings.
- Settings modal with swatch theme picker; changes apply live and persist.

**Non-Goals:**
- No custom/user-defined palettes.
- No system theme following, no per-project settings.
- No Tauri store plugin — localStorage persistence is sufficient for now.
- No changes to the Rust backend.

## Decisions

### D1: Palette is the single source of truth
Define `Palette` with semantic roles (bg, surface, surfaceAlt, border, text, textSecondary, textMuted, primary, primaryText) and syntax roles (keyword, string, comment, number, function, type, operator, variable, property, punctuation, error, invalid). Three derivation functions consume it:
- `antdTheme(palette, uiFont, uiScale)` → ConfigProvider theme (algorithm dark/light + tokens).
- `cmTheme(palette)` → CodeMirror extensions via `@uiw/codemirror-themes` `createTheme`, mapping `@lezer/highlight` tags to syntax roles.
- `sceneColors(palette)` → `{ background, grid, gridSection }` for the three.js canvas.

Rationale: guarantees the "same theme everywhere" requirement; adding a theme is one palette object. Alternatives considered: separate third-party CodeMirror themes — rejected (no fidelity guarantee).

### D2: Palette values come from official specs
Hex values were verified against official sources (nordtheme, catppuccin palette repo, draculatheme.com, solarized spec; monokai classic values). Each theme's `kind` selects the AntD algorithm (`darkAlgorithm` vs `defaultAlgorithm`).

### D3: Settings state via React context, persisted to localStorage
`SettingsContext` holds `{ themeId, uiFont, uiScale, editorFont, editorSize }` and exposes an updater. Persistence: JSON in `localStorage["foldquery-settings"]`, validated on load (unknown ids/sizes fall back to defaults). Defaults: Catppuccin Latte, Inter, medium, Fira Code, 13. Rationale: consistent with the split-layout persistence pattern; zero new dependencies.

### D4: Settings modal, live apply, no save button
Top-bar settings button opens an AntD `Modal`. Sections: Appearance (theme swatch cards, UI font Select, UI scale Segmented) and Editor (font Select, size InputNumber 8–24). Changes write to context immediately, so the UI re-themes live. Closing the modal keeps changes.

### D5: Fonts bundled statically via fontsource
`src/fonts.ts` imports fontsource CSS for all families (editor: Fira Code/JetBrains Mono/IBM Plex Mono 400/500/600; UI: Inter/Roboto/Noto Sans 400/500/600/700). UI font applies via AntD `fontFamily` token; editor font/size via CodeMirror theme settings and CSS. Rationale: simplest reliable loading in Tauri; fonts are small woff2 files.

### D6: UI scale via the AntD base font-size token
Small/Medium/Large map to `fontSize` 13/14/16. AntD derives SM/LG/XL tokens from the base, so component text scales proportionally without per-component work.

### D7: Theme swatch cards
Each theme renders as a card showing four color dots (bg, surface, text, primary) plus the theme name; the active theme is highlighted with the primary border and a check. A responsive grid keeps them compact in the modal.

## Risks / Trade-offs

- [Font bundling grows the JS bundle by several MB] → Acceptable for a desktop app; revisit code-splitting/dynamic loading if it matters.
- [Live re-theming while CodeMirror/three.js are mounted] → CodeMirror accepts a new theme extension reactively; the three.js canvas background and grid are updated from settings via props/effects. Verified patterns; low risk.
- [Dark themes may reveal hardcoded colors in pane/chat components] → Pane/TopBar use rgba borders and AntD tokens; audit and move any remaining hardcoded colors to palette/token-derived values during implementation.
- [localStorage vs Tauri store] → Fine for settings; the store plugin can replace it later without API changes behind the context.
