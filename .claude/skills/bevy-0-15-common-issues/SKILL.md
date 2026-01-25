---
name: bevy-0-15-common-issues
description: |
  Fix common Bevy 0.15 rendering and animation issues. Use when: (1) black screen
  on startup with "TonyMcMapFace tonemapping requires tonemapping_luts" error,
  (2) mesh not visible despite being spawned, (3) animation/physics values stuck
  at zero when using #[derive(Default)], (4) back faces of mesh not rendering,
  (5) CPU-based vertex deformation accumulating errors. Covers tonemapping,
  materials, Default trait gotchas, and mesh manipulation patterns.
author: Claude Code
version: 1.0.0
date: 2025-01-25
tags: [bevy, rust, game-engine, rendering, debugging]
---

# Bevy 0.15 Common Issues & Fixes

## Problem
Several non-obvious issues can cause Bevy 0.15 apps to render incorrectly or behave unexpectedly, especially for developers new to the engine.

## Context / Trigger Conditions

### Issue 1: Black Screen with Tonemapping Error
- **Symptom**: Window opens but shows only black, nothing renders
- **Error in console**: `TonyMcMapFace tonemapping requires the tonemapping_luts feature`
- **Cause**: Default Camera3d uses TonyMcMapFace which requires LUT textures

### Issue 2: Animation/Speed Values Stuck at Zero
- **Symptom**: Animation or physics don't move despite code running
- **Pattern**: Using `#[derive(Resource, Default)]` on structs with f32 speed/rate fields
- **Cause**: Rust's Default trait gives 0.0 for f32, making multiplications zero

### Issue 3: Back Faces Not Rendering
- **Symptom**: Mesh disappears when viewed from behind, or only one side visible
- **Cause**: Need BOTH `double_sided: true` AND `cull_mode: None`

### Issue 4: CPU Mesh Deformation Accumulates Errors
- **Symptom**: Mesh gets progressively distorted over time
- **Cause**: Applying transforms to already-transformed vertices instead of originals

## Solution

### Fix 1: Tonemapping - Use Reinhard Instead
```rust
use bevy::core_pipeline::tonemapping::Tonemapping;

commands.spawn((
    Camera3d::default(),
    Tonemapping::Reinhard,  // Doesn't require LUT feature
    Transform::from_xyz(0.0, 2.0, 5.0)
        .looking_at(Vec3::ZERO, Vec3::Y),
));
```

Alternative: Add `tonemapping_luts` feature to Cargo.toml (increases binary size).

### Fix 2: Explicit Default for Resource Structs
```rust
// BAD - curl_speed will be 0.0!
#[derive(Resource, Default)]
pub struct AnimationState {
    pub value: f32,
    pub speed: f32,  // Defaults to 0.0
}

// GOOD - explicit Default with sensible values
#[derive(Resource)]
pub struct AnimationState {
    pub value: f32,
    pub speed: f32,
}

impl Default for AnimationState {
    fn default() -> Self {
        Self {
            value: 0.0,
            speed: 2.0,  // Non-zero default!
        }
    }
}
```

### Fix 3: Double-Sided Materials
```rust
let material = materials.add(StandardMaterial {
    base_color: Color::srgb(0.8, 0.7, 0.6),
    double_sided: true,  // Required
    cull_mode: None,     // Also required!
    ..default()
});
```

### Fix 4: Store Original Vertices for CPU Deformation
```rust
// Component to store original mesh data
#[derive(Component)]
pub struct OriginalMeshData {
    pub positions: Vec<[f32; 3]>,
    pub normals: Vec<[f32; 3]>,
}

// System to capture originals when entity spawns
fn store_original_mesh_data(
    mut commands: Commands,
    meshes: Res<Assets<Mesh>>,
    query: Query<(Entity, &Mesh3d), Without<OriginalMeshData>>,
) {
    for (entity, mesh_handle) in query.iter() {
        if let Some(mesh) = meshes.get(&mesh_handle.0) {
            // Extract and clone original positions
            let positions = extract_positions(mesh);
            let normals = extract_normals(mesh);

            commands.entity(entity).insert(OriginalMeshData {
                positions,
                normals,
            });
        }
    }
}

// Deformation system - always transform from originals
fn deform_mesh(
    mut meshes: ResMut<Assets<Mesh>>,
    query: Query<(&Mesh3d, &OriginalMeshData)>,
) {
    for (mesh_handle, original) in query.iter() {
        if let Some(mesh) = meshes.get_mut(&mesh_handle.0) {
            // Transform from ORIGINAL positions, not current
            let new_positions: Vec<[f32; 3]> = original
                .positions
                .iter()
                .map(|&pos| transform_vertex(pos))
                .collect();

            mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, new_positions);
        }
    }
}
```

## Verification

### Issue 1 (Tonemapping)
- No error in console about tonemapping_luts
- Scene renders with proper colors

### Issue 2 (Default values)
- Add debug logging: `info!("speed: {}", state.speed);`
- Should show non-zero value

### Issue 3 (Double-sided)
- Rotate camera to view mesh from both sides
- Both faces should be visible

### Issue 4 (Mesh deformation)
- Run animation for extended period
- Mesh should return to exact original state when reset

## Example: Minimal Working 3D Scene

```rust
use bevy::prelude::*;
use bevy::core_pipeline::tonemapping::Tonemapping;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_systems(Startup, setup)
        .run();
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    // Camera with Reinhard tonemapping
    commands.spawn((
        Camera3d::default(),
        Tonemapping::Reinhard,
        Transform::from_xyz(0.0, 2.0, 5.0)
            .looking_at(Vec3::ZERO, Vec3::Y),
    ));

    // Light
    commands.spawn((
        DirectionalLight {
            illuminance: 10000.0,
            ..default()
        },
        Transform::from_xyz(5.0, 10.0, 5.0)
            .looking_at(Vec3::ZERO, Vec3::Y),
    ));

    // Double-sided mesh
    commands.spawn((
        Mesh3d(meshes.add(Plane3d::default().mesh().size(2.0, 2.0))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgb(0.8, 0.7, 0.6),
            double_sided: true,
            cull_mode: None,
            ..default()
        })),
    ));
}
```

## Notes

- These issues are specific to Bevy 0.15; API may change in future versions
- The tonemapping issue doesn't occur with Camera2d
- For production, consider moving CPU mesh deformation to a vertex shader
- When using `init_resource::<T>()`, it calls `T::default()` - be aware of what that returns

## References

- [Bevy 0.15 Migration Guide](https://bevyengine.org/learn/migration-guides/0-14-to-0-15/)
- [Bevy StandardMaterial docs](https://docs.rs/bevy/0.15/bevy/pbr/struct.StandardMaterial.html)
- [Bevy Tonemapping options](https://docs.rs/bevy/0.15/bevy/core_pipeline/tonemapping/enum.Tonemapping.html)
