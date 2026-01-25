// Ice Text Shader - Region-Based
// Applies frozen/ice effect only to a selected region of text
// Great for highlighting specific words with a frozen effect

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
    let inside_x = step(region.x, uv.x) * step(uv.x, region.z);
    let inside_y = step(region.y, uv.y) * step(uv.y, region.w);
    return inside_x * inside_y;
}

fn region_edge_fade(uv: vec2<f32>) -> f32 {
    let fade_size = 0.02;
    let left_fade = smoothstep(region.x, region.x + fade_size, uv.x);
    let right_fade = smoothstep(region.z, region.z - fade_size, uv.x);
    let top_fade = smoothstep(region.y, region.y + fade_size, uv.y);
    let bottom_fade = smoothstep(region.w, region.w - fade_size, uv.y);
    return left_fade * right_fade * top_fade * bottom_fade;
}

// Distance from region edge (for frost spreading effect)
fn region_edge_distance(uv: vec2<f32>) -> f32 {
    let dx = max(region.x - uv.x, max(uv.x - region.z, 0.0));
    let dy = max(region.y - uv.y, max(uv.y - region.w, 0.0));
    return sqrt(dx * dx + dy * dy);
}

// ============================================================================
// ICE EFFECTS
// ============================================================================

fn crystal_pattern(uv: vec2<f32>, time: f32) -> f32 {
    var crystals = 0.0;
    for (var i = 0; i < 3; i++) {
        let scale = 8.0 + f32(i) * 4.0;
        let crystal_uv = uv * scale + vec2<f32>(f32(i) * 1.3, time * 0.05);
        let cell = fract(crystal_uv);
        let dist = min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y));
        crystals += smoothstep(0.0, 0.03, dist) * (1.0 / f32(i + 1));
    }
    return crystals;
}

fn ice_cracks(uv: vec2<f32>, time: f32) -> f32 {
    let crack_uv = uv * 12.0;
    let crack_noise = fbm(crack_uv + vec2<f32>(time * 0.02, 0.0));
    let crack_line = abs(fract(crack_noise * 6.0) - 0.5);
    return smoothstep(0.015, 0.0, crack_line) * 0.6;
}

fn frost_particles(uv: vec2<f32>, time: f32, region_mask: f32) -> f32 {
    var frost = 0.0;
    for (var i = 0; i < 5; i++) {
        let layer = f32(i);
        let particle_uv = vec2<f32>(
            uv.x * (5.0 + layer) + layer * 2.1,
            uv.y * 3.0 + time * (0.2 + layer * 0.08)
        );
        let p = noise(particle_uv * 5.0);
        frost += smoothstep(0.93, 0.97, p) * (1.0 - layer * 0.15);
    }
    // Frost falls below region
    let below_region = smoothstep(region.w, region.w + 0.15, uv.y);
    return frost * (region_mask + below_region * 0.4) * 0.7;
}

fn ice_color(base_intensity: f32, crystal: f32, crack: f32) -> vec3<f32> {
    let deep_blue = vec3<f32>(0.15, 0.35, 0.7);
    let ice_blue = vec3<f32>(0.6, 0.85, 1.0);
    let frost_white = vec3<f32>(0.95, 0.98, 1.0);

    var color = mix(deep_blue, ice_blue, base_intensity);
    color = mix(color, frost_white, crystal * 0.4);
    // HDR for cracks (bright highlights)
    color = mix(color, vec3<f32>(2.0, 2.5, 3.0), crack);

    return color;
}

// ============================================================================
// MAIN FRAGMENT SHADER
// ============================================================================

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.uv;
    let time = globals.time * speed;

    let region_mask = in_region(uv);
    let edge_fade = region_edge_fade(uv);
    let edge_dist = region_edge_distance(uv);

    let text_sample = textureSample(base_texture, base_sampler, uv);

    // Outside region - show frost spreading outward
    if (region_mask < 0.01) {
        // Frost particles falling below region
        let frost = frost_particles(uv, time, 0.0);
        if (frost > 0.01 && uv.y > region.w) {
            let frost_color = vec3<f32>(0.8, 0.9, 1.0) * frost * 2.0;
            return vec4<f32>(text_sample.rgb + frost_color, 1.0);
        }

        // Frost creeping effect near region edges
        let frost_spread = smoothstep(0.08, 0.0, edge_dist);
        if (frost_spread > 0.01) {
            let frost_noise = noise(uv * 30.0 + vec2<f32>(time * 0.1, 0.0));
            let frost_edge = frost_spread * frost_noise;
            let frosted = mix(text_sample.rgb, vec3<f32>(0.85, 0.92, 1.0), frost_edge * 0.5);
            return vec4<f32>(frosted, 1.0);
        }

        return text_sample;
    }

    // Detect text
    let text_lum = dot(text_sample.rgb, vec3<f32>(0.299, 0.587, 0.114));
    let is_text = 1.0 - smoothstep(0.3, 0.6, text_lum);

    // Background in ice region - subtle blue tint
    if (is_text < 0.01) {
        let bg_frost = noise(uv * 40.0) * 0.1 * edge_fade;
        let frosted_bg = mix(text_sample.rgb, vec3<f32>(0.9, 0.95, 1.0), bg_frost + 0.05 * edge_fade);
        return vec4<f32>(frosted_bg, 1.0);
    }

    // Ice effect on text within region
    let crystals = crystal_pattern(uv, time);
    let cracks = ice_cracks(uv, time);
    let frost = frost_particles(uv, time, region_mask);

    let frozen_intensity = is_text * intensity * edge_fade;
    var ice = ice_color(frozen_intensity, crystals, cracks);

    // Add frost sparkles
    ice += vec3<f32>(frost * 3.0);

    // Specular highlight
    let spec_center = vec2<f32>(
        (region.x + region.z) * 0.5 + 0.1,
        (region.y + region.w) * 0.5 - 0.1
    );
    let spec_dist = distance(uv, spec_center);
    let specular = smoothstep(0.15, 0.0, spec_dist) * 0.4 * is_text * edge_fade;
    ice += vec3<f32>(specular * 4.0);

    // Glow around frozen text
    var glow = 0.0;
    for (var dx = -2; dx <= 2; dx++) {
        for (var dy = -2; dy <= 2; dy++) {
            let offset = vec2<f32>(f32(dx), f32(dy)) * 0.005;
            let neighbor = textureSample(base_texture, base_sampler, uv + offset);
            let neighbor_lum = dot(neighbor.rgb, vec3<f32>(0.299, 0.587, 0.114));
            glow += (1.0 - smoothstep(0.3, 0.6, neighbor_lum)) * 0.025;
        }
    }
    let glow_color = vec3<f32>(0.5, 0.8, 1.5) * glow * intensity * edge_fade;

    // Composite
    var result = text_sample.rgb;
    result = mix(result, ice, is_text * edge_fade);
    result += glow_color;

    return vec4<f32>(result, 1.0);
}
