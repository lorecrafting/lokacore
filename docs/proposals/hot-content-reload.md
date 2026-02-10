# Hot Content Reload: Always-Online World Building

**Status:** Approved for implementation
**Date:** 2026-02-09
**Goal:** Enable content creation and editing while the game world is live, with zero downtime and no player-visible disruption.

## Problem Statement

The builder terminal (and LLM agents) create game content by writing YAML files and calling `TypedObject.Loader.reload()`. This reload re-reads ALL ~347 YAML files from disk on every single edit. Additionally, framework registries (QuestRegistry, StorylineRegistry, etc.) maintain their own separate ETS tables loaded independently from YAML, creating a sync problem where TypedObject updates don't propagate to framework registries.

We need:
1. Targeted single-file reload (not full re-read of all files)
2. Automatic propagation to framework registries
3. Draft/published content separation so WIP content doesn't affect players
4. Ability to refresh already-spawned entities from updated prototypes

## Architecture Analysis

### Current State: Two Parallel Registry Systems

**System A: TypedObject Registry (engine layer)**
- `TypedObject.Loader` GenServer reads YAML from 5 paths into 3 ETS tables
- Paths: `priv/world/{prototypes,quests,zones,dialogues,scripts}`
- Tables: `:typed_objects` (set), `:typed_objects_by_type` (bag), `:typed_objects_by_tag` (bag)
- All tables: `:public`, `read_concurrency: true`
- Content modules (`Content.Quest`, `Content.Zone`, etc.) are thin wrappers over this
- **Reload is additive** - never clears tables, upserts then removes stale keys

**System B: Framework Registries (6 RegistryBase + 3 custom)**

| Registry | ETS Table | YAML Source | Uses RegistryBase? |
|---|---|---|---|
| StorylineRegistry | `:loka_storylines` | `priv/world/storylines` | Yes |
| SkillRegistry | `:loka_skills` | `priv/world/skills` | Yes |
| CraftingRegistry | `:loka_crafting_recipes` | `priv/world/crafting` | Yes |
| GatheringRegistry | `:loka_gathering_nodes` | `priv/world/gathering` | Yes |
| StatusRegistry | `:loka_status_effects` | `priv/world/status_effects` | Yes |
| ResourceRegistry | `:loka_resources` | `priv/world/resources` | Yes |
| QuestRegistry | `:loka_quests` | `priv/world/quests` | No (custom) |
| ChainRegistry | custom | custom | No |
| DamageTypes | custom | custom | No |

**Key difference:** RegistryBase registries use `YamlLoader.update_ets/2` which calls `:ets.delete_all_objects(table)` before repopulating (destructive). TypedObject uses additive upsert (safe).

**Overlap:** Quest YAML files are loaded by BOTH TypedObject.Loader AND QuestRegistry independently. Same for storylines. This is redundant I/O.

### What's Already Safe

- `Loader.reload()` does NOT restart the server or kill connections
- ETS is never empty during TypedObject reload (additive upsert pattern)
- All player-facing runtime reads come from SQLite (entity instances), not ETS prototypes
- Entity GenServer processes are unaffected by reload (hold state in process memory)
- Phoenix Channels survive reload (separate processes, `one_for_one` supervision)
- `Registry.put/2` already handles single-entry upsert with proper index cleanup
- `Loader.merge_from/1` already exists for additive merges from a path

### What Callers Exist

Builder commands that call `Loader.reload()` (14 call sites):
- `builder_commands/cutscenes.ex` (2 calls)
- `builder_commands/storylines.ex` (2 calls)
- `builder_commands/zones.ex` (3 calls)
- `builder_commands/scripts.ex` (5 calls)
- `builder_commands/world.ex` (1 call - explicit `reload` command)
- `builder_commands/ai.ex` (1 call)

`tool_executor.ex` calls `maybe_reload()` (~15 call sites) with `with_deferred_reload/1` batching optimization.

`room_manager.ex` calls `Loader.reload()` (3 calls: create, update, delete room).

---

## Implementation Plan

### Level 1: Targeted Single-File Reload

**Goal:** Replace full 347-file reload with single-file reload after each builder edit.

#### Changes to `TypedObject.Loader` (`server/lib/loka/engine/typed_object/loader.ex`)

Add new public API:

```elixir
@doc """
Reloads a single TypedObject from its YAML file.
Only updates that one entry in the registry. ~1ms instead of ~300ms.
"""
@spec reload_file(String.t()) :: {:ok, String.t()} | {:error, term()}
def reload_file(file_path, server \\ __MODULE__) do
  GenServer.call(server, {:reload_file, file_path})
end

@doc """
Removes a TypedObject by key from the registry.
Used when a YAML file is deleted.
"""
@spec remove(String.t()) :: :ok
def remove(key, server \\ __MODULE__) do
  GenServer.call(server, {:remove, key})
end
```

Add GenServer handlers:

```elixir
def handle_call({:reload_file, file_path}, _from, state) do
  case do_reload_file(file_path, state) do
    {:ok, key, new_state} ->
      # Broadcast change notification (Level 3)
      broadcast_content_changed(key)
      {:reply, {:ok, key}, new_state}
    {:error, reason} ->
      {:reply, {:error, reason}, state}
  end
end

def handle_call({:remove, key}, _from, state) do
  Registry.delete(key)
  new_raw = Map.delete(state.raw_objects, key)
  broadcast_content_changed(key)
  {:reply, :ok, %{state | raw_objects: new_raw}}
end
```

Private implementation:

```elixir
defp do_reload_file(file_path, state) do
  full_path = if Path.type(file_path) == :absolute, do: file_path, else: resolve_path(file_path)

  with {:ok, content} <- File.read(full_path),
       {:ok, data} <- YamlElixir.read_from_string(content),
       {:ok, typed_object} <- TypedObject.from_map(data) do
    # Resolve parent from existing registry data (not from raw_objects)
    resolved = resolve_parent_from_registry(typed_object)
    Registry.put(resolved.key, resolved)
    new_raw = Map.put(state.raw_objects, resolved.key, typed_object)
    {:ok, resolved.key, %{state | raw_objects: new_raw}}
  end
end

defp resolve_parent_from_registry(%TypedObject{parent_key: nil} = obj), do: obj
defp resolve_parent_from_registry(%TypedObject{parent_key: parent_key} = obj) do
  case Registry.get(parent_key) do
    {:ok, parent} -> TypedObject.merge_parent(obj, parent)
    {:error, :not_found} ->
      Logger.warning("Parent not found in registry: #{parent_key}")
      obj
  end
end
```

Also add atomic file write helper:

```elixir
@doc """
Writes YAML content to a file atomically (write to tmp, then rename).
"""
@spec atomic_write(String.t(), String.t()) :: :ok | {:error, term()}
def atomic_write(path, content) do
  tmp_path = path <> ".tmp"
  with :ok <- File.mkdir_p(Path.dirname(path)),
       :ok <- File.write(tmp_path, content) do
    File.rename(tmp_path, path)
  end
end
```

#### Changes to builder command call sites

Replace `Loader.reload()` with `Loader.reload_file(file_path)` at all 14 call sites in builder_commands. The pattern changes from:

```elixir
# Before
File.write!(yaml_path, yaml_content)
Loader.reload()

# After
Loader.atomic_write(yaml_path, yaml_content)
Loader.reload_file(yaml_path)
```

For delete operations:
```elixir
# Before
File.rm!(yaml_path)
Loader.reload()

# After
File.rm!(yaml_path)
Loader.remove(key)
```

#### Changes to `tool_executor.ex`

Update `maybe_reload/0` and `with_deferred_reload/1`:

```elixir
# maybe_reload becomes maybe_reload_file (takes a path)
defp maybe_reload_file(file_path) do
  unless Process.get(:loka_defer_reload) do
    Loka.Engine.TypedObject.Loader.reload_file(file_path)
  else
    # Accumulate paths for batched reload
    paths = Process.get(:loka_deferred_paths, [])
    Process.put(:loka_deferred_paths, [file_path | paths])
  end
end

def with_deferred_reload(fun) do
  Process.put(:loka_defer_reload, true)
  Process.put(:loka_deferred_paths, [])

  try do
    result = fun.()
    # Reload all accumulated files
    paths = Process.get(:loka_deferred_paths, [])
    Enum.each(paths, &Loka.Engine.TypedObject.Loader.reload_file/1)
    result
  after
    Process.delete(:loka_defer_reload)
    Process.delete(:loka_deferred_paths)
  end
end
```

#### Keep full reload as fallback

The explicit `reload` builder command (`builder_commands/world.ex`) should continue calling `Loader.reload()` for cases where you want a full re-sync from disk (e.g., after manual YAML edits outside the builder).

#### Files changed (Level 1)

| File | Change |
|---|---|
| `lib/loka/engine/typed_object/loader.ex` | Add `reload_file/1`, `remove/1`, `atomic_write/2`, `resolve_parent_from_registry/1`, `broadcast_content_changed/1` |
| `lib/loka_web/channels/builder_commands/cutscenes.ex` | Replace 2x `Loader.reload()` with `Loader.reload_file(path)` |
| `lib/loka_web/channels/builder_commands/storylines.ex` | Replace 2x `Loader.reload()` |
| `lib/loka_web/channels/builder_commands/zones.ex` | Replace 3x `Loader.reload()` |
| `lib/loka_web/channels/builder_commands/scripts.ex` | Replace 5x `Loader.reload()` |
| `lib/loka_web/channels/builder_commands/ai.ex` | Replace 1x `Loader.reload()` |
| `lib/loka/world_builder/room_manager.ex` | Replace 3x `Loader.reload()` |
| `lib/loka/world_builder/tool_executor.ex` | Update `maybe_reload/0` → `maybe_reload_file/1`, update `with_deferred_reload/1` to accumulate paths |

---

### Level 2: Draft/Published Content Separation

**Goal:** Content created by the builder starts as a "draft" visible only to admins. A `publish` command makes it visible to all players.

#### Directory convention

```
priv/world/
  prototypes/          # Published content
  quests/              # Published content
  zones/               # Published content
  dialogues/           # Published content
  scripts/             # Published content
  drafts/              # Draft content (same subdirectory structure)
    prototypes/
    quests/
    zones/
    dialogues/
    scripts/
```

#### TypedObject metadata

Add a `draft` field to the TypedObject struct (or use the existing `tags` system):

```elixir
# Option A: Use metadata map (preferred - no struct change needed)
# TypedObjects loaded from drafts/ get metadata: %{"draft" => true}

# In Loader, when loading from drafts/ path:
typed_object = %{typed_object | metadata: Map.put(typed_object.metadata || %{}, "draft", true)}
```

#### Loader changes

Add `priv/world/drafts` subdirectories to the default paths (or load them separately with the draft flag). Alternatively, add a separate `load_drafts/0` call that loads from `priv/world/drafts/` and marks items.

Preferred approach: `Loader.init/1` loads drafts after main content:

```elixir
@draft_paths [
  "priv/world/drafts/prototypes",
  "priv/world/drafts/quests",
  "priv/world/drafts/zones",
  "priv/world/drafts/dialogues",
  "priv/world/drafts/scripts"
]
```

#### Filtering drafts from player queries

Add a helper function and use it in player-facing code paths:

```elixir
# In TypedObject.Registry or a helper module
def is_draft?(%TypedObject{} = obj) do
  get_in(obj, [:metadata, "draft"]) == true
end

# In Content.Quest, Content.Zone, etc. - filter for player-facing queries
def all_published do
  Registry.list_by_type(:quest)
  |> Enum.reject(&TypedObject.is_draft?/1)
end
```

Places that need draft filtering (player-facing only):
- `Content.Quest.all/0` and `Content.Quest.list_by_tag/1`
- `Content.Zone.all/0`
- `Content.Dialogue.all/0`
- World spawner (don't spawn draft entities into the world)
- Quest giver NPC dialogue (don't offer draft quests to players)

Admin/builder queries should see both drafts and published content, with drafts marked.

#### Builder command changes

Default write target becomes `priv/world/drafts/`:

```elixir
# When builder creates content:
draft_path = Path.join(["priv/world/drafts", content_type, "#{key}.yml"])
Loader.atomic_write(draft_path, yaml_content)
Loader.reload_file(draft_path)  # Loaded with draft: true metadata
```

#### New builder commands: `publish` and `unpublish`

```
publish quest intro_welcome
  → Move file from drafts/quests/intro_welcome.yml to quests/intro_welcome.yml
  → reload_file(new_path)  # Now loaded without draft flag

unpublish quest intro_welcome
  → Move file from quests/intro_welcome.yml to drafts/quests/intro_welcome.yml
  → reload_file(new_path)  # Now loaded with draft flag

publish zone monastery_gardens
  → Publish all content associated with that zone (rooms, NPCs, items, quests, dialogues)
```

#### Files changed (Level 2)

| File | Change |
|---|---|
| `lib/loka/engine/typed_object/loader.ex` | Add draft paths, draft metadata tagging on load |
| `lib/loka/engine/typed_object.ex` | Add `is_draft?/1` helper (or metadata helper) |
| `lib/loka/content/quest.ex` | Add `all_published/0`, filter in relevant functions |
| `lib/loka/content/zone.ex` | Same draft filtering |
| `lib/loka/content/dialogue.ex` | Same draft filtering |
| `lib/loka_web/channels/builder_commands/content.ex` | Update write paths to use drafts/ |
| `lib/loka_web/channels/builder_commands/` (new or existing) | Add `publish`/`unpublish` commands |
| `lib/loka/world_builder/tool_executor.ex` | Update write paths to use drafts/ |
| `lib/loka/framework/world/world_loader.ex` | Filter drafts when spawning world |

---

### Level 3: Framework Registry Sync via PubSub

**Goal:** When TypedObject content is updated, framework registries automatically update their own ETS tables.

#### Content change PubSub topic

In `TypedObject.Loader`, after any content update:

```elixir
defp broadcast_content_changed(key) do
  case Registry.get(key) do
    {:ok, obj} ->
      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "content:changed",
        {:content_changed, key, obj.type, obj.subtype}
      )
    {:error, :not_found} ->
      # Content was deleted
      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "content:changed",
        {:content_deleted, key}
      )
  end
end
```

#### RegistryBase subscription

Add PubSub subscription to `RegistryBase.__using__/1` macro in `init/1`:

```elixir
# In init/1, after loading:
Phoenix.PubSub.subscribe(Loka.PubSub, "content:changed")

# Add handle_info for content changes:
@impl true
def handle_info({:content_changed, key, type, subtype}, state) do
  if should_handle_content_type?(type, subtype) do
    # Re-read the YAML file for this key and update our ETS
    do_reload_single(key, state)
  else
    {:noreply, state}
  end
end

def handle_info({:content_deleted, key}, state) do
  # Remove from our ETS if we have it
  items = Map.get(state, @state_key)
  if Map.has_key?(items, key) do
    :ets.delete(state.table, key)
    {:noreply, Map.put(state, @state_key, Map.delete(items, key))}
  else
    {:noreply, state}
  end
end
```

Each RegistryBase module would need to declare what content types it handles:

```elixir
use Loka.Framework.RegistryBase,
  table: :loka_storylines,
  path: "priv/world/storylines",
  item_module: Loka.Framework.Storyline.Storyline,
  item_name: "storyline",
  state_key: :storylines,
  content_types: [{:storyline, nil}]  # NEW: what TypedObject types to react to
```

#### Fix YamlLoader.update_ets/2 to be non-destructive

In `lib/loka/utils/yaml_loader.ex`, change from destructive clear to additive upsert:

```elixir
# Before (destructive):
def update_ets(table, items) do
  :ets.delete_all_objects(table)
  Enum.each(items, fn {key, item} -> :ets.insert(table, {key, item}) end)
  :ok
end

# After (additive, matching TypedObject pattern):
def update_ets(table, items) do
  old_keys = :ets.select(table, [{{:"$1", :_}, [], [:"$1"]}]) |> MapSet.new()
  Enum.each(items, fn {key, item} -> :ets.insert(table, {key, item}) end)
  new_keys = Map.keys(items) |> MapSet.new()
  old_keys |> MapSet.difference(new_keys) |> Enum.each(&:ets.delete(table, &1))
  :ok
end
```

#### QuestRegistry (custom, not RegistryBase)

QuestRegistry has custom inheritance resolution and variable substitution that RegistryBase doesn't provide. Two options:

**Option A (simpler):** QuestRegistry subscribes to PubSub and does a full reload when any quest content changes. Quest files are few (~20-30), so a full quest reload is fast.

**Option B (optimized):** QuestRegistry adds a `reload_one/2` that re-reads a single quest file, resolves inheritance, and updates ETS. More complex because of the template/inheritance system.

**Recommendation:** Start with Option A. If quest content grows significantly, add Option B later.

#### Files changed (Level 3)

| File | Change |
|---|---|
| `lib/loka/engine/typed_object/loader.ex` | Add `broadcast_content_changed/1` (called from Level 1 handlers) |
| `lib/loka/framework/registry_base.ex` | Add PubSub subscription in `init/1`, add `handle_info` for content changes, add `content_types` option |
| `lib/loka/utils/yaml_loader.ex` | Make `update_ets/2` non-destructive |
| `lib/loka/framework/quest/quest_registry.ex` | Add PubSub subscription, full quest reload on change |
| `lib/loka/framework/storyline/storyline_registry.ex` | Add `content_types` to `use` declaration |
| `lib/loka/framework/skills/skill_registry.ex` | Add `content_types` to `use` declaration |
| `lib/loka/framework/crafting/crafting_registry.ex` | Add `content_types` to `use` declaration |
| `lib/loka/framework/gathering/gathering_registry.ex` | Add `content_types` to `use` declaration |
| `lib/loka/framework/status/status_registry.ex` | Add `content_types` to `use` declaration |
| `lib/loka/framework/resources/resource_registry.ex` | Add `content_types` to `use` declaration |

---

### Level 4: Live Entity Refresh (Respawn Command)

**Goal:** After editing a prototype, refresh already-spawned entities without restarting the server.

#### New builder command: `respawn`

```
respawn npc monk_tenzin
  → Find all entity instances with prototype_key "monk_tenzin"
  → For each: stop the EntityServer process (if active), delete the entity from DB,
    re-spawn from updated prototype
  → Report: "Respawned 2 instances of monk_tenzin"

respawn room monastery_gate
  → Re-create the room entity from updated prototype
  → Preserve player positions (don't teleport players out)
  → Report: "Respawned room monastery_gate"

respawn zone monastery
  → Respawn all entities in the zone
  → Report: "Respawned 15 entities in zone monastery"
```

#### Implementation approach

Use existing `Spawner` module to re-create entities:

```elixir
defmodule Loka.WorldBuilder.Respawner do
  @doc """
  Respawns an entity from its updated prototype.
  Stops the active process, deletes the old DB record, spawns fresh.
  """
  def respawn_entity(prototype_key) do
    # Find entity instances with this prototype
    entities = Entities.find_by_prototype(prototype_key)

    Enum.map(entities, fn entity ->
      # Stop active process if running
      case EntitySupervisor.find_process(entity.id) do
        pid when is_pid(pid) -> EntitySupervisor.stop(entity.id)
        nil -> :ok
      end

      # Delete old entity
      Entities.delete_entity(entity.id)

      # Spawn fresh from updated prototype
      case Spawner.spawn(prototype_key, entity.room_id) do
        {:ok, new_entity} -> {:ok, new_entity}
        error -> error
      end
    end)
  end
end
```

#### Files changed (Level 4)

| File | Change |
|---|---|
| `lib/loka/world_builder/respawner.ex` | New module |
| `lib/loka_web/channels/builder_commands/entities.ex` | Add `respawn` command |
| `lib/loka/engine/entities.ex` | May need `find_by_prototype/1` query if not exists |

---

## Build Order

| Phase | Level | Est. effort | Dependencies |
|---|---|---|---|
| 1 | Level 1: Targeted reload | Half day | None |
| 2 | Level 3: Registry sync | Half day | Level 1 (broadcast_content_changed) |
| 3 | Level 4: Respawn command | 2 hours | Level 1 |
| 4 | Level 2: Draft separation | 1 day | Level 1 |

**Ship after each phase.** Each is independently useful and testable.

## Testing Strategy

### Level 1 tests
- `reload_file/1` loads a single file and updates only that entry in ETS
- `reload_file/1` resolves parent from existing registry data
- `reload_file/1` with invalid YAML returns error, existing data unchanged
- `remove/1` deletes entry and cleans up all indexes
- `atomic_write/2` survives simulated crash (no partial writes)
- Builder commands use targeted reload (integration test)

### Level 3 tests
- PubSub notification fires after `reload_file/1` and `remove/1`
- RegistryBase modules receive and process notifications
- QuestRegistry auto-reloads when quest content changes
- `YamlLoader.update_ets/2` is non-destructive (no brief empty window)

### Level 4 tests
- `respawn_entity/1` stops active process, deletes old entity, spawns new
- `respawn_entity/1` with non-existent prototype returns error
- Room respawn preserves player positions

### Level 2 tests
- Content created through builder goes to drafts/ directory
- Draft content has `draft: true` metadata
- `all_published/0` excludes drafts
- `publish` moves file and removes draft flag
- `unpublish` moves file back and adds draft flag
- World spawner doesn't spawn draft entities

## Future: Registry Consolidation (Separate PR)

The long-term architectural improvement is to make framework registries read from TypedObject instead of independently loading YAML. This eliminates:
- Duplicate file I/O (~100 extra files read at startup)
- The sync problem entirely (framework registries become "views" over TypedObject)
- RegistryBase's YAML loading code (replaced by TypedObject subscription)

This is a larger refactor (~2-3 days) that can happen anytime after Levels 1-4. The PubSub infrastructure from Level 3 is the foundation for this.

### Which registries could be eliminated entirely?

| Registry | Domain logic? | Could become Content module? |
|---|---|---|
| SkillRegistry | `by_category` (trivial filter) | Yes |
| StatusRegistry | Minimal parsing | Yes |
| ResourceRegistry | Minimal parsing | Yes |
| GatheringRegistry | `by_skill` filter | Probably |
| CraftingRegistry | `by_station`, `available_for` | Probably |
| StorylineRegistry | `prerequisites_for`, `storyline_for_quest` | Keep (real domain logic) |
| QuestRegistry | Inheritance, variable substitution, template system | Keep (significant domain logic) |

Target: Eliminate 3-5 registries, keep 2 that have real domain logic.
