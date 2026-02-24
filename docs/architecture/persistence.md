# Persistence Architecture (V2)

Loka uses SQLite as the single source of truth. All game data lives in entities.

## Design

| Concept | Implementation |
|---------|----------------|
| Entity storage | `entities` table (UUID PK) |
| Game data | `components` JSON field |
| Tags | `entity_tags` join table |
| Audit trail | `entity_logs` table |
| Serialization | JSON (via `Loka.Ecto.Json`) |

**Note**: JSON means **map keys become strings** when loaded from the database. Use `entity.components["health"]` not `entity.components.health`.

## Database Schema

### Entities Table
```sql
CREATE TABLE entities (
  id          TEXT PRIMARY KEY,    -- UUID
  type        TEXT NOT NULL,       -- room, npc, item, exit, character, quest, etc.
  key         TEXT NOT NULL,       -- Prototype key (NOT unique)
  prototype_key TEXT,              -- Parent prototype for inheritance
  is_prototype INTEGER DEFAULT 0, -- Whether this is a prototype definition
  version     INTEGER DEFAULT 1,  -- Optimistic locking
  short_desc  TEXT,                -- Action/speech identifier
  long_desc   TEXT,                -- Room listing sentence
  extra_desc  TEXT,                -- Detailed examination text
  keywords    TEXT,                -- JSON array of targeting words
  primary_keyword TEXT,            -- Single keyword for UI
  mood        TEXT,                -- Current mood
  location_id TEXT REFERENCES entities(id),
  account_id  TEXT REFERENCES players(id),
  components  TEXT,                -- JSON map of all game data
  traits      TEXT,                -- JSON list of behavior modules/scripts
  tags        TEXT,                -- JSON array (deprecated, use entity_tags)
  scripts     TEXT,                -- JSON map of script assignments
  metadata    TEXT,                -- JSON map (timestamps, versions)
  inserted_at TEXT,
  updated_at  TEXT
);
```

**Key vs ID**: `key` stores the prototype key (e.g., "goblin") and is NOT unique. Multiple instances share the same key. Use `id` (UUID) for instance-specific lookups.

### Entity Tags Table
```sql
CREATE TABLE entity_tags (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (entity_id, tag)
);
```

### Entity Logs Table
```sql
CREATE TABLE entity_logs (
  id         TEXT PRIMARY KEY,
  entity_id  TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  data       TEXT,              -- JSON payload
  actor_id   TEXT,
  inserted_at TEXT
);
```

## Custom Ecto Type for JSON

```elixir
defmodule Loka.Ecto.Json do
  @moduledoc "Stores Elixir terms as JSON. Map keys become strings on load."
  use Ecto.Type

  def type, do: :string
  def cast(term), do: {:ok, term}
  def load(nil), do: {:ok, nil}
  def load(json), do: Jason.decode(json)
  def dump(nil), do: {:ok, nil}
  def dump(term), do: Jason.encode(prepare_for_json(term))
end
```

## Entities API

```elixir
# Find entities
Entities.find_one("uuid-here")                      # By UUID
Entities.find_one(key: "goblin", type: :npc)        # By key + type
Entities.find_all(type: :room)                      # All rooms
Entities.find_all(location_id: room_id)             # Contents of a room
Entities.find(key: "goblin", type: :npc)            # Returns list

# Save and delete
Entities.save(entity)                                # Insert or update
Entities.delete(entity_id)                           # Delete by ID

# Tags
Entities.add_tag(entity_id, "auto_start")
Entities.remove_tag(entity_id, "auto_start")
Entities.find_by_tag("auto_start")
```

## Caching Strategy

```
Layer 1: Entity process state (GenServer)
    ↓ miss
Layer 2: SQLite (persistent, single source of truth)
```

No ETS caching layer — the GenServer process IS the cache for active entities.

## Auto-Save System

Active entities auto-save every 60 seconds if dirty (via EntityServer):

```elixir
@save_interval 60_000     # 60 seconds
@hibernate_after 120_000  # 2 minutes - reduce memory usage
@idle_timeout 300_000     # 5 minutes - stop process
```

## Prototype Seeding

Game content is defined in YAML and seeded into the DB on startup:

```
priv/world/prototypes/
├── rooms/          # Room prototypes
├── npcs/           # NPC prototypes
├── items/          # Item prototypes
└── exits/          # Exit prototypes
```

**Flow**: YAML → EntitySeeder (startup) → entities table (SQLite)

```elixir
# EntitySeeder runs on application start:
# 1. Reads all YAML files (each self-contained, no inheritance)
# 2. Seeds in phases: non-located → rooms → exits → NPCs/items → room spawns
# 3. Skips entities that already exist (idempotent)
```

## Related
- [Entity System](./entity-system.md) - Entity structure and traits
- [Entity Lifecycle](./entity-lifecycle.md) - EntityServer auto-save
- [Prototypes](./prototypes.md) - YAML-based entity templates
