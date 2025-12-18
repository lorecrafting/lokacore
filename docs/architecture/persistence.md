# Persistence Architecture

ExMUD uses an Evennia-inspired persistence pattern that balances flexibility with queryability.

## Evennia-Style Design

Like Evennia, ExMUD separates structured data (entities) from flexible attributes:

| Evennia | ExMUD Equivalent |
|---------|------------------|
| TypedObject | EntitySchema |
| AttributeHandler | EntityAttribute (EAV table) |
| `db.attr` | Entity components (binary) |
| `ndb.attr` | Not persisted (in-memory) |
| pickle serialization | `:erlang.term_to_binary` |

## Database Schema

### Entities Table
```elixir
create table(:entities, primary_key: false) do
  add :id, :uuid, primary_key: true
  add :type, :string, null: false      # room, npc, item, exit, character
  add :key, :string, null: false       # Unique identifier
  add :name, :string
  add :description, :text
  add :location_id, references(:entities, type: :uuid, on_delete: :nilify_all)

  # Serialized binary fields (Erlang terms)
  add :components, :binary             # Map of components
  add :behaviors, :binary              # List of behavior modules
  add :tags, {:array, :string}, default: []
  add :locks, :binary                  # Access control map
  add :scripts, :binary                # Lua script assignments
  add :metadata, :binary               # Timestamps, versions

  timestamps(type: :utc_datetime)
end
```

### Entity Attributes Table (EAV Pattern)
```elixir
create table(:entity_attributes, primary_key: false) do
  add :id, :uuid, primary_key: true
  add :entity_id, references(:entities, type: :uuid, on_delete: :delete_all), null: false
  add :key, :string, null: false       # Attribute name
  add :category, :string, default: "default"
  add :value, :binary, null: false     # Erlang term serialized
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
  add :source, :text, null: false      # Lua source code
  add :hook, :string                   # on_enter, on_attack, etc.
  add :enabled, :boolean, default: true

  timestamps(type: :utc_datetime)
end
```

## Custom Ecto Type for Erlang Terms

```elixir
defmodule Exmud.Ecto.Term do
  @moduledoc """
  Custom Ecto type for storing arbitrary Erlang terms as binary.
  Uses :erlang.term_to_binary/1 for serialization (like Evennia uses pickle).
  """
  use Ecto.Type

  def type, do: :binary

  def cast(term), do: {:ok, term}

  def load(nil), do: {:ok, nil}
  def load(binary) when is_binary(binary) do
    {:ok, :erlang.binary_to_term(binary)}
  rescue
    ArgumentError -> :error
  end

  def dump(nil), do: {:ok, nil}
  def dump(term), do: {:ok, :erlang.term_to_binary(term)}
end
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
  case :ets.lookup(:exmud_entities, entity_id) do
    [{^entity_id, entity}] -> {:ok, entity}
    [] ->
      # Cache miss - load from database
      case load_from_db(entity_id) do
        {:ok, entity} ->
          :ets.insert(:exmud_entities, {entity_id, entity})
          {:ok, entity}
        error -> error
      end
  end
end
```

## Auto-Save System

Active entities auto-save every 5 minutes if dirty:

```elixir
@impl true
def handle_info(:auto_save, %{dirty?: true} = state) do
  Repo.save_entity(state.entity)
  Process.send_after(self(), :auto_save, :timer.minutes(5))
  {:noreply, %{state | dirty?: false, last_saved: DateTime.utc_now()}}
end

@impl true
def handle_info(:auto_save, %{dirty?: false} = state) do
  # Nothing to save, schedule next check
  Process.send_after(self(), :auto_save, :timer.minutes(5))
  {:noreply, state}
end
```

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

## Related
- [Entity System](./entity-system.md) - Entity structure and behaviors
- [Full Specification](../../ExMUD_Engine_Architecture.md) - Part 9: Persistence Layer
