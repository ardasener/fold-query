import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PALETTES, getPalette, type Palette } from "../themes/palettes";
import { applyPaletteVars } from "../themes/cssVars";
import {
  UI_SCALE_DEFAULT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  type UiFontId,
} from "../themes/antd";
import type { EditorFontId } from "../themes/codemirror";

export const UI_FONT_OPTIONS: { id: UiFontId; name: string }[] = [
  { id: "inter", name: "Inter" },
  { id: "roboto", name: "Roboto" },
  { id: "noto-sans", name: "Noto Sans" },
];

export { UI_SCALE_DEFAULT, UI_SCALE_MIN, UI_SCALE_MAX, UI_SCALE_STEP };

export const EDITOR_FONT_OPTIONS: { id: EditorFontId; name: string }[] = [
  { id: "fira-code", name: "Fira Code" },
  { id: "jetbrains-mono", name: "JetBrains Mono" },
  { id: "ibm-plex-mono", name: "IBM Plex Mono" },
];

export const EDITOR_SIZE_MIN = 8;
export const EDITOR_SIZE_MAX = 24;

export const DEFAULT_PROVIDER_URL = "https://api.openai.com/v1";

export interface ProviderSettings {
  url: string;
  model: string;
}

export const HISTORY_BUDGET_DEFAULT = 30_000;
export const HISTORY_BUDGET_MIN = 4_000;
export const HISTORY_BUDGET_MAX = 200_000;

export function clampHistoryBudget(value: number): number {
  return Math.min(HISTORY_BUDGET_MAX, Math.max(HISTORY_BUDGET_MIN, Math.round(value)));
}

export interface Settings {
  themeId: string;
  uiFont: UiFontId;
  uiScale: number;
  editorFont: EditorFontId;
  editorSize: number;
  historyCharBudget: number;
  provider: ProviderSettings;
}

const DEFAULTS: Settings = {
  themeId: "catppuccin-latte",
  uiFont: "inter",
  uiScale: UI_SCALE_DEFAULT,
  editorFont: "fira-code",
  editorSize: 13,
  historyCharBudget: HISTORY_BUDGET_DEFAULT,
  provider: { url: DEFAULT_PROVIDER_URL, model: "" },
};

const STORAGE_KEY = "foldquery-settings";

function clampSize(value: number): number {
  return Math.min(EDITOR_SIZE_MAX, Math.max(EDITOR_SIZE_MIN, Math.round(value)));
}

function normalizeScale(value: number): number {
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, value));
  return Math.round(clamped / UI_SCALE_STEP) * UI_SCALE_STEP;
}

/** Snap an arbitrary number to the nearest valid UI scale step. */
export function snapUiScale(value: number): number {
  return normalizeScale(value);
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      themeId: PALETTES.some((p) => p.id === parsed.themeId)
        ? parsed.themeId!
        : DEFAULTS.themeId,
      uiFont: UI_FONT_OPTIONS.some((o) => o.id === parsed.uiFont)
        ? parsed.uiFont!
        : DEFAULTS.uiFont,
      uiScale:
        typeof parsed.uiScale === "number" && Number.isFinite(parsed.uiScale)
          ? normalizeScale(parsed.uiScale)
          : DEFAULTS.uiScale,
      editorFont: EDITOR_FONT_OPTIONS.some((o) => o.id === parsed.editorFont)
        ? parsed.editorFont!
        : DEFAULTS.editorFont,
      editorSize:
        typeof parsed.editorSize === "number" && Number.isFinite(parsed.editorSize)
          ? clampSize(parsed.editorSize)
          : DEFAULTS.editorSize,
      historyCharBudget:
        typeof parsed.historyCharBudget === "number" && Number.isFinite(parsed.historyCharBudget)
          ? clampHistoryBudget(parsed.historyCharBudget)
          : DEFAULTS.historyCharBudget,
      provider: {
        url:
          typeof parsed.provider?.url === "string" && parsed.provider.url.trim().length > 0
            ? parsed.provider.url
            : DEFAULTS.provider.url,
        model:
          typeof parsed.provider?.model === "string"
            ? parsed.provider.model
            : DEFAULTS.provider.model,
      },
    };
  } catch {
    return DEFAULTS;
  }
}

export { loadSettings };

interface SettingsContextValue {
  settings: Settings;
  palette: Palette;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Keep the palette CSS variables on the document root so the whole page
  // (including portals) inherits theme colors, matching the window edges.
  useEffect(() => {
    applyPaletteVars(document.documentElement, getPalette(settings.themeId), settings.uiScale);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      palette: getPalette(settings.themeId),
      update: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
