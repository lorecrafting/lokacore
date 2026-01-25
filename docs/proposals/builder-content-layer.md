# Templates + Instances Content Architecture - Proposal

> **Status**: Deferred (not yet implemented)
> **Issue**: `lokacore-12r`
> **Last Updated**: 2026-01-12
> **Inspired by**: [Evennia's Prototype System](https://www.evennia.com/docs/latest/Components/Prototypes.html), Unity Prefabs, Unreal Blueprints

## Executive Summary

This proposal describes a **Templates + Instances** architecture where:
- **Templates** (YAML, git-tracked) define the vocabulary of the world - what kinds of things CAN exist
- **Instances** (Database, live-editable) define the content of the world - what things DO exist

**This includes our own content.** The Monastery Arc hometown will be built using the same instance system that builders use, validating the workflow end-to-end.

**This is not implemented yet.** The current system uses YAML-only content storage.

---

## ⚠️ Implementation Timing: Why This Is Deferred

### The Core Insight

**During rapid framework development, YAML-only is actually superior to database-backed content.**

The problems this proposal solves (live content iteration, non-technical builder access) don't exist yet. Meanwhile, implementing it now would create new problems (content migrations during schema changes) that we don't need.

### Why YAML-Only is Better Right Now

| Scenario | YAML-Only | DB + Builder UI |
|----------|-----------|-----------------|
| Schema change | `grep -r "old_field" priv/world/` → fix all | Write DB migration, hope it covers edge cases |
| Bulk rename | `sed -i 's/old/new/g' **/*.yml` | Complex SQL update, risk of corruption |
| Claude bulk update | "Update all NPCs to use new stat format" → done | Need to export, modify, reimport |
| Review changes | `git diff` shows exactly what changed | DB diff is opaque |
| Revert mistake | `git checkout priv/world/` | Restore from backup, hope versions align |

### The Risk of Early Builder Content

```
Week 1: Combat system v1
        Builder creates NPCs with {health: 100, str: 10}

Week 3: Combat rework - stats now use pools
        {health: {current: 100, max: 100}, stats: {...}}
        → ALL builder NPCs broken

Week 5: Dialogue system adds conditions
        show_if: {quest_active: "..."} (new syntax)
        → ALL builder dialogues need updating

Week 8: Quest objectives restructured
        → ALL builder quests invalid
```

**Result:** Constant migration burden, frustrated builders, broken content.

### Prerequisites for Implementation

**ALL must be true before implementing this proposal:**

- [ ] Combat system stable (no major reworks planned)
- [ ] Quest/objective system stable
- [ ] Dialogue system stable
- [ ] NPC/entity schema stable
- [ ] Room/exit system stable
- [ ] Actual non-technical builders waiting to use it

**If ANY are false → Stay with YAML-only**

### Stability Signals

You'll know you're ready when:

1. **Schema changes become rare** - Weeks go by without touching TypedObject structure
2. **Content changes are the bottleneck** - "I wish I could tweak this dialogue without deploying"
3. **Non-devs are asking** - "Can I help build content?"
4. **Your YAML is tedious** - 500+ files, grep/sed feels fragile

### Current Recommendation

Keep the current architecture:

```
priv/world/
├── prototypes/     # Your content, YAML, git-tracked
├── quests/         # Your quests, YAML, git-tracked
├── dialogues/      # Your dialogues, YAML, git-tracked
└── ...

# Schema changes? Just update the files.
# Claude can do bulk migrations in seconds.
```

**Target timeline:** Revisit when framework stabilizes (estimated Q3 2026 or later).

---

## Table of Contents

1. [Implementation Timing: Why This Is Deferred](#%EF%B8%8F-implementation-timing-why-this-is-deferred)
2. [Problem Statement](#problem-statement)
3. [Architecture Overview](#architecture-overview)
4. [Templates Layer (YAML)](#templates-layer-yaml)
5. [Instances Layer (Database)](#instances-layer-database)
6. [Seeding System](#seeding-system)
7. [Export System](#export-system)
8. [Loader Architecture](#loader-architecture)
9. [Registry Changes](#registry-changes)
10. [Inheritance & Resolution](#inheritance--resolution)
11. [Version Tracking](#version-tracking)
12. [Permissions Model](#permissions-model)
13. [World Builder UI Changes](#world-builder-ui-changes)
14. [Validation Pipeline](#validation-pipeline)
15. [Live Operations](#live-operations)
16. [Edge Cases](#edge-cases)
17. [Test Specifications](#test-specifications)
18. [Migration from Current System](#migration-from-current-system)
19. [Implementation Phases](#implementation-phases)
20. [Task Breakdown](#task-breakdown)

---

## Problem Statement

### Current State

```
priv/world/*.yml → TypedObject.Loader → ETS Registry → Game
                   (everything in YAML)
```

**Problems:**
1. Content changes require deploy (even typo fixes)
2. We don't validate builder tools by using them ourselves
3. Two mental models: "our content" (YAML) vs "builder content" (future DB)
4. No live iteration - slow feedback loop

### Target State

```
┌─────────────────────────────────────────────────────────────┐
│                    TypedObject Registry                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INSTANCES (Database)                                        │
│  ├── monastery:novice_pema     (our content)                │
│  ├── monastery:courtyard       (our content)                │
│  ├── builder:alice:custom_npc  (builder content)            │
│  └── ...                                                    │
│           ↑ inherit from                                    │
│  TEMPLATES (YAML)                                           │
│  ├── base_npc                                               │
│  ├── base_monk                                              │
│  ├── base_room                                              │
│  └── ...                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
1. Instant content iteration (no deploys for content changes)
2. We eat our own dog food (hometown built with builder tools)
3. One mental model: templates vs instances
4. Live ops friendly

---

## Architecture Overview

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ WORLD BUILDER UI (/admin)                                   │
│ - Edit any instance content                                 │
│ - View templates (read-only)                                │
│ - Clone templates to create instances                       │
├─────────────────────────────────────────────────────────────┤
│ CONTENT MODULES (Content.Quest, Content.NPC, etc.)          │
│ - Unified API for all content                               │
│ - Resolves inheritance automatically                        │
├─────────────────────────────────────────────────────────────┤
│ TYPED OBJECT REGISTRY (ETS)                                 │
│ - All templates + all instances in memory                   │
│ - Fast lookups by key, type, tag                            │
│ - Tracks source and inheritance                             │
├─────────────────────────────────────────────────────────────┤
│ LOADER                                                      │
│ - Load templates from YAML (always)                         │
│ - Load instances from DB (always)                           │
│ - Seed instances from YAML if DB empty (first boot)         │
│ - Resolve inheritance chains                                │
├─────────────────────────────────────────────────────────────┤
│ STORAGE                                                     │
│ ┌───────────────────────┐  ┌───────────────────────┐       │
│ │ priv/world/templates/ │  │ typed_objects table   │       │
│ │ (YAML, git-tracked)   │  │ (SQLite, live)        │       │
│ │                       │  │                       │       │
│ │ - base_npc.yml        │  │ - monastery:*         │       │
│ │ - base_monk.yml       │  │ - tutorial:*          │       │
│ │ - base_room.yml       │  │ - builder:*           │       │
│ │ - base_quest.yml      │  │                       │       │
│ └───────────────────────┘  └───────────────────────┘       │
│                                                             │
│ ┌───────────────────────┐                                   │
│ │ priv/seeds/instances/ │  ← Seeding (first boot only)      │
│ │ (YAML, git-tracked)   │  ← Export target (nightly)        │
│ └───────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept | Definition | Storage | Mutability |
|---------|------------|---------|------------|
| **Template** | Definition of what something CAN be | YAML | Deploy-gated |
| **Instance** | A specific thing that EXISTS | Database | Live-editable |
| **Seed** | Initial instance data for fresh deploys | YAML | Export-updated |

### Examples

**Template** (`priv/world/templates/npcs/base_monk.yml`):
```yaml
key: base_monk
type: entity
subtype: npc
parent_key: base_npc
is_template: true
attributes:
  faction: monastery
  role: monk
components:
  combatant:
    health: { current: 30, max: 30 }
behaviors:
  - meditate
  - pray
tags:
  - monk
  - monastery
```

**Instance** (in database, seeded from `priv/seeds/instances/monastery/novice_pema.yml`):
```yaml
key: monastery:novice_pema
type: entity
subtype: npc
parent_key: base_monk
is_template: false
name: "Novice Pema"
description: "A young monk with worried eyes and prayer beads wrapped around her wrist."
attributes:
  level: 1
  role: quest_giver
data:
  dialogue_tree:
    start:
      text: "You've come! The mountain has answered our prayers..."
      # ... full dialogue
```

---

## Templates Layer (YAML)

### Purpose

Templates define the **vocabulary** of the game world:
- What types of NPCs can exist (monk, guard, merchant)
- What types of rooms can exist (indoor, outdoor, sacred)
- What types of quests can exist (main, side, daily)
- What components and behaviors are available

### Directory Structure

```
priv/world/templates/
├── _base/
│   ├── base_entity.yml       # Root of all entities
│   ├── base_npc.yml          # All NPCs inherit from this
│   ├── base_room.yml         # All rooms inherit from this
│   ├── base_item.yml         # All items inherit from this
│   ├── base_quest.yml        # All quests inherit from this
│   └── base_dialogue.yml     # All dialogues inherit from this
├── npcs/
│   ├── base_monk.yml         # Monastery faction NPCs
│   ├── base_guard.yml        # Guard NPCs
│   ├── base_merchant.yml     # Merchant NPCs
│   └── base_villager.yml     # Generic villagers
├── rooms/
│   ├── base_indoor.yml       # Indoor rooms
│   ├── base_outdoor.yml      # Outdoor rooms
│   └── base_sacred.yml       # Sacred spaces (temples, shrines)
├── items/
│   ├── base_weapon.yml
│   ├── base_armor.yml
│   ├── base_consumable.yml
│   └── base_herb.yml
└── quests/
    ├── base_main_quest.yml
    ├── base_side_quest.yml
    └── base_daily_quest.yml
```

### Template Schema

```elixir
%TypedObject{
  # Identity
  key: "base_monk",           # Unique identifier
  type: :entity,              # :entity, :quest, :dialogue, :script, :zone
  subtype: :npc,              # :npc, :room, :item, :exit (for entities)
  parent_key: "base_npc",     # Inheritance chain
  is_template: true,          # MUST be true for templates

  # Display (defaults for instances)
  name: nil,                  # Instances provide specific names
  description: nil,           # Instances provide specific descriptions
  keywords: ["monk"],         # Merged with instance keywords

  # Data (inherited by instances)
  attributes: %{
    faction: "monastery",
    role: "monk"
  },
  components: %{
    combatant: %{health: %{current: 30, max: 30}}
  },
  behaviors: ["meditate", "pray"],
  tags: ["monk", "monastery"],

  # Metadata
  metadata: %{
    source: :yaml,
    loaded_at: ~U[2026-01-12 10:00:00Z]
  }
}
```

### Template Rules

1. **Templates MUST have `is_template: true`**
2. **Templates CANNOT be spawned directly** (only instances can)
3. **Templates are loaded from YAML only** (never from DB)
4. **Templates are immutable at runtime** (deploy to change)
5. **Templates MAY inherit from other templates** (inheritance chains)
6. **Templates provide defaults** that instances can override

---

## Instances Layer (Database)

### Purpose

Instances are the **actual content** of the game world:
- Specific NPCs (Novice Pema, Elder Thubten)
- Specific rooms (The Courtyard, Meditation Hall)
- Specific quests (A Stranger Arrives, Find the Temple)
- Specific dialogues attached to specific NPCs

### Namespacing Strategy

```
[area]:[identifier]
```

| Namespace | Owner | Examples |
|-----------|-------|----------|
| `monastery:*` | Core team | `monastery:novice_pema`, `monastery:courtyard` |
| `tutorial:*` | Core team | `tutorial:intro_room`, `tutorial:guide_npc` |
| `builder:[username]:*` | Individual builder | `builder:alice:custom_guard` |
| `guild:[name]:*` | Builder guild | `guild:crafters:workshop` |

### Instance Schema

```elixir
%TypedObject{
  # Identity
  key: "monastery:novice_pema",
  type: :entity,
  subtype: :npc,
  parent_key: "base_monk",      # Inherits from template
  is_template: false,           # MUST be false for instances

  # Display (specific to this instance)
  name: "Novice Pema",
  description: "A young monk with worried eyes...",
  keywords: ["pema", "novice", "young"],

  # Data (overrides/extends template)
  attributes: %{
    level: 1,
    role: "quest_giver"         # Overrides template's "monk"
  },
  data: %{
    dialogue_tree: %{...}       # Instance-specific data
  },

  # Location (for entities)
  location_id: "monastery:courtyard",

  # Metadata
  metadata: %{
    source: :database,
    created_at: ~U[2026-01-12 10:00:00Z],
    created_by: "system",       # or "builder:alice"
    updated_at: ~U[2026-01-12 14:30:00Z],
    updated_by: "admin",
    version: 3
  }
}
```

### Instance Rules

1. **Instances MUST have `is_template: false`**
2. **Instances MUST have a parent_key** (pointing to a template)
3. **Instances are stored in database only**
4. **Instances are live-editable** (via World Builder UI)
5. **Instances inherit from templates** (deep merge)
6. **Instances can inherit from other instances** (max depth: 5)

---

## Seeding System

### Overview

Seeding populates the database with initial instance content on first boot or fresh deploy.

```
┌─────────────────────────────────────────────────────────────┐
│ SEEDING FLOW                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Application starts                                       │
│ 2. Check: Is typed_objects table empty?                     │
│    ├── YES: Run seeding                                     │
│    │   ├── Load priv/seeds/instances/**/*.yml               │
│    │   ├── Validate each object                             │
│    │   ├── Insert into database                             │
│    │   └── Mark seeding complete                            │
│    └── NO: Skip seeding (DB has content)                    │
│ 3. Load all templates from YAML                             │
│ 4. Load all instances from DB                               │
│ 5. Resolve inheritance                                      │
│ 6. Populate registry                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Seed Directory Structure

```
priv/seeds/
├── instances/
│   ├── monastery/              # Our hometown
│   │   ├── npcs/
│   │   │   ├── novice_pema.yml
│   │   │   ├── elder_thubten.yml
│   │   │   └── ...
│   │   ├── rooms/
│   │   │   ├── courtyard.yml
│   │   │   ├── meditation_hall.yml
│   │   │   └── ...
│   │   ├── quests/
│   │   │   ├── intro_welcome.yml
│   │   │   ├── find_temple.yml
│   │   │   └── ...
│   │   └── dialogues/
│   │       └── ...
│   └── tutorial/               # Tutorial area
│       └── ...
└── _seeding_manifest.yml       # Tracks seeding state
```

### Seeding Implementation

```elixir
defmodule TypedObject.Seeder do
  @moduledoc """
  Seeds instance content from YAML files on first boot.
  """

  @seed_path "priv/seeds/instances"

  def seed_if_empty do
    if database_empty?() do
      Logger.info("Database empty, running seeding...")
      seed_all()
    else
      Logger.info("Database has content, skipping seeding")
      :ok
    end
  end

  def database_empty? do
    import Ecto.Query
    Repo.aggregate(TypedObject.Schema, :count, :id) == 0
  end

  def seed_all do
    Repo.transaction(fn ->
      @seed_path
      |> load_seed_files()
      |> validate_all()
      |> insert_all()
      |> tap(fn count -> Logger.info("Seeded #{count} instances") end)
    end)
  end

  defp load_seed_files(path) do
    path
    |> Path.join("**/*.yml")
    |> Path.wildcard()
    |> Enum.map(&load_yaml_file/1)
    |> Enum.reject(&is_nil/1)
  end

  defp load_yaml_file(path) do
    case YamlElixir.read_from_file(path) do
      {:ok, data} ->
        data
        |> Map.put("_source_file", path)
        |> infer_key_from_path(path)

      {:error, reason} ->
        Logger.error("Failed to load seed file #{path}: #{inspect(reason)}")
        nil
    end
  end

  defp infer_key_from_path(data, path) do
    # priv/seeds/instances/monastery/npcs/novice_pema.yml
    # → monastery:novice_pema
    parts = Path.split(path)
    area_index = Enum.find_index(parts, &(&1 == "instances")) + 1
    area = Enum.at(parts, area_index)
    filename = Path.basename(path, ".yml")

    key = data["key"] || "#{area}:#{filename}"
    Map.put(data, "key", key)
  end

  defp validate_all(objects) do
    Enum.map(objects, fn obj ->
      case TypedObject.Validator.validate_seed(obj) do
        :ok -> obj
        {:error, errors} ->
          Logger.error("Seed validation failed for #{obj["key"]}: #{inspect(errors)}")
          raise "Seeding aborted due to validation errors"
      end
    end)
  end

  defp insert_all(objects) do
    # Topological sort to handle dependencies
    sorted = topological_sort_by_parent(objects)

    Enum.each(sorted, fn obj ->
      %TypedObject.Schema{}
      |> TypedObject.Schema.seed_changeset(obj)
      |> Repo.insert!()
    end)

    length(sorted)
  end
end
```

### Seeding Edge Cases

| Edge Case | Behavior |
|-----------|----------|
| Seed file has invalid YAML | Log error, abort seeding, fail startup |
| Seed references non-existent template | Log error, abort seeding, fail startup |
| Seed has circular parent reference | Detected by topological sort, abort |
| Duplicate keys in seeds | Last file wins (alphabetical order) |
| Partial seeding (crash mid-seed) | Transaction rollback, retry on next start |

### Force Re-seed

```elixir
# Mix task for development/testing
defmodule Mix.Tasks.Loka.Reseed do
  use Mix.Task

  def run(_args) do
    Mix.Task.run("app.start")

    Logger.warn("Clearing all instance content and re-seeding...")

    Repo.transaction(fn ->
      # Delete all instances (not templates)
      Repo.delete_all(from t in TypedObject.Schema, where: t.is_template == false)

      # Re-seed
      TypedObject.Seeder.seed_all()
    end)

    Logger.info("Re-seeding complete")
  end
end
```

---

## Export System

### Overview

The export system creates YAML snapshots of database content for:
1. **Backup** - Disaster recovery
2. **Version control** - Git history of content changes
3. **Code review** - PR reviews for content changes
4. **Fresh environment setup** - Seeds for new deploys

### Export Flow

```
┌─────────────────────────────────────────────────────────────┐
│ NIGHTLY EXPORT JOB (via Oban)                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Query all instances from database                        │
│ 2. Group by namespace (monastery, tutorial, builder)        │
│ 3. For each namespace:                                      │
│    ├── Convert to YAML format                               │
│    ├── Write to priv/seeds/instances/{namespace}/           │
│    └── Preserve directory structure                         │
│ 4. Update _export_manifest.yml with timestamp               │
│ 5. If changes detected:                                     │
│    ├── git add priv/seeds/                                  │
│    ├── git commit -m "chore: nightly content export"        │
│    └── git push (optional, configurable)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Export Implementation

```elixir
defmodule TypedObject.Exporter do
  @moduledoc """
  Exports database instances to YAML for backup and version control.
  """

  @export_path "priv/seeds/instances"

  def export_all do
    instances = load_all_instances()

    instances
    |> group_by_namespace()
    |> Enum.each(&export_namespace/1)

    write_manifest(instances)

    {:ok, length(instances)}
  end

  defp load_all_instances do
    import Ecto.Query

    TypedObject.Schema
    |> where([t], t.is_template == false)
    |> Repo.all()
    |> Enum.map(&TypedObject.Schema.to_export_format/1)
  end

  defp group_by_namespace(instances) do
    Enum.group_by(instances, fn inst ->
      inst.key
      |> String.split(":")
      |> List.first()
    end)
  end

  defp export_namespace({namespace, instances}) do
    # Group by subtype for directory structure
    by_subtype = Enum.group_by(instances, & &1.subtype)

    Enum.each(by_subtype, fn {subtype, items} ->
      subtype_dir = subtype_to_dir(subtype)
      dir = Path.join([@export_path, namespace, subtype_dir])
      File.mkdir_p!(dir)

      Enum.each(items, fn item ->
        filename = key_to_filename(item.key)
        path = Path.join(dir, "#{filename}.yml")

        yaml = to_yaml(item)
        File.write!(path, yaml)
      end)
    end)
  end

  defp to_yaml(instance) do
    instance
    |> Map.from_struct()
    |> Map.drop([:id, :inserted_at, :updated_at])  # DB-only fields
    |> Ymlr.document!()
  end

  defp write_manifest(instances) do
    manifest = %{
      exported_at: DateTime.utc_now(),
      instance_count: length(instances),
      namespaces: instances |> Enum.map(& &1.key) |> Enum.map(&namespace_of/1) |> Enum.uniq()
    }

    path = Path.join(@export_path, "_export_manifest.yml")
    File.write!(path, Ymlr.document!(manifest))
  end
end
```

### Export Oban Worker

```elixir
defmodule Loka.Workers.ContentExportWorker do
  use Oban.Worker, queue: :maintenance, max_attempts: 3

  @impl Oban.Worker
  def perform(_job) do
    case TypedObject.Exporter.export_all() do
      {:ok, count} ->
        Logger.info("Exported #{count} instances")
        maybe_git_commit()
        :ok

      {:error, reason} ->
        Logger.error("Export failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp maybe_git_commit do
    if Application.get_env(:loka, :auto_commit_exports, false) do
      System.cmd("git", ["add", "priv/seeds/"])

      case System.cmd("git", ["diff", "--cached", "--quiet"]) do
        {_, 0} ->
          Logger.info("No content changes to commit")

        {_, 1} ->
          timestamp = DateTime.utc_now() |> DateTime.to_iso8601()
          System.cmd("git", ["commit", "-m", "chore: content export #{timestamp}"])
          Logger.info("Committed content changes")
      end
    end
  end
end

# Schedule nightly at 3am UTC
defmodule Loka.Workers.Scheduler do
  def schedule_exports do
    Oban.insert(
      Loka.Workers.ContentExportWorker.new(%{}, schedule_in: next_3am_utc())
    )
  end
end
```

### Manual Export

```elixir
# Mix task for manual exports
defmodule Mix.Tasks.Loka.Export do
  use Mix.Task

  def run(args) do
    {opts, _, _} = OptionParser.parse(args, switches: [namespace: :string])

    Mix.Task.run("app.start")

    case opts[:namespace] do
      nil ->
        TypedObject.Exporter.export_all()

      namespace ->
        TypedObject.Exporter.export_namespace(namespace)
    end

    IO.puts("Export complete. Check priv/seeds/instances/")
  end
end
```

---

## Loader Architecture

### Overview

The loader is responsible for:
1. Loading templates from YAML (always)
2. Loading instances from database (always)
3. Seeding database if empty (first boot)
4. Resolving inheritance chains
5. Populating the registry

### Loader Flow

```
┌─────────────────────────────────────────────────────────────┐
│ LOADER STARTUP SEQUENCE                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Initialize ETS registry tables                           │
│                                                             │
│ 2. Load templates from YAML                                 │
│    priv/world/templates/**/*.yml → templates map            │
│                                                             │
│ 3. Seed database if empty                                   │
│    priv/seeds/instances/**/*.yml → typed_objects table      │
│                                                             │
│ 4. Load instances from database                             │
│    typed_objects table → instances map                      │
│                                                             │
│ 5. Merge templates + instances                              │
│    all_objects = Map.merge(templates, instances)            │
│                                                             │
│ 6. Validate all objects                                     │
│    Check parent references, detect cycles                   │
│                                                             │
│ 7. Resolve inheritance                                      │
│    Topological sort → merge each child with parent          │
│                                                             │
│ 8. Populate registry                                        │
│    Resolved objects → ETS tables                            │
│                                                             │
│ 9. Ready to serve requests                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Loader Implementation

```elixir
defmodule TypedObject.Loader do
  use GenServer
  require Logger

  @templates_path "priv/world/templates"

  # Client API

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def reload do
    GenServer.call(__MODULE__, :reload, :infinity)
  end

  def get(key) do
    TypedObject.Registry.get(key)
  end

  # Server Callbacks

  @impl true
  def init(_opts) do
    # Initialize registry
    TypedObject.Registry.init()

    # Load everything
    case load_all() do
      {:ok, stats} ->
        Logger.info("Loaded #{stats.templates} templates, #{stats.instances} instances")
        {:ok, %{loaded_at: DateTime.utc_now(), stats: stats}}

      {:error, reason} ->
        {:stop, reason}
    end
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case load_all() do
      {:ok, stats} ->
        {:reply, {:ok, stats}, %{state | loaded_at: DateTime.utc_now(), stats: stats}}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  # Private Functions

  defp load_all do
    with {:ok, templates} <- load_templates(),
         :ok <- seed_if_empty(),
         {:ok, instances} <- load_instances(),
         {:ok, all_objects} <- merge_and_validate(templates, instances),
         {:ok, resolved} <- resolve_inheritance(all_objects) do

      TypedObject.Registry.put_all(resolved)

      {:ok, %{
        templates: map_size(templates),
        instances: map_size(instances),
        total: map_size(resolved)
      }}
    end
  end

  defp load_templates do
    objects =
      @templates_path
      |> Path.join("**/*.yml")
      |> Path.wildcard()
      |> Enum.map(&load_template_file/1)
      |> Enum.reject(&is_nil/1)
      |> Map.new(fn obj -> {obj.key, obj} end)

    {:ok, objects}
  rescue
    e -> {:error, {:template_load_failed, e}}
  end

  defp load_template_file(path) do
    with {:ok, data} <- YamlElixir.read_from_file(path),
         {:ok, obj} <- build_template(data, path) do
      obj
    else
      {:error, reason} ->
        Logger.error("Failed to load template #{path}: #{inspect(reason)}")
        nil
    end
  end

  defp build_template(data, path) do
    obj = %TypedObject{
      key: data["key"] || infer_key_from_path(path),
      type: String.to_existing_atom(data["type"] || infer_type_from_path(path)),
      subtype: maybe_atom(data["subtype"]),
      parent_key: data["parent_key"],
      is_template: true,
      name: data["name"],
      description: data["description"],
      keywords: data["keywords"] || [],
      attributes: data["attributes"] || %{},
      components: data["components"] || %{},
      behaviors: data["behaviors"] || [],
      tags: data["tags"] || [],
      data: data["data"] || %{},
      metadata: %{source: :yaml, loaded_from: path}
    }

    {:ok, obj}
  end

  defp seed_if_empty do
    TypedObject.Seeder.seed_if_empty()
  end

  defp load_instances do
    import Ecto.Query

    instances =
      TypedObject.Schema
      |> where([t], t.is_template == false)
      |> where([t], is_nil(fragment("metadata->>'disabled'")) or fragment("metadata->>'disabled'") != "true")
      |> Repo.all()
      |> Enum.map(&TypedObject.Schema.to_typed_object/1)
      |> Map.new(fn obj -> {obj.key, obj} end)

    {:ok, instances}
  rescue
    e -> {:error, {:instance_load_failed, e}}
  end

  defp merge_and_validate(templates, instances) do
    all_objects = Map.merge(templates, instances)

    # Check for key conflicts
    conflicts = MapSet.intersection(
      MapSet.new(Map.keys(templates)),
      MapSet.new(Map.keys(instances))
    )

    if MapSet.size(conflicts) > 0 do
      {:error, {:key_conflicts, MapSet.to_list(conflicts)}}
    else
      {:ok, all_objects}
    end
  end

  defp resolve_inheritance(all_objects) do
    with {:ok, sorted} <- topological_sort(all_objects),
         resolved <- resolve_sorted(sorted, all_objects) do
      {:ok, resolved}
    end
  end

  defp topological_sort(objects) do
    graph = :digraph.new()

    try do
      # Add vertices
      Enum.each(objects, fn {key, _} ->
        :digraph.add_vertex(graph, key)
      end)

      # Add edges (parent → child)
      Enum.each(objects, fn {key, obj} ->
        if obj.parent_key do
          :digraph.add_edge(graph, obj.parent_key, key)
        end
      end)

      # Check for cycles
      case :digraph_utils.topsort(graph) do
        false ->
          cycle = :digraph.get_cycle(graph)
          {:error, {:circular_inheritance, cycle}}

        sorted ->
          {:ok, sorted}
      end
    after
      :digraph.delete(graph)
    end
  end

  defp resolve_sorted(sorted_keys, all_objects) do
    Enum.reduce(sorted_keys, %{}, fn key, resolved ->
      obj = Map.get(all_objects, key)

      resolved_obj =
        if obj.parent_key do
          parent = Map.get(resolved, obj.parent_key)
          if parent do
            TypedObject.merge_parent(obj, parent)
          else
            Logger.warning("Broken parent reference: #{key} -> #{obj.parent_key}")
            %{obj | metadata: Map.put(obj.metadata, :broken_parent, obj.parent_key)}
          end
        else
          obj
        end

      Map.put(resolved, key, resolved_obj)
    end)
  end
end
```

---

## Registry Changes

### Current Registry

The current registry uses three ETS tables:
- `:typed_objects` - Primary key→object storage
- `:typed_objects_by_type` - Index by {type, subtype}
- `:typed_objects_by_tag` - Index by tag

### New Registry Additions

Add tracking for:
- Source (`:yaml` vs `:database`)
- Template vs instance
- Namespace

```elixir
defmodule TypedObject.Registry do
  @tables [
    :typed_objects,           # key → object
    :typed_objects_by_type,   # {type, subtype} → [keys]
    :typed_objects_by_tag,    # tag → [keys]
    :typed_objects_by_source, # :yaml | :database → [keys]  # NEW
    :typed_objects_by_namespace  # namespace → [keys]       # NEW
  ]

  def put(key, object) do
    :ets.insert(:typed_objects, {key, object})
    update_type_index(key, object)
    update_tag_index(key, object)
    update_source_index(key, object)      # NEW
    update_namespace_index(key, object)   # NEW
    :ok
  end

  # New query functions

  def list_templates do
    list_by_source(:yaml)
  end

  def list_instances do
    list_by_source(:database)
  end

  def list_by_source(source) do
    case :ets.lookup(:typed_objects_by_source, source) do
      [{^source, keys}] -> Enum.map(keys, &get/1) |> Enum.reject(&is_nil/1)
      [] -> []
    end
  end

  def list_by_namespace(namespace) do
    case :ets.lookup(:typed_objects_by_namespace, namespace) do
      [{^namespace, keys}] -> Enum.map(keys, &get/1) |> Enum.reject(&is_nil/1)
      [] -> []
    end
  end

  defp update_source_index(key, object) do
    source = object.metadata[:source] || :yaml
    update_set_index(:typed_objects_by_source, source, key)
  end

  defp update_namespace_index(key, object) do
    namespace = extract_namespace(key)
    update_set_index(:typed_objects_by_namespace, namespace, key)
  end

  defp extract_namespace(key) do
    case String.split(key, ":", parts: 2) do
      [namespace, _] -> namespace
      [key] -> "default"
    end
  end
end
```

---

## Inheritance & Resolution

### Merge Strategy

```elixir
defmodule TypedObject do
  @doc """
  Merge a child object with its resolved parent.

  Strategy:
  - Scalar fields: child wins if present, else parent
  - Maps: deep merge (child wins on conflict)
  - Lists: concatenate and dedupe
  """
  def merge_parent(child, parent) do
    %TypedObject{
      # Identity (always child)
      key: child.key,
      type: child.type || parent.type,
      subtype: child.subtype || parent.subtype,
      is_template: child.is_template,
      parent_key: child.parent_key,

      # Display (child overrides)
      name: child.name || parent.name,
      description: child.description || parent.description,
      extra_description: child.extra_description || parent.extra_description,
      keywords: merge_lists(parent.keywords, child.keywords),

      # Data (deep merge, child wins)
      attributes: deep_merge(parent.attributes, child.attributes),
      components: deep_merge(parent.components, child.components),
      data: deep_merge(parent.data, child.data),
      scripts: deep_merge(parent.scripts, child.scripts),

      # Collections (concatenate, dedupe)
      behaviors: merge_lists(parent.behaviors, child.behaviors),
      tags: merge_lists(parent.tags, child.tags),

      # Access control (child overrides)
      locks: Map.merge(parent.locks || %{}, child.locks || %{}),

      # Location (always child - instances have locations)
      location_id: child.location_id,
      contents: child.contents,

      # Metadata (child's metadata, with inheritance info)
      metadata: Map.merge(child.metadata, %{
        inherited_from: parent.key,
        inheritance_depth: (parent.metadata[:inheritance_depth] || 0) + 1
      })
    }
  end

  defp deep_merge(nil, child), do: child
  defp deep_merge(parent, nil), do: parent
  defp deep_merge(parent, child) when is_map(parent) and is_map(child) do
    Map.merge(parent, child, fn _k, p, c ->
      if is_map(p) and is_map(c) do
        deep_merge(p, c)
      else
        c  # Child wins for non-maps
      end
    end)
  end
  defp deep_merge(_parent, child), do: child

  defp merge_lists(nil, child), do: child || []
  defp merge_lists(parent, nil), do: parent || []
  defp merge_lists(parent, child) do
    (parent ++ child) |> Enum.uniq()
  end
end
```

### Inheritance Depth Limit

```elixir
@max_inheritance_depth 10

defp validate_inheritance_depth(object, all_objects) do
  depth = calculate_depth(object.key, all_objects, 0)

  cond do
    depth > @max_inheritance_depth ->
      {:error, {:inheritance_too_deep, object.key, depth}}

    depth > 5 ->
      Logger.warning("Deep inheritance chain: #{object.key} (depth: #{depth})")
      :ok

    true ->
      :ok
  end
end

defp calculate_depth(key, all_objects, current_depth) do
  case Map.get(all_objects, key) do
    nil -> current_depth
    %{parent_key: nil} -> current_depth
    %{parent_key: parent_key} -> calculate_depth(parent_key, all_objects, current_depth + 1)
  end
end
```

---

## Version Tracking

### Philosophy

**Not git-style versioning.** Traditional MUDs didn't version content - they kept backups and trusted builders.

We provide:
- **Audit trail**: Who changed what, when
- **Rollback**: Undo recent changes to individual objects
- **NOT**: Branching, merging, or full history forever

### Schema

```elixir
defmodule TypedObject.Version do
  use Ecto.Schema

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "typed_object_versions" do
    field :object_key, :string         # The key of the object
    field :object_id, :binary_id       # FK to typed_objects
    field :version, :integer           # Sequential version number
    field :snapshot, :map              # Full object state at this version
    field :changes, :map               # Diff from previous version
    field :changed_by, :string         # User who made the change
    field :change_type, :string        # "create", "update", "delete", "rollback"
    field :change_reason, :string      # Optional note

    timestamps(type: :utc_datetime)
  end
end
```

### Version Operations

```elixir
defmodule TypedObject.Versioning do
  @max_versions_per_object 100
  @version_retention_days 90

  @doc """
  Create a new version when an object is modified.
  """
  def record_change(object, change_type, changed_by, reason \\ nil) do
    current_version = get_current_version(object.key)
    new_version = (current_version || 0) + 1

    %TypedObject.Version{}
    |> TypedObject.Version.changeset(%{
      object_key: object.key,
      object_id: object.id,
      version: new_version,
      snapshot: snapshot(object),
      changes: calculate_changes(object, current_version),
      changed_by: changed_by,
      change_type: change_type,
      change_reason: reason
    })
    |> Repo.insert!()

    # Cleanup old versions
    cleanup_old_versions(object.key)

    new_version
  end

  @doc """
  Rollback an object to a previous version.
  """
  def rollback(object_key, target_version, user_id) do
    with {:ok, version_record} <- get_version(object_key, target_version),
         {:ok, current} <- TypedObject.get(object_key),
         :ok <- validate_can_rollback(current, version_record, user_id) do

      Repo.transaction(fn ->
        # Update object to previous state
        current
        |> TypedObject.Schema.changeset(version_record.snapshot)
        |> Repo.update!()

        # Record the rollback as a new version
        record_change(
          Map.merge(current, version_record.snapshot),
          "rollback",
          user_id,
          "Rolled back to version #{target_version}"
        )
      end)
    end
  end

  @doc """
  List recent versions for an object.
  """
  def list_versions(object_key, limit \\ 50) do
    import Ecto.Query

    TypedObject.Version
    |> where([v], v.object_key == ^object_key)
    |> order_by([v], desc: v.version)
    |> limit(^limit)
    |> Repo.all()
  end

  @doc """
  Cleanup old versions per retention policy.
  """
  def cleanup_old_versions(object_key) do
    import Ecto.Query

    cutoff = DateTime.add(DateTime.utc_now(), -@version_retention_days, :day)

    # Get versions to potentially delete
    versions =
      TypedObject.Version
      |> where([v], v.object_key == ^object_key)
      |> order_by([v], desc: v.version)
      |> Repo.all()

    # Keep: last N versions OR versions within retention period
    {keep, delete} =
      versions
      |> Enum.with_index()
      |> Enum.split_with(fn {v, idx} ->
        idx < @max_versions_per_object or DateTime.compare(v.inserted_at, cutoff) == :gt
      end)

    # Delete old versions
    delete_ids = Enum.map(delete, fn {v, _} -> v.id end)

    if length(delete_ids) > 0 do
      TypedObject.Version
      |> where([v], v.id in ^delete_ids)
      |> Repo.delete_all()
    end
  end
end
```

---

## Permissions Model

### Roles

| Role | Can View | Can Edit | Can Delete | Notes |
|------|----------|----------|------------|-------|
| `viewer` | All | None | None | Read-only access |
| `builder` | All | Own namespace only | Own content only | `builder:{username}:*` |
| `senior_builder` | All | All instances | With approval | Can help other builders |
| `admin` | All | All (templates + instances) | All instances | Full access |
| `system` | All | All | All | Automated processes |

### Implementation

```elixir
defmodule TypedObject.Permissions do
  @doc """
  Check if a user can perform an action on an object.
  """
  def can?(user, action, object) do
    case action do
      :view -> can_view?(user, object)
      :edit -> can_edit?(user, object)
      :delete -> can_delete?(user, object)
      :clone -> can_clone?(user, object)
    end
  end

  defp can_view?(_user, _object), do: true  # Everyone can view

  defp can_edit?(user, object) do
    cond do
      # Templates are never editable at runtime
      object.is_template ->
        false

      # System can edit anything
      user.role == :system ->
        true

      # Admins can edit any instance
      user.role == :admin ->
        true

      # Senior builders can edit any instance
      user.role == :senior_builder ->
        true

      # Builders can edit their own namespace
      user.role == :builder ->
        owns_namespace?(user, object.key)

      # Viewers cannot edit
      true ->
        false
    end
  end

  defp can_delete?(user, object) do
    cond do
      # Templates cannot be deleted at runtime
      object.is_template ->
        false

      # Core namespaces require admin
      core_namespace?(object.key) ->
        user.role == :admin

      # Builder content
      true ->
        can_edit?(user, object)
    end
  end

  defp can_clone?(_user, _object), do: true  # Anyone can clone

  defp owns_namespace?(user, key) do
    expected_prefix = "builder:#{user.username}:"
    String.starts_with?(key, expected_prefix)
  end

  defp core_namespace?(key) do
    namespace = extract_namespace(key)
    namespace in ["monastery", "tutorial", "system"]
  end

  defp extract_namespace(key) do
    case String.split(key, ":", parts: 2) do
      [namespace, _] -> namespace
      [_] -> "default"
    end
  end
end
```

---

## World Builder UI Changes

### Overview

The UI needs to clearly distinguish templates from instances.

```
┌─────────────────────────────────────────────────────────────┐
│ WORLD BUILDER - NPCs                                        │
├─────────────────────────────────────────────────────────────┤
│ [Templates ▼] [Instances ▼] [+ New Instance]                │
├─────────────────────────────────────────────────────────────┤
│ TEMPLATES (read-only)                     Showing 5 of 12   │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 📋 base_monk                                    [Clone] ││
│ │    A monk template with meditation behaviors            ││
│ │ 📋 base_guard                                   [Clone] ││
│ │    A guard template with patrol behaviors               ││
│ │ 📋 base_merchant                                [Clone] ││
│ │    A merchant template with trading capabilities        ││
│ └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ INSTANCES                                 Showing 24 of 156 │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 🧑 monastery:novice_pema          [Edit] [History] [⋮] ││
│ │    Inherits: base_monk | Version: 12 | By: admin        ││
│ │ 🧑 monastery:elder_thubten        [Edit] [History] [⋮] ││
│ │    Inherits: base_monk | Version: 5 | By: system        ││
│ │ 🧑 builder:alice:custom_guard     [Edit] [History] [⋮] ││
│ │    Inherits: base_guard | Version: 3 | By: alice        ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Clone Workflow

```elixir
defmodule WorldBuilder.CloneController do
  @doc """
  Clone a template or instance to create a new instance.
  """
  def clone(source_key, new_key, user) do
    with {:ok, source} <- TypedObject.get(source_key),
         :ok <- TypedObject.Permissions.can?(user, :clone, source),
         :ok <- validate_new_key(new_key, user),
         {:ok, cloned} <- create_clone(source, new_key, user) do

      # Reload into registry
      TypedObject.Registry.put(cloned.key, cloned)

      {:ok, cloned}
    end
  end

  defp validate_new_key(key, user) do
    cond do
      # Key must match user's namespace (unless admin)
      user.role != :admin and not owns_namespace?(user, key) ->
        {:error, "Key must start with builder:#{user.username}:"}

      # Key must not already exist
      TypedObject.Registry.get(key) != nil ->
        {:error, "Key #{key} already exists"}

      # Key format validation
      not valid_key_format?(key) ->
        {:error, "Invalid key format. Use lowercase, numbers, underscores, colons only."}

      true ->
        :ok
    end
  end

  defp create_clone(source, new_key, user) do
    clone_data = %{
      key: new_key,
      type: source.type,
      subtype: source.subtype,
      parent_key: if(source.is_template, do: source.key, else: source.parent_key),
      is_template: false,
      name: source.name,
      description: source.description,
      keywords: source.keywords,
      attributes: source.attributes,
      components: source.components,
      behaviors: source.behaviors,
      tags: source.tags,
      data: source.data,
      metadata: %{
        source: :database,
        created_at: DateTime.utc_now(),
        created_by: user.id,
        cloned_from: source.key
      }
    }

    %TypedObject.Schema{}
    |> TypedObject.Schema.changeset(clone_data)
    |> Repo.insert()
    |> case do
      {:ok, schema} -> {:ok, TypedObject.Schema.to_typed_object(schema)}
      error -> error
    end
  end
end
```

### Version History UI

```
┌─────────────────────────────────────────────────────────────┐
│ VERSION HISTORY - monastery:novice_pema                     │
├─────────────────────────────────────────────────────────────┤
│ Current version: 12                                         │
├─────────────────────────────────────────────────────────────┤
│ v12 │ 2026-01-12 14:30 │ admin    │ Updated dialogue        │
│     │ Changed: data.dialogue_tree.start.text                │
│     │                                         [Rollback ↩] │
├─────────────────────────────────────────────────────────────┤
│ v11 │ 2026-01-12 10:15 │ admin    │ Fixed typo              │
│     │ Changed: description                                  │
│     │                                         [Rollback ↩] │
├─────────────────────────────────────────────────────────────┤
│ v10 │ 2026-01-11 16:00 │ system   │ Seeded from YAML        │
│     │ Initial version                                       │
│     │                                         [Rollback ↩] │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Pipeline

### Pre-Save Validation

```elixir
defmodule TypedObject.Validator do
  @doc """
  Validate an object before saving to database.
  Returns {:ok, object} or {:error, errors}.
  """
  def validate(object) do
    []
    |> validate_required_fields(object)
    |> validate_key_format(object)
    |> validate_namespace_permissions(object)
    |> validate_parent_exists(object)
    |> validate_parent_is_template(object)
    |> validate_no_circular_inheritance(object)
    |> validate_inheritance_depth(object)
    |> validate_references(object)
    |> validate_type_specific(object)
    |> case do
      [] -> {:ok, object}
      errors -> {:error, errors}
    end
  end

  defp validate_required_fields(errors, object) do
    required = [:key, :type]

    missing = Enum.filter(required, fn field ->
      is_nil(Map.get(object, field))
    end)

    if length(missing) > 0 do
      [{:missing_required_fields, missing} | errors]
    else
      errors
    end
  end

  defp validate_key_format(errors, object) do
    # Keys must be: lowercase letters, numbers, underscores, colons
    # Examples: base_npc, monastery:novice_pema, builder:alice:guard
    if Regex.match?(~r/^[a-z0-9_:]+$/, object.key) do
      errors
    else
      [{:invalid_key_format, object.key, "must be lowercase alphanumeric with underscores and colons"} | errors]
    end
  end

  defp validate_parent_exists(errors, %{parent_key: nil}), do: errors
  defp validate_parent_exists(errors, object) do
    case TypedObject.Registry.get(object.parent_key) do
      nil -> [{:parent_not_found, object.parent_key} | errors]
      _ -> errors
    end
  end

  defp validate_parent_is_template(errors, %{parent_key: nil}), do: errors
  defp validate_parent_is_template(errors, %{is_template: true}), do: errors  # Templates can inherit from templates
  defp validate_parent_is_template(errors, object) do
    case TypedObject.Registry.get(object.parent_key) do
      nil -> errors  # Already caught by validate_parent_exists
      parent ->
        # Instances must inherit from templates (or other instances, up to depth limit)
        if parent.is_template or not parent.is_template do
          errors  # Both are valid
        else
          errors
        end
    end
  end

  defp validate_no_circular_inheritance(errors, object) do
    visited = MapSet.new([object.key])

    case check_cycle(object.parent_key, visited) do
      :ok -> errors
      {:cycle, path} -> [{:circular_inheritance, path} | errors]
    end
  end

  defp check_cycle(nil, _visited), do: :ok
  defp check_cycle(key, visited) do
    if MapSet.member?(visited, key) do
      {:cycle, MapSet.to_list(visited) ++ [key]}
    else
      case TypedObject.Registry.get(key) do
        nil -> :ok
        parent -> check_cycle(parent.parent_key, MapSet.put(visited, key))
      end
    end
  end

  defp validate_inheritance_depth(errors, object) do
    depth = calculate_depth(object.key, 0)

    cond do
      depth > 10 -> [{:inheritance_too_deep, depth, "max is 10"} | errors]
      depth > 5 ->
        Logger.warning("Deep inheritance: #{object.key} (#{depth} levels)")
        errors
      true -> errors
    end
  end

  defp validate_references(errors, object) do
    broken_refs = find_broken_references(object)

    if length(broken_refs) > 0 do
      [{:broken_references, broken_refs} | errors]
    else
      errors
    end
  end

  defp find_broken_references(object) do
    []
    |> check_quest_references(object)
    |> check_dialogue_references(object)
    |> check_script_references(object)
  end

  defp validate_type_specific(errors, object) do
    case object.type do
      :quest -> validate_quest(errors, object)
      :dialogue -> validate_dialogue(errors, object)
      :script -> validate_script(errors, object)
      _ -> errors
    end
  end

  defp validate_quest(errors, object) do
    # Quest must have objectives
    objectives = get_in(object.data, ["objectives"]) || []

    if length(objectives) == 0 do
      [{:quest_missing_objectives, object.key} | errors]
    else
      errors
    end
  end

  defp validate_dialogue(errors, object) do
    # Dialogue must have nodes and a valid start node
    nodes = get_in(object.data, ["nodes"]) || %{}
    start_node = get_in(object.data, ["start_node"]) || "start"

    cond do
      map_size(nodes) == 0 ->
        [{:dialogue_missing_nodes, object.key} | errors]

      not Map.has_key?(nodes, start_node) ->
        [{:dialogue_invalid_start_node, object.key, start_node} | errors]

      true ->
        # Check for broken node links
        broken = find_broken_dialogue_links(nodes)
        if length(broken) > 0 do
          [{:dialogue_broken_links, broken} | errors]
        else
          errors
        end
    end
  end

  defp validate_script(errors, object) do
    source = get_in(object.data, ["source"]) || ""

    case Code.string_to_quoted(source) do
      {:ok, _ast} -> errors
      {:error, {line, msg, _}} ->
        [{:script_syntax_error, object.key, "Line #{line}: #{msg}"} | errors]
    end
  end
end
```

---

## Live Operations

### Emergency Disable

```elixir
defmodule TypedObject.LiveOps do
  @doc """
  Disable an instance immediately without deleting it.
  The instance won't be loaded into registry until re-enabled.
  """
  def disable(object_key, reason, admin_id) do
    with {:ok, object} <- get_from_db(object_key),
         :ok <- validate_can_disable(object) do

      Repo.transaction(fn ->
        # Update metadata
        object
        |> TypedObject.Schema.changeset(%{
          metadata: Map.merge(object.metadata, %{
            "disabled" => true,
            "disabled_at" => DateTime.utc_now() |> DateTime.to_iso8601(),
            "disabled_by" => admin_id,
            "disabled_reason" => reason
          })
        })
        |> Repo.update!()

        # Remove from registry
        TypedObject.Registry.delete(object_key)

        # Log
        Logger.warning("Disabled #{object_key}: #{reason}")
        audit_log(:disable, object_key, admin_id, reason)
      end)
    end
  end

  @doc """
  Re-enable a disabled instance.
  """
  def enable(object_key, admin_id) do
    with {:ok, object} <- get_from_db(object_key),
         true <- object.metadata["disabled"] == true do

      Repo.transaction(fn ->
        # Update metadata
        updated =
          object
          |> TypedObject.Schema.changeset(%{
            metadata: object.metadata
            |> Map.delete("disabled")
            |> Map.delete("disabled_at")
            |> Map.delete("disabled_by")
            |> Map.delete("disabled_reason")
          })
          |> Repo.update!()

        # Reload into registry
        typed_object = TypedObject.Schema.to_typed_object(updated)
        resolved = resolve_with_parent(typed_object)
        TypedObject.Registry.put(object_key, resolved)

        Logger.info("Re-enabled #{object_key}")
        audit_log(:enable, object_key, admin_id, nil)
      end)
    end
  end

  @doc """
  Disable all instances in a namespace.
  Useful for emergency shutdown of builder content.
  """
  def disable_namespace(namespace, reason, admin_id) do
    import Ecto.Query

    TypedObject.Schema
    |> where([t], fragment("key LIKE ?", ^"#{namespace}:%"))
    |> where([t], t.is_template == false)
    |> Repo.all()
    |> Enum.each(fn obj ->
      disable(obj.key, reason, admin_id)
    end)
  end

  @doc """
  List all disabled instances.
  """
  def list_disabled do
    import Ecto.Query

    TypedObject.Schema
    |> where([t], fragment("metadata->>'disabled' = ?", "true"))
    |> Repo.all()
  end
end
```

### Hot Reload

```elixir
defmodule TypedObject.HotReload do
  @doc """
  Reload a single instance from database without full reload.
  """
  def reload_instance(key) do
    import Ecto.Query

    case Repo.get_by(TypedObject.Schema, key: key) do
      nil ->
        # Instance was deleted
        TypedObject.Registry.delete(key)
        {:ok, :deleted}

      schema ->
        typed_object = TypedObject.Schema.to_typed_object(schema)
        resolved = resolve_with_parent(typed_object)
        TypedObject.Registry.put(key, resolved)
        {:ok, :reloaded}
    end
  end

  @doc """
  Reload all templates from YAML.
  Used after deploy when templates change.
  """
  def reload_templates do
    TypedObject.Loader.reload()
  end
end
```

---

## Edge Cases

### 1. Circular Inheritance

**Scenario**: Instance A inherits from Instance B, which inherits from Instance A.

**Detection**: During topological sort in loader.

**Handling**:
```elixir
case :digraph_utils.topsort(graph) do
  false ->
    cycle = :digraph_utils.loop_vertices(graph)
    Logger.error("Circular inheritance detected: #{inspect(cycle)}")
    {:error, {:circular_inheritance, cycle}}
  sorted ->
    {:ok, sorted}
end
```

**Test**:
```elixir
test "circular inheritance is rejected" do
  insert_instance(key: "inst_a", parent_key: "inst_b")
  insert_instance(key: "inst_b", parent_key: "inst_a")

  assert {:error, {:circular_inheritance, _}} = TypedObject.Loader.reload()
end
```

### 2. Deep Inheritance Chain

**Scenario**: Chain of 15 inheritance levels.

**Detection**: During inheritance resolution.

**Handling**:
```elixir
@max_depth 10

defp validate_depth(object, depth) when depth > @max_depth do
  {:error, {:inheritance_too_deep, object.key, depth}}
end
```

**Test**:
```elixir
test "deep inheritance chain is rejected" do
  # Create chain: inst_1 -> inst_2 -> ... -> inst_15 -> base_npc
  for i <- 1..15 do
    parent = if i == 15, do: "base_npc", else: "inst_#{i + 1}"
    insert_instance(key: "inst_#{i}", parent_key: parent)
  end

  assert {:error, {:inheritance_too_deep, "inst_1", 15}} = TypedObject.Loader.reload()
end
```

### 3. Template Deleted During Deploy

**Scenario**: Deploy removes a template that instances depend on.

**Detection**: During loader startup.

**Handling**:
```elixir
defp validate_parent_reference(object, templates) do
  if object.parent_key && not Map.has_key?(templates, object.parent_key) do
    # Check if parent is another instance
    case Repo.get_by(TypedObject.Schema, key: object.parent_key) do
      nil ->
        Logger.error("Orphaned instance: #{object.key} references missing parent #{object.parent_key}")
        {:error, {:orphaned_instance, object.key, object.parent_key}}
      _ ->
        :ok
    end
  else
    :ok
  end
end
```

**Test**:
```elixir
test "orphaned instance detection" do
  insert_instance(key: "inst_a", parent_key: "deleted_template")
  # No template with key "deleted_template"

  # Should log error but not crash
  assert {:ok, _} = TypedObject.Loader.reload()

  # Instance should be marked as orphaned
  {:ok, obj} = TypedObject.get("inst_a")
  assert obj.metadata[:orphaned_parent] == "deleted_template"
end
```

### 4. Concurrent Edits

**Scenario**: Two admins edit the same instance simultaneously.

**Detection**: Optimistic locking via version field.

**Handling**:
```elixir
def update(key, changes, user_id, expected_version) do
  Repo.transaction(fn ->
    current = Repo.get_by!(TypedObject.Schema, key: key)

    if current.metadata["version"] != expected_version do
      Repo.rollback({:version_conflict, current.metadata["version"], expected_version})
    end

    # Proceed with update
    ...
  end)
end
```

**Test**:
```elixir
test "concurrent edit conflict detection" do
  {:ok, inst} = insert_instance(key: "test_inst")

  # Simulate two concurrent edits
  task1 = Task.async(fn ->
    TypedObject.Schema.update("test_inst", %{name: "Name A"}, "user1", 1)
  end)

  task2 = Task.async(fn ->
    # Small delay to ensure task1 starts first
    Process.sleep(10)
    TypedObject.Schema.update("test_inst", %{name: "Name B"}, "user2", 1)
  end)

  result1 = Task.await(task1)
  result2 = Task.await(task2)

  # One should succeed, one should fail with version conflict
  assert {:ok, _} = result1
  assert {:error, {:version_conflict, 2, 1}} = result2
end
```

### 5. Seeding Partial Failure

**Scenario**: Crash during seeding, half the content loaded.

**Detection**: Transaction rollback.

**Handling**:
```elixir
def seed_all do
  Repo.transaction(fn ->
    seed_files
    |> Enum.each(fn file ->
      case load_and_insert(file) do
        {:ok, _} -> :ok
        {:error, reason} ->
          Logger.error("Seeding failed at #{file}: #{inspect(reason)}")
          Repo.rollback(reason)
      end
    end)
  end)
end
```

**Test**:
```elixir
test "seeding is atomic" do
  # Create seed files, one with invalid data
  create_seed_file("valid.yml", %{key: "inst_a", parent_key: "base_npc"})
  create_seed_file("invalid.yml", %{key: "inst_b", parent_key: "nonexistent"})

  assert {:error, _} = TypedObject.Seeder.seed_all()

  # Database should be empty (rollback)
  assert TypedObject.Seeder.database_empty?()
end
```

### 6. Export During Heavy Edits

**Scenario**: Nightly export runs while builders are actively editing.

**Detection**: N/A (eventual consistency is acceptable).

**Handling**: Export reads committed data only. Builders' uncommitted changes are not exported.

**Test**:
```elixir
test "export captures committed state" do
  insert_instance(key: "inst_a", name: "Original")

  # Start a transaction that hasn't committed
  task = Task.async(fn ->
    Repo.transaction(fn ->
      Repo.update!(...name: "In Progress"...)
      # Hold transaction open
      Process.sleep(1000)
    end)
  end)

  # Export while transaction is open
  {:ok, exported} = TypedObject.Exporter.export_all()

  # Should see original value, not in-progress
  assert exported["inst_a"].name == "Original"

  Task.shutdown(task)
end
```

### 7. Unicode and Special Characters

**Scenario**: Builder tries to use emoji or non-ASCII in keys.

**Detection**: Key format validation.

**Handling**:
```elixir
@key_pattern ~r/^[a-z0-9_:]+$/

defp validate_key_format(key) do
  if Regex.match?(@key_pattern, key) do
    :ok
  else
    {:error, "Key must contain only lowercase letters, numbers, underscores, and colons"}
  end
end
```

**Test**:
```elixir
test "unicode keys are rejected" do
  assert {:error, _} = TypedObject.Validator.validate(%{key: "builder:日本語"})
  assert {:error, _} = TypedObject.Validator.validate(%{key: "builder:emoji_🎮"})
  assert {:error, _} = TypedObject.Validator.validate(%{key: "Builder:CamelCase"})
end
```

### 8. Large Instance Count

**Scenario**: 100,000 instances in database.

**Detection**: Performance monitoring.

**Handling**:
- Paginated loading in UI
- Indexed queries
- Background export (not blocking startup)

**Test**:
```elixir
@tag :performance
test "loader handles large instance count" do
  # Insert 10,000 instances
  for i <- 1..10_000 do
    insert_instance(key: "inst_#{i}", parent_key: "base_npc")
  end

  {time_us, {:ok, stats}} = :timer.tc(fn -> TypedObject.Loader.reload() end)

  assert stats.instances == 10_000
  assert time_us < 30_000_000  # Under 30 seconds
end
```

### 9. Rollback to Deleted Version

**Scenario**: Admin tries to rollback to version 5, but version cleanup deleted it.

**Detection**: Version lookup.

**Handling**:
```elixir
def rollback(key, target_version, user_id) do
  case get_version(key, target_version) do
    {:ok, version} -> do_rollback(version, user_id)
    {:error, :not_found} ->
      available = list_versions(key, 5)
      {:error, {:version_not_found, target_version, Enum.map(available, & &1.version)}}
  end
end
```

**Test**:
```elixir
test "rollback to deleted version fails gracefully" do
  insert_instance(key: "inst_a")

  # Create 150 versions (cleanup keeps only 100)
  for i <- 1..150 do
    TypedObject.Schema.update("inst_a", %{name: "v#{i}"}, "user", "Update #{i}")
  end

  # Version 1-50 should be deleted
  assert {:error, {:version_not_found, 1, available}} =
    TypedObject.Versioning.rollback("inst_a", 1, "admin")

  # Should suggest available versions
  assert 51 in available
end
```

### 10. Instance Depends on Disabled Instance

**Scenario**: Instance B inherits from Instance A. Admin disables Instance A.

**Detection**: Dependency check before disable.

**Handling**:
```elixir
def disable(key, reason, admin_id) do
  dependents = find_dependents(key)

  if length(dependents) > 0 do
    {:error, {:has_dependents, dependents}}
  else
    do_disable(key, reason, admin_id)
  end
end

# Or: cascade disable
def disable_cascade(key, reason, admin_id) do
  dependents = find_dependents(key)

  Enum.each(dependents, fn dep_key ->
    disable_cascade(dep_key, "Parent #{key} disabled", admin_id)
  end)

  do_disable(key, reason, admin_id)
end
```

**Test**:
```elixir
test "cannot disable instance with dependents" do
  insert_instance(key: "parent_inst", parent_key: "base_npc")
  insert_instance(key: "child_inst", parent_key: "parent_inst")

  assert {:error, {:has_dependents, ["child_inst"]}} =
    TypedObject.LiveOps.disable("parent_inst", "test", "admin")
end
```

---

## Test Specifications

### Unit Tests

```elixir
# test/loka/engine/typed_object/loader_test.exs
defmodule TypedObject.LoaderTest do
  use Loka.DataCase

  describe "load_templates/0" do
    test "loads all templates from YAML directory"
    test "infers type from directory path"
    test "validates template has is_template: true"
    test "handles YAML syntax errors gracefully"
    test "handles missing required fields"
  end

  describe "load_instances/0" do
    test "loads all instances from database"
    test "excludes disabled instances"
    test "handles empty database"
  end

  describe "resolve_inheritance/1" do
    test "resolves single-level inheritance"
    test "resolves multi-level inheritance"
    test "detects circular inheritance"
    test "handles missing parent gracefully"
    test "enforces max inheritance depth"
  end

  describe "merge_parent/2" do
    test "child scalar fields override parent"
    test "deep merges map fields"
    test "concatenates and dedupes list fields"
    test "preserves child metadata"
  end
end

# test/loka/engine/typed_object/seeder_test.exs
defmodule TypedObject.SeederTest do
  use Loka.DataCase

  describe "seed_if_empty/0" do
    test "seeds when database is empty"
    test "skips when database has content"
    test "handles invalid seed files"
    test "is atomic - rolls back on failure"
  end

  describe "seed_all/0" do
    test "loads from all seed directories"
    test "infers key from file path"
    test "validates parent references"
    test "topologically sorts before insert"
  end
end

# test/loka/engine/typed_object/exporter_test.exs
defmodule TypedObject.ExporterTest do
  use Loka.DataCase

  describe "export_all/0" do
    test "exports all instances to YAML"
    test "groups by namespace"
    test "preserves directory structure"
    test "handles empty database"
  end

  describe "export_namespace/1" do
    test "exports single namespace"
    test "handles non-existent namespace"
  end
end

# test/loka/engine/typed_object/versioning_test.exs
defmodule TypedObject.VersioningTest do
  use Loka.DataCase

  describe "record_change/4" do
    test "creates version record on update"
    test "increments version number"
    test "stores full snapshot"
    test "calculates diff correctly"
    test "triggers cleanup of old versions"
  end

  describe "rollback/3" do
    test "restores previous version"
    test "records rollback as new version"
    test "fails gracefully for missing version"
    test "respects permissions"
  end

  describe "cleanup_old_versions/1" do
    test "keeps last N versions"
    test "keeps versions within retention period"
    test "deletes versions outside both limits"
  end
end

# test/loka/engine/typed_object/validator_test.exs
defmodule TypedObject.ValidatorTest do
  use Loka.DataCase

  describe "validate/1" do
    test "accepts valid instance"
    test "rejects missing required fields"
    test "rejects invalid key format"
    test "rejects non-existent parent"
    test "rejects circular inheritance"
    test "rejects deep inheritance"
    test "validates quest-specific rules"
    test "validates dialogue-specific rules"
    test "validates script syntax"
  end
end

# test/loka/engine/typed_object/permissions_test.exs
defmodule TypedObject.PermissionsTest do
  use Loka.DataCase

  describe "can?/3" do
    test "viewers can view all, edit none"
    test "builders can edit own namespace only"
    test "senior builders can edit any instance"
    test "admins can edit everything"
    test "nobody can edit templates at runtime"
    test "only admins can delete core content"
  end
end
```

### Integration Tests

```elixir
# test/integration/content_lifecycle_test.exs
defmodule ContentLifecycleTest do
  use Loka.DataCase

  describe "full content lifecycle" do
    test "fresh boot: seed → load → registry" do
      # Clear database
      Repo.delete_all(TypedObject.Schema)

      # Reload (should seed)
      assert {:ok, stats} = TypedObject.Loader.reload()
      assert stats.instances > 0

      # Verify content is accessible
      assert {:ok, _} = TypedObject.get("monastery:novice_pema")
    end

    test "create → edit → version → rollback" do
      # Clone template to create instance
      {:ok, inst} = WorldBuilder.CloneController.clone(
        "base_monk",
        "builder:test:my_monk",
        test_user()
      )

      # Edit instance
      {:ok, updated} = TypedObject.Schema.update(
        inst.key,
        %{name: "Updated Name"},
        test_user().id,
        "Test update"
      )
      assert updated.name == "Updated Name"

      # Check version created
      versions = TypedObject.Versioning.list_versions(inst.key)
      assert length(versions) == 2  # create + update

      # Rollback
      {:ok, _} = TypedObject.Versioning.rollback(inst.key, 1, test_user().id)

      {:ok, rolled_back} = TypedObject.get(inst.key)
      assert rolled_back.name == "Novice Pema"  # Original from template
    end

    test "disable → enable" do
      insert_instance(key: "builder:test:temp_npc")

      # Disable
      :ok = TypedObject.LiveOps.disable("builder:test:temp_npc", "Testing", "admin")

      # Should not be in registry
      assert TypedObject.Registry.get("builder:test:temp_npc") == nil

      # Enable
      :ok = TypedObject.LiveOps.enable("builder:test:temp_npc", "admin")

      # Should be back in registry
      assert TypedObject.Registry.get("builder:test:temp_npc") != nil
    end

    test "export → clear → reseed" do
      # Create some test content
      insert_instance(key: "builder:test:export_test")

      # Export
      {:ok, _} = TypedObject.Exporter.export_all()

      # Verify file exists
      assert File.exists?("priv/seeds/instances/builder/npcs/export_test.yml")

      # Clear database
      Repo.delete_all(TypedObject.Schema)

      # Reseed
      {:ok, _} = TypedObject.Seeder.seed_all()

      # Content should be back
      assert {:ok, _} = TypedObject.get("builder:test:export_test")
    end
  end
end
```

### Performance Tests

```elixir
# test/performance/loader_performance_test.exs
defmodule LoaderPerformanceTest do
  use Loka.DataCase

  @moduletag :performance

  test "loader handles 10,000 instances under 30 seconds" do
    # Setup: insert 10,000 instances
    for i <- 1..10_000 do
      insert_instance(key: "perf_test:inst_#{i}", parent_key: "base_npc")
    end

    {time_us, {:ok, stats}} = :timer.tc(fn ->
      TypedObject.Loader.reload()
    end)

    assert stats.instances >= 10_000
    assert time_us < 30_000_000  # 30 seconds
  end

  test "registry lookup is O(1)" do
    # Insert 10,000 instances
    for i <- 1..10_000 do
      insert_instance(key: "perf_test:inst_#{i}", parent_key: "base_npc")
    end
    TypedObject.Loader.reload()

    # Lookup should be constant time regardless of count
    {time_us, _} = :timer.tc(fn ->
      for _ <- 1..1000 do
        TypedObject.Registry.get("perf_test:inst_5000")
      end
    end)

    # 1000 lookups should complete in under 100ms
    assert time_us < 100_000
  end
end
```

---

## Migration from Current System

### Overview

The migration transforms the current YAML-only system to Templates + Instances.

```
BEFORE:
priv/world/prototypes/npcs/novice_pema.yml  →  TypedObject in memory

AFTER:
priv/world/templates/npcs/base_monk.yml      →  Template in memory
priv/seeds/instances/monastery/novice_pema.yml  →  Instance in DB → memory
```

### Migration Steps

1. **Create template directory structure**
   ```bash
   mkdir -p priv/world/templates/{_base,npcs,rooms,items,quests}
   ```

2. **Extract templates from existing prototypes**
   - Move `_base/` files to `templates/_base/`
   - Move pattern files (base_monk, base_guard) to `templates/npcs/`
   - Add `is_template: true` to all

3. **Convert prototypes to seeds**
   - Move specific NPCs (novice_pema, elder_thubten) to `seeds/instances/monastery/`
   - Add `is_template: false`
   - Add namespace prefix to keys (`monastery:novice_pema`)
   - Add `parent_key` pointing to templates

4. **Update loader to support dual-source**
   - Load templates from `priv/world/templates/`
   - Load instances from database
   - Seed from `priv/seeds/instances/` if DB empty

5. **Run migration**
   ```bash
   mix ecto.migrate  # Add new columns if needed
   mix loka.reseed   # Populate database
   mix test          # Verify everything works
   ```

### Migration Script

```elixir
defmodule Mix.Tasks.Loka.MigrateToTemplates do
  use Mix.Task

  def run(_args) do
    Mix.Task.run("app.start")

    IO.puts("Starting migration to Templates + Instances architecture...")

    # Step 1: Identify templates vs instances
    all_objects = load_current_yaml()
    {templates, instances} = categorize(all_objects)

    IO.puts("Found #{length(templates)} templates, #{length(instances)} instances")

    # Step 2: Write templates to new location
    write_templates(templates)

    # Step 3: Write instances to seeds
    write_seeds(instances)

    # Step 4: Backup and remove old files
    backup_old_files()

    IO.puts("Migration complete. Run 'mix loka.reseed' to populate database.")
  end

  defp categorize(objects) do
    Enum.split_with(objects, fn obj ->
      # Templates are: files in _base/, or have no specific identity
      String.contains?(obj["_source"], "_base/") or
      is_nil(obj["name"]) or
      String.starts_with?(obj["key"] || "", "base_")
    end)
  end
end
```

---

## Implementation Phases

### Phase 1: Foundation (Engine Core)

**Goal**: Dual-source loader without breaking existing system.

**Tasks**:
1. Create `priv/world/templates/` directory structure
2. Add `is_template` field to TypedObject
3. Update Loader to load from templates directory
4. Add source tracking to metadata
5. Write unit tests for loader changes

**Deliverable**: Loader can load templates from YAML, system still works.

### Phase 2: Database Storage

**Goal**: Instances stored in and loaded from database.

**Tasks**:
1. Add seeder module
2. Add instance loading to loader
3. Update registry with new indexes
4. Create seed files from current prototypes
5. Write integration tests

**Deliverable**: System boots, seeds database, loads templates + instances.

### Phase 3: Versioning & Permissions

**Goal**: Track changes, control access.

**Tasks**:
1. Add versions table and schema
2. Implement version recording on save
3. Implement rollback
4. Add version cleanup job
5. Implement permissions module
6. Write tests

**Deliverable**: All changes tracked, permissions enforced.

### Phase 4: World Builder UI

**Goal**: Builders can create/edit instances via UI.

**Tasks**:
1. Update UI to show templates vs instances
2. Implement clone workflow
3. Implement edit workflow with versioning
4. Add version history viewer
5. Add rollback UI

**Deliverable**: Full CRUD via World Builder UI.

### Phase 5: Export & Live Ops

**Goal**: Automated backups, emergency controls.

**Tasks**:
1. Implement export module
2. Add nightly export Oban job
3. Implement disable/enable
4. Add bulk operations
5. Add monitoring/telemetry

**Deliverable**: Production-ready system with full operational tooling.

### Phase 6: Migration & Polish

**Goal**: Migrate existing content, documentation.

**Tasks**:
1. Write migration script
2. Migrate Monastery Arc content
3. Write builder documentation
4. Performance testing
5. Load testing

**Deliverable**: System fully deployed with migrated content.

---

## Task Breakdown

These are ready to be tracked as tasks when implementation begins.

### Phase 1: Foundation

```
lokacore-XXX: Create priv/world/templates/ directory structure
lokacore-XXX: Add is_template field to TypedObject struct
lokacore-XXX: Add source field to TypedObject metadata
lokacore-XXX: Update Loader to read from templates/ directory
lokacore-XXX: Update type inference for templates directory
lokacore-XXX: Write unit tests for template loading
```

### Phase 2: Database Storage

```
lokacore-XXX: Create TypedObject.Seeder module
lokacore-XXX: Implement seed_if_empty logic
lokacore-XXX: Create priv/seeds/instances/ structure
lokacore-XXX: Update Loader to load instances from database
lokacore-XXX: Add namespace index to Registry
lokacore-XXX: Add source index to Registry
lokacore-XXX: Extract templates from existing prototypes
lokacore-XXX: Convert monastery content to seed files
lokacore-XXX: Write seeder unit tests
lokacore-XXX: Write loader integration tests
```

### Phase 3: Versioning & Permissions

```
lokacore-XXX: Create typed_object_versions migration
lokacore-XXX: Create TypedObject.Version schema
lokacore-XXX: Implement record_change function
lokacore-XXX: Implement list_versions function
lokacore-XXX: Implement rollback function
lokacore-XXX: Add version cleanup policy
lokacore-XXX: Create Oban job for version cleanup
lokacore-XXX: Create TypedObject.Permissions module
lokacore-XXX: Implement role-based permission checks
lokacore-XXX: Write versioning unit tests
lokacore-XXX: Write permissions unit tests
```

### Phase 4: World Builder UI

```
lokacore-XXX: Update entity list to show templates vs instances
lokacore-XXX: Add [Clone] button for templates
lokacore-XXX: Implement clone workflow
lokacore-XXX: Update edit form with version tracking
lokacore-XXX: Add version history panel
lokacore-XXX: Add rollback button and confirmation
lokacore-XXX: Add namespace selector for new instances
lokacore-XXX: Write LiveView tests for clone workflow
lokacore-XXX: Write LiveView tests for version history
```

### Phase 5: Export & Live Ops

```
lokacore-XXX: Create TypedObject.Exporter module
lokacore-XXX: Implement export_all function
lokacore-XXX: Implement export_namespace function
lokacore-XXX: Create Oban job for nightly export
lokacore-XXX: Create TypedObject.LiveOps module
lokacore-XXX: Implement disable/enable functions
lokacore-XXX: Implement disable_namespace function
lokacore-XXX: Add telemetry events for content changes
lokacore-XXX: Add audit logging
lokacore-XXX: Write export unit tests
lokacore-XXX: Write live ops unit tests
```

### Phase 6: Migration & Polish

```
lokacore-XXX: Write migration script for existing content
lokacore-XXX: Migrate Monastery Arc NPCs to seeds
lokacore-XXX: Migrate Monastery Arc rooms to seeds
lokacore-XXX: Migrate Monastery Arc quests to seeds
lokacore-XXX: Write builder documentation
lokacore-XXX: Performance test with 10k instances
lokacore-XXX: Load test export under concurrent edits
lokacore-XXX: Update CLAUDE.md with new architecture
```

---

## References

- [Evennia Prototypes Documentation](https://www.evennia.com/docs/latest/Components/Prototypes.html)
- [Evennia for Diku Users](https://www.evennia.com/docs/3.x/Howtos/Evennia-for-Diku-Users.html)
- [Unity Prefabs](https://docs.unity3d.com/Manual/Prefabs.html)
- [Unreal Engine Blueprints](https://docs.unrealengine.com/5.0/en-US/blueprints-visual-scripting-in-unreal-engine/)

---

## Changelog

- **2026-01-12**: Initial proposal (namespace isolation model)
- **2026-01-12**: Major revision to Templates + Instances model
  - Changed from "core content stays in YAML" to "all instances in DB"
  - Added seeding system for fresh deploys
  - Added export system for backups
  - Added comprehensive edge cases and test specifications
  - Added task breakdown for implementation planning
- **2026-01-12**: Added "Implementation Timing" section - marked proposal as deferred
  - Changed status from "Proposal" to "Deferred"
  - Added rationale for why YAML-only is superior during rapid development
  - Added prerequisites checklist for implementation
  - Added stability signals to watch for
  - Recommended target timeline: Q3 2026 or when framework stabilizes
