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
