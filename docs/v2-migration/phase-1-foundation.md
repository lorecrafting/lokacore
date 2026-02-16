# Phase 1: Foundation

> Full spec: `docs/architecture/unified-object-system-v2.md` Section 16 (Steps 1.1-1.6) + Section 7 (Entities API) + Section 1 (Schema)
> **Blocks**: everything else. This must be solid.

## Task 1.1: Create Unified Entities Migration

### Migration SQL

Create `priv/repo/migrations/TIMESTAMP_create_unified_entities.exs`:

```elixir
def change do
  # Drop old tables (pre-production: no data to preserve)
  drop_if_exists table(:entity_attributes)
  drop_if_exists table(:player_game_states)
  drop_if_exists table(:entities)

  create table(:entities, primary_key: false) do
    add :id, :binary_id, primary_key: true
    add :type, :string, null: false
    add :key, :string
    add :prototype_key, :string
    add :is_prototype, :boolean, default: false
    add :version, :integer, default: 1
    add :short_desc, :string
    add :long_desc, :string
    add :extra_desc, :text
    add :keywords, :text, default: "[]"       # JSON array
    add :primary_keyword, :string
    add :mood, :string
    add :location_id, references(:entities, type: :binary_id, on_delete: :nilify_all)
    add :account_id, references(:players, type: :binary_id, on_delete: :nilify_all)
    add :components, :text, default: "{}"     # JSON: all game data
    add :behaviors, :text, default: "[]"      # JSON: behavior module list
    add :scripts, :text, default: "{}"        # JSON: event_name → code string
    add :metadata, :text, default: "{}"       # JSON: bookkeeping (parent_key, etc.)
    timestamps(type: :utc_datetime)
  end

  create table(:entity_tags, primary_key: false) do
    add :entity_id, references(:entities, type: :binary_id, on_delete: :delete_all), null: false
    add :tag, :string, null: false
  end

  # Audit log
  create table(:entity_log) do
    add :entity_id, references(:entities, type: :binary_id, on_delete: :delete_all)
    add :action, :string, null: false
    add :changes, :text            # JSON
    add :source, :string           # "seeder", "builder:name", "script:key"
    timestamps(type: :utc_datetime, updated_at: false)
  end

  # Indexes
  create index(:entities, [:type])
  create index(:entities, [:key])
  create index(:entities, [:location_id])
  create index(:entities, [:location_id, :type])
  create index(:entities, [:account_id])
  create index(:entities, [:prototype_key])
  create index(:entities, [:is_prototype])
  create unique_index(:entities, [:key, :type], where: "is_prototype = 1", name: :entities_prototype_unique)

  create index(:entity_tags, [:tag])
  create index(:entity_tags, [:entity_id])
  create unique_index(:entity_tags, [:entity_id, :tag])

  create index(:entity_log, [:entity_id])
  create index(:entity_log, [:action])
end
```

Also create:
- `lib/loka/engine/schema/entity_tag_schema.ex` — Ecto schema for entity_tags
- `lib/loka/engine/schema/entity_log_schema.ex` — Ecto schema for entity_log

## Task 1.2: Evolve Entity Struct

**File**: `lib/loka/engine/entity.ex`

### Remove these fields:
- `data` (replaced by components)
- `attributes` (merged into components)
- `contents` (derived from location_id queries)
- `locks` (moved into components per Decision 52)
- `parent_key` (moved to metadata)

### New struct:
```elixir
defstruct [
  :id, :type, :key, :prototype_key,
  :short_desc, :long_desc, :extra_desc, :primary_keyword, :mood,
  :location_id, :account_id,
  is_prototype: false,
  version: 1,
  keywords: [],
  components: %{},
  behaviors: [],
  tags: [],
  scripts: %{},
  metadata: %{}
]
```

### Add constructor + snapshot:
```elixir
def new(attrs) do
  %Entity{
    id: attrs[:id] || Ecto.UUID.generate(),
    type: attrs[:type] || raise(ArgumentError, "type required"),
    version: 1,
    is_prototype: attrs[:is_prototype] || false,
    components: attrs[:components] || %{},
    tags: attrs[:tags] || [],
    metadata: attrs[:metadata] || %{}
  }
  |> struct!(Map.drop(attrs, [:id, :type, :is_prototype, :components, :tags, :metadata]))
end

def snapshot(entity), do: entity
```

### Entity types:
```elixir
@type entity_type :: :room | :npc | :item | :exit | :character | :quest |
  :dialogue | :zone | :storyline | :skill | :recipe | :resource |
  :status | :system | :script | :social
```

## Task 1.3: Evolve EntitySchema + Entities API

### EntitySchema (`lib/loka/engine/schema/entity_schema.ex`)
- Point at `entities` table (old table dropped and recreated)
- Remove `data` column mapping
- Remove `attributes` has_many
- `from_entity/1` includes ALL fields (no longer excludes attributes)
- `to_entity/1` hydrates Entity struct from schema (including tags from join table)

### Entities API (`lib/loka/engine/entities.ex`)

Replace existing functions with unified API:

```elixir
# Single-result reads
find_one(uuid_string)                     # {:ok, entity} | {:error, :not_found}
find_one(key: k, type: t)               # {:ok, entity} | {:error, :not_found}
find_one(account_id: id)                # {:ok, entity} | {:error, :not_found}

# Multi-result reads
find_all(type: :npc)                     # [entity]
find_all(location_id: room_id)           # [entity]
find_all(location_id: id, type: :npc)    # [entity]
find_all(tags: ["hostile"])              # [entity]
find_all(is_prototype: true, type: :npc) # [entity]

# Convenience
find(id_or_opts)                         # dispatches to find_one or find_all

# Batch
find_many(ids)                           # [entity] — WHERE id IN (?)
find_many(keys, type)                    # [entity] — WHERE key IN (?) AND type = ?

# Writes
save(entity)                             # insert or update (optimistic lock via version)
save_batch(entities)                     # bulk insert (seeding/shutdown only)
delete(id)                               # remove from DB
update(id, changes_map)                  # partial update

# Tags (immediate DB writes, not deferred)
add_tag(entity_id, tag)
remove_tag(entity_id, tag)
get_tags(entity_id)                      # [string]
```

**Key rules:**
- `find_one` with key ALWAYS requires type (keys are unique per type, not globally)
- `find_one` with single string arg validates UUID format (raises on non-UUID)
- `save/1` checks version for optimistic lock — raises on conflict
- `save_batch/1` raises if any entity ID has a running GenServer
- Tags are in a join table, queried via `entity_tags` with indexed lookups

## Task 1.4: Entities API Tests

Create `test/loka/engine/entities_v2_test.exs`:

```elixir
# Test categories:
# 1. CRUD: create, read, update, delete
# 2. find_one: UUID lookup, key+type lookup, account_id lookup
# 3. find_all: by type, by location, by tags, by prototype_key, by is_prototype
# 4. find dispatch: verify find/1 routes correctly
# 5. find_many: batch UUID reads, batch key+type reads
# 6. Tags: add_tag, remove_tag, get_tags, query by tags
# 7. Optimistic locking: version conflict on save
# 8. Prototype uniqueness: unique index on key+type where is_prototype
# 9. Location cascade: nilify location_id on parent delete
```

Use `Loka.DataCase` with `async: true` where possible.
