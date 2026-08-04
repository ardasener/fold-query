import { describe, expect, test } from "bun:test";
import type { Net, NetIsland } from "../types/unfold";
import { islandBounds, layoutPages, layoutPagesBestFit, layoutPagesSpaced, overflowIslands } from "./net-layout";

/** A unit square island (2 faces, 1mm x 1mm). */
function squareIsland(offset = 0): NetIsland {
  const o = offset;
  return {
    faces: [o * 2, o * 2 + 1],
    vertices: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    edges: [],
  };
}

function netOf(islands: NetIsland[]): Net {
  return { islands, islandCount: islands.length };
}

describe("layoutPages", () => {
  test("single page when everything fits", () => {
    const net = netOf([squareIsland(0), squareIsland(1)]);
    const pages = layoutPages(net, 100, 100);
    expect(pages.length).toBe(1);
    expect(pages[0].islands.length).toBe(2);
    for (const i of pages[0].islands) {
      expect(i.overflow).toBe(false);
    }
  });

  test("multi-page overflow by height", () => {
    // 5 squares in a 2-wide usable area -> 2 rows of 2 + 1 -> 3 rows -> 2 pages
    // if each row is 1mm and usable height is 2mm.
    const net = netOf([squareIsland(0), squareIsland(1), squareIsland(2), squareIsland(3), squareIsland(4)]);
    const pages = layoutPages(net, 2, 2);
    expect(pages.length).toBe(2);
    // Page 1 holds 2 rows of 2; page 2 holds the remaining 1.
    expect(pages[0].islands.length).toBe(4);
    expect(pages[1].islands.length).toBe(1);
  });

  test("multi-page overflow by width wraps to new rows then pages", () => {
    const net = netOf([squareIsland(0), squareIsland(1), squareIsland(2)]);
    const pages = layoutPages(net, 1.5, 1.5);
    // Each row fits 1 square (1.5 usable width, 1mm square + no gutter).
    // Row height 1 -> 1 row per page (usable height 1.5 fits 1 row of 1mm).
    expect(pages.length).toBe(3);
    expect(pages.every((p) => p.islands.length === 1)).toBe(true);
  });

  test("deterministic output", () => {
    const islands = Array.from({ length: 12 }, (_, i) => squareIsland(i));
    const a = layoutPages(netOf(islands), 5, 5);
    const b = layoutPages(netOf(islands), 5, 5);
    expect(a).toEqual(b);
  });

  test("islands are atomic: never scaled, never split", () => {
    // Every island's placed width/height equals its true bounds.
    const net = netOf([squareIsland(0), squareIsland(1)]);
    const pages = layoutPages(net, 1.5, 10);
    for (const p of pages) {
      for (const placed of p.islands) {
        const { width, height } = islandBounds(placed.island);
        expect(placed.width).toBe(width);
        expect(placed.height).toBe(height);
      }
    }
    // Each island appears on exactly one page.
    const appearances = new Map<number, number>();
    for (const p of pages) {
      for (const placed of p.islands) {
        appearances.set(placed.island.faces[0], (appearances.get(placed.island.faces[0]) ?? 0) + 1);
      }
    }
    for (const count of appearances.values()) {
      expect(count).toBe(1);
    }
  });

  test("oversized island flagged as overflow", () => {
    const big = squareIsland(0);
    // Widen the island to 10mm > usable 5mm.
    big.vertices = [
      [0, 0],
      [10, 0],
      [10, 1],
    ];
    const net = netOf([big, squareIsland(1)]);
    const pages = layoutPages(net, 5, 5);
    expect(pages.length).toBe(1);
    const overflow = overflowIslands(pages);
    expect(overflow.length).toBe(1);
    expect(overflow[0].island.faces[0]).toBe(0);
  });

  test("oversized island does not prevent other islands from packing", () => {
    const big = squareIsland(0);
    big.vertices = [
      [0, 0],
      [10, 0],
      [10, 1],
    ];
    const net = netOf([big, squareIsland(1)]);
    const pages = layoutPages(net, 5, 5);
    const normal = pages.flatMap((p) => p.islands.filter((i) => !i.overflow));
    expect(normal.length).toBe(1);
    expect(normal[0].island.faces[0]).toBe(2);
  });

  test("empty net produces no pages", () => {
    expect(layoutPages(netOf([]), 100, 100)).toEqual([]);
  });

  test("print transform places islands inside the usable area even with negative local coords", () => {
    // Islands from the unfold live in their own local frame which can extend
    // into negative coordinates (e.g. [-1, 0], [0, 1], ...). The print offset
    // is `placed.x - minX`, which must land the whole island inside the page.
    const island: NetIsland = {
      faces: [0, 1],
      vertices: [
        [-5, -3],
        [2, -3],
        [2, 4],
        [-5, 4],
      ],
      edges: [],
    };
    const net = netOf([island]);
    const pages = layoutPages(net, 50, 50);
    const placed = pages[0].islands[0];
    const { minX, minY } = islandBounds(placed.island);
    expect(minX).toBe(-5);
    expect(minY).toBe(-3);

    // Simulate the print document transform for every island vertex.
    for (const [vx, vy] of placed.island.vertices) {
      const px = placed.x + (vx - minX);
      const py = placed.y + (vy - minY);
      // Must stay within the usable area [0, 50] x [0, 50].
      expect(px).toBeGreaterThanOrEqual(0);
      expect(px).toBeLessThanOrEqual(50);
      expect(py).toBeGreaterThanOrEqual(0);
      expect(py).toBeLessThanOrEqual(50);
    }
  });

  describe("layoutPagesSpaced", () => {
    test("adds gutter between islands in a row and between rows", () => {
      // Usable 4x4 with 1mm squares and 1mm gutter: row holds 2 islands
      // (a at 0, b at 2), the third wraps to a new row (c at y=2).
      const net = netOf([squareIsland(0), squareIsland(1), squareIsland(2)]);
      const pages = layoutPagesSpaced(net, 4, 4, 1);
      const [a, b, c] = pages[0].islands;
      expect(a.x).toBe(0);
      expect(b.x).toBe(2); // 1mm island + 1mm gutter
      expect(b.y).toBe(0);
      expect(c.x).toBe(0);
      expect(c.y).toBe(2); // 1mm row + 1mm gutter
    });

    test("same page count as tight layout when space allows", () => {
      const islands = Array.from({ length: 6 }, (_, i) => squareIsland(i));
      const tight = layoutPages(netOf(islands), 10, 10);
      const spaced = layoutPagesSpaced(netOf(islands), 10, 10, 1);
      expect(spaced.length).toBe(tight.length);
    });
  });

  describe("layoutPagesBestFit", () => {
    test("uses spaced layout when it does not add pages", () => {
      // Two 1mm islands with the real 6mm gutter fit on one page (a at 0,
      // b at 7), so the spaced layout is kept.
      const result = layoutPagesBestFit(netOf([squareIsland(0), squareIsland(1)]), 10, 10);
      const [a, b] = result[0].islands;
      expect(result.length).toBe(1);
      expect(b.x - (a.x + a.width)).toBeGreaterThan(0);
    });

    test("falls back to tight layout when spacing forces extra pages", () => {
      // 5 islands in a 2x2 usable area: tight fits 4 + 1 = 2 pages; with
      // gutter it needs more pages, so best-fit must return the tight layout.
      const islands = Array.from({ length: 5 }, (_, i) => squareIsland(i));
      const result = layoutPagesBestFit(netOf(islands), 2, 2);
      const tight = layoutPages(netOf(islands), 2, 2);
      expect(result.length).toBe(tight.length);
      // Tight layout: islands within a row touch (no gutter).
      const [a, b] = result[0].islands;
      expect(b.x - (a.x + a.width)).toBe(0);
    });
  });
});
