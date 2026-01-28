shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, unshaded;

// ============================================================================
// PAGE CURL SHADER WITH DUAL-LAYER TEXT COMPOSITING
// ============================================================================

// === TEXTURES ===
uniform sampler2D page_texture : source_color, filter_linear;
uniform sampler2D text_texture : source_color, filter_linear;

// === CURL PARAMETERS ===
uniform float curl_amount : hint_range(0.0, 1.0) = 0.0;
uniform float curl_direction : hint_range(-1.0, 1.0) = 1.0;
uniform float curl_radius : hint_range(0.1, 1.0) = 0.35;
uniform float curl_angle : hint_range(0.0, 3.14159) = 2.5;

// === PAGE PROPERTIES ===
uniform vec3 paper_color : source_color = vec3(0.96, 0.93, 0.85);
uniform vec3 paper_back_color : source_color = vec3(0.92, 0.88, 0.80);
uniform float page_thickness : hint_range(0.0, 0.02) = 0.003;

// === LIGHTING ===
uniform float shadow_intensity : hint_range(0.0, 1.0) = 0.3;
uniform float ambient_occlusion : hint_range(0.0, 1.0) = 0.2;

// Varyings
varying vec3 world_position;
varying vec3 local_normal;
varying float curl_factor;
varying float is_back_face;
varying float curl_shadow;

// ============================================================================
// VERTEX SHADER
// ============================================================================

void vertex() {
    vec3 pos = VERTEX;
    vec3 norm = NORMAL;

    float page_half_width = 0.9;
    float normalized_x = (pos.x / page_half_width + 1.0) * 0.5;

    float curl_start;
    if (curl_direction > 0.0) {
        curl_start = 1.0 - normalized_x;
    } else {
        curl_start = normalized_x;
    }

    float curl_zone = curl_amount * 1.2;
    curl_factor = 0.0;
    curl_shadow = 0.0;

    if (curl_start < curl_zone && curl_amount > 0.01) {
        float t = 1.0 - (curl_start / max(curl_zone, 0.001));
        t = clamp(t, 0.0, 1.0);
        float smooth_t = t * t * (3.0 - 2.0 * t);

        float dynamic_radius = curl_radius * (1.0 - curl_amount * 0.4);
        float theta = smooth_t * curl_angle * curl_amount;

        float cos_theta = cos(theta);
        float sin_theta = sin(theta);

        float lift = dynamic_radius * (1.0 - cos_theta);
        float curl_z = dynamic_radius * sin_theta * curl_direction;

        float blend = smooth_t * curl_amount;
        pos.y += lift * blend * 1.5;
        pos.z += curl_z * blend;

        float norm_angle = theta * blend;
        vec3 rotated_normal;
        rotated_normal.x = norm.x;
        rotated_normal.y = norm.y * cos(norm_angle) - norm.z * sin(norm_angle);
        rotated_normal.z = norm.y * sin(norm_angle) + norm.z * cos(norm_angle);
        norm = normalize(rotated_normal);

        curl_factor = smooth_t * curl_amount;
        curl_shadow = smoothstep(curl_zone, curl_zone * 0.7, curl_start) * curl_amount;
    }

    if (curl_amount > 0.1) {
        float edge_factor = smoothstep(0.0, 0.1, curl_start) * smoothstep(0.0, 0.1, 1.0 - curl_start);
        pos.z += page_thickness * (1.0 - edge_factor) * curl_amount * curl_direction;
    }

    VERTEX = pos;
    NORMAL = norm;
    world_position = (MODEL_MATRIX * vec4(pos, 1.0)).xyz;
    local_normal = norm;
    is_back_face = step(0.0, -dot(norm, vec3(0.0, 0.0, 1.0)));
}

// ============================================================================
// FRAGMENT SHADER
// ============================================================================

// Simple hash function for noise
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void fragment() {
    vec2 uv = vec2(UV.x, 1.0 - UV.y);

    // Sample textures
    vec4 page_col = texture(page_texture, uv);
    vec4 text_col = texture(text_texture, uv);

    // Composite text over page (simple alpha blend)
    vec3 final_color = page_col.rgb;
    if (text_col.a > 0.01) {
        final_color = mix(final_color, text_col.rgb, text_col.a);
    }

    // === CURL SHADING ===
    if (is_back_face > 0.5) {
        final_color = mix(final_color, paper_back_color, 0.3);
    }

    // Subtle shadow on curled areas
    float curl_shade = 1.0 - curl_factor * shadow_intensity;
    final_color *= curl_shade;
    final_color *= 1.0 - curl_shadow * shadow_intensity * 0.5;

    // Ambient occlusion on fold
    float fold_ao = 1.0 - smoothstep(0.0, 0.3, curl_factor) * ambient_occlusion * curl_amount;
    final_color *= fold_ao;

    // === EDGE DARKENING ===
    float edge_x = smoothstep(0.0, 0.05, uv.x) * smoothstep(0.0, 0.05, 1.0 - uv.x);
    float edge_y = smoothstep(0.0, 0.05, uv.y) * smoothstep(0.0, 0.05, 1.0 - uv.y);
    float edge = edge_x * edge_y;
    final_color *= 0.9 + edge * 0.1;

    // Edge highlight when curling
    if (curl_factor > 0.1) {
        float edge_highlight = smoothstep(0.02, 0.0, abs(uv.x - 0.5) - 0.48);
        edge_highlight *= curl_factor;
        final_color += vec3(0.08, 0.06, 0.04) * edge_highlight;
    }

    ALBEDO = final_color;
}
