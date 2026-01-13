# World Management

Loka provides a spatial coordinate system and import/export functionality for managing world state. This enables map visualization, auto-layout, and backup/restore operations.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     World Management                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WorldGraph              - Spatial coordinate operations    │
│    ├── Coordinates       - X/Y/Z positioning for rooms      │
│    ├── Direction System  - Cardinal + diagonal + vertical   │
│    ├── Auto-Layout       - BFS algorithm from exits         │
│    └── Spatial Queries   - Find rooms by position/bounds    │
│                                                             │
│  LayoutManager           - Automatic coordinate maintenance │
│    ├── Hook Integration  - Triggers on exit create/delete   │
│    └── Debounced Refresh - Avoids excessive recomputation   │
│                                                             │
│  WorldExporter           - Serialize entities to YAML       │
│    └── Backup            - Export world state for restore   │
│                                                             │
│  WorldImporter           - Load entities from YAML          │
│    └── Restore           - Recreate world from backup       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Coordinate System

Rooms can have spatial coordinates stored in their components:

```yaml
# Room with coordinates
components:
  coordinates:
    x: 5
    y: 3
    z: 0
```

### Direction Offsets

| Direction | X | Y | Z |
|-----------|---|---|---|
| north | 0 | -1 | 0 |
| south | 0 | +1 | 0 |
| east | +1 | 0 | 0 |
| west | -1 | 0 | 0 |
| up | 0 | 0 | +1 |
| down | 0 | 0 | -1 |
| northeast | +1 | -1 | 0 |
| northwest | -1 | -1 | 0 |
| southeast | +1 | +1 | 0 |
| southwest | -1 | +1 | 0 |

The coordinate system uses:
- **X**: West (-) to East (+)
- **Y**: North (-) to South (+)
- **Z**: Down (-) to Up (+)

## WorldGraph API

### Getting/Setting Coordinates

```elixir
# Get coordinates for a room
{x, y, z} = WorldGraph.get_coordinates(room_entity)
# => {5, 3, 0}

# Set coordinates (persists to DB)
{:ok, entity} = WorldGraph.set_coordinates(room_id, 5, 3, 0)

# Set coordinates in memory only
entity = WorldGraph.set_coordinates_in_memory(entity, 5, 3, 0)
```

### Finding Rooms

```elixir
# Find room at specific position
room = WorldGraph.get_room_at(5, 3, 0)

# Get rooms in a bounding box (for map viewport)
rooms = WorldGraph.get_rooms_in_bounds(0, 0, 10, 10, z: 0)

# List all rooms with coordinates
rooms_with_coords = WorldGraph.list_rooms_with_coordinates()
# => [{entity, {x, y, z}}, ...]
```

### Adjacent Rooms

```elixir
# Get adjacent rooms via exits
adjacent = WorldGraph.get_adjacent_rooms(room_id)
# => [{"north", room_entity}, {"east", room_entity}, ...]
```

### Direction Utilities

```elixir
# Get offset for a direction
WorldGraph.direction_offset("north")
# => {0, -1, 0}

# Get opposite direction
WorldGraph.opposite_direction("north")
# => "south"

# Infer direction from positions
WorldGraph.infer_direction({0, 0, 0}, {1, 0, 0})
# => "east"
```

## Auto-Layout

The auto-layout feature assigns coordinates to rooms based on their exit connections using a BFS (breadth-first search) algorithm.

### How It Works

1. Start from a specified room at coordinates (0, 0, 0)
2. BFS traverse through exits
3. Calculate position for each connected room based on direction
4. Handle collisions by finding nearby available positions

```elixir
# Auto-layout entire world from a starting room
{:ok, count} = WorldGraph.auto_layout(starting_room_id)
# => {:ok, 42}  # 42 rooms laid out

# With options
{:ok, count} = WorldGraph.auto_layout(room_id,
  persist: true,              # Save to DB (default: true)
  starting_coords: {0, 0, 0}  # Starting position
)
```

### Collision Handling

When a calculated position is already occupied, the algorithm uses a spiral search pattern to find the nearest available position (up to radius 10).

## LayoutManager

The LayoutManager GenServer automatically maintains room coordinates when exits change.

### Design Philosophy

- Coordinates are **computed from exits**, not manually set
- Single source of truth: exits define spatial relationships
- Auto-refresh on world load and exit changes
- Debounces rapid changes (500ms) to avoid excessive computation

### Automatic Updates

```elixir
# LayoutManager registers these hooks on startup:
# - :at_entity_creation - Triggers refresh when exit created
# - :at_entity_delete   - Triggers refresh when exit deleted
```

### Manual Refresh

```elixir
# Refresh all room coordinates
WorldGraph.LayoutManager.refresh_all()

# Refresh from a specific room
WorldGraph.LayoutManager.refresh_from(room_id)
```

## WorldExporter

Export entities to YAML files for backup or migration.

### Export All

```elixir
{:ok, stats} = WorldExporter.export_all("priv/exports/backup_2024")
# Creates:
#   backup_2024/
#     rooms/
#       town_square.yml
#       tavern.yml
#     npcs/
#       bartender.yml
#     items/
#       sword.yml
#     exits/
#       north_exit.yml
```

### Export by Type

```elixir
{:ok, stats} = WorldExporter.export_rooms("priv/exports/rooms")
{:ok, stats} = WorldExporter.export_npcs("priv/exports/npcs")
{:ok, stats} = WorldExporter.export_items("priv/exports/items")
{:ok, stats} = WorldExporter.export_exits("priv/exports/exits")
```

### Convert Single Entity

```elixir
# Convert to YAML string
yaml = WorldExporter.entity_to_yaml(entity)

# Convert to prototype map
proto = WorldExporter.entity_to_prototype(entity)
```

### Exported YAML Format

```yaml
key: town_square
type: room
name: "Town Square"
description: |
  A bustling town square with a fountain in the center.
components:
  coordinates:
    x: 0
    y: 0
    z: 0
tags:
  - outdoor
  - safe_zone
```

## WorldImporter

Import entities from YAML files to recreate world state.

### Import All

```elixir
{:ok, stats} = WorldImporter.import_all("priv/exports/backup_2024")
# => %{rooms: 10, npcs: 5, items: 20, exits: 30, exits_linked: 28}

# With options
{:ok, stats} = WorldImporter.import_all("priv/exports/backup_2024",
  clear_existing: true,  # Delete existing entities first
  link_exits: true       # Resolve destination_key to destination_id
)
```

### Import by Type

```elixir
{:ok, count} = WorldImporter.import_type("priv/exports/rooms", :room)
```

### Import Single File

```elixir
{:ok, entity} = WorldImporter.import_file("priv/exports/rooms/tavern.yml", :room)
```

### Exit Linking

After import, exits need their `destination_key` resolved to `destination_id`:

```elixir
linked_count = WorldImporter.link_all_exits()
```

This happens automatically when `link_exits: true` (the default).

## Use Cases

### Map Visualization

```elixir
# Get rooms for a map viewport
rooms = WorldGraph.get_rooms_in_bounds(
  player_x - 10, player_y - 10,  # min
  player_x + 10, player_y + 10,  # max
  player_z
)

# Render rooms on a grid
for {entity, {x, y, z}} <- rooms do
  render_room_at(entity, x, y)
end
```

### World Backup

```elixir
# Create timestamped backup
timestamp = DateTime.utc_now() |> DateTime.to_iso8601(:basic)
{:ok, _} = WorldExporter.export_all("priv/backups/#{timestamp}")
```

### World Restore

```elixir
# Restore from backup
{:ok, _} = WorldImporter.import_all("priv/backups/20240120T120000",
  clear_existing: true
)

# Trigger layout refresh
WorldGraph.LayoutManager.refresh_all()
```

### Adding New Areas

```elixir
# Import new area from YAML
{:ok, _} = WorldImporter.import_all("priv/content/new_dungeon")

# Coordinates will be computed automatically when exits are processed
```

## Supervision Tree

```
Loka.Application
       │
       ├── Loka.Engine.Hooks
       ├── Loka.Engine.WorldGraph.LayoutManager  ← Auto-maintains coordinates
       ├── ...
       └── LokaWeb.Endpoint
```

## Files

| File | Description |
|------|-------------|
| `lib/loka/engine/world_graph.ex` | Coordinate system and spatial queries |
| `lib/loka/engine/world_graph/layout_manager.ex` | Auto-layout GenServer |
| `lib/loka/engine/world_exporter.ex` | Entity → YAML serialization |
| `lib/loka/engine/world_importer.ex` | YAML → Entity import |

## Related

- [Entity System](./entity-system.md) - Entity structure
- [Prototypes](./prototypes.md) - YAML-based templates
- [Entity Lifecycle](./entity-lifecycle.md) - EntityServer and Registry
- [Hooks & Locks](./hooks-and-locks.md) - Lifecycle callbacks
