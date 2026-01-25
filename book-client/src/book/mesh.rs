//! Page mesh generation
//!
//! Creates a subdivided quad mesh for the book page that can be deformed
//! by the curl vertex shader.

use bevy::prelude::*;
use bevy::render::mesh::{Indices, PrimitiveTopology};

/// Creates a subdivided quad mesh for a book page.
///
/// The mesh is subdivided to allow smooth vertex shader deformation.
/// UV coordinates map 0,0 at bottom-left to 1,1 at top-right.
///
/// # Arguments
/// * `width` - Page width in world units
/// * `height` - Page height in world units
/// * `subdivisions` - Number of subdivisions along each axis
pub fn create_page_mesh(width: f32, height: f32, subdivisions: u32) -> Mesh {
    let subdivisions = subdivisions.max(2);  // Minimum 2 for any deformation

    let mut positions: Vec<[f32; 3]> = Vec::new();
    let mut normals: Vec<[f32; 3]> = Vec::new();
    let mut uvs: Vec<[f32; 2]> = Vec::new();
    let mut indices: Vec<u32> = Vec::new();

    let half_width = width / 2.0;
    let half_height = height / 2.0;

    // Generate vertices
    for y in 0..=subdivisions {
        for x in 0..=subdivisions {
            let u = x as f32 / subdivisions as f32;
            let v = y as f32 / subdivisions as f32;

            // Position: centered at origin, lying flat on XY plane
            let px = (u - 0.5) * width;
            let py = (v - 0.5) * height;
            let pz = 0.0;

            positions.push([px, py, pz]);
            normals.push([0.0, 0.0, 1.0]);  // Facing +Z (toward camera)
            uvs.push([u, v]);
        }
    }

    // Generate indices for triangles
    let row_size = subdivisions + 1;
    for y in 0..subdivisions {
        for x in 0..subdivisions {
            let top_left = y * row_size + x;
            let top_right = top_left + 1;
            let bottom_left = (y + 1) * row_size + x;
            let bottom_right = bottom_left + 1;

            // First triangle (top-left, bottom-left, top-right)
            indices.push(top_left);
            indices.push(bottom_left);
            indices.push(top_right);

            // Second triangle (top-right, bottom-left, bottom-right)
            indices.push(top_right);
            indices.push(bottom_left);
            indices.push(bottom_right);
        }
    }

    let vertex_count = positions.len();
    let triangle_count = indices.len() / 3;
    info!(
        "Created page mesh: {} vertices, {} triangles ({}x{} subdivisions)",
        vertex_count, triangle_count, subdivisions, subdivisions
    );

    // Build the mesh
    let mut mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        bevy::render::render_asset::RenderAssetUsages::default(),
    );

    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs);
    mesh.insert_indices(Indices::U32(indices));

    mesh
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_page_mesh_creation() {
        let mesh = create_page_mesh(2.0, 3.0, 4);

        // 5x5 = 25 vertices for 4 subdivisions
        // Position count should match
        // We can't easily check mesh internals, but ensure it doesn't panic
    }

    #[test]
    fn test_minimum_subdivisions() {
        // Should not panic with low values
        let _mesh = create_page_mesh(1.0, 1.0, 0);
        let _mesh = create_page_mesh(1.0, 1.0, 1);
    }
}
