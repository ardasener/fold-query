## 1. Paper size model

- [x] 1.1 Create `src/lib/paper.ts`: `PaperSize` type (`id`, `label`, `widthMm`, `heightMm`), `PAPER_SIZES` array (A5, A4, A3, US Letter, US Legal, Tabloid), `PAPER_DEFAULT = "a4"`, and `usableAreaMm(paper, margin)` helper
- [x] 1.2 Add `paperSize: PaperSizeId` to `Settings` in `src/settings/SettingsContext.tsx` with default A4, validation on load (fallback to A4), and persistence via the existing localStorage mechanism

## 2. Page tiling

- [x] 2.1 Add `layoutPages(net, paperSizeMm, marginMm): PrintPage[]` to `src/lib/net-layout.ts`: greedy row-wrap packer bounded by usable area, islands sorted by face count descending, page overflow to new pages, deterministic
- [x] 2.2 Handle oversized islands: `PrintPage`/placed-island model carries an `overflow` flag; oversized islands are placed at page origin at 1:1 and reported
- [x] 2.3 Unit tests for `layoutPages` (in `src/lib/net-layout.test.ts` or adjacent): single-page fit, multi-page overflow, determinism, island atomicity (no scaling, no splitting), oversized-island overflow flag

## 3. Settings bar UI

- [x] 3.1 Add settings bar below the print sheet in `PrintPreview.tsx`: AntD `Select` for paper size (from `PAPER_SIZES`) + Print button, flex layout with a spacer where the future flap cluster mounts
- [x] 3.2 Wire the selector to `useSettings()` (global `paperSize`), and re-run `layoutPages` on paper size change without re-invoking `unfold`
- [x] 3.3 Disable the Print button when no net is available
- [x] 3.4 Add overflow warning UI: an AntD `Alert`/`Tooltip` listing islands too large for one page

## 4. Page preview

- [x] 4.1 Replace the single-canvas `NetSheet` with a page-stacked preview: render `layoutPages` output as vertically stacked pages, each with a dashed page boundary and page number, scaled to fit the pane for screen only
- [x] 4.2 Update `PrintPreview.css` for the settings bar, page stack, page boundaries, and page number labels

## 5. Print output

- [x] 5.1 Create `src/lib/net-print.ts`: `buildPrintDocument(net, paperSize, margin): HTMLDivElement` — detached root appended to `document.body`, one `.print-page` per sheet as an inline SVG at explicit mm width/height (viewBox in mm, islands at true mm coordinates), `@page` rule set to the paper size, `page-break-after: always`, `@media print` scoping that hides the app and shows only the print root
- [x] 5.2 Wire the Print button: build the print document from the current net + paper size, call `window.print()`, remove the print root after the dialog closes (`onafterprint` fallback timeout)
- [x] 5.3 Verify print CSS scoping: add `.print-root` styles isolated so the app's layout is unaffected when the root is present

## 6. Verification

- [x] 6.1 `bun run build` passes (type-check + Vite build)
- [x] 6.2 `bun tauri dev` smoke test: select A3 (multi-page likely for a large model), verify page boundaries and numbering in the preview, verify overflow warning for an oversized island, click Print and confirm the OS native dialog opens with only the net pages
- [x] 6.3 `cargo check` still passes (no Rust changes expected; confirm nothing regressed)
