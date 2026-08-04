## Context

The Print Preview pane renders the unfolded net (from the `unfold` Rust command) as a single SVG on a fixed 800-unit-wide canvas (`layoutIslands` in `net-layout.ts`). There is no paper concept, no printing, and no way to reach the OS print dialog. The app already has a global settings system (`SettingsContext`, localStorage-backed under `foldquery-settings`) that theme/font/scale preferences flow through.

This change adds a print workflow. The hard constraint from the product: **printing must be true physical scale (1:1)** — this is a CAD tool, and the assembled model must match its real dimensions. The mesh units from CadQuery are mm, and the unfold's isometric flattening preserves them, so island coordinates are already in physical units; no scale factor exists or should be introduced anywhere.

Tauri research (docs.rs/tauri 2.9.2): `window.print()` opens the OS native print dialog on all platforms in the webview; the Rust-side `WebviewWindow::print()` is macOS-only. No printing dependency exists or is needed.

## Goals / Non-Goals

**Goals:**
- Paper-size selector (A5/A4/A3/US Letter/US Legal/Tabloid, portrait only) + Print button in a settings bar below the print preview.
- Paper size as a global preference (A4 default) via `SettingsContext`.
- Page-based tiling: atomic islands packed into pages of the usable area, multi-page overflow, deterministic.
- Exact 1:1 print output via `window.print()` on a detached mm-sized print document.
- Preview shows all pages with page boundaries, scaled only for screen.

**Non-Goals:**
- Paper orientation — deliberately omitted (redundant).
- Glue-flap configuration — future spec; the settings bar leaves a reserved slot.
- Optimal page packing (skyline/NFP) — DESIGN.md Phase 6; v1 uses the greedy row-wrap bounded by page size.
- Splitting a single island across pages — warned instead (deferred panel tiling).
- Custom printer selection / PDF export — native OS dialog only.

## Decisions

### D1: Paper size is a global preference in `SettingsContext`

Add `paperSize: PaperSizeId` to the `Settings` interface, persisted in the existing localStorage `foldquery-settings`, validated on load (fallback to A4). A new `src/lib/paper.ts` exports the paper table: `{ id, label, widthMm, heightMm }` for the six sizes, plus helpers `usableAreaMm(paper, margin)`.

**Why:** matches the existing settings pattern exactly (theme, fonts, scale all live there), and paper size is a printer/preference property, not a model property (user decision A). No Rust persistence needed.

### D2: `layoutPages` replaces `layoutIslands`

`src/lib/net-layout.ts` gains `layoutPages(net, paperSizeMm, marginMm): PrintPage[]` where `PrintPage { islands: PlacedIsland[], widthMm, heightMm, pageIndex }`. Packing: sort islands by face count descending; greedy row-wrap within the usable area (paper minus 10mm margin each side); when a row overflows width → new row; when a row cannot fit in remaining height → new page. Islands are atomic — never scaled or split.

**Why:** the previous fixed-800-canvas layout was a placeholder; pages are the real unit of print. The existing `layoutIslands` is kept only if cheap to retain for tests, otherwise replaced — the preview and print both consume `layoutPages`.

**Overflow:** an island whose bounding box exceeds the usable area cannot be placed; `layoutPages` marks it `overflow: true` and places it at the page origin at 1:1 (running off the page) so the user sees the problem. The UI surfaces a warning listing overflow islands.

### D3: Print document is a detached mm-sized DOM, printed via `window.print()`

A new `src/lib/net-print.ts` builds a print document: a `<div>` (or iframe `srcdoc`) appended to the document body, containing one `.print-page` element per page. Each `.print-page` is an inline SVG with **explicit `width`/`height` in mm** equal to the usable area, viewBox in mm, and the islands drawn at their mm coordinates. CSS scoped to the print root: `@page { size: <widthMm>mm <heightMm>mm; margin: 0 }`, `.print-page { page-break-after: always }`, `@media print` hides the app chrome (`body > #root` content) and shows only the print root.

**Why:** approach B (agreed). SVG coordinates are already mm (mesh units preserved), so drawing at 1 unit = 1mm with explicit physical size yields exact 1:1 output; the OS dialog opens with the correct paper preselected. Caveat documented: the OS dialog has its own "scale" field defaulting to 100% — correct at 100%, user-adjustable (their choice, standard for CAD printing).

**Print flow:** Print button → build print root from the current `net` + paper size → `window.print()` → remove the print root after the dialog closes (`onafterprint` or timeout). No Rust involvement.

### D4: Preview renders pages, scaled only for screen

The preview sheet renders `layoutPages` output: pages stacked vertically, each with a dashed page-boundary outline and a page-number label, scaled via CSS `transform`/viewBox to fit the pane. This scaling is purely visual — the print document (D3) uses raw mm.

**Why:** WYSIWYG-ish feedback for multi-page output without affecting print fidelity.

### D5: Settings bar layout leaves a reserved slot for flaps

The bar: `[Paper size: Select] [Print button]` with a flex spacer; the design documents that a future glue-flap cluster mounts between them. Nothing in the bar structure (a horizontal flex row) blocks it.

## Risks / Trade-offs

- [OS print dialog "scale" setting could alter 1:1 output] → Content is correct at 100% (default); user changes are their choice, same as any CAD print. Documented in the print-output spec.
- [Large single island cannot fit a page] → Warned (D2), not split; panel tiling is a deferred phase.
- [`window.print()` behavior differences across webviews] → WebKit (macOS) and WebView2 (Windows) both support `window.print()` and `@page` size; fallback is the OS dialog defaulting to the webview's page size. Verified via Tauri docs.
- [Detached print root interfering with the app DOM] → Root is appended at body end, removed after printing; print CSS is scoped under the root's id so app styles are unaffected.
- [Suboptimal packing wastes paper] → Acceptable for v1; skyline/NFP packing is a deferred phase.

## Migration Plan

No migration. `layoutIslands` usage is internal to PrintPreview; swapping to `layoutPages` is a frontend-only change with the preview and print both consuming the new layout.

## Open Questions

- None blocking. Flap configuration, orientation, and island splitting are explicitly deferred.
