# Proposal: Rust-Based "Diegetic Book" Mobile Client

**Status:** Draft
**Author:** Architecture Review
**Date:** 2025-01-24
**Priority:** Future / R&D

## Executive Summary

This proposal evaluates building a high-fidelity mobile client in Rust where the **entire game UI exists as a 3D rendered book** within a game world. The book features shader-driven page curling, dynamic text rendering to GPU textures, and visual effects (fire, ice, weather) applied directly to the text and pages.

**Key Finding:** The concept is technically achievable. With future 3D world extensibility in mind (avatar reading the book, zooming out to 3D combat), **Bevy is recommended over raw wgpu** to leverage its ECS architecture and physics integration.

**Estimated Effort:** 6-8 months for MVP, single developer

---

## Table of Contents

1. [Vision & Inspiration](#vision--inspiration)
2. [Technical Feasibility Analysis](#technical-feasibility-analysis)
3. [Architecture Decisions](#architecture-decisions)
4. [Text-to-Texture Pipeline](#1-text-to-texture-pipeline)
5. [Curved Surface Interaction](#2-curved-surface-interaction)
6. [Mobile Integration (Rust + React Native)](#3-mobile-integration-rust--react-native)
7. [Server Protocol for VFX](#4-server-protocol-for-vfx)
8. [Shader Effects Library](#5-shader-effects-library)
9. [Physics Engine Considerations](#6-physics-engine-considerations)
10. [Future Extensibility: 3D World](#7-future-extensibility-3d-world)
11. [Sound Architecture](#8-sound-architecture)
12. [Effort Estimation](#9-effort-estimation)
13. [Risk Assessment](#10-risk-assessment)
14. [Phased Implementation Plan](#11-phased-implementation-plan)
15. [Decision: Go/No-Go](#12-decision)
16. [World Events & Social Effects](#13-world-events--social-effects)
17. [Death System: Spirit Walk](#14-death-system-spirit-walk--resurrection-stone--bardo)

---

## Vision & Inspiration

### The "North Star" Feature: Diegetic UI

The UI is not a flat 2D overlay. The entire game interface exists **inside a 3D rendered book** within the game world:

- Text log, stats, and inventory rendered as **ink on book pages**
- Pages support **vertex-shader-driven curling/bending** (page turns, wind effects)
- Visual effects (fire, frost, blood) applied via **shaders on the text/page mesh**
- The book exists in a 3D space that can be **zoomed out** to reveal a larger world

### Reference: MegaBook (Unity)

The [MegaBook Unity Asset](https://assetstore.unity.com/packages/tools/modeling/megabook-17826) demonstrates the core book mechanics:

- Procedural page mesh generation
- Natural page turning animation with bezier curves
- Multiple pages with content textures
- Physics-based page interaction

Our implementation extends this with:
- Real-time text rendering (not static textures)
- Shader-based VFX on text
- Integration with game server events
- Future 3D world extensibility

### Future Vision: Beyond the Book

The architecture should support future expansion:

1. **Book in World**: The book exists in a 3D environment (desk, forest, temple)
2. **Avatar Reading**: A character holds the book, occasionally lowering it to rest
3. **Combat Breakout**: During combat, camera zooms out, book closes, 3D combat plays
4. **Environmental Storytelling**: Weather affects both book and surrounding world

---

## Technical Feasibility Analysis

### Summary Table

| Component | Feasibility | Complexity | Notes |
|-----------|-------------|------------|-------|
| Text-to-texture pipeline | ✅ Proven | ⭐⭐⭐⭐ | cosmic-text handles layout |
| Page curl shaders | ✅ Proven | ⭐⭐⭐ | Standard vertex shader technique |
| Click on curved surface | ✅ Solvable | ⭐⭐⭐ | UV lookup texture approach |
| Rust + React Native bridge | ✅ Mature | ⭐⭐⭐ | uniffi-bindgen-react-native |
| VFX shaders (fire/ice/etc) | ✅ Proven | ⭐⭐⭐ | Well-documented GLSL patterns |
| Physics for pages | ✅ Available | ⭐⭐ | Rapier or simple spring system |
| 3D world extensibility | ✅ Possible | ⭐⭐⭐⭐⭐ | Requires Bevy, not raw wgpu |
| Mobile performance | ⚠️ Requires tuning | ⭐⭐⭐ | 60fps achievable with care |

---

## Architecture Decisions

### Decision 1: Bevy vs Raw wgpu

**Original Recommendation (Book Only):** Raw wgpu for maximum control

**Revised Recommendation (With 3D Extensibility):** **Bevy**

| Factor | Raw wgpu | Bevy |
|--------|----------|------|
| Control over rendering | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 3D scene management | Manual | ⭐⭐⭐⭐⭐ Built-in |
| Physics integration | Manual (Rapier) | ⭐⭐⭐⭐⭐ bevy_rapier |
| Asset loading | Manual | ⭐⭐⭐⭐⭐ Built-in |
| Animation system | Manual | ⭐⭐⭐⭐ Built-in |
| Mobile support | ⭐⭐⭐⭐ Good | ⭐⭐⭐ Usable |
| Learning curve | ⭐⭐⭐ Steep | ⭐⭐⭐⭐ Moderate |
| Future 3D world | ⭐⭐ Hard to add | ⭐⭐⭐⭐⭐ Native |

**Recommendation:** Use Bevy. The 3D world extensibility is a strategic differentiator worth the mobile complexity trade-off. [bevy-in-app](https://github.com/jinleili/bevy-in-app) demonstrates the integration pattern.

### Decision 2: Networking Location

**React Native handles WebSocket (recommended)**

```
React Native (JS)          Rust (Bevy)
├── Phoenix WebSocket  ──→  Render commands
├── Game state store   ──→  Effect triggers
├── Audio playback     ──→  (visuals only)
└── Keyboard input     ──→  Text updates
```

This means:
- **No tokio needed** in Rust module
- Simpler FFI (synchronous calls only)
- Existing Phoenix connection preserved
- Single source of truth for game state

### Decision 3: Physics Engine

**Use Rapier (via bevy_rapier)**

For the book alone, simple spring physics suffices. But for 3D world extensibility:

```rust
// bevy_rapier3d for physics
use bevy_rapier3d::prelude::*;

// Page physics: soft body or spring constraints
// Character physics: rigid body + character controller
// Combat: collision detection, projectiles
```

[Rapier](https://rapier.rs/) is the standard Rust physics engine:
- Pure Rust, cross-platform
- 2D and 3D support
- Bevy plugin available
- Active development

---

## 1. Text-to-Texture Pipeline

### The Challenge

Render MUD-style text (colors, bold, clickable links, word-wrap, scrolling) to a GPU texture mapped onto a curved 3D page.

### Recommended Stack

| Library | Purpose | Why |
|---------|---------|-----|
| [cosmic-text](https://github.com/pop-os/cosmic-text) | Text shaping + layout | Production-proven (Pop!_OS), handles complex layout |
| swash | Glyph rasterization | Bundled with cosmic-text |
| wgpu texture | GPU upload | Standard pattern |

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ INPUT: Game events with text + formatting                           │
│ "You strike the [goblin]!" + {link: "goblin", color: red}          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ LAYOUT ENGINE (cosmic-text)                                         │
│ - Parse formatting spans                                            │
│ - Calculate line breaks at texture width                            │
│ - Track glyph positions for link hit-testing                        │
│ - Handle scroll offset                                              │
│                                                                     │
│ Output: Vec<PositionedGlyph>, Vec<LinkRegion>                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ RASTERIZATION (swash)                                               │
│ - Rasterize glyphs to CPU buffer                                    │
│ - Apply color per span                                              │
│ - Composite onto page texture                                       │
│                                                                     │
│ Output: RGBA pixel buffer (1024x2048 or 2048x2048)                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ GPU UPLOAD                                                          │
│ - Dirty region tracking (only update changed tiles)                 │
│ - Texture atlas for multi-page books                                │
│                                                                     │
│ Output: wgpu::Texture bound to page material                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Performance Considerations

| Operation | Cost | Mitigation |
|-----------|------|------------|
| Full text re-layout | 2-5ms | Only on text change |
| Full texture upload | 3-8ms | Dirty region updates |
| Per-frame render | <1ms | GPU-bound, efficient |

**Mobile target:** 60fps (16.6ms budget). Text updates are event-driven, not per-frame.

---

## 2. Curved Surface Interaction

### The Problem

When a vertex shader curls the page, the GPU knows geometry positions but the CPU (input handling) doesn't. How do we detect "clicking a link" on curved text?

### Solution: UV Lookup Texture

```
┌─────────────────────────────────────────────────────────────────────┐
│ RENDER PASS 1: UV Lookup Generation                                 │
│                                                                     │
│ Fragment shader outputs UV coordinates as RGB:                      │
│   R = U coordinate (0.0-1.0)                                        │
│   G = V coordinate (0.0-1.0)                                        │
│   B = 1.0 if on page, 0.0 if background                             │
│                                                                     │
│ Render to 512x512 texture (adequate for tap detection)              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ON TAP: Screen Position → UV Lookup                                 │
│                                                                     │
│ fn handle_tap(screen_x, screen_y) -> Option<LinkAction> {           │
│     let pixel = uv_lookup_texture.sample(screen_x, screen_y);       │
│     if pixel.b < 0.5 { return None; } // Not on page                │
│                                                                     │
│     let uv = Vec2::new(pixel.r, pixel.g);                           │
│     links.iter().find(|link| link.bounds.contains(uv))              │
│ }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Advantages

- O(1) lookup per tap
- No CPU/GPU math synchronization issues
- Works with any deformation shader
- Resolution-independent (pixel-perfect not needed for taps)

### When to Regenerate

- On page curl animation changes
- On window resize
- NOT per frame (cache it)

---

## 3. Mobile Integration (Rust + React Native)

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  React Native App (TypeScript)                                      │
├─────────────────────────────────────────────────────────────────────┤
│  ├── Phoenix WebSocket Client (existing)                            │
│  ├── Game State Store (Zustand/Context)                             │
│  ├── expo-av (audio playback)                                       │
│  ├── Keyboard Input Handling                                        │
│  └── Settings/Login UI                                              │
│                                                                     │
│              │ uniffi-bindgen-react-native                          │
│              ▼                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Rust/Bevy Native Module (.so / .dylib)                       │  │
│  │                                                                │  │
│  │  #[uniffi::export]                                             │  │
│  │  fn update_text(lines: Vec<TextLine>) { ... }                  │  │
│  │  fn apply_effect(effect: VfxEffect) { ... }                    │  │
│  │  fn set_page_curl(amount: f32) { ... }                         │  │
│  │  fn get_tap_target(x: f32, y: f32) -> Option<String> { ... }   │  │
│  │                                                                │  │
│  │  Internal:                                                     │  │
│  │  - Bevy App (headless, renders to surface)                     │  │
│  │  - cosmic-text for layout                                      │  │
│  │  - Shader effects system                                       │  │
│  │  - bevy_rapier for physics (future)                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│                          ▼                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Native Surface                                                │  │
│  │  iOS: CAMetalLayer                                             │  │
│  │  Android: SurfaceView (Vulkan/GLES)                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Integration: uniffi-bindgen-react-native

[Mozilla's UniFFI for React Native](https://hacks.mozilla.org/2024/12/introducing-uniffi-for-react-native-rust-powered-turbo-modules/) (released December 2024) simplifies the bridge:

```rust
// Rust side
#[derive(uniffi::Record)]
pub struct TextLine {
    pub text: String,
    pub color: String,
    pub effects: Vec<String>,
}

#[derive(uniffi::Enum)]
pub enum VfxEffect {
    Fire { intensity: f32 },
    Ice { intensity: f32 },
    ScreenShake { intensity: f32, duration: f32 },
}

#[uniffi::export]
pub fn render_text(lines: Vec<TextLine>) { /* ... */ }

#[uniffi::export]
pub fn apply_vfx(effect: VfxEffect) { /* ... */ }
```

```typescript
// TypeScript side (auto-generated)
import { renderText, applyVfx, VfxEffect } from 'loka-book-renderer';

channel.on('event', (payload) => {
  renderText(payload.lines);
  if (payload.vfx) {
    payload.vfx.forEach(vfx => applyVfx(vfx));
  }
});
```

### Build System

| Platform | Toolchain | Notes |
|----------|-----------|-------|
| iOS | Cargo + Xcode + cbindgen | [wgpu-in-app](https://github.com/jinleili/wgpu-in-app) pattern |
| Android | Cargo + NDK + Gradle | Target aarch64-linux-android |

**Estimated setup time:** 1-2 weeks for working pipeline

---

## 4. Server Protocol for VFX

### Current State

The server sends events with text but no VFX metadata:

```typescript
// Current GameEvent
interface GameEvent {
  text: string;
  type?: 'normal' | 'combat' | 'system' | 'chat' | 'quest';
}
```

### Proposed Enhancement

Add optional `vfx` array without breaking existing clients:

```typescript
interface GameEvent {
  text: string;
  type?: 'normal' | 'combat' | 'system' | 'chat' | 'quest';

  // NEW: Visual effect hints
  vfx?: VfxHint[];
}

interface VfxHint {
  effect: VfxEffectType;
  intensity?: number;           // 0.0-1.0
  duration?: number;            // seconds
  text_range?: { start: number; end: number };  // which text
  origin?: { x: number; y: number };            // for directional
}

type VfxEffectType =
  // Text effects
  | 'text_fire' | 'text_ice' | 'text_lightning' | 'text_poison'
  | 'text_phase_in' | 'text_phase_out'
  | 'text_aura_gold' | 'text_aura_purple' | 'text_aura_divine'
  // Page effects
  | 'page_burn' | 'page_wet' | 'page_frozen' | 'page_bloody'
  // Environmental overlays
  | 'weather_rain' | 'weather_snow' | 'weather_fog' | 'weather_blizzard'
  // Screen effects
  | 'screen_shake' | 'screen_flash_white' | 'screen_flash_red';
```

### Server-Side Changes

In `lib/loka/framework/combat/damage_message.ex`:

```elixir
# Add VFX hints based on damage type
def generate(damage, attacker, defender, opts) do
  damage_type = Keyword.get(opts, :damage_type, :melee)
  element = Keyword.get(opts, :element)

  messages = generate_text(damage, attacker, defender, opts)

  # NEW: Generate VFX based on element
  vfx = case element do
    :fire -> [%{effect: "text_fire", intensity: min(1.0, damage / 50)}]
    :ice -> [%{effect: "text_ice", intensity: min(1.0, damage / 50)}]
    :lightning -> [%{effect: "text_lightning", intensity: 0.8}]
    _ -> [%{effect: "damage_physical", intensity: min(1.0, damage / 30)}]
  end

  Map.put(messages, :vfx, vfx)
end
```

### Backwards Compatibility

- `vfx` field is optional
- React Native client ignores it (continues working)
- Book client uses it for effects
- Web client could use it for CSS animations (future)

---

## 5. Shader Effects Library

### Text Effects

#### Fire on Text

```wgsl
@fragment
fn fs_fire(in: VertexOutput) -> @location(0) vec4<f32> {
    let text = textureSample(text_texture, sampler, in.uv);
    if (text.a < 0.1) { return vec4<f32>(0.0); }

    // Animated noise for fire movement
    let noise_uv = in.uv + vec2<f32>(0.0, -time * 0.5);
    let noise = perlin_noise(noise_uv * 10.0);

    // Fire gradient: yellow core → orange → red edge
    let fire_height = 1.0 - in.uv.y + noise * 0.3;
    let fire = mix(
        vec4<f32>(1.0, 0.9, 0.3, 1.0),
        vec4<f32>(1.0, 0.3, 0.0, 0.0),
        fire_height
    );

    return mix(text, fire, intensity);
}
```

**Visual:** Text appears to burn, flames lick upward

#### Ice/Freeze Effect

```wgsl
@fragment
fn fs_ice(in: VertexOutput) -> @location(0) vec4<f32> {
    let text = textureSample(text_texture, sampler, in.uv);

    // Frost crystal pattern
    let crystal = voronoi_noise(in.uv * 20.0);
    let ice_tint = vec4<f32>(0.7, 0.9, 1.0, 1.0);

    var color = mix(text, ice_tint, intensity * 0.6);
    color = mix(color, vec4<f32>(1.0), crystal * intensity * 0.4);

    return color;
}
```

**Visual:** Text tints blue, frost crystals spread across letters

#### Phase In/Out (Magical)

```wgsl
@fragment
fn fs_phase(in: VertexOutput) -> @location(0) vec4<f32> {
    let text = textureSample(text_texture, sampler, in.uv);

    // Wave reveal pattern
    let wave = sin(in.uv.x * 10.0 + time * 3.0) * 0.5 + 0.5;
    let reveal = smoothstep(phase - 0.2, phase + 0.2, in.uv.x + wave * 0.1);

    // Sparkle at boundary
    let sparkle = step(0.98, fract(in.uv.x * 50.0 + time * 5.0));
    let sparkle_color = vec4<f32>(1.0, 0.9, 0.6, 1.0) * sparkle * (1.0 - reveal);

    var color = text;
    color.a *= reveal;
    return color + sparkle_color;
}
```

**Visual:** Text materializes with sweeping magical wave

#### Aura/Glow

```wgsl
@fragment
fn fs_aura(in: VertexOutput) -> @location(0) vec4<f32> {
    let text = textureSample(text_texture, sampler, in.uv);

    // Multi-sample blur for glow
    var glow = vec4<f32>(0.0);
    for (var i = 0; i < 8; i++) {
        glow += textureSample(text_texture, sampler, in.uv + offsets[i] * blur_size);
    }
    glow /= 8.0;

    // Pulsing aura
    let pulse = sin(time * 2.0) * 0.3 + 0.7;
    return glow * aura_color * pulse * 2.0 + text;
}
```

**Visual:** Text has pulsing colored glow

### Page Effects

#### Paper Burning

```wgsl
@fragment
fn fs_paper_burn(in: VertexOutput) -> @location(0) vec4<f32> {
    let dist = distance(in.uv, burn_origin);
    let noise = perlin_noise(in.uv * 15.0);
    let burn_edge = burn_progress + noise * 0.1;

    if (dist < burn_edge - 0.05) {
        return vec4<f32>(0.0); // Burned through (hole)
    } else if (dist < burn_edge) {
        // Charred edge with ember glow
        let ember = vec4<f32>(1.0, 0.3, 0.0, 1.0);
        let glow = sin(time * 5.0 + in.uv.x * 20.0) * 0.5 + 0.5;
        return mix(vec4<f32>(0.1, 0.05, 0.0, 1.0), ember, glow * 0.5);
    }

    return page_color;
}
```

**Visual:** Paper burns from origin point, charred edges glow

#### Rain on Page

```wgsl
@fragment
fn fs_rain(in: VertexOutput) -> @location(0) vec4<f32> {
    var color = textureSample(page_texture, sampler, in.uv);

    // Droplets
    let rain_uv = in.uv * vec2<f32>(30.0, 15.0);
    let cell = floor(rain_uv);
    let rand = hash(cell);
    let drop_pos = vec2<f32>(rand.x, fract(rand.y - time * 0.5));

    if (distance(fract(rain_uv), drop_pos) < 0.1) {
        color = color * 0.85 + vec4<f32>(0.1, 0.1, 0.15, 0.0);
    }

    return color;
}
```

**Visual:** Water droplets appear and run down page

#### Fog Overlay

```wgsl
@fragment
fn fs_fog(in: VertexOutput) -> @location(0) vec4<f32> {
    let page = textureSample(page_texture, sampler, in.uv);

    // Layered noise for fog
    var fog = 0.0;
    for (var i = 0; i < 4; i++) {
        let scale = pow(2.0, f32(i));
        fog += perlin_noise(in.uv * scale + time * 0.1 / scale) / scale;
    }

    let fog_color = vec4<f32>(0.8, 0.85, 0.9, fog * density);
    return mix(page, fog_color, fog_color.a);
}
```

**Visual:** Wispy fog drifts across page

### Screen Effects

#### Screen Shake

```rust
// Camera-level, not shader
fn apply_shake(shake: &ScreenShake, camera: &mut Transform) {
    let decay = 1.0 - (shake.elapsed / shake.duration);
    let offset_x = (shake.elapsed * shake.frequency).sin() * shake.intensity * decay;
    let offset_y = (shake.elapsed * shake.frequency * 1.3).cos() * shake.intensity * decay;

    camera.translation.x += offset_x;
    camera.translation.y += offset_y;
}
```

---

## 6. Physics Engine Considerations

### Do We Need Physics?

| Use Case | Physics Needed? | Solution |
|----------|-----------------|----------|
| Page curl animation | No | Vertex shader math |
| Natural page flip | Maybe | Simple spring/damping |
| Page collision (stacking) | Yes | Rapier rigid bodies |
| 3D character movement | Yes | Rapier character controller |
| Combat projectiles | Yes | Rapier sensors + velocity |
| Particle physics | No | GPU particle system |

### Recommendation: Include Rapier from Start

Even if not using full physics initially, [bevy_rapier](https://rapier.rs/docs/user_guides/bevy_plugin/getting_started_bevy/) provides:

1. **Collision detection** for 3D world interactions
2. **Character controller** for avatar movement
3. **Sensors** for trigger volumes
4. **Joints/constraints** for connected objects

```rust
use bevy_rapier3d::prelude::*;

fn setup_physics(mut commands: Commands) {
    // Book as static collider
    commands.spawn((
        RigidBody::Fixed,
        Collider::cuboid(1.0, 0.1, 1.5),
        BookComponent,
    ));

    // Page with soft-body physics (future)
    // Character with controller (future 3D world)
}
```

### Page Physics (Simple Approach)

For natural page behavior without full physics:

```rust
struct PageSpring {
    target_curl: f32,      // Where page wants to be
    current_curl: f32,     // Where page is
    velocity: f32,         // Current motion
    stiffness: f32,        // Spring constant
    damping: f32,          // Friction
}

fn update_page_spring(spring: &mut PageSpring, dt: f32) {
    let force = (spring.target_curl - spring.current_curl) * spring.stiffness;
    spring.velocity += force * dt;
    spring.velocity *= spring.damping;
    spring.current_curl += spring.velocity * dt;
}
```

This gives natural page settling without Rapier overhead.

---

## 7. Future Extensibility: 3D World

### Vision Scenarios

#### Scenario A: Book in Environment

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│     ┌─────────────┐                                                 │
│     │ 3D World    │  ← Atmospheric background                       │
│     │ (blurred)   │    (temple, forest, tavern)                     │
│     │             │                                                 │
│     │   ┌─────┐   │                                                 │
│     │   │Book │   │  ← Book in foreground, in focus                 │
│     │   │     │   │    Text readable, effects active                │
│     │   └─────┘   │                                                 │
│     └─────────────┘                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The book exists on a surface (desk, rock, altar) with an atmospheric 3D environment behind it. Environment changes based on room biome.

#### Scenario B: Avatar Reading

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│     Avatar holding book:           Avatar resting:                  │
│                                                                     │
│        ┌─────┐                         ╱──────╲                     │
│        │Book │                        │ Avatar │                    │
│        │     │  ← Book up,            │resting │                    │
│        └─────┘    text visible         ╲──────╱                     │
│          ╱╲                               │                         │
│         │  │                           ┌──┴──┐                      │
│         │  │  ← Avatar                 │Book │  ← Book down,        │
│                  holding               │     │    world visible     │
│                                        └─────┘                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Player character is visible holding the book. Periodically lowers book (idle animation), revealing full 3D world.

#### Scenario C: Combat Breakout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Normal Mode:              Combat Mode:                             │
│                                                                     │
│  ┌─────────────┐          ┌─────────────────────────────────────┐   │
│  │   Book      │          │        3D Combat Arena               │   │
│  │   View      │   ──→    │                                      │   │
│  │   (text)    │  camera  │   Player ⚔️ Enemy                     │   │
│  │             │   zooms  │                                      │   │
│  └─────────────┘   out    │   [Health bars] [Action buttons]    │   │
│                           └─────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Combat triggers camera to pull back, book closes/minimizes, 3D characters fight.

### Architecture for Extensibility

Using Bevy's ECS, scenes are composable:

```rust
// Scene states
#[derive(States, Default, Clone, Eq, PartialEq, Debug, Hash)]
enum GameScene {
    #[default]
    BookView,       // Book focused, text gameplay
    WorldView,      // Book down, environment visible
    CombatView,     // 3D combat arena
}

// Systems activate based on scene
fn book_systems(app: &mut App) {
    app.add_systems(Update, (
        update_text_texture,
        update_page_curl,
        apply_text_effects,
    ).run_if(in_state(GameScene::BookView)));
}

fn world_systems(app: &mut App) {
    app.add_systems(Update, (
        update_avatar_animation,
        update_environment,
        handle_world_interaction,
    ).run_if(in_state(GameScene::WorldView)));
}

fn combat_systems(app: &mut App) {
    app.add_systems(Update, (
        update_combat_animations,
        handle_combat_input,
        physics_combat,
    ).run_if(in_state(GameScene::CombatView)));
}
```

### Camera Transitions

```rust
fn transition_to_combat(
    mut camera: Query<&mut Transform, With<MainCamera>>,
    mut scene: ResMut<NextState<GameScene>>,
) {
    // Animate camera from book-focus to arena-wide
    // Lerp over 0.5 seconds
    // Book entity plays "close" animation
    // Arena entities fade in

    scene.set(GameScene::CombatView);
}
```

### 3D Asset Requirements (Future)

| Asset Type | Examples | Source |
|------------|----------|--------|
| Avatar model | Player character, rigged | Artist or asset store |
| Environments | Temple, forest, cave | Modular kit or procedural |
| Creatures | Combat enemies | Per creature type |
| Props | Desk, altar, campfire | Environment dressing |
| VFX | Spell particles, impacts | Procedural + textures |

**Note:** These are future investments. MVP is book-only.

---

## 8. Sound Architecture

### Recommendation: React Native Audio

Keep audio in React Native using expo-av:

```typescript
// Audio Manager (React Native side)
class AudioManager {
  private ambient: Map<string, Audio.Sound> = new Map();
  private effects: Map<string, Audio.Sound> = new Map();

  async playAmbient(key: string) {
    // Crossfade to new ambient
  }

  async playEffect(key: string) {
    // Fire-and-forget sound effect
  }

  async handleVisualState(visualState: VisualState) {
    // Update ambient based on biome, weather, time
  }
}

// On server event
channel.on('event', (payload) => {
  // Visual effects to Rust
  if (payload.vfx) {
    RustModule.applyVfx(payload.vfx);
  }

  // Audio effects in JS
  if (payload.vfx) {
    payload.vfx.forEach(vfx => {
      audioManager.playEffectForVfx(vfx);
    });
  }
});
```

### Sound Categories

| Category | Examples | Behavior |
|----------|----------|----------|
| Ambient | Forest birds, temple bells | Loop, crossfade on change |
| Weather | Rain, thunder, wind | Overlay, intensity varies |
| Effects | Sword clash, spell cast | One-shot, triggered |
| UI | Page turn, link click | One-shot, immediate |
| Music | Combat theme, exploration | Loop, fade transitions |

### Alternative: Rust Audio (kira)

If tighter audio-visual sync needed:

```rust
use kira::{
    manager::AudioManager,
    sound::static_sound::{StaticSoundData, StaticSoundSettings},
};

fn play_damage_sound(effect: &VfxEffect, audio: &mut AudioManager) {
    let sound = match effect {
        VfxEffect::Fire { intensity } => &fire_sounds[intensity_to_index(*intensity)],
        VfxEffect::Ice { intensity } => &ice_sounds[intensity_to_index(*intensity)],
        _ => return,
    };
    audio.play(sound.clone());
}
```

---

## 9. Effort Estimation

### Lines of Code Breakdown

| Module | LOC | Notes |
|--------|-----|-------|
| **Bevy setup + surface** | 600-800 | App, plugins, mobile integration |
| **Book mesh + materials** | 800-1000 | Procedural pages, UV mapping |
| **Page curl animation** | 400-600 | Vertex shader, spring physics |
| **Text pipeline** | 1200-1600 | cosmic-text, texture, links |
| **UV lookup system** | 300-400 | Click detection on curves |
| **Effect shaders** | 2000-3000 | Fire, ice, phase, aura, weather |
| **Effect compositor** | 500-800 | Blending, layering |
| **Screen effects** | 200-300 | Shake, flash |
| **React Native bridge** | 500-700 | uniffi, surface lifecycle |
| **State management** | 400-600 | Game state sync |
| **Total MVP** | **7000-10000 LOC** | |

### Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 0: Spike** | 3 weeks | Curved page + text + click on iOS |
| **Phase 1: Text** | 4-6 weeks | Full text pipeline, scrolling, links |
| **Phase 2: Effects** | 4-6 weeks | Fire, ice, phase, aura, weather shaders |
| **Phase 3: Integration** | 3-4 weeks | React Native bridge, Android |
| **Phase 4: Polish** | 4-6 weeks | Performance, edge cases, testing |
| **Total MVP** | **18-25 weeks** | ~5-7 months |

### Future Phases (Post-MVP)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 5: Environment | 4-6 weeks | 3D background world |
| Phase 6: Avatar | 4-6 weeks | Character model, animations |
| Phase 7: Combat 3D | 6-8 weeks | 3D combat breakout |

---

## 10. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Bevy mobile issues** | High | Medium | Early testing, [bevy-in-app](https://github.com/jinleili/bevy-in-app) pattern |
| **Text rendering perf** | High | Low | Dirty region updates, texture atlasing |
| **Shader complexity** | Medium | Medium | Start simple, iterate |
| **React Native bridge** | Medium | Low | UniFFI is mature |
| **Scope creep** | High | High | Strict phase gates |
| **Artist dependency** | Medium | Medium | Use procedural/placeholder for MVP |
| **Android fragmentation** | Medium | Medium | Focus on modern devices |

### Kill Switch Criteria

**Stop development if Phase 0 fails to achieve:**

1. ❌ wgpu renders to native surface
2. ❌ Page mesh curls smoothly
3. ❌ Text renders to texture at 30fps
4. ❌ Tap detection works on curved surface
5. ❌ Any of above on target device (not just simulator)

---

## 11. Phased Implementation Plan

### Phase 0: Proof of Concept (3 weeks)

**Goal:** Validate core technical assumptions

**Deliverables:**
- [ ] Bevy app renders to iOS CAMetalLayer
- [ ] Simple quad with page-curl vertex shader
- [ ] Static text ("Hello World") rendered to texture
- [ ] Tap on curved surface returns UV coordinate
- [ ] 30fps on iPhone 12 or equivalent

**Success Criteria:** All boxes checked, or identify blocking issue

### Phase 1: Text Pipeline (4-6 weeks)

**Goal:** Full text rendering with interaction

**Deliverables:**
- [ ] cosmic-text integration with formatting
- [ ] Scrolling text history
- [ ] Link regions tracked and tappable
- [ ] Color and style support
- [ ] Dirty region texture updates

### Phase 2: Effects Library (4-6 weeks)

**Goal:** Visual feedback for game events

**Deliverables:**
- [ ] Fire effect on text
- [ ] Ice effect on text
- [ ] Phase in/out animation
- [ ] Aura/glow effects
- [ ] Rain/weather overlay
- [ ] Screen shake
- [ ] Effect blending/layering

### Phase 3: Mobile Integration (3-4 weeks)

**Goal:** Full React Native integration

**Deliverables:**
- [ ] uniffi bindings working
- [ ] Android build pipeline
- [ ] Surface lifecycle handling
- [ ] Event flow from Phoenix → Rust
- [ ] Audio integration (React Native side)

### Phase 4: Polish (4-6 weeks)

**Goal:** Production-ready MVP

**Deliverables:**
- [ ] Performance optimization
- [ ] Memory profiling
- [ ] Edge case handling
- [ ] Error recovery
- [ ] Device testing matrix
- [ ] Documentation

---

## 12. Decision

### Recommendation: **Phased Go with Kill Switch**

The "Diegetic Book" concept is:
- ✅ Technically feasible
- ✅ Architecturally sound (with Bevy)
- ✅ Extensible to 3D world
- ⚠️ Significant investment (6-8 months)
- ⚠️ Novel (no direct precedent)

### Proceed If:

1. The book UI is a strategic differentiator for marketing
2. 6+ month timeline is acceptable
3. 3D world vision is part of long-term roadmap
4. Phase 0 spike succeeds

### Reconsider If:

1. Need to ship mobile client quickly
2. Existing React Native client is "good enough"
3. Phase 0 reveals blocking technical issues
4. Resource constraints emerge

### Alternative Paths

If this proposal is too ambitious:

| Alternative | Effort | Visual Quality | Extensibility |
|-------------|--------|----------------|---------------|
| React Native + Skia 2D | 2-3 months | ⭐⭐⭐ | Limited |
| Unity MegaBook | 4-5 months | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| This proposal (Rust/Bevy) | 6-8 months | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 13. World Events & Social Effects

### Design Philosophy

When something epic happens in the world, **everyone should feel it**. The book isn't just displaying text—it's a window into a living world that reacts to events.

### World Event Broadcasting

```
┌─────────────────────────────────────────────────────────────────────┐
│  SERVER: Player "Kairos" defeats the Ancient Dragon                 │
└─────────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ Kairos (hero) │ │ Nearby player │ │ Zone players  │
    │               │ │ (same room)   │ │ (adjacent)    │
    └───────────────┘ └───────────────┘ └───────────────┘
            │               │               │
            ▼               ▼               ▼
    - Epic screen shake   - Strong shake    - Mild rumble
    - Dragon spirit       - Dragon spirit   - Distant roar
      swirls YOUR book      passes by         echoes
    - Golden text glow    - Text flickers   - Text dims
    - Triumphant music    - Dramatic sting  - Ambient shift
```

### World Event Types

| Event Type | Trigger | Effects (Epicenter) |
|------------|---------|---------------------|
| `boss_defeated` | World boss killed | Dragon spirit, epic shake, gold glow |
| `first_kill` | Server-first achievement | Fanfare, banner unfurl, fireworks |
| `legendary_drop` | Legendary item found | Coin shower, golden rays |
| `earthquake` | Tectonic event | Heavy shake, cracks on page |
| `eclipse` | Solar/lunar eclipse | Darkness creeps in, stars appear |
| `magical_surge` | Ley line activation | Runes orbit book, energy crackles |
| `invasion_warning` | Monster raid incoming | Red vignette, warning horns |
| `festival_begins` | Seasonal event | Confetti, festive borders |

### Entity Spirits

3D ethereal creatures that appear around the book:

| Spirit | Appearance | Behavior |
|--------|------------|----------|
| **Dragon** | Serpentine, glowing scales | Coils around book, then ascends |
| **Phoenix** | Fire bird, trailing embers | Circles overhead, reborn animation |
| **Ancestor** | Translucent humanoid | Bows respectfully, fades |
| **Wolf pack** | Ghostly wolves | Run past in formation |
| **Fairy lights** | Tiny glowing orbs | Dance around page edges |
| **Death's shadow** | Hooded figure | Looms briefly during danger |

### Extended Effects Catalog

#### Combat & Damage
- Slash marks / puncture holes / cracks on page
- Blood splatter (drips down)
- Element-specific: burn marks, frost crystals, lightning arcs
- Shadow tendrils, holy radiance

#### Page & Book
- Page flutter (wind, spirits passing)
- Book slam (combat start/end)
- Page tear (story reveals)
- Ink bleed (water, emotion)
- Text rewrite (prophecy, time magic)
- Invisible ink reveal
- Gilded edges (legendary moments)

#### Screen-Wide
- Screen shake (scalable intensity)
- Screen crack overlay
- Vignette pulse (danger, low health)
- Color drain (death, despair)
- Chromatic aberration (disorientation)
- Tunnel vision (rage, focus)

#### Celebration
- Confetti burst
- Fireworks in background
- Fanfare light rays
- Trophy materializes
- Coin shower
- XP particle absorption

#### Creative Additions
- **Bookworm companion**: Small creature living in book spine, reacts to events
- **Living illustrations**: Map glows on discovery, monster eyes follow text
- **Marginalia**: Tiny monk drawings comment on events
- **Seasonal themes**: Page appearance changes with in-game seasons
- **Reputation manifestation**: Hero = gold edges, villain = burned edges

### Priority for Implementation

**MVP (Phase 2):** Fire, ice, lightning, screen shake, weather, damage indicators, level up
**Phase 4:** Dragon spirit, page effects, day/night, combat combos, death sequence
**Post-MVP:** Bookworm, living illustrations, marginalia, seasonal themes

---

## 14. Death System: Spirit Walk → Resurrection Stone → Bardo

Inspired by Ultima Online's ghost system, death becomes **gameplay** rather than a cutscene.

### Death Sequence Phases

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. DEATH MOMENT                                                    │
│     - Screen flash red → grayscale drain                            │
│     - "You have been slain..."                                      │
├─────────────────────────────────────────────────────────────────────┤
│  2. SPIRIT RISES (2 sec)                                            │
│     - Ghost wisps rise from death text                              │
│     - Book becomes translucent/ethereal                             │
│     - Blue-silver color palette                                     │
├─────────────────────────────────────────────────────────────────────┤
│  3. SPIRIT WALK (player controlled)                                 │
│     - Player can MOVE as ghost                                      │
│     - Can't interact with living NPCs                               │
│     - CAN see other ghosts, spirit-only content                     │
│     - Resurrection stones GLOW as beacons                           │
│     - "You sense a beacon of life to the north..."                  │
├─────────────────────────────────────────────────────────────────────┤
│  4. FIND & TOUCH RESURRECTION STONE                                 │
│     - Navigate to temple altar, ancient menhir, healer              │
│     - Touch stone triggers absorption animation                     │
│     - Spirit particles spiral into stone                            │
├─────────────────────────────────────────────────────────────────────┤
│  5. BARDO (brief, 5 sec)                                            │
│     - Mystical transition (shorter since player earned it)          │
│     - Optional visions/wisdom                                       │
├─────────────────────────────────────────────────────────────────────┤
│  6. RESURRECTION                                                    │
│     - Golden light floods pages                                     │
│     - Respawn at stone's location                                   │
│     - Brief protection aura                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Spirit Walk Visuals

**Book appearance while dead:**
- Pages semi-transparent (can see through)
- Blue-silver ethereal tint
- Edges shimmer with ghostly light
- Text appears in faded, ethereal font
- Dust motes/spirit particles visible

**Resurrection beacon:**
- Golden glow pulses from direction of nearest stone
- Light rays visible on page pointing toward stone
- Intensity increases as you get closer

### Spirit-Only Gameplay

| Feature | Description |
|---------|-------------|
| **Ghost NPCs** | Spirits who only talk to dead players |
| **Hidden paths** | Spirit-only passages, shortcuts |
| **Lore fragments** | Ancient writings visible only to ghosts |
| **Other players** | See/communicate with other dead players |
| **Memory echoes** | See past events replay in locations |

### Resurrection Stone Types

| Type | Location | Effect |
|------|----------|--------|
| Temple Altar | Towns | Safe, blessed protection |
| Ancient Menhir | Wilderness | Nature buff on res |
| Death Shrine | Graveyards | Longer spirit communion |
| Healer NPC | Various | Costs gold, instant |
| Blood Stone | Dark areas | Cursed but keep items |

### Optional: Corpse Run

- Corpse remains at death location with some items
- Spirit can return to corpse to reclaim before resurrection
- Adds risk/reward decision to death

---

## Appendix A: Technology Stack

### Rust Crates

```toml
[dependencies]
# Engine
bevy = { version = "0.15", default-features = false, features = [
    "bevy_render", "bevy_core_pipeline", "bevy_asset",
    "bevy_winit", "bevy_sprite", "x11"
] }
bevy_rapier3d = "0.32"  # Physics

# Text
cosmic-text = "0.12"

# FFI
uniffi = "0.28"

# Math
glam = "0.29"

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Utilities
log = "0.4"
```

### Build Tools

- Cargo + rust-analyzer
- Xcode 15+ (iOS)
- Android NDK r26+ (Android)
- uniffi-bindgen-react-native

---

## Appendix B: References

### Libraries & Tools

- [Bevy Engine](https://bevyengine.org/)
- [bevy-in-app](https://github.com/jinleili/bevy-in-app) - Mobile integration pattern
- [bevy_rapier](https://rapier.rs/docs/user_guides/bevy_plugin/getting_started_bevy/) - Physics
- [cosmic-text](https://github.com/pop-os/cosmic-text) - Text layout
- [wgpu](https://wgpu.rs/) - Graphics API
- [uniffi-bindgen-react-native](https://github.com/jhugman/uniffi-bindgen-react-native) - FFI bridge

### Reference Assets

- [MegaBook](https://assetstore.unity.com/packages/tools/modeling/megabook-17826) - Visual reference

### Shader Tutorials

- [Fire Shader (GLSL)](https://clockworkchilli.com/blog/8_a_fire_shader_in_glsl_for_your_webgl_games)
- [Frosted Glass Effect](https://www.geeks3d.com/20101228/shader-library-frosted-glass-post-processing-shader-glsl/)
- [Rain Effects Breakdown](https://www.cyanilux.com/tutorials/rain-effects-breakdown/)
- [State of Text Rendering 2024](https://behdad.org/text2024/)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-24 | Initial proposal |
