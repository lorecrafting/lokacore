# Entity System Architecture (V2)

Loka uses a unified entity system where everything is an entity. The database is the single source of truth.

## Core Entity Structure

```elixir
defmodule Loka.Engine.Entity do
  defstruct [
    :id,              # UUID - instance identity
    :type,            # :character | :room | :item | :npc | :exit | :quest | :skill | ...
    :key,             # Prototype key (e.g., "goblin") - NOT unique
    :prototype_key,   # Parent prototype for inheritance
    :short_desc,      # Action/speech identifier ("Novice Pema says...")
    :long_desc,       # Room listing sentence
    :extra_desc,      # Detailed examination text
    :keywords,        # Targeting words ["monk", "young", "pema"]
    :primary_keyword, # Single keyword for UI
    :mood,            # Current mood affecting display
    :location_id,     # Where this entity is (parent entity ID)
    :account_id,      # Player account link (for characters)
    is_prototype: false,
    version: 1,       # Optimistic locking
    components: %{},  # All game data (JSON map)
    traits: [],       # Behavior modules or script maps
    tags: [],         # Categorization tags
    scripts: %{},     # Elixir script assignments
    metadata: %{},    # System metadata
  ]
end
```

### V2 Changes from V1

| V1 Field | V2 Equivalent |
|----------|--------------|
| `data` | Merged into `components` |
| `attributes` (EAV) | Merged into `components` |
| `contents` | Derived via `Entities.find_all(location_id: id)` |
| `locks` | `components["locks"]` |
| `parent_key` | `metadata["parent_key"]` |
| `behaviors` | Renamed to `traits` |
| `name`/`description` | Split into `short_desc`/`long_desc`/`extra_desc` |

## Key vs ID: Unified Key System

- **`id`** (UUID): Unique per instance — "which one is this?"
- **`key`** (prototype key): Shared by all instances of a prototype — "what type is this?"

```elixir
goblin1 = %Entity{id: "abc123...", key: "goblin", ...}
goblin2 = %Entity{id: "def456...", key: "goblin", ...}  # Same key, different id
```

### Finding Entities
```elixir
Entities.find_one("abc123...")                     # By UUID
Entities.find_one(key: "goblin", type: :npc)       # By key + type
Entities.find_all(type: :npc)                      # All NPCs
Entities.find_all(location_id: room_id)            # Room contents
Entities.find(key: "goblin", type: :npc)           # Returns list
```

## Component System

Components are pure data stored in `entity.components` (JSON map). All game data lives here.

```elixir
# Access via component accessor modules (lib/loka/components/)
Components.Combatant.health(entity)          # => 100
Components.Stats.level(entity)               # => 5
Components.QuestProgress.active(entity)      # => [...]

# Direct access
entity.components["combatant"]["health"]     # => 100

# Update
entity = Components.Combatant.set_health(entity, 80)
```

### Component Accessor Modules (23 modules)

| Module | Key | Domain |
|--------|-----|--------|
| `Combatant` | `"combatant"` | health, attack, defense |
| `Player` | `"player"` | settings, character_name |
| `Stats` | `"stats"` | str, dex, sta, level |
| `QuestProgress` | `"quest_progress"` | active, completed, failed |
| `Room` | `"room"` | spawns config |
| `Exit` | `"exit"` | direction, destination |
| `Equipment` | `"equipment"` | slot → entity UUID |
| ... | ... | See `lib/loka/components/` for all 23 |

## Trait System

Traits define HOW entities behave. They replace V1's `behaviors` field.

```elixir
entity.traits = [
  Loka.Behaviors.Guard,                           # Compiled module
  Loka.Behaviors.Patrol,                          # Compiled module
  %{"script" => "ambient_emote", "config" => %{}} # Script trait
]
```

### EntityBehavior Interface

All compiled trait modules implement `EntityBehavior`:

```elixir
defmodule Loka.Engine.EntityBehavior do
  @callback on_init(entity :: Entity.t()) :: {:ok, Entity.t()}
  @callback on_tick(entity :: Entity.t(), delta :: integer()) :: {:ok, Entity.t()} | :noop
  @callback on_event(entity :: Entity.t(), event :: term(), context :: map()) :: {:ok, Entity.t()} | :noop
end
```

### Available Behaviors

| Behavior | Purpose |
|----------|---------|
| Guard | Attack tagged players, block directions |
| Aggressive | Attack on sight with filters |
| Patrol | Walk predefined route |
| Scavenger | Pick up valuable items |
| Janitor | Clean up trash/corpses |
| Wander | Random movement |
| Weather | Advance weather, broadcast changes |
| DayNight | Advance time, emit time_change events |
| NpcAmbient | Emit random idle emotes |
| RoomAmbient | Emit atmospheric messages |

## StateMachine

Shared state machine engine used by quests, combat, crafting, dialogue, NPC AI:

```elixir
@quest_machine StateMachine.new(%{
  initial: "available",
  transitions: %{
    "available"            => ["accepted"],
    "accepted"            => ["in_progress", "abandoned"],
    "in_progress"         => ["objectives_complete", "abandoned", "failed"],
    "objectives_complete" => ["turned_in", "abandoned"],
    "abandoned"           => ["accepted"],
    "failed"              => ["accepted"],
  }
})

{:ok, "in_progress"} = StateMachine.transition(@quest_machine, "accepted", "in_progress")
```

## Entity Types

| Type | Description | Example Components |
|------|-------------|-------------------|
| room | A location in the world | room, coordinates |
| character | Player character | combatant, player, stats, quest_progress |
| npc | Non-player character | combatant, emotes, traits |
| item | Objects in the world | physical, weapon/armor |
| exit | Connection between rooms | exit (direction, destination) |
| quest | Quest definition | quest (objectives, rewards) |
| skill | Skill definition | skill_def (cooldown, cost) |
| recipe | Crafting recipe | recipe_def (ingredients, output) |

## Entity Lifecycle

Entity lifecycle managed via EntityServer GenServer:

| Phase | Description |
|-------|-------------|
| Loading | Entity loaded from DB, traits initialized |
| Alive | Processing events, ticking, auto-saving |
| Despawning | Final save before process stops |
| Saved | Terminal state |

```elixir
EntityServer.get_entity(pid)           # Get current state
EntityServer.update(pid, update_fn)    # Update entity (marks dirty)
EntityServer.dispatch_event(pid, event, context)  # Process event with snapshot rollback
```

**Timings** (configurable):
- Auto-save: Every 60 seconds if dirty
- Hibernate: After 120 seconds idle
- Stop: After 300 seconds idle

## Related
- [Entity Lifecycle](./entity-lifecycle.md) - EntityServer details
- [Prototypes](./prototypes.md) - YAML-based entity templates
- [Persistence](./persistence.md) - Database schema
- [Hooks & Locks](./hooks-and-locks.md) - Lifecycle hooks and access control
