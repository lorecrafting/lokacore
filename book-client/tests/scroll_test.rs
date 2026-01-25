// Test for basic scroll state management
use bevy::prelude::*;

#[test]
fn test_scroll_state_initialization() {
    #[derive(Resource, Default)]
    struct TextRenderState {
        scroll_offset: f32,
        max_scroll: f32,
    }

    let state = TextRenderState::default();
    assert_eq!(state.scroll_offset, 0.0);
    assert_eq!(state.max_scroll, 0.0);
    println!("✅ Scroll state initializes correctly");
}

#[test]
fn test_scroll_clamping() {
    let mut scroll_offset = 0.0_f32;
    let max_scroll = 100.0_f32;

    // Test scrolling down
    scroll_offset += 50.0;
    scroll_offset = scroll_offset.clamp(0.0, max_scroll);
    assert_eq!(scroll_offset, 50.0);

    // Test scrolling past max
    scroll_offset += 100.0;
    scroll_offset = scroll_offset.clamp(0.0, max_scroll);
    assert_eq!(scroll_offset, 100.0);

    // Test scrolling up past min
    scroll_offset -= 200.0;
    scroll_offset = scroll_offset.clamp(0.0, max_scroll);
    assert_eq!(scroll_offset, 0.0);

    println!("✅ Scroll clamping works correctly");
}
