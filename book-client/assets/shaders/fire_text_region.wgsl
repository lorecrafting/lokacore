// Fire Text Shader - Region-Based
// Applies animated fire effect only to a selected region of text
// Great for highlighting specific words, titles, or important text

#import bevy_pbr::forward_io::VertexOutput
#import bevy_pbr::mesh_view_bindings::globals

@group(2) @binding(0) var base_texture: texture_2d<f32>;
@group(2) @binding(1) var base_sampler: sampler;
@group(2) @binding(2) var<uniform> intensity: f32;
@group(2) @binding(3) var<uniform> speed: f32;
// Region bounds: x=left, y=top, z=right, w=bottom (UV coordinates 0-1)
@group(2) @binding(4) var<uniform> region: vec4<f32>;

// ============================================================================
// NOISE FUNCTIONS
// ============================================================================

fn hash(p: vec2<f32>) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    let a = hash(i);
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var pos = p;
    for (var i = 0; i < 5; i++) {
        value += amplitude * noise(pos);
        amplitude *= 0.5;
        pos *= 2.0;
    }
    return value;
}

// ============================================================================
// REGION HELPER
// ============================================================================

fn in_region(uv: vec2<f32>) -> f32 {
    // Check if UV is within the specified region
    // region: x=left, y=top, z=right, w=bottom
    let inside_x = step(region.x, uv.x) * step(uv.x, region.z);
    let inside_y = step(region.y, uv.y) * step(uv.y, region.w);
    return inside_x * inside_y;
}

fn region_edge_fade(uv: vec2<f32>) -> f32 {
    // Soft fade at region edges
    let fade_size = 0.02;
    let left_fade = smoothstep(region.x, region.x + fade_size, uv.x);
    let right_fade = smoothstep(region.z, region.z - fade_size, uv.x);
    let top_fade = smoothstep(region.y, region.y + fade_size, uv.y);
    let bottom_fade = smoothstep(region.w, region.w - fade_size, uv.y);
    return left_fade * right_fade * top_fade * bottom_fade;
}

// ============================================================================
// FIRE EFFECTS
// ============================================================================

fn fire_color(t: f32) -> vec4<f32> {
    let i = clamp(t, 0.0, 1.0);

    let black = vec3<f32>(0.0, 0.0, 0.0);
    let dark_red = vec3<f32>(1.5, 0.0, 0.0);
    let red = vec3<f32>(3.0, 0.3, 0.0);
    let orange = vec3<f32>(4.0, 1.6, 0.0);
    let yellow = vec3<f32>(5.0, 4.0, 1.0);
    let white = vec3<f32>(6.0, 6.0, 4.8);

    var color: vec3<f32>;
    var alpha: f32;

    if (i < 0.15) {
        color = mix(black, dark_red, i / 0.15);
        alpha = i / 0.15;
    } else if (i < 0.4) {
        color = mix(dark_red, red, (i - 0.15) / 0.25);
        alpha = 1.0;
    } else if (i < 0.6) {
        color = mix(red, orange, (i - 0.4) / 0.2);
        alpha = 1.0;
    } else if (i < 0.8) {
        color = mix(orange, yellow, (i - 0.6) / 0.2);
        alpha = 1.0;
    } else {
        color = mix(yellow, white, (i - 0.8) / 0.2);
        alpha = 1.0;
    }

    return vec4<f32>(color, alpha);
}

fn ember_particles(uv: vec2<f32>, time: f32, region_mask: f32) -> f32 {
    var embers = 0.0;
    for (var i = 0; i < 4; i++) {
        let layer = f32(i);
        let ember_uv = vec2<f32>(
            uv.x * (4.0 + layer) + layer * 1.7,
            uv.y * 2.0 - time * (1.2 + layer * 0.2)
        );
        let p = noise(ember_uv * 6.0);
        embers += smoothstep(0.92, 0.96, p) * (1.0 - layer * 0.2);
    }
    // Embers rise above the region
    let above_region = smoothstep(region.y, region.y - 0.1, uv.y);
    return embers * (region_mask + above_region * 0.5) * 0.8;
}

// ============================================================================
// MAIN FRAGMENT SHADER
// ============================================================================

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.uv;
    let time = globals.time * speed;

    // Check if we're in the effect region
    let region_mask = in_region(uv);
    let edge_fade = region_edge_fade(uv);

    // Sample base texture
    let text_sample = textureSample(base_texture, base_sampler, uv);

    // If outside region, return base texture (no effect)
    if (region_mask < 0.01) {
        // But still show embers floating above the region
        let embers = ember_particles(uv, time, 0.0);
        if (embers > 0.01 && uv.y < region.y) {
            let ember_color = vec3<f32>(5.0, 2.0, 0.5) * embers;
            return vec4<f32>(text_sample.rgb + ember_color, 1.0);
        }
        return text_sample;
    }

    // Detect text
    let text_lum = dot(text_sample.rgb, vec3<f32>(0.299, 0.587, 0.114));
    let is_text = 1.0 - smoothstep(0.3, 0.6, text_lum);

    // If not on text within region, add subtle heat distortion
    if (is_text < 0.01) {
        let distort = noise(uv * 20.0 + vec2<f32>(time * 2.0, 0.0)) * 0.005 * edge_fade;
        let distorted_sample = textureSample(base_texture, base_sampler, uv + vec2<f32>(distort, 0.0));
        // Slight orange tint to background in fire region
        let tinted = mix(distorted_sample.rgb, vec3<f32>(1.0, 0.9, 0.8), 0.1 * edge_fade);
        return vec4<f32>(tinted, 1.0);
    }

    // Fire effect on text within region
    let flame_uv = vec2<f32>(uv.x * 4.0, uv.y * 3.0 - time * 2.0);
    let turbulence = fbm(flame_uv * 2.0);

    // Normalize UV within region for consistent flame look
    let region_uv_y = (uv.y - region.y) / (region.w - region.y);
    let vertical = 1.0 - region_uv_y;

    let flame_shape = vertical + turbulence * 0.4 - 0.1;
    let flame_intensity = clamp(flame_shape * is_text * intensity * edge_fade, 0.0, 1.0);

    // Flicker
    let flicker = noise(vec2<f32>(uv.x * 10.0, time * 8.0)) * 0.2 + 0.8;
    let final_intensity = flame_intensity * flicker;

    // Get fire color
    let fire = fire_color(final_intensity);

    // Embers
    let embers = ember_particles(uv, time, region_mask);
    let ember_color = vec3<f32>(5.0, 2.0, 0.5) * embers;

    // Glow around text in region
    var glow = 0.0;
    for (var dx = -2; dx <= 2; dx++) {
        for (var dy = -2; dy <= 2; dy++) {
            let offset = vec2<f32>(f32(dx), f32(dy)) * 0.006;
            let neighbor = textureSample(base_texture, base_sampler, uv + offset);
            let neighbor_lum = dot(neighbor.rgb, vec3<f32>(0.299, 0.587, 0.114));
            glow += (1.0 - smoothstep(0.3, 0.6, neighbor_lum)) * 0.03;
        }
    }
    let glow_color = vec4<f32>(3.0, 1.2, 0.2, glow * intensity * edge_fade * 0.5);

    // Composite
    var result = text_sample;
    result = mix(result, glow_color, glow_color.a);
    result = mix(result, fire, fire.a * edge_fade);
    result.rgb += ember_color;

    return result;
}
