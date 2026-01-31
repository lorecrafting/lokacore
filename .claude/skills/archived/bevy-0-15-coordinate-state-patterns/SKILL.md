---
name: bevy-0-15-coordinate-state-patterns
description: |
  Fix Bevy coordinate system bugs and state machine reset issues. Use when: (1) UV-based
  hit testing (raycasting, click detection) detects taps but doesn't match calculated regions,
  (2) Y-axis coordinates are inverted between pixel space and UV space, (3) state machine
  animations complete but phase/state isn't ready for next transition, (4) explicit enum
  resets needed after animation completes. Applies to Bevy 0.15 game engine development.
author: Claude Code
version: 1.0.0
date: 2026-01-25
---

# Bevy 0.15 Coordinate System & State Machine Patterns

## Problem

Two common issues in Bevy game development:

1. **UV Coordinate Y-Axis Mismatch**: Ray-mesh intersection and click detection work, but
   calculated UI regions don't match actual tap locations due to Y-axis orientation differences.

2. **State Machine Reset Incomplete**: Animation completes and transitions to Idle phase, but
   state isn't properly reset for the next transition, causing "Cannot navigate - in progress"
   even when visibly idle.

## Context / Trigger Conditions

### Coordinate System Issues
- Ray-mesh intersection returns valid UV coordinates
- Tap events fire with correct UV values logged
- Link regions calculated but hit testing always returns `None`
- Clicking on elements that should be clickable has no effect
- Working with texture coordinates, UI bounds, or mesh UVs

### State Machine Issues
- Animation completes successfully
- Phase transitions to `Idle` in animation system
- Next interaction attempt fails with "already in progress" error
- Visual state shows idle but internal state blocks new transitions
- Custom state machines with phase enums (not Bevy's built-in States API)

## Solution

### UV Coordinate Y-Axis Fix

**Root Cause**: Bevy's UV coordinate system has Y=0 at **bottom-left**, but pixel/screen
coordinates typically have Y=0 at **top**. When calculating UI bounds in pixel space
then converting to UV space, you must flip the Y axis.

**Pattern**:
```rust
// ❌ WRONG: Direct pixel-to-UV conversion
let uv_y = pixel_y / texture_height as f32;

// ✅ CORRECT: Flip Y axis when converting
let uv_y = 1.0 - (pixel_y / texture_height as f32);

// Full example for bounding box:
let bounds = Rect::new(
    pixel_x / width as f32,              // X stays the same
    1.0 - ((pixel_y + height) / texture_height as f32),  // Y flipped (min)
    (pixel_x + width) / width as f32,    // X stays the same
    1.0 - (pixel_y / texture_height as f32),            // Y flipped (max)
);
```

**Key Facts** (from [Bevy Cheat Book](https://bevy-cheatbook.github.io/pitfalls/uv-coordinates.html)):
- Bevy UV space: bottom-left = (0.0, 0.0), top-right = (1.0, 1.0)
- This matches DirectX, Vulkan, Metal, WebGPU (but NOT OpenGL)
- If migrating from OpenGL, textures may appear vertically flipped

### State Machine Reset Pattern

**Root Cause**: Animation systems set phase to `Idle` when settling completes, but
race conditions or edge cases can occur where the phase isn't explicitly reset in
the reset function, leaving stale state.

**Pattern**:
```rust
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AnimationPhase {
    Idle,
    Animating,
    Settling,
}

pub struct AnimationState {
    pub phase: AnimationPhase,
    pub progress: f32,
    pub completed: bool,
}

impl AnimationState {
    // ❌ WRONG: Incomplete reset (assumes phase was already set)
    pub fn reset_after_completion(&mut self) {
        self.progress = 0.0;
        self.completed = false;
        // Missing: phase reset!
    }

    // ✅ CORRECT: Explicit phase reset
    pub fn reset_after_completion(&mut self) {
        self.progress = 0.0;
        self.completed = false;
        self.phase = AnimationPhase::Idle;  // Always explicitly reset phase
    }
}
```

**Why This Matters**:
- Animation completion and state reset happen in different systems
- Systems run in parallel, creating race conditions
- Explicit reset ensures deterministic state regardless of system ordering
- Prevents "ghost locks" where visual state is idle but internal state blocks new actions

## Verification

### UV Coordinate Fix
1. Add debug logging to show calculated UV bounds:
   ```rust
   info!("Link region: '{}' @ ({:.3}, {:.3}) -> ({:.3}, {:.3})",
         text, bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y);
   ```
2. Click on UI elements - should see "Link tapped: [action]" instead of "Page tapped"
3. Verify hit testing returns correct action IDs

### State Machine Fix
1. Add logging to reset function:
   ```rust
   info!("reset_after_turn: phase was {:?}, now {:?}", old_phase, self.phase);
   ```
2. Complete one animation cycle
3. Immediately attempt second animation - should succeed without "in progress" error
4. Verify continuous animations work (3+ cycles without manual intervention)

## Example: Book Client Link Detection

**Scenario**: Interactive book with clickable links on page. Tap detection works (logs UV
coordinates) but links never trigger.

**Investigation**:
```rust
// Link region calculation (pixel space)
let mut current_y = margin;  // Start at top
current_y += line_height;    // Move down in pixel space

// ❌ BUG: Direct conversion to UV
let bounds = Rect::new(
    x_start / width as f32,
    current_y / height as f32,        // Wrong: Y=0 is at bottom in UV space
    x_end / width as f32,
    (current_y + font_size) / height as f32,
);
```

**Fix**:
```rust
// ✅ CORRECT: Flip Y axis
let uv_min_y = 1.0 - ((current_y + font_size) / height as f32);
let uv_max_y = 1.0 - (current_y / height as f32);
let bounds = Rect::new(
    x_start / width as f32,
    uv_min_y,
    x_end / width as f32,
    uv_max_y,
);
```

**Result**: Links now correctly detect taps and trigger page turns/events.

## Notes

### UV Coordinates
- This only affects UV/texture coordinate conversions, not world-space coordinates
- Bevy's world space has Y-up (standard 3D convention)
- Only OpenGL uses Y=0 at top for textures; all modern APIs use Y=0 at bottom
- Always verify which coordinate space you're working in before conversion

### State Machine
- This pattern applies to custom state machines (phase enums), not Bevy's built-in
  `State<T>` and `NextState<T>` API
- For app-wide state, prefer Bevy's built-in States system
- For entity-specific state (animation phases, AI states), custom enums are appropriate
- Consider using third-party libraries like `seldom_state` for complex state machines

### Debugging Tips
1. **Visual verification first**: In game engines, watch the window, not just logs
2. **Log both coordinate systems**: Print pixel coords AND UV coords during conversion
3. **Animate slowly**: Slow down animations to 5-10 seconds to observe phase transitions
4. **Add phase logging**: Log phase changes in every state transition

## References

- [Bevy Cheat Book: UV Coordinates](https://bevy-cheatbook.github.io/pitfalls/uv-coordinates.html)
- [Bevy Cheat Book: Coordinate Systems](https://bevy-cheatbook.github.io/fundamentals/coords.html)
- [Bevy States Documentation](https://bevy-cheatbook.github.io/programming/states.html)
- [Bevy API: bevy::state](https://docs.rs/bevy/latest/bevy/state/index.html)
- [seldom_state: Component-based State Machine](https://github.com/Seldom-SE/seldom_state)
