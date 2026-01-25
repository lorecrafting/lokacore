//! Fire Text Material
//!
//! A GPU-accelerated material that applies animated fire effects to text.
//! Uses WGSL shader for 60fps animation performance.

use bevy::{
    prelude::*,
    pbr::MaterialPipelineKey,
    render::render_resource::{
        AsBindGroup, ShaderRef, Face,
        RenderPipelineDescriptor, SpecializedMeshPipelineError,
    },
    reflect::TypePath,
};

/// Custom material for fire text effect
///
/// This material takes a text texture and applies real-time fire animation
/// using a WGSL fragment shader.
#[derive(Asset, AsBindGroup, TypePath, Debug, Clone)]
pub struct FireTextMaterial {
    /// The base text texture to apply fire effect to
    #[texture(0)]
    #[sampler(1)]
    pub base_texture: Handle<Image>,

    /// Fire intensity (0.5 - 2.0, default 1.0)
    #[uniform(2)]
    pub intensity: f32,

    /// Animation speed multiplier (default 1.0)
    #[uniform(3)]
    pub speed: f32,
}

impl Material for FireTextMaterial {
    fn fragment_shader() -> ShaderRef {
        "shaders/fire_text.wgsl".into()
    }

    fn alpha_mode(&self) -> AlphaMode {
        AlphaMode::Blend
    }

    // Disable face culling so both sides of the page show the fire effect
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

impl Default for FireTextMaterial {
    fn default() -> Self {
        Self {
            base_texture: Handle::default(),
            intensity: 1.0,
            speed: 1.0,
        }
    }
}

/// Plugin to register the fire material
pub struct FireMaterialPlugin;

impl Plugin for FireMaterialPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(MaterialPlugin::<FireTextMaterial>::default());
        info!("FireMaterialPlugin registered");
    }
}
