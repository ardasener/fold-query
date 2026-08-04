use glam::DVec3;

/// Default target triangle count for mesh decimation.
pub const TARGET_FACES_DEFAULT: u32 = 100;

/// Simplify a triangulated mesh toward `target_faces` triangles using
/// quadric-error-metric decimation (MeshOptimizer).
///
/// The input is triangle soup: flat `vertices` (x,y,z triplets) and flat
/// `faces` (index triplets). The returned index buffer references the ORIGINAL
/// f64 vertex positions (MeshOptimizer works on the original vertex array), so
/// no coordinate precision is lost.
///
/// Returns the reduced faces and the final triangle count. On failure (empty
/// output) returns `Err`, which callers treat as "fall back to the original".
pub fn simplify_mesh(
    vertices: &[f64],
    faces: &[u32],
    target_faces: u32,
) -> Result<(Vec<u32>, usize), String> {
    if faces.is_empty() || target_faces == 0 {
        return Err("no faces to simplify".to_string());
    }
    if faces.len() % 3 != 0 {
        return Err("face array is not triangulated".to_string());
    }

    let positions: Vec<[f32; 3]> = vertices
        .chunks_exact(3)
        .map(|c| [c[0] as f32, c[1] as f32, c[2] as f32])
        .collect();
    if positions.len() > u32::MAX as usize {
        return Err("mesh too large to simplify".to_string());
    }

    // Target index count; error limit disabled so the target is actually
    // reached (the user picked the count deliberately).
    let target_indices = (target_faces as usize * 3).max(3);

    let mut result_error = 0.0f32;
    let mut indices = meshopt::simplify_decoder(
        faces,
        &positions,
        target_indices,
        f32::MAX, // relative-error cap disabled
        meshopt::SimplifyOptions::None,
        Some(&mut result_error),
    );
    if indices.len() < 3 {
        return Err("simplification produced an empty mesh".to_string());
    }

    // Drop degenerate triangles (zero-area) that decimation can leave behind;
    // they would fail the unfold's face-area validation.
    let mut cleaned: Vec<u32> = Vec::with_capacity(indices.len());
    let mut kept = 0usize;
    for tri in indices.chunks_exact_mut(3) {
        let (a, b, c) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
        let va = vertex_at(vertices, a);
        let vb = vertex_at(vertices, b);
        let vc = vertex_at(vertices, c);
        if (vb - va).cross(vc - va).length() > 1e-12 {
            cleaned.extend_from_slice(tri);
            kept += 1;
        }
    }
    if kept == 0 {
        return Err("simplification produced only degenerate triangles".to_string());
    }
    indices = cleaned;

    let _ = result_error;
    Ok((indices, kept))
}

fn vertex_at(vertices: &[f64], index: usize) -> DVec3 {
    let o = index * 3;
    DVec3::new(vertices[o], vertices[o + 1], vertices[o + 2])
}
