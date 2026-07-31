import { withAlpha, type Palette } from "./palettes";

export interface SceneColors {
  background: string;
  grid: string;
  gridSection: string;
}

/** Colors for the three.js viewer derived from the active palette. */
export function sceneColors(palette: Palette): SceneColors {
  return {
    background: palette.bg,
    grid: withAlpha(palette.border, 0.7),
    gridSection: withAlpha(palette.primary, 0.4),
  };
}
