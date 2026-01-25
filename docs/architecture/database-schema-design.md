# Database Schema Design Principles

> **For Developers**: This documents Loka's database schema conventions and design decisions.

---

## Database Technology

**Current:** SQLite3 via `ecto_sqlite3`
**Why:** Single-server MVP, simple deployment, no separate DB server needed
**Future:** May migrate to PostgreSQL for multi-server if needed

---

## Primary Key Strategy

Loka uses **mixed primary key types** depending on table characteristics:

| PK Type | When To Use | Example Tables |
|---------|-------------|----------------|
| **Auto-increment Integer** | Small tables, human-readable IDs, single server | `players`, `player_tokens` |
| **UUID (binary_id)** | High-volume tables, distributed-ready, per-player data | `timers`, `spark_states` |
| **Runtime-only** | Not persisted in DB | `entities` (in-memory) |

This is **intentional**, not inconsistent.

---

## Integer Primary Keys

### When To Use

Use auto-increment integer PKs for:
- **Small, slowly-growing tables** - Players register slowly compared to gameplay events
- **Human-readable IDs** - Easier debugging (player #42 vs UUID)
- **Single-server scope** - No distributed ID coordination needed
- **Stable references** - Foreign keys are smaller, queries are faster

### Examples

```elixir
# lib/loka/accounts/player.ex
defmodule Loka.Accounts.Player do
  use Ecto.Schema

  schema "players" do  # Default: auto-increment integer :id
    field :email, :string
    field :hashed_password, :string
    field :is_admin, :boolean
    # ...
    timestamps()
  end
end
```

**Tables using integer PKs:**
- `players` - Account table, slow growth
- `player_tokens` - Auth tokens, tied to player_id

### Trade-offs

**Pros:**
- Smaller storage (4-8 bytes vs 16 bytes for UUID)
- Faster joins (integer comparison)
- Human-readable in logs ("Player #42")
- Sequential = better B-tree locality

**Cons:**
- Predictable (security concern for public APIs)
- Single-server bottleneck for ID generation
- Can't pre-generate IDs before insert

---

## UUID Primary Keys

### When To Use

Use UUID (`binary_id`) PKs for:
- **High-volume per-player data** - Many timers/items per player
- **Distribution-ready** - Can generate IDs client-side or across servers
- **Decoupled inserts** - Pre-generate IDs before DB transaction
- **Privacy** - Non-sequential, non-predictable

### Examples

```elixir
# lib/loka/timers/timer.ex
defmodule Loka.Timers.Timer do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "timers" do
    field :player_id, :integer  # Foreign key to players
    field :timer_type, Ecto.Enum
    field :duration_ms, :integer
    # ...
    timestamps()
  end
end
```

```elixir
# lib/loka/framework/spark/spark_state.ex
defmodule Loka.Framework.Spark.SparkState do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "spark_states" do
    belongs_to :player, Loka.Accounts.Player  # Still integer FK!
    field :bond_level, :string
    field :bond_points, :integer
    # ...
    timestamps()
  end
end
```

**Tables using UUID PKs:**
- `timers` - Could have thousands per player (crafting, gathering, cooldowns)
- `spark_states` - One per player, but UUID for consistency with future expansion

### Trade-offs

**Pros:**
- Non-predictable (better security)
- Can generate client-side
- No coordination needed for distributed systems
- No auto-increment contention

**Cons:**
- Larger storage (16 bytes)
- Random UUIDs = worse B-tree locality (more fragmentation)
- Less readable in logs

---

## Runtime-Only Entities (No DB)

### Entities in Memory

```elixir
%Loka.Engine.Entity{
  id: "550e8400-e29b-41d4-a716-446655440000",  # UUID
  key: "monastery_guard",
  type: :npc,
  # ...
}
```

**Why UUIDs:**
- Entities spawn/despawn dynamically
- Need globally unique IDs across server restarts
- May distribute entities across nodes in future
- No DB table (in-memory only)

**Entities are NOT stored in DB** - they're spawned from YAML prototypes on startup. Player state references entities by ID, but entities themselves are ephemeral.

---

## Mixed Foreign Keys

Because we mix PK types, foreign keys can reference different types:

```elixir
# Timer table (UUID PK) referencing players table (integer PK)
defmodule Loka.Timers.Timer do
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "timers" do
    field :player_id, :integer  # FK to players.id (integer)
    # ...
  end
end
```

```elixir
# Spark table (UUID PK) with integer FK
defmodule Loka.Framework.Spark.SparkState do
  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id  # Default for belongs_to, but...

  schema "spark_states" do
    # This overrides to integer because Player uses integer PK
    belongs_to :player, Loka.Accounts.Player
    # SQL: player_id INTEGER REFERENCES players(id)
  end
end
```

**Ecto handles this automatically** when you use `belongs_to` - it looks at the referenced table's PK type.

---

## Migration Examples

### Integer PK Table

```elixir
defmodule Loka.Repo.Migrations.CreatePlayers do
  use Ecto.Migration

  def change do
    create table(:players) do  # Default: bigserial PK
      add :email, :string, null: false
      add :hashed_password, :string, null: false
      add :is_admin, :boolean, default: false

      timestamps()
    end

    create unique_index(:players, [:email])
  end
end
```

**Generated SQL:**
```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite auto-increment
  email TEXT NOT NULL,
  hashed_password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  inserted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### UUID PK Table

```elixir
defmodule Loka.Repo.Migrations.CreateTimers do
  use Ecto.Migration

  def change do
    create table(:timers, primary_key: false) do  # Disable default PK
      add :id, :binary_id, primary_key: true      # Use UUID instead
      add :player_id, references(:players, on_delete: :delete_all), null: false
      add :timer_type, :string, null: false
      add :duration_ms, :integer, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:timers, [:player_id])
  end
end
```

**Generated SQL:**
```sql
CREATE TABLE timers (
  id BLOB PRIMARY KEY,  -- 16-byte UUID
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  timer_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  inserted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## Decision Matrix

| Scenario | Use Integer PK | Use UUID PK |
|----------|----------------|-------------|
| Account/user table | ✅ | ❌ |
| Auth tokens (low volume) | ✅ | ❌ |
| Per-player high-volume data | ❌ | ✅ |
| Session/temporary data | ❌ | ✅ |
| Audit logs | ❌ | ✅ |
| Admin/config tables | ✅ | ❌ |
| Multi-tenant data | ❌ | ✅ |
| Public-facing IDs | ❌ | ✅ |

**Rule of thumb:**
- **Core, low-volume** → Integer
- **Per-player, high-volume** → UUID
- **When in doubt** → UUID (more flexible)

---

## Timestamps

All tables use `timestamps()` macro:

```elixir
schema "table_name" do
  # ...
  timestamps()  # Adds inserted_at, updated_at
end
```

**Default type:** `:naive_datetime` (no timezone)
**For precision:** `timestamps(type: :utc_datetime_usec)` (microsecond precision)

**Use microsecond precision when:**
- Ordering events chronologically
- Timer expiration checks
- Rate limiting

**Tables with microsecond timestamps:**
- `timers` - Need precise completion times
- Any table with sub-second ordering requirements

---

## Index Strategy

### Always Index

- Foreign keys (for joins)
- Lookup fields (email, username, etc.)
- Query filters (player_id, status, etc.)

### Example

```elixir
create table(:timers) do
  add :player_id, references(:players)
  add :timer_type, :string
  add :completes_at, :utc_datetime_usec
  timestamps()
end

create index(:timers, [:player_id])                    # Join index
create index(:timers, [:player_id, :timer_type])       # Composite filter
create index(:timers, [:completes_at])                 # Sort/range queries
```

**When NOT to index:**
- Rarely queried fields
- High cardinality with few queries
- Write-heavy tables (indexes slow writes)

---

## Compound Indexes

Use compound indexes when queries filter/sort by multiple columns:

```elixir
# Query: Get active timers for a player
from(t in Timer,
  where: t.player_id == ^player_id,
  where: is_nil(t.completed_at),
  order_by: [asc: t.completes_at]
)

# Index:
create index(:timers, [:player_id, :completed_at, :completes_at])
```

**Column order matters:**
1. Equality filters first (`player_id`)
2. Range filters next (`completed_at`)
3. Sort columns last (`completes_at`)

---

## Schema Best Practices

### ✅ DO

```elixir
# Use descriptive field names
field :completed_at, :utc_datetime      # Clear
field :status, Ecto.Enum, values: [...]  # Type-safe

# Use NOT NULL for required fields
add :player_id, :integer, null: false

# Use foreign key constraints
add :player_id, references(:players, on_delete: :delete_all)

# Use appropriate types
field :data, :map              # JSON data
field :tags, {:array, :string} # String array
```

### ❌ DON'T

```elixir
# Vague field names
field :flag, :boolean           # What flag?
field :data, :string            # What kind of data?

# Allow NULL when not needed
add :required_field, :string    # Missing null: false

# Skip indexes on FKs
add :player_id, :integer        # Should be indexed!

# Use wrong types
field :json_data, :string       # Should be :map
field :count, :string           # Should be :integer
```

---

## Migration Workflow

### Creating New Table

```bash
mix ecto.gen.migration create_table_name
```

```elixir
defmodule Loka.Repo.Migrations.CreateTableName do
  use Ecto.Migration

  def change do
    create table(:table_name) do
      # Integer PK (default)
      # OR
      # create table(:table_name, primary_key: false) do
      #   add :id, :binary_id, primary_key: true  # UUID PK

      add :field_name, :type, null: false
      add :fk_id, references(:other_table, on_delete: :delete_all)

      timestamps()
    end

    create index(:table_name, [:indexed_field])
    create unique_index(:table_name, [:unique_field])
  end
end
```

### Running Migrations

```bash
mix ecto.migrate           # Run pending migrations
mix ecto.rollback          # Rollback last migration
mix ecto.rollback --step 3 # Rollback 3 migrations
```

---

## Testing Schemas

```elixir
defmodule Loka.Timers.TimerTest do
  use Loka.DataCase

  describe "timer creation" do
    test "creates timer with valid attributes" do
      player = player_fixture()

      attrs = %{
        player_id: player.id,
        timer_type: :crafting,
        duration_ms: 60_000,
        scheduled_at: DateTime.utc_now(),
        completes_at: DateTime.add(DateTime.utc_now(), 60, :second)
      }

      assert {:ok, %Timer{} = timer} = Timer.create(attrs)
      assert timer.timer_type == :crafting
      assert timer.player_id == player.id
      assert is_binary(timer.id)  # UUID check
      assert byte_size(timer.id) == 36  # UUID string length
    end

    test "requires player_id" do
      attrs = %{timer_type: :crafting, duration_ms: 60_000}
      assert {:error, changeset} = Timer.create(attrs)
      assert "can't be blank" in errors_on(changeset).player_id
    end
  end
end
```

---

## Current Database Schema Overview

| Table | Primary Key | Foreign Keys | Purpose |
|-------|-------------|--------------|---------|
| `players` | Integer (auto) | - | User accounts |
| `player_tokens` | Integer (auto) | `player_id` → `players` | Auth tokens |
| `timers` | UUID | `player_id` → `players` | Persistent game timers |
| `spark_states` | UUID | `player_id` → `players` | Spark companion state |
| `scripts` | Integer (auto) | - | Lua/Elixir scripts (if implemented) |

**Note:** Entities are NOT in database - they're runtime-only from YAML prototypes.

---

## Future Considerations

### Multi-Server (PostgreSQL Migration)

If Loka grows to multiple servers:

**Changes needed:**
- Migrate from SQLite to PostgreSQL
- Use UUIDs for all new high-traffic tables
- Add distributed ID generation (snowflake IDs)
- Add database sharding by player_id

**No changes needed:**
- Existing UUID tables are already distributed-ready
- Integer PK tables (players) can use centralized sequence

### Audit Logging

Future audit log table should use:
```elixir
@primary_key {:id, :binary_id, autogenerate: true}
schema "audit_logs" do
  field :player_id, :integer
  field :action, :string
  field :entity_id, :string  # UUID of entity affected
  field :changes, :map       # JSON diff
  timestamps(type: :utc_datetime_usec)
end
```

**Why UUID PK:** High volume, need precise ordering

---

## Summary

- **Integer PKs** for core, low-volume tables (players, configs)
- **UUID PKs** for per-player, high-volume tables (timers, items)
- **Always index** foreign keys and query filters
- **Use constraints** (NOT NULL, REFERENCES) to enforce data integrity
- **Use appropriate types** (Ecto.Enum, :map, {:array, :string})

The mixed PK strategy is **intentional and optimized** for Loka's access patterns.

---

**Last Updated:** 2026-01-24
**See Also:**
- `lib/loka/repo.ex` - Ecto repository configuration
- `priv/repo/migrations/` - All migration files
- Ecto documentation: https://hexdocs.pm/ecto/
