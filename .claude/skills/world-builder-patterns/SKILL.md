---
name: world-builder-patterns
description: Ensures World Builder code follows the correct architecture patterns. Use when working with EntityManager, RoomManager, LiveView components, or entity data access.
---

# World Builder Patterns

**Auto-applies when**: Working on terminal builder commands, entity management, or YAML content creation

> See also: `.claude/rules/builder.md` for core patterns (architecture, module map, command flow, terminal markup, AI integration, validation).

## Entity Data Access (CRITICAL)

Entity properties like `level`, `item_type`, etc. are stored in components, not at the top level.

```elixir
# BAD - Direct property access
npc.level
item.item_type

# GOOD - Access through components
npc.components.stats.level
item.components.item.item_type

# GOOD - Use get_in for safety
get_in(npc, [:components, :stats, :level])
get_in(item, [:components, :item, :item_type])
```

### Entity Data Structure Reference

```elixir
%TypedObject{
  type: :npc,
  key: "town_guard",
  name: "Town Guard",
  components: %{
    stats: %{level: 5, str: 12, dex: 10},
    equipment: %{weapon: "sword", armor: "chainmail"}
  },
  behaviors: ["combat", "patrol"]
}
```

## EntityManager for CRUD

```elixir
# GOOD - Use EntityManager for NPCs, Items, etc.
EntityManager.create_entity(:npc, %{name: "Guard", key: "town_guard"})
EntityManager.update_entity(:item, item_id, %{name: "New Name"})
EntityManager.delete_entity(:npc, npc_id)

# BAD - Don't create redundant managers
NPCManager.create_npc(...)  # Use EntityManager instead!
```

## YAML Heredoc Indentation

When building YAML strings with Elixir heredocs (`~s"""`), the dedent strips leading whitespace. Interpolated multiline values must account for this:

```elixir
# BAD - 6 spaces before interpolation, dedent removes 4 -> first line gets 2 extra spaces
~s"""
    extra_desc: |
      #{indent_multiline(description, 2)}
"""

# GOOD - 4 spaces = 0 after dedent, indent_multiline handles all indentation
~s"""
    extra_desc: |
    #{indent_multiline(description, 2)}
"""
```

## RoomManager Dual-Storage Sync (Critical)

Rooms exist in BOTH the TypedObject registry (YAML-backed) and the entity database (SQLite). Any RoomManager operation MUST sync both stores or the game world will be inconsistent.

```elixir
# BAD - Only updating YAML/registry (rooms invisible to game engine)
save_room_yaml(room_data)

# GOOD - Save YAML, then spawn/update the DB entity
save_room_yaml(room_data)
Spawner.spawn_room(key)  # for create
Entities.get_entity_by_key(key) |> Entities.update_entity(attrs)  # for update
```

### Key sync points:
- **create_room**: YAML save → `Spawner.spawn_room(key)` → return enriched entity
- **update_room**: YAML save → `Entities.get_entity_by_key()` → `Entities.update_entity()`
- **delete_room**: Find DB entity by key (NOT by room_id) → `Entities.delete_entity()`
- **add_exit**: Update YAML exits → `spawn_exit_entity()` with proper `location_id`/`destination_id`
- **remove_exit**: `despawn_exit_entity()` → then update YAML exits

### UUID vs Key lookup:
Registry indexes by **key**, DB indexes by **UUID**. When a room exists in both stores, UUID lookups hit the DB path and miss YAML sync. Use `maybe_promote_to_registry/1` to redirect:

```elixir
# In get_room_from_db, after finding DB entity:
defp maybe_promote_to_registry(%{key: key} = schema) do
  case Registry.get(key) do
    {:ok, %{subtype: :room} = typed_obj} -> {:ok, {:registry, typed_obj}}
    _ -> {:ok, {:db, schema}}
  end
end
```

### EntitySchema.from_entity excludes attributes:
`attributes` is a `has_many` association (`EntityAttribute` table). Coordinates from YAML `attributes:` are lost after entity save→load. Fall back to TypedObject registry:

```elixir
case Loader.get(room.key) do
  {:ok, typed_obj} ->
    TypedObject.get_attribute(typed_obj, :x) || 0
  _ -> 0
end
```

## Common Bug Patterns

### Pattern 1: Property Access on Wrong Level
```elixir
# BUG
npc.level  # KeyError or nil
# FIX
npc.components.stats.level
```

### Pattern 2: Map.from_struct on Plain Maps
```elixir
# BUG - Data is already a plain map from YAML
Map.from_struct(yaml_data)  # Raises! Not a struct
# FIX
data = if is_struct(data), do: Map.from_struct(data), else: data
```

### Pattern 3: YAML String Keys
```elixir
# BUG - YAML loads with string keys, not atoms
data.key  # KeyError
# FIX
data["key"]
```
