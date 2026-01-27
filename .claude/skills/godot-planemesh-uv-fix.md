# Godot PlaneMesh UV Orientation Fix

Fix mirrored or inverted textures when using SubViewport on a rotated PlaneMesh.

## Trigger Conditions

Use this skill when:
- Text or textures appear mirrored/reversed on a 3D plane
- SubViewport content displays upside down or backwards
- PlaneMesh is rotated to face the camera (e.g., -90 degrees on X)

## The Problem

When a `PlaneMesh` is rotated to face the camera (common pattern: `rotation_degrees = Vector3(-90, 0, 0)`), the UV coordinates become misaligned with the viewer's perspective. This causes:
- Horizontal mirroring (text reads backwards)
- Vertical inversion (content upside down)
- Both combined (180-degree rotation effect)

## The Solution

In your shader's `fragment()` function, flip the UV coordinates:

```glsl
void fragment() {
    // Flip UV.y to correct for PlaneMesh rotation
    vec2 corrected_uv = vec2(UV.x, 1.0 - UV.y);

    // Sample texture with corrected UVs
    vec4 tex_color = texture(page_texture, corrected_uv);

    // ... rest of fragment shader
}
```

### Which coordinate to flip?

| Symptom | Fix |
|---------|-----|
| Text upside down | Flip Y: `vec2(UV.x, 1.0 - UV.y)` |
| Text mirrored horizontally | Flip X: `vec2(1.0 - UV.x, UV.y)` |
| Both (180° rotated) | Flip both: `vec2(1.0 - UV.x, 1.0 - UV.y)` |

### For PlaneMesh rotated -90° on X axis

The standard fix is **flip Y only**:
```glsl
vec2 corrected_uv = vec2(UV.x, 1.0 - UV.y);
```

## Alternative: Change Mesh Orientation

Instead of fixing in shader, you can use PlaneMesh's `orientation` property:

```gdscript
var plane := PlaneMesh.new()
plane.orientation = PlaneMesh.FACE_Z  # Face camera by default
# No rotation needed, UVs work as expected
```

However, the shader fix is more flexible and works with any mesh setup.

## Related Files

- `godot-client/shaders/page_curl.gdshader` - Page shader with UV fix
- `godot-client/scripts/book_page.gd` - SubViewport → texture pipeline

## Verification

After applying fix:
1. Text should read left-to-right
2. Content should be right-side up
3. First line of content should be at top of mesh
