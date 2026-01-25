//! Visual effects module
//!
//! Handles shader-based effects like fire, ice, screen shake, etc.

pub mod fire_material;
pub mod ice_material;
pub mod region_materials;

pub use fire_material::*;
pub use ice_material::*;
pub use region_materials::*;

use bevy::prelude::*;

pub struct EffectsPlugin;

impl Plugin for EffectsPlugin {
    fn build(&self, app: &mut App) {
        // Register material plugins for GPU-accelerated effects
        app.add_plugins(FireMaterialPlugin);
        app.add_plugins(IceMaterialPlugin);
        app.add_plugins(RegionMaterialsPlugin);
        info!("EffectsPlugin initialized with FireMaterial, IceMaterial, and RegionMaterials shaders");
    }
}

/// Types of visual effects
#[derive(Clone, Debug)]
pub enum VfxEffect {
    /// Screen shake effect
    ScreenShake {
        intensity: f32,
        duration: f32,
    },
    /// Fire effect on text
    TextFire {
        intensity: f32,
    },
    /// Ice/frost effect on text
    TextIce {
        intensity: f32,
    },
    /// Glow/aura effect
    TextGlow {
        color: Color,
        intensity: f32,
    },
    /// Quick color flash
    DamageFlash {
        color: Color,
        duration: f32,
    },
}
