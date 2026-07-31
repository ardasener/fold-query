## 1. Theme engine

- [x] 1.1 Add `@uiw/codemirror-themes` and the 7 fontsource packages (`@fontsource/fira-code`, `@fontsource/jetbrains-mono`, `@fontsource/ibm-plex-mono`, `@fontsource/inter`, `@fontsource/roboto`, `@fontsource/noto-sans`); confirm `bun install` resolves
- [x] 1.2 Create `src/themes/palettes.ts`: `Palette` type (semantic + syntax roles) and the 7 themes with verified hexes
- [x] 1.3 Create `src/themes/antd.ts`: `antdTheme(palette, uiFont, uiScale)` → ConfigProvider theme config (algorithm + tokens)
- [x] 1.4 Create `src/themes/codemirror.ts`: `cmTheme(palette)` via `@uiw/codemirror-themes` `createTheme` mapping `@lezer/highlight` tags to syntax colors
- [x] 1.5 Create `src/themes/scene.ts`: `sceneColors(palette)` → background + grid colors

## 2. Fonts and settings state

- [x] 2.1 Create `src/fonts.ts` importing the fontsource CSS files (editor 400/500/600, UI 400/500/600/700)
- [x] 2.2 Create `src/settings/SettingsContext.tsx`: settings type, defaults (Catppuccin Latte, Inter, medium, Fira Code, 13), localStorage persistence with validation, provider + hook

## 3. Settings modal

- [x] 3.1 Create `src/components/settings/SettingsModal.tsx` with Appearance section (theme swatch cards, UI font Select, UI scale Segmented) and Editor section (font Select, size InputNumber 8–24)
- [x] 3.2 Create swatch card styles (palette color dots, active highlight)

## 4. Wire into the app

- [x] 4.1 Update `src/main.tsx`: SettingsProvider wrapping ConfigProvider built from `antdTheme`
- [x] 4.2 Update `src/components/TopBar.tsx`: settings button opens the modal (via App state)
- [x] 4.3 Update `src/App.tsx`: render `SettingsModal` controlled by state
- [x] 4.4 Update `src/components/code-editor/CodeEditor.tsx`: use `cmTheme(palette)` + editor font/size from settings
- [x] 4.5 Update `src/components/viewer/ViewerPanel.tsx`: use `sceneColors` for canvas background and grid
- [x] 4.6 Audit panes/top bar/print preview for hardcoded colors and move to token-derived values

## 5. Verification

- [x] 5.1 `bun run build` passes (tsc + Vite)
- [x] 5.2 `bun tauri dev` launches with Catppuccin Latte default
- [x] 5.3 Switching each theme re-themes UI, editor, and viewer
- [x] 5.4 UI font/scale and editor font/size changes apply
- [x] 5.5 Settings persist across restart; corrupt localStorage falls back to defaults
