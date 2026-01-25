//! Text rendering module
//!
//! Renders game content to textures using SDF (Signed Distance Field) fonts.
//! Supports effects like fire, ice, glow for magical text.

mod renderer;
mod sdf_renderer;

pub use renderer::*;
pub use sdf_renderer::{SdfTextRenderer, TextEffect};

use bevy::prelude::*;
use crate::content::{GameState, NavigationState, Room};
use crate::book::{PageCurlState, TurnPhase};

pub struct TextPlugin;

impl Plugin for TextPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TextRenderer>()
            .init_resource::<TextRenderState>()
            .add_systems(Update, (
                setup_page_texture_deferred,
                update_page_texture,
            ));
        info!("TextPlugin initialized");
    }
}

/// Plugin for SDF text with effects (use instead of TextPlugin for effects)
pub struct SdfTextPlugin;

impl Plugin for SdfTextPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<SdfTextRenderer>()
            .init_resource::<TextRenderState>()
            .init_resource::<NavigationState>()
            .init_resource::<PageLinkRegions>()
            .add_systems(Update, (
                setup_sdf_texture_deferred,
                update_sdf_texture,
                update_next_page_for_navigation,
                handle_turn_completion,
                sdf_renderer::update_effect_time,
            ));
        info!("SdfTextPlugin initialized with effects support");
    }
}

/// Setup SDF texture on pages - separate textures for current and next page
fn setup_sdf_texture_deferred(
    mut commands: Commands,
    mut images: ResMut<Assets<Image>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    sdf_renderer: Res<SdfTextRenderer>,
    game_state: Option<Res<GameState>>,
    current_page_query: Query<Entity, (With<crate::book::CurrentPage>, Without<PageTexture>)>,
    next_page_query: Query<Entity, (With<crate::book::NextPage>, Without<PageTexture>)>,
) {
    // Setup current page (the one that curls)
    for entity in current_page_query.iter() {
        let (content, links) = if let Some(ref gs) = game_state {
            let content = sdf_renderer.format_room_content(gs);
            let links = sdf_renderer.calculate_link_regions(&gs.room);
            (content, links)
        } else {
            ("Welcome to Loka\n\nUse arrow keys to navigate.".to_string(), vec![])
        };

        let image = sdf_renderer.render_to_image_with_links(&content, &links);
        let texture_handle = images.add(image);

        let page_material = materials.add(StandardMaterial {
            base_color: Color::WHITE,
            base_color_texture: Some(texture_handle.clone()),
            unlit: false,
            alpha_mode: AlphaMode::Blend,
            double_sided: true,
            cull_mode: None,
            ..default()
        });

        commands.entity(entity)
            .insert(PageTexture { texture_handle })
            .insert(MeshMaterial3d(page_material));

        info!("SDF texture applied to CurrentPage");
    }

    // Setup next page (the one underneath, shows next room)
    for entity in next_page_query.iter() {
        // For now, show a "next page" placeholder
        // In a real implementation, this would show the likely next room
        let content = "~ Next Page ~\n\n(Turn the page to continue...)".to_string();

        let image = sdf_renderer.render_to_image(&content);
        let texture_handle = images.add(image);

        let page_material = materials.add(StandardMaterial {
            base_color: Color::WHITE,
            base_color_texture: Some(texture_handle.clone()),
            unlit: false,
            alpha_mode: AlphaMode::Blend,
            double_sided: true,
            cull_mode: None,
            ..default()
        });

        commands.entity(entity)
            .insert(PageTexture { texture_handle })
            .insert(MeshMaterial3d(page_material));

        info!("SDF texture applied to NextPage");
    }
}

/// Update SDF texture when content or effect changes (CurrentPage only)
///
/// Note: We update the material's texture handle directly to ensure GPU re-upload
fn update_sdf_texture(
    mut commands: Commands,
    mut images: ResMut<Assets<Image>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    sdf_renderer: Res<SdfTextRenderer>,
    game_state: Option<Res<GameState>>,
    mut render_state: ResMut<TextRenderState>,
    mut link_regions: ResMut<PageLinkRegions>,
    time: Res<Time>,
    current_page_query: Query<(Entity, &PageTexture, &MeshMaterial3d<StandardMaterial>), With<crate::book::CurrentPage>>,
) {
    let Some(game_state) = game_state else { return };

    let content = sdf_renderer.format_room_content(&game_state);
    let content_hash = hash_string(&content);

    // Check if effect is animated (needs continuous re-render)
    let is_animated = matches!(
        sdf_renderer.effect,
        TextEffect::Fire { .. } | TextEffect::Spirit { .. }
    );

    // For animated effects, re-render every ~100ms (10 FPS animation)
    let animation_interval = 0.1;
    let needs_animation_update = is_animated &&
        (time.elapsed_secs() - render_state.last_animation_render) > animation_interval;

    // Re-render if content changed OR hash was reset OR animated effect needs update
    if content_hash == render_state.last_content_hash && !needs_animation_update {
        return;
    }

    if needs_animation_update {
        render_state.last_animation_render = time.elapsed_secs();
    }

    // Calculate link regions BEFORE rendering so underlines can be drawn
    link_regions.regions = sdf_renderer.calculate_link_regions(&game_state.room);

    info!("Re-rendering SDF texture with effect: {:?}, {} links",
          sdf_renderer.effect, link_regions.regions.len());
    let image = sdf_renderer.render_to_image_with_links(&content, &link_regions.regions);

    for (entity, page_texture, material_handle) in current_page_query.iter() {
        // Remove old image
        let old_handle = page_texture.texture_handle.clone();

        // Create new image and add to assets
        let new_texture_handle = images.add(image.clone());

        // Update the material's texture reference
        if let Some(material) = materials.get_mut(&material_handle.0) {
            material.base_color_texture = Some(new_texture_handle.clone());
            info!("Updated material texture for CurrentPage");
        }

        // Update the PageTexture component with new handle
        commands.entity(entity).insert(PageTexture {
            texture_handle: new_texture_handle
        });

        // Remove old texture from assets
        images.remove(&old_handle);
    }

    render_state.last_content_hash = content_hash;
    info!("SDF texture updated for room: {} ({} links)",
          game_state.room.name, link_regions.regions.len());
}

/// Update NextPage texture when navigation starts (before page turn)
fn update_next_page_for_navigation(
    mut commands: Commands,
    mut images: ResMut<Assets<Image>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    sdf_renderer: Res<SdfTextRenderer>,
    mut nav_state: ResMut<NavigationState>,
    curl_state: Res<PageCurlState>,
    next_page_query: Query<(Entity, &PageTexture, &MeshMaterial3d<StandardMaterial>), With<crate::book::NextPage>>,
) {
    // Only update if we have a pending room and haven't rendered it yet
    if !nav_state.has_pending() || nav_state.next_page_ready {
        return;
    }

    // Only render when turn is starting (not yet in settling or idle)
    if curl_state.phase != TurnPhase::Turning && curl_state.phase != TurnPhase::Idle {
        return;
    }

    let Some(ref pending_room) = nav_state.pending_room else { return };

    // Clone the name for logging after mutation
    let room_name = pending_room.name.clone();
    info!("Rendering destination room '{}' to NextPage", room_name);

    // Calculate link regions for the pending room
    let link_regions = sdf_renderer.calculate_link_regions(pending_room);

    // Format the pending room content
    let content = sdf_renderer.format_room_content_for_room(pending_room);
    let image = sdf_renderer.render_to_image_with_links(&content, &link_regions);

    for (entity, page_texture, material_handle) in next_page_query.iter() {
        let old_handle = page_texture.texture_handle.clone();
        let new_texture_handle = images.add(image.clone());

        // Update the material's texture
        if let Some(material) = materials.get_mut(&material_handle.0) {
            material.base_color_texture = Some(new_texture_handle.clone());
        }

        // Update the PageTexture component
        commands.entity(entity).insert(PageTexture {
            texture_handle: new_texture_handle
        });

        // Remove old texture
        images.remove(&old_handle);
    }

    nav_state.next_page_ready = true;
    info!("NextPage ready with destination: {}", room_name);
}

/// Handle page turn completion - swap content and reset
fn handle_turn_completion(
    mut commands: Commands,
    mut images: ResMut<Assets<Image>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    sdf_renderer: Res<SdfTextRenderer>,
    mut game_state: ResMut<GameState>,
    mut nav_state: ResMut<NavigationState>,
    mut curl_state: ResMut<PageCurlState>,
    mut render_state: ResMut<TextRenderState>,
    current_page_query: Query<(Entity, &PageTexture, &MeshMaterial3d<StandardMaterial>), With<crate::book::CurrentPage>>,
    next_page_query: Query<(Entity, &PageTexture, &MeshMaterial3d<StandardMaterial>), With<crate::book::NextPage>>,
) {
    // Only act when turn just completed
    if !curl_state.turn_just_completed {
        return;
    }

    // If we have a pending room, complete the navigation
    if let Some(new_room) = nav_state.complete_navigation() {
        info!("Turn completed - updating CurrentPage to: {}", new_room.name);

        // Update game state with new room
        game_state.room = new_room;

        // Force re-render of CurrentPage texture
        render_state.last_content_hash = 0;

        // Reset NextPage to placeholder
        let placeholder = "~ Next Page ~\n\n(Turn the page to continue...)".to_string();
        let placeholder_image = sdf_renderer.render_to_image(&placeholder);

        for (entity, page_texture, material_handle) in next_page_query.iter() {
            let old_handle = page_texture.texture_handle.clone();
            let new_texture_handle = images.add(placeholder_image.clone());

            if let Some(material) = materials.get_mut(&material_handle.0) {
                material.base_color_texture = Some(new_texture_handle.clone());
            }

            commands.entity(entity).insert(PageTexture {
                texture_handle: new_texture_handle
            });

            images.remove(&old_handle);
        }
    }

    // Reset curl state for next turn
    curl_state.reset_after_turn();
    info!("Page reset - ready for next navigation");
}

/// Component marking an entity that has a text texture
#[derive(Component)]
pub struct PageTexture {
    pub texture_handle: Handle<Image>,
}

/// Resource tracking when we need to re-render text
#[derive(Resource, Default)]
pub struct TextRenderState {
    /// Hash of the last rendered content (to avoid re-rendering unchanged content)
    pub last_content_hash: u64,
    /// Last time we rendered an animated effect
    pub last_animation_render: f32,
    /// Whether we need to re-render
    pub needs_update: bool,
    /// Vertical scroll offset in pixels (positive = scrolled down)
    pub scroll_offset: f32,
    /// Maximum scroll offset (calculated based on content height)
    pub max_scroll: f32,
}

/// Setup the initial page texture (runs in Update until it finds pages)
fn setup_page_texture_deferred(
    mut commands: Commands,
    mut images: ResMut<Assets<Image>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    text_renderer: Res<TextRenderer>,
    game_state: Option<Res<GameState>>,
    render_state: Res<TextRenderState>,
    // Find pages that DON'T have PageTexture yet
    page_query: Query<Entity, (With<crate::book::Page>, Without<PageTexture>)>,
) {
    // Skip if no pages need texturing
    if page_query.is_empty() {
        return;
    }

    info!("setup_page_texture_deferred: found {} pages needing texture", page_query.iter().count());

    // Render initial content
    let content = game_state
        .map(|gs| text_renderer.format_room_content(&gs))
        .unwrap_or_else(|| "Welcome to Loka".to_string());

    info!("Rendering text content ({} chars)", content.len());

    let image = text_renderer.render_to_image(&content);
    info!("Created texture: {}x{}", image.width(), image.height());

    let texture_handle = images.add(image);

    // Create material with the text texture
    let page_material = materials.add(StandardMaterial {
        base_color: Color::WHITE,
        base_color_texture: Some(texture_handle.clone()),
        unlit: false,
        alpha_mode: AlphaMode::Blend,
        double_sided: true,
        cull_mode: None,
        ..default()
    });

    // Apply texture to all pages that need it
    for entity in page_query.iter() {
        info!("Applying text texture to page entity {:?}", entity);
        commands.entity(entity)
            .insert(PageTexture { texture_handle: texture_handle.clone() })
            .insert(MeshMaterial3d(page_material.clone()));
    }

    info!("Page texture setup complete!");
}

/// Update page texture when game state changes
fn update_page_texture(
    mut images: ResMut<Assets<Image>>,
    text_renderer: Res<TextRenderer>,
    game_state: Option<Res<GameState>>,
    mut render_state: ResMut<TextRenderState>,
    page_query: Query<&PageTexture, With<crate::book::Page>>,
) {
    let Some(game_state) = game_state else { return };

    // Check if content changed
    let content = text_renderer.format_room_content(&game_state);
    let content_hash = hash_string(&content);

    if content_hash == render_state.last_content_hash {
        return; // No change, skip re-render
    }

    // Re-render the text
    let image = text_renderer.render_to_image(&content);

    // Update the texture
    for page_texture in page_query.iter() {
        if let Some(texture) = images.get_mut(&page_texture.texture_handle) {
            *texture = image.clone();
        }
    }

    render_state.last_content_hash = content_hash;
    info!("Page texture updated for room: {}", game_state.room.name);
}

/// Simple string hash for change detection
fn hash_string(s: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

/// A span of styled text
#[derive(Clone, Debug)]
pub struct TextSpan {
    pub text: String,
    pub style: TextStyle,
}

/// Text styling options
#[derive(Clone, Debug, Default)]
pub struct TextStyle {
    pub color: Option<Color>,
    pub bold: bool,
    pub italic: bool,
    pub size_multiplier: f32,
}

impl TextStyle {
    pub fn title() -> Self {
        Self {
            bold: true,
            size_multiplier: 1.5,
            ..default()
        }
    }

    pub fn heading() -> Self {
        Self {
            bold: true,
            size_multiplier: 1.2,
            ..default()
        }
    }

    pub fn link() -> Self {
        Self {
            color: Some(Color::srgb(0.3, 0.2, 0.5)), // Purple-ish for links
            ..default()
        }
    }
}

/// A clickable link region (for tap detection)
#[derive(Clone, Debug)]
pub struct LinkRegion {
    pub text: String,
    pub action_id: String,
    /// Bounding box in UV coordinates (0-1 range)
    pub bounds: Rect,
}

/// Resource storing all link regions for the current page
#[derive(Resource, Default, Debug)]
pub struct PageLinkRegions {
    /// List of clickable links on the current page
    pub regions: Vec<LinkRegion>,
}

impl PageLinkRegions {
    /// Clear all link regions
    pub fn clear(&mut self) {
        self.regions.clear();
    }

    /// Add a link region
    pub fn add(&mut self, text: String, action_id: String, bounds: Rect) {
        self.regions.push(LinkRegion {
            text,
            action_id,
            bounds,
        });
    }

    /// Hit test a UV coordinate against all link regions
    /// Returns the action_id if a link was hit
    pub fn hit_test(&self, uv: Vec2) -> Option<String> {
        for region in &self.regions {
            if region.bounds.contains(uv) {
                return Some(region.action_id.clone());
            }
        }
        None
    }
}
