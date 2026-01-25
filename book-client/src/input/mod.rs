//! Input handling module
//!
//! Handles touch/click input and maps screen coordinates to UV coordinates
//! on the curved book page surface.

use bevy::prelude::*;

pub struct InputPlugin;

impl Plugin for InputPlugin {
    fn build(&self, _app: &mut App) {
        // TODO: Add input handling systems
        info!("InputPlugin initialized (stub)");
    }
}

/// Result of a tap/click on the book
#[derive(Clone, Debug)]
pub enum TapResult {
    /// Tapped on a link
    Link { action: String },
    /// Tapped on the page but not a link
    Page { uv: Vec2 },
    /// Tapped outside the book
    Miss,
}

/// UV lookup for tap detection on curved surfaces
///
/// This stores a rendered "UV map" texture where each pixel's color
/// represents the UV coordinate at that screen position.
#[derive(Resource, Default)]
pub struct UvLookup {
    /// The lookup texture handle (render target)
    pub texture: Option<Handle<Image>>,
    /// Whether the lookup needs to be regenerated
    pub dirty: bool,
}
