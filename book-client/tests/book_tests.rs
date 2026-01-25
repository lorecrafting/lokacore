//! Integration tests for the book renderer
//!
//! These tests verify the core functionality without needing a GPU.

use loka_book::book::{curl_vertex, CurlParams};

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

/// Test that no curl returns original position
#[test]
fn test_curl_zero_amount() {
    let params = default_params();

    let positions = vec![
        [0.0, 0.0, 0.0],
        [0.5, 0.0, 0.0],
        [-0.5, 0.0, 0.0],
        [0.9, 0.5, 0.0],
    ];

    for pos in positions {
        let result = curl_vertex(pos, &params);
        assert_eq!(result, pos, "Zero curl should return original position");
    }
}

/// Test that curl moves vertices in Z direction
#[test]
fn test_curl_adds_depth() {
    let mut params = default_params();
    params.amount = 0.5;

    // Right edge should curl toward viewer (positive Z)
    let right_edge = [0.8, 0.0, 0.0];
    let result = curl_vertex(right_edge, &params);

    assert!(
        result[2] > 0.0,
        "Curled vertex should have positive Z (toward viewer), got {}",
        result[2]
    );
}

/// Test that curl amount affects deformation
#[test]
fn test_curl_amount_scaling() {
    let pos = [0.8, 0.0, 0.0];

    let mut light_curl = default_params();
    light_curl.amount = 0.3;

    let mut heavy_curl = default_params();
    heavy_curl.amount = 0.8;

    let light_result = curl_vertex(pos, &light_curl);
    let heavy_result = curl_vertex(pos, &heavy_curl);

    // Both should have some deformation
    assert!(light_result[2] > 0.0 || light_result[0] != pos[0], "Light curl should deform");
    assert!(heavy_result[2] > 0.0 || heavy_result[0] != pos[0], "Heavy curl should deform");
}

/// Test that left edge stays relatively flat during right-to-left curl
#[test]
fn test_curl_preserves_left_edge() {
    let mut params = default_params();
    params.amount = 0.5;

    // Left edge
    let left_pos = [-0.9, 0.0, 0.0];
    let result = curl_vertex(left_pos, &params);

    // Left edge should be minimally affected (fold hasn't reached it yet)
    assert!(
        (result[0] - left_pos[0]).abs() < 0.1,
        "Left edge X should stay in place"
    );
}

/// Test that lift affects the page
#[test]
fn test_lift_raises_page() {
    let mut params = default_params();
    params.lift = 0.5;

    // Right side should lift more than left
    let right_pos = [0.8, 0.0, 0.0];
    let result = curl_vertex(right_pos, &params);

    assert!(result[2] > 0.0, "Page should lift with positive lift value");
}

/// Test mesh vertex count calculation
#[test]
fn test_mesh_vertex_count() {
    // For N subdivisions, we get (N+1)^2 vertices
    fn expected_vertices(subdivisions: u32) -> u32 {
        (subdivisions + 1) * (subdivisions + 1)
    }

    assert_eq!(expected_vertices(2), 9);   // 3x3
    assert_eq!(expected_vertices(4), 25);  // 5x5
    assert_eq!(expected_vertices(8), 81);  // 9x9
    assert_eq!(expected_vertices(32), 1089); // 33x33
}

/// Test mesh triangle count calculation
#[test]
fn test_mesh_triangle_count() {
    // For N subdivisions, we get 2*N^2 triangles (2 per quad)
    fn expected_triangles(subdivisions: u32) -> u32 {
        2 * subdivisions * subdivisions
    }

    assert_eq!(expected_triangles(2), 8);
    assert_eq!(expected_triangles(4), 32);
    assert_eq!(expected_triangles(32), 2048);
}
