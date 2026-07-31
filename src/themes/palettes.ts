export type PaletteKind = "light" | "dark";

export interface SyntaxColors {
  keyword: string;
  string: string;
  comment: string;
  number: string;
  function: string;
  type: string;
  operator: string;
  variable: string;
  property: string;
  punctuation: string;
  error: string;
}

export interface Palette {
  id: string;
  name: string;
  kind: PaletteKind;
  /** App background (also the code editor background). */
  bg: string;
  /** Container/surface color (panes, inputs, cards). */
  surface: string;
  /** Elevated surface (modals, popovers, pane headers). */
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  /** Text color rendered on top of `primary`. */
  primaryText: string;
  syntax: SyntaxColors;
}

/**
 * Palette definitions. Hex values are taken from the official specs:
 * Nord (nordtheme.com), Catppuccin (palette repo), Dracula (draculatheme.com),
 * Solarized (Ethan Schoonover's spec), Monokai (classic values).
 */
export const PALETTES: Palette[] = [
  {
    id: "nord",
    name: "Nord",
    kind: "dark",
    bg: "#2e3440",
    surface: "#3b4252",
    surfaceAlt: "#434c5e",
    border: "#434c5e",
    text: "#eceff4",
    textSecondary: "#d8dee9",
    textMuted: "#4c566a",
    primary: "#88c0d0",
    primaryText: "#2e3440",
    syntax: {
      keyword: "#81a1c1",
      string: "#a3be8c",
      comment: "#4c566a",
      number: "#b48ead",
      function: "#88c0d0",
      type: "#8fbcbb",
      operator: "#81a1c1",
      variable: "#d8dee9",
      property: "#8fbcbb",
      punctuation: "#eceff4",
      error: "#bf616a",
    },
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    kind: "light",
    bg: "#eff1f5",
    surface: "#e6e9ef",
    surfaceAlt: "#dce0e8",
    border: "#ccd0da",
    text: "#4c4f69",
    textSecondary: "#5c5f77",
    textMuted: "#6c6f85",
    primary: "#1e66f5",
    primaryText: "#ffffff",
    syntax: {
      keyword: "#8839ef",
      string: "#40a02b",
      comment: "#9ca0b0",
      number: "#fe640b",
      function: "#1e66f5",
      type: "#df8e1d",
      operator: "#179299",
      variable: "#4c4f69",
      property: "#1e66f5",
      punctuation: "#4c4f69",
      error: "#d20f39",
    },
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    kind: "dark",
    bg: "#1e1e2e",
    surface: "#181825",
    surfaceAlt: "#11111b",
    border: "#313244",
    text: "#cdd6f4",
    textSecondary: "#bac2de",
    textMuted: "#6c7086",
    primary: "#89b4fa",
    primaryText: "#1e1e2e",
    syntax: {
      keyword: "#cba6f7",
      string: "#a6e3a1",
      comment: "#6c7086",
      number: "#fab387",
      function: "#89b4fa",
      type: "#f9e2af",
      operator: "#94e2d5",
      variable: "#cdd6f4",
      property: "#89b4fa",
      punctuation: "#cdd6f4",
      error: "#f38ba8",
    },
  },
  {
    id: "monokai",
    name: "Monokai",
    kind: "dark",
    bg: "#272822",
    surface: "#3e3d32",
    surfaceAlt: "#49483e",
    border: "#49483e",
    text: "#f8f8f2",
    textSecondary: "#cfcfc2",
    textMuted: "#75715e",
    primary: "#a6e22e",
    primaryText: "#272822",
    syntax: {
      keyword: "#f92672",
      string: "#e6db74",
      comment: "#75715e",
      number: "#ae81ff",
      function: "#a6e22e",
      type: "#66d9ef",
      operator: "#f92672",
      variable: "#f8f8f2",
      property: "#66d9ef",
      punctuation: "#f8f8f2",
      error: "#f92672",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    kind: "dark",
    bg: "#282a36",
    surface: "#343746",
    surfaceAlt: "#3f4251",
    border: "#44475a",
    text: "#f8f8f2",
    textSecondary: "#c3c9d4",
    textMuted: "#6272a4",
    primary: "#bd93f9",
    primaryText: "#282a36",
    syntax: {
      keyword: "#ff79c6",
      string: "#f1fa8c",
      comment: "#6272a4",
      number: "#bd93f9",
      function: "#50fa7b",
      type: "#8be9fd",
      operator: "#ff79c6",
      variable: "#f8f8f2",
      property: "#50fa7b",
      punctuation: "#f8f8f2",
      error: "#ff5555",
    },
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    kind: "light",
    bg: "#fdf6e3",
    surface: "#eee8d5",
    surfaceAlt: "#fdf6e3",
    border: "#d8d0bd",
    text: "#657b83",
    textSecondary: "#839496",
    textMuted: "#93a1a1",
    primary: "#268bd2",
    primaryText: "#fdf6e3",
    syntax: {
      keyword: "#859900",
      string: "#2aa198",
      comment: "#93a1a1",
      number: "#d33682",
      function: "#268bd2",
      type: "#b58900",
      operator: "#859900",
      variable: "#657b83",
      property: "#268bd2",
      punctuation: "#657b83",
      error: "#dc322f",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    kind: "dark",
    bg: "#002b36",
    surface: "#073642",
    surfaceAlt: "#103f4c",
    border: "#586e75",
    text: "#93a1a1",
    textSecondary: "#839496",
    textMuted: "#586e75",
    primary: "#268bd2",
    primaryText: "#002b36",
    syntax: {
      keyword: "#859900",
      string: "#2aa198",
      comment: "#586e75",
      number: "#d33682",
      function: "#268bd2",
      type: "#b58900",
      operator: "#859900",
      variable: "#839496",
      property: "#268bd2",
      punctuation: "#93a1a1",
      error: "#dc322f",
    },
  },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[1];
}

/** Convert #rrggbb to an rgba() string with the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
