# Behavior Systems: Traits, Scripts, and Components (V2)

> **For Developers**: This clarifies the three different behavior-related concepts in Loka's V2 architecture.

---

## Overview

In V2, behaviors are unified under the **traits** system. The `entity.traits` field holds both compiled modules and script references.

1. **Compiled Traits** (`entity.traits` — module atoms) - Elixir modules implementing `EntityBehavior`
2. **Script Traits** (`entity.traits` — script maps) - YAML-defined sandboxed scripts
3. **Components** (`entity.components` field) - Data storage, no logic

---

## 1. Compiled Traits (Elixir Modules)

**Location:** `lib/loka/behaviors/`
**Field:** `entity.traits` (list containing module atoms)
**Interface:** `Loka.Engine.EntityBehavior`

### What They Are

Elixir modules that implement `on_init/1`, `on_tick/2`, and `on_event/3` callbacks. These are **compiled code** run by EntityServer.

### Example

```elixir
defmodule Loka.Behaviors.Aggressive do
  @behaviour Loka.Engine.EntityBehavior

  @impl true
  def on_init(entity), do: {:ok, entity}

  @impl true
  def on_tick(entity, _delta) do
    # Check for targets in room
    :noop
  end

  @impl true
  def on_event(entity, {:entity_entered, target}, _context) do
    if should_attack?(entity, target) do
      {:ok, initiate_combat(entity, target)}
    else
      :noop
    end
  end
  def on_event(_entity, _event, _context), do: :noop
end
```

### Attachment (YAML)

```yaml
key: monastery_guard
type: npc
traits:
  - Loka.Behaviors.Guard
  - Loka.Behaviors.Patrol
components:
  guard:
    attack_tags: [criminal]
  patrol:
    path: [gate, courtyard, temple]
```

### When To Use

- **Complex logic** - Multi-step decision trees, performance-critical code
- **System integration** - Deep integration with combat, quest, or other frameworks
- **Reusable mechanics** - Combat AI, pathfinding, faction logic

### Available Compiled Traits

```
lib/loka/behaviors/
├── aggressive.ex      # Attack hostile entities
├── guard.ex           # Protect area, block directions
├── janitor.ex         # Clean up items in room
├── patrol.ex          # Walk predefined route
├── scavenger.ex       # Pick up dropped items
├── wander.ex          # Random movement
├── weather.ex         # Advance weather (system entity)
├── day_night.ex       # Advance time (system entity)
├── npc_ambient.ex     # Emit idle emotes
└── room_ambient.ex    # Atmospheric messages
```

---

## 2. Script Traits (YAML Content)

**Location:** `priv/world/scripts/behaviors/`
**Field:** `entity.traits` (list containing script maps)
**Format:** YAML files with sandboxed Elixir scripts

### What They Are

Content-level behaviors defined in YAML. These are **builder-editable** scripts that don't require code deployment.

### Example

```yaml
# priv/world/scripts/behaviors/patrol.yml
key: patrol
type: script_behavior
name: "Patrol Behavior"

config_schema:
  route:
    type: list
    required: true
  interval:
    type: integer
    default: 300

source: |
  if context.elapsed >= config.interval do
    next_room = get_next_room.(config.route, entity.location)
    move_to.(next_room)
  end
```

### Attachment (YAML)

```yaml
key: monastery_guard
traits:
  - script: patrol
    config:
      route: [gate, courtyard, temple]
      interval: 180
```

**Note:** Script traits use `fn_name.()` dot-call syntax for variable-bound functions (sandboxed `Code.eval_string` requirement).

### When To Use

- **Content customization** - Builders need to adjust NPC behavior
- **Simple mechanics** - Patrol routes, schedules, ambient actions
- **No code deployment** - Changes via YAML edits

---

## 3. Components (Data Storage)

**Field:** `entity.components` (map of string-keyed maps)
**Purpose:** State storage without behavior logic

### What They Are

Pure data containers. No logic, just nested maps. All game data lives here.

### Example

```elixir
%Entity{
  components: %{
    "combatant" => %{"health" => 100, "max_health" => 100, "attack" => 15},
    "vendor" => %{"gold" => 5000, "buy_rate" => 0.8},
    "quest_giver" => %{"available_quests" => ["intro_quest"]}
  }
}
```

### Access via Component Accessors

```elixir
# 23 accessor modules in lib/loka/components/
Components.Combatant.health(entity)       # => 100
Components.Combatant.set_health(entity, 80)
Components.Stats.level(entity)            # => 5
```

### When To Use

- **State storage** - HP, gold, inventory, flags
- **No behavior logic** - Just data that systems read/write
- **Flexible schema** - Add new data without changing Entity struct

---

## Comparison Table

| Aspect | Compiled Traits | Script Traits | Components |
|--------|----------------|---------------|------------|
| **Definition** | Elixir modules | YAML files | Data maps |
| **Location** | `lib/loka/behaviors/` | `priv/world/scripts/behaviors/` | `entity.components` |
| **Who Creates** | Developers | Builders (or devs) | Framework systems |
| **Contains** | EntityBehavior callbacks | Sandboxed scripts | State data (no logic) |
| **Deployment** | Code deploy required | YAML edit | Runtime only |
| **Performance** | Fast (compiled) | Medium (interpreted) | N/A (just data) |
| **Field** | `entity.traits: [Module]` | `entity.traits: [%{"script" => ...}]` | `entity.components: %{...}` |

---

## Decision Tree

```
Need to store data without behavior?
  YES → Component

Is this builder-editable or complex game logic?
  CONTENT → Script Trait
  LOGIC   → Compiled Trait

Does it need performance or deep framework integration?
  YES → Compiled Trait
  NO  → Script Trait
```

---

## V2 Changes from V1

| V1 | V2 |
|----|-----|
| `entity.behaviors` field | Renamed to `entity.traits` |
| `Loka.Engine.Behavior` protocol | Replaced by `Loka.Engine.EntityBehavior` callbacks |
| `Loka.Behaviors.Base` mixin | Deleted — use `@behaviour EntityBehavior` directly |
| `handle_event/3` callback | Split into `on_init/1`, `on_tick/2`, `on_event/3` |
| `behavior_state:key` in attributes | State stored in `components` |
| `behavior_config` in attributes | Config stored in `components` |

---

**Last Updated:** 2026-02-15
**See Also:**
- `docs/framework/behaviors.md` - Behaviors implementation guide
- `docs/builder-reference/behaviors.md` - Script behaviors for builders
- `lib/loka/engine/entity_behavior.ex` - EntityBehavior callback interface
