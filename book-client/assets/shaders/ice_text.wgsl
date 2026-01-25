// Ice Text Shader - AAA Production Quality
// Creates a frozen/iced text effect with multiple layers
//
// Techniques used:
// - Procedural crystalline patterns using Voronoi-like noise
// - Animated ice crack lines spreading across frozen text
// - Falling frost particles for atmospheric depth
// - Cold mist effect at the bottom of text
// - Sharp specular highlights mimicking real ice reflections
// - HDR blue-white color palette for realistic cold appearance

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
    let h = vec2<f32>(
        dot(p, vec2<f32>(127.1, 311.7)),
        dot(p, vec2<f32>(269.5, 183.3))
    );
    return fract(sin(h) * 43758.5453123);
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

fn fbm(p: vec2<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;

    for (var i = 0; i < 5; i++) {
        value += amplitude * noise(pos * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
        // Rotate slightly for more organic look
        pos = vec2<f32>(pos.x * 0.866 - pos.y * 0.5, pos.x * 0.5 + pos.y * 0.866);
    }

    return value;
}

// ============================================================================
// VORONOI PATTERN - For crystalline structure
// ============================================================================

fn voronoi(p: vec2<f32>) -> vec2<f32> {
    let n = floor(p);
    let f = fract(p);

    var min_dist = 8.0;
    var min_point = vec2<f32>(0.0);

    for (var j = -1; j <= 1; j++) {
        for (var i = -1; i <= 1; i++) {
            let neighbor = vec2<f32>(f32(i), f32(j));
            let point = hash2(n + neighbor);
            let diff = neighbor + point - f;
            let dist = dot(diff, diff);

            if (dist < min_dist) {
                min_dist = dist;
                min_point = point;
            }
        }
    }

    return vec2<f32>(sqrt(min_dist), min_point.x);
}

// ============================================================================
// ICE CRYSTAL PATTERN
// Creates hexagonal-ish crystalline structures at multiple scales
// ============================================================================

fn crystal_pattern(uv: vec2<f32>, time: f32) -> f32 {
    var crystals = 0.0;

    // Multiple scales of crystal growth
    for (var i = 0; i < 4; i++) {
        let scale = 5.0 + f32(i) * 3.0;
        let offset = f32(i) * 1.3;
        let crystal_uv = uv * scale + vec2<f32>(offset, time * 0.05 * f32(i + 1));

        // Voronoi-like pattern for crystal cells
        let v = voronoi(crystal_uv);
        let edge_dist = v.x;

        // Create crystal edges (bright lines between cells)
        let edge = 1.0 - smoothstep(0.0, 0.15, edge_dist);

        // Inner crystal variation
        let inner = smoothstep(0.15, 0.4, edge_dist) * noise(crystal_uv * 2.0);

        crystals += (edge * 0.8 + inner * 0.3) * (1.0 / f32(i + 1));
    }

    return clamp(crystals, 0.0, 1.0);
}

// ============================================================================
// ICE CRACK LINES
// Animated spreading cracks across the ice surface
// ============================================================================

fn ice_cracks(uv: vec2<f32>, time: f32) -> f32 {
    var cracks = 0.0;

    // Main crack lines using directional noise
    let crack_uv = uv * 8.0;
    let crack_noise = fbm(crack_uv + vec2<f32>(time * 0.03, 0.0));

    // Primary cracks - sharp lines
    let crack_line = abs(fract(crack_noise * 5.0) - 0.5);
    cracks = smoothstep(0.02, 0.0, crack_line) * 0.6;

    // Secondary cracks - thinner, more frequent
    let crack2 = abs(fract(crack_noise * 8.0 + 0.3) - 0.5);
    cracks += smoothstep(0.03, 0.0, crack2) * 0.3;

    // Tertiary cracks - finest detail
    let crack_uv2 = uv * 15.0 + vec2<f32>(time * 0.02, 0.5);
    let crack3_noise = fbm(crack_uv2);
    let crack3 = abs(fract(crack3_noise * 6.0) - 0.5);
    cracks += smoothstep(0.04, 0.0, crack3) * 0.2;

    // Animate crack spreading from center
    let spread_progress = (sin(time * 0.5) * 0.5 + 0.5);
    let dist_from_center = length(uv - vec2<f32>(0.5));
    let spread_mask = smoothstep(spread_progress * 0.8 + 0.2, spread_progress * 0.8, dist_from_center);

    return cracks * spread_mask;
}

// ============================================================================
// FROST PARTICLES
// Small ice crystals drifting down
// ============================================================================

fn frost_particles(uv: vec2<f32>, time: f32) -> f32 {
    var frost = 0.0;

    for (var i = 0; i < 8; i++) {
        let layer = f32(i);
        let layer_speed = 0.2 + layer * 0.08;
        let layer_scale = 3.0 + layer * 1.5;

        // Each layer has different horizontal drift
        let drift = sin(time * (0.5 + layer * 0.1) + layer * 2.0) * 0.1;

        let particle_uv = vec2<f32>(
            uv.x * layer_scale + layer * 2.1 + drift,
            uv.y * layer_scale + time * layer_speed  // Falling down
        );

        // Create sparse, bright particles
        let p = noise(particle_uv * 4.0);
        let sparkle = smoothstep(0.92, 0.98, p);

        // Add twinkling effect
        let twinkle = sin(time * (8.0 + layer * 2.0) + layer * 5.0) * 0.5 + 0.5;

        frost += sparkle * (1.0 - layer * 0.08) * (0.7 + twinkle * 0.3);
    }

    return frost * 0.6;
}

// ============================================================================
// COLD MIST
// Subtle fog effect at the bottom
// ============================================================================

fn cold_mist(uv: vec2<f32>, time: f32) -> f32 {
    let mist_uv = vec2<f32>(uv.x * 3.0 + time * 0.15, uv.y * 2.0);
    let mist = fbm(mist_uv) * 0.5 + 0.5;

    // Secondary mist layer for depth
    let mist2_uv = vec2<f32>(uv.x * 5.0 - time * 0.1, uv.y * 3.0);
    let mist2 = fbm(mist2_uv + 10.0) * 0.5 + 0.5;

    let combined_mist = mist * 0.6 + mist2 * 0.4;

    // Stronger at bottom (higher UV.y values)
    let mist_mask = smoothstep(0.5, 1.0, uv.y);

    // Add some vertical wisp movement
    let wisps = noise(vec2<f32>(uv.x * 8.0, time * 0.3)) * 0.3;

    return (combined_mist + wisps) * mist_mask * 0.5;
}

// ============================================================================
// SPECULAR HIGHLIGHTS
// Sharp, bright reflections like real ice
// ============================================================================

fn specular_highlights(uv: vec2<f32>, time: f32, crystal: f32) -> f32 {
    // Primary highlight - large, soft
    let spec_pos1 = vec2<f32>(0.3 + sin(time * 0.2) * 0.05, 0.3);
    let spec_dist1 = distance(uv, spec_pos1);
    let specular1 = smoothstep(0.35, 0.0, spec_dist1) * 0.4;

    // Secondary highlight - smaller, sharper
    let spec_pos2 = vec2<f32>(0.7 + cos(time * 0.15) * 0.03, 0.25);
    let spec_dist2 = distance(uv, spec_pos2);
    let specular2 = smoothstep(0.15, 0.0, spec_dist2) * 0.3;

    // Crystal-based micro highlights
    let micro_spec = crystal * noise(uv * 30.0 + time * 0.1) * 0.5;

    // Fresnel-like edge highlight
    let edge_highlight = smoothstep(0.4, 0.5, abs(uv.x - 0.5)) * 0.2;

    return specular1 + specular2 + micro_spec + edge_highlight;
}

// ============================================================================
// ICE COLOR PALETTE
// Blue-white cold colors
// ============================================================================

fn ice_color(base_intensity: f32, crystal: f32, crack: f32, specular: f32) -> vec3<f32> {
    // Base ice colors (HDR values for bloom)
    let deep_blue = vec3<f32>(0.05, 0.15, 0.35);
    let ice_blue = vec3<f32>(0.3, 0.6, 0.9);
    let pale_blue = vec3<f32>(0.6, 0.8, 1.0);
    let frost_white = vec3<f32>(0.85, 0.92, 1.0);
    let crystal_highlight = vec3<f32>(1.5, 1.8, 2.0);  // HDR for bloom
    let crack_bright = vec3<f32>(2.5, 3.0, 3.5);       // HDR for crack glow

    // Mix based on intensity - deeper blue in darker areas
    var color = mix(deep_blue, ice_blue, base_intensity * 0.8);
    color = mix(color, pale_blue, base_intensity * 0.5);

    // Crystal structures add lighter tones
    color = mix(color, frost_white, crystal * 0.4);

    // Cracks are bright white-blue (HDR for bloom effect)
    color = mix(color, crack_bright, crack);

    // Specular highlights are brightest (HDR)
    color += crystal_highlight * specular;

    return color;
}

// ============================================================================
// MAIN FRAGMENT SHADER
// ============================================================================

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.uv;
    let time = globals.time * speed;

    // Sample base text texture
    let text_sample = textureSample(base_texture, base_sampler, uv);

    // Detect text by darkness (text is dark on light parchment)
    let text_luminance = dot(text_sample.rgb, vec3<f32>(0.299, 0.587, 0.114));
    let is_text = 1.0 - smoothstep(0.3, 0.6, text_luminance);

    // ========================================================================
    // BACKGROUND FROST EFFECT (subtle frost on non-text areas)
    // ========================================================================
    if (is_text < 0.01) {
        // Subtle ambient frost on background
        let bg_frost = frost_particles(uv, time) * 0.15;
        let bg_mist = cold_mist(uv, time) * 0.3;

        // Very subtle crystal pattern on background
        let bg_crystal = crystal_pattern(uv, time) * 0.08;

        var bg = text_sample.rgb;

        // Tint background slightly blue-ish where frost appears
        let frost_tint = vec3<f32>(0.85, 0.92, 1.0);
        bg = mix(bg, frost_tint, bg_frost + bg_mist + bg_crystal);

        // Add tiny sparkles
        bg += vec3<f32>(bg_frost * 1.5);

        return vec4<f32>(bg, 1.0);
    }

    // ========================================================================
    // ICE EFFECT LAYERS (on text)
    // ========================================================================

    // Calculate all ice layers
    let crystals = crystal_pattern(uv, time);
    let cracks = ice_cracks(uv, time);
    let frost = frost_particles(uv, time);
    let mist = cold_mist(uv, time);
    let specular = specular_highlights(uv, time, crystals);

    // Base frozen intensity (affected by overall intensity parameter)
    let frozen_intensity = is_text * intensity;

    // ========================================================================
    // COMPOSE FINAL ICE COLOR
    // ========================================================================

    // Get base ice color
    var ice = ice_color(frozen_intensity, crystals, cracks * is_text, specular * is_text);

    // Add frost particles as bright sparkles (HDR)
    ice += vec3<f32>(frost * 2.5) * is_text;

    // Add mist overlay (softens and adds atmosphere)
    let mist_color = vec3<f32>(0.7, 0.85, 1.0);
    ice = mix(ice, mist_color, mist * is_text * 0.6);

    // ========================================================================
    // GLOW EFFECT (around text edges)
    // ========================================================================
    var glow = 0.0;
    let glow_radius = 0.006;
    for (var dx = -2; dx <= 2; dx++) {
        for (var dy = -2; dy <= 2; dy++) {
            let offset = vec2<f32>(f32(dx), f32(dy)) * glow_radius;
            let neighbor = textureSample(base_texture, base_sampler, uv + offset);
            let neighbor_lum = dot(neighbor.rgb, vec3<f32>(0.299, 0.587, 0.114));
            glow += (1.0 - smoothstep(0.3, 0.6, neighbor_lum)) * 0.04;
        }
    }

    // Cold blue glow (HDR for bloom)
    let glow_color = vec3<f32>(0.4, 0.7, 1.5) * glow * intensity * 0.4;
    ice += glow_color;

    // ========================================================================
    // SEMI-TRANSPARENT ICE OVERLAY
    // Text appears encased in ice - blend with original slightly
    // ========================================================================
    let ice_transparency = 0.85 + crystals * 0.1;  // Ice is mostly opaque but varies
    var final_color = mix(text_sample.rgb * 0.3, ice, ice_transparency);

    // ========================================================================
    // FINAL OUTPUT
    // ========================================================================
    let alpha = is_text;

    return vec4<f32>(final_color, alpha);
}
