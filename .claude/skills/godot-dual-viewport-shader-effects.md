# Godot Dual SubViewport for Shader Text Effects

## Problem

You want shader effects (burn, ice, glow) that can detect and spread from text, but text is baked into the page texture so the shader can't distinguish text pixels from background.

## Solution

Use two SubViewports rendered to separate textures, then composite in the shader:

1. **Page Viewport**: Background only (parchment, textures)
2. **Text Viewport**: Text only with transparent background

The shader receives both textures and can detect text via alpha channel.

## Architecture

```
┌─────────────────────────────────────────┐
│ page_viewport (opaque background)       │
│   └─ ColorRect (parchment)              │
│   └─ Vignette shader                    │
│   └─ Grain overlay                      │
│   └─ Bottom bar UI                      │
└─────────────────────────────────────────┘
           │
           ▼ page_texture
┌─────────────────────────────────────────┐
│         SHADER COMPOSITING              │
│  - Sample both textures                 │
│  - Detect text via text_texture.a       │
│  - Apply effects based on text distance │
└─────────────────────────────────────────┘
           ▲ text_texture
┌─────────────────────────────────────────┐
│ text_viewport (transparent_bg = true)   │
│   └─ RichTextLabel (text content)       │
└─────────────────────────────────────────┘
```

## GDScript Implementation

```gdscript
var page_viewport: SubViewport
var text_viewport: SubViewport

func _setup_viewports() -> void:
    # Page viewport - opaque background
    page_viewport = SubViewport.new()
    page_viewport.size = Vector2i(430, 932)
    page_viewport.transparent_bg = false
    page_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    add_child(page_viewport)

    # Add background elements to page_viewport
    var bg := ColorRect.new()
    bg.color = Color(0.878, 0.816, 0.706)  # Parchment
    bg.set_anchors_preset(Control.PRESET_FULL_RECT)
    page_viewport.add_child(bg)

    # Text viewport - transparent for compositing
    text_viewport = SubViewport.new()
    text_viewport.size = Vector2i(430, 932)
    text_viewport.transparent_bg = true  # KEY: transparent!
    text_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
    add_child(text_viewport)

    # Add text to text_viewport
    var label := RichTextLabel.new()
    label.bbcode_enabled = true
    label.set_anchors_preset(Control.PRESET_FULL_RECT)
    text_viewport.add_child(label)

func _apply_viewport_textures() -> void:
    await get_tree().process_frame

    shader_material.set_shader_parameter("page_texture", page_viewport.get_texture())
    shader_material.set_shader_parameter("text_texture", text_viewport.get_texture())
```

## Shader Implementation

```glsl
shader_type spatial;

uniform sampler2D page_texture : source_color;
uniform sampler2D text_texture : source_color;
uniform int text_effect;  // 0=none, 1=burn, 2=ice, etc.
uniform float effect_progress;

void fragment() {
    vec2 uv = vec2(UV.x, 1.0 - UV.y);  // Flip for mesh orientation

    vec4 page_col = texture(page_texture, uv);
    vec4 text_col = texture(text_texture, uv);

    vec3 final_color = page_col.rgb;

    // Composite text normally when no effect
    if (text_col.a > 0.01) {
        final_color = mix(final_color, text_col.rgb, text_col.a);
    }

    // Apply effects that can detect text boundaries
    if (text_effect > 0) {
        // Get distance from nearest text pixel
        float text_dist = get_text_distance(uv, text_texture);

        // Effects can spread from text outward
        if (text_dist < effect_progress * 0.1) {
            // Apply ice/burn/glow spreading from text
        }
    }

    ALBEDO = final_color;
}

// Sample neighbors to estimate distance from text
float get_text_distance(vec2 uv, sampler2D tex) {
    float text_alpha = texture(tex, uv).a;
    if (text_alpha > 0.1) return 0.0;  // On text

    float min_dist = 1.0;
    float step_size = 0.005;

    for (float dx = -2.0; dx <= 2.0; dx += 1.0) {
        for (float dy = -2.0; dy <= 2.0; dy += 1.0) {
            vec2 sample_uv = uv + vec2(dx, dy) * step_size;
            if (texture(tex, sample_uv).a > 0.1) {
                min_dist = min(min_dist, length(vec2(dx, dy)) * step_size);
            }
        }
    }
    return min_dist;
}
```

## Effect Examples

### Burn Effect
- Fire spreads from burn line
- Extra intensity/spread near text
- Text chars before background

### Ice Effect
- Frost spreads from page edges AND from text outward
- Text gets frozen appearance

### Glow Effect
- Multi-radius blur sampling around text
- Emission from text creates bloom

## Performance Notes

- Two viewports = 2x render cost for UI layer
- Keep viewport resolution reasonable for mobile
- Text distance sampling is expensive - limit sample radius
- Consider caching text distance in a texture for complex effects

## When to Use

- Text effects that need to "know" where text is
- Effects that spread from or interact with text
- Layered compositing with different blend modes
- Any shader that needs text vs background distinction

## Project Reference

- Implementation: `godot-client/scripts/book_page.gd`
- Shader: `godot-client/shaders/page_curl.gdshader`
