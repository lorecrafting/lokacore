---
paths: ["lib/loka/framework/scripting/**", "lib/loka/engine/script/**", "priv/world/scripts/**"]
---

# Scripting System Context

This context auto-loads when working on scripting code.

## Scripts vs Framework Code

**Core principle:** Scripts customize game content. Framework code adds capabilities.

**Decision tree:**
1. Does the scripting API already support this? YES → Write a script (`priv/world/scripts/`)
2. Is this game-specific content or a reusable system? CONTENT → Add script API function, then write script. SYSTEM → Framework code (`lib/loka/framework/`)
3. Does this change HOW scripts work? YES → Engine code (`lib/loka/engine/script/`). NO → Framework code.

**Litmus test:** "Would a builder creating a different game want to customize this?" YES → scriptable. NO → system/engine.

**Red flags:**
- Modifying framework but it's specific to ONE NPC/room → Should be a script
- Writing a script but sandbox blocks you → Needs framework API addition
- Modifying engine but it's game logic → Should be framework

## Layer Boundaries

| Task | Layer | Directory |
|------|-------|-----------|
| Sandbox security | Engine | `lib/loka/engine/script/` |
| API bindings | Framework | `lib/loka/engine/script/bindings.ex` |
| Script content | Builder | `priv/world/scripts/*.yml` |
| Admin UI | Web | `lib/loka_web/live/admin_live/scripts_tab.ex` (read-only) |

## YAML-Only Architecture

All game content uses YAML as single source of truth. Hot-reload with `mix loka.reload`. Admin UI is read-only.

## Behaviors, Emotes, and Scripts

Three complementary systems for NPC/entity customization:

| Layer | Purpose | Files |
|-------|---------|-------|
| **Behaviors** | Reusable mechanics | `priv/world/scripts/behaviors/*.yml` |
| **Emotes** | Personality text | Entity YAML `emotes:` section |
| **Scripts** | Custom one-off logic | `priv/world/scripts/*.yml` |

**Pattern**: Behaviors emit events → Emotes display personality text.

Available behaviors: patrol, day_night_schedule, shopkeeper_hours, wander, ambient_emitter, nocturnal, spawn_condition_time.

## Script API Categories

```elixir
# Context (read-only)
entity.*, player.*, context.*, room()

# Queries
quest_active?(), has_item?(), get_stat(), entities_in_room()

# Actions (queued)
say(), message(), set_flag(), give_item(), spawn_npc()

# World manipulation
set_room_attr(), lock_exit(), damage(), start_combat()

# Scheduling
after(seconds, script_key), recurring(interval, script_key)
```

## Where to Modify

- **New API function**: `lib/loka/engine/script/bindings.ex*.ex`
- **Security/sandbox**: `lib/loka/engine/script/sandbox.ex`, `validator.ex`
- **Hook integration**: `lib/loka/framework/scripting/hook_integration.ex`
- **Script content**: YAML files in `priv/world/scripts/`

## Adding New Script Capability

1. **Don't** hack around it in the script
2. **Don't** modify framework to hardcode the behavior
3. **Do** add a new API function to `lib/loka/engine/script/bindings.ex`
4. **Then** use that function in your script

## Documentation

- `docs/architecture/elixir-scripts-design.md` - Full API reference
- `docs/builder-reference/behaviors.md` - Behavior reference
- `docs/builder-reference/emotes.md` - Emote reference
