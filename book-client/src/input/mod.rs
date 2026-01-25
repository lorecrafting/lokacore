//! Input handling module
//!
//! Handles touch/click input and maps screen coordinates to UV coordinates
//! on the curved book page surface.

use bevy::prelude::*;
use bevy::window::PrimaryWindow;
use bevy::render::mesh::{Indices, VertexAttributeValues};

use crate::book::CurrentPage;
use crate::text::PageLinkRegions;

pub struct InputPlugin;

impl Plugin for InputPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<TapState>()
            .add_event::<PageTapEvent>()
            .add_event::<LinkTapEvent>()
            .add_systems(Update, (handle_mouse_click, handle_scroll_input));
        info!("InputPlugin initialized with tap detection and scrolling");
    }
}

/// Result of a tap/click on the book
#[derive(Clone, Debug)]
pub enum TapResult {
    /// Tapped on a link
    Link { action: String },
    /// Tapped on the page but not a link
    Page { uv: Vec2 },
    /// Tapped outside the book
    Miss,
}

/// Event fired when the page is tapped
#[derive(Event, Clone, Debug)]
pub struct PageTapEvent {
    /// UV coordinate on the page (0-1 range)
    pub uv: Vec2,
    /// Screen position of the tap
    pub screen_pos: Vec2,
}

/// Event fired when a link is tapped
#[derive(Event, Clone, Debug)]
pub struct LinkTapEvent {
    /// The action ID of the tapped link (e.g., "entity:elder_ming", "exit:north")
    pub action: String,
    /// UV coordinate where the tap occurred
    pub uv: Vec2,
}

/// Resource tracking tap state
#[derive(Resource, Default)]
pub struct TapState {
    /// Last tap result (for debugging)
    pub last_tap: Option<TapResult>,
}

/// Handle mouse clicks and convert to UV coordinates on the page
fn handle_mouse_click(
    mouse_button: Res<ButtonInput<MouseButton>>,
    windows: Query<&Window, With<PrimaryWindow>>,
    cameras: Query<(&Camera, &GlobalTransform)>,
    page_query: Query<(&GlobalTransform, &Mesh3d), With<CurrentPage>>,
    meshes: Res<Assets<Mesh>>,
    link_regions: Res<PageLinkRegions>,
    mut tap_state: ResMut<TapState>,
    mut tap_events: EventWriter<PageTapEvent>,
    mut link_tap_events: EventWriter<LinkTapEvent>,
) {
    // Only process on click
    if !mouse_button.just_pressed(MouseButton::Left) {
        return;
    }

    let Ok(window) = windows.get_single() else { return };
    let Some(cursor_pos) = window.cursor_position() else { return };
    let Ok((camera, camera_transform)) = cameras.get_single() else { return };

    // Cast ray from camera through cursor position
    let Ok(ray) = camera.viewport_to_world(camera_transform, cursor_pos) else {
        tap_state.last_tap = Some(TapResult::Miss);
        return;
    };

    // Check intersection with page mesh
    for (page_transform, mesh_handle) in page_query.iter() {
        let Some(mesh) = meshes.get(&mesh_handle.0) else { continue };

        if let Some(uv) = ray_mesh_intersection(&ray, page_transform, mesh) {
            // Check if we hit a link
            if let Some(action) = link_regions.hit_test(uv) {
                info!("Link tapped: {} at UV: ({:.3}, {:.3})", action, uv.x, uv.y);
                tap_state.last_tap = Some(TapResult::Link { action: action.clone() });
                link_tap_events.send(LinkTapEvent {
                    action: action.clone(),
                    uv,
                });
                tap_events.send(PageTapEvent {
                    uv,
                    screen_pos: cursor_pos,
                });
                return;
            }

            // No link hit, just page tap
            info!("Page tapped at UV: ({:.3}, {:.3})", uv.x, uv.y);
            tap_state.last_tap = Some(TapResult::Page { uv });
            tap_events.send(PageTapEvent {
                uv,
                screen_pos: cursor_pos,
            });
            return;
        }
    }

    tap_state.last_tap = Some(TapResult::Miss);
}

/// Ray-mesh intersection to find UV coordinate
/// Returns Some(uv) if ray hits the mesh, None otherwise
fn ray_mesh_intersection(
    ray: &Ray3d,
    mesh_transform: &GlobalTransform,
    mesh: &Mesh,
) -> Option<Vec2> {
    // Get mesh data
    let positions = mesh.attribute(Mesh::ATTRIBUTE_POSITION)?;
    let uvs = mesh.attribute(Mesh::ATTRIBUTE_UV_0)?;
    let indices = mesh.indices()?;

    let positions = match positions {
        VertexAttributeValues::Float32x3(p) => p,
        _ => return None,
    };

    let uvs = match uvs {
        VertexAttributeValues::Float32x2(u) => u,
        _ => return None,
    };

    let indices: Vec<u32> = match indices {
        Indices::U32(i) => i.clone(),
        Indices::U16(i) => i.iter().map(|&x| x as u32).collect(),
    };

    // Transform ray to mesh local space
    let inv_transform = mesh_transform.compute_matrix().inverse();
    let local_origin = inv_transform.transform_point3(ray.origin);
    let local_dir = inv_transform.transform_vector3(*ray.direction).normalize();

    let mut closest_t = f32::MAX;
    let mut closest_uv = None;

    // Test each triangle
    for tri in indices.chunks(3) {
        let i0 = tri[0] as usize;
        let i1 = tri[1] as usize;
        let i2 = tri[2] as usize;

        let v0 = Vec3::from(positions[i0]);
        let v1 = Vec3::from(positions[i1]);
        let v2 = Vec3::from(positions[i2]);

        if let Some((t, u, v)) = ray_triangle_intersection(local_origin, local_dir, v0, v1, v2) {
            if t > 0.0 && t < closest_t {
                closest_t = t;

                // Interpolate UV using barycentric coordinates
                let uv0 = Vec2::from(uvs[i0]);
                let uv1 = Vec2::from(uvs[i1]);
                let uv2 = Vec2::from(uvs[i2]);

                let w = 1.0 - u - v;
                closest_uv = Some(uv0 * w + uv1 * u + uv2 * v);
            }
        }
    }

    closest_uv
}

/// Möller–Trumbore ray-triangle intersection
/// Returns Some((t, u, v)) where t is distance and (u,v) are barycentric coords
fn ray_triangle_intersection(
    origin: Vec3,
    dir: Vec3,
    v0: Vec3,
    v1: Vec3,
    v2: Vec3,
) -> Option<(f32, f32, f32)> {
    const EPSILON: f32 = 0.0001;

    let edge1 = v1 - v0;
    let edge2 = v2 - v0;

    let h = dir.cross(edge2);
    let a = edge1.dot(h);

    if a.abs() < EPSILON {
        return None; // Ray parallel to triangle
    }

    let f = 1.0 / a;
    let s = origin - v0;
    let u = f * s.dot(h);

    if u < 0.0 || u > 1.0 {
        return None;
    }

    let q = s.cross(edge1);
    let v = f * dir.dot(q);

    if v < 0.0 || u + v > 1.0 {
        return None;
    }

    let t = f * edge2.dot(q);

    if t > EPSILON {
        Some((t, u, v))
    } else {
        None
    }
}

/// Handle scroll input (Page Up/Down, Arrow Up/Down)
fn handle_scroll_input(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut render_state: ResMut<crate::text::TextRenderState>,
) {
    const SCROLL_SPEED: f32 = 50.0; // pixels per keypress

    let mut scroll_delta = 0.0;

    // Page Up/Down for larger scrolls
    if keyboard.just_pressed(KeyCode::PageUp) {
        scroll_delta = -200.0;
    }
    if keyboard.just_pressed(KeyCode::PageDown) {
        scroll_delta = 200.0;
    }

    // Arrow Up/Down for fine scrolling
    if keyboard.pressed(KeyCode::ArrowUp) {
        scroll_delta -= SCROLL_SPEED;
    }
    if keyboard.pressed(KeyCode::ArrowDown) {
        scroll_delta += SCROLL_SPEED;
    }

    if scroll_delta != 0.0 {
        render_state.scroll_offset += scroll_delta;
        render_state.scroll_offset = render_state.scroll_offset.clamp(0.0, render_state.max_scroll);

        // Force re-render with new scroll offset
        render_state.needs_update = true;

        debug!("Scroll offset: {} (max: {})", render_state.scroll_offset, render_state.max_scroll);
    }
}
