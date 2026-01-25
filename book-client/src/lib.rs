//! Loka Book - Diegetic 3D Book Renderer
//!
//! A Rust/Bevy-based renderer that displays MUD game content as ink on
//! the pages of a 3D book with shader-driven page curling and visual effects.

pub mod book;
pub mod content;
pub mod text;
pub mod effects;
pub mod input;
pub mod ui;
pub mod dialogue;

use bevy::prelude::*;
pub use content::{GameState, Room, GameEvent};

/// Main plugin for the book renderer
pub struct LokaBookPlugin;

impl Plugin for LokaBookPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins((
            book::BookPlugin,
            text::SdfTextPlugin,  // Use SDF for effect support
            effects::EffectsPlugin,
            input::InputPlugin,
            ui::MenuPlugin,
            ui::HealthBarPlugin,
        ));
    }
}

/// Book renderer configuration
#[derive(Resource, Clone)]
pub struct BookConfig {
    /// Page width in world units
    pub page_width: f32,
    /// Page height in world units
    pub page_height: f32,
    /// Number of subdivisions for page mesh (for curl deformation)
    pub page_subdivisions: u32,
    /// Text texture resolution
    pub text_texture_size: u32,
}

impl Default for BookConfig {
    fn default() -> Self {
        Self {
            page_width: 2.0,
            page_height: 3.0,
            page_subdivisions: 32,
            text_texture_size: 1024,
        }
    }
}
