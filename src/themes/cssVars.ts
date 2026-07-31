import type { CSSProperties } from "react";
import type { Palette } from "./palettes";

/**
 * CSS custom properties derived from the palette. Applied on the document root
 * so the whole page (including portals) inherits theme colors.
 */
export function paletteCssVars(palette: Palette, uiScale = 1): CSSProperties {
  return {
    "--fq-bg": palette.bg,
    "--fq-surface": palette.surface,
    "--fq-surface-alt": palette.surfaceAlt,
    "--fq-border": palette.border,
    "--fq-text": palette.text,
    "--fq-text-secondary": palette.textSecondary,
    "--fq-text-muted": palette.textMuted,
    "--fq-primary": palette.primary,
    "--fq-text-error": palette.syntax.error,
    "--fq-scale": String(uiScale),
  } as CSSProperties;
}

/**
 * Applies palette variables to an element. Custom properties MUST be set via
 * setProperty — direct assignment on a CSSStyleDeclaration is a silent no-op.
 */
export function applyPaletteVars(el: HTMLElement, palette: Palette, uiScale = 1): void {
  const vars = paletteCssVars(palette, uiScale) as Record<string, string>;
  for (const [name, value] of Object.entries(vars)) {
    el.style.setProperty(name, value);
  }
}
