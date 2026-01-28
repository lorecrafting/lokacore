# Godot WebGL Horizontal Banding Fix

## Problem

Horizontal lines/banding artifacts appear on 3D meshes in Godot's WebGL export when using the `gl_compatibility` renderer. The lines look like evenly-spaced ruled paper lines and appear even with:
- Solid color output (no textures)
- No mesh subdivisions
- No noise/grain layers
- Any texture filtering mode (linear, nearest, mipmap)

## Root Cause

PBR lighting calculations in `gl_compatibility` mode create banding artifacts due to how normals are interpolated across mesh triangles in WebGL. The lighting shader applies subtle shading variations that manifest as visible horizontal lines.

## Solution

Add `unshaded` to the shader's render_mode to bypass all lighting calculations:

```glsl
// BEFORE (causes banding)
shader_type spatial;
render_mode cull_disabled, depth_draw_opaque;

// AFTER (no banding)
shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, unshaded;
```

## When to Use This Fix

Apply `render_mode unshaded` when:
- Using `gl_compatibility` renderer (required for WebGL)
- The shader outputs a self-illuminated texture (like a book page, UI element, or flat surface)
- You don't need dynamic lighting on the mesh
- You see horizontal banding that persists regardless of texture changes

## Tradeoffs

- **Pros:** Eliminates banding, simpler shader, better performance
- **Cons:** No dynamic lighting/shadows on the mesh (but for UI textures on 3D meshes, this is usually fine)

## What This Doesn't Fix

If banding persists after adding `unshaded`:
- Check if lines are in the source texture itself
- Check SubViewport render settings
- Check browser scaling/CSS transforms on the canvas

## Example: Book Page Shader

```glsl
shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, unshaded;

uniform sampler2D page_texture : source_color, filter_linear;

void fragment() {
    vec2 uv = vec2(UV.x, 1.0 - UV.y);
    vec4 page_col = texture(page_texture, uv);
    ALBEDO = page_col.rgb;
    // No ROUGHNESS or METALLIC needed with unshaded
}
```

## Debugging Process

If you encounter similar artifacts in the future:
1. First try `render_mode unshaded` - this fixes most WebGL banding
2. If lines persist, simplify shader to output solid color
3. If solid color still has lines, issue is in mesh/viewport, not shader
4. If solid color is clean, issue is in texture sampling or compositing

## Related

- Godot docs: [Spatial Shaders - Render Modes](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/spatial_shader.html)
- Applies to: Godot 4.x with gl_compatibility renderer
- Web exports using WebGL 2.0
