# NPC Behaviors System

Pre-built, configurable NPC behaviors assignable via YAML. Based on DikuMUD special procedures.

## Quick Reference

| Behavior | Purpose | Module |
|----------|---------|--------|
| Guard | Attack tagged players, block directions | `lib/loka/behaviors/guard.ex` |
| Aggressive | Attack on sight with filters | `lib/loka/behaviors/aggressive.ex` |
| Patrol | Walk predefined route | `lib/loka/behaviors/patrol.ex` |
| Scavenger | Pick up valuable items | `lib/loka/behaviors/scavenger.ex` |
| Janitor | Clean up trash/corpses | `lib/loka/behaviors/janitor.ex` |

**See each module's `@moduledoc` for full configuration options and examples.**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ YAML Prototype                                          │
│   behaviors: [Loka.Behaviors.Guard, ...]              │
│   behavior_config: { guard: { attack_tags: [...] } }   │
├─────────────────────────────────────────────────────────┤
│ Behaviors.Runner                                        │
│   Processes events through behavior chain               │
│   Manages per-behavior state in entity attributes       │
├─────────────────────────────────────────────────────────┤
│ Individual Behaviors (Guard, Patrol, etc.)              │
│   Each implements handle_event/3 callback               │
│   Reads config via get_config(entity, __MODULE__)       │
└─────────────────────────────────────────────────────────┘
```

### Event Processing Flow

1. Event arrives (`:entity_entered`, `:tick`, etc.)
2. `Runner.process_event/2` iterates through entity's behaviors
3. Each behavior's `handle_event/3` is called with entity, event, state
4. Processing stops when a behavior returns `{:handled, ...}` or `{:halt, ...}`

### Return Values

| Return | Meaning |
|--------|---------|
| `{:ok, state}` | Continue to next behavior |
| `{:ok, state, events}` | Continue, emit these events |
| `{:handled, state}` | Stop chain, event was handled |
| `{:handled, state, events}` | Stop chain, emit events |
| `{:halt, reason}` | Block the action (for `:before_*` events) |

### State Persistence

Behavior state stored at `entity.attributes["behavior_state:<behavior_key>"]`.
Persists across events and entity saves.

## Combining Behaviors

Behaviors are additive. Order matters - first to return `{:handled, ...}` stops the chain.

```yaml
key: city_guard
behaviors:
  - Loka.Behaviors.Guard      # Attack criminals
  - Loka.Behaviors.Patrol     # Walk route
attributes:
  behavior_config:
    guard:
      attack_tags: [criminal]
    patrol:
      path: [gate, square, gate]
```

## Creating Custom Behaviors

```elixir
defmodule Loka.Behaviors.MyBehavior do
  use Loka.Behaviors.Base

  @impl true
  def supported_types, do: [:npc]

  @impl true
  def handle_event(entity, %Event{type: :some_event}, state) do
    config = get_config(entity, __MODULE__)
    # Your logic here
    {:ok, state}
  end

  def handle_event(_entity, _event, state), do: {:ok, state}
end
```

### Helper Functions (via `use Loka.Behaviors.Base`)

| Function | Description |
|----------|-------------|
| `get_config(entity, module)` | Get behavior config map |
| `has_tag?(entity, tag)` | Check if entity has tag |
| `has_any_tag?(entity, tags)` | Check if entity has any tag |
| `health_percent(entity)` | Health as 0-100 |
| `location(entity)` | Current location ID |

### Common Events

| Event | When | Payload |
|-------|------|---------|
| `:entity_entered` | Entity enters room | `%{entity: ...}` |
| `:before_move` | Before movement | `%{direction: ...}` |
| `:item_dropped` | Item dropped | `%{item: ...}` |
| `:tick` | Periodic timer | `%{}` |
| `:damage_taken` | Entity hurt | `%{damage: ..., source: ...}` |

## Best Practices

1. **Always handle unknown events** with `def handle_event(_, _, state), do: {:ok, state}`
2. **Use `{:handled, ...}` sparingly** - only when the event is truly consumed
3. **Keep state minimal** - entity attributes persist, don't store redundant data
4. **Log at debug level** - helps troubleshoot without noise in production
