shader_type canvas_item;

// ============================================================================
// 2D PAGE EFFECTS SHADER
// Burn dissolve, ice frost, glow bloom, fade + atmosphere tinting
// Applied as ColorRect overlay inside page SubViewport
// ============================================================================

// === EFFECT CONTROL ===
uniform int effect_type : hint_range(0, 4) = 0;  // 0=none, 1=burn, 2=ice, 3=glow, 4=fade
uniform float effect_progress : hint_range(0.0, 1.0) = 0.0;

// === ATMOSPHERE ===
uniform vec4 atmosphere_tint : source_color = vec4(1.0, 1.0, 1.0, 1.0);

// === TEXTURES ===
uniform sampler2D noise_texture : filter_linear, repeat_enable;
uniform sampler2D screen_texture : hint_screen_texture, filter_linear;

// Simple hash noise
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Value noise
float value_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Voronoi distance for ice crystals
float voronoi(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	float min_dist = 1.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 neighbor = vec2(float(x), float(y));
			vec2 point = vec2(hash(i + neighbor), hash(i + neighbor + vec2(37.0, 17.0)));
			float dist = length(neighbor + point - f);
			min_dist = min(min_dist, dist);
		}
	}
	return min_dist;
}

void fragment() {
	vec4 base = texture(screen_texture, SCREEN_UV);
	float progress = effect_progress;

	// === NO EFFECT ===
	if (effect_type == 0 || progress < 0.001) {
		COLOR = base * atmosphere_tint;
	}

	// === BURN EFFECT ===
	else if (effect_type == 1) {
		// Noise-based dissolve from edges
		float noise = value_noise(UV * 8.0 + vec2(0.0, progress * 2.0));
		float edge_dist = min(min(UV.x, 1.0 - UV.x), min(UV.y, 1.0 - UV.y));
		float dissolve_threshold = progress * 1.2;
		float burn_mask = smoothstep(dissolve_threshold - 0.1, dissolve_threshold, noise * 0.5 + edge_dist);

		// Orange/red edge glow at burn boundary
		float edge_glow = smoothstep(dissolve_threshold - 0.05, dissolve_threshold, noise * 0.5 + edge_dist)
						- smoothstep(dissolve_threshold, dissolve_threshold + 0.08, noise * 0.5 + edge_dist);
		vec3 glow_color = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.8, 0.0), edge_glow);

		vec3 burned = mix(vec3(0.05, 0.02, 0.0), base.rgb, burn_mask);
		burned += glow_color * edge_glow * 2.0;

		float alpha = mix(0.0, base.a, burn_mask + edge_glow * 0.5);
		COLOR = vec4(burned, alpha) * atmosphere_tint;
	}

	// === ICE EFFECT ===
	else if (effect_type == 2) {
		// Voronoi frost spreading from edges
		float frost_pattern = voronoi(UV * 12.0);
		float edge_dist = min(min(UV.x, 1.0 - UV.x), min(UV.y, 1.0 - UV.y));
		float frost_spread = smoothstep(progress * 0.8, 0.0, edge_dist);
		float frost_mask = frost_spread * smoothstep(0.3, 0.0, frost_pattern);

		// Blue-white frost tint
		vec3 frost_color = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 1.0, 1.0), frost_pattern);
		vec3 iced = mix(base.rgb, frost_color, frost_mask * progress);

		// Desaturate frozen areas
		float gray = dot(iced, vec3(0.299, 0.587, 0.114));
		iced = mix(iced, vec3(gray) * vec3(0.85, 0.9, 1.0), frost_mask * 0.5);

		COLOR = vec4(iced, base.a) * atmosphere_tint;
	}

	// === GLOW EFFECT ===
	else if (effect_type == 3) {
		// Warm golden additive glow
		vec3 glow = base.rgb * (1.0 + progress * 0.8);
		glow += vec3(0.15, 0.10, 0.03) * progress;
		// Soft bloom by sampling neighbors
		vec2 px = vec2(1.0) / vec2(textureSize(screen_texture, 0));
		vec3 bloom = vec3(0.0);
		bloom += texture(screen_texture, SCREEN_UV + vec2(-px.x, 0.0)).rgb;
		bloom += texture(screen_texture, SCREEN_UV + vec2(px.x, 0.0)).rgb;
		bloom += texture(screen_texture, SCREEN_UV + vec2(0.0, -px.y)).rgb;
		bloom += texture(screen_texture, SCREEN_UV + vec2(0.0, px.y)).rgb;
		bloom *= 0.25;
		glow = mix(glow, glow + bloom * 0.3, progress);

		COLOR = vec4(glow, base.a) * atmosphere_tint;
	}

	// === FADE EFFECT ===
	else if (effect_type == 4) {
		float alpha = base.a * (1.0 - progress);
		COLOR = vec4(base.rgb, alpha) * atmosphere_tint;
	}

	else {
		COLOR = base * atmosphere_tint;
	}
}
