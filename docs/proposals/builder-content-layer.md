# Builder Content Layer - Proposal

> **Status**: Proposal (not yet implemented)
> **Issue**: `lokacore-12r`
> **Last Updated**: 2026-01-12
> **Inspired by**: [Evennia's Prototype System](https://www.evennia.com/docs/latest/Components/Prototypes.html)

## Executive Summary

This proposal describes a future architecture for supporting **non-technical builders** who need to create and edit game content through a web UI without access to YAML files or deployment pipelines.

**This is not implemented yet.** The current system uses YAML-only content storage.

**Key Design Principles**:
1. YAML remains read-only "core" content (developer-controlled)
2. Database stores builder-created content (mutable via UI)
3. Clear namespacing prevents conflicts
4. Builders can inherit from core but not override it
5. All content uses the same TypedObject foundation

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Architecture Overview](#architecture-overview)
3. [Resolution Order](#resolution-order)
4. [Namespacing Strategy](#namespacing-strategy)
5. [Inheritance Model](#inheritance-model)
6. [World Builder UI](#world-builder-ui)
7. [Validation & Safety](#validation--safety)
8. [Versioning & History](#versioning--history)
9. [Operational Concerns](#operational-concerns)
10. [Development Workflow](#development-workflow)
11. [Deployment Considerations](#deployment-considerations)
12. [Migration Strategy](#migration-strategy)
13. [Edge Cases & Gotchas](#edge-cases--gotchas)
14. [Implementation Phases](#implementation-phases)
15. [Open Questions](#open-questions)

---

## Problem Statement

### Current State

```
YAML (priv/world/) → TypedObject.Loader → ETS Registry → Game
                     (single source of truth)
```

This works well for developers but creates barriers for non-technical builders:

| Barrier | Impact |
|---------|--------|
| Can't edit YAML files | No file system access |
| Can't run `mix loka.reload` | No terminal access |
| Can't deploy changes | No CI/CD access |
| Can't use git | No version control knowledge |

### Target State

```
┌─────────────────────────────────────────────────────────────┐
│                    TypedObject Registry                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   builder:*  →  Database (mutable, instant, builder-owned)  │
│                     ↑ inherits from                         │
│   core:*     →  YAML files (read-only, deploy-gated)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Builders get:
- Web UI for creating/editing content
- Instant changes (no deploy required)
- Version history and rollback
- Safe sandbox that can't break core game

---

## Architecture Overview

### Dual-Source Model

Adapting Evennia's approach to Loka:

| Source | Storage | Mutability | Owner | Use Case |
|--------|---------|------------|-------|----------|
| **Core** | YAML files | Read-only at runtime | Developers | Base game content, templates |
| **Builder** | Database | Mutable via UI | Builders | Custom NPCs, quests, areas |

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ WORLD BUILDER UI (LiveView)                                 │
│ - Create/edit builder content                               │
│ - View (read-only) core content                             │
│ - Inherits from core prototypes                             │
├─────────────────────────────────────────────────────────────┤
│ CONTENT MODULES (Content.Quest, Content.Script, etc.)       │
│ - Unified API regardless of source                          │
│ - Resolution: check DB first, then YAML                     │
├─────────────────────────────────────────────────────────────┤
│ TYPED OBJECT REGISTRY (ETS)                                 │
│ - Caches all content for fast access                        │
│ - Tracks source (core vs builder) in metadata               │
├─────────────────────────────────────────────────────────────┤
│ STORAGE LAYER                                               │
│ ┌─────────────────────┐  ┌─────────────────────┐           │
│ │ typed_objects table │  │ priv/world/*.yml    │           │
│ │ (builder content)   │  │ (core content)      │           │
│ └─────────────────────┘  └─────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Source Tracking

Every TypedObject tracks its source in metadata:

```elixir
%TypedObject{
  key: "builder:guard_captain",
  metadata: %{
    source: :database,           # or :yaml
    created_at: ~U[2026-01-12 10:00:00Z],
    created_by: "builder_alice",
    updated_at: ~U[2026-01-12 14:30:00Z],
    updated_by: "builder_bob",
    version: 3
  }
}
```

---

## Resolution Order

### Lookup Strategy

When retrieving content by key:

```elixir
def get(key) do
  case Registry.get(key) do
    nil -> {:error, :not_found}
    object -> {:ok, object}
  end
end
```

The Registry is populated at startup and on changes:

```elixir
def load_all do
  # 1. Load YAML first (core content)
  yaml_objects = TypedObject.Loader.load_from_yaml()

  # 2. Load DB second (builder content)
  db_objects = TypedObject.Schema.load_all_prototypes()

  # 3. Merge with DB taking precedence for same keys
  # (but namespacing prevents same-key conflicts)
  all_objects = merge_sources(yaml_objects, db_objects)

  # 4. Resolve inheritance chains
  resolved = resolve_all_parents(all_objects)

  # 5. Populate registry
  Registry.put_all(resolved)
end
```

### Namespace Isolation (No Conflicts)

By enforcing namespacing, we eliminate resolution conflicts:

| Namespace | Source | Example Keys |
|-----------|--------|--------------|
| `core:*` or unprefixed | YAML | `novice_pema`, `core:dragon_hunt` |
| `builder:*` | Database | `builder:guard_captain`, `builder:custom_quest` |

**Rule**: Builder content MUST use `builder:` prefix. Core content MAY omit prefix.

This means:
- No ambiguity about which source wins
- Builders cannot accidentally shadow core content
- Clear ownership boundaries

### Why Not "DB Overrides YAML"?

We considered letting DB content override YAML with the same key, but rejected it:

| Approach | Pros | Cons |
|----------|------|------|
| DB overrides YAML | Builders can "fix" core | Shadow bugs, "why isn't my YAML change working?", unclear ownership |
| **Namespace isolation** | Clear boundaries, no conflicts | Builders can't patch core bugs |

**Decision**: Namespace isolation. If builders find core bugs, they report them; developers fix in YAML.

---

## Namespacing Strategy

### Key Format

```
[namespace:]identifier
```

| Pattern | Meaning | Example |
|---------|---------|---------|
| `identifier` | Core content (legacy/default) | `novice_pema` |
| `core:identifier` | Explicit core content | `core:dragon_hunt` |
| `builder:identifier` | Builder-created content | `builder:guard_captain` |
| `builder:alice:identifier` | Builder-owned content | `builder:alice:my_npc` |

### Namespace Rules

1. **Core content** (YAML):
   - May use unprefixed keys (backward compatible)
   - May use `core:` prefix for clarity
   - Cannot use `builder:` prefix

2. **Builder content** (Database):
   - MUST use `builder:` prefix
   - MAY include builder username: `builder:alice:my_npc`
   - Cannot use unprefixed keys

3. **Inheritance**:
   - Builder content CAN inherit from core: `parent_key: "core:base_npc"`
   - Core content CANNOT inherit from builder (would create deploy dependency)

### Validation

```elixir
defmodule TypedObject.Namespace do
  @core_prefixes ["core:", ""]
  @builder_prefix "builder:"

  def validate_key(key, source) do
    case source do
      :yaml ->
        if String.starts_with?(key, @builder_prefix) do
          {:error, "YAML content cannot use builder: prefix"}
        else
          :ok
        end

      :database ->
        if String.starts_with?(key, @builder_prefix) do
          :ok
        else
          {:error, "Database content must use builder: prefix"}
        end
    end
  end

  def builder_key(identifier, builder_id \\ nil) do
    if builder_id do
      "builder:#{builder_id}:#{identifier}"
    else
      "builder:#{identifier}"
    end
  end

  def parse_key(key) do
    cond do
      String.starts_with?(key, "builder:") ->
        parts = String.split(key, ":", parts: 3)
        case parts do
          ["builder", builder_id, identifier] ->
            %{namespace: :builder, owner: builder_id, identifier: identifier}
          ["builder", identifier] ->
            %{namespace: :builder, owner: nil, identifier: identifier}
        end

      String.starts_with?(key, "core:") ->
        %{namespace: :core, owner: nil, identifier: String.replace_prefix(key, "core:", "")}

      true ->
        %{namespace: :core, owner: nil, identifier: key}
    end
  end
end
```

---

## Inheritance Model

### How Inheritance Works

Builder content can inherit from core prototypes:

```yaml
# Core prototype (priv/world/prototypes/npcs/_base/base_guard.yml)
key: base_guard
type: npc
attributes:
  level: 5
  faction: town_guard
components:
  combatant:
    health: { current: 50, max: 50 }
    damage: 8
behaviors:
  - patrol
  - aggressive_to_criminals
```

```elixir
# Builder content (database)
%TypedObject{
  key: "builder:elite_guard",
  parent_key: "base_guard",  # Inherits from core
  name: "Elite Guard Captain",
  attributes: %{
    level: 10,  # Override
    title: "Captain"  # Add new
  },
  components: %{
    combatant: %{
      health: %{current: 100, max: 100},  # Override
      damage: 15  # Override
    }
  }
  # Inherits behaviors: [:patrol, :aggressive_to_criminals]
}
```

### Inheritance Chain Resolution

```
builder:elite_guard
    ↓ inherits from
base_guard
    ↓ inherits from
base_npc
    ↓ (root - no parent)
```

Resolution happens at load time via topological sort:
1. Load all objects (YAML + DB)
2. Build dependency graph
3. Topological sort (parents before children)
4. Merge each child with resolved parent

### Merge Strategy

```elixir
def merge_parent(child, parent) do
  %TypedObject{
    # Identity (child always wins)
    key: child.key,
    type: child.type || parent.type,
    subtype: child.subtype || parent.subtype,

    # Display (child overrides)
    name: child.name || parent.name,
    description: child.description || parent.description,
    keywords: merge_lists(parent.keywords, child.keywords),

    # Data (deep merge, child wins conflicts)
    attributes: deep_merge(parent.attributes, child.attributes),
    data: deep_merge(parent.data, child.data),
    components: deep_merge(parent.components, child.components),

    # Collections (concatenate, dedupe)
    tags: merge_lists(parent.tags, child.tags),
    behaviors: merge_lists(parent.behaviors, child.behaviors),

    # Access control (child overrides)
    locks: Map.merge(parent.locks || %{}, child.locks || %{}),

    # Scripts (merge by hook)
    scripts: deep_merge(parent.scripts, child.scripts)
  }
end
```

### Broken Reference Handling

If a builder references a non-existent parent:

```elixir
def resolve_parent(object, all_objects) do
  case object.parent_key do
    nil ->
      {:ok, object}

    parent_key ->
      case Map.get(all_objects, parent_key) do
        nil ->
          Logger.warning("Broken parent reference: #{object.key} -> #{parent_key}")
          # Option 1: Fail loudly
          {:error, {:broken_parent, object.key, parent_key}}
          # Option 2: Continue without parent (current behavior)
          {:ok, %{object | parent_key: nil, metadata: Map.put(object.metadata, :broken_parent, parent_key)}}

        parent ->
          {:ok, merge_parent(object, parent)}
      end
  end
end
```

**Decision**: Log warning, mark in metadata, continue without parent. This prevents one broken reference from breaking all builder content.

---

## World Builder UI

### UI Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN DASHBOARD (/admin)                                    │
├─────────────────────────────────────────────────────────────┤
│ Tabs:                                                       │
│ ┌─────────┬─────────┬─────────┬─────────┬─────────┐        │
│ │ Entities│ Rooms   │ Quests  │ Scripts │ Zones   │        │
│ └─────────┴─────────┴─────────┴─────────┴─────────┘        │
│                                                             │
│ Each tab shows:                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ CORE CONTENT (read-only)          [View] [Clone]       ││
│ │ ├─ novice_pema                                          ││
│ │ ├─ base_guard                                           ││
│ │ └─ ...                                                  ││
│ ├─────────────────────────────────────────────────────────┤│
│ │ BUILDER CONTENT (editable)        [Edit] [Delete]      ││
│ │ ├─ builder:elite_guard                                  ││
│ │ ├─ builder:custom_quest                                 ││
│ │ └─ ...                                                  ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Operations by Content Source

| Operation | Core Content | Builder Content |
|-----------|--------------|-----------------|
| View | Yes | Yes |
| Edit | No (read-only) | Yes |
| Delete | No | Yes |
| Clone | Yes → creates builder copy | Yes |
| Inherit | Yes (as parent) | Yes (as parent) |
| Test/Preview | Yes | Yes |

### Clone Workflow

When a builder clones core content:

```elixir
def clone_to_builder(core_key, builder_id, new_identifier) do
  with {:ok, core_object} <- TypedObject.get(core_key),
       :ok <- validate_clone_permissions(builder_id, core_object) do

    builder_key = "builder:#{builder_id}:#{new_identifier}"

    cloned = %TypedObject{
      core_object |
      key: builder_key,
      parent_key: core_key,  # Maintain inheritance link
      metadata: %{
        source: :database,
        created_at: DateTime.utc_now(),
        created_by: builder_id,
        cloned_from: core_key
      }
    }

    TypedObject.Schema.insert(cloned)
  end
end
```

### Form Validation

Real-time validation as builders edit:

```elixir
defmodule WorldBuilder.ContentForm do
  def validate_live(changeset, content_type) do
    changeset
    |> validate_required_fields(content_type)
    |> validate_key_format()
    |> validate_parent_exists()
    |> validate_references()  # Check that referenced entities exist
    |> validate_scripts()     # Syntax check Elixir scripts
    |> validate_dialogue_tree()  # Check for broken node links
  end
end
```

### Permission Model

```elixir
defmodule WorldBuilder.Permissions do
  @doc """
  Builder permission levels:
  - :viewer - Can view all content, cannot edit
  - :builder - Can create/edit own builder content
  - :senior_builder - Can edit any builder content
  - :admin - Full access including delete
  """

  def can_edit?(user, object) do
    cond do
      object.metadata.source == :yaml ->
        false  # Core content is never editable

      user.role == :admin ->
        true

      user.role == :senior_builder ->
        object.metadata.source == :database

      user.role == :builder ->
        object.metadata.created_by == user.id

      true ->
        false
    end
  end

  def can_delete?(user, object) do
    user.role == :admin && object.metadata.source == :database
  end
end
```

---

## Validation & Safety

### Content Validation Pipeline

```elixir
defmodule TypedObject.Validation do
  @doc """
  Validates content before saving to database.
  Returns {:ok, object} or {:error, errors}.
  """
  def validate(object) do
    object
    |> validate_structure()      # Required fields, types
    |> validate_namespace()      # Key format
    |> validate_parent()         # Parent exists
    |> validate_references()     # Referenced entities exist
    |> validate_type_specific()  # Quest objectives, dialogue nodes, etc.
    |> validate_scripts()        # Elixir syntax
    |> validate_locks()          # Lock string syntax
    |> collect_errors()
  end
end
```

### Script Sandboxing

Builder scripts run in the same sandbox as core scripts:

```elixir
defmodule Script.Sandbox do
  @allowed_modules [
    # Safe modules only
    Enum, List, Map, String, Integer, Float,
    # Game API
    Script.API
  ]

  @forbidden_patterns [
    ~r/System\./,
    ~r/File\./,
    ~r/Code\./,
    ~r/:erlang\./,
    ~r/send\(/,
    ~r/spawn/
  ]

  def validate_source(source) do
    with :ok <- check_forbidden_patterns(source),
         :ok <- check_syntax(source),
         :ok <- check_module_access(source) do
      :ok
    end
  end
end
```

### Reference Validation

Ensure builder content doesn't reference non-existent entities:

```elixir
defmodule TypedObject.ReferenceValidator do
  @reference_fields [
    {:quest, [:objectives, :*, :target_id]},
    {:quest, [:giver]},
    {:dialogue, [:nodes, :*, :action, 1]},  # ["give_item", "item_key"]
    {:npc, [:scripts, :*, :script_key]},
    {:room, [:exits, :*, :target]}
  ]

  def validate_references(object) do
    @reference_fields
    |> Enum.filter(fn {type, _} -> type == object.type end)
    |> Enum.flat_map(fn {_, path} -> extract_references(object, path) end)
    |> Enum.reject(&reference_exists?/1)
    |> case do
      [] -> :ok
      broken -> {:error, {:broken_references, broken}}
    end
  end
end
```

### Dangerous Operation Warnings

```elixir
defmodule WorldBuilder.SafetyChecks do
  def check_before_save(old_object, new_object) do
    warnings = []

    # Warn if changing parent (could break inheritance)
    warnings = if old_object.parent_key != new_object.parent_key do
      ["Changing parent from #{old_object.parent_key} to #{new_object.parent_key}. This may affect inherited properties." | warnings]
    else
      warnings
    end

    # Warn if object is referenced by others
    dependents = find_dependents(old_object.key)
    warnings = if length(dependents) > 0 do
      ["This object is inherited by #{length(dependents)} other objects: #{Enum.join(dependents, ", ")}" | warnings]
    else
      warnings
    end

    warnings
  end
end
```

---

## Versioning & History

### Version Tracking Schema

```elixir
defmodule TypedObject.Version do
  use Ecto.Schema

  schema "typed_object_versions" do
    field :typed_object_id, :binary_id
    field :key, :string
    field :version, :integer
    field :data, :map  # Full snapshot of the object
    field :diff, :map  # What changed from previous version
    field :changed_by, :string
    field :change_type, :string  # "create", "update", "delete"
    field :change_reason, :string  # Optional commit message

    timestamps(type: :utc_datetime)
  end
end
```

### Automatic Versioning

```elixir
defmodule TypedObject.Schema do
  def update_with_version(object, changes, user_id, reason \\ nil) do
    Repo.transaction(fn ->
      # Get current version
      current = Repo.get!(TypedObject.Schema, object.id)
      new_version = (current.metadata["version"] || 0) + 1

      # Create version record
      %TypedObject.Version{}
      |> TypedObject.Version.changeset(%{
        typed_object_id: object.id,
        key: object.key,
        version: new_version,
        data: Map.from_struct(current),
        diff: calculate_diff(current, changes),
        changed_by: user_id,
        change_type: "update",
        change_reason: reason
      })
      |> Repo.insert!()

      # Update the object
      current
      |> changeset(Map.put(changes, :metadata, %{
        current.metadata | "version" => new_version, "updated_by" => user_id
      }))
      |> Repo.update!()
    end)
  end
end
```

### Rollback Support

```elixir
defmodule WorldBuilder.Rollback do
  def rollback_to_version(object_key, target_version, user_id) do
    with {:ok, version_record} <- get_version(object_key, target_version),
         {:ok, current} <- TypedObject.get(object_key),
         :ok <- validate_rollback_safe(current, version_record) do

      TypedObject.Schema.update_with_version(
        current,
        version_record.data,
        user_id,
        "Rollback to version #{target_version}"
      )
    end
  end

  def list_versions(object_key, limit \\ 50) do
    TypedObject.Version
    |> where([v], v.key == ^object_key)
    |> order_by([v], desc: v.version)
    |> limit(^limit)
    |> Repo.all()
  end
end
```

### Version Cleanup Policy

```elixir
defmodule TypedObject.VersionCleanup do
  @doc """
  Cleanup old versions to prevent unbounded growth.
  Policy: Keep last 100 versions, or all versions from last 90 days.
  """
  def cleanup_old_versions do
    cutoff_date = DateTime.add(DateTime.utc_now(), -90, :day)

    # For each object, keep versions that are either:
    # - In the last 100 versions, OR
    # - Created in the last 90 days
    # Delete the rest

    Repo.query!("""
      DELETE FROM typed_object_versions
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY key ORDER BY version DESC) as rn,
                 inserted_at
          FROM typed_object_versions
        ) ranked
        WHERE rn > 100 AND inserted_at < $1
      )
    """, [cutoff_date])
  end
end
```

---

## Operational Concerns

### Monitoring

```elixir
defmodule WorldBuilder.Telemetry do
  def track_content_change(event_type, object, user_id, metadata \\ %{}) do
    :telemetry.execute(
      [:world_builder, :content, event_type],
      %{count: 1},
      %{
        object_key: object.key,
        object_type: object.type,
        user_id: user_id,
        source: object.metadata.source,
        metadata: metadata
      }
    )
  end
end

# Dashboard metrics to track:
# - Content changes per hour/day (creates, updates, deletes)
# - Changes by builder (who's active?)
# - Validation failures (what are builders struggling with?)
# - Rollbacks (are there quality issues?)
# - Broken reference warnings
```

### Audit Log

```elixir
defmodule WorldBuilder.AuditLog do
  use Ecto.Schema

  schema "world_builder_audit_log" do
    field :action, :string        # "create", "update", "delete", "clone", "rollback"
    field :object_key, :string
    field :object_type, :string
    field :user_id, :string
    field :user_role, :string
    field :changes, :map          # What changed
    field :ip_address, :string
    field :user_agent, :string

    timestamps(type: :utc_datetime)
  end
end
```

### Live Operations

#### Emergency Content Disable

```elixir
defmodule WorldBuilder.LiveOps do
  @doc """
  Disable problematic builder content without deleting it.
  Useful when content causes crashes or exploits.
  """
  def disable_content(object_key, reason, admin_id) do
    with {:ok, object} <- TypedObject.get(object_key),
         :ok <- validate_is_builder_content(object) do

      TypedObject.Schema.update(object, %{
        metadata: Map.merge(object.metadata, %{
          "disabled" => true,
          "disabled_at" => DateTime.utc_now(),
          "disabled_by" => admin_id,
          "disabled_reason" => reason
        })
      })

      # Remove from active registry
      TypedObject.Registry.delete(object_key)

      AuditLog.log(:disable, object_key, admin_id, %{reason: reason})
    end
  end

  def enable_content(object_key, admin_id) do
    # Re-enable and reload into registry
  end
end
```

#### Bulk Operations

```elixir
defmodule WorldBuilder.BulkOps do
  @doc """
  Disable all content by a specific builder.
  Useful if a builder account is compromised.
  """
  def disable_builder_content(builder_id, reason, admin_id) do
    TypedObject.Schema
    |> where([o], fragment("metadata->>'created_by' = ?", ^builder_id))
    |> Repo.all()
    |> Enum.each(fn object ->
      LiveOps.disable_content(object.key, reason, admin_id)
    end)
  end
end
```

### Backup Strategy

```elixir
# Builder content backup (daily)
defmodule WorldBuilder.Backup do
  def export_all_builder_content do
    TypedObject.Schema
    |> where([o], fragment("key LIKE 'builder:%'"))
    |> Repo.all()
    |> Enum.map(&TypedObject.Schema.to_typed_object/1)
    |> Jason.encode!()
  end

  def import_builder_content(json_data) do
    # Validation + import logic
  end
end
```

---

## Development Workflow

### Local Development

```bash
# Core content workflow (developers)
1. Edit YAML files in priv/world/
2. mix loka.reload          # Hot-reload in dev
3. Test changes
4. Commit to git
5. Deploy

# Builder content workflow (developers testing builder features)
1. Use World Builder UI at /admin
2. Changes are instant (DB)
3. Test in-game
4. No deploy needed
```

### Testing

```elixir
# Test that resolution order works correctly
defmodule TypedObject.ResolutionTest do
  use Loka.DataCase

  describe "resolution order" do
    test "builder content loads from database" do
      # Insert builder content
      insert(:typed_object, key: "builder:test_npc", source: :database)

      # Reload registry
      TypedObject.Loader.reload()

      # Should find it
      assert {:ok, obj} = TypedObject.get("builder:test_npc")
      assert obj.metadata.source == :database
    end

    test "builder content can inherit from core" do
      # Core parent exists in YAML (via fixtures)
      insert(:typed_object,
        key: "builder:child_npc",
        parent_key: "base_npc",
        attributes: %{level: 10}
      )

      TypedObject.Loader.reload()

      {:ok, obj} = TypedObject.get("builder:child_npc")
      # Should have inherited attributes from base_npc
      assert obj.attributes.level == 10  # Overridden
      assert obj.components.combatant != nil  # Inherited
    end

    test "builder content cannot use unprefixed keys" do
      assert {:error, _} = TypedObject.Schema.insert(%{
        key: "unprefixed_npc",  # Missing builder: prefix
        type: :entity,
        subtype: :npc
      })
    end
  end
end
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Test builder content layer
  run: |
    mix test test/loka/engine/typed_object/resolution_test.exs
    mix test test/loka/world_builder/
```

---

## Deployment Considerations

### Database Migrations

```elixir
# Migration: Add version tracking
defmodule Loka.Repo.Migrations.AddTypedObjectVersions do
  use Ecto.Migration

  def change do
    create table(:typed_object_versions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :typed_object_id, references(:typed_objects, type: :binary_id)
      add :key, :string, null: false
      add :version, :integer, null: false
      add :data, :map, null: false
      add :diff, :map
      add :changed_by, :string
      add :change_type, :string, null: false
      add :change_reason, :text

      timestamps(type: :utc_datetime)
    end

    create index(:typed_object_versions, [:key])
    create index(:typed_object_versions, [:typed_object_id])
    create index(:typed_object_versions, [:changed_by])
    create unique_index(:typed_object_versions, [:key, :version])
  end
end
```

### Zero-Downtime Deployment

Builder content changes are instant (database), but core content changes require deployment:

```
┌─────────────────────────────────────────────────────────────┐
│ Deployment Timeline                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ t=0   Deploy starts                                         │
│       - New YAML loaded into new instances                  │
│       - Old instances still serve old YAML                  │
│                                                             │
│ t=30s Rolling restart completes                             │
│       - All instances have new YAML                         │
│       - Builder content unchanged (same DB)                 │
│                                                             │
│ IMPORTANT: If YAML changes break builder content            │
│ (e.g., renamed parent_key), builders see errors until       │
│ they update their content.                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Breaking Changes in Core

When core content changes might break builder content:

```elixir
defmodule TypedObject.BreakingChangeDetector do
  @doc """
  Run before deploying YAML changes to detect potential breaks.
  """
  def detect_breaking_changes(old_yaml_objects, new_yaml_objects) do
    # Find renamed keys
    renamed = find_renamed_keys(old_yaml_objects, new_yaml_objects)

    # Find builder content referencing old keys
    affected_builder_content =
      TypedObject.Schema
      |> where([o], fragment("key LIKE 'builder:%'"))
      |> where([o], o.parent_key in ^Map.keys(renamed))
      |> Repo.all()

    if length(affected_builder_content) > 0 do
      {:warning, %{
        renamed_keys: renamed,
        affected_builder_content: Enum.map(affected_builder_content, & &1.key)
      }}
    else
      :ok
    end
  end
end
```

---

## Migration Strategy

### Phase 1: Foundation (No Builder UI Changes)

1. Add namespace validation to TypedObject
2. Add source tracking to metadata
3. Add version tracking schema
4. Update Loader to support dual-source
5. All existing content continues to work (YAML-only)

### Phase 2: Database Storage

1. Implement `TypedObject.Schema` CRUD operations
2. Add `builder:` prefix enforcement
3. Update Registry to load from both sources
4. Add audit logging

### Phase 3: World Builder UI

1. Add "Core" vs "Builder" sections to each tab
2. Implement clone-to-builder workflow
3. Add version history viewer
4. Add rollback functionality
5. Update permission checks

### Phase 4: Polish

1. Add bulk operations (disable builder, export/import)
2. Add breaking change detection
3. Add monitoring dashboards
4. Documentation for builders

### Rollback Plan

If issues arise after enabling builder content:

```bash
# Emergency: Disable all builder content
mix loka.builder.disable_all --reason="emergency rollback"

# This sets disabled=true on all builder content and removes from registry
# Core content continues to work
# Builders see "content disabled" message in UI
```

---

## Edge Cases & Gotchas

### 1. Circular Inheritance

```
builder:a inherits from builder:b
builder:b inherits from builder:a
```

**Solution**: Detect cycles during topological sort, reject with clear error.

### 2. Deep Inheritance Chains

```
builder:a → builder:b → builder:c → core:base → core:root
```

**Solution**: Limit inheritance depth (e.g., max 10 levels). Log warning at 5+.

### 3. Parent Deleted

Builder content references a parent that gets deleted (core YAML removed or builder parent deleted).

**Solution**:
- Core: Breaking change detection warns before deploy
- Builder: Soft-delete with "orphaned" flag, show in UI

### 4. Concurrent Edits

Two builders edit the same object simultaneously.

**Solution**:
- Optimistic locking via version field
- Last write wins, but version conflict shows diff
- Consider: lock object while editing (5-min timeout)

### 5. Large Version History

Object edited 10,000 times creates huge version table.

**Solution**: Version cleanup policy (keep last 100 or last 90 days).

### 6. Script Exploits

Builder writes malicious script that crashes server or exploits game.

**Solution**:
- Sandbox validation before save
- Rate limiting on script execution
- Easy disable via LiveOps
- Audit log for investigation

### 7. Reference Explosion

Builder creates 1000 NPCs that all reference the same item.

**Solution**:
- Reference count limits (e.g., max 100 references to single object)
- Pagination in UI
- Background validation job

### 8. Import/Export Key Conflicts

Importing backup creates keys that conflict with existing content.

**Solution**:
- Import validates key uniqueness
- Option to prefix imported keys: `builder:imported:original_key`

### 9. Time Zone Issues

Builder in Tokyo, admin in NYC, version timestamps confusing.

**Solution**: Always store UTC, display in user's local timezone.

### 10. Unicode in Keys

Builder creates `builder:日本語_npc`.

**Solution**:
- Validate keys are ASCII alphanumeric + underscore + colon
- Reject non-ASCII with helpful error message

---

## Open Questions

### Q1: Should builders be able to edit each other's content?

**Options**:
- A) No, strict ownership (builder:alice:* only editable by alice)
- B) Yes, with permission (alice can grant bob edit access)
- C) Role-based (senior_builders can edit any builder content)

**Current Recommendation**: Option C (role-based), simpler to implement.

### Q2: How to handle "promotion" of builder content to core?

When builder content is good enough to become official:

**Options**:
- A) Export to YAML, PR to repo, delete from DB
- B) Flag as "promoted", keep in DB but mark as core-equivalent
- C) Don't support - builder content stays builder content

**Current Recommendation**: Option A (export to YAML). Clean separation, follows existing workflow.

### Q3: Per-builder content limits?

Should we limit how much content each builder can create?

**Options**:
- A) No limits (trust builders)
- B) Soft limits with admin approval for more
- C) Hard limits by role (builder: 100 objects, senior: 500)

**Current Recommendation**: Start with A, add limits if abused.

### Q4: Content review workflow?

Should builder content require approval before going live?

**Options**:
- A) No review, instant publish (current design)
- B) Optional review flag per content type
- C) Required review for scripts, optional for others

**Current Recommendation**: Start with A, add review workflow later if needed.

---

## Appendix: Implementation Checklist

### Database Changes
- [ ] Add `typed_object_versions` table
- [ ] Add `world_builder_audit_log` table
- [ ] Add `disabled` and `disabled_*` fields to typed_objects metadata
- [ ] Add indexes for builder content queries

### Engine Changes
- [ ] `TypedObject.Namespace` module
- [ ] Update `TypedObject.Loader` for dual-source
- [ ] Update `TypedObject.Registry` for source tracking
- [ ] `TypedObject.Version` module
- [ ] `TypedObject.ReferenceValidator` module

### World Builder Changes
- [ ] Split UI into Core/Builder sections
- [ ] Clone-to-builder workflow
- [ ] Version history viewer
- [ ] Rollback UI
- [ ] Permission checks in all operations

### Operational
- [ ] Telemetry events
- [ ] Audit logging
- [ ] LiveOps disable/enable
- [ ] Backup/restore scripts
- [ ] Breaking change detection

### Documentation
- [ ] Builder user guide
- [ ] Admin operations guide
- [ ] API documentation

---

## References

- [Evennia Prototypes Documentation](https://www.evennia.com/docs/latest/Components/Prototypes.html)
- [Evennia for Diku Users](https://www.evennia.com/docs/3.x/Howtos/Evennia-for-Diku-Users.html)
- [Loka TypedObject System](./typed-object-system.md)
- [Loka World Builder Architecture](./world-builder.md)
