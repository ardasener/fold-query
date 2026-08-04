/** A selectable paper size (portrait only). */
export interface PaperSize {
  id: PaperSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
}

export type PaperSizeId = "a5" | "a4" | "a3" | "us-letter" | "us-legal" | "tabloid";

export const PAPER_SIZES: PaperSize[] = [
  { id: "a5", label: "A5", widthMm: 148, heightMm: 210 },
  { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  { id: "a3", label: "A3", widthMm: 297, heightMm: 420 },
  { id: "us-letter", label: "US Letter", widthMm: 215.9, heightMm: 279.4 },
  { id: "us-legal", label: "US Legal", widthMm: 215.9, heightMm: 355.6 },
  { id: "tabloid", label: "Tabloid", widthMm: 279.4, heightMm: 431.8 },
];

export const PAPER_DEFAULT: PaperSizeId = "a4";

/** The fixed print margin applied on every side of the sheet. */
export const PRINT_MARGIN_MM = 10;

export function getPaper(id: PaperSizeId | undefined): PaperSize {
  return PAPER_SIZES.find((p) => p.id === id) ?? PAPER_SIZES.find((p) => p.id === PAPER_DEFAULT)!;
}

export function isPaperId(value: unknown): value is PaperSizeId {
  return typeof value === "string" && PAPER_SIZES.some((p) => p.id === value);
}

/** The printable area of a sheet: paper size minus the margin on each side. */
export function usableAreaMm(paper: PaperSize, marginMm: number): { widthMm: number; heightMm: number } {
  return {
    widthMm: Math.max(1, paper.widthMm - 2 * marginMm),
    heightMm: Math.max(1, paper.heightMm - 2 * marginMm),
  };
}
