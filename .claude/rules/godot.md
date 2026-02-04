---
paths: ["godot-client/**"]
---

# Godot Client Development Context

This context auto-loads when working in `godot-client/`.

The client is a mobile 3D "magic book" built with Godot 4.6. Stateless visual layer connecting to Phoenix server via WebSocket.

## Development Workflow

```bash
./dev.sh                          # Hot reload (~1s per change) - RECOMMENDED
./build_web.sh --fast             # Quick build (~30s)
./build_web.sh                    # Full build (~45s, release)
./check.sh                        # Validate scripts (headless) - ALWAYS run after changes
./run_tests.sh [suite]            # Run unit tests
```

### Web Verification Loop (for Claude Code)

1. Make code changes to `.gd` scripts or `.gdshader` files
2. Validate syntax: `./check.sh`
3. Build web export: `./build_web.sh --fast`
4. Serve and verify: `./verify_web.sh --open` or browser automation
5. Iterate if issues found

## Key Files

| File | Purpose |
|------|---------|
| `scripts/game_state.gd` | Autoload: room state, navigation |
| `scripts/mock_world.gd` | Autoload: test world data |
| `scripts/book_page.gd` | 3D page mesh, SubViewport text, curl animation, effects |
| `scripts/main.gd` | Camera, input routing, login flow |
| `shaders/page_curl.gdshader` | GPU page curl + text effects (burn, ice, glow, fade) |
| `export_templates/debug_shell.html` | Web debug toolbar |

## GDScript Patterns

```gdscript
# Signals (Godot 4.6 syntax)
signal room_changed(new_room: Room)
func navigate(direction: String) -> void:
    room_changed.emit(new_room)

# Autoload singletons (configured in project.godot)
GameState.navigate("north")
MockWorld.get_room("courtyard")
```

## Common Gotchas

| Issue | Quick Fix | Skill File |
|-------|-----------|------------|
| SubViewport clicks on 3D mesh | Raycast → UV → viewport coords | `godot-subviewport-3d-click-detection.md` |
| WebGL horizontal banding | Add `unshaded` to render_mode | `godot-webgl-horizontal-banding-fix.md` |
| JS callbacks garbage collected | Store in member variable | `godot-javascript-bridge-callbacks.md` |
| UV orientation on rotated mesh | Flip UV.y in shader | `godot-planemesh-uv-fix.md` |
| `.get()` fails on class instances | Use direct property access | `godot-class-property-access.md` |

Skill files in `.claude/skills/`. VFX optimization: `.claude/skills/godot-vfx-optimization.md`.

## Testing

Test suites: `test_game_state`, `test_book_page`, `test_phoenix_client`, `test_mock_world`.

**When to add tests:**
- New enums/state types → Update enum tests
- New PhoenixClient signals → Add signal existence tests
- New data classes → Add class instantiation tests

## Architecture

```
Godot Client (stateless) → WebSocket → Phoenix Server (source of truth)
```

- 3D book page with curl animation
- Text rendered via SubViewport → page texture
- Navigation via compass directions
- All game state comes from server

## Related Skills

- `.claude/skills/godot-subviewport-meta-click-detection.md` - Advanced 3D click detection
