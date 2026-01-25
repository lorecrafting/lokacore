// Fire Text Shader - Enhanced Production Quality
// Applies animated fire effect to text rendered on a texture
//
// Techniques used:
// - Multi-octave Fractal Brownian Motion (fBm) noise for organic flames
// - Enhanced gradient color ramp with blue-hot core
// - Procedural ember particles that rise and fade
// - Smoke wisps rising above flames
// - Edge glow bleeding outward from text
// - Crackling spark effects for visual interest
// - Heat distortion/shimmer effect above flames

#import bevy_pbr::forward_io::VertexOutput
#import bevy_pbr::mesh_view_bindings::globals

// Material bindings (group 2 for custom materials)
@group(2) @binding(0) var base_texture: texture_2d<f32>;
@group(2) @binding(1) var base_sampler: sampler;
@group(2) @binding(2) var<uniform> intensity: f32;
@group(2) @binding(3) var<uniform> speed: f32;

// ============================================================================
// NOISE FUNCTIONS
// ============================================================================

fn hash(p: vec2<f32>) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

fn hash2(p: vec2<f32>) -> vec2<f32> {
    let h1 = dot(p, vec2<f32>(127.1, 311.7));
    let h2 = dot(p, vec2<f32>(269.5, 183.3));
    return fract(sin(vec2<f32>(h1, h2)) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);

    let a = hash(i + vec2<f32>(0.0, 0.0));
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Standard FBM with 5 octaves
fn fbm(p: vec2<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;

    for (var i = 0; i < 5; i++) {
        value += amplitude * noise(pos * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
        pos = vec2<f32>(pos.x * 0.866 - pos.y * 0.5, pos.x * 0.5 + pos.y * 0.866);
    }

    return value;
}

// Enhanced FBM with more octaves for organic flame detail
fn fbm_flame(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;

    for (var i = 0; i < octaves; i++) {
        value += amplitude * noise(pos * frequency);
        amplitude *= 0.55;  // Slightly slower falloff for more detail
        frequency *= 1.9;   // Slightly different ratio for more organic look
        // Rotate for each octave to break up patterns
        let angle = 0.5 + f32(i) * 0.3;
        let c = cos(angle);
        let s = sin(angle);
        pos = vec2<f32>(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
    }

    return value;
}

// ============================================================================
// ENHANCED FIRE COLOR RAMP WITH BLUE-HOT CORE
// ============================================================================

fn fire_color_enhanced(t: f32, uv: vec2<f32>, time: f32) -> vec4<f32> {
    let i = clamp(t, 0.0, 1.0);

    // More realistic fire gradient with blue-hot core
    let black = vec3<f32>(0.0, 0.0, 0.0);
    let dark_red = vec3<f32>(0.4, 0.0, 0.0);
    let red = vec3<f32>(1.0, 0.1, 0.0);
    let orange = vec3<f32>(1.0, 0.5, 0.0);
    let yellow = vec3<f32>(1.0, 0.9, 0.3);
    let white = vec3<f32>(1.0, 1.0, 0.9);
    let blue_hot = vec3<f32>(0.7, 0.8, 1.0);  // Blue-hot core

    // HDR multipliers for bloom
    var color: vec3<f32>;
    var alpha: f32;

    if (i < 0.1) {
        color = mix(black, dark_red, i / 0.1);
        alpha = i / 0.1;
    } else if (i < 0.25) {
        color = mix(dark_red, red, (i - 0.1) / 0.15) * 2.0;  // HDR
        alpha = 1.0;
    } else if (i < 0.5) {
        color = mix(red, orange, (i - 0.25) / 0.25) * 3.0;  // HDR
        alpha = 1.0;
    } else if (i < 0.75) {
        color = mix(orange, yellow, (i - 0.5) / 0.25) * 4.0;  // HDR
        alpha = 1.0;
    } else if (i < 0.9) {
        color = mix(yellow, white, (i - 0.75) / 0.15) * 5.0;  // HDR
        alpha = 1.0;
    } else {
        // Hottest core has slight blue tint
        color = mix(white, blue_hot, (i - 0.9) / 0.1) * 6.0;  // HDR
        alpha = 1.0;
    }

    return vec4<f32>(color, alpha);
}

// ============================================================================
// EMBER PARTICLES - Rising bright spots that fade
// ============================================================================

fn ember_particles(uv: vec2<f32>, time: f32) -> f32 {
    // Multiple layers of rising embers
    var embers = 0.0;
    for (var i = 0; i < 5; i++) {
        let layer_offset = f32(i) * 1.7;
        let ember_uv = vec2<f32>(
            uv.x * (3.0 + f32(i) * 0.5) + layer_offset,
            uv.y * 2.0 - time * (1.0 + f32(i) * 0.3) + layer_offset
        );
        let ember_noise = noise(ember_uv * 5.0);
        // Sharp threshold for particle look
        let particle = smoothstep(0.92, 0.95, ember_noise);
        // Fade out at top
        let fade = smoothstep(0.0, 0.3, uv.y);
        embers += particle * fade * (1.0 - f32(i) * 0.15);
    }
    return embers;
}

// ============================================================================
// SMOKE EFFECT - Dark wisps rising above flames
// ============================================================================

fn smoke_effect(uv: vec2<f32>, time: f32) -> vec4<f32> {
    // Smoke rises above flames
    let smoke_uv = vec2<f32>(uv.x * 2.0, uv.y * 1.5 - time * 0.5);
    let smoke_noise = fbm(smoke_uv * 3.0);

    // Additional turbulence for wispy effect
    let wisp_uv = vec2<f32>(uv.x * 3.0 + time * 0.2, uv.y * 2.0 - time * 0.7);
    let wisp_noise = fbm(wisp_uv * 4.0);

    // Combine noises for more complex smoke
    let combined_smoke = smoke_noise * 0.6 + wisp_noise * 0.4;

    // Smoke only in upper region (remember UV: 0 = top, 1 = bottom)
    let smoke_mask = smoothstep(0.5, 0.15, uv.y);
    let smoke_alpha = combined_smoke * smoke_mask * 0.3;

    let smoke_color = vec3<f32>(0.15, 0.13, 0.12);  // Dark gray with slight warmth
    return vec4<f32>(smoke_color, smoke_alpha);
}

// ============================================================================
// CRACKLING SPARKS - Occasional bright flashes
// ============================================================================

fn crackling_sparks(uv: vec2<f32>, time: f32) -> f32 {
    // Create discrete spark events using noise
    let spark_time = floor(time * 8.0);  // Quantized time for discrete flashes
    let spark_phase = fract(time * 8.0);  // Phase within each spark period

    // Random position for each spark
    let spark_pos = hash2(vec2<f32>(spark_time, spark_time * 0.7));

    // Distance from spark center
    let dist = length(uv - spark_pos);

    // Sharp spark with quick fade
    let spark_intensity = smoothstep(0.05, 0.0, dist) * smoothstep(1.0, 0.0, spark_phase * 2.0);

    // Additional random sparks at different frequencies
    let spark_time2 = floor(time * 5.0 + 2.3);
    let spark_phase2 = fract(time * 5.0 + 2.3);
    let spark_pos2 = hash2(vec2<f32>(spark_time2 * 1.3, spark_time2));
    let dist2 = length(uv - spark_pos2);
    let spark_intensity2 = smoothstep(0.04, 0.0, dist2) * smoothstep(1.0, 0.0, spark_phase2 * 2.5);

    return spark_intensity + spark_intensity2 * 0.7;
}

// ============================================================================
// EDGE GLOW - Soft orange glow bleeding outward
// ============================================================================

fn edge_glow(uv: vec2<f32>, is_text: f32, time: f32) -> vec4<f32> {
    // Sample multiple radii for smooth falloff
    var glow_accumulator = 0.0;
    let glow_samples = 12;
    let max_radius = 0.025;

    for (var i = 0; i < glow_samples; i++) {
        let angle = f32(i) * 6.28318 / f32(glow_samples);
        let radius = max_radius * (1.0 + 0.3 * noise(vec2<f32>(angle * 2.0, time)));
        let offset = vec2<f32>(cos(angle), sin(angle)) * radius;
        let sample_uv = uv + offset;

        let neighbor = textureSample(base_texture, base_sampler, sample_uv);
        let neighbor_lum = dot(neighbor.rgb, vec3<f32>(0.299, 0.587, 0.114));
        let neighbor_is_text = 1.0 - smoothstep(0.3, 0.6, neighbor_lum);

        glow_accumulator += neighbor_is_text;
    }

    glow_accumulator /= f32(glow_samples);

    // Only show glow where we're NOT on text but near text
    let glow_strength = glow_accumulator * (1.0 - is_text) * 0.8;

    // Animated glow color
    let glow_pulse = 0.9 + 0.1 * sin(time * 3.0);
    let glow_color = vec3<f32>(3.0, 1.2, 0.2) * glow_pulse;  // HDR orange

    return vec4<f32>(glow_color, glow_strength);
}

// ============================================================================
// MULTI-OCTAVE FLAME SHAPE
// ============================================================================

fn flame_shape_enhanced(uv: vec2<f32>, time: f32) -> f32 {
    // Base flame UV with upward motion
    let flame_uv = vec2<f32>(uv.x * 4.0, uv.y * 3.0 - time * 2.0);

    // Layer 1: Large-scale flame structure (3 octaves)
    let large_structure = fbm_flame(flame_uv * 1.0, 3);

    // Layer 2: Medium detail (5 octaves)
    let medium_detail = fbm_flame(flame_uv * 2.0 + vec2<f32>(time * 0.3, 0.0), 5);

    // Layer 3: Fine turbulence (7 octaves for maximum detail)
    let fine_turbulence = fbm_flame(flame_uv * 4.0 + vec2<f32>(0.0, time * 0.5), 7);

    // Layer 4: Horizontal variation to break up vertical streaks
    let horizontal_var = fbm(vec2<f32>(uv.x * 8.0 + time * 0.5, time * 0.2)) * 0.3;

    // Combine layers with different weights
    let combined = large_structure * 0.4 + medium_detail * 0.35 + fine_turbulence * 0.2 + horizontal_var * 0.05;

    return combined;
}

// ============================================================================
// MAIN FRAGMENT SHADER
// ============================================================================

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.uv;
    let time = globals.time * speed;

    // ========================================================================
    // HEAT DISTORTION - Creates shimmer effect above flames
    // ========================================================================
    let quick_sample = textureSample(base_texture, base_sampler, uv);
    let quick_lum = dot(quick_sample.rgb, vec3<f32>(0.299, 0.587, 0.114));
    let text_nearby = 1.0 - smoothstep(0.3, 0.6, quick_lum);

    // Heat rises - distortion stronger near top
    let heat_height = smoothstep(0.0, 0.5, 1.0 - uv.y);

    // Sample nearby to detect if we're above text
    let below_sample = textureSample(base_texture, base_sampler, uv + vec2<f32>(0.0, 0.1));
    let below_lum = dot(below_sample.rgb, vec3<f32>(0.299, 0.587, 0.114));
    let text_below = 1.0 - smoothstep(0.3, 0.6, below_lum);

    let distort_strength = 0.015 * heat_height * max(text_nearby, text_below * 0.7) * intensity;

    // Multi-frequency distortion for natural shimmer
    let distort_noise_x = noise(uv * 15.0 + vec2<f32>(time * 3.0, time * 0.5)) * 2.0 - 1.0;
    let distort_noise_y = noise(uv * 12.0 + vec2<f32>(time * 0.3, time * 4.0)) * 2.0 - 1.0;
    let distort_noise_x2 = noise(uv * 25.0 + vec2<f32>(time * 5.0, time * 1.0)) * 2.0 - 1.0;

    let distort_offset = vec2<f32>(
        (distort_noise_x * 0.7 + distort_noise_x2 * 0.3) * distort_strength,
        distort_noise_y * distort_strength * 0.5
    );

    let distorted_uv = uv + distort_offset;

    // Sample base text texture with heat distortion
    let text_sample = textureSample(base_texture, base_sampler, distorted_uv);

    // Detect text by darkness
    let text_luminance = dot(text_sample.rgb, vec3<f32>(0.299, 0.587, 0.114));
    let is_text = 1.0 - smoothstep(0.3, 0.6, text_luminance);

    // ========================================================================
    // EDGE GLOW - Soft orange bleeding outward (applied even when not on text)
    // ========================================================================
    let edge_glow_result = edge_glow(uv, is_text, time);

    // ========================================================================
    // SMOKE EFFECT - Above flame regions
    // ========================================================================
    let smoke = smoke_effect(uv, time);
    // Only show smoke where there's text/fire activity below
    let smoke_mask = max(text_nearby, text_below);
    let smoke_final = vec4<f32>(smoke.rgb, smoke.a * smoke_mask * intensity);

    // Start compositing with background
    var result = text_sample;

    // Return early with just glow and smoke if not on text
    if (is_text < 0.01) {
        // Apply edge glow to background
        result = mix(result, vec4<f32>(edge_glow_result.rgb, 1.0), edge_glow_result.a * intensity);
        // Apply smoke on top
        result = mix(result, vec4<f32>(smoke_final.rgb, 1.0), smoke_final.a);
        return result;
    }

    // ========================================================================
    // ENHANCED FLAME SHAPE - Multiple octaves for organic look
    // ========================================================================
    let flame_distortion = flame_shape_enhanced(uv, time);

    // Vertical gradient (flames rise from bottom)
    let vertical_gradient = 1.0 - uv.y;

    // Combine into flame shape
    let flame_shape = vertical_gradient + flame_distortion * 0.6 - 0.15;
    let flame_intensity = clamp(flame_shape * is_text * intensity, 0.0, 1.0);

    // ========================================================================
    // FLICKER AND VARIATION
    // ========================================================================
    let flicker = noise(vec2<f32>(uv.x * 10.0, time * 8.0)) * 0.15 + 0.85;
    let slow_pulse = sin(time * 2.0 + uv.x * 5.0) * 0.05 + 0.95;
    let final_flame_intensity = flame_intensity * flicker * slow_pulse;

    // ========================================================================
    // FIRE COLOR WITH ENHANCED RAMP
    // ========================================================================
    let fire = fire_color_enhanced(final_flame_intensity, uv, time);

    // ========================================================================
    // EMBER PARTICLES
    // ========================================================================
    let embers = ember_particles(uv, time) * is_text * intensity;
    let ember_color = vec4<f32>(5.0, 3.0, 0.5, embers);  // Bright HDR orange-yellow

    // ========================================================================
    // CRACKLING SPARKS
    // ========================================================================
    let sparks = crackling_sparks(uv, time) * is_text * intensity * 0.5;
    let spark_color = vec4<f32>(8.0, 6.0, 2.0, sparks);  // Very bright HDR white-yellow

    // ========================================================================
    // INNER GLOW - Approximation of text edge glow
    // ========================================================================
    var inner_glow = 0.0;
    let inner_glow_radius = 0.006;
    for (var dx = -2; dx <= 2; dx++) {
        for (var dy = -2; dy <= 2; dy++) {
            let offset = vec2<f32>(f32(dx), f32(dy)) * inner_glow_radius;
            let neighbor = textureSample(base_texture, base_sampler, uv + offset);
            let neighbor_lum = dot(neighbor.rgb, vec3<f32>(0.299, 0.587, 0.114));
            inner_glow += (1.0 - smoothstep(0.3, 0.6, neighbor_lum)) * 0.04;
        }
    }
    let inner_glow_color = vec4<f32>(4.0, 2.0, 0.5, inner_glow * intensity * 0.4);

    // ========================================================================
    // COMPOSITE ALL LAYERS
    // Order: base -> edge glow -> inner glow -> fire -> embers -> sparks -> smoke
    // ========================================================================

    // Apply edge glow (soft outer glow)
    result = mix(result, vec4<f32>(edge_glow_result.rgb, 1.0), edge_glow_result.a * intensity);

    // Apply inner glow
    result = mix(result, inner_glow_color, inner_glow_color.a);

    // Apply main fire
    result = mix(result, fire, fire.a);

    // Add embers (additive blend for brightness)
    result = vec4<f32>(result.rgb + ember_color.rgb * ember_color.a, result.a);

    // Add sparks (additive blend)
    result = vec4<f32>(result.rgb + spark_color.rgb * spark_color.a, result.a);

    // Apply smoke on top (darkens the fire slightly in upper regions)
    result = mix(result, vec4<f32>(smoke_final.rgb, 1.0), smoke_final.a * 0.5);

    return result;
}
