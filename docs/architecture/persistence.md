# Persistence Architecture

Loka uses a persistence pattern that balances flexibility with queryability.

## Design

Loka separates structured data (entities) from flexible attributes:

| Concept | Loka Implementation |
|---------|----------------------|
| Entity storage | EntitySchema |
| Flexible attributes | EntityAttribute (EAV table) |
| Component data | Entity components (JSON text) |
| Serialization | JSON (via `Loka.Ecto.Json`) |

**Note**: Loka uses JSON for queryability and human-readability. This means **map keys become strings** when loaded from the database.

## Database Schema

### Entities Table
```elixir
create table(:entities, primary_key: false) do
  add :id, :uuid, primary_key: true
  add :type, :string, null: false      # room, npc, item, exit, character
  add :key, :string, null: false       # Prototype key (NOT unique - see below)
  add :name, :string
  add :description, :text
  add :location_id, references(:entities, type: :uuid, on_delete: :nilify_all)

  # Serialized JSON text fields (queryable)
  add :components, :text               # Map of components
  add :behaviors, :text                # List of behavior modules
  add :tags, {:array, :string}, default: []
  add :locks, :text                    # Access control map
  add :scripts, :text                  # Elixir script assignments
  add :metadata, :text                 # Timestamps, versions

  timestamps(type: :utc_datetime)
end

# Non-unique index on key (multiple entities share the same prototype key)
create index(:entities, [:key])
```

**Key vs ID**: The `key` column stores the prototype key (e.g., "goblin") and is NOT unique. Multiple entities spawned from the same prototype share the same key. Use `id` (UUID) for instance-specific lookups. See [Entity System - Unified Key System](./entity-system.md#key-vs-id-unified-key-system).

### Entity Attributes Table (EAV Pattern)
```elixir
create table(:entity_attributes, primary_key: false) do
  add :id, :uuid, primary_key: true
  add :entity_id, references(:entities, type: :uuid, on_delete: :delete_all), null: false
  add :key, :string, null: false       # Attribute name
  add :category, :string, default: "default"
  add :value, :text, null: false       # JSON serialized
  add :str_value, :string              # Searchable string representation

  timestamps(type: :utc_datetime)
end

create unique_index(:entity_attributes, [:entity_id, :category, :key])
```

### Scripts Table
```elixir
create table(:scripts) do
  add :name, :string, null: false
  add :description, :text
  add :source, :text, null: false      # Elixir source code
  add :hook, :string                   # on_enter, on_attack, etc.
  add :enabled, :boolean, default: true

  timestamps(type: :utc_datetime)
end
```

## Custom Ecto Type for JSON Serialization

```elixir
defmodule Loka.Ecto.Json do
  @moduledoc """
  Custom Ecto type for storing arbitrary Elixir terms as JSON.
  Provides queryability and human-readable storage.

  IMPORTANT: Map keys become strings when loaded from the database.
  Code must use string keys: `Map.get(data, "key")` not `data.key`
  """
  use Ecto.Type

  def type, do: :string

  def cast(term), do: {:ok, term}

  def load(nil), do: {:ok, nil}
  def load(json) when is_binary(json) do
    case Jason.decode(json) do
      {:ok, term} -> {:ok, term}
      {:error, _} -> :error
    end
  end

  def dump(nil), do: {:ok, nil}
  def dump(term) do
    case Jason.encode(prepare_for_json(term)) do
      {:ok, json} -> {:ok, json}
      {:error, _} -> :error
    end
  end

  # Converts atoms to strings, tuples to lists, etc.
  defp prepare_for_json(term), do: # ... conversion logic
end
```

### String Keys on Load

When data is loaded from the database, all map keys will be strings:

```elixir
# Saving (atom keys work)
entity = %Entity{components: %{health: %{current: 100, max: 100}}}
Entities.save_entity(entity)

# Loading (use string keys!)
loaded = Entities.get_entity!(id)
loaded.components["health"]["current"]  # => 100
```

## Attribute System (EAV)

The Entity-Attribute-Value pattern allows flexible storage:

```elixir
# Setting an attribute
Entities.set_attribute(entity_id, "health", 100)
Entities.set_attribute(entity_id, "quest_progress", %{quest_id: "q1", step: 3})

# Getting attributes
Entities.get_attribute(entity_id, "health")  # => 100
Entities.get_attributes_by_category(entity_id, "stats")  # => [%{key: "health", ...}]

# Searching by string representation
Entities.search_by_attribute("quest_progress", "q1")  # Finds entities with matching str_value
```

### str_value Computation

```elixir
defp compute_str_value(value) when is_binary(value), do: value
defp compute_str_value(value) when is_number(value), do: to_string(value)
defp compute_str_value(value) when is_atom(value), do: to_string(value)
defp compute_str_value(value) when is_boolean(value), do: to_string(value)
defp compute_str_value(value), do: inspect(value)
```

## Caching Strategy

```
Layer 1: Entity process state (GenServer)
    ↓ miss
Layer 2: ETS tables (shared read)
    ↓ miss
Layer 3: SQLite (persistent)
```

```elixir
def get_entity(entity_id) do
  case :ets.lookup(:loka_entities, entity_id) do
    [{^entity_id, entity}] -> {:ok, entity}
    [] ->
      # Cache miss - load from database
      case load_from_db(entity_id) do
        {:ok, entity} ->
          :ets.insert(:loka_entities, {entity_id, entity})
          {:ok, entity}
        error -> error
      end
  end
end
```

## Auto-Save System

Active entities auto-save every 60 seconds if dirty (via EntityServer):

```elixir
# EntityServer lifecycle timings (configurable)
@save_interval 60_000     # 60 seconds
@hibernate_after 120_000  # 2 minutes - reduce memory usage
@idle_timeout 300_000     # 5 minutes - stop process
```

See [Entity Lifecycle](./entity-lifecycle.md) for full EntityServer implementation.

## Conversion: Schema ↔ Entity Struct

```elixir
# Schema to runtime Entity
def to_entity(%EntitySchema{} = schema) do
  %Entity{
    id: schema.id,
    type: String.to_existing_atom(schema.type),
    key: schema.key,
    name: schema.name,
    description: schema.description,
    location_id: schema.location_id,
    components: schema.components || %{},
    behaviors: schema.behaviors || [],
    tags: schema.tags || [],
    locks: schema.locks || %{},
    scripts: schema.scripts || %{},
    metadata: schema.metadata || %{}
  }
end

# Runtime Entity to Schema params
def to_schema_params(%Entity{} = entity) do
  %{
    type: to_string(entity.type),
    key: entity.key,
    name: entity.name,
    description: entity.description,
    location_id: entity.location_id,
    components: entity.components,
    behaviors: entity.behaviors,
    tags: entity.tags,
    locks: entity.locks,
    scripts: entity.scripts,
    metadata: entity.metadata
  }
end
```

## Prototype-Based Content

Game content is defined in YAML files and loaded into entities via the prototype system:

```
priv/world/prototypes/
├── _base/          # Parent prototypes (base_npc, base_room, etc.)
├── rooms/          # Room prototypes
├── npcs/           # NPC prototypes
├── items/          # Item prototypes
└── exits/          # Exit prototypes
```

**Flow**: YAML → PrototypeLoader (ETS) → Spawner → EntitySchema (SQLite)

```elixir
# Load prototypes on startup
PrototypeLoader.reload()

# Spawn entity from prototype
Spawner.spawn("goblin", location_id: room_id)

# Export entities back to YAML (backup)
WorldExporter.export_all("output/")
```

See [Prototypes](./prototypes.md) for YAML format and inheritance.

## Related
- [Entity System](./entity-system.md) - Entity structure and behaviors
- [Entity Lifecycle](./entity-lifecycle.md) - EntityServer auto-save
- [Prototypes](./prototypes.md) - YAML-based entity templates
- [Full Specification](../../Loka_Engine_Architecture.md) - Part 9: Persistence Layer
