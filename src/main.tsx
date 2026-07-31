import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import { loadSettings, SettingsProvider, useSettings } from "./settings/SettingsContext";
import { antdTheme } from "./themes/antd";
import { getPalette } from "./themes/palettes";
import { applyPaletteVars } from "./themes/cssVars";
import App from "./App";
import "./fonts";
import "./index.css";

// Apply the palette variables to the document root before first paint so the
// window edges match the theme from the very first frame.
const initialSettings = loadSettings();
applyPaletteVars(
  document.documentElement,
  getPalette(initialSettings.themeId),
  initialSettings.uiScale,
);

function ThemedApp() {
  const { settings, palette } = useSettings();
  return (
    <ConfigProvider theme={antdTheme(palette, settings.uiFont, settings.uiScale)}>
      <App />
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <ThemedApp />
    </SettingsProvider>
  </React.StrictMode>,
);
