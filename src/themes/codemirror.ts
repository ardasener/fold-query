import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { withAlpha, type Palette } from "./palettes";

export const EDITOR_FONT_STACKS = {
  "fira-code": "'Fira Code', 'SFMono-Regular', Menlo, Consolas, monospace",
  "jetbrains-mono": "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
  "ibm-plex-mono": "'IBM Plex Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
} as const;

export type EditorFontId = keyof typeof EDITOR_FONT_STACKS;

/** Builds the CodeMirror theme from a palette; guarantees the editor matches the UI. */
export function cmTheme(palette: Palette, editorFont: EditorFontId, editorSize: number) {
  const s = palette.syntax;
  return createTheme({
    theme: palette.kind,
    settings: {
      background: palette.bg,
      foreground: palette.text,
      caret: palette.primary,
      selection: withAlpha(palette.primary, 0.25),
      selectionMatch: withAlpha(palette.primary, 0.35),
      lineHighlight: withAlpha(palette.primary, 0.08),
      gutterBackground: palette.bg,
      gutterForeground: palette.textMuted,
      gutterActiveForeground: palette.textSecondary,
      gutterBorder: "transparent",
      fontFamily: EDITOR_FONT_STACKS[editorFont],
      fontSize: `${editorSize}px`,
    },
    styles: [
      { tag: t.keyword, color: s.keyword },
      { tag: [t.string, t.special(t.string)], color: s.string },
      { tag: [t.comment, t.blockComment, t.lineComment], color: s.comment, fontStyle: "italic" },
      { tag: [t.docString], color: s.string },
      { tag: [t.number, t.integer, t.float], color: s.number },
      { tag: [t.bool, t.null, t.atom], color: s.number },
      { tag: [t.function(t.variableName), t.function(t.propertyName)], color: s.function },
      { tag: [t.typeName, t.className, t.standard(t.typeName)], color: s.type },
      { tag: [t.definition(t.typeName)], color: s.type },
      { tag: [t.operator, t.operatorKeyword, t.arithmeticOperator, t.logicOperator, t.compareOperator], color: s.operator },
      { tag: [t.variableName, t.definition(t.variableName)], color: s.variable },
      { tag: [t.propertyName, t.attributeName, t.labelName], color: s.property },
      { tag: [t.punctuation, t.bracket], color: s.punctuation },
      { tag: [t.self], color: s.keyword },
      { tag: [t.invalid], color: s.error },
    ],
  });
}
