# Entity Traits (V2)

Pre-built, configurable entity behaviors assignable via YAML. Traits replace V1 "behaviors" field.

> **V2 Migration Note:** `entity.behaviors` → `entity.traits` (DB column renamed Feb 16, 2026)

## Quick Reference

| Behavior | Purpose | Module |
|----------|---------|--------|
| Guard | Attack tagged players, block directions | `lib/loka/behaviors/guard.ex` |
| Aggressive | Attack on sight with filters | `lib/loka/behaviors/aggressive.ex` |
| Patrol | Walk predefined route | `lib/loka/behaviors/patrol.ex` |
| Scavenger | Pick up valuable items | `lib/loka/behaviors/scavenger.ex` |
| Janitor | Clean up trash/corpses | `lib/loka/behaviors/janitor.ex` |
| Wander | Random movement | `lib/loka/behaviors/wander.ex` |
| Weather | Advance weather state | `lib/loka/behaviors/weather.ex` |
| DayNight | Advance time of day | `lib/loka/behaviors/day_night.ex` |
| NpcAmbient | Emit idle emotes | `lib/loka/behaviors/npc_ambient.ex` |
| RoomAmbient | Atmospheric messages | `lib/loka/behaviors/room_ambient.ex` |

**See each module's `@moduledoc` for full configuration options and examples.**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ YAML Prototype                                          │
│   traits: [Loka.Behaviors.Guard, ...]                  │
│   components:                                           │
│     guard: { attack_tags: [...] }                       │
├─────────────────────────────────────────────────────────┤
│ EntitySeeder → SQLite                                   │
│   Seeded at startup from YAML in priv/world/           │
│   Stored in entities table, traits as JSON array        │
├─────────────────────────────────────────────────────────┤
│ EntityServer (on_tick / on_event)                       │
│   Dispatches to compiled trait modules                  │
│   Dispatches to script traits via sandbox               │
│   Manages per-trait state in entity.components          │
├─────────────────────────────────────────────────────────┤
│ Trait Modules (Guard, Patrol, etc.)                     │
│   Implement EntityBehavior callbacks                    │
│   Read config from entity.components[trait_key]         │
└─────────────────────────────────────────────────────────┘
```

## EntityBehavior Interface

All compiled behavior modules implement `Loka.Engine.EntityBehavior`:

```elixir
@callback on_init(entity :: Entity.t()) :: {:ok, Entity.t()}
@callback on_tick(entity :: Entity.t(), delta :: integer()) :: {:ok, Entity.t()} | :noop
@callback on_event(entity :: Entity.t(), event :: term(), context :: map()) :: {:ok, Entity.t()} | :noop
```

### Lifecycle

1. `on_init/1` — called when entity starts, set up initial state
2. `on_tick/2` — called on periodic timer (configurable interval)
3. `on_event/3` — called when entity receives events (entity_entered, damage_taken, etc.)

## Trait Types

Traits can be compiled modules or script maps:

```elixir
entity.traits = [
  Loka.Behaviors.Guard,                              # Compiled module
  Loka.Behaviors.Patrol,                             # Compiled module
  %{"script" => "ambient_emote", "config" => %{}}   # Script trait (YAML-defined)
]
```

Script traits are dispatched via `dispatch_script_traits_tick/1` in EntityServer.

## Combining Traits

Traits are additive. Each trait processes events independently.

```yaml
key: city_guard
traits:
  - Loka.Behaviors.Guard
  - Loka.Behaviors.Patrol
components:
  guard:
    attack_tags: [criminal]
  patrol:
    path: [gate, square, gate]
```

## State Storage

Trait state is stored in `entity.components` under the trait's component key.
State persists across ticks and entity saves.

```elixir
# In a behavior module:
def on_tick(entity, _delta) do
  state = entity.components["patrol"] || %{}
  # Update state...
  updated = put_in(entity.components["patrol"], new_state)
  {:ok, %{entity | components: updated}}
end
```

## Creating Custom Behaviors

```elixir
defmodule Loka.Behaviors.MyBehavior do
  @behaviour Loka.Engine.EntityBehavior

  @impl true
  def on_init(entity), do: {:ok, entity}

  @impl true
  def on_tick(entity, _delta) do
    config = entity.components["my_behavior"] || %{}
    # Your logic here
    {:ok, entity}
  end

  @impl true
  def on_event(entity, _event, _context), do: :noop
end
```

## Common Events

| Event | When | Payload |
|-------|------|---------|
| `:entity_entered` | Entity enters room | `%{entity: ...}` |
| `:entity_left` | Entity leaves room | `%{entity: ...}` |
| `:tick` | Periodic timer | `%{}` |
| `:damage_taken` | Entity hurt | `%{damage: ..., source: ...}` |
| `:time_change` | Day/night transition | `%{period: ...}` |

## Best Practices

1. **Return `:noop` for unhandled events** — don't modify entity unnecessarily
2. **Keep state minimal** — component data persists, don't store redundant data
3. **Use component accessors** — `Components.Combatant.health(entity)` over raw map access
4. **Log at debug level** — helps troubleshoot without noise in production
