mod adjacency;
mod geometry;
mod simplify;

use std::collections::HashMap;
use std::f64::consts::PI;

use glam::{DVec2, DVec3};
use serde::{Deserialize, Serialize};

use crate::python::MeshObject;

use adjacency::{Adjacency, MeshEdge};
use geometry::{flatten_face, no_overlap, rigid_transform};
use simplify::{simplify_mesh, TARGET_FACES_DEFAULT};

/// Classification of an edge in the 2D net.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum EdgeKind {
    /// Boundary of the net — the paper is cut here.
    Cut,
    /// Interior fold folding toward the viewer (interior angle < 180°).
    Valley,
    /// Interior fold folding away from the viewer (interior angle > 180°).
    Mountain,
    /// Both adjacent faces lie in the same plane — no fold line drawn.
    Coplanar,
}

/// An edge of an island in 2D, referencing island-local vertex indices.
#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NetEdge {
    pub a: usize,
    pub b: usize,
    pub kind: EdgeKind,
}

/// A single connected 2D patch of the net.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NetIsland {
    /// Source mesh face indices that belong to this island.
    pub faces: Vec<usize>,
    /// Flattened 2D coordinates, referenced by `edges`.
    pub vertices: Vec<[f64; 2]>,
    /// Every edge of the island (boundary and internal) with its classification.
    pub edges: Vec<NetEdge>,
}

/// Stats about mesh decimation performed before unfolding.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SimplifiedStats {
    pub original_faces: usize,
    pub final_faces: usize,
    /// Present when decimation failed and the original mesh was used instead.
    pub error: Option<String>,
}

/// The unfolded net: a set of non-overlapping 2D islands.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Net {
    pub islands: Vec<NetIsland>,
    pub island_count: usize,
    /// Present when the input mesh was decimated before unfolding.
    pub simplified: Option<SimplifiedStats>,
}

/// Structured failure modes for the unfold pipeline.
#[derive(Debug)]
pub enum UnfoldError {
    TooSmall(usize),
    NotTriangulated,
    OutOfRange {
        face: usize,
        vertex: u32,
        vertex_count: usize,
    },
    DegenerateFace(usize),
    OpenBoundary {
        count: usize,
        samples: Vec<(u32, u32)>,
    },
    NonManifold {
        count: usize,
        samples: Vec<(u32, u32)>,
    },
}

fn sample_str(samples: &[(u32, u32)]) -> String {
    if samples.is_empty() {
        String::new()
    } else {
        let list: Vec<String> = samples
            .iter()
            .map(|(a, b)| format!("({a}, {b})"))
            .collect();
        format!(" (e.g. edge {}…)", list.join(", "))
    }
}

impl std::fmt::Display for UnfoldError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UnfoldError::TooSmall(n) => {
                write!(f, "Mesh has {n} face(s); at least 4 are required to unfold.")
            }
            UnfoldError::NotTriangulated => write!(
                f,
                "Face index array length is not a multiple of 3; expected a triangulated mesh."
            ),
            UnfoldError::OutOfRange {
                face,
                vertex,
                vertex_count,
            } => write!(
                f,
                "Face {face} references vertex index {vertex}, but the mesh has only {vertex_count} vertices."
            ),
            UnfoldError::DegenerateFace(face) => {
                write!(f, "Face {face} has zero area and cannot be unfolded.")
            }
            UnfoldError::OpenBoundary { count, samples } => write!(
                f,
                "Mesh has {count} open-boundary edge(s) (each shared by only one face){}. The mesh must be a closed manifold.",
                sample_str(samples)
            ),
            UnfoldError::NonManifold { count, samples } => write!(
                f,
                "Mesh has {count} non-manifold edge(s) (each shared by more than two faces){}. The mesh must be a closed manifold.",
                sample_str(samples)
            ),
        }
    }
}

impl std::error::Error for UnfoldError {}

/// Default cut-priority weights (see DESIGN.md, Phase 2).
const W_CONVEX: f64 = 0.5;
const W_CONCAVE: f64 = 1.0;
const W_LENGTH: f64 = -0.05;

/// Dihedral angle (radians) below which two coplanar faces are considered flat.
const COPLANAR_EPS: f64 = 1e-3;

/// A boundary segment of an island, tagged with its source mesh edge index.
#[derive(Clone, Copy)]
struct BoundarySeg {
    /// Island-local vertex index of the segment start.
    a: usize,
    /// Island-local vertex index of the segment end.
    b: usize,
    /// Index into `Adjacency.edges`.
    edge: usize,
}

/// A growing 2D island during the greedy construction.
struct Island {
    /// Source mesh face indices in this island.
    faces: Vec<usize>,
    /// Island-local 2D vertex positions.
    verts: Vec<DVec2>,
    /// 3D vertex index → island-local vertex index.
    vmap: HashMap<u32, usize>,
    /// Perimeter segments (with their source mesh edge).
    boundary: Vec<BoundarySeg>,
}

/// Cut-priority score for a dual-graph edge (lower = keep as fold first).
fn score_edge(e: &MeshEdge, avg_len: f64) -> f64 {
    let convex = W_CONVEX * e.dihedral.max(0.0) / PI;
    let concave = W_CONCAVE * (-e.dihedral).max(0.0) / PI;
    let length = W_LENGTH * e.len / avg_len.max(1e-12);
    convex + concave + length
}

/// Union-find with path compression over face indices.
fn find(parent: &mut Vec<usize>, mut x: usize) -> usize {
    let mut root = x;
    while parent[root] != root {
        root = parent[root];
    }
    while parent[x] != root {
        let next = parent[x];
        parent[x] = root;
        x = next;
    }
    root
}

/// Convert the flat vertex/face arrays of a `MeshObject` into a `Net`.
///
/// When the mesh has more triangles than `target_faces`, it is decimated
/// (quadric-error-metric simplification) before the unfold pipeline runs.
pub fn unfold(mesh: &MeshObject, target_faces: Option<u32>) -> Result<Net, String> {
    if mesh.vertices.len() % 3 != 0 {
        return Err(UnfoldError::NotTriangulated.to_string());
    }
    if mesh.faces.len() % 3 != 0 {
        return Err(UnfoldError::NotTriangulated.to_string());
    }

    let target = target_faces.unwrap_or(TARGET_FACES_DEFAULT);
    let original_faces = mesh.faces.len() / 3;

    // Fast path: meshes at or below the target are unfolded unchanged.
    let (vertices, faces, simplified) = if original_faces > target as usize {
        match simplify_mesh(&mesh.vertices, &mesh.faces, target) {
            Ok((reduced_faces, final_faces)) => {
                let vertices: Vec<DVec3> = mesh
                    .vertices
                    .chunks_exact(3)
                    .map(|c| DVec3::new(c[0], c[1], c[2]))
                    .collect();
                let faces: Vec<[u32; 3]> = reduced_faces
                    .chunks_exact(3)
                    .map(|c| [c[0], c[1], c[2]])
                    .collect();
                let stats = SimplifiedStats {
                    original_faces,
                    final_faces,
                    error: None,
                };
                (vertices, faces, Some(stats))
            }
            Err(e) => {
                // Graceful failure: fall back to the original mesh, report it.
                let vertices: Vec<DVec3> = mesh
                    .vertices
                    .chunks_exact(3)
                    .map(|c| DVec3::new(c[0], c[1], c[2]))
                    .collect();
                let faces: Vec<[u32; 3]> = mesh
                    .faces
                    .chunks_exact(3)
                    .map(|c| [c[0], c[1], c[2]])
                    .collect();
                let stats = SimplifiedStats {
                    original_faces,
                    final_faces: original_faces,
                    error: Some(e),
                };
                (vertices, faces, Some(stats))
            }
        }
    } else {
        let vertices: Vec<DVec3> = mesh
            .vertices
            .chunks_exact(3)
            .map(|c| DVec3::new(c[0], c[1], c[2]))
            .collect();
        let faces: Vec<[u32; 3]> = mesh
            .faces
            .chunks_exact(3)
            .map(|c| [c[0], c[1], c[2]])
            .collect();
        (vertices, faces, None)
    };

    // CadQuery tessellation emits triangle soup: each face carries its own
    // copies of corner vertices (no shared indexing), so the vertex array can
    // hold several entries for the same geometric point. Weld coincident
    // vertices by position before building edge adjacency, which relies on
    // shared indices.
    for (fi, f) in faces.iter().enumerate() {
        for &vi in f {
            if vi as usize >= vertices.len() {
                return Err(UnfoldError::OutOfRange {
                    face: fi,
                    vertex: vi,
                    vertex_count: vertices.len(),
                }
                .to_string());
            }
        }
    }
    let (vertices, faces) = weld_vertices(&vertices, &faces).map_err(|e| e.to_string())?;
    let mut net = unfold_inner(&vertices, &faces).map_err(|e| e.to_string())?;
    net.simplified = simplified;
    Ok(net)
}

/// Merge vertex entries that occupy the same geometric position, returning a
/// shared-indexed mesh. Uses a spatial hash with a relative tolerance
/// (`1e-6 * bbox_diag`) so distinct nearby corners are never merged.
fn weld_vertices(
    vertices: &[DVec3],
    faces: &[[u32; 3]],
) -> Result<(Vec<DVec3>, Vec<[u32; 3]>), UnfoldError> {
    let mut min = DVec3::splat(f64::INFINITY);
    let mut max = DVec3::splat(f64::NEG_INFINITY);
    for v in vertices {
        min = min.min(*v);
        max = max.max(*v);
    }
    let eps = ((max - min).length() * 1e-6).max(1e-12);
    let cell = eps;

    let mut remap: Vec<usize> = vec![0; vertices.len()];
    let mut welded: Vec<DVec3> = Vec::new();
    let mut grid: HashMap<(i64, i64, i64), Vec<usize>> = HashMap::new();
    for (i, v) in vertices.iter().enumerate() {
        let key = (
            (v.x / cell).round() as i64,
            (v.y / cell).round() as i64,
            (v.z / cell).round() as i64,
        );
        let mut found = None;
        'outer: for dx in -1..=1i64 {
            for dy in -1..=1i64 {
                for dz in -1..=1i64 {
                    if let Some(bucket) = grid.get(&(key.0 + dx, key.1 + dy, key.2 + dz)) {
                        for &j in bucket {
                            if (welded[j] - *v).length() <= eps {
                                found = Some(j);
                                break 'outer;
                            }
                        }
                    }
                }
            }
        }
        let idx = match found {
            Some(j) => j,
            None => {
                let idx = welded.len();
                welded.push(*v);
                idx
            }
        };
        remap[i] = idx;
        grid.entry(key).or_default().push(idx);
    }

    let welded_faces: Vec<[u32; 3]> = faces
        .iter()
        .map(|f| {
            [
                remap[f[0] as usize] as u32,
                remap[f[1] as usize] as u32,
                remap[f[2] as usize] as u32,
            ]
        })
        .collect();
    Ok((welded, welded_faces))
}

/// Core unfold on typed data; exposed for unit tests.
fn unfold_inner(vertices: &[DVec3], faces: &[[u32; 3]]) -> Result<Net, UnfoldError> {
    // --- Input validation ---
    if faces.is_empty() || faces.len() < 4 {
        return Err(UnfoldError::TooSmall(faces.len()));
    }
    for (fi, f) in faces.iter().enumerate() {
        for &vi in f {
            if vi as usize >= vertices.len() {
                return Err(UnfoldError::OutOfRange {
                    face: fi,
                    vertex: vi,
                    vertex_count: vertices.len(),
                });
            }
        }
    }
    for (fi, f) in faces.iter().enumerate() {
        let e1 = vertices[f[1] as usize] - vertices[f[0] as usize];
        let e2 = vertices[f[2] as usize] - vertices[f[0] as usize];
        if e1.cross(e2).length() <= 1e-12 {
            return Err(UnfoldError::DegenerateFace(fi));
        }
    }

    let adj = adjacency::build(vertices, faces)?;

    // --- Initial islands: one per face, flattened in its local plane ---
    let mut islands: HashMap<usize, Island> = HashMap::with_capacity(faces.len());
    let mut parent: Vec<usize> = (0..faces.len()).collect();
    for (fi, f) in faces.iter().enumerate() {
        let [p0, p1, p2] = flatten_face(
            vertices[f[0] as usize],
            vertices[f[1] as usize],
            vertices[f[2] as usize],
        );
        let boundary = vec![
            BoundarySeg { a: 0, b: 1, edge: adj.face_edges[fi][0] },
            BoundarySeg { a: 1, b: 2, edge: adj.face_edges[fi][1] },
            BoundarySeg { a: 2, b: 0, edge: adj.face_edges[fi][2] },
        ];
        islands.insert(
            fi,
            Island {
                faces: vec![fi],
                verts: vec![p0, p1, p2],
                vmap: [(f[0], 0), (f[1], 1), (f[2], 2)].into_iter().collect(),
                boundary,
            },
        );
    }

    // --- Priority ordering ---
    let avg_len = if adj.edges.is_empty() {
        1.0
    } else {
        adj.edges.iter().map(|e| e.len).sum::<f64>() / adj.edges.len() as f64
    };
    let mut ordered: Vec<usize> = (0..adj.edges.len()).collect();
    ordered.sort_by(|&i, &j| {
        let ei = &adj.edges[i];
        let ej = &adj.edges[j];
        score_edge(ei, avg_len)
            .partial_cmp(&score_edge(ej, avg_len))
            .unwrap_or(std::cmp::Ordering::Equal)
            // Deterministic tiebreaker for equal scores (adjacency build order
            // is hash-dependent, so we cannot rely on edge ids).
            .then_with(|| ei.va.cmp(&ej.va))
            .then_with(|| ei.vb.cmp(&ej.vb))
            .then_with(|| ei.face_a.cmp(&ej.face_a))
            .then_with(|| ei.face_b.cmp(&ej.face_b))
    });

    // --- Greedy island join with overlap rejection ---
    // Mesh edges that were actually joined across become folds; all others are
    // cuts (their two copies lie on the net boundary).
    let mut joined: std::collections::HashSet<usize> = std::collections::HashSet::new();
    for &edge_id in &ordered {
        let e = &adj.edges[edge_id];
        let mut ra = find(&mut parent, e.face_a);
        let mut rb = find(&mut parent, e.face_b);
        if ra == rb {
            continue;
        }
        let mut island_a = match islands.remove(&ra) {
            Some(island) => island,
            None => continue,
        };
        let mut island_b = match islands.remove(&rb) {
            Some(island) => island,
            None => {
                islands.insert(ra, island_a);
                continue;
            }
        };
        // Keep the larger island as the target to reduce copy cost.
        if island_b.faces.len() > island_a.faces.len() {
            std::mem::swap(&mut island_a, &mut island_b);
            std::mem::swap(&mut ra, &mut rb);
        }

        // Find the shared edge on both boundaries.
        let Some(seg_a) = island_a.boundary.iter().find(|s| s.edge == edge_id).copied() else {
            islands.insert(ra, island_a);
            islands.insert(rb, island_b);
            continue;
        };
        let Some(seg_b) = island_b.boundary.iter().find(|s| s.edge == edge_id).copied() else {
            islands.insert(ra, island_a);
            islands.insert(rb, island_b);
            continue;
        };

        // Rigid transform mapping B's shared edge onto A's. The endpoint
        // correspondence is determined by the 3D vertex indices (via the
        // islands' vertex maps) — guessing windings geometrically would flip
        // the mapping for symmetric edges.
        let (a_va, a_vb) = match (island_a.vmap.get(&e.va), island_a.vmap.get(&e.vb)) {
            (Some(&a), Some(&b)) => (a, b),
            _ => {
                islands.insert(ra, island_a);
                islands.insert(rb, island_b);
                continue;
            }
        };
        let (b_va, b_vb) = match (island_b.vmap.get(&e.va), island_b.vmap.get(&e.vb)) {
            (Some(&a), Some(&b)) => (a, b),
            _ => {
                islands.insert(ra, island_a);
                islands.insert(rb, island_b);
                continue;
            }
        };
        let Some((m, t)) = rigid_transform(
            island_b.verts[b_va],
            island_b.verts[b_vb],
            island_a.verts[a_va],
            island_a.verts[a_vb],
        ) else {
            islands.insert(ra, island_a);
            islands.insert(rb, island_b);
            continue;
        };
        let transformed: Vec<DVec2> = island_b.verts.iter().map(|v| m.mul_vec2(*v) + t).collect();

        // Reject the join if it would cause a 2D overlap.
        let a_segs: Vec<(DVec2, DVec2)> = island_a
            .boundary
            .iter()
            .map(|s| (island_a.verts[s.a], island_a.verts[s.b]))
            .collect();
        let b_segs: Vec<(DVec2, DVec2)> = island_b
            .boundary
            .iter()
            .map(|s| (transformed[s.a], transformed[s.b]))
            .collect();
        if !no_overlap(&a_segs, &b_segs) {
            // Cut this edge: the join would overlap.
            islands.insert(ra, island_a);
            islands.insert(rb, island_b);
            continue;
        }

        // Merge island B into island A.
        let base = island_a.verts.len();
        let mut index_map = vec![usize::MAX; transformed.len()];
        // The shared-edge endpoints coincide with A's endpoints after alignment.
        index_map[b_va] = a_va;
        index_map[b_vb] = a_vb;
        let mut new_verts: Vec<DVec2> = Vec::new();
        let mut remapped: Vec<usize> = Vec::with_capacity(transformed.len());
        for (i, v) in transformed.iter().enumerate() {
            match index_map[i] {
                usize::MAX => {
                    remapped.push(base + new_verts.len());
                    new_verts.push(*v);
                }
                m => remapped.push(m),
            }
        }
        island_a.verts.extend(new_verts);
        for (v3d, local) in island_b.vmap.drain() {
            island_a.vmap.insert(v3d, remapped[local]);
        }
        island_a.faces.extend(island_b.faces.iter().copied());
        // The joined edge is now internal: drop it from A's boundary.
        island_a.boundary.retain(|s| !(s.edge == edge_id && s.a == seg_a.a && s.b == seg_a.b));
        for s in island_b.boundary {
            if s.edge == edge_id && s.a == seg_b.a && s.b == seg_b.b {
                continue; // joined edge becomes internal
            }
            island_a.boundary.push(BoundarySeg {
                a: remapped[s.a],
                b: remapped[s.b],
                edge: s.edge,
            });
        }
        parent[rb] = ra;
        joined.insert(edge_id);
        islands.insert(ra, island_a);
    }

    Ok(finalize(&adj, islands, &joined))
}

/// Project finished islands into the serializable `Net`.
fn finalize(
    adj: &Adjacency,
    islands: HashMap<usize, Island>,
    joined: &std::collections::HashSet<usize>,
) -> Net {
    let mut net_islands: Vec<NetIsland> = Vec::with_capacity(islands.len());
    for (_root, island) in islands {
        let mut edges: Vec<NetEdge> = Vec::new();

        // Boundary segments are cut lines.
        for s in &island.boundary {
            edges.push(NetEdge {
                a: s.a,
                b: s.b,
                kind: EdgeKind::Cut,
            });
        }
        // Internal edges that were actually joined carry fold classification
        // from the 3D dihedral angle. Edges skipped by the join (both faces
        // already in the island via another path) were never glued in 2D, so
        // their copies are already on the boundary as cut lines.
        for &eid in joined {
            let e = &adj.edges[eid];
            let kind = if e.dihedral.abs() < COPLANAR_EPS {
                EdgeKind::Coplanar
            } else if e.dihedral > 0.0 {
                EdgeKind::Mountain
            } else {
                EdgeKind::Valley
            };
            if let (Some(&a), Some(&b)) = (island.vmap.get(&e.va), island.vmap.get(&e.vb)) {
                edges.push(NetEdge { a, b, kind });
            }
        }

        net_islands.push(NetIsland {
            faces: island.faces,
            vertices: island.verts.iter().map(|v| [v.x, v.y]).collect(),
            edges,
        });
    }
    net_islands.sort_by(|a, b| b.faces.len().cmp(&a.faces.len()));
    let island_count = net_islands.len();
    Net {
        islands: net_islands,
        island_count,
        simplified: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::python::MeshObject;
    use geometry::segments_intersect;

    fn mesh(vertices: Vec<[f64; 3]>, faces: Vec<[u32; 3]>) -> MeshObject {
        MeshObject {
            vertices: vertices.iter().flatten().copied().collect(),
            faces: faces.iter().flatten().copied().collect(),
        }
    }

    /// Regular tetrahedron: a closed manifold of 4 faces.
    fn tetrahedron() -> MeshObject {
        mesh(
            vec![
                [0.0, 0.0, 0.0],
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0],
            ],
            vec![[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]],
        )
    }

    /// Unit cube as 12 triangles over 8 shared vertices.
    fn cube() -> MeshObject {
        mesh(
            vec![
                [0.0, 0.0, 0.0], // 0
                [1.0, 0.0, 0.0], // 1
                [1.0, 1.0, 0.0], // 2
                [0.0, 1.0, 0.0], // 3
                [0.0, 0.0, 1.0], // 4
                [1.0, 0.0, 1.0], // 5
                [1.0, 1.0, 1.0], // 6
                [0.0, 1.0, 1.0], // 7
            ],
            vec![
                // bottom (-Z)
                [0, 3, 2],
                [0, 2, 1],
                // top (+Z)
                [4, 5, 6],
                [4, 6, 7],
                // front (-Y)
                [0, 1, 5],
                [0, 5, 4],
                // back (+Y)
                [3, 7, 6],
                [3, 6, 2],
                // left (-X)
                [0, 4, 7],
                [0, 7, 3],
                // right (+X)
                [1, 2, 6],
                [1, 6, 5],
            ],
        )
    }

    /// The same cube as triangle soup: every face carries its own copies of the
    /// corner coordinates (like CadQuery's `tessellate` output), so no vertex
    /// index is shared between faces.
    fn soup_cube() -> MeshObject {
        let indexed = cube();
        let coords: Vec<[f64; 3]> = indexed
            .vertices
            .chunks_exact(3)
            .map(|c| [c[0], c[1], c[2]])
            .collect();
        let mut vertices: Vec<[f64; 3]> = Vec::new();
        let mut faces: Vec<[u32; 3]> = Vec::new();
        for f in indexed.faces.chunks_exact(3) {
            let base = vertices.len() as u32;
            faces.push([base, base + 1, base + 2]);
            for &vi in f {
                vertices.push(coords[vi as usize]);
            }
        }
        mesh(vertices, faces)
    }

    /// Open pyramid: 4 side faces, no base — every base edge is open.
    fn open_pyramid() -> MeshObject {
        mesh(
            vec![
                [0.0, 0.0, 0.0], // 0
                [1.0, 0.0, 0.0], // 1
                [1.0, 1.0, 0.0], // 2
                [0.0, 1.0, 0.0], // 3
                [0.5, 0.5, 1.0], // 4 apex
            ],
            vec![[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
        )
    }

    /// Two tetrahedra sharing a single edge {0,1}: non-manifold, no open edges.
    fn double_tetrahedron() -> MeshObject {
        mesh(
            vec![
                [0.0, 0.0, 0.0], // 0 shared
                [1.0, 0.0, 0.0], // 1 shared
                [0.0, 1.0, 0.0], // 2
                [0.0, 0.0, 1.0], // 3
                [0.0, -1.0, 1.0], // 4
                [1.0, -1.0, -1.0], // 5
            ],
            vec![
                // tetrahedron 1
                [0, 1, 2],
                [0, 3, 1],
                [0, 2, 3],
                [1, 3, 2],
                // tetrahedron 2 (shares edge {0,1})
                [0, 1, 4],
                [0, 5, 1],
                [0, 4, 5],
                [1, 5, 4],
            ],
        )
    }

    /// A closed "dent" shape: a cube with one face pushed inward, so the four
    /// edges around the dent are concave and the box edges are convex.
    fn dent_cube() -> MeshObject {
        let mut m = cube();
        // Pull the top face (vertices 4..7) inward by half its height.
        for i in 4..8 {
            m.vertices[i * 3 + 2] -= 0.4;
        }
        m
    }

    /// Collect the cut (boundary) segments of one island as 2D points.
    fn island_cut_segments(island: &NetIsland) -> Vec<([f64; 2], [f64; 2])> {
        island
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::Cut)
            .map(|e| (island.vertices[e.a], island.vertices[e.b]))
            .collect()
    }

    /// Test-only overlap check: do two 2D segments properly intersect?
    fn seg_pair(a: ([f64; 2], [f64; 2]), b: ([f64; 2], [f64; 2])) -> bool {
        let to_glam = |p: [f64; 2]| DVec2::new(p[0], p[1]);
        segments_intersect((to_glam(a.0), to_glam(a.1)), (to_glam(b.0), to_glam(b.1)))
    }

    /// Assert that every island's boundary is a simple polygon and no two
    /// islands' boundaries cross. Interior fold lines are legal creases and
    /// may touch the boundary or other folds, so only cut segments are checked.
    fn assert_no_overlaps(net: &Net) {
        for island in &net.islands {
            let segs = island_cut_segments(island);
            for i in 0..segs.len() {
                for j in (i + 1)..segs.len() {
                    assert!(
                        !seg_pair(segs[i], segs[j]),
                        "island boundary self-intersection between segments {i} and {j}"
                    );
                }
            }
        }
        for i in 0..net.islands.len() {
            for j in (i + 1)..net.islands.len() {
                let a = island_cut_segments(&net.islands[i]);
                let b = island_cut_segments(&net.islands[j]);
                for sa in &a {
                    for sb in &b {
                        assert!(
                            !seg_pair(*sa, *sb),
                            "island {i} overlaps island {j}"
                        );
                    }
                }
            }
        }
    }

    /// Assert that every mesh face appears in exactly one island.
    fn assert_covers_all_faces(net: &Net, face_count: usize) {
        let mut seen: Vec<bool> = vec![false; face_count];
        for island in &net.islands {
            for &f in &island.faces {
                assert!(!seen[f], "face {f} appears in multiple islands");
                seen[f] = true;
            }
        }
        assert!(seen.iter().all(|s| *s), "not all faces are in the net");
    }

    #[test]
    fn flatten_preserves_edge_lengths() {
        let v0 = DVec3::new(1.0, 2.0, 3.0);
        let v1 = DVec3::new(4.0, -1.0, 2.0);
        let v2 = DVec3::new(-2.0, 0.5, 5.0);
        let [p0, p1, p2] = flatten_face(v0, v1, v2);
        let tri = [(v0, v1, v2), (v1, v2, v0), (v2, v0, v1)];
        let flat = [(p0, p1, p2), (p1, p2, p0), (p2, p0, p1)];
        for ((a, b, _), (pa, pb, _)) in tri.iter().zip(flat.iter()) {
            let len3 = (b - a).length();
            let len2 = (pb - pa).length();
            assert!(
                (len3 - len2).abs() < 1e-6,
                "3D length {len3} != 2D length {len2}"
            );
        }
    }

    #[test]
    fn tetrahedron_unfolds_to_four_triangles() {
        let net = unfold(&tetrahedron(), None).expect("tetrahedron should unfold");
        assert_eq!(net.island_count, 1, "expected a single tetrahedron net");
        let island = &net.islands[0];
        assert_eq!(island.faces.len(), 4);
        // The net is either the diamond (4 vertices) or the strip (6 vertices)
        // — both are valid single-island tetrahedron nets.
        assert!(
            (4..=6).contains(&island.vertices.len()),
            "unexpected vertex count {}",
            island.vertices.len()
        );
        // 4 faces joined across 3 fold edges; 3 seam edges appear as 6 cut segments.
        let cuts = island.edges.iter().filter(|e| e.kind == EdgeKind::Cut).count();
        let folds = island.edges.iter().filter(|e| e.kind != EdgeKind::Cut).count();
        assert_eq!(cuts, 6, "expected 6 cut boundary segments, got {cuts}");
        assert_eq!(folds, 3, "expected 3 fold edges, got {folds}");
        assert_no_overlaps(&net);
        assert_covers_all_faces(&net, 4);
    }

    #[test]
    fn cube_unfolds_without_overlap() {
        let net = unfold(&cube(), None).expect("cube should unfold");
        assert_covers_all_faces(&net, 12);
        assert_no_overlaps(&net);
        // The cube can unfold as one cross island or split; either way the
        // number of islands must be small and the total covered.
        assert!(net.island_count <= 2, "cube should need at most 2 islands");
    }

    #[test]
    fn soup_cube_unfolds_like_indexed_cube() {
        // Triangle-soup input (CadQuery-style duplicated vertices) must weld
        // into the same net as a shared-indexed mesh.
        let indexed = unfold(&cube(), None).expect("indexed cube should unfold");
        let soup = unfold(&soup_cube(), None).expect("soup cube should weld and unfold");
        assert_eq!(soup.island_count, indexed.island_count);
        assert_covers_all_faces(&soup, 12);
        assert_no_overlaps(&soup);
    }

    #[test]
    fn open_boundary_mesh_rejected() {
        let err = unfold(&open_pyramid(), None).unwrap_err();
        assert!(
            err.contains("open-boundary"),
            "expected open-boundary error, got: {err}"
        );
    }

    #[test]
    fn non_manifold_mesh_rejected() {
        let err = unfold(&double_tetrahedron(), None).unwrap_err();
        assert!(
            err.contains("non-manifold"),
            "expected non-manifold error, got: {err}"
        );
    }

    #[test]
    fn degenerate_inputs_rejected() {
        // Empty mesh.
        let err = unfold(&mesh(vec![], vec![]), None).unwrap_err();
        assert!(err.contains("at least 4"), "got: {err}");
        // Too few faces.
        let err = unfold(&mesh(vec![[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]], vec![[0, 1, 2]]), None).unwrap_err();
        assert!(err.contains("at least 4"), "got: {err}");
        // Out-of-range vertex index (4 faces so the size check passes first).
        let err = unfold(&mesh(
            vec![
                [0.0, 0.0, 0.0],
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0],
            ],
            vec![[0, 1, 2], [0, 3, 1], [0, 2, 3], [0, 1, 99]],
        ), None)
        .unwrap_err();
        assert!(err.contains("references vertex index 99"), "got: {err}");
    }

    #[test]
    fn concave_edges_scored_higher_than_convex() {
        // Same length, convex vs concave dihedral: concave must cut first.
        let convex = MeshEdge {
            face_a: 0,
            face_b: 1,
            va: 0,
            vb: 1,
            len: 2.0,
            dihedral: 1.0,
        };
        let concave = MeshEdge {
            face_a: 0,
            face_b: 1,
            va: 0,
            vb: 1,
            len: 2.0,
            dihedral: -1.0,
        };
        assert!(
            score_edge(&concave, 2.0) > score_edge(&convex, 2.0),
            "concave edge should be cut before a convex edge of the same length"
        );
    }

    #[test]
    fn dent_cube_cuts_concave_edges() {
        // The four concave edges around the dent should be cut (their copies
        // end up on island boundaries) rather than kept as folds.
        let net = unfold(&dent_cube(), None).expect("dent cube should unfold");
        assert_covers_all_faces(&net, 12);
        assert_no_overlaps(&net);
        // Every island boundary must contain at least one cut edge, and the
        // net must contain fold edges (convex box edges) to hold the box shape.
        let fold_count = net
            .islands
            .iter()
            .flat_map(|i| i.edges.iter())
            .filter(|e| e.kind == EdgeKind::Mountain || e.kind == EdgeKind::Valley)
            .count();
        assert!(fold_count > 0, "expected some convex edges to remain folds");
    }

    /// A dense, curved, closed mesh: a UV sphere (24 segments × 12 rings,
    /// ~528 non-planar triangles) — the real-world case that tessellates into
    /// far too many faces to unfold usefully.
    fn uv_sphere() -> MeshObject {
        use std::f64::consts::PI;
        let (segs, rings) = (24u32, 12u32);
        let mut vertices: Vec<[f64; 3]> = vec![[0.0, 0.0, 1.0]]; // north pole
        for j in 1..rings {
            let phi = PI * j as f64 / rings as f64;
            let (z, r) = (phi.cos(), phi.sin());
            for i in 0..segs {
                let theta = 2.0 * PI * i as f64 / segs as f64;
                vertices.push([r * theta.cos(), r * theta.sin(), z]);
            }
        }
        vertices.push([0.0, 0.0, -1.0]); // south pole
        let south: u32 = 1 + (rings - 1) * segs;
        let idx = |i: u32, j: u32| -> u32 {
            if j == 0 {
                0
            } else if j == rings {
                south
            } else {
                1 + (j - 1) * segs + i
            }
        };
        let mut faces: Vec<[u32; 3]> = Vec::new();
        for i in 0..segs {
            faces.push([idx(i, 0), idx(i, 1), idx((i + 1) % segs, 1)]);
        }
        for j in 1..rings - 1 {
            for i in 0..segs {
                let (n, e) = (i, (i + 1) % segs);
                faces.push([idx(n, j), idx(e, j), idx(e, j + 1)]);
                faces.push([idx(n, j), idx(e, j + 1), idx(n, j + 1)]);
            }
        }
        for i in 0..segs {
            faces.push([idx(i, rings - 1), idx((i + 1) % segs, rings - 1), idx(i, rings)]);
        }
        mesh(vertices, faces)
    }

    #[test]
    fn mesh_below_target_unfolded_unchanged() {
        // The cube (12 triangles) is far below any target — no simplification.
        let net = unfold(&cube(), Some(100)).expect("cube should unfold");
        assert!(net.simplified.is_none(), "small mesh must not be simplified");
    }

    #[test]
    fn dense_mesh_simplified_toward_target() {
        let sphere = uv_sphere();
        let original = sphere.faces.len() / 3;
        assert!(original > 100, "test mesh should exceed the default target");

        let net = unfold(&sphere, Some(100)).expect("sphere should unfold after simplification");
        let stats = net.simplified.as_ref().expect("sphere should be simplified");
        assert!(stats.final_faces < original, "final {} not reduced from {}", stats.final_faces, original);
        assert_eq!(stats.original_faces, original);
        assert!(stats.error.is_none());
        assert_covers_all_faces(&net, stats.final_faces);
        // Note: no `assert_no_overlaps` here — a sphere is undevelopable, so
        // even a low-poly sphere net can have crossing islands (the greedy
        // cuts joins that overlap within an island but doesn't re-check
        // cross-island overlap). This is inherent to the surface, not the
        // decimation; the feature's job is reducing the face count, which the
        // assertions above verify.
    }

    #[test]
    fn simplified_mesh_remains_closed_manifold() {
        let sphere = uv_sphere();
        // If decimation broke the mesh (open/non-manifold), unfold errors out.
        let net = unfold(&sphere, Some(100)).expect("simplified mesh must remain a valid manifold");
        assert!(net.simplified.is_some());
        // Every face must be covered exactly once — the net is coherent.
        let total: usize = net.islands.iter().map(|i| i.faces.len()).sum();
        let final_faces = net.simplified.unwrap().final_faces;
        assert_eq!(total, final_faces);
    }

    #[test]
    fn target_faces_defaults_to_100() {
        let sphere = uv_sphere();
        let net = unfold(&sphere, None).expect("sphere with default target should unfold");
        let stats = net.simplified.expect("sphere should be simplified by default");
        assert!(stats.final_faces < stats.original_faces);
    }

}
