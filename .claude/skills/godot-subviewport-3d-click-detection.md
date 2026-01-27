# Godot SubViewport 3D Click Detection

## Problem

When rendering UI inside a SubViewport that's applied as a texture to a 3D mesh (e.g., a book page), buttons and interactive elements don't receive mouse/touch input automatically. Godot's input system doesn't propagate clicks through 3D meshes to SubViewport contents.

## Trigger Conditions

Use this skill when:
- You have a SubViewport rendered as a texture on a 3D mesh
- You need interactive UI elements (buttons, etc.) inside that SubViewport
- Clicks on the 3D mesh should trigger UI actions

## Solution

Handle input on the 3D mesh and manually map screen coordinates to SubViewport coordinates.

### Step 1: Intercept Input Events

```gdscript
func _input(event: InputEvent) -> void:
    if not visible:
        return

    # Handle mouse clicks
    if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
        _handle_page_click(event.position)
    # Handle touch
    elif event is InputEventScreenTouch and event.pressed:
        _handle_page_click(event.position)
```

### Step 2: Raycast and Plane Intersection

```gdscript
func _handle_page_click(screen_pos: Vector2) -> void:
    var camera := get_viewport().get_camera_3d()
    if not camera:
        return

    # Cast ray from camera through click position
    var from := camera.project_ray_origin(screen_pos)
    var dir := camera.project_ray_normal(screen_pos)

    # Plane intersection (for mesh at z=0 facing camera)
    if abs(dir.z) < 0.001:
        return  # Ray parallel to plane

    var t := -from.z / dir.z
    if t < 0:
        return  # Behind camera

    var hit_point := from + dir * t
```

### Step 3: Convert to UV Coordinates

```gdscript
    # Convert hit point to UV (assuming mesh centered at origin)
    var uv_x := (hit_point.x / PAGE_WIDTH) + 0.5
    var uv_y := (hit_point.y / PAGE_HEIGHT) + 0.5

    # Check bounds
    if uv_x < 0 or uv_x > 1 or uv_y < 0 or uv_y > 1:
        return
```

### Step 4: Convert to Viewport Coordinates

```gdscript
    # UV to viewport pixels (note: UV y=0 is bottom, viewport y=0 is top)
    var vp_x := uv_x * VIEWPORT_WIDTH
    var vp_y := (1.0 - uv_y) * VIEWPORT_HEIGHT

    # Now use vp_x, vp_y to determine which UI element was clicked
    _handle_ui_click(vp_x, vp_y)
```

### Step 5: Region-Based Button Detection

For reliable click detection, use region-based (e.g., thirds) rather than pixel-precise detection:

```gdscript
func _handle_ui_click(vp_x: float, vp_y: float) -> void:
    # Divide into thirds for simpler detection
    var third := VIEWPORT_WIDTH / 3.0

    if vp_x < third:
        # Left region
        emit_signal("left_button_pressed")
    elif vp_x > (VIEWPORT_WIDTH - third):
        # Right region
        emit_signal("right_button_pressed")
    else:
        # Middle region
        emit_signal("center_pressed")
```

## Key Gotchas

1. **Mesh Rotation**: If mesh is rotated (e.g., PlaneMesh rotated -90° on X), the hit point coordinate system changes. Verify which axis corresponds to which UV direction.

2. **UV Inversion**: SubViewport y=0 is at top, but UV y=0 may be at bottom. Use `(1.0 - uv_y)` to correct.

3. **Precise vs Region Detection**: Pixel-precise button detection often fails due to floating-point precision. Region-based (thirds, halves) is more robust.

4. **Camera Projection**: Use `project_ray_origin` and `project_ray_normal` for perspective cameras. For orthographic, the math differs.

## When NOT to Use

- If UI doesn't need to be on a 3D mesh, use regular 2D UI (CanvasLayer)
- For simple overlays, 2D UI is much simpler
- This pattern is specifically for "UI embedded in 3D world" scenarios (like a magic book)

## Related

- `.claude/skills/godot-planemesh-uv-fix.md` - UV orientation issues on rotated meshes
