# Godot Client Audit

Comprehensive audit of the Godot 4.6 mobile client for WebGL compatibility, performance, and reliability.

> **Important**: This audit produces a **report only**. No changes are made automatically. After reviewing the report, prompt "fix [issue]" to address specific findings.

## When to Run

- After modifying shaders (`.gdshader` files)
- After changes to SubViewport or click detection logic
- After adding new VFX or animations
- Before releases to catch client regressions
- After Godot version upgrades

## Timeout Budget: 10 minutes

## Phase 1: Build Pipeline Verification

### 1.1 Script Validation

```bash
cd godot-client && ./check.sh
```

**Check for:**
- [ ] Exit code 0 (all scripts valid)
- [ ] No GDScript syntax errors
- [ ] No missing class references
- [ ] No undefined signals

### 1.2 Web Export Build

```bash
cd godot-client && ./build_web.sh --fast
```

**Check for:**
- [ ] Build completes without errors
- [ ] `build/web/index.html` exists
- [ ] `build/web/*.wasm` files generated
- [ ] No export template warnings

### 1.3 Project Configuration

Read `project.godot` and verify:
- [ ] `config/features` includes "Mobile"
- [ ] Renderer is `gl_compatibility` (required for WebGL)
- [ ] Autoloads are correctly configured (GameState, MockWorld)

## Phase 2: Shader Audit

### 2.1 WebGL Compatibility

Search all `.gdshader` files for potential WebGL issues:

```bash
cd godot-client
grep -r "shader_type spatial" shaders/
grep -r "render_mode" shaders/
```

**Check for:**
- [ ] All spatial shaders have `render_mode unshaded` (prevents horizontal banding)
- [ ] No unsupported GLSL features for WebGL 2.0
- [ ] No `#if` preprocessor directives (not supported in Godot shaders)
- [ ] Texture samplers use appropriate filtering

### 2.2 Known Shader Patterns

Verify these patterns are followed (see skills):

| Pattern | File | Check |
|---------|------|-------|
| Horizontal banding fix | All spatial shaders | Has `render_mode unshaded` |
| UV correction for PlaneMesh | page_curl.gdshader | Flips UV.y where needed |
| Dual viewport effects | Shaders using masks | Proper sampler declarations |

### 2.3 Shader Compilation Test

If browser automation available:
1. Navigate to `build/web/index.html`
2. Check console for shader compilation errors
3. Verify no black screen on load

## Phase 3: SubViewport & Click Detection

### 3.1 SubViewport Configuration

Search for SubViewport usage in scripts:

```bash
cd godot-client
grep -r "SubViewport" scripts/ scenes/
```

**Check for:**
- [ ] SubViewport size matches expected dimensions
- [ ] `render_target_update_mode` is appropriate
- [ ] Texture is properly applied to 3D mesh material

### 3.2 Click Detection Patterns

Review click handling in main scripts:

**Check for:**
- [ ] Uses raycast → UV → viewport coordinate conversion (not direct click)
- [ ] Y-axis is properly inverted for UV space
- [ ] Uses region-based detection (not pixel-precise) for reliability
- [ ] RichTextLabel meta tags used where appropriate

### 3.3 Known Click Detection Files

Review these files for correct patterns:
- `scripts/book_page.gd` - Page click handling
- `scripts/main.gd` - Input routing

## Phase 4: JavaScript Bridge (Web Export)

### 4.1 Callback Storage

Search for JavaScript bridge usage:

```bash
cd godot-client
grep -r "JavaScriptBridge" scripts/
grep -r "create_callback" scripts/
```

**Check for:**
- [ ] All callbacks stored in member variables (prevent GC)
- [ ] No inline callback creation without storage
- [ ] Callbacks cleaned up in `_exit_tree` if needed

### 4.2 Bridge Pattern

Verify this pattern is followed:

```gdscript
# ✅ CORRECT - stored in member variable
var _js_callback: JavaScriptObject

func _ready() -> void:
    _js_callback = JavaScriptBridge.create_callback(_handler)

# ❌ WRONG - will be garbage collected
func _ready() -> void:
    var callback = JavaScriptBridge.create_callback(_handler)
```

## Phase 5: Performance Audit

### 5.1 Frame Budget

Target: 16.6ms per frame (60 FPS)

**Check for performance-heavy patterns:**
- [ ] No `_process` functions doing heavy computation
- [ ] Particle systems use pre-baked sprite sheets (not runtime physics)
- [ ] Textures use appropriate sizes (≤2048x2048 for mobile)
- [ ] Object pooling for frequently spawned objects

### 5.2 VFX Patterns

Review any visual effects for optimization:

| Pattern | Check |
|---------|-------|
| Sprite sheet animations | Preferred over GPUParticles |
| Texture atlases | Reduces draw calls |
| Shader-based "fake" particles | Single quad for many particles |
| LOD for effects | Simpler effects at distance |

### 5.3 Memory Usage

**Check for:**
- [ ] No large textures loaded unnecessarily
- [ ] Scenes properly freed when not needed
- [ ] No memory leaks in long-running autoloads

## Phase 6: Mobile Compatibility

### 6.1 Touch Input

**Check for:**
- [ ] Touch events handled (not just mouse)
- [ ] Multi-touch if needed
- [ ] Appropriate touch target sizes (≥44px)

### 6.2 Screen Sizes

**Check for:**
- [ ] UI scales appropriately
- [ ] No hardcoded pixel positions
- [ ] Safe areas respected (notches, home indicators)

### 6.3 WebGL Constraints

**Check for:**
- [ ] No features requiring WebGL extensions not widely supported
- [ ] Fallbacks for older mobile browsers
- [ ] CORS considerations for assets

## Output Format

```markdown
# Godot Client Audit Report

## Summary
- Scripts: ✅ Valid | ❌ X errors
- Build: ✅ Passes | ❌ Failed
- Shaders: ✅ WebGL compatible | ⚠️ N issues
- Click Detection: ✅ Correct patterns | ⚠️ N issues
- JS Bridge: ✅ Proper storage | ⚠️ N issues
- Performance: ✅ Within budget | ⚠️ N concerns

## Critical Issues (Fix Immediately)

### 1. [Issue Title]
**File**: path/to/file.gd
**Line**: ~XX
**Issue**: [Description]
**Impact**: [What breaks]
**Fix**: [How to fix]

## High Priority

[List issues]

## Medium Priority

[List issues]

## Low Priority

[List issues]

## Metrics
- GDScript files checked: X
- Shaders checked: X
- SubViewports found: X
- JS Bridge callbacks: X

## Recommendations
1. [Specific action]
2. [Specific action]

## Status
✅ CLIENT HEALTHY | ⚠️ NEEDS ATTENTION | ❌ CRITICAL ISSUES
```

## Success Criteria

- All scripts pass validation
- Web build completes successfully
- No WebGL shader compatibility issues
- Click detection follows documented patterns
- JavaScript callbacks properly stored
- Performance within mobile budgets

## Related Skills

These skills document known patterns and fixes:
- `.claude/skills/godot-webgl-horizontal-banding-fix.md`
- `.claude/skills/godot-subviewport-3d-click-detection.md`
- `.claude/skills/godot-javascript-bridge-callbacks.md`
- `.claude/skills/godot-planemesh-uv-fix.md`
- `.claude/skills/godot-vfx-optimization.md`
- `.claude/skills/godot-class-property-access.md`

## Notes

- This audit focuses on web/mobile builds (the primary deployment target)
- Desktop-specific issues are lower priority
- Browser automation can verify visual rendering if available
