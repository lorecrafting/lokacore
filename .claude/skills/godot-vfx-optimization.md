# Godot VFX Optimization Guide

## Overview

This guide covers optimization techniques for visual effects in Godot 4.x, particularly for mobile and WebGL targets. These patterns help achieve high-fidelity effects while maintaining 60fps.

## Performance Budget

**Target: 16.6ms per frame (60fps)**

| Component | Budget | Notes |
|-----------|--------|-------|
| Game logic | ~4ms | Movement, AI, state |
| Rendering | ~8ms | Meshes, particles, shaders |
| Post-processing | ~3ms | Bloom, screen effects |
| Headroom | ~1.6ms | GC, OS overhead |

## Optimization Techniques

### 1. Pre-Baked Sprite Sheet Animations

**Problem:** Real-time particle physics are CPU-expensive.

**Solution:** Bake complex animations into sprite sheets and play them back.

```gdscript
# Use AnimatedSprite3D for pre-rendered effects
var explosion_sprite := AnimatedSprite3D.new()
explosion_sprite.sprite_frames = preload("res://effects/explosion_frames.tres")
explosion_sprite.play("explode")

# Or use shader-based flipbook animation
```

```glsl
// Flipbook shader - animate through sprite sheet
shader_type spatial;
render_mode unshaded, cull_disabled;

uniform sampler2D sprite_sheet : source_color;
uniform int columns = 8;
uniform int rows = 8;
uniform float fps = 30.0;

void fragment() {
    float total_frames = float(columns * rows);
    float current_frame = floor(mod(TIME * fps, total_frames));

    float col = mod(current_frame, float(columns));
    float row = floor(current_frame / float(columns));

    vec2 frame_size = vec2(1.0 / float(columns), 1.0 / float(rows));
    vec2 frame_uv = vec2(col, row) * frame_size + UV * frame_size;

    vec4 color = texture(sprite_sheet, frame_uv);
    ALBEDO = color.rgb;
    ALPHA = color.a;
}
```

**When to use:**
- Explosions, magical bursts, environmental effects
- Any effect that doesn't need to react to gameplay in real-time
- Effects with 50+ particles that would be expensive to simulate

**Tools for baking:**
- Blender (render particle sim to image sequence)
- After Effects / DaVinci Resolve
- Houdini (for complex simulations)

### 2. Texture Atlases (Reduce Draw Calls)

**Problem:** Each unique texture/material = potential draw call. 100 particles with 100 textures = 100 draw calls.

**Solution:** Combine textures into atlases; use UV offsets.

```gdscript
# Create atlas at build time or load pre-made
# Access different sprites via UV coordinates

class_name ParticleAtlas

const ATLAS_SIZE := Vector2(2048, 2048)
const SPRITE_SIZE := Vector2(128, 128)
const COLUMNS := 16  # 2048 / 128

static func get_uv_rect(sprite_index: int) -> Rect2:
    var col := sprite_index % COLUMNS
    var row := sprite_index / COLUMNS
    var uv_size := SPRITE_SIZE / ATLAS_SIZE
    var uv_pos := Vector2(col, row) * uv_size
    return Rect2(uv_pos, uv_size)
```

```glsl
// Shader that samples from atlas
uniform sampler2D atlas : source_color, filter_linear;
uniform vec4 uv_rect;  // x, y, width, height

void fragment() {
    vec2 atlas_uv = uv_rect.xy + UV * uv_rect.zw;
    ALBEDO = texture(atlas, atlas_uv).rgb;
}
```

**Draw call reduction:**
| Approach | Particles | Draw Calls |
|----------|-----------|------------|
| Individual textures | 100 | 100 |
| Single atlas | 100 | 1 |

### 3. Object Pooling (Reduce GC)

**Problem:** Creating/destroying nodes causes garbage collection stutters.

**Solution:** Pre-allocate objects, reuse them.

```gdscript
class_name EffectPool
extends Node

var _pool: Array[Node3D] = []
var _active: Array[Node3D] = []
var _effect_scene: PackedScene

func _init(scene: PackedScene, pool_size: int = 50) -> void:
    _effect_scene = scene
    for i in pool_size:
        var instance := _effect_scene.instantiate() as Node3D
        instance.visible = false
        instance.process_mode = Node.PROCESS_MODE_DISABLED
        _pool.append(instance)
        add_child(instance)

func spawn(position: Vector3) -> Node3D:
    var instance: Node3D
    if _pool.size() > 0:
        instance = _pool.pop_back()
    else:
        # Pool exhausted - create new (consider logging warning)
        instance = _effect_scene.instantiate()
        add_child(instance)

    instance.global_position = position
    instance.visible = true
    instance.process_mode = Node.PROCESS_MODE_INHERIT
    _active.append(instance)

    # Reset effect state
    if instance.has_method("reset"):
        instance.reset()

    return instance

func release(instance: Node3D) -> void:
    instance.visible = false
    instance.process_mode = Node.PROCESS_MODE_DISABLED
    _active.erase(instance)
    _pool.append(instance)

# Auto-release after duration
func spawn_timed(position: Vector3, duration: float) -> Node3D:
    var instance := spawn(position)
    get_tree().create_timer(duration).timeout.connect(
        func(): release(instance)
    )
    return instance
```

**Usage:**
```gdscript
# In game manager
var explosion_pool: EffectPool

func _ready() -> void:
    var explosion_scene := preload("res://effects/explosion.tscn")
    explosion_pool = EffectPool.new(explosion_scene, 20)
    add_child(explosion_pool)

func spawn_explosion(pos: Vector3) -> void:
    explosion_pool.spawn_timed(pos, 2.0)
```

### 4. Shader-Based "Fake" Particles

**Problem:** GPUParticles3D still has overhead. For simple effects, even that's too much.

**Solution:** Single quad with shader that simulates many particles.

```glsl
// Single quad that renders 100 "particles" via shader math
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_opaque;

uniform sampler2D particle_texture : source_color;
uniform float time_offset = 0.0;
uniform int particle_count = 100;
uniform float spread = 1.0;
uniform float speed = 2.0;
uniform float lifetime = 1.5;

// Hash function for pseudo-random
float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

void fragment() {
    vec3 total_color = vec3(0.0);
    float total_alpha = 0.0;

    for (int i = 0; i < particle_count; i++) {
        float fi = float(i);
        float seed = hash(fi);

        // Random offset and direction per particle
        vec2 start_offset = vec2(hash(fi * 1.1) - 0.5, hash(fi * 1.2) - 0.5) * spread;
        vec2 velocity = vec2(hash(fi * 1.3) - 0.5, -1.0 + hash(fi * 1.4) * 0.5) * speed;

        // Time with per-particle phase offset
        float t = mod(TIME + seed * lifetime + time_offset, lifetime);
        float life_progress = t / lifetime;

        // Current position
        vec2 particle_pos = vec2(0.5) + start_offset + velocity * t;

        // Distance from this fragment to particle center
        float dist = distance(UV, particle_pos);
        float particle_size = 0.05 * (1.0 - life_progress);  // Shrink over time

        if (dist < particle_size) {
            float alpha = (1.0 - dist / particle_size) * (1.0 - life_progress);
            total_color += vec3(1.0, 0.6, 0.2) * alpha;  // Fire color
            total_alpha += alpha;
        }
    }

    ALBEDO = total_color;
    ALPHA = min(total_alpha, 1.0);
}
```

**Performance comparison:**
| Method | 100 Particles | Draw Calls | CPU Cost |
|--------|---------------|------------|----------|
| CPUParticles3D | 100 | 100 | High |
| GPUParticles3D | 100 | 1-2 | Medium |
| Shader fake | 100 | 1 | Very Low |

**Limitations:**
- No collision/physics
- Limited interactivity
- Best for ambient effects (fire, sparkles, dust)

### 5. LOD (Level of Detail) for Effects

**Problem:** Full-quality effects waste GPU on distant objects.

**Solution:** Reduce particle count/complexity based on distance.

```gdscript
class_name LODEffect
extends GPUParticles3D

@export var full_amount := 100
@export var medium_amount := 50
@export var low_amount := 20
@export var medium_distance := 10.0
@export var low_distance := 25.0

var _camera: Camera3D

func _ready() -> void:
    _camera = get_viewport().get_camera_3d()

func _process(_delta: float) -> void:
    if not _camera:
        return

    var dist := global_position.distance_to(_camera.global_position)

    if dist < medium_distance:
        amount = full_amount
    elif dist < low_distance:
        amount = medium_amount
    else:
        amount = low_amount
```

### 6. Hybrid Approach: Strategic Quality

For LoL-style "wow moments", use the hero effect principle:

```gdscript
# Budget allocation strategy
class_name EffectBudget

const MAX_HIGH_QUALITY := 2  # Only 2 hero effects at once
const MAX_MEDIUM_QUALITY := 5
const MAX_LOW_QUALITY := 20

var _high_count := 0
var _medium_count := 0

func request_effect(importance: float) -> int:
    # Returns quality tier: 0=skip, 1=low, 2=medium, 3=high
    if importance > 0.8 and _high_count < MAX_HIGH_QUALITY:
        _high_count += 1
        return 3  # Full quality
    elif importance > 0.5 and _medium_count < MAX_MEDIUM_QUALITY:
        _medium_count += 1
        return 2  # Medium quality
    elif importance > 0.2:
        return 1  # Low quality (sprite sheet, simple shader)
    else:
        return 0  # Skip entirely

func release_effect(quality: int) -> void:
    match quality:
        3: _high_count -= 1
        2: _medium_count -= 1
```

## Mobile/WebGL Specific Tips

### WebGL Constraints

```gdscript
# Check platform and adjust quality
func _ready() -> void:
    if OS.has_feature("web"):
        # WebGL has stricter limits
        RenderingServer.global_shader_parameter_set("particle_quality", 0.5)
        _reduce_all_effects()
```

### Shader Complexity Limits

```glsl
// WebGL has instruction limits - keep shaders simple
// Avoid: deep nested loops, excessive texture samples, complex math

// BAD for WebGL:
for (int i = 0; i < 1000; i++) {  // Too many iterations
    color += texture(tex, uv + vec2(float(i) * 0.001));
}

// GOOD for WebGL:
// Use fewer iterations, or bake complexity into textures
for (int i = 0; i < 16; i++) {
    color += texture(tex, uv + offsets[i]) * weights[i];
}
```

### Memory Management

```gdscript
# Unload effects not in use
func _on_area_changed(new_area: String) -> void:
    # Unload previous area's effects
    EffectCache.unload_area(current_area)
    # Preload new area's effects
    EffectCache.preload_area(new_area)
```

## Profiling Tools

### Built-in Profiler

```gdscript
# Use Godot's built-in profiler
# In-game toggle:
func _input(event: InputEvent) -> void:
    if event.is_action_pressed("toggle_profiler"):
        var debugger := get_tree().get_root().get_node("DebugOverlay")
        debugger.visible = !debugger.visible
```

### Frame Time Logging

```gdscript
# Log frame times to detect spikes
var _frame_times: Array[float] = []
const FRAME_LOG_SIZE := 120  # 2 seconds at 60fps

func _process(delta: float) -> void:
    _frame_times.append(delta * 1000.0)
    if _frame_times.size() > FRAME_LOG_SIZE:
        _frame_times.pop_front()

    # Warn on spikes
    if delta > 0.020:  # >20ms = below 50fps
        print("Frame spike: %.1fms" % (delta * 1000.0))
```

## Quick Reference: When to Use What

| Effect Type | Best Approach | Example |
|-------------|---------------|---------|
| Ambient particles (dust, snow) | Shader-based fake | Background atmosphere |
| Explosions, impacts | Sprite sheet + object pool | Combat feedback |
| Magic trails | GPUParticles3D + LOD | Spell casting |
| Screen effects (flash, shake) | Shader on full-screen quad | Damage feedback |
| Complex hero moments | Full GPUParticles3D (limited count) | Ultimate abilities |

## Related Skills

- `godot-webgl-horizontal-banding-fix.md` - Fix shader artifacts in WebGL
- `godot-dual-viewport-shader-effects.md` - Dual viewport text effects
- `godot-planemesh-uv-fix.md` - UV orientation issues

## References

- [Godot Optimization Docs](https://docs.godotengine.org/en/stable/tutorials/performance/index.html)
- [GPUParticles3D](https://docs.godotengine.org/en/stable/classes/class_gpuparticles3d.html)
- [Shader Language Reference](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/index.html)
