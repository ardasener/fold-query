import type { Net, NetIsland } from "../types/unfold";

/** An island positioned on a page with its bounding box. */
export interface PlacedIsland {
  island: NetIsland;
  /** Offset of the island's bounding box top-left on the page, in mm. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** True when the island is too large for the usable page area. */
  overflow: boolean;
  /** Globally unique 1-based label, identical in preview and print. */
  label: number;
}

/** One printable sheet with its islands at true mm positions. */
export interface PrintPage {
  pageIndex: number;
  /** Usable page area in mm (paper minus margin). */
  widthMm: number;
  heightMm: number;
  islands: PlacedIsland[];
}

/** Bounding box of an island's 2D vertices. */
export function islandBounds(island: NetIsland): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of island.vertices) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Pack islands into pages of the usable sheet area using a greedy row-wrap.
 * Islands are atomic (never scaled, never split); when a row overflows the
 * usable width it wraps, and when no room remains on a page a new page starts.
 * Islands too large for the usable area are flagged `overflow` and placed at
 * the page origin at 1:1 (running off the page). Deterministic.
 */
export function layoutPages(net: Net, usableWidthMm: number, usableHeightMm: number): PrintPage[] {
  const sorted = [...net.islands].sort((a, b) => b.faces.length - a.faces.length);
  const pages: PrintPage[] = [];
  let current: PrintPage | null = null;
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let nextLabel = 1;

  const startPage = (): PrintPage => {
    const page: PrintPage = {
      pageIndex: pages.length,
      widthMm: usableWidthMm,
      heightMm: usableHeightMm,
      islands: [],
    };
    pages.push(page);
    return page;
  };

  for (const island of sorted) {
    const { width, height } = islandBounds(island);
    const label = nextLabel++;
    if (width > usableWidthMm || height > usableHeightMm) {
      // Cannot fit on any page; place at origin on the first page, flagged.
      current = current ?? startPage();
      current.islands.push({ island, x: 0, y: 0, width, height, overflow: true, label });
      continue;
    }
    // Find a spot: advance to a new row or page until the island fits.
    for (;;) {
      if (!current || cursorY + height > usableHeightMm) {
        current = startPage();
        cursorX = 0;
        cursorY = 0;
        rowHeight = 0;
      }
      if (cursorX === 0 || cursorX + width <= usableWidthMm) {
        break; // fits in the current row
      }
      // Wrap to the next row (vertical fit is re-checked at the top of the loop).
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    current.islands.push({ island, x: cursorX, y: cursorY, width, height, overflow: false, label });
    cursorX += width;
    rowHeight = Math.max(rowHeight, height);
  }

  return pages;
}

/** Islands flagged as too large for the usable page area. */
export function overflowIslands(pages: PrintPage[]): PlacedIsland[] {
  return pages.flatMap((p) => p.islands.filter((i) => i.overflow));
}

/** Spacing (mm) added between islands when a spaced layout fits. */
export const PACK_GUTTER_MM = 6;

/**
 * Pack islands into pages with `gutterMm` spacing between islands (both within
 * a row and between rows). Uses the greedy row-wrap of `layoutPages`, so the
 * result is deterministic and islands stay atomic.
 */
export function layoutPagesSpaced(
  net: Net,
  usableWidthMm: number,
  usableHeightMm: number,
  gutterMm: number = PACK_GUTTER_MM,
): PrintPage[] {
  const sorted = [...net.islands].sort((a, b) => b.faces.length - a.faces.length);
  const pages: PrintPage[] = [];
  let current: PrintPage | null = null;
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let nextLabel = 1;

  const startPage = (): PrintPage => {
    const page: PrintPage = {
      pageIndex: pages.length,
      widthMm: usableWidthMm,
      heightMm: usableHeightMm,
      islands: [],
    };
    pages.push(page);
    return page;
  };

  for (const island of sorted) {
    const { width, height } = islandBounds(island);
    const label = nextLabel++;
    if (width > usableWidthMm || height > usableHeightMm) {
      // Cannot fit on any page; place at origin on the first page, flagged.
      current = current ?? startPage();
      current.islands.push({ island, x: 0, y: 0, width, height, overflow: true, label });
      continue;
    }
    // Find a spot: advance to a new row or page until the island fits.
    for (;;) {
      if (!current || cursorY + height > usableHeightMm) {
        current = startPage();
        cursorX = 0;
        cursorY = 0;
        rowHeight = 0;
      }
      if (cursorX === 0 || cursorX + width <= usableWidthMm) {
        break; // fits in the current row
      }
      // Wrap to the next row (vertical fit is re-checked at the top of the loop).
      cursorX = 0;
      cursorY += rowHeight + gutterMm;
      rowHeight = 0;
    }
    current.islands.push({ island, x: cursorX, y: cursorY, width, height, overflow: false, label });
    cursorX += width + gutterMm;
    rowHeight = Math.max(rowHeight, height);
  }

  return pages;
}

/**
 * Prefer the spaced layout when it fits within the same number of pages as the
 * tight layout; otherwise fall back to the tight layout (no gutter).
 */
export function layoutPagesBestFit(net: Net, usableWidthMm: number, usableHeightMm: number): PrintPage[] {
  const tight = layoutPages(net, usableWidthMm, usableHeightMm);
  const spaced = layoutPagesSpaced(net, usableWidthMm, usableHeightMm, PACK_GUTTER_MM);
  return spaced.length <= tight.length ? spaced : tight;
}
