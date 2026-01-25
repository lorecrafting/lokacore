//! Book rendering module
//!
//! Handles the 3D book mesh, page curling animation, and materials.

mod mesh;
mod curl;
mod material;

pub use mesh::*;
pub use curl::*;
pub use material::*;

use bevy::prelude::*;

/// Plugin for book rendering systems
pub struct BookPlugin;

impl Plugin for BookPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<PageCurlState>()
            .add_systems(Startup, setup_book)
            .add_systems(Update, (
                store_original_mesh_data,
                update_page_curl,
                apply_curl_to_mesh,
            ).chain());
    }
}

/// Marker component for the book entity
#[derive(Component)]
pub struct Book;

/// Marker component for a page entity
#[derive(Component)]
pub struct Page {
    /// Page index (0 = front, 1 = back, etc.)
    pub index: u32,
}

/// Marker for the "current" page that curls
#[derive(Component)]
pub struct CurrentPage;

/// Marker for the "next" page underneath (doesn't curl)
#[derive(Component)]
pub struct NextPage;

/// Animation phase for page turning
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum TurnPhase {
    #[default]
    Idle,
    /// Main turn - page lifts and rotates
    Turning,
    /// Page settles back down after turn
    Settling,
}

/// Resource tracking page curl state with 3-phase animation
#[derive(Resource)]
pub struct PageCurlState {
    /// Current curl amount (0.0 = flat, 1.0 = fully turned)
    pub curl_amount: f32,
    /// Target curl amount
    pub target_curl: f32,
    /// Current animation phase
    pub phase: TurnPhase,
    /// Time in current phase
    pub phase_time: f32,
    /// Flutter/ripple intensity (0.0 to 1.0)
    pub flutter: f32,
    /// Page lift amount (how high the page rises)
    pub lift: f32,
    /// Flag set when turn completes (for other systems to react)
    pub turn_just_completed: bool,
}

impl Default for PageCurlState {
    fn default() -> Self {
        Self {
            curl_amount: 0.0,
            target_curl: 0.0,
            phase: TurnPhase::Idle,
            phase_time: 0.0,
            flutter: 0.0,
            lift: 0.0,
            turn_just_completed: false,
        }
    }
}

impl PageCurlState {
    /// Start a page turn animation
    pub fn start_turn(&mut self, forward: bool) {
        self.target_curl = if forward { 1.0 } else { 0.0 };
        self.phase = TurnPhase::Turning;
        self.phase_time = 0.0;
        self.turn_just_completed = false;
    }

    /// Reset page to flat after turn completed and was processed
    pub fn reset_after_turn(&mut self) {
        self.curl_amount = 0.0;
        self.target_curl = 0.0;
        self.turn_just_completed = false;
    }
}

/// Set up the initial book scene
fn setup_book(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    config: Option<Res<crate::BookConfig>>,
) {
    let config = config.map(|c| c.clone()).unwrap_or_default();

    // Create page mesh
    let page_mesh = create_page_mesh(
        config.page_width,
        config.page_height,
        config.page_subdivisions,
    );

    // Create paper-like material - aged parchment style
    // Based on "Wandering Library" reference: warm tan/cream
    let page_material = materials.add(create_paper_material(
        paper_colors::aged_parchment()
    ));

    // Create mesh handles - we need separate instances for each page
    let current_page_mesh = meshes.add(page_mesh.clone());
    let next_page_mesh = meshes.add(page_mesh);

    // Create materials - separate for different textures
    let current_page_material = materials.add(create_paper_material(
        paper_colors::aged_parchment()
    ));
    let next_page_material = materials.add(create_paper_material(
        paper_colors::aged_parchment()
    ));

    // Spawn the book entity with pages
    commands.spawn((
        Book,
        Name::new("Book"),
        Transform::default(),
        Visibility::default(),
    )).with_children(|parent| {
        // Spawn the "next" page FIRST (underneath, so rendered first)
        // Positioned slightly below the current page
        parent.spawn((
            Page { index: 1 },
            NextPage,
            Name::new("Next Page"),
            Mesh3d(next_page_mesh),
            MeshMaterial3d(next_page_material),
            Transform::from_xyz(0.0, -0.01, 0.0),  // Slightly below
        ));

        // Spawn the "current" page (on top, curls during turn)
        parent.spawn((
            Page { index: 0 },
            CurrentPage,
            Name::new("Current Page"),
            Mesh3d(current_page_mesh),
            MeshMaterial3d(current_page_material),
            Transform::from_xyz(0.0, 0.0, 0.0),
        ));
    });

    info!("Book setup complete with 2 pages, {}x{} subdivisions",
          config.page_subdivisions, config.page_subdivisions);
}

/// Easing function: ease-out cubic for natural deceleration
fn ease_out_cubic(t: f32) -> f32 {
    1.0 - (1.0 - t).powi(3)
}

/// Easing function: ease-in-out for smooth acceleration/deceleration
fn ease_in_out_cubic(t: f32) -> f32 {
    if t < 0.5 {
        4.0 * t * t * t
    } else {
        1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
    }
}

/// Update page curl based on 3-phase animation state
fn update_page_curl(
    time: Res<Time>,
    mut curl_state: ResMut<PageCurlState>,
) {
    let dt = time.delta_secs();
    curl_state.phase_time += dt;

    match curl_state.phase {
        TurnPhase::Idle => {
            // Gradually reduce flutter when idle
            curl_state.flutter = (curl_state.flutter - dt * 3.0).max(0.0);
            curl_state.lift = (curl_state.lift - dt * 2.0).max(0.0);
        }
        TurnPhase::Turning => {
            // Phase 1: Main turn animation (~1.2 seconds)
            let turn_duration = 1.2;
            let progress = (curl_state.phase_time / turn_duration).min(1.0);
            let eased = ease_in_out_cubic(progress);

            // Interpolate curl amount
            let start = if curl_state.target_curl > 0.5 { 0.0 } else { 1.0 };
            curl_state.curl_amount = start + (curl_state.target_curl - start) * eased;

            // Page lifts during middle of turn (arc shape)
            curl_state.lift = (progress * std::f32::consts::PI).sin() * 0.4;

            // Flutter increases during turn, peaks at middle
            curl_state.flutter = (progress * std::f32::consts::PI).sin() * 0.8;

            if progress >= 1.0 {
                curl_state.phase = TurnPhase::Settling;
                curl_state.phase_time = 0.0;
            }
        }
        TurnPhase::Settling => {
            // Phase 2: Page settles (~0.4 seconds)
            let settle_duration = 0.4;
            let progress = (curl_state.phase_time / settle_duration).min(1.0);
            let eased = ease_out_cubic(progress);

            // Reduce lift and flutter
            curl_state.lift = 0.4 * (1.0 - eased);
            curl_state.flutter = 0.3 * (1.0 - eased);

            // Small bounce at the end
            let bounce = (progress * std::f32::consts::PI * 2.0).sin() * 0.02 * (1.0 - progress);
            curl_state.curl_amount = curl_state.target_curl + bounce;

            if progress >= 1.0 {
                curl_state.phase = TurnPhase::Idle;
                curl_state.curl_amount = curl_state.target_curl;
                curl_state.lift = 0.0;
                curl_state.flutter = 0.0;
                curl_state.turn_just_completed = true;
                info!("Page turn completed");
            }
        }
    }
}

/// Demo animation for spike - triggers page turns periodically
fn animate_page_curl_demo(
    time: Res<Time>,
    mut curl_state: ResMut<PageCurlState>,
) {
    // Only trigger new turns when idle
    if curl_state.phase != TurnPhase::Idle {
        return;
    }

    // Turn every 3 seconds
    let t = time.elapsed_secs();
    let cycle = (t / 3.0) as u32;
    let should_be_turned = cycle % 2 == 1;

    let is_turned = curl_state.curl_amount > 0.5;
    if should_be_turned != is_turned {
        curl_state.start_turn(should_be_turned);
    }
}
