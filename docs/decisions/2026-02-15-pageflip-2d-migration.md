# PageFlip 2D Migration

**Date:** 2026-02-15
**Status:** Complete
**Author:** Raymond Luong

## Summary

Migrated the Godot client from a 3D vertex-shader page curl system to a 2D bone-based PageFlip plugin. The book is now a Node2D scene with Skeleton2D page deformation instead of PlaneMesh + spatial shader.

## Why We Migrated

The old 3D system had several pain points:

1. **Complex UV math**: Converting screen touches to 3D mesh UV coordinates required raycasting, hit detection, and UV flipping corrections. Each platform (web, mobile) behaved differently.
2. **WebGL banding artifacts**: The spatial shader produced horizontal banding on web exports that required workarounds (`unshaded` render mode).
3. **SubViewport texture compositing**: Two PlaneMesh pages each needed a SubViewport rendered to texture, then composited by a spatial shader. This was fragile and GPU-heavy for mobile.
4. **Shader complexity**: `page_curl.gdshader` combined vertex curl deformation with text effects (burn/ice/glow/fade) in a single spatial shader, making it hard to modify either independently.

The 2D approach eliminates all of these: clicks map directly to viewport coordinates, there's no UV math, no 3D rendering pipeline overhead, and effects are separated into their own canvas_item shader.

## What Changed

### File Mapping

| Old (3D) | New (2D) | Purpose |
|-----------|----------|---------|
| `scripts/book_page.gd` | `scripts/loka_book.gd` | Main book controller |
| `scripts/page_mesh_factory.gd` | `scripts/page_content_manager.gd` | Viewport/content factory |
| `scripts/main.gd` | `scripts/main_2d.gd` | Scene controller |
| `scenes/main.tscn` | `scenes/main_2d.tscn` | Root scene |
| `shaders/page_curl.gdshader` | `shaders/page_effects.gdshader` | Effects only (no curl) |
| (inline in book_page.gd) | `scripts/bottom_bar.gd` | Extracted fixed overlay |
| (inline in book_page.gd) | `scripts/effects_controller.gd` | Extracted effects manager |
| N/A | `addons/PageFlip/*` | Vendored PageFlip plugin |

### Deleted Files

- `scripts/book_page.gd` (replaced by `loka_book.gd`)
- `scripts/page_mesh_factory.gd` (replaced by `page_content_manager.gd`)
- `scripts/main.gd` (replaced by `main_2d.gd`)
- `scenes/main.tscn` (replaced by `main_2d.tscn`)
- `shaders/page_curl.gdshader` (replaced by `page_effects.gdshader`)
- `scripts/tests/test_book_page.gd` (replaced by `test_loka_book.gd`)

### Unchanged Files

All content renderers are unchanged:
- `scripts/page_content_renderer.gd` (BBCode generation)
- `scripts/menu_tab_renderer.gd` (menu tab content)
- `scripts/dialogue_controller.gd` (dialogue flow)
- `scripts/shop_container_handler.gd` (shop/container UI)

These produce BBCode strings consumed by RichTextLabel, which works identically in 2D.

## Architecture

### Old (3D)

```
Main (Node3D)
  Camera3D
  BookPage (Node3D)
    PlaneMesh (top page) + SubViewport + spatial shader
    PlaneMesh (bottom page) + SubViewport + spatial shader
    page_curl.gdshader (vertex curl + text effects combined)
```

### New (2D)

```
Main (Node2D)
  LokaBook (Node2D)
    PageFlip2D (addon) - bone deformation, volume, spine, sound
    EffectsController (Node) - burn/ice/glow/fade + atmosphere
    SubViewport (right page content)
    SubViewport (right page back buffer)
    SubViewport (left decorative page)
  UILayer (CanvasLayer)
    BottomBar (Control) - fixed compass + action buttons
  CanvasLayer
    ChatModal, LoginPanel (overlays)
```

## Key Design Decisions

### Single Dynamic Page

Only the right page shows game content. The left page is decorative parchment (mostly off-camera). This simplifies the content pipeline: one viewport to manage instead of two.

### Bottom Bar Extraction

The bottom bar (compass, menu button, say button) was previously rendered inside each page's SubViewport. Now it's a separate `BottomBar` Control on a CanvasLayer, staying fixed during page turns. This eliminates the need to re-render navigation buttons on every page change.

### Effects Pipeline Separation

Text effects (burn, ice, glow, fade) are now in a dedicated `EffectsController` node with its own `canvas_item` shader (`page_effects.gdshader`). The old system combined vertex curl deformation and text effects in a single spatial shader. Separating them means:
- Effects can be tweaked without touching page animation
- The shader is simpler (canvas_item, no vertex stage)
- Particle systems (GPUParticles2D) for burn/ice are managed by EffectsController

### PageFlip Plugin

The PageFlip plugin is vendored at `addons/PageFlip/` (MIT license). Key integration points:
- `PageFlip2D` manages Skeleton2D bone deformation for page turns
- 4 slot system: static left/right + animation face A/B
- Our viewports are injected into slots as TextureRect children
- Signals: `started_page_flip_animation`, `ended_page_flip_animation`
- We use `OPEN_AT_PAGE` start option with `NEVER` close condition

The plugin handles:
- Bone-based page deformation (no vertex shader needed)
- Volume rendering (fake 3D page stack)
- Spine rendering
- Sound effects (page flip, cover slam)
- Camera fitting

We handle:
- Content viewport creation and management
- Content rendering (BBCode via existing renderers)
- Input routing (click detection, scroll, drag)
- Page turn orchestration (which content to show)
- Text effects and atmosphere

### Camera Framing

The camera should primarily show the right page (game content) with a bit of the spine visible. The left decorative page is mostly off-camera. PageFlip's built-in Camera2D handles zoom fitting.
