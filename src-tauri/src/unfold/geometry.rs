use std::collections::HashMap;

use glam::{DMat2, DVec2, DVec3};

/// Flatten a 3D triangle into its local 2D plane (DESIGN.md, Phase 4).
///
/// The mapping is isometric: edge lengths and interior angles are preserved.
/// Vertices are returned in counterclockwise order in the face plane.
pub fn flatten_face(v0: DVec3, v1: DVec3, v2: DVec3) -> [DVec2; 3] {
    let e1 = v1 - v0;
    let e2 = v2 - v0;
    let normal = e1.cross(e2).normalize();
    let u = e1.normalize();
    let v = normal.cross(u);
    let p = |p: DVec3| DVec2::new((p - v0).dot(u), (p - v0).dot(v));
    [p(v0), p(v1), p(v2)]
}

/// The 2×2 rotation matrix mapping vector `b` onto vector `a`.
///
/// Requires `|a| == |b|` (guaranteed here: both are the same 3D edge flattened
/// isometrically, so the 2D lengths match). Returns a pure rotation.
pub fn fitting_matrix(a: DVec2, b: DVec2) -> DMat2 {
    let inv = 1.0 / a.length_squared();
    let dot = a.dot(b);
    let cross = a.perp_dot(b);
    DMat2::from_cols(DVec2::new(dot, -cross) * inv, DVec2::new(cross, dot) * inv)
}

/// Compute the rigid transform mapping a source segment `(src0, src1)` onto a
/// target segment `(dst0, dst1)` with the given endpoint correspondence
/// (src0 → dst0, src1 → dst1).
///
/// Returns `None` when the segments do not have equal lengths (should not
/// happen: both are the same 3D edge flattened isometrically).
pub fn rigid_transform(
    src0: DVec2,
    src1: DVec2,
    dst0: DVec2,
    dst1: DVec2,
) -> Option<(DMat2, DVec2)> {
    let m = fitting_matrix(dst1 - dst0, src1 - src0);
    let t = dst0 - m.mul_vec2(src0);
    if (m.mul_vec2(src1) + t).distance(dst1) < 1e-6 {
        Some((m, t))
    } else {
        None
    }
}

fn cross(u: DVec2, v: DVec2) -> f64 {
    u.x * v.y - u.y * v.x
}

fn seg_sign(x: f64) -> i32 {
    if x > 1e-12 {
        1
    } else if x < -1e-12 {
        -1
    } else {
        0
    }
}

fn endpoint_match(p: DVec2, q: DVec2) -> bool {
    p.distance(q) < 1e-9
}

/// Distance from point `p` to segment `(a, b)`.
fn point_on_segment(p: DVec2, a: DVec2, b: DVec2) -> bool {
    let ab = b - a;
    let ap = p - a;
    let len2 = ab.length_squared();
    if len2 <= 1e-24 {
        return ap.length() < 1e-9;
    }
    let t = (ap.dot(ab) / len2).clamp(0.0, 1.0);
    (ap - ab * t).length() < 1e-9
}

/// Proper segment-segment intersection: segments that merely touch at an
/// endpoint (shared vertices in the net) do not count as intersecting.
fn seg_intersects(s1: (DVec2, DVec2), s2: (DVec2, DVec2)) -> bool {
    let (p0, p1) = s1;
    let (q0, q1) = s2;
    // Shared endpoints are glued vertices, not overlaps.
    if endpoint_match(p0, q0)
        || endpoint_match(p0, q1)
        || endpoint_match(p1, q0)
        || endpoint_match(p1, q1)
    {
        return false;
    }
    let d1 = p1 - p0;
    let d2 = q1 - q0;
    let o1 = cross(d1, q0 - p0);
    let o2 = cross(d1, q1 - p0);
    let o3 = cross(d2, p0 - q0);
    let o4 = cross(d2, p1 - q0);
    seg_sign(o1) != seg_sign(o2) && seg_sign(o3) != seg_sign(o4)
}

/// Even-odd point-in-polygon test over an unordered set of boundary edges.
/// Points on the boundary are NOT considered inside (coincident vertices are
/// glued in the net, not overlaps).
fn point_in_polygon(p: DVec2, edges: &[(DVec2, DVec2)]) -> bool {
    for (a, b) in edges {
        if point_on_segment(p, *a, *b) {
            return false;
        }
    }
    let mut inside = false;
    for (a, b) in edges {
        if (a.y > p.y) != (b.y > p.y) {
            let x_cross = (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x;
            if p.x < x_cross {
                inside = !inside;
            }
        }
    }
    inside
}

fn bbox(segs: &[(DVec2, DVec2)]) -> (DVec2, DVec2) {
    let mut min = DVec2::new(f64::INFINITY, f64::INFINITY);
    let mut max = DVec2::new(f64::NEG_INFINITY, f64::NEG_INFINITY);
    for (a, b) in segs {
        min = min.min(*a).min(*b);
        max = max.max(*a).max(*b);
    }
    (min, max)
}

/// Whether the two boundary segment sets overlap in 2D (DESIGN.md, Phase 5):
/// bounding-box reject, grid-hash pre-filter with segment intersection, and a
/// containment test for one island fully inside the other.
pub fn no_overlap(a_segs: &[(DVec2, DVec2)], b_segs: &[(DVec2, DVec2)]) -> bool {
    // Bounding-box reject.
    let (a_min, a_max) = bbox(a_segs);
    let (b_min, b_max) = bbox(b_segs);
    if a_max.x < b_min.x || b_max.x < a_min.x || a_max.y < b_min.y || b_max.y < a_min.y {
        return true;
    }

    // Grid-hash pre-filter over both segment sets.
    let diag = (a_max - a_min).length().max((b_max - b_min).length());
    let cell = (diag / 8.0).max(1e-6);
    let mut grid: HashMap<(i64, i64), Vec<(bool, usize)>> = HashMap::new();
    let register = |grid: &mut HashMap<(i64, i64), Vec<(bool, usize)>>,
                    segs: &[(DVec2, DVec2)],
                    from_a: bool| {
        for (i, (p0, p1)) in segs.iter().enumerate() {
            let lo = p0.min(*p1);
            let hi = p0.max(*p1);
            let c0 = ((lo.x / cell).floor() as i64, (lo.y / cell).floor() as i64);
            let c1 = ((hi.x / cell).floor() as i64, (hi.y / cell).floor() as i64);
            for cx in c0.0..=c1.0 {
                for cy in c0.1..=c1.1 {
                    grid.entry((cx, cy)).or_default().push((from_a, i));
                }
            }
        }
    };
    register(&mut grid, a_segs, true);
    register(&mut grid, b_segs, false);
    for entries in grid.values() {
        for i in 0..entries.len() {
            for j in (i + 1)..entries.len() {
                let (from_a, ia) = entries[i];
                let (from_b, ib) = entries[j];
                if from_a == from_b {
                    continue;
                }
                if seg_intersects(a_segs[ia], b_segs[ib]) {
                    return false;
                }
            }
        }
    }

    // Containment: any vertex of one island inside the other.
    for &v in a_segs.iter().flat_map(|(p0, p1)| [p0, p1]) {
        if point_in_polygon(v, b_segs) {
            return false;
        }
    }
    for &v in b_segs.iter().flat_map(|(p0, p1)| [p0, p1]) {
        if point_in_polygon(v, a_segs) {
            return false;
        }
    }
    true
}

/// Exposed for tests.
#[cfg(test)]
pub fn segments_intersect(s1: (DVec2, DVec2), s2: (DVec2, DVec2)) -> bool {
    seg_intersects(s1, s2)
}
