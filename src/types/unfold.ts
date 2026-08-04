/** Classification of an edge in the 2D net (mirrors the Rust `EdgeKind`). */
export type EdgeKind = "cut" | "valley" | "mountain" | "coplanar";

/** An edge of an island in 2D, referencing island-local vertex indices. */
export interface NetEdge {
  a: number;
  b: number;
  kind: EdgeKind;
}

/** A single connected 2D patch of the unfolded net. */
export interface NetIsland {
  /** Source mesh face indices that belong to this island. */
  faces: number[];
  /** Flattened 2D coordinates [x, y], referenced by `edges`. */
  vertices: number[][];
  /** Every edge of the island (boundary and internal) with its classification. */
  edges: NetEdge[];
}

/** Stats about mesh decimation performed before unfolding. */
export interface SimplifiedStats {
  originalFaces: number;
  finalFaces: number;
  /** Present when decimation failed and the original mesh was used instead. */
  error?: string | null;
}

/** The unfolded net: a set of non-overlapping 2D islands. */
export interface Net {
  islands: NetIsland[];
  islandCount: number;
  /** Present when the input mesh was decimated before unfolding. */
  simplified?: SimplifiedStats | null;
}
