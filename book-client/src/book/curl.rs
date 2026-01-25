//! Page curl animation
//!
//! Implements page curling deformation. For the MVP spike, this uses CPU-based
//! vertex manipulation. A proper implementation would use a vertex shader.

use bevy::prelude::*;
use bevy::render::mesh::VertexAttributeValues;
use std::f32::consts::PI;

/// Parameters for page curl deformation
#[derive(Clone, Copy, Debug)]
pub struct CurlParams {
    /// Curl amount (0.0 = flat, 1.0 = fully turned)
    pub amount: f32,
    /// Curl radius (smaller = tighter curl)
    pub radius: f32,
    /// Page width for normalization
    pub page_width: f32,
    /// Page height for normalization
    pub page_height: f32,
    /// Lift amount (how high the page rises during turn)
    pub lift: f32,
    /// Flutter intensity (paper ripple effect)
    pub flutter: f32,
    /// Time for flutter animation
    pub time: f32,
}

impl Default for CurlParams {
    fn default() -> Self {
        Self {
            amount: 0.0,
            radius: 0.2,
            page_width: 2.0,
            page_height: 3.0,
            lift: 0.0,
            flutter: 0.0,
            time: 0.0,
        }
    }
}

/// Component storing original vertex positions for a page
/// (needed for CPU-based deformation so we don't accumulate errors)
#[derive(Component)]
pub struct OriginalMeshData {
    pub positions: Vec<[f32; 3]>,
    pub normals: Vec<[f32; 3]>,
}

/// Apply curl deformation to a vertex position.
///
/// Creates a realistic page turn with:
/// - Cylindrical curl around the fold line
/// - Page lift during the turn (arc motion)
/// - Paper flutter/ripple effect
///
/// # Arguments
/// * `position` - Original vertex position [x, y, z]
/// * `params` - Curl parameters including lift and flutter
///
/// # Returns
/// Deformed vertex position
pub fn curl_vertex(position: [f32; 3], params: &CurlParams) -> [f32; 3] {
    let [x, y, z] = position;
    let amount = params.amount;

    // Very small amounts - return flat
    if amount <= 0.001 && params.lift <= 0.001 {
        return position;
    }

    let half_width = params.page_width / 2.0;
    let half_height = params.page_height / 2.0;

    // Normalize coordinates to 0..1 range
    let norm_x = (x + half_width) / params.page_width;   // 0 = left, 1 = right
    let norm_y = (y + half_height) / params.page_height; // 0 = bottom, 1 = top

    // The fold line moves from right (1.0) to left (0.0) as amount increases
    let fold_pos = 1.0 - amount;

    // Calculate base position (before curl)
    let mut new_x = x;
    let mut new_y = y;
    let mut new_z = z;

    // Apply page lift - affects the entire page, peaks at center
    // Creates an arc motion like a real page being lifted
    if params.lift > 0.0 {
        // Lift is stronger toward the turning edge
        let lift_factor = norm_x.max(0.0);
        // Also consider vertical position - corners lift more
        let corner_boost = 1.0 + (norm_y - 0.5).abs() * 0.3;
        new_z += params.lift * lift_factor * corner_boost;
    }

    // Apply curl transformation for the turned portion
    if norm_x > fold_pos {
        // How far past the fold line (0 to 1)
        let past_fold = (norm_x - fold_pos) / (1.0 - fold_pos).max(0.001);

        // Curl angle: 0 at fold line, PI at fully turned
        let theta = past_fold * PI;
        let r = params.radius;

        // Fold line position in world space
        let fold_x = fold_pos * params.page_width - half_width;

        // Cylindrical wrap around the fold line
        // Page curls to the left (negative X direction)
        new_x = fold_x - r * theta.sin();

        // Z follows the cylinder surface
        // Starts at current z, arcs up, comes back down on the other side
        new_z = z + r * (1.0 - theta.cos());

        // Add lift to the curled portion too
        if params.lift > 0.0 {
            new_z += params.lift * (1.0 - past_fold * 0.5);
        }
    }

    // Apply flutter/ripple effect - simulates paper flexibility
    if params.flutter > 0.0 {
        // Wave pattern that travels across the page
        let wave_freq = 3.0;
        let wave_speed = 8.0;
        let wave_phase = norm_x * wave_freq + params.time * wave_speed;

        // Flutter is stronger on the turning portion and edges
        let flutter_strength = if norm_x > fold_pos {
            let past_fold = (norm_x - fold_pos) / (1.0 - fold_pos).max(0.001);
            past_fold * (1.0 - past_fold) * 4.0  // Peak in middle of turned section
        } else {
            0.0
        };

        // Vertical wave component
        let vert_wave = (norm_y * PI * 2.0 + params.time * 5.0).sin();

        // Combined flutter
        let flutter_amount = wave_phase.sin() * 0.03 * params.flutter * flutter_strength;
        let vert_flutter = vert_wave * 0.01 * params.flutter * flutter_strength;

        new_z += flutter_amount;
        new_y += vert_flutter;
    }

    [new_x, new_y, new_z]
}

/// Calculate the normal for a curled vertex
pub fn curl_normal(position: [f32; 3], params: &CurlParams) -> [f32; 3] {
    let [x, _y, _z] = position;
    let amount = params.amount;

    if amount <= 0.001 && params.lift <= 0.001 {
        return [0.0, 0.0, 1.0];  // Flat page faces +Z
    }

    let half_width = params.page_width / 2.0;
    let norm_x = (x + half_width) / params.page_width;
    let fold_pos = 1.0 - amount;

    if norm_x <= fold_pos {
        // Flat part - but may be lifted
        if params.lift > 0.0 {
            // Slight tilt due to lift gradient
            let tilt = params.lift * 0.3;
            let len = (tilt * tilt + 1.0).sqrt();
            return [tilt / len, 0.0, 1.0 / len];
        }
        return [0.0, 0.0, 1.0];
    }

    let past_fold = (norm_x - fold_pos) / (1.0 - fold_pos).max(0.001);
    let theta = past_fold * PI;

    // Normal rotates as page curls around cylinder
    let nx = theta.sin();
    let nz = theta.cos();

    // Normalize
    let len = (nx * nx + nz * nz).sqrt();
    [nx / len, 0.0, nz / len]
}

/// System to apply curl deformation to page meshes (CPU-based for spike)
///
/// Note: This modifies mesh vertices on CPU every frame. For production,
/// this should be a vertex shader for better performance.
///
/// Only applies to CurrentPage - NextPage stays flat underneath.
pub fn apply_curl_to_mesh(
    curl_state: Res<super::PageCurlState>,
    mut meshes: ResMut<Assets<Mesh>>,
    query: Query<(&Mesh3d, &OriginalMeshData), (With<super::Page>, With<super::CurrentPage>)>,
    config: Option<Res<crate::BookConfig>>,
    time: Res<Time>,
) {
    let page_width = config.as_ref().map(|c| c.page_width).unwrap_or(2.0);
    let page_height = config.as_ref().map(|c| c.page_height).unwrap_or(3.0);

    let params = CurlParams {
        amount: curl_state.curl_amount,
        radius: 0.15,  // Tight curl radius for book-like feel
        page_width,
        page_height,
        lift: curl_state.lift,
        flutter: curl_state.flutter,
        time: time.elapsed_secs(),
    };

    for (mesh_handle, original) in query.iter() {
        if let Some(mesh) = meshes.get_mut(&mesh_handle.0) {
            // Apply curl to all vertices
            let curled_positions: Vec<[f32; 3]> = original
                .positions
                .iter()
                .map(|&pos| curl_vertex(pos, &params))
                .collect();

            let curled_normals: Vec<[f32; 3]> = original
                .positions
                .iter()
                .map(|&pos| curl_normal(pos, &params))
                .collect();

            // Update mesh attributes
            mesh.insert_attribute(
                Mesh::ATTRIBUTE_POSITION,
                curled_positions,
            );
            mesh.insert_attribute(
                Mesh::ATTRIBUTE_NORMAL,
                curled_normals,
            );
        }
    }
}

/// System to store original mesh data when a page is spawned
pub fn store_original_mesh_data(
    mut commands: Commands,
    meshes: Res<Assets<Mesh>>,
    query: Query<(Entity, &Mesh3d), (With<super::Page>, Without<OriginalMeshData>)>,
) {
    for (entity, mesh_handle) in query.iter() {
        if let Some(mesh) = meshes.get(&mesh_handle.0) {
            // Extract positions
            let positions = if let Some(VertexAttributeValues::Float32x3(positions)) =
                mesh.attribute(Mesh::ATTRIBUTE_POSITION)
            {
                positions.clone()
            } else {
                continue;
            };

            // Extract normals
            let normals = if let Some(VertexAttributeValues::Float32x3(normals)) =
                mesh.attribute(Mesh::ATTRIBUTE_NORMAL)
            {
                normals.clone()
            } else {
                continue;
            };

            let vertex_count = positions.len();
            commands.entity(entity).insert(OriginalMeshData {
                positions,
                normals,
            });

            info!("Stored original mesh data for page: {} vertices", vertex_count);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_params() -> CurlParams {
        CurlParams {
            amount: 0.0,
            radius: 0.2,
            page_width: 2.0,
            page_height: 3.0,
            lift: 0.0,
            flutter: 0.0,
            time: 0.0,
        }
    }

    #[test]
    fn test_no_curl() {
        let params = default_params();
        let pos = [0.5, 0.0, 0.0];
        let result = curl_vertex(pos, &params);
        assert_eq!(result, pos, "Zero curl should return original position");
    }

    #[test]
    fn test_partial_curl() {
        let mut params = default_params();
        params.amount = 0.5;

        // Right edge should start curling
        let pos = [0.8, 0.0, 0.0];
        let result = curl_vertex(pos, &params);

        // Z should be positive (lifted up by curl)
        assert!(result[2] > 0.0, "Page should lift toward viewer, got z={}", result[2]);
    }

    #[test]
    fn test_full_curl() {
        let mut params = default_params();
        params.amount = 1.0;

        // Right edge at full curl should be on the left side
        let pos = [0.9, 0.0, 0.0];
        let result = curl_vertex(pos, &params);

        // X should have moved left
        assert!(result[0] < pos[0], "Page should curl leftward");
    }

    #[test]
    fn test_left_edge_stays_flat() {
        let mut params = default_params();
        params.amount = 0.5;

        // Left edge should stay flat during partial curl
        let pos = [-0.9, 0.0, 0.0];
        let result = curl_vertex(pos, &params);

        // X should be nearly unchanged
        assert!((result[0] - pos[0]).abs() < 0.1, "Left edge X should stay in place");
    }

    #[test]
    fn test_lift_affects_page() {
        let mut params = default_params();
        params.lift = 0.5;

        // Right side should lift more than left
        let right_pos = [0.8, 0.0, 0.0];
        let left_pos = [-0.8, 0.0, 0.0];

        let right_result = curl_vertex(right_pos, &params);
        let left_result = curl_vertex(left_pos, &params);

        assert!(right_result[2] > left_result[2], "Right side should lift more");
    }
}
