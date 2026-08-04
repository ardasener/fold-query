# FoldQuery Design

This document records the agreed architecture and the reasoning behind it. It is a living document: decisions here are made deliberately, and open questions are tracked explicitly.

## Product vision

FoldQuery is a desktop app for converting 3D models into papercraft templates (similar to Unfolder on macOS and Pepakura on Windows). The user loads or generates a 3D model, unfolds it into a flat net with glue tabs, packs the parts onto sheets, and exports print-ready templates.

## Tech stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19 + Ant Design 6 | UI: viewport, part tree, settings, agent chat |
| Shell | Tauri 2 (Rust) | Window, native services, **application brain** |
| CAD | Python + CadQuery | 3D model generation |
| Agent | OpenAI-compatible API (BYOK) | Writes CadQuery code to produce models |

Toolchain: Bun (package manager/runner), Vite (bundler).

## The two-stage pipeline

The core workflow splits into two distinct stages:

```
  model authoring              mechanical conversion
┌───────────────────┐      ┌────────────────────────────┐
│  agent writes     │      │  unfold → tabs → pack →    │
│  CadQuery code →  │ ───▶ │  export                    │
│  valid 3D geometry│      │  (deterministic algorithms)│
└───────────────────┘      └────────────────────────────┘
```

1. **Model authoring** — an agent writes CadQuery source code; the code is executed and iterated until it produces valid 3D geometry. The CadQuery script is the artifact the user can review, edit, and re-run.
2. **Mechanical conversion** — a deterministic pipeline converts the finished geometry into flat nets: unfold into faces, generate glue tabs, pack parts onto sheets, export SVG/PDF/PNG.

Reference algorithms for the mechanical stage:
- **Blender `export_paper_model.py`** — unfolding math, angle thresholds, and flap generation (blueprint).
- **`osresearch/papercraft`** (C) — STL-to-SVG unfolding with collision-checked part packing.
- **`rodrigorc/papercraft`** (Rust/OpenGL) — Pepakura `.pdo` viewer and manual join/cut editor; a UX reference for the interactive net editor. Does not implement its own unfold.

## Unfolding Pipeline: Algorithms

The mechanical conversion stage is a deterministic pipeline of six algorithmic phases. All run in Rust on triangle mesh data (`vertices[N][3], faces[M][3]`). Triangles are the working unit — n-gons from CadQuery are triangulated as a preprocessing step.

**Preprocessing — vertex welding:** CadQuery's `tessellate()` emits triangle soup: every face carries its own copies of corner coordinates, so the vertex array holds several entries for the same geometric point and no index is shared across faces. Before Phase 1, coincident vertices (within `1e-6 × bbox_diag`) are merged by position via a spatial hash, producing a shared-indexed manifold mesh that the adjacency phase can reason about.

### Phase 1: Half-Edge Adjacency

Convert raw triangle soup into a half-edge structure where each directed edge knows its twin, incident faces, and the dihedral angle between them.

```
build_adjacency(vertices, faces) -> HalfEdge[]

  for each face f = (v0, v1, v2):
    for each directed edge e = (vi, vj) along face f:
      h = new HalfEdge(origin=vi, face=f)
      key = sorted_pair(vi, vj)
      insert h into edge_map[key]

  for each key in edge_map:
    let batch = edge_map[key]
    |batch| == 2 → pair as twins
    |batch| == 1 → mark boundary edge (no twin)
    |batch|  > 2 → non-manifold edge (choose the pair with most-aligned normals)

  for each twin pair (h_a, h_b):
    dihedral = asin( normal_a × normal_b · edge_normalized )
    clamp dihedral to [-π/2, π/2]
    store dihedral on both half-edge records
```

### Phase 2: Priority-Weighted Edge Ordering

Each edge between two faces receives a cut-priority score. Lower score = fold (keep connected). Higher score = cut (seam). The scoring function encodes the physical intuition that concave folds cause the most 2D overlap.

```
score_edge(edge, avg_edge_len, w):
  convex  = w.CONVEX  * max( dihedral, 0) / π
  concave = w.CONCAVE * max(-dihedral, 0) / π
  length  = w.LENGTH  * edge.len / avg_edge_len
  return convex + concave + length

Default weights: CONVEX = 0.5,  CONCAVE = 1.0,  LENGTH = -0.05
```

Concave edges (folding inward, dihedral < 0) are cut first. Convex edges (folding outward) are safer to keep as folds. Longer edges are slightly cheaper to keep, avoiding long seam lines.

```
order_edges(edges, weights):
  avg_len = mean(edge.len for edge in edges)
  scored  = { edge: score_edge(edge, avg_len, weights) }
  return edges sorted by score ascending
```

### Phase 3: Greedy Island Construction

Every face starts as its own island — a flat 2D polygon in its local plane. Process dual-graph edges in ascending priority order: for each edge linking two *different* islands, attempt to join them in 2D. If the join would cause self-overlap, cut the edge instead.

```
unfold(vertices, faces, ordered_edges):

  islands = { f → new Island(flatten(face f)) }   // one island per face

  for each edge connecting face f_a to face f_b in ordered_edges:
    island_A = islands[f_a]
    island_B = islands[f_b]
    if island_A == island_B: continue              // already merged

    phantom = flatten_across(island_B, edge_ab)     // Phase 4

    if no_overlap(island_A, phantom):               // Phase 5
      merge(island_A, phantom)
      for face f in island_B: islands[f] = island_A
    else:
      mark edge as CUT (seam)                       // split the spanning tree

  return deduplicated islands as flat 2D patches
```

### Phase 4: Face Flattening & Cross-Edge Projection

**Flattening a single face** into its local 2D coordinate system (isometric — preserves edge lengths and angles):

```
flatten(face_3d):
  normal = cross(v1 - v0, v2 - v0).normalized()
  u = (v1 - v0).normalized()          // local x-axis
  v = cross(normal, u).normalized()    // local y-axis
  for each vertex p in face:
    p_2d = ( dot(p - v0, u),  dot(p - v0, v) )
  orient vertices counterclockwise; return 2D polygon
```

**Projecting island B across a shared edge into island A's plane:**

```
flatten_across(island_B, edge_AB):
  // edge_AB appears in island_A's 2D coords as segment (a₀, a₁)
  // and in island_B's 2D coords as segment (b₀, b₁), winding may be reversed

  a_dir = a₁ - a₀
  b_dir = b₀ - b₁  if winding matches else  b₁ - b₀          // align direction

  M = fitting_matrix(a_dir, b_dir)                             // 2×2 rotation
  translation = a₀ - M @ b₀

  for each vertex v in island_B:
    v' = M @ v + translation
  return island_B with transformed vertices
```

`fitting_matrix(a, b)` returns the 2×2 matrix that rotates vector `b` onto vector `a`:
```
fitting_matrix(a, b):
  return (1 / |a|²) * [ a·b    a×b ]
                      [ -a×b   a·b ]
```

### Phase 5: Overlap Rejection

Determines whether the transformed island B overlaps with island A in 2D. Tests boundary edges only — internal edges cannot overlap by construction.

**Spatial hash pre-filter** (fast, O(n) expected):

```
spatial_hash_filter(boundary_A, boundary_B, cell_size):
  for each segment: register in hash grid cells the segment intersects
  pairs = empty set
  for each cell with segments from both islands:
    for each pair (seg_a, seg_b) in the cell:
      if bounding boxes intersect: add to pairs
  return deduplicated pairs
```

**Segment intersection test** (the actual geometric check):

```
segment_intersects(s1, s2):
  // Standard CCW cross-product test. Excludes endpoint sharing
  // (shared vertices at the hinge edge are not overlaps).
  if s1 and s2 share an endpoint: return false

  d1 = cross(s1.dir, s2.p₀ - s1.p₀)
  d2 = cross(s1.dir, s2.p₁ - s1.p₀)
  d3 = cross(s2.dir, s1.p₀ - s2.p₀)
  d4 = cross(s2.dir, s1.p₁ - s2.p₀)

  return sign(d1) ≠ sign(d2) AND sign(d3) ≠ sign(d4)
```

**Fallback: brute-force over all boundary edges** (O((n+m)²), used for small or degenerate islands):

```
brute_force_overlap(boundary_A, boundary_B):
  for each seg_a in boundary_A:
    for each seg_b in boundary_B:
      if segment_intersects(seg_a, seg_b): return true
  return false
```

**Containment test** (one island entirely inside the other):

```
containment_test(polygon_A, polygon_B):
  // Use winding-number against every vertex of the smaller polygon.
  if |A| > |B|: swap
  for each vertex v in polygon A:
    if winding_number(v, polygon B) is odd: return true  // A vertex inside B
  return false
```

```
no_overlap(island_A, phantom_B):
  pairs = spatial_hash_filter(A.boundary, phantom_B.boundary, cell_size=bbox_diag/8)
  if pairs is empty AND not containment_test(A, phantom_B):
    return true
  for each (seg_a, seg_b) in pairs:
    if segment_intersects(seg_a, seg_b): return false
  if containment_test(A, phantom_B): return false
  return true
```

### Phase 6: Post-Processing

**Fold classification** — applied per island, per internal edge between adjacent faces:

```
classify_folds(island):
  for each internal edge e in island:
    dihedral = e.original_dihedral      // from half-edge adjacency (Phase 1)
    if |tan(dihedral)| < 1e-3:  label = COPLANAR  (flat, no fold line)
    elif dihedral > 0:          label = MOUNTAIN  (angle > 180°)
    elif dihedral < 0:          label = VALLEY    (angle < 180°)
```

**Glue tab generation** — per cut edge, extruded on the face with larger area:

```
generate_tabs(island, cut_edges, tab_width):
  for each cut edge (uvedge, partner) in island:
    base = the face with larger area between uvedge.face and partner.face

    // extrude a trapezoid outward from the cut edge
    edge_dir   = (v₁ - v₀).normalized()
    edge_len   = |v₁ - v₀|
    out_dir    = perpendicular(outward from base)

    cosφ = max(0.5, edge_dir · neighbor_edge_dirs)   // clip corners for adjacent tabs
    tab_h     = min(tab_width, edge_len / 2)
    inner_w   = edge_len - 2 * tab_h * sqrt(1 - cosφ²) / cosφ

    offset = (edge_len - inner_w) / 2               // inward offset from each end
    inner_left  = v₀ + tab_h * out_dir + offset * edge_dir
    inner_right = v₁ + tab_h * out_dir - offset * edge_dir

    tab_poly = [v₀, v₁, inner_right, inner_left]  // CCW trapezoid
    check tab_poly against neighboring tabs; truncate if overlap detected
```

**Page packing** — arranges islands onto printable sheets:

```
pack_islands(islands, page_size, margin):
  usable = page_size - 2 * margin
  sort islands by bounding-box diagonal descending (largest first)
  pages = []

  for each island in sorted islands:
    placed = false
    for each page in pages:
      // skyline/shelf packing: scan row by row, left to right
      for each candidate position (x, y) on the page's skyline:
        if island fits at (x, y) without overlapping placed islands:
          place island; update skyline; placed = true; break
      if placed: break
    if not placed:
      pages.push(new Page); place island at origin
  return pages
```

### Complexity

| Phase | Complexity | Typical (2K-face mesh) |
|---|---|---|
| Half-edge adjacency | O(F log F) hash | ~1 ms |
| Edge scoring + sort | O(E log E) | ~1 ms |
| Greedy island join | O(E × overlap_test) | ~5–50 ms |
| Overlap test (hash filter) | O((n+m) + k²) avg | ~0.1 ms per join |
| Tab generation | O(C), C = cut edges | ~1 ms |
| Page packing | O(I²), I = islands | ~1 ms |

---

## Agreed decisions

### D1: The agent lives in Rust, not Python

The agent loop (LLM calls, conversation state, tool dispatch) runs in the compiled Rust binary.

**Why:** Python is the only uncontrolled runtime dependency — we do not bundle a Python interpreter, so the client's Python version is unknown and outside our control. The product's core logic must not depend on an environment we don't own. The agent is the most important logic in the app, so it lives in the one place we fully control: the bundled binary.

The LLM API is plain HTTP/JSON, so Rust (`reqwest`) hosts the loop naturally. An additional benefit: the BYOK key is handled in Rust (read from the OS keychain) and never exposed to the webview.

### D2: The Python sidecar is thin

Python runs only what inherently requires CadQuery:
- Execute a CadQuery script and return stdout/stderr/exit status + the resulting mesh (the agent's "run" tool).

No conversation state, no agent logic, no decision-making in Python. The sidecar is a replaceable execution engine.

### D2bis: The mechanical pipeline runs in Rust

Unfolding, tab generation, island packing, and export are pure computational geometry on a
triangulated mesh — zero dependency on CadQuery. The mesh already flows through Rust
(`MeshObject { vertices, faces }` from `ScriptResult`), so the pipeline runs as Tauri
commands on that same data without touching Python.

### D3: JSON-RPC over stdio between Rust and the sidecar

The Rust ↔ Python transport is JSON-RPC framed as newline-delimited JSON over the sidecar's stdio.

**Why:** it is private single-client IPC (only the Rust shell talks to the sidecar), so HTTP's discoverability buys nothing. stdio gives:
- Native full-duplex bidirectional streaming (token streaming, progress events) with correlation IDs.
- Identical behavior on macOS and Windows.
- No ports, no firewall/sandbox/entitlement surface, no auth token needed.
- No extra Python dependencies.

**Framing discipline:** protocol on stdout as NDJSON; all logs to stderr. If native libraries still pollute stdout, reserve a dedicated fd (e.g., fd 3) for the protocol.

**Hedge:** the transport is abstracted on both sides (a `SidecarClient` trait in Rust, a transport module in Python) so it can be swapped for HTTP if the agent ever goes remote or needs multi-client.

### D4: Managed Python venv bootstrapped via `uv`

To control Python/CadQuery version drift without bundling a Python runtime, the app bootstraps an isolated environment on first run:

```
detect system Python → uv venv (app data dir) → uv pip install pinned/locked deps
→ spawn sidecar from the venv's python
```

`uv` can fetch a known-good standalone CPython if the system one is unusable. Deps (CadQuery, the sidecar package) are pinned via a lockfile.

### D5: BYOK key handling in Rust

The user's API key and base URL for the OpenAI-compatible provider are stored via the OS keychain and handled by Rust. The webview never holds the key. Provider configuration is a future settings capability.

## Open questions

- **Code editor integration** — whether/how to embed a code editor for the CadQuery script (e.g., Monaco) is undecided; explore when the editor spec is written.
- **Sidecar transport details** — stdio framing specifics and fd reservation are decided at a high level above; exact protocol messages are deferred to the sidecar spec.
- **Sandboxing agent-generated code** — executing LLM-generated Python needs a consent/sandbox design (subprocess with timeout, restricted working directory, user approval to run). Deferred.
- **Geometry preview** — how the sidecar produces a 3D preview for the viewport (exported mesh format, event flow) is undecided.

## Risks and trade-offs

- **Agent-generated code execution** — the sidecar executes LLM-written Python on the user's machine. Needs the consent/sandbox design above.
- **Python/CadQuery compatibility** — CadQuery/OCP wheels lag newest CPython releases. Mitigated by the pinned, `uv`-managed venv (D4).
- **Python runtime absent or broken** — first-run bootstrap must degrade gracefully with a clear setup flow.
- **Single-stdio bottleneck** — one pipe multiplexes all traffic; fine for a local single-user app but the abstraction (D3 hedge) keeps an escape hatch.
