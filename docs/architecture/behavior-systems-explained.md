# Behavior Systems: The Three Meanings of "Behavior"

> **For Developers**: This clarifies the three different "behavior" concepts in Loka's architecture.

---

## The Confusion

The word "behavior" appears in three different contexts in Loka, each with a distinct purpose:

1. **Code Behaviors** (`Entity.behaviors` field) - Elixir modules
2. **Script Behaviors** (YAML behaviors) - Content behaviors
3. **Components** (`Entity.components` field) - Data storage

This document explains when to use each.

---

## 1. Code Behaviors (Elixir Modules)

**Location:** `lib/loka/behaviors/`
**Field:** `Entity.behaviors` (list of modules)
**Protocol:** `Loka.Engine.Behavior`

### What They Are

Elixir modules that implement event handlers for entities. These are **compiled code** that hooks into the entity event system.

### Example

```elixir
defmodule Loka.Behaviors.Aggressive do
  @behaviour Loka.Engine.Behavior

  @impl true
  def handle_event(entity, %Event{type: :entity_entered} = event, context) do
    # Complex combat logic
    if should_attack?(entity, event.source, context) do
      {:ok, entity, [Event.new(:attack, source: entity.id, target: event.source)]}
    else
      {:ok, entity}
    end
  end

  defp should_attack?(entity, player_id, context) do
    # Performance-critical checks, complex logic
    # ...
  end
end
```

### Attachment

```elixir
# In code (engine/spawner)
entity = Entity.new(:npc, attrs)
entity = Entity.add_behavior(entity, Loka.Behaviors.Aggressive)

# Entity struct looks like:
%Entity{
  id: "123",
  behaviors: [Loka.Behaviors.Aggressive, Loka.Behaviors.Guard],
  # ...
}
```

### When To Use

Use code behaviors when you need:
- **Complex logic** - Multi-step decision trees, performance-critical code
- **System integration** - Deep integration with combat, quest, or other frameworks
- **Reusable mechanics** - Combat AI, pathfinding, faction logic
- **Performance** - Tight loops, real-time responsiveness

**Examples:** Aggressive AI, Guard behavior, Patrol logic (complex variant), Scavenger AI

### Event Processing

Code behaviors run via `Behavior.process_event/3`:

```elixir
# Engine processes events through all attached behaviors
def process_event(%Entity{behaviors: behaviors} = entity, event, context) do
  behaviors
  |> Enum.filter(&behavior_can_handle?(&1, entity, event.type))
  |> Enum.reduce_while({:ok, entity, []}, fn behavior, {:ok, ent, events} ->
    case behavior.handle_event(ent, event, context) do
      {:ok, updated_entity} -> {:cont, {:ok, updated_entity, events}}
      {:ok, updated_entity, new_events} -> {:cont, {:ok, updated_entity, events ++ new_events}}
    end
  end)
end
```

---

## 2. Script Behaviors (YAML Content)

**Location:** `priv/world/scripts/behaviors/`
**Field:** `Entity.behaviors` (YAML config)
**Format:** YAML files with sandboxed Elixir/Lua scripts

### What They Are

Content-level reusable behaviors defined in YAML. These are **builder-editable** scripts that don't require code deployment.

### Example

```yaml
# priv/world/scripts/behaviors/patrol.yml
key: patrol
type: script_behavior
name: "Patrol Behavior"
description: "Makes NPC walk a route between rooms"

config_schema:
  route:
    type: list
    required: true
    description: "List of room keys to visit"
  interval:
    type: integer
    default: 300
    description: "Seconds between moves"

# Elixir script (sandboxed)
source: |
  # On tick event
  if context.elapsed >= config.interval do
    next_room = get_next_room(config.route, entity.location)
    move_to(next_room)
    emit(:patrol_arrive, room: next_room)
  end
```

### Attachment

```yaml
# In entity YAML (priv/world/prototypes/npcs/guard.yml)
key: monastery_guard
type: npc
behaviors:
  - script: patrol
    config:
      route: [gate, courtyard, temple]
      interval: 180
  - script: day_night_schedule
    config:
      wake_at: dawn
      sleep_at: dusk
```

### When To Use

Use script behaviors when you need:
- **Content customization** - Builders need to adjust NPC behavior
- **Simple mechanics** - Patrol routes, schedules, ambient actions
- **No code deployment** - Changes via admin UI or YAML edits
- **Common patterns** - Shopkeeper hours, day/night cycles, wandering

**Examples:** Patrol routes, Day/night schedules, Shopkeeper hours, Ambient emitters, Nocturnal behavior

### Event Processing

Script behaviors are processed by the scripting system:

```elixir
# Scripting.BehaviorRegistry handles script behaviors
def execute_behaviors(entity, event, context) do
  entity.behaviors
  |> Enum.filter(&is_script_behavior?/1)
  |> Enum.reduce({:ok, entity}, fn behavior_config, {:ok, ent} ->
    script = get_behavior_script(behavior_config.script)
    Scripting.execute(script.source, ent, Map.merge(context, %{config: behavior_config.config}))
  end)
end
```

---

## 3. Components (Data Storage)

**Field:** `Entity.components` (map of maps)
**Purpose:** Flexible data storage without behavior logic

### What They Are

Pure data containers for entity state. No logic, just nested maps keyed by component type.

### Example

```elixir
%Entity{
  id: "123",
  components: %{
    "combat" => %{
      hp: 100,
      max_hp: 100,
      armor: 15,
      damage: 10
    },
    "vendor" => %{
      gold: 5000,
      inventory: ["sword", "potion"],
      buy_rate: 0.8,
      sell_rate: 1.2
    },
    "quest_giver" => %{
      available_quests: ["intro_quest", "fetch_quest"],
      given_quests: []
    }
  }
}
```

### When To Use

Use components when you need:
- **State storage** - HP, gold, inventory, flags
- **No behavior logic** - Just data that systems read/write
- **Framework integration** - Combat system reads "combat" component, vendor system reads "vendor" component
- **Flexible schema** - Add new data without changing Entity struct

**Examples:** Combat stats, Vendor inventory, Quest state, Skill levels, Status effects

### Access Pattern

```elixir
# Add component
entity = Entity.add_component(entity, "combat", %{hp: 100, max_hp: 100})

# Get component
combat = Entity.get_component(entity, "combat")
# => %{hp: 100, max_hp: 100}

# Check component
Entity.has_component?(entity, "combat")
# => true

# Framework systems use components
defmodule Loka.Framework.Combat do
  def take_damage(entity, amount) do
    combat = Entity.get_component(entity, "combat")
    new_hp = max(0, combat.hp - amount)
    Entity.add_component(entity, "combat", %{combat | hp: new_hp})
  end
end
```

---

## Comparison Table

| Aspect | Code Behaviors | Script Behaviors | Components |
|--------|----------------|------------------|------------|
| **Definition** | Elixir modules | YAML files | Data maps |
| **Location** | `lib/loka/behaviors/` | `priv/world/scripts/behaviors/` | `Entity.components` field |
| **Who Creates** | Developers | Builders (or devs) | Framework systems |
| **Contains** | Event handlers (logic) | Sandboxed scripts (logic) | State data (no logic) |
| **Deployment** | Code deploy required | YAML edit, hot-reload | Runtime only |
| **Performance** | Fast (compiled) | Medium (interpreted) | N/A (just data) |
| **Complexity** | Any | Limited by sandbox | N/A |
| **Examples** | Aggressive AI, Guard | Patrol, Day/Night | Combat stats, Vendor inventory |
| **Attached Via** | `Entity.add_behavior(entity, Module)` | YAML `behaviors:` section | `Entity.add_component(entity, type, data)` |
| **Field Storage** | `Entity.behaviors: [Module]` | `Entity.behaviors: [%{script: "patrol", config: {...}}]` | `Entity.components: %{"combat" => {...}}` |

---

## Decision Tree: Which To Use?

```
┌─────────────────────────────────────────────────────────────┐
│ Need to store data without behavior?                        │
│   YES → Use Component                                        │
│   NO  → Continue...                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Is this builder-editable content or complex game logic?     │
│   CONTENT → Script Behavior                                  │
│   LOGIC → Continue...                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Does it need performance or deep framework integration?     │
│   YES → Code Behavior                                        │
│   NO  → Script Behavior                                      │
└─────────────────────────────────────────────────────────────┘
```

### Examples

| Need | Solution |
|------|----------|
| "Store NPC's HP" | **Component** - `%{"combat" => %{hp: 100}}` |
| "NPC patrols between 3 rooms" | **Script Behavior** - `patrol.yml` |
| "NPC has complex faction-based combat AI" | **Code Behavior** - `Aggressive` module |
| "Track shop inventory" | **Component** - `%{"vendor" => %{items: [...]}}` |
| "Shop opens/closes at specific times" | **Script Behavior** - `shopkeeper_hours.yml` |
| "Advanced pathfinding for NPCs" | **Code Behavior** - `Pathfinding` module |

---

## What About `:mood`?

From the original question: "Why is there `:mood` in base Entity? Shouldn't it be a 'behavior'?"

**Answer:** No. `:mood` is **display metadata**, not behavior or state logic.

```elixir
%Entity{
  short_desc: "Novice Pema",
  long_desc: "A young monk with earnest eyes waits anxiously here.",
  mood: "anxious",  # ← Just a string, affects display only
}
```

**Why not a component or behavior?**
- **Not stateful data** - It doesn't need complex structure (Component would be overkill)
- **Not logic** - It doesn't make decisions (Behavior would be wrong)
- **Display-only** - It's like `short_desc` or `keywords` - just metadata

If you wanted mood to **affect AI decisions**, THEN it might become:
```elixir
# Component approach
%Entity{
  components: %{
    "emotion" => %{
      current_mood: "anxious",
      mood_thresholds: %{stressed: 80, calm: 20},
      affects_dialogue: true
    }
  }
}
```

But for simple display purposes, a field is correct.

---

## Implementation Notes

### Code Behaviors Currently In Use

```elixir
# lib/loka/behaviors/
├── aggressive.ex      # Attack hostile entities
├── guard.ex           # Protect specific area/entity
├── janitor.ex         # Clean up items in room
├── patrol.ex          # Complex patrol with state machine
├── runner.ex          # Flee from combat
├── scavenger.ex       # Pick up dropped items
├── wander.ex          # Random movement
└── base.ex            # Shared utilities
```

### Script Behaviors Currently Defined

```yaml
# priv/world/scripts/behaviors/
├── patrol.yml                # Simple route walking
├── day_night_schedule.yml    # Wake/sleep cycles
├── shopkeeper_hours.yml      # Shop open/close
├── wander.yml                # Random wandering
├── ambient_emitter.yml       # Periodic emotes
└── nocturnal.yml             # Reverse day/night
```

### When Code Behavior vs Script Behavior?

**Code Behavior (`Loka.Behaviors.Aggressive`):**
```elixir
# Performance-critical, complex decision tree
def handle_event(entity, %Event{type: :entity_entered} = event, context) do
  player = context.player
  faction_rep = get_faction_rep(player, entity.faction)

  cond do
    player.level < entity.components["combat"].level - 10 -> ignore()
    faction_rep < -50 -> attack_on_sight()
    has_bounty?(player) -> call_guards_and_attack()
    is_night?() and entity.nocturnal? -> patrol_aggressive()
    true -> track_but_dont_attack()
  end
end
```

**Script Behavior (`shopkeeper_hours.yml`):**
```yaml
# Simple time-based toggle
source: |
  if context.time_event == "morning" and context.hour == config.open_at do
    set_flag("shop_open", true)
    emit(:opening_shop)
  elseif context.time_event == "evening" and context.hour == config.close_at do
    set_flag("shop_open", false)
    emit(:closing_shop)
  end
```

---

## Migration Path

If a script behavior becomes too complex or performance-critical, migrate it to a code behavior:

**Before (Script Behavior):**
```yaml
# priv/world/scripts/behaviors/complex_patrol.yml
source: |
  # 200 lines of complex pathfinding logic
  # Performance issues, hard to maintain
```

**After (Code Behavior):**
```elixir
# lib/loka/behaviors/smart_patrol.ex
defmodule Loka.Behaviors.SmartPatrol do
  @behaviour Loka.Engine.Behavior

  @impl true
  def handle_event(entity, event, context) do
    # Fast, maintainable, tested
    # ...
  end
end
```

Then update entity YAML:
```yaml
# Old
behaviors:
  - script: complex_patrol
    config: {...}

# New (requires code deployment, but faster)
# Handled in spawner code:
# Entity.add_behavior(entity, SmartPatrol)
```

---

## Summary

- **Code Behaviors** = Elixir modules for complex/performance-critical logic
- **Script Behaviors** = YAML behaviors for content customization
- **Components** = Data storage without logic

**Rule of thumb:**
- Need to store data? → **Component**
- Need simple content behavior? → **Script Behavior**
- Need complex game logic? → **Code Behavior**

**`:mood` is none of these** - it's just a display field, like `short_desc`.

---

**Last Updated:** 2026-01-24
**See Also:**
- `docs/builder-reference/behaviors.md` - Script behaviors reference for builders
- `docs/framework/behaviors.md` - Code behaviors implementation guide
- `lib/loka/engine/behavior.ex` - Behavior protocol definition
- `lib/loka/framework/scripting/behavior_registry.ex` - Script behavior loading
