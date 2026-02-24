# Prototype System

Loka uses a prototype system that allows defining game content in YAML files without code changes.

## Overview

Prototypes are templates for creating entities. They support:
- **Self-contained**: Each YAML file includes all fields it needs — no inheritance
- **Hot reload**: Reload prototypes without restarting the server

## Directory Structure

```
priv/world/prototypes/
├── rooms/              # Room prototypes
│   ├── town_square.yml
│   ├── tavern.yml
│   └── forest_path.yml
├── npcs/               # NPC prototypes
│   ├── goblin.yml
│   ├── merchant.yml
│   └── guard.yml
├── items/              # Item prototypes
│   ├── torch.yml
│   ├── gold_key.yml
│   └── healing_potion.yml
└── exits/              # Exit prototypes
    └── locked_door.yml
```

## YAML Format

### Basic Prototype

```yaml
key: goblin               # Unique identifier (required)
type: npc                 # room | npc | item | exit | character (required)
short_desc: "Goblin"
long_desc: "A sneaky green creature lurks here."
extra_desc: "A sneaky green creature with pointed ears."
tags:
  - hostile
  - monster
  - goblinoid
components:
  combatant:
    health: { current: 30, max: 30 }
    stats: { str: 8, dex: 14, sta: 8 }
    level: 1
  loot:
    table:
      - { item: gold_coin, chance: 0.8, min: 1, max: 5 }
      - { item: rusty_dagger, chance: 0.2 }
```

### Room with Exits and Spawns

```yaml
key: town_square
type: room
short_desc: "Town Square"
long_desc: "A stone fountain burbles at the center of the village square."
extra_desc: |
  The heart of the village. A stone fountain burbles at the center.
exits:
  north: general_store    # Creates exit to room with key "general_store"
  east: tavern
  south: forest_path
  west: blacksmith
spawns:
  - prototype: merchant   # Spawn merchant NPC here
  - prototype: torch
    name: "Flickering Torch"  # Override the default name
  - prototype: guard
    components:           # Override components
      combatant:
        level: 5
```

## Flat Prototype Model

All prototypes are self-contained — each YAML file includes every field it needs. There is no `parent:` field or inheritance system. This keeps prototypes simple and explicit.

## Prototype API

### TypedObject.Loader

```elixir
# Loads all YAML files into ETS (called on startup)
TypedObject.Loader.reload()

# Get prototype by key
TypedObject.Loader.get("goblin")
# => %TypedObject{key: "goblin", ...}

# List prototypes by type
TypedObject.Loader.list_by_type(:entity, :npc)
# => [%TypedObject{key: "goblin", ...}, %TypedObject{key: "merchant", ...}]

# Validate all prototypes (check for broken references, cycles)
TypedObject.Loader.validate_all()
# => {:ok, stats} | {:error, errors}
```

### Spawner

When entities are spawned from prototypes:
- The entity's `key` equals the prototype's `key` (e.g., `"goblin"`)
- The entity's `id` is a unique UUID
- Multiple spawns from the same prototype share the same `key` but have different `id`s

```elixir
# Spawn entity from prototype
{:ok, entity} = Spawner.spawn("goblin")
# entity.key => "goblin"
# entity.id  => "abc123-..."

{:ok, entity2} = Spawner.spawn("goblin", location_id: room_id)
# entity2.key => "goblin" (same as entity.key)
# entity2.id  => "def456-..." (different from entity.id)

# Spawn with overrides
{:ok, entity} = Spawner.spawn("goblin",
  location_id: room_id,
  name: "Elite Goblin",
  components: %{combatant: %{level: 5}}
)

# Spawn room with all exits and spawned contents
{:ok, room} = Spawner.spawn_room("town_square")

# Despawn (delete) entity
:ok = Spawner.despawn(entity_id)

# Find all entities of a type by key
all_goblins = Entities.get_all_by_key("goblin")
```

See [Entity System - Unified Key System](./entity-system.md#key-vs-id-unified-key-system) for more details.

### WorldLoader

```elixir
# Spawn entire world from starting room (BFS traversal)
{:ok, stats} = WorldLoader.spawn_world()
# stats = %{rooms: 15, npcs: 42, items: 87, exits: 30}

# Spawn from specific starting room
{:ok, stats} = WorldLoader.spawn_world(start: "dungeon_entrance", max_rooms: 50)

# Validate world references
WorldLoader.validate()
# Checks for: broken exit destinations, missing spawn prototypes

# Reset world (delete all, respawn from prototypes)
WorldLoader.reset_world()

# Get starting room entity
WorldLoader.get_starting_room()
```

### WorldExporter

```elixir
# Export all entities to YAML (backup/snapshot)
WorldExporter.export_all("output/")
# Creates: output/rooms/, output/npcs/, output/items/, output/exits/

# Export specific type
WorldExporter.export_by_type(:npc, "output/npcs/")

# Convert single entity to YAML string
yaml = WorldExporter.entity_to_yaml(entity)

# Convert entity to prototype-compatible map
proto_map = WorldExporter.entity_to_prototype(entity)
```

## TypedObject Struct

```elixir
defmodule Loka.Engine.TypedObject do
  defstruct [
    :key,                # Unique identifier (required)
    :type,               # :entity | :quest | :dialogue | :script | :zone (required)
    :subtype,            # :npc | :room | :item | :exit (entities only)
    :name,               # Display name
    :description,        # Full description
    :extra_description,  # Detailed examination text
    :keywords,           # List of targeting keywords
    :components,         # Map of component_type => data
    :traits,             # List of trait module atoms or script maps
    :attributes,         # Flexible key-value storage
    :tags,               # List of categorization tags
    :scripts,            # Map of hook => script_name
    :locks,              # Map of action => lock_string
    :data,               # Type-specific fields (exits, spawns, etc.)
    :metadata,           # System metadata
  ]
end
```

**Note**: YAML files still use legacy field names (`short_desc`, `long_desc`, `extra_desc`, `type: npc`).
The Loader automatically maps these to the new struct fields during loading.

## Hot Reload

Prototypes can be reloaded without restarting:

```elixir
# Via code
TypedObject.Loader.reload()

# Via admin dashboard (System tab)
# Click "Reload Prototypes" button
```

**Note**: Existing entities are NOT updated. Hot reload only affects newly spawned entities.

## Related

- [Entity System](./entity-system.md) - How entities work
- [Persistence](./persistence.md) - How entities are stored
- [Entity Lifecycle](./entity-lifecycle.md) - EntityServer and spawning
