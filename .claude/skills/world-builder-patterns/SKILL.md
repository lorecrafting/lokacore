---
name: world-builder-patterns
description: Ensures World Builder code follows the correct architecture patterns. Use when working with EntityManager, RoomManager, LiveView components, or entity data access.
---

# World Builder Patterns

**Auto-applies when**: Working on World Builder UI, entity management, or LiveView components

## Purpose

Ensures World Builder code follows the layered architecture and avoids common mistakes in entity data access.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Content Modules (Reusable)                         │
│   Content.Quest, Content.Dialogue, Content.Script           │
│   → Used by game code AND World Builder                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: EntityManager (Generic UI)                         │
│   EntityManager.create_entity/2, update_entity/3            │
│   → Simple CRUD for all entity types                        │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Specialized Managers (When Needed)                 │
│   RoomManager, TemplateManager, BatchOperations             │
│   → Only for complex UI requirements                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Rules

### 1. Access Entity Data Through Components

**CRITICAL**: Entity properties like `level`, `item_type`, etc. are stored in components, not at the top level.

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

### 2. Use EntityManager for Simple CRUD

```elixir
# GOOD - Use EntityManager for NPCs, Items, etc.
EntityManager.create_entity(:npc, %{name: "Guard", key: "town_guard"})
EntityManager.update_entity(:item, item_id, %{name: "New Name"})
EntityManager.delete_entity(:npc, npc_id)

# BAD - Don't create redundant managers
NPCManager.create_npc(...)  # Use EntityManager instead!
ItemManager.create_item(...) # Use EntityManager instead!
```

### 3. Use Specialized Managers Only When Needed

Only create specialized managers for complex UI requirements:

```elixir
# RoomManager - Needed for exit management, coordinates
RoomManager.create_room(%{key: "tavern", x: 5, y: 10})
RoomManager.add_exit("tavern", "north", "street")

# TemplateManager - Needed for template save/load/instantiate
TemplateManager.save_as_template(entity, "guard_template")
TemplateManager.instantiate_template("guard_template", overrides)
```

### 4. Handle Both TypedObject and DB Entities

World Builder may work with both prototype TypedObjects and database entities:

```elixir
# Handle both formats for exit data
defp extract_exits(room) do
  cond do
    # TypedObject format
    is_map(room.exits) ->
      room.exits

    # Database format (may have exit records)
    is_list(room.exits) ->
      Enum.into(room.exits, %{}, fn exit ->
        {exit.direction, exit.destination}
      end)

    true ->
      %{}
  end
end
```

### 5. LiveView Event Handling

```elixir
# Use phx-change with debounce for search/filter
<input
  type="text"
  name="search"
  phx-change="filter_templates"
  phx-debounce="300"
/>

# Close modals before opening new ones
def handle_event("show_picker", _, socket) do
  socket
  |> assign(:menu_open, false)  # Close menu first
  |> assign(:picker_open, true)
  |> then(&{:noreply, &1})
end
```

## Common Bug Patterns

### Pattern 1: Property Access on Wrong Level

```elixir
# BUG - level is not on entity root
npc.level  # KeyError or nil

# FIX - Access through components
npc.components.stats.level
```

### Pattern 2: Map.from_struct on Plain Maps

```elixir
# BUG - Data is already a plain map from YAML
Map.from_struct(yaml_data)  # Raises! Not a struct

# FIX - Check if it's a struct first
data = if is_struct(data), do: Map.from_struct(data), else: data
```

### Pattern 3: Wrong Return Value Expectations

```elixir
# BUG - Expected :ok but function returns {:ok, entity}
:ok = RoomManager.delete_room(room_key)

# FIX - Pattern match correctly
{:ok, _room} = RoomManager.delete_room(room_key)
```

### Pattern 4: Modal State Stacking

```elixir
# BUG - Opening picker without closing menu
def handle_event("open_picker", _, socket) do
  {:noreply, assign(socket, :picker_open, true)}
  # Menu is still open behind picker!
end

# FIX - Close overlapping UI first
def handle_event("open_picker", _, socket) do
  {:noreply, socket |> assign(:menu_open, false) |> assign(:picker_open, true)}
end
```

## Entity Data Structure Reference

```elixir
# TypedObject entity structure
%TypedObject{
  type: :npc,
  key: "town_guard",
  name: "Town Guard",
  components: %{
    stats: %{
      level: 5,
      str: 12,
      dex: 10
    },
    equipment: %{
      weapon: "sword",
      armor: "chainmail"
    }
  },
  behaviors: ["combat", "patrol"]
}

# Item component structure
%TypedObject{
  type: :item,
  key: "healing_potion",
  components: %{
    item: %{
      item_type: "consumable",
      weight: 0.5,
      value: 50
    },
    effects: %{
      heal: 25
    }
  }
}
```

## LiveView Patterns

### Form Event Handling

```elixir
# Correct pattern for form inputs
def handle_event("filter_changed", %{"filter" => filter_value}, socket) do
  filtered = filter_entities(socket.assigns.entities, filter_value)
  {:noreply, assign(socket, :filtered_entities, filtered)}
end
```

### Optimistic UI Updates

```elixir
# Update UI immediately, then persist
def handle_event("update_room", %{"room" => attrs}, socket) do
  # 1. Optimistic update
  socket = update_room_in_assigns(socket, attrs)

  # 2. Persist async
  Task.start(fn -> RoomManager.update_room(socket.assigns.room_id, attrs) end)

  {:noreply, socket}
end
```

## Validation

After World Builder changes:

```bash
# Run World Builder tests
mix test test/loka/world_builder/

# Run LiveView tests
mix test test/loka_web/live/admin_live/

# Check for component access errors
mix test --trace 2>&1 | grep -i "keyerror\|component"
```
