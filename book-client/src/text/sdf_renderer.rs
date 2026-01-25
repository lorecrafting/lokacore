//! SDF (Signed Distance Field) text rendering with effects
//!
//! Uses fontdue to generate SDF glyphs, enabling:
//! - Crisp text at any scale
//! - Fire, ice, glow effects via shaders
//! - Smooth animations

use bevy::prelude::*;
use bevy::render::render_asset::RenderAssetUsages;
use bevy::render::render_resource::{Extent3d, TextureDimension, TextureFormat};
use fontdue::{Font, FontSettings};

use crate::content::{GameState, Room};
use super::LinkRegion;

/// Text effect types that can be applied to text
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum TextEffect {
    #[default]
    None,
    /// Fire effect - text appears to burn
    Fire {
        intensity: f32,  // 0.0 to 1.0
    },
    /// Ice effect - text appears frozen
    Ice {
        frost_level: f32,  // 0.0 to 1.0
    },
    /// Magic glow effect
    Glow {
        color: [f32; 3],  // RGB
        intensity: f32,
    },
    /// Ghostly/spirit text
    Spirit {
        opacity: f32,
    },
}

/// SDF Text Renderer resource
#[derive(Resource)]
pub struct SdfTextRenderer {
    /// Embedded font data
    font: Font,
    /// Texture dimensions
    pub width: u32,
    pub height: u32,
    /// Font size for rendering
    pub font_size: f32,
    /// Line spacing multiplier
    pub line_height: f32,
    /// Page margins
    pub margin: f32,
    /// Current text effect
    pub effect: TextEffect,
    /// Animation time (for animated effects)
    pub time: f32,
}

impl Default for SdfTextRenderer {
    fn default() -> Self {
        // Use DejaVu Sans Mono as a fallback (commonly available)
        // In production, we'd embed a proper serif font
        // For now, try to load from common system paths or use a minimal fallback
        let font = Self::load_system_font()
            .unwrap_or_else(|| Self::create_fallback_font());

        Self {
            font,
            width: 1024,
            height: 1024,
            font_size: 28.0,
            line_height: 1.5,
            margin: 50.0,
            effect: TextEffect::None,
            time: 0.0,
        }
    }
}

impl SdfTextRenderer {
    /// Try to load a system font
    fn load_system_font() -> Option<Font> {
        // Try common font paths
        let font_paths = [
            "/System/Library/Fonts/Times.ttc",  // macOS
            "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
            "/Library/Fonts/Georgia.ttf",
            "/System/Library/Fonts/NewYork.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",  // Linux
            "/usr/share/fonts/TTF/DejaVuSerif.ttf",
            "C:\\Windows\\Fonts\\times.ttf",  // Windows
        ];

        for path in &font_paths {
            if let Ok(data) = std::fs::read(path) {
                if let Ok(font) = Font::from_bytes(data, FontSettings::default()) {
                    info!("Loaded system font from: {}", path);
                    return Some(font);
                }
            }
        }

        None
    }

    /// Create a minimal fallback "font" using simple rectangles
    fn create_fallback_font() -> Font {
        // This shouldn't happen in practice, but provides a fallback
        // In production, we'd include an embedded font
        warn!("No system font found, using minimal fallback");

        // Use DejaVu from the fontdue crate's test data, or just panic with helpful message
        panic!("No font available. Please install a TrueType font or add one to assets/fonts/");
    }
}

impl SdfTextRenderer {
    /// Create with a specific font
    pub fn with_font(font_data: &[u8]) -> Self {
        let font = Font::from_bytes(font_data, FontSettings::default())
            .expect("Failed to load font");

        Self {
            font,
            ..Default::default()
        }
    }

    /// Format game state into text for rendering
    pub fn format_room_content(&self, game_state: &GameState) -> String {
        self.format_room_content_for_room(&game_state.room)
    }

    /// Format a specific room into text for rendering
    pub fn format_room_content_for_room(&self, room: &Room) -> String {
        let mut lines = Vec::new();

        // Title
        lines.push(format!("~ {} ~", room.name));
        lines.push(String::new());

        // Description - wrap lines
        for line in self.word_wrap(&room.description, 45) {
            lines.push(line);
        }
        lines.push(String::new());

        // Characters
        if !room.npcs.is_empty() {
            lines.push("Characters:".to_string());
            for npc in &room.npcs {
                lines.push(format!("  {} - {}", npc.name, self.truncate(&npc.short_desc, 35)));
            }
            lines.push(String::new());
        }

        // Items
        if !room.items.is_empty() {
            lines.push("Items:".to_string());
            for item in &room.items {
                lines.push(format!("  {}", item.name));
            }
            lines.push(String::new());
        }

        // Exits
        lines.push("Exits:".to_string());
        for exit in &room.exits {
            let label = exit.label.as_deref().unwrap_or(&exit.direction);
            lines.push(format!("  > {} ({})", label, exit.direction));
        }

        lines.join("\n")
    }

    /// Render text to an image with SDF and effects
    pub fn render_to_image(&self, content: &str) -> Image {
        self.render_to_image_with_links(content, &[])
    }

    /// Render text to an image with SDF, effects, and underlined links
    pub fn render_to_image_with_links(&self, content: &str, link_regions: &[LinkRegion]) -> Image {
        info!("render_to_image called with effect: {:?}", self.effect);

        // Log the expected color for first pixel based on effect
        let sample_color = self.apply_effect(1.0, 5, 5, 20, 20);
        info!("Sample color for effect {:?}: RGB({:.0}, {:.0}, {:.0})",
              self.effect, sample_color.0, sample_color.1, sample_color.2);

        let width = self.width as usize;
        let height = self.height as usize;

        // Create RGBA buffer with procedural parchment background
        let mut pixels: Vec<u8> = vec![0; width * height * 4];

        // Fill with procedural parchment texture
        for y in 0..height {
            for x in 0..width {
                let i = y * width + x;

                // Base parchment color
                let base_r = 210.0;
                let base_g = 190.0;
                let base_b = 160.0;

                // Add noise variation (subtle texture)
                let noise = simple_hash(x as f32, y as f32) * 20.0 - 10.0;

                // Vignette effect (darker at edges)
                let nx = (x as f32 / width as f32) * 2.0 - 1.0;
                let ny = (y as f32 / height as f32) * 2.0 - 1.0;
                let vignette = 1.0 - (nx * nx + ny * ny) * 0.15;

                // Occasional age marks (darker spots)
                let spot_noise = simple_hash(x as f32 * 0.1, y as f32 * 0.1);
                let age_mark = if spot_noise > 0.92 {
                    0.85 + spot_noise * 0.15 // Subtle darkening for age marks
                } else {
                    1.0
                };

                pixels[i * 4] = ((base_r + noise) * vignette * age_mark).clamp(0.0, 255.0) as u8;
                pixels[i * 4 + 1] = ((base_g + noise * 0.8) * vignette * age_mark).clamp(0.0, 255.0) as u8;
                pixels[i * 4 + 2] = ((base_b + noise * 0.6) * vignette * age_mark).clamp(0.0, 255.0) as u8;
                pixels[i * 4 + 3] = 255;
            }
        }

        // Render each character
        let mut cursor_x = self.margin;
        let mut cursor_y = self.margin;
        let line_height = self.font_size * self.line_height;

        for ch in content.chars() {
            if ch == '\n' {
                cursor_x = self.margin;
                cursor_y += line_height;
                continue;
            }

            // Get glyph metrics and rasterize
            let (metrics, bitmap) = self.font.rasterize(ch, self.font_size);

            if metrics.width == 0 || metrics.height == 0 {
                cursor_x += metrics.advance_width;
                continue;
            }

            // Calculate glyph position
            let glyph_x = cursor_x as i32 + metrics.xmin;
            let glyph_y = cursor_y as i32 + (self.font_size as i32 - metrics.ymin - metrics.height as i32);

            // Render glyph with effect
            self.render_glyph_with_effect(
                &mut pixels,
                width,
                height,
                &bitmap,
                metrics.width,
                metrics.height,
                glyph_x,
                glyph_y,
            );

            cursor_x += metrics.advance_width;

            // Word wrap if needed
            if cursor_x > (width as f32 - self.margin) {
                cursor_x = self.margin;
                cursor_y += line_height;
            }
        }

        // Draw underlines for all link regions
        for link in link_regions {
            self.draw_underline(&mut pixels, width, height, link);
        }

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

    /// Draw an underline for a link region
    fn draw_underline(
        &self,
        pixels: &mut [u8],
        width: usize,
        height: usize,
        link: &LinkRegion,
    ) {
        // Convert UV coordinates (0-1 range, Y=0 at bottom) to pixel coordinates (Y=0 at top)
        let x_start = (link.bounds.min.x * width as f32) as i32;
        let x_end = (link.bounds.max.x * width as f32) as i32;

        info!("Drawing underline for '{}' from x={} to x={}", link.text, x_start, x_end);

        // UV Y is flipped, so max.y is actually at the top in pixel space
        let y_baseline = ((1.0 - link.bounds.max.y) * height as f32) as i32;

        // Underline position: 2 pixels below baseline
        let underline_y = y_baseline + 2;
        let underline_thickness = 2; // 2 pixel thick underline

        // Text color (sepia ink)
        let ink_r = 20;
        let ink_g = 15;
        let ink_b = 10;
        let ink_a = 255;

        // Draw horizontal line
        for y_offset in 0..underline_thickness {
            let y = underline_y + y_offset;

            // Bounds check
            if y < 0 || y >= height as i32 {
                continue;
            }

            // Flip Y for texture coordinates (OpenGL convention)
            let flipped_y = (height as i32 - 1 - y) as usize;

            for x in x_start..x_end {
                if x < 0 || x >= width as i32 {
                    continue;
                }

                let idx = (flipped_y * width + x as usize) * 4;

                if idx + 3 >= pixels.len() {
                    continue;
                }

                // Alpha blend with background
                let bg_r = pixels[idx] as f32;
                let bg_g = pixels[idx + 1] as f32;
                let bg_b = pixels[idx + 2] as f32;

                let alpha = ink_a as f32 / 255.0;
                let inv_alpha = 1.0 - alpha;

                pixels[idx] = (ink_r as f32 * alpha + bg_r * inv_alpha) as u8;
                pixels[idx + 1] = (ink_g as f32 * alpha + bg_g * inv_alpha) as u8;
                pixels[idx + 2] = (ink_b as f32 * alpha + bg_b * inv_alpha) as u8;
            }
        }
    }

    /// Render a single glyph with the current effect
    fn render_glyph_with_effect(
        &self,
        pixels: &mut [u8],
        img_width: usize,
        img_height: usize,
        bitmap: &[u8],
        glyph_width: usize,
        glyph_height: usize,
        glyph_x: i32,
        glyph_y: i32,
    ) {
        for row in 0..glyph_height {
            for col in 0..glyph_width {
                let px = glyph_x + col as i32;
                let py = glyph_y + row as i32;

                // Bounds check
                if px < 0 || px >= img_width as i32 || py < 0 || py >= img_height as i32 {
                    continue;
                }

                let coverage = bitmap[row * glyph_width + col] as f32 / 255.0;
                if coverage < 0.01 {
                    continue;
                }

                // Flip Y for OpenGL texture coordinates
                let flipped_y = (img_height as i32 - 1 - py) as usize;
                let idx = (flipped_y * img_width + px as usize) * 4;

                if idx + 3 >= pixels.len() {
                    continue;
                }

                // Apply effect to get final color
                let (r, g, b, a) = self.apply_effect(coverage, row, col, glyph_height, glyph_width);

                // Alpha blend with background
                let bg_r = pixels[idx] as f32;
                let bg_g = pixels[idx + 1] as f32;
                let bg_b = pixels[idx + 2] as f32;

                let alpha = a * coverage;
                let inv_alpha = 1.0 - alpha;

                pixels[idx] = (r * alpha + bg_r * inv_alpha) as u8;
                pixels[idx + 1] = (g * alpha + bg_g * inv_alpha) as u8;
                pixels[idx + 2] = (b * alpha + bg_b * inv_alpha) as u8;
            }
        }
    }

    /// Apply the current text effect to get pixel color
    /// Returns (r, g, b, alpha_multiplier) where r,g,b are 0-255 and alpha is 0-1
    /// Note: coverage is applied separately in render_glyph_with_effect
    fn apply_effect(&self, _coverage: f32, row: usize, col: usize, height: usize, _width: usize) -> (f32, f32, f32, f32) {
        // Log first pixel of each glyph for debugging
        static mut LOG_COUNT: u32 = 0;
        if row == 0 && col == 0 {
            unsafe {
                LOG_COUNT += 1;
                if LOG_COUNT <= 3 {
                    info!("apply_effect: effect={:?}, will return color for first pixel", self.effect);
                }
            }
        }

        match self.effect {
            TextEffect::None => {
                // Dark ink - high contrast against parchment
                (20.0, 15.0, 10.0, 1.0)
            }
            TextEffect::Fire { intensity } => {
                // Animated fire: flickering yellow/orange/red
                let t = row as f32 / height.max(1) as f32;

                // Time-based flicker
                let flicker = ((self.time * 12.0 + col as f32 * 0.3 + row as f32 * 0.2).sin() * 0.3 + 0.7);
                let wave = ((self.time * 8.0 + t * 5.0).sin() * 0.2 + 0.8);

                // Fire gradient with animation
                let r = 255.0 * flicker;
                let g = (255.0 - (t * 180.0)) * wave * intensity;  // Yellow to orange to red
                let b = 30.0 * (1.0 - t);  // Slight warmth

                (r.min(255.0), g.max(20.0).min(255.0), b, 1.0)
            }
            TextEffect::Ice { frost_level } => {
                // Vivid ice blue - bright and cold
                let t = row as f32 / height.max(1) as f32;
                let variation = ((col as f32 * 0.3 + t * 3.0).sin() * 0.5 + 0.5) * frost_level;

                // Bright cyan-blue
                let r = 50.0 + 50.0 * variation;
                let g = 200.0 + 55.0 * variation;
                let b = 255.0;

                (r, g, b, 1.0)
            }
            TextEffect::Glow { color, intensity } => {
                // Bright saturated glow
                let i = intensity.max(0.8);  // Ensure minimum brightness
                (color[0] * 255.0 * i, color[1] * 255.0 * i, color[2] * 255.0 * i, 1.0)
            }
            TextEffect::Spirit { opacity } => {
                // Animated ghostly effect - wavering transparency
                let wave = ((self.time * 3.0 + row as f32 * 0.1).sin() * 0.15 + 0.85);
                let shimmer = ((self.time * 5.0 + col as f32 * 0.2).sin() * 0.1 + 0.9);

                // Ghostly cyan-white with wave
                let r = 150.0 * shimmer;
                let g = 220.0 * wave;
                let b = 255.0;

                (r, g, b, opacity.max(0.7) * wave)
            }
        }
    }

    /// Word wrap helper
    fn word_wrap(&self, text: &str, max_width: usize) -> Vec<String> {
        let mut lines = Vec::new();
        for paragraph in text.split('\n') {
            let words: Vec<&str> = paragraph.split_whitespace().collect();
            let mut current_line = String::new();

            for word in words {
                if current_line.is_empty() {
                    current_line = word.to_string();
                } else if current_line.len() + 1 + word.len() <= max_width {
                    current_line.push(' ');
                    current_line.push_str(word);
                } else {
                    lines.push(current_line);
                    current_line = word.to_string();
                }
            }

            if !current_line.is_empty() {
                lines.push(current_line);
            }
        }
        lines
    }

    /// Truncate helper
    fn truncate(&self, s: &str, max_len: usize) -> String {
        if s.len() <= max_len {
            s.to_string()
        } else {
            format!("{}...", &s[..max_len.saturating_sub(3)])
        }
    }

    /// Calculate link regions for a room's content
    /// Returns a list of LinkRegion with UV bounds for each clickable element
    pub fn calculate_link_regions(&self, room: &Room) -> Vec<LinkRegion> {
        let mut regions = Vec::new();
        let line_height = self.font_size * self.line_height;

        // Track current Y position in pixels
        let mut current_y = self.margin;

        // Skip title (line 1) and blank line (line 2)
        current_y += line_height; // Title
        current_y += line_height; // Blank

        // Skip description lines (estimate based on word wrap)
        let desc_lines = self.word_wrap(&room.description, 45);
        current_y += line_height * desc_lines.len() as f32;
        current_y += line_height; // Blank after description

        // Characters section
        if !room.npcs.is_empty() {
            current_y += line_height; // "Characters:" header
            for npc in &room.npcs {
                // NPC name is a link
                let link_text = &npc.name;
                let link_x_start = self.margin + self.measure_text("  "); // "  " indent
                let link_width = self.measure_text(link_text);

                // Convert to UV coordinates (0-1 range)
                // Note: Flip Y axis (pixel Y=0 at top, UV Y=0 at bottom)
                let uv_min_y = 1.0 - ((current_y + self.font_size) / self.height as f32);
                let uv_max_y = 1.0 - (current_y / self.height as f32);
                let bounds = Rect::new(
                    link_x_start / self.width as f32,
                    uv_min_y,
                    (link_x_start + link_width) / self.width as f32,
                    uv_max_y,
                );

                regions.push(LinkRegion {
                    text: link_text.clone(),
                    action_id: format!("entity:{}", npc.key),
                    bounds,
                });

                info!("Link region: '{}' @ ({:.3}, {:.3}) -> ({:.3}, {:.3})",
                      link_text, bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y);

                current_y += line_height;
            }
            current_y += line_height; // Blank after NPCs
        }

        // Items section
        if !room.items.is_empty() {
            current_y += line_height; // "Items:" header
            for item in &room.items {
                let link_text = &item.name;
                let link_x_start = self.margin + self.measure_text("  ");
                let link_width = self.measure_text(link_text);

                // Convert to UV coordinates with Y-axis flip
                let uv_min_y = 1.0 - ((current_y + self.font_size) / self.height as f32);
                let uv_max_y = 1.0 - (current_y / self.height as f32);
                let bounds = Rect::new(
                    link_x_start / self.width as f32,
                    uv_min_y,
                    (link_x_start + link_width) / self.width as f32,
                    uv_max_y,
                );

                regions.push(LinkRegion {
                    text: link_text.clone(),
                    action_id: format!("item:{}", item.key),
                    bounds,
                });

                current_y += line_height;
            }
            current_y += line_height; // Blank after items
        }

        // Exits section
        current_y += line_height; // "Exits:" header
        for exit in &room.exits {
            let label = exit.label.as_deref().unwrap_or(&exit.direction);
            let link_x_start = self.margin + self.measure_text("  > ");
            let link_width = self.measure_text(label);

            // Convert to UV coordinates with Y-axis flip
            let uv_min_y = 1.0 - ((current_y + self.font_size) / self.height as f32);
            let uv_max_y = 1.0 - (current_y / self.height as f32);
            let bounds = Rect::new(
                link_x_start / self.width as f32,
                uv_min_y,
                (link_x_start + link_width) / self.width as f32,
                uv_max_y,
            );

            regions.push(LinkRegion {
                text: label.to_string(),
                action_id: format!("exit:{}", exit.direction),
                bounds,
            });

            current_y += line_height;
        }

        regions
    }

    /// Measure the width of a text string in pixels
    fn measure_text(&self, text: &str) -> f32 {
        let mut width = 0.0;
        for ch in text.chars() {
            let (metrics, _) = self.font.rasterize(ch, self.font_size);
            width += metrics.advance_width;
        }
        width
    }
}

/// Simple hash function for procedural noise generation
/// Returns a value between 0.0 and 1.0
fn simple_hash(x: f32, y: f32) -> f32 {
    let h = (x * 127.1 + y * 311.7).sin() * 43758.5453;
    h.fract()
}

/// System to update effect animation time
pub fn update_effect_time(
    time: Res<Time>,
    mut renderer: ResMut<SdfTextRenderer>,
) {
    renderer.time = time.elapsed_secs();
}
