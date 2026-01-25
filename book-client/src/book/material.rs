//! Page material and texture handling
//!
//! Manages the visual appearance of book pages including paper texture
//! and text overlay.

use bevy::prelude::*;

/// Creates a paper-like material for book pages
pub fn create_paper_material(base_color: Color) -> StandardMaterial {
    StandardMaterial {
        base_color,
        perceptual_roughness: 0.95,  // Rough paper texture
        metallic: 0.0,
        reflectance: 0.2,  // Paper doesn't reflect much
        double_sided: true,
        cull_mode: None,
        ..default()
    }
}

/// Paper color presets - based on "Wandering Library" reference
/// All colors are warm, aged parchment tones
pub mod paper_colors {
    use bevy::prelude::Color;

    /// Primary aged parchment - warm tan/cream like old manuscripts
    /// Reference: "The Wandering Library" one-page RPG
    pub fn aged_parchment() -> Color {
        Color::srgb(0.82, 0.75, 0.62)  // Warm tan with slight yellow
    }

    /// Lighter parchment for inner pages
    pub fn light_parchment() -> Color {
        Color::srgb(0.88, 0.82, 0.70)
    }

    /// Darker parchment for weathered edges (future: use in edge shader)
    pub fn weathered_edge() -> Color {
        Color::srgb(0.65, 0.55, 0.42)
    }

    /// Fresh white paper (modern look)
    pub fn white() -> Color {
        Color::srgb(0.98, 0.98, 0.96)
    }

    /// Dark grimoire paper
    pub fn dark() -> Color {
        Color::srgb(0.25, 0.23, 0.20)
    }

    /// Spirit realm (ethereal blue-silver)
    pub fn spirit() -> Color {
        Color::srgba(0.7, 0.8, 0.95, 0.7)
    }
}

/// Ink color presets - sepia/brown tones for aged look
pub mod ink_colors {
    use bevy::prelude::Color;

    /// Primary ink - dark sepia/brown (NOT pure black)
    /// Matches the "Wandering Library" aesthetic
    pub fn sepia() -> Color {
        Color::srgb(0.25, 0.18, 0.12)  // Dark brown
    }

    /// Lighter sepia for faded text
    pub fn faded_sepia() -> Color {
        Color::srgb(0.40, 0.32, 0.22)
    }

    /// Black ink (more modern look)
    pub fn black() -> Color {
        Color::srgb(0.1, 0.1, 0.1)
    }

    /// Red ink for highlights/headers
    pub fn red_ink() -> Color {
        Color::srgb(0.6, 0.15, 0.1)
    }

    /// Spirit text (glowing blue)
    pub fn spirit() -> Color {
        Color::srgba(0.4, 0.6, 0.9, 0.9)
    }
}
