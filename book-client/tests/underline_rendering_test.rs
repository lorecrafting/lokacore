// Test for underlined link rendering
use loka_book::text::{LinkRegion, SdfTextRenderer};
use bevy::math::Rect;

#[test]
fn test_underline_rendering() {
    // Create renderer
    let renderer = SdfTextRenderer::default();

    // Create test link regions
    let links = vec![
        LinkRegion {
            text: "Test Link".to_string(),
            action_id: "test:action".to_string(),
            bounds: Rect::new(0.1, 0.4, 0.3, 0.45),
        },
    ];

    // Render with links
    let content = "This is test content with links.";
    let image = renderer.render_to_image_with_links(content, &links);

    // Verify image dimensions
    assert_eq!(image.width(), renderer.width);
    assert_eq!(image.height(), renderer.height);

    // Verify image has data
    assert!(!image.data.is_empty());

    println!("✅ Underline rendering test passed");
}

#[test]
fn test_render_without_links() {
    let renderer = SdfTextRenderer::default();

    // Render without links (backward compatibility)
    let content = "No links here.";
    let image = renderer.render_to_image(content);

    // Verify dimensions
    assert_eq!(image.width(), renderer.width);
    assert_eq!(image.height(), renderer.height);

    println!("✅ Render without links test passed");
}
