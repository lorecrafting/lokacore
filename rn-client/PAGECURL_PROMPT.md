# Page Curl Rewrite — Mesh-Based Approach (Godot Replica)

## Goal

Rewrite the page curl animation in the React Native Expo PoC to use **Skia's `Vertices` component** with a deformable triangle mesh, exactly replicating how Godot's PageFlip addon works. The current fragment-shader-only approach looks like a scroll cylinder sliding across the page — it doesn't look like a real page being turned.

## Why the current approach fails

The current `PageCurlAnimation.tsx` uses a pure fragment shader that paints "zones" (flat/curl/revealed) based on screen position. Even with UV remapping, this looks like a cylinder rolling across because:
1. No actual geometry deformation — text doesn't physically move with a mesh
2. The "curl" is just lighting painted in a strip
3. There's no real depth — the departing page and arriving page appear at the same visual depth

## How Godot does it (exact replica target)

Godot's PageFlip uses **Skeleton2D bone chains deforming a Polygon2D mesh**. The shader only handles front/back face detection and spine shadow. Here are the exact values from `page_rigger.gd`:

### Mesh: 9×6 vertex grid (subdivision_x=8, subdivision_y=5)
- 54 vertices in a `(subdivision_x+1) × (subdivision_y+1)` grid
- `step_x = page_width / 8`, `step_y = page_height / 5`
- UV coordinates = vertex positions (1:1 mapping)
- Quads triangulated: each cell `[i, i+1, i+rc+1, i+rc]` where `rc = 9`

### Bone chains: one per row, spine → tip
- 6 rows (y=0..5), each with 9 bones (x=0..8)
- x=0 bones are "root/spine" bones, direct children of skeleton
- x>0 bones are children of the previous bone in the same row
- Each bone has `length = step_x`

### Skinning weights
- Each vertex skinned to 3 bones (prev, self, next in same row)
- Center weight: 0.7, neighbor weight: 0.15 each
- Edge vertices absorb missing neighbor weight (0.85 on self)

### STANDARD_PAPER preset (what Loka uses)
- `paper_stiffness = 2.5`
- `lift_bend = -12.0` degrees
- `land_bend = 3.0` degrees
- `curl_mode = TOP_CORNER_FIRST`
- `curl_lag = 0.4`
- `anim_duration = 0.65` seconds
- `timing_peak_lift = 0.12`
- `timing_peak_land = 0.88`

### Animation keyframes (the core algorithm)

**Per-row timing (diagonal fold):**
```
y_ratio = y / subdivision_y           // 0.0 at top, 1.0 at bottom
row_factor = lerp(1.0, 1.0 - curl_lag, y_ratio)  // TOP_CORNER_FIRST
// With curl_lag=0.4: top row_factor=1.0, bottom row_factor=0.6

time_offset = (1.0 - row_factor) * (anim_duration * 0.1)
// Top: 0ms delay. Bottom: 0.4 * 0.065 = 0.026s delay
```

**Root bones (x=0) — spine hinge rotation:**
```
t_lift = clamp(duration * 0.12 + time_offset, 0, duration*0.5 - 0.05)
t_mid = duration * 0.5
t_land = clamp(duration * 0.88 - time_offset, t_mid + 0.05, duration)
t_settle = lerp(t_land, duration, 0.7)

Forward keyframes (rotation_degrees):
  0.0      → 0.0         (flat right)
  t_lift   → -15.0 * row_factor    (initial tilt)
  t_mid    → -90.0       (perpendicular)
  t_land   → lerp(-90, -180, 0.88)  = -169.2
  t_settle → lerp(-169.2, -179.9, 0.85) = -178.0
  duration → -179.9      (flat left)
```

**Surface bones (x>0) — bend relative to parent:**
```
x_ratio = x / subdivision_x
influence = pow(x_ratio, paper_stiffness)  // pow(ratio, 2.5)
// x=1: pow(0.125, 2.5) = 0.0055 (barely bends)
// x=4: pow(0.5, 2.5) = 0.177
// x=8: pow(1.0, 2.5) = 1.0 (full bend at tip)

Forward keyframes (rotation_degrees):
  0.0      → 0.0
  t_lift   → lift_bend * row_factor * influence  = -12.0 * rf * inf
  t_land   → land_bend * row_factor * influence  = 3.0 * rf * inf
  t_settle → val_land * 0.15
  duration → 0.0
```

**Scale squash (at midpoint):**
```
  0.0                → Vector2(1, 1)
  t_mid              → Vector2(1, 1)
  t_mid + dur*0.1    → Vector2(0.88, 1)   // squash when edge-on
  dur * 0.85         → Vector2(1, 1)
  duration           → Vector2(1, 1)
```

**Z-index track:**
```
  0.0          → 10
  dur * 0.15   → 25   (lift above other layers)
  dur * 0.65   → 10   (land back)
```

### Godot's shader (only does face detection + shadow)
```glsl
// Face detection via UV derivative cross-product
vec2 uv_dx = dFdx(UV);
vec2 uv_dy = dFdy(UV);
float face_dir = uv_dx.x * uv_dy.y - uv_dx.y * uv_dy.x;
bool is_front = face_dir > 0.0;

// Front: sample front_texture at UV
// Back: sample back_texture at vec2(1.0 - UV.x, UV.y)  ← mirrored

// Spine shadow: gradient from UV.x=0 (spine edge), modulated by shadow_intensity
// shadow_intensity tweened: 0→0.65 over first half, 0.65→0 over second half
// max_shadow_spread default: 0.35
```

### Shadow intensity tween
```
Phase 1 (0 → half_duration):  shadow_intensity 0.0 → 0.65, CUBIC EASE_OUT
Phase 2 (half → half + half*0.8): shadow_intensity 0.65 → 0.0, CUBIC EASE_IN
```

## Implementation plan for React Native Skia

### Approach: Skia `Vertices` with animated positions

React Native Skia's `<Vertices>` component accepts:
- `vertices`: array of `SkPoint` (screen positions)
- `textures`: array of `SkPoint` (UV coordinates into the image)
- `indices`: triangle indices
- Wrapped in a `<Group>` with `<ImageShader>` for texture mapping

We compute vertex positions each frame using `useDerivedValue` based on the animation progress, replicating Godot's bone chain rotation math.

### Files to modify

1. **`src/components/PageCurlAnimation.tsx`** — Complete rewrite:
   - Replace `Fill` + `Shader` with `Vertices` + `ImageShader`
   - Create a 9×6 vertex grid (matching Godot's default subdivision)
   - Each frame, compute vertex positions by simulating bone chain rotation:
     - For each row: compute root bone angle (0→-90→-180)
     - For each bone in the chain: add surface bend (lift_bend/land_bend * influence)
     - Chain the rotations: each bone's position = parent position + rotated offset
   - Set `textures` to the original grid UVs (unchanged during animation)
   - The `vertices` positions change each frame → mesh deforms → text bends
   - For front/back face: use two draw passes or a shader that checks face orientation
   - For the BACK face: draw a second `Vertices` with parchment-back color and mirrored UVs
   - **The revealed page underneath is the live React tree** — the Canvas sits on top with transparent background. Where the mesh has moved away, the new page shows through.

2. **`src/components/BookController.tsx`** — Minor adjustments:
   - May need to pass both `departingImage` AND `arrivingImage` if we want back-face content
   - For PoC: back face = solid parchment color (no image needed)

### Vertex position computation (per frame)

```typescript
function computeVertices(
  progress: number,     // 0→1
  pageWidth: number,
  pageHeight: number,
  subdivX: number = 8,
  subdivY: number = 5,
): { vertices: SkPoint[], textures: SkPoint[], indices: number[] } {
  const stepX = pageWidth / subdivX;
  const stepY = pageHeight / subdivY;
  const vertices: SkPoint[] = [];
  const textures: SkPoint[] = [];

  // STANDARD_PAPER values
  const stiffness = 2.5;
  const liftBend = -12.0;
  const landBend = 3.0;
  const curlLag = 0.4;
  const duration = 0.65;
  const tPeakLift = 0.12;
  const tPeakLand = 0.88;

  const t = progress * duration; // current time in animation
  const tMid = duration * 0.5;

  for (let row = 0; row <= subdivY; row++) {
    const yRatio = row / subdivY;
    const rowFactor = lerp(1.0, 1.0 - curlLag, yRatio); // TOP_CORNER_FIRST
    const timeOffset = (1.0 - rowFactor) * duration * 0.1;

    const tLift = clamp(duration * tPeakLift + timeOffset, 0, tMid - 0.05);
    const tLand = clamp(duration * tPeakLand - timeOffset, tMid + 0.05, duration);

    // Root bone angle (spine rotation)
    const rootAngle = computeRootAngle(t, tLift, tMid, tLand, duration, rowFactor);

    // Chain bone positions
    let parentX = 0;  // spine is at x=0
    let parentY = row * stepY;
    let parentAngle = rootAngle;

    for (let col = 0; col <= subdivX; col++) {
      if (col === 0) {
        // Root bone position (at spine)
        vertices.push(vec(parentX, parentY));
      } else {
        // Surface bone: add bend relative to parent
        const xRatio = col / subdivX;
        const influence = Math.pow(xRatio, stiffness);
        const surfaceBend = computeSurfaceBend(t, tLift, tLand, duration,
                                                liftBend, landBend, rowFactor, influence);

        const totalAngle = parentAngle + surfaceBend;
        const boneX = parentX + Math.cos(totalAngle * DEG2RAD) * stepX;
        const boneY = parentY + Math.sin(totalAngle * DEG2RAD) * stepX;

        vertices.push(vec(boneX, boneY));
        parentX = boneX;
        parentY = boneY;
        parentAngle = totalAngle;
      }

      // UVs stay at original grid positions (texture doesn't change)
      textures.push(vec(col * stepX, row * stepY));
    }
  }

  // Build triangle indices from quads
  const indices = buildQuadIndices(subdivX, subdivY);

  return { vertices, textures, indices };
}
```

### Key implementation notes

1. **`useDerivedValue`** to recompute vertices each frame based on `progress.value`
2. **Two rendering layers:**
   - Bottom: Live React tree showing new page content
   - Top: Skia Canvas with `Vertices` mesh showing the curling old page
   - Where the mesh has moved away from its original position, the Canvas background is transparent → new page shows through
3. **Front/back face:** Can be detected in a simple SkSL shader using `dFdx`/`dFdy` on the UV coordinates (same as Godot). Or render two passes: front-face triangles with page image, back-face triangles with parchment color.
4. **Shadow:** A separate semi-transparent dark gradient near the spine edge of the mesh, animated 0→0.65→0 intensity.
5. **Scale squash at midpoint:** Briefly compress x-scale to 0.88 when the page is edge-on (t_mid + 10% of duration).
6. **The spine is at x=0** (left edge of the page). The page rotates around the left edge, sweeping from right to left.

### Important Skia API details

```tsx
// Vertices with image texture:
<Canvas style={{ width, height }}>
  <Group>
    <ImageShader image={departingImage} fit="fill"
                 rect={{ x: 0, y: 0, width: pageWidth, height: pageHeight }} />
    <Vertices
      vertices={animatedVertices}   // changes each frame
      textures={staticTextures}     // stays constant
      indices={triangleIndices}     // stays constant
    />
  </Group>
</Canvas>

// makeImageFromView captures a React Native View as SkImage:
import { makeImageFromView } from '@shopify/react-native-skia';
const image = await makeImageFromView(viewRef);  // takes RefObject, returns Promise<SkImage>
// The captured view MUST have collapsable={false}
```

### What NOT to change
- `BookController.tsx` architecture (capture → swap → animate) is correct, keep it
- `NavigationContext.tsx` is fine
- `BottomBar.tsx`, `mockRooms.ts`, store changes are all good
- The `usePageSound` hook, login flow, etc. — don't touch

### After implementation
- Press Cmd+R in the iOS Simulator to do a full JS reload (module-level shader cache needs to reset)
- Tap "Enter as Guest" to get past login
- Tap a compass direction (N/E/S) to trigger the page curl
- The page should now physically deform — text bends with the mesh vertices — and sweep diagonally from the top-right corner, exactly like Godot's PageFlip
