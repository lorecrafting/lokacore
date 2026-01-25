//! Ice Text Material
//!
//! A GPU-accelerated material that applies animated ice/frost effects to text.
//! Uses WGSL shader for 60fps animation performance.
//!
//! Features:
//! - Frozen text base with semi-transparent ice appearance
//! - Procedural crystalline patterns (Voronoi-based)
//! - Animated ice crack lines spreading across the surface
//! - Falling frost particles for atmospheric depth
//! - Cold mist effect at the bottom
//! - Sharp specular highlights mimicking real ice
//! - HDR blue-white color palette for bloom effects

use bevy::{
    prelude::*,
    pbr::MaterialPipelineKey,
    render::render_resource::{
        AsBindGroup, ShaderRef, RenderPipelineDescriptor, SpecializedMeshPipelineError,
    },
    reflect::TypePath,
};

/// Custom material for ice text effect
///
/// This material takes a text texture and applies real-time ice/frost animation
/// using a WGSL fragment shader.
#[derive(Asset, AsBindGroup, TypePath, Debug, Clone)]
pub struct IceTextMaterial {
    /// The base text texture to apply ice effect to
    #[texture(0)]
    #[sampler(1)]
    pub base_texture: Handle<Image>,

    /// Ice intensity (0.5 - 2.0, default 1.0)
    /// Higher values create more pronounced ice effects
    #[uniform(2)]
    pub intensity: f32,

    /// Animation speed multiplier (default 1.0)
    /// Controls speed of frost particles, crack spreading, and mist movement
    #[uniform(3)]
    pub speed: f32,
}

impl Material for IceTextMaterial {
    fn fragment_shader() -> ShaderRef {
        "shaders/ice_text.wgsl".into()
    }

    fn alpha_mode(&self) -> AlphaMode {
        AlphaMode::Blend
    }

    // Disable face culling so both sides of the page show the ice effect
    fn specialize(
        _pipeline: &bevy::pbr::MaterialPipeline<Self>,
        descriptor: &mut RenderPipelineDescriptor,
        _layout: &bevy::render::mesh::MeshVertexBufferLayoutRef,
        _key: MaterialPipelineKey<Self>,
    ) -> Result<(), SpecializedMeshPipelineError> {
        // Disable culling - render both front and back faces
        descriptor.primitive.cull_mode = None;
        Ok(())
    }
}

impl Default for IceTextMaterial {
    fn default() -> Self {
        Self {
            base_texture: Handle::default(),
            intensity: 1.0,
            speed: 1.0,
        }
    }
}

/// Builder pattern for creating IceTextMaterial with custom settings
impl IceTextMaterial {
    /// Create a new ice material with the given texture
    pub fn new(base_texture: Handle<Image>) -> Self {
        Self {
            base_texture,
            intensity: 1.0,
            speed: 1.0,
        }
    }

    /// Set the ice intensity (0.5 - 2.0 recommended)
    pub fn with_intensity(mut self, intensity: f32) -> Self {
        self.intensity = intensity;
        self
    }

    /// Set the animation speed multiplier
    pub fn with_speed(mut self, speed: f32) -> Self {
        self.speed = speed;
        self
    }
}

/// Plugin to register the ice material
pub struct IceMaterialPlugin;

impl Plugin for IceMaterialPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(MaterialPlugin::<IceTextMaterial>::default());
        info!("IceMaterialPlugin registered");
    }
}
