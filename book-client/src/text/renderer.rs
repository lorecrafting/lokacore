//! Text rendering using cosmic-text
//!
//! Renders formatted text to an RGBA image buffer that can be used as a texture.

use bevy::prelude::*;
use bevy::render::render_asset::RenderAssetUsages;
use bevy::render::render_resource::{Extent3d, TextureDimension, TextureFormat};
use cosmic_text::{
    Attrs, Buffer, Color as CosmicColor, Family, FontSystem, Metrics, Shaping, SwashCache,
};

use crate::content::GameState;

/// Resource that handles text rendering to textures
#[derive(Resource)]
pub struct TextRenderer {
    font_system: FontSystem,
    swash_cache: SwashCache,
    /// Texture dimensions
    pub width: u32,
    pub height: u32,
    /// Font size in pixels
    pub font_size: f32,
    /// Line height multiplier
    pub line_height: f32,
    /// Margins in pixels
    pub margin: f32,
}

impl Default for TextRenderer {
    fn default() -> Self {
        Self {
            font_system: FontSystem::new(),
            swash_cache: SwashCache::new(),
            width: 1024,
            height: 1024,
            font_size: 24.0,
            line_height: 1.4,
            margin: 60.0,
        }
    }
}

impl TextRenderer {
    /// Format game state into renderable text
    pub fn format_room_content(&self, game_state: &GameState) -> String {
        let room = &game_state.room;
        let mut lines = Vec::new();

        // Title
        lines.push(format!("~ {} ~", room.name));
        lines.push(String::new());

        // Description
        lines.push(room.description.clone());
        lines.push(String::new());

        // Characters section
        if !room.npcs.is_empty() {
            lines.push("Characters:".to_string());
            for npc in &room.npcs {
                lines.push(format!("  • {}", npc.name));
                lines.push(format!("    {}", npc.short_desc));
            }
            lines.push(String::new());
        }

        // Items section
        if !room.items.is_empty() {
            lines.push("Items:".to_string());
            for item in &room.items {
                lines.push(format!("  • {}", item.name));
            }
            lines.push(String::new());
        }

        // Exits section
        lines.push("Exits:".to_string());
        for exit in &room.exits {
            let label = exit.label.as_deref().unwrap_or(&exit.direction);
            let locked = if exit.locked { " [locked]" } else { "" };
            lines.push(format!("  → {} ({}){}", label, exit.direction, locked));
        }

        lines.join("\n")
    }

    /// Render text content to a Bevy Image
    pub fn render_to_image(&self, content: &str) -> Image {
        let width = self.width as usize;
        let height = self.height as usize;

        // Create RGBA buffer - start with parchment background
        let mut pixels: Vec<u8> = vec![0; width * height * 4];
        for i in 0..(width * height) {
            pixels[i * 4] = 210;     // R - parchment
            pixels[i * 4 + 1] = 190; // G
            pixels[i * 4 + 2] = 160; // B
            pixels[i * 4 + 3] = 255; // A
        }

        // Create cosmic-text buffer
        let mut font_system = FontSystem::new();
        let metrics = Metrics::new(self.font_size, self.font_size * self.line_height);
        let mut buffer = Buffer::new(&mut font_system, metrics);

        let text_width = (width as f32 - self.margin * 2.0) as i32;
        buffer.set_size(&mut font_system, Some(text_width as f32), Some(height as f32));

        // Set text with sepia ink color
        let ink_color = CosmicColor::rgb(60, 45, 30); // Dark sepia/brown
        let attrs = Attrs::new()
            .family(Family::Serif)
            .color(ink_color);

        buffer.set_text(&mut font_system, content, attrs, Shaping::Advanced);
        buffer.shape_until_scroll(&mut font_system, false);

        // Render glyphs to buffer
        let mut swash_cache = SwashCache::new();

        // Y offset for top margin
        let y_offset = self.margin;

        for run in buffer.layout_runs() {
            for glyph in run.glyphs.iter() {
                let physical_glyph = glyph.physical((self.margin, y_offset), 1.0);

                // Get the glyph image from swash
                if let Some(glyph_image) = swash_cache
                    .get_image(&mut font_system, physical_glyph.cache_key)
                {
                    let glyph_x = physical_glyph.x as i32 + glyph_image.placement.left;
                    let glyph_y = physical_glyph.y as i32 - glyph_image.placement.top;

                    // Render glyph pixels
                    for (row_idx, row) in glyph_image.data.chunks(glyph_image.placement.width as usize).enumerate() {
                        let py = glyph_y + row_idx as i32;

                        // Flip Y for texture coordinates (top of texture = top of page)
                        // In image coordinates: 0 is top, height-1 is bottom
                        // We want text at top, so don't flip
                        if py < 0 || py >= height as i32 {
                            continue;
                        }

                        for (col_idx, &alpha) in row.iter().enumerate() {
                            let px = glyph_x + col_idx as i32;
                            if px < 0 || px >= width as i32 {
                                continue;
                            }

                            if alpha == 0 {
                                continue;
                            }

                            // Calculate pixel index - flip Y for OpenGL texture coordinates
                            // OpenGL textures have (0,0) at bottom-left, but we render top-to-bottom
                            let flipped_y = (height as i32 - 1 - py) as usize;
                            let idx = (flipped_y * width + (px as usize)) * 4;

                            if idx + 3 >= pixels.len() {
                                continue;
                            }

                            // Blend ink color with background based on glyph alpha
                            let alpha_f = alpha as f32 / 255.0;
                            let inv_alpha = 1.0 - alpha_f;

                            // Ink color (dark sepia/brown)
                            let ink_r = 50u8;
                            let ink_g = 35u8;
                            let ink_b = 20u8;

                            pixels[idx] = ((ink_r as f32 * alpha_f) + (pixels[idx] as f32 * inv_alpha)) as u8;
                            pixels[idx + 1] = ((ink_g as f32 * alpha_f) + (pixels[idx + 1] as f32 * inv_alpha)) as u8;
                            pixels[idx + 2] = ((ink_b as f32 * alpha_f) + (pixels[idx + 2] as f32 * inv_alpha)) as u8;
                        }
                    }
                }
            }
        }

        // Create Bevy Image
        Image::new(
            Extent3d {
                width: width as u32,
                height: height as u32,
                depth_or_array_layers: 1,
            },
            TextureDimension::D2,
            pixels,
            TextureFormat::Rgba8UnormSrgb,
            RenderAssetUsages::RENDER_WORLD | RenderAssetUsages::MAIN_WORLD,
        )
    }
}
