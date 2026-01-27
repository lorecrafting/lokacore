shader_type spatial;
render_mode cull_disabled, depth_draw_opaque;

// Page texture from SubViewport
uniform sampler2D page_texture : source_color, filter_linear_mipmap;

// Curl parameters
uniform float curl_amount : hint_range(0.0, 1.0) = 0.0;
uniform float curl_direction : hint_range(-1.0, 1.0) = 1.0;  // -1 = left, 1 = right
uniform float curl_radius : hint_range(0.1, 2.0) = 0.5;

// Paper properties
uniform vec3 paper_color : source_color = vec3(0.96, 0.93, 0.85);
uniform float paper_thickness : hint_range(0.0, 0.1) = 0.01;

varying vec3 world_position;
varying float curl_factor;

void vertex() {
	// Get original vertex position
	vec3 pos = VERTEX;

	// Calculate curl based on X position (horizontal curl)
	// Normalize x to 0-1 range (assuming plane centered at origin)
	float normalized_x = (pos.x + 1.0) * 0.5;  // Assuming width of 2

	// Curl starts from edge based on direction
	float curl_edge = curl_direction > 0.0 ? 1.0 - normalized_x : normalized_x;

	// Only curl the portion of the page based on curl_amount
	if (curl_edge < curl_amount) {
		// Calculate how far into the curl zone we are
		float curl_progress = 1.0 - (curl_edge / max(curl_amount, 0.001));

		// Cylindrical curl calculation
		float angle = curl_progress * PI * curl_amount * 2.0;
		float curl_r = curl_radius * (1.0 - curl_amount * 0.5);

		// Apply curl deformation
		float y_offset = curl_r * (1.0 - cos(angle));
		float z_offset = curl_r * sin(angle);

		pos.y += y_offset;
		pos.z += z_offset * curl_direction;

		// Store curl factor for shading
		curl_factor = curl_progress;
	} else {
		curl_factor = 0.0;
	}

	VERTEX = pos;
	world_position = (MODEL_MATRIX * vec4(pos, 1.0)).xyz;
}

void fragment() {
	// Flip only UV.y to correct for mesh rotation
	vec2 flipped_uv = vec2(UV.x, 1.0 - UV.y);

	// Sample the page texture
	vec4 tex_color = texture(page_texture, flipped_uv);

	// Add subtle shadow on curled areas
	float shadow = 1.0 - curl_factor * 0.3;

	// Apply paper tint
	vec3 final_color = tex_color.rgb * shadow;

	// Add subtle edge darkening for depth
	float edge = smoothstep(0.0, 0.05, flipped_uv.x) * smoothstep(0.0, 0.05, 1.0 - flipped_uv.x);
	edge *= smoothstep(0.0, 0.05, flipped_uv.y) * smoothstep(0.0, 0.05, 1.0 - flipped_uv.y);
	final_color *= 0.9 + edge * 0.1;

	ALBEDO = final_color;
	ROUGHNESS = 0.8;
	METALLIC = 0.0;
}
