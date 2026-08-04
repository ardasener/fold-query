use std::collections::HashMap;

use glam::DVec3;

use super::UnfoldError;

/// A directed half-edge: belongs to `face`. Identity is derived from its
/// position within the per-edge batch.
#[derive(Clone, Copy)]
struct HalfEdge {
    face: usize,
}

/// An undirected mesh edge with its two incident faces and the dihedral angle
/// between them. `va`/`vb` are the 3D edge endpoints (as first seen).
#[derive(Clone, Copy, Debug)]
pub struct MeshEdge {
    pub face_a: usize,
    pub face_b: usize,
    pub va: u32,
    pub vb: u32,
    pub len: f64,
    /// Signed dihedral angle in radians: positive = convex, negative = concave.
    pub dihedral: f64,
}

/// The half-edge adjacency built from a triangulated mesh.
pub struct Adjacency {
    pub edges: Vec<MeshEdge>,
    /// For each face, the mesh edge index of each directed edge
    /// (v0→v1, v1→v2, v2→v0).
    pub face_edges: Vec<[usize; 3]>,
}

fn face_normal(vertices: &[DVec3], f: [u32; 3]) -> DVec3 {
    (vertices[f[1] as usize] - vertices[f[0] as usize])
        .cross(vertices[f[2] as usize] - vertices[f[0] as usize])
        .normalize_or_zero()
}

/// Build the half-edge adjacency of the mesh (DESIGN.md, Phase 1).
///
/// Validates topology: any edge shared by fewer than two faces (open
/// boundary) or more than two faces (non-manifold) is an error.
pub fn build(vertices: &[DVec3], faces: &[[u32; 3]]) -> Result<Adjacency, UnfoldError> {
    let mut half_edges: Vec<HalfEdge> = Vec::with_capacity(faces.len() * 3);
    let mut key_to_he: HashMap<(u32, u32), Vec<usize>> = HashMap::new();
    let mut face_half: Vec<[usize; 3]> = Vec::with_capacity(faces.len());

    for (fi, f) in faces.iter().enumerate() {
        let mut hes = [0usize; 3];
        for k in 0..3 {
            let a = f[k];
            let b = f[(k + 1) % 3];
            let id = half_edges.len();
            half_edges.push(HalfEdge { face: fi });
            key_to_he
                .entry((a.min(b), a.max(b)))
                .or_default()
                .push(id);
            hes[k] = id;
        }
        face_half.push(hes);
    }

    let mut edges: Vec<MeshEdge> = Vec::new();
    let mut face_edges: Vec<[usize; 3]> = vec![[usize::MAX; 3]; faces.len()];

    let mut boundary_count = 0usize;
    let mut boundary_samples: Vec<(u32, u32)> = Vec::new();
    let mut nonmanifold_count = 0usize;
    let mut nonmanifold_samples: Vec<(u32, u32)> = Vec::new();

    for ((va, vb), batch) in key_to_he {
        match batch.len() {
            1 => {
                boundary_count += 1;
                if boundary_samples.len() < 5 {
                    boundary_samples.push((va, vb));
                }
            }
            2 => {
                let ha = half_edges[batch[0]];
                let hb = half_edges[batch[1]];
                let (fa, fb) = (ha.face, hb.face);
                let edge_id = edges.len();
                let raw = vertices[vb as usize] - vertices[va as usize];
                let dir = raw.normalize_or_zero();
                let s = (face_normal(vertices, faces[fa])
                    .cross(face_normal(vertices, faces[fb])))
                .dot(dir)
                .clamp(-1.0, 1.0);
                let dihedral = s.asin();
                edges.push(MeshEdge {
                    face_a: fa,
                    face_b: fb,
                    va,
                    vb,
                    len: raw.length(),
                    dihedral,
                });
                for k in 0..3 {
                    if face_half[fa][k] == batch[0] {
                        face_edges[fa][k] = edge_id;
                    }
                    if face_half[fb][k] == batch[1] {
                        face_edges[fb][k] = edge_id;
                    }
                }
            }
            _ => {
                nonmanifold_count += 1;
                if nonmanifold_samples.len() < 5 {
                    nonmanifold_samples.push((va, vb));
                }
            }
        }
    }

    if boundary_count > 0 {
        return Err(UnfoldError::OpenBoundary {
            count: boundary_count,
            samples: boundary_samples,
        });
    }
    if nonmanifold_count > 0 {
        return Err(UnfoldError::NonManifold {
            count: nonmanifold_count,
            samples: nonmanifold_samples,
        });
    }
    for (fi, fes) in face_edges.iter().enumerate() {
        for k in 0..3 {
            if fes[k] == usize::MAX {
                return Err(UnfoldError::DegenerateFace(fi));
            }
        }
    }

    Ok(Adjacency { edges, face_edges })
}
