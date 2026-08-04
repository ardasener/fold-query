import { islandBounds, layoutPagesBestFit, type PrintPage } from "./net-layout";
import { PRINT_MARGIN_MM, usableAreaMm, type PaperSize } from "./paper";
import type { Net, NetIsland } from "../types/unfold";

export const PRINT_ROOT_ID = "foldquery-print-root";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Render one island as a `<g>` translated by `(dx, dy)` so that the island's
 * raw local coordinates (which may extend into negative territory) land at
 * their placed position. Coordinates are mm (mesh units are preserved by the
 * unfold), so 1 unit = 1mm.
 */
function appendIsland(
  svg: SVGSVGElement,
  island: NetIsland,
  dx: number,
  dy: number,
  label: string,
): void {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("transform", `translate(${dx} ${dy})`);

  for (const edge of island.edges) {
    if (edge.kind === "coplanar") continue;
    const [x1, y1] = island.vertices[edge.a];
    const [x2, y2] = island.vertices[edge.b];
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "black");
    path.setAttribute("stroke-width", "0.3");
    if (edge.kind === "valley") path.setAttribute("stroke-dasharray", "2 1.5");
    else if (edge.kind === "mountain") path.setAttribute("stroke-dasharray", "0.6 1.5");
    group.appendChild(path);
  }

  // Island label at its bounding-box center (local coordinates inside the group).
  const { minX, minY, width, height } = islandBounds(island);
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(minX + width / 2));
  text.setAttribute("y", String(minY + height / 2));
  text.setAttribute("font-size", "3");
  text.setAttribute("text-anchor", "middle");
  text.textContent = label;
  group.appendChild(text);

  svg.appendChild(group);
}

/** Build the detached print root containing one page per sheet. */
export function buildPrintDocument(net: Net, paper: PaperSize, marginMm: number = PRINT_MARGIN_MM): HTMLDivElement {
  const { widthMm, heightMm } = usableAreaMm(paper, marginMm);
  const pages = layoutPagesBestFit(net, widthMm, heightMm);

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;

  // Style scoped to the print root: native print dialog preselects the paper,
  // app chrome is hidden, each page starts on a fresh sheet. The page div is
  // the full paper size with the margin as padding (box-sizing: border-box),
  // so the SVG content box is exactly the usable area.
  const style = document.createElement("style");
  style.textContent = `
    @page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: 0; }
    #${PRINT_ROOT_ID} { display: block; }
    #${PRINT_ROOT_ID} .print-page {
      width: ${paper.widthMm}mm;
      height: ${paper.heightMm}mm;
      padding: ${marginMm}mm;
      box-sizing: border-box;
      page-break-after: always;
    }
    #${PRINT_ROOT_ID} .print-page:last-child { page-break-after: auto; }
    #${PRINT_ROOT_ID} .print-page svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    @media print {
      body > #root { display: none !important; }
      #${PRINT_ROOT_ID} { display: block !important; }
    }
  `;
  root.appendChild(style);

  pages.forEach((page: PrintPage) => {
    const div = document.createElement("div");
    div.className = "print-page";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${page.widthMm} ${page.heightMm}`);
    for (const placed of page.islands) {
      const { minX, minY } = islandBounds(placed.island);
      // The margin is applied by the page div's padding; the island's local
      // frame offset (minX/minY) is cancelled here so the island lands at its
      // placed position within the usable area.
      appendIsland(svg, placed.island, placed.x - minX, placed.y - minY, String(placed.label));
    }
    div.appendChild(svg);
    root.appendChild(div);
  });

  return root;
}
