//! Test Application for Book Renderer
//!
//! This is a standalone visual test app for developing and verifying
//! the book rendering without needing React Native integration.
//!
//! ## Running
//! ```bash
//! cd book-client
//! cargo run --bin test-app
//! ```
//!
//! ## Controls
//! - ESC: Quit
//! - SPACE: Trigger page turn animation
//! - Arrow keys: Navigate rooms (N/E/S/W)
//! - R: Reset to starting room
//!
//! ## What to Verify
//! 1. Window opens with 3D view
//! 2. Page mesh is visible (parchment colored quad)
//! 3. Page curl animation is smooth when navigating
//! 4. Room info logged to console when navigating

use bevy::prelude::*;
use bevy::core_pipeline::tonemapping::Tonemapping;
use bevy::core_pipeline::bloom::Bloom;
use bevy::diagnostic::{DiagnosticsStore, FrameTimeDiagnosticsPlugin};
use loka_book::{
    BookConfig, LokaBookPlugin,
    book::{PageCurlState, TurnPhase, CurrentPage},
    content::{self, GameState, Room, GameEvent, EventType, NavigationState},
    text::{SdfTextRenderer, TextEffect, PageTexture},
    effects::{FireTextMaterial, IceTextMaterial, FireRegionMaterial, IceRegionMaterial, TextRegion},
    input::LinkTapEvent,
};

fn main() {
    println!("===========================================");
    println!("  Loka Book Renderer - Test Application");
    println!("===========================================");
    println!();
    println!("Controls:");
    println!("  ESC         - Quit");
    println!("  SPACE       - Trigger page turn");
    println!("  Arrow UP    - Go North");
    println!("  Arrow DOWN  - Go South");
    println!("  Arrow LEFT  - Go West");
    println!("  Arrow RIGHT - Go East");
    println!("  R           - Reset to courtyard");
    println!();
    println!("Text Effects (CPU - re-renders texture):");
    println!("  1           - Normal text (sepia ink)");
    println!("  2           - FIRE effect");
    println!("  3           - ICE effect");
    println!("  4           - GLOW effect (magic)");
    println!("  5           - SPIRIT effect (ghostly)");
    println!();
    println!("GPU Shader Effects (60fps, production quality):");
    println!("  F           - GPU FIRE shader (full page)");
    println!("  I           - GPU ICE shader (full page)");
    println!("  G           - Back to standard material");
    println!();
    println!("Region Shaders (title only):");
    println!("  Shift+F     - Fire effect on title region");
    println!("  Shift+I     - Ice effect on title region");
    println!();
    println!("Test World Layout:");
    println!("                  [Temple]");
    println!("                     |");
    println!("  [Garden] -- [Courtyard] -- [Training Hall]");
    println!("                     |");
    println!("                 [Library]");
    println!();

    App::new()
        // Bevy default plugins (window, rendering, etc.)
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Loka Book - Test App".to_string(),
                resolution: (800.0, 600.0).into(),
                ..default()
            }),
            ..default()
        }))

        // Frame rate diagnostics
        .add_plugins(FrameTimeDiagnosticsPlugin)

        // Book configuration
        .insert_resource(BookConfig {
            page_width: 2.0,
            page_height: 3.0,
            page_subdivisions: 32,
            text_texture_size: 1024,
        })

        // Our book plugin (includes SdfTextPlugin for effect support)
        .add_plugins(LokaBookPlugin)

        // Game state with test world
        .insert_resource(content::get_initial_game_state())

        // Test app systems
        .add_systems(Startup, (setup_test_scene, log_current_room))
        .add_systems(Update, (
            handle_navigation_input,
            handle_link_tap,
            handle_effect_input,
            handle_gpu_shader_input,
            display_debug_info,
        ))

        .run();
}

/// Set up the test scene with camera and lighting
fn setup_test_scene(mut commands: Commands) {
    // Camera positioned to view the book - closer for better view
    // Using TonyMcMapface tonemapping which works well with bloom
    // Bloom::NATURAL gives a subtle, realistic glow effect
    commands.spawn((
        Camera3d::default(),
        Tonemapping::TonyMcMapface,
        Bloom::NATURAL,
        Transform::from_xyz(0.0, 1.5, 3.0)
            .looking_at(Vec3::new(0.0, 0.0, 0.0), Vec3::Y),
    ));

    // Main directional light
    commands.spawn((
        DirectionalLight {
            illuminance: 10000.0,
            shadows_enabled: false,
            ..default()
        },
        Transform::from_xyz(5.0, 10.0, 5.0)
            .looking_at(Vec3::ZERO, Vec3::Y),
    ));

    // Ambient light for fill
    commands.insert_resource(AmbientLight {
        color: Color::WHITE,
        brightness: 500.0,
    });

    info!("Test scene setup complete");
}

/// Log the current room info
fn log_current_room(game_state: Res<GameState>) {
    log_room(&game_state.room);
    log_events(&game_state.events);
}

/// Log room details to console (simulates what will be rendered)
fn log_room(room: &Room) {
    println!();
    println!("╔════════════════════════════════════════════════════╗");
    println!("║ {}",  room.name);
    println!("╠════════════════════════════════════════════════════╣");
    println!("║");

    // Word-wrap description
    for line in word_wrap(&room.description, 52) {
        println!("║ {}", line);
    }

    println!("║");

    // NPCs
    if !room.npcs.is_empty() {
        println!("║ ── Characters ──");
        for npc in &room.npcs {
            println!("║  • {} - {}", npc.name, truncate(&npc.short_desc, 40));
        }
        println!("║");
    }

    // Items
    if !room.items.is_empty() {
        println!("║ ── Items ──");
        for item in &room.items {
            println!("║  • {} - {}", item.name, truncate(&item.short_desc, 40));
        }
        println!("║");
    }

    // Exits
    println!("║ ── Exits ──");
    for exit in &room.exits {
        let label = exit.label.as_deref().unwrap_or(&exit.direction);
        let locked = if exit.locked { " [LOCKED]" } else { "" };
        println!("║  → {} ({}){}", label, exit.direction.to_uppercase(), locked);
    }

    println!("║");
    println!("╚════════════════════════════════════════════════════╝");
}

/// Log game events (simulates the scrolling feed)
fn log_events(events: &[GameEvent]) {
    if events.is_empty() {
        return;
    }

    println!();
    println!("┌─ Event Feed ─────────────────────────────────────┐");
    for event in events.iter().rev().take(4) {
        let prefix = match event.event_type {
            EventType::Narration => "  ",
            EventType::Speech => "💬",
            EventType::System => "⚙️",
            EventType::Combat => "⚔️",
            EventType::Action => "→ ",
            EventType::Ambient => "🍃",
        };
        println!("│ {} {}", prefix, truncate(&event.text, 46));
    }
    println!("└──────────────────────────────────────────────────┘");
}

/// Handle keyboard input for room navigation
fn handle_navigation_input(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut game_state: ResMut<GameState>,
    mut curl_state: ResMut<PageCurlState>,
    mut nav_state: ResMut<NavigationState>,
    time: Res<Time>,
    mut exit: EventWriter<AppExit>,
) {
    // Quit
    if keyboard.just_pressed(KeyCode::Escape) {
        info!("Exiting test app");
        exit.send(AppExit::Success);
    }

    // Don't process movement if we're in the middle of a page turn
    if curl_state.phase != TurnPhase::Idle {
        return;
    }

    // Map arrow keys to directions
    let direction = if keyboard.just_pressed(KeyCode::ArrowUp) {
        Some("north")
    } else if keyboard.just_pressed(KeyCode::ArrowDown) {
        Some("south")
    } else if keyboard.just_pressed(KeyCode::ArrowLeft) {
        Some("west")
    } else if keyboard.just_pressed(KeyCode::ArrowRight) {
        Some("east")
    } else if keyboard.just_pressed(KeyCode::Space) {
        // Manual page turn trigger (for testing)
        curl_state.start_turn(true);
        info!("Manual page turn triggered");
        None
    } else if keyboard.just_pressed(KeyCode::KeyR) {
        // Reset to starting room
        *game_state = content::get_initial_game_state();
        nav_state.pending_room = None;
        nav_state.next_page_ready = false;
        log_room(&game_state.room);
        info!("Reset to courtyard");
        None
    } else {
        None
    };

    // Try to navigate
    if let Some(dir) = direction {
        if let Some(room_exit) = game_state.room.exits.iter().find(|e| e.direction == dir) {
            if room_exit.locked {
                info!("That way is locked.");
                game_state.events.push(GameEvent {
                    id: (time.elapsed_secs() * 1000.0) as u64,
                    event_type: EventType::System,
                    text: "That way is locked.".into(),
                    timestamp: time.elapsed_secs(),
                });
            } else if let Some(new_room) = content::get_room(&room_exit.destination) {
                let old_room_name = game_state.room.name.clone();
                let new_room_name = new_room.name.clone();

                // Add movement event
                game_state.events.push(content::movement_event(
                    &old_room_name,
                    &new_room_name,
                    time.elapsed_secs(),
                ));

                // Log what we're doing
                log_room(&new_room);
                log_events(&game_state.events);
                info!("Navigating {} to {}", dir, new_room_name);

                // Set up navigation: destination room will be rendered to NextPage
                nav_state.start_navigation(new_room);

                // Start the page turn animation
                // The destination room will show on NextPage as the current page curls away
                curl_state.start_turn(true);
            }
        } else {
            info!("You can't go {} from here.", dir);
            game_state.events.push(GameEvent {
                id: (time.elapsed_secs() * 1000.0) as u64,
                event_type: EventType::System,
                text: format!("You can't go {} from here.", dir),
                timestamp: time.elapsed_secs(),
            });
        }
    }
}

/// Handle link taps on the page (click on NPCs, items, exits)
fn handle_link_tap(
    mut link_events: EventReader<LinkTapEvent>,
    mut game_state: ResMut<GameState>,
    mut curl_state: ResMut<PageCurlState>,
    mut nav_state: ResMut<NavigationState>,
    time: Res<Time>,
) {
    for event in link_events.read() {
        info!("Handling link tap: {}", event.action);

        // Parse the action (format: "type:key")
        let parts: Vec<&str> = event.action.splitn(2, ':').collect();
        if parts.len() != 2 {
            warn!("Invalid action format: {}", event.action);
            continue;
        }

        let (action_type, key) = (parts[0], parts[1]);

        match action_type {
            "exit" => {
                // Navigate to the room in that direction
                if curl_state.phase != TurnPhase::Idle {
                    info!("Cannot navigate - page turn in progress");
                    continue;
                }

                if let Some(room_exit) = game_state.room.exits.iter().find(|e| e.direction == key) {
                    if room_exit.locked {
                        info!("That way is locked.");
                        game_state.events.push(GameEvent {
                            id: (time.elapsed_secs() * 1000.0) as u64,
                            event_type: EventType::System,
                            text: "That way is locked.".into(),
                            timestamp: time.elapsed_secs(),
                        });
                    } else if let Some(new_room) = content::get_room(&room_exit.destination) {
                        let old_room_name = game_state.room.name.clone();
                        let new_room_name = new_room.name.clone();

                        game_state.events.push(content::movement_event(
                            &old_room_name,
                            &new_room_name,
                            time.elapsed_secs(),
                        ));

                        log_room(&new_room);
                        log_events(&game_state.events);
                        info!("Navigating via link tap to {}", new_room_name);

                        nav_state.start_navigation(new_room);
                        curl_state.start_turn(true);
                    }
                }
            }
            "entity" => {
                // Clicked on an NPC
                let npc_name = game_state.room.npcs.iter()
                    .find(|n| n.key == key)
                    .map(|n| n.name.clone());

                if let Some(name) = npc_name {
                    info!("Interacted with entity: {}", name);
                    game_state.events.push(GameEvent {
                        id: (time.elapsed_secs() * 1000.0) as u64,
                        event_type: EventType::Action,
                        text: format!("You approach {}.", name),
                        timestamp: time.elapsed_secs(),
                    });
                    log_events(&game_state.events);
                }
            }
            "item" => {
                // Clicked on an item
                let item_name = game_state.room.items.iter()
                    .find(|i| i.key == key)
                    .map(|i| i.name.clone());

                if let Some(name) = item_name {
                    info!("Interacted with item: {}", name);
                    game_state.events.push(GameEvent {
                        id: (time.elapsed_secs() * 1000.0) as u64,
                        event_type: EventType::Action,
                        text: format!("You examine the {}.", name),
                        timestamp: time.elapsed_secs(),
                    });
                    log_events(&game_state.events);
                }
            }
            _ => {
                warn!("Unknown action type: {}", action_type);
            }
        }
    }
}

/// Handle keyboard input for text effects
fn handle_effect_input(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut sdf_renderer: ResMut<SdfTextRenderer>,
    mut render_state: ResMut<loka_book::text::TextRenderState>,
) {
    let new_effect = if keyboard.just_pressed(KeyCode::Digit1) {
        Some(TextEffect::None)
    } else if keyboard.just_pressed(KeyCode::Digit2) {
        Some(TextEffect::Fire { intensity: 0.8 })
    } else if keyboard.just_pressed(KeyCode::Digit3) {
        Some(TextEffect::Ice { frost_level: 0.7 })
    } else if keyboard.just_pressed(KeyCode::Digit4) {
        Some(TextEffect::Glow {
            color: [0.6, 0.3, 0.9], // Purple magic
            intensity: 1.0,
        })
    } else if keyboard.just_pressed(KeyCode::Digit5) {
        Some(TextEffect::Spirit { opacity: 0.7 })
    } else {
        None
    };

    if let Some(effect) = new_effect {
        sdf_renderer.effect = effect;
        // Force texture re-render by changing hash
        render_state.last_content_hash = 0;
        info!("Text effect changed to: {:?}", effect);
    }
}

/// Handle GPU shader material switching (F for fire, I for ice, G for standard)
fn handle_gpu_shader_input(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut commands: Commands,
    mut fire_materials: ResMut<Assets<FireTextMaterial>>,
    mut ice_materials: ResMut<Assets<IceTextMaterial>>,
    mut fire_region_materials: ResMut<Assets<FireRegionMaterial>>,
    mut ice_region_materials: ResMut<Assets<IceRegionMaterial>>,
    mut std_materials: ResMut<Assets<StandardMaterial>>,
    current_page_query: Query<(Entity, &PageTexture), With<CurrentPage>>,
) {
    let shift_pressed = keyboard.pressed(KeyCode::ShiftLeft) || keyboard.pressed(KeyCode::ShiftRight);

    if keyboard.just_pressed(KeyCode::KeyF) {
        if shift_pressed {
            // Shift+F: Fire effect on title region only
            for (entity, page_texture) in current_page_query.iter() {
                let fire_region_mat = fire_region_materials.add(
                    FireRegionMaterial::new(page_texture.texture_handle.clone(), TextRegion::title())
                        .with_intensity(1.5)
                );

                commands.entity(entity)
                    .remove::<MeshMaterial3d<StandardMaterial>>()
                    .remove::<MeshMaterial3d<IceTextMaterial>>()
                    .remove::<MeshMaterial3d<FireTextMaterial>>()
                    .remove::<MeshMaterial3d<IceRegionMaterial>>()
                    .remove::<MeshMaterial3d<FireRegionMaterial>>()
                    .insert(MeshMaterial3d(fire_region_mat));

                info!("Switched to Fire Region shader (title only)");
            }
        } else {
            // F: Full page fire shader
            for (entity, page_texture) in current_page_query.iter() {
                let fire_mat = fire_materials.add(FireTextMaterial {
                    base_texture: page_texture.texture_handle.clone(),
                    intensity: 1.2,
                    speed: 1.0,
                });

                commands.entity(entity)
                    .remove::<MeshMaterial3d<StandardMaterial>>()
                    .remove::<MeshMaterial3d<IceTextMaterial>>()
                    .remove::<MeshMaterial3d<FireTextMaterial>>()
                    .remove::<MeshMaterial3d<IceRegionMaterial>>()
                    .remove::<MeshMaterial3d<FireRegionMaterial>>()
                    .insert(MeshMaterial3d(fire_mat));

                info!("Switched to GPU Fire shader (full page)");
            }
        }
    }

    if keyboard.just_pressed(KeyCode::KeyI) {
        if shift_pressed {
            // Shift+I: Ice effect on title region only
            for (entity, page_texture) in current_page_query.iter() {
                let ice_region_mat = ice_region_materials.add(
                    IceRegionMaterial::new(page_texture.texture_handle.clone(), TextRegion::title())
                        .with_intensity(1.5)
                );

                commands.entity(entity)
                    .remove::<MeshMaterial3d<StandardMaterial>>()
                    .remove::<MeshMaterial3d<FireTextMaterial>>()
                    .remove::<MeshMaterial3d<IceTextMaterial>>()
                    .remove::<MeshMaterial3d<FireRegionMaterial>>()
                    .remove::<MeshMaterial3d<IceRegionMaterial>>()
                    .insert(MeshMaterial3d(ice_region_mat));

                info!("Switched to Ice Region shader (title only)");
            }
        } else {
            // I: Full page ice shader
            for (entity, page_texture) in current_page_query.iter() {
                let ice_mat = ice_materials.add(IceTextMaterial {
                    base_texture: page_texture.texture_handle.clone(),
                    intensity: 1.2,
                    speed: 0.8,
                });

                commands.entity(entity)
                    .remove::<MeshMaterial3d<StandardMaterial>>()
                    .remove::<MeshMaterial3d<FireTextMaterial>>()
                    .remove::<MeshMaterial3d<IceTextMaterial>>()
                    .remove::<MeshMaterial3d<FireRegionMaterial>>()
                    .remove::<MeshMaterial3d<IceRegionMaterial>>()
                    .insert(MeshMaterial3d(ice_mat));

                info!("Switched to GPU Ice shader (full page)");
            }
        }
    }

    if keyboard.just_pressed(KeyCode::KeyG) {
        // Switch back to standard material
        for (entity, page_texture) in current_page_query.iter() {
            let std_mat = std_materials.add(StandardMaterial {
                base_color: Color::WHITE,
                base_color_texture: Some(page_texture.texture_handle.clone()),
                unlit: false,
                alpha_mode: AlphaMode::Blend,
                double_sided: true,
                cull_mode: None,
                ..default()
            });

            // Remove all shader materials and add standard
            commands.entity(entity)
                .remove::<MeshMaterial3d<FireTextMaterial>>()
                .remove::<MeshMaterial3d<IceTextMaterial>>()
                .remove::<MeshMaterial3d<FireRegionMaterial>>()
                .remove::<MeshMaterial3d<IceRegionMaterial>>()
                .insert(MeshMaterial3d(std_mat));

            info!("Switched back to standard material");
        }
    }
}

/// Display debug information
fn display_debug_info(
    diagnostics: Res<DiagnosticsStore>,
    curl_state: Res<PageCurlState>,
    game_state: Res<GameState>,
) {
    static mut FRAME_COUNT: u32 = 0;
    unsafe {
        FRAME_COUNT += 1;
        if FRAME_COUNT % 120 == 0 {
            if let Some(fps) = diagnostics
                .get(&bevy::diagnostic::FrameTimeDiagnosticsPlugin::FPS)
                .and_then(|d| d.smoothed())
            {
                debug!(
                    "FPS: {:.1} | Room: {} | Phase: {:?}",
                    fps,
                    game_state.room.name,
                    curl_state.phase,
                );
            }
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Simple word wrap
fn word_wrap(text: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for paragraph in text.split('\n') {
        let words: Vec<&str> = paragraph.split_whitespace().collect();
        let mut current_line = String::new();

        for word in words {
            if current_line.is_empty() {
                current_line = word.to_string();
            } else if current_line.len() + 1 + word.len() <= width {
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

/// Truncate string with ellipsis
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}
