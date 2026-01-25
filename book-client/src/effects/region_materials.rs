//! Region-Based Effect Materials
//!
//! Materials that apply effects to specific regions of text rather than the whole page.
//! Useful for highlighting titles, important words, or magical text.

use bevy::{
    prelude::*,
    pbr::MaterialPipelineKey,
    render::render_resource::{
        AsBindGroup, ShaderRef, Face,
        RenderPipelineDescriptor, SpecializedMeshPipelineError,
    },
    reflect::TypePath,
};

/// Region bounds in UV coordinates (0-1 range)
/// x = left, y = top, z = right, w = bottom
#[derive(Clone, Copy, Debug, Default)]
pub struct TextRegion {
    pub left: f32,
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
}

impl TextRegion {
    /// Create a region from UV coordinates
    pub fn new(left: f32, top: f32, right: f32, bottom: f32) -> Self {
        Self { left, top, right, bottom }
    }

    /// Create a region for a title (top portion of page)
    pub fn title() -> Self {
        Self::new(0.05, 0.02, 0.95, 0.12)
    }

    /// Create a region for the first line of body text
    pub fn first_line() -> Self {
        Self::new(0.05, 0.12, 0.95, 0.18)
    }

    /// Create a region for a specific line (0-indexed)
    pub fn line(line_num: u32, lines_per_page: u32) -> Self {
        let line_height = 0.8 / lines_per_page as f32;
        let top = 0.1 + line_num as f32 * line_height;
        Self::new(0.05, top, 0.95, top + line_height)
    }

    /// Convert to Vec4 for shader uniform
    pub fn to_vec4(&self) -> Vec4 {
        Vec4::new(self.left, self.top, self.right, self.bottom)
    }
}

// ============================================================================
// FIRE REGION MATERIAL
// ============================================================================

/// Fire effect applied to a specific region of text
#[derive(Asset, AsBindGroup, TypePath, Debug, Clone)]
pub struct FireRegionMaterial {
    #[texture(0)]
    #[sampler(1)]
    pub base_texture: Handle<Image>,

    #[uniform(2)]
    pub intensity: f32,

    #[uniform(3)]
    pub speed: f32,

    /// Region bounds: x=left, y=top, z=right, w=bottom
    #[uniform(4)]
    pub region: Vec4,
}

impl Material for FireRegionMaterial {
    fn fragment_shader() -> ShaderRef {
        "shaders/fire_text_region.wgsl".into()
    }

    fn alpha_mode(&self) -> AlphaMode {
        AlphaMode::Blend
    }

    fn specialize(
        _pipeline: &bevy::pbr::MaterialPipeline<Self>,
        descriptor: &mut RenderPipelineDescriptor,
        _layout: &bevy::render::mesh::MeshVertexBufferLayoutRef,
        _key: MaterialPipelineKey<Self>,
    ) -> Result<(), SpecializedMeshPipelineError> {
        descriptor.primitive.cull_mode = None;
        Ok(())
    }
}

impl FireRegionMaterial {
    pub fn new(texture: Handle<Image>, region: TextRegion) -> Self {
        Self {
            base_texture: texture,
            intensity: 1.2,
            speed: 1.0,
            region: region.to_vec4(),
        }
    }

    pub fn with_intensity(mut self, intensity: f32) -> Self {
        self.intensity = intensity;
        self
    }

    pub fn with_region(mut self, region: TextRegion) -> Self {
        self.region = region.to_vec4();
        self
    }
}

impl Default for FireRegionMaterial {
    fn default() -> Self {
        Self {
            base_texture: Handle::default(),
            intensity: 1.2,
            speed: 1.0,
            region: TextRegion::title().to_vec4(),
        }
    }
}

// ============================================================================
// ICE REGION MATERIAL
// ============================================================================

/// Ice effect applied to a specific region of text
#[derive(Asset, AsBindGroup, TypePath, Debug, Clone)]
pub struct IceRegionMaterial {
    #[texture(0)]
    #[sampler(1)]
    pub base_texture: Handle<Image>,

    #[uniform(2)]
    pub intensity: f32,

    #[uniform(3)]
    pub speed: f32,

    /// Region bounds: x=left, y=top, z=right, w=bottom
    #[uniform(4)]
    pub region: Vec4,
}

impl Material for IceRegionMaterial {
    fn fragment_shader() -> ShaderRef {
        "shaders/ice_text_region.wgsl".into()
    }

    fn alpha_mode(&self) -> AlphaMode {
        AlphaMode::Blend
    }

    fn specialize(
        _pipeline: &bevy::pbr::MaterialPipeline<Self>,
        descriptor: &mut RenderPipelineDescriptor,
        _layout: &bevy::render::mesh::MeshVertexBufferLayoutRef,
        _key: MaterialPipelineKey<Self>,
    ) -> Result<(), SpecializedMeshPipelineError> {
        descriptor.primitive.cull_mode = None;
        Ok(())
    }
}

impl IceRegionMaterial {
    pub fn new(texture: Handle<Image>, region: TextRegion) -> Self {
        Self {
            base_texture: texture,
            intensity: 1.2,
            speed: 0.8,
            region: region.to_vec4(),
        }
    }

    pub fn with_intensity(mut self, intensity: f32) -> Self {
        self.intensity = intensity;
        self
    }

    pub fn with_region(mut self, region: TextRegion) -> Self {
        self.region = region.to_vec4();
        self
    }
}

impl Default for IceRegionMaterial {
    fn default() -> Self {
        Self {
            base_texture: Handle::default(),
            intensity: 1.2,
            speed: 0.8,
            region: TextRegion::title().to_vec4(),
        }
    }
}

// ============================================================================
// PLUGIN
// ============================================================================

pub struct RegionMaterialsPlugin;

impl Plugin for RegionMaterialsPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(MaterialPlugin::<FireRegionMaterial>::default());
        app.add_plugins(MaterialPlugin::<IceRegionMaterial>::default());
        info!("RegionMaterialsPlugin registered (fire + ice region effects)");
    }
}
