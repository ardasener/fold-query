## Why

The app can unfold a 3D model into a 2D net and show it in Print Preview, but it cannot print it. A papercraft tool's output is the printed template — exact physical scale is non-negotiable (it is a CAD workflow: the assembled model must match its real dimensions). There is currently no paper-size concept, no multi-page tiling, and no way to reach the OS print dialog.

## What Changes

- Add a settings bar at the bottom of the Print Preview pane: a paper-size selector (A5, A4, A3, US Letter, US Legal, Tabloid, portrait only) and a Print button.
- Make paper size a global preference: a `paperSize` field in the existing `Settings` (localStorage-backed), defaulting to A4.
- Replace the single-canvas layout with page-based tiling: `layoutPages(net, pageSize, margin)` packs whole islands (never scaled, never split) into pages of the usable sheet area (paper minus a fixed 10mm margin), overflowing to new pages. Deterministic.
- The Print Preview sheet shows all pages stacked vertically with visible page boundaries and page numbers, scaled only for on-screen display.
- Warn when a single island's bounding box exceeds the usable page area (too large to print on one sheet); v1 does not split islands across pages.
- Add a Print button that renders the net into a detached print-only document (one `.print-page` per sheet at exact mm size, `@page` sized to the selected paper) and opens the **OS native print dialog** via `window.print()` — no in-app printer selection.
- Leave room in the settings bar for a future glue-flap configuration cluster (not implemented in this change).

## Capabilities

### New Capabilities
- `print-settings`: The print settings bar — paper size selector (global preference, A4 default), Print button, and the reserved slot for future flap settings. Paper size changes trigger re-layout only (not re-unfold).
- `page-tiling`: Page-based layout of the unfolded net — `layoutPages` packs atomic islands into pages of the usable area, multi-page overflow, overflow warning for islands larger than one page, and page-aware preview rendering.
- `print-output`: The print flow — detached print document with exact-mm pages, `@page` sizing, and native OS print dialog via `window.print()`.

### Modified Capabilities
<!-- None: paper size is a new preference; the existing `net-viewer` spec's layout behavior is replaced by page tiling, which is covered by the new `page-tiling` capability rather than a delta. -->

## Impact

- **Code**: `src/lib/net-layout.ts` (new `layoutPages`), `src/components/print/PrintPreview.tsx` (settings bar, page preview, print root), `src/components/print/PrintPreview.css`, `src/settings/SettingsContext.tsx` (paperSize field + validation), new `src/lib/paper.ts` (paper size table), new `src/lib/net-print.ts` (print document builder), types in `src/types/unfold.ts` or `src/types/print.ts`.
- **Dependencies**: none new.
- **No Rust changes** — the net JSON from the existing `unfold` command is the source; printing is pure frontend.
