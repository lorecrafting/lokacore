# World Designer - Admin Tool Design Document

> **Status**: In Development
> **Created**: 2024-12-28
> **Last Updated**: 2024-12-28

## Overview

The World Designer is a comprehensive admin tool providing a "god's eye view" of the entire game world, quests, storylines, and their interconnections. It serves dual purposes:

1. **Visualization** - See everything at once: rooms, NPCs, quests, objectives, player progress
2. **Validation** - Visual indicators make broken connections, missing turn-ins, and orphaned content immediately obvious

## Design Rationale

### Why Build This?

During playtest development, it's difficult to:
- Know which NPC gives which quest
- See where cutscenes and objectives are located
- Understand quest flow and prerequisites
- Identify broken quest chains or missing turn-in dialogues
- Track player progress through storylines

Industry tools like Articy:draft solve this for other engines, but we need something integrated with our YAML-based prototype system that updates in real-time.

### Why Custom SVG Over Mermaid?

We evaluated Mermaid.js for the quest diagram but chose custom SVG for both panels:

| Requirement | Mermaid | Custom SVG |
|------------|---------|------------|
| Click handlers on nodes | ❌ Limited | ✅ Full control |
| Live editing updates | ❌ Full re-render | ✅ Incremental |
| Custom icons in nodes | ❌ Emoji only | ✅ Any SVG |
| Precise styling control | ❌ CSS limited | ✅ Full control |
| Validation overlays | ❌ Hard to add | ✅ Easy |
| Player progress per-node | ❌ Complex | ✅ Simple |
| Pan/zoom | ❌ Needs wrapper | ✅ Built-in |

**Key insight**: Quest diagrams are mostly linear (act 1 → act 2 → act 3) with side quests in a separate column. This simple structure doesn't need Mermaid's auto-layout - a hierarchical layout algorithm suffices.

### Unified Rendering Approach

Using custom SVG for both World Map and Quest Diagram means:
- Same JS hooks work for both
- Consistent interaction patterns
- Easier to add features (drag to rearrange, connection drawing)
- No external dependencies

## Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORLD DESIGNER TAB                                           [Player: ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filters: [✓ All] [  Quests] [  NPCs] [  Items] [  Players] [  Warnings]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────┐  ┌────────────────────────────────────┐│
│  │      WORLD MAP (SVG)            │  │   QUEST DIAGRAM (SVG)              ││
│  │    [Pan/Zoom Controls]          │  │   Storyline: [▼ selector]          ││
│  │                                 │  │                                    ││
│  │   Room grid with icons          │  │   Quest nodes with connections     ││
│  │   for NPCs, objectives, etc.    │  │   organized by acts                ││
│  │                                 │  │                                    ││
│  └─────────────────────────────────┘  └────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│  DETAIL PANEL (Context-Sensitive)                                [Edit ✏️] │
│  Shows full details of selected room, quest, or NPC                         │
│  Includes validation warnings and related entities                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
lib/loka_web/live/admin_live/
├── world_designer_tab.ex              # Main tab coordinator
└── world_designer/
    ├── world_map_component.ex         # SVG world map
    ├── quest_diagram_component.ex     # SVG quest flow diagram
    ├── detail_panel_component.ex      # Context-sensitive details
    ├── player_selector_component.ex   # Player progress selector
    └── filter_bar_component.ex        # Filter toggles

lib/loka/admin/world_designer/
├── data_aggregator.ex                 # Combines all data sources
├── validator.ex                       # Cross-system validation
├── player_progress.ex                 # Player overlay data
├── objective_renderer.ex              # Extensible objective rendering
├── layout/
│   ├── room_layout.ex                 # Room grid positioning
│   └── quest_layout.ex                # Quest DAG layout
└── svg/
    ├── room_renderer.ex               # Room SVG generation
    ├── quest_renderer.ex              # Quest node SVG generation
    └── connection_renderer.ex         # Lines/arrows between nodes

assets/js/hooks/
├── world_map_hook.js                  # SVG pan/zoom, click handlers
└── quest_diagram_hook.js              # Quest diagram interactions
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                                 │
├─────────────────────────────────────────────────────────────────┤
│  PrototypeLoader    QuestRegistry    StorylineRegistry          │
│  (rooms, NPCs,      (quest defs,     (storylines, acts,         │
│   items, exits)     objectives)       prerequisites)             │
│         │                │                    │                  │
│         └────────────────┼────────────────────┘                  │
│                          ▼                                       │
│              ┌───────────────────────┐                           │
│              │   DataAggregator      │                           │
│              │   - aggregate_all()   │                           │
│              │   - by_room()         │                           │
│              │   - by_quest()        │                           │
│              └───────────┬───────────┘                           │
│                          │                                       │
│         ┌────────────────┼────────────────┐                      │
│         ▼                ▼                ▼                      │
│   ┌───────────┐   ┌───────────┐   ┌───────────────┐             │
│   │ Validator │   │ Layout    │   │ PlayerProgress│             │
│   │           │   │ Engines   │   │               │             │
│   └─────┬─────┘   └─────┬─────┘   └───────┬───────┘             │
│         │               │                 │                      │
│         └───────────────┼─────────────────┘                      │
│                         ▼                                        │
│              ┌───────────────────────┐                           │
│              │   LiveView State      │                           │
│              │   - rooms, quests     │                           │
│              │   - validations       │                           │
│              │   - player_overlay    │                           │
│              └───────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### 1. World Map

**What it shows:**
- Grid-based room layout using coordinates from WorldGraph
- Rooms as clickable rectangular nodes
- Exit connections as lines between nodes
- Icons overlaid on rooms:
  - 🟢 Quest giver NPCs (with quest count badge)
  - 📍 Quest objective locations
  - 🏠 Turn-in NPCs
  - ⚔️ Combat encounters
  - 🌿 Gathering nodes
  - ⚠️ Validation warnings
  - 👤 Player location (when player selected)

**Interactions:**
- Click room → show room details in detail panel
- Hover room → tooltip with room name and contents
- Pan/zoom for navigation
- Filter toggles show/hide specific marker types
- Click quest marker → highlights all rooms in that quest chain

**Visual Validation:**
- Rooms without exits = red border (orphaned)
- One-way exits = yellow warning line
- Missing spawn targets = ⚠️ icon

### 2. Quest Diagram

**What it shows:**
- Hierarchical layout of quests organized by storyline/acts
- Quest nodes with status indicators
- Arrows showing prerequisites and unlocks
- Side quests in separate column
- Act boundaries as horizontal dividers

**Layout Algorithm:**
```
┌─────────────────────────────────────────────────────────┐
│  Storyline: The Sleeping Master                          │
├─────────────────────────────────────────────────────────┤
│  ACT 1: Discovery                                        │
│  ┌─────────────────┐                                    │
│  │ main_sleeping   │────────────────┐                   │
│  │ 🟢 novice_pema  │                │                   │
│  └─────────────────┘                │                   │
├─────────────────────────────────────┼───────────────────┤
│  ACT 2: Three Trials                │                   │
│  ┌─────────────────┐                │                   │
│  │ main_three      │◄───────────────┘                   │
│  │ ⚠️ no turn-in   │                                    │
│  └─────────────────┘                                    │
├─────────────────────────────────────────────────────────┤
│  SIDE QUESTS                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ side_tea │  │ side_spi │  │ side_mtn │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

**Node Information:**
- Quest name and ID
- Quest giver NPC (with room)
- Turn-in NPC (if different)
- Objective count summary
- Validation status icon

**Interactions:**
- Click quest → show full details in panel
- Click quest → highlight related rooms on world map
- Storyline selector dropdown
- Player overlay shows completion status

### 3. Detail Panel

**Context-sensitive display based on selection:**

**Quest Selected:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Quest: "The Sleeping Master" (main_sleeping_master)      [Edit] │
│ Type: Main | Act: 1 | Storyline: monastery_arc                  │
├─────────────────────────────────────────────────────────────────┤
│ FLOW                                                            │
│ novice_pema @ meditation_hall → [3 objectives] → abbot @ temple │
├─────────────────────────────────────────────────────────────────┤
│ Objectives                     │ Validation                     │
│ ─────────────────────────────  │ ───────────────────────────    │
│ 1. talk_pema [talk]            │ ✅ Giver NPC exists            │
│    📍 meditation_hall          │ ✅ Giver has dialogue          │
│    🗣️ Topic: help_needed       │ ✅ All objectives valid        │
│                                │ ⚠️ Turn-in missing             │
│ 2. find_incense [get_item]     │    complete_quest action       │
│    📍 supply_room              │                                │
│    🎯 meditation_incense x1    │ Rewards:                       │
│                                │ XP: 100, Gold: 50              │
│ 3. return_pema [talk]          │ Items: blessed_incense         │
│    📍 meditation_hall          │                                │
│    🗣️ Topic: incense_found     │ Unlocks: main_three_trials     │
├─────────────────────────────────────────────────────────────────┤
│ Prerequisites: none                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Room Selected:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Room: "Meditation Hall" (meditation_hall)                [Edit] │
│ Coordinates: (5, 3, 0) | Zone: monastery                        │
├─────────────────────────────────────────────────────────────────┤
│ Exits: north→temple, south→courtyard, east→supply_room          │
├─────────────────────────────────────────────────────────────────┤
│ NPCs                    │ Quest Involvement                      │
│ ──────────────────────  │ ─────────────────────────────────────  │
│ 👤 novice_pema          │ 🟢 Gives: main_sleeping_master         │
│ 👤 meditation_student   │ 📍 Objective: talk_pema                │
│                         │ 📍 Objective: return_to_pema           │
├─────────────────────────────────────────────────────────────────┤
│ Items                   │ Spawns                                 │
│ ──────────────────────  │ ─────────────────────────────────────  │
│ 📿 prayer_beads         │ novice_pema, meditation_student        │
│ 🕯️ meditation_cushion   │ prayer_beads, meditation_cushion       │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Filter System

**Available Filters:**
- `All` - Show everything
- `Quests` - Quest givers, objectives, turn-ins
- `NPCs` - All NPC locations
- `Items` - Item spawn locations
- `Combat` - Combat encounter areas
- `Players` - Active player locations
- `Warnings` - Only show validation issues

**Filter Implementation:**
- Filters are view transforms, not data changes
- Same data, different visibility flags
- Multiple filters can be combined

### 5. Player Progress Overlay

**Player Selector:**
```
[Player: ▼ All Players        ]
         ├─ All Players (god mode - no overlay)
         ├─ player_raymo (Level 5) - 3 active quests
         ├─ player_test1 (Level 2) - 1 active quest
         └─ player_admin (Level 10) - 0 active quests
```

**When Player Selected:**

On World Map:
- Pulsing marker shows player's current room
- Quest objectives for active quests highlighted
- Completed objective locations dimmed
- Path hints to next objectives

On Quest Diagram:
- Completed quests shown in green
- Active quests shown in yellow with progress bar
- Available quests (prerequisites met) shown in blue
- Locked quests shown in gray

### 6. Validation System

**Reuses Existing Validators:**
```elixir
defmodule Loka.Admin.WorldDesigner.Validator do
  @moduledoc """
  Aggregates all validation results for visual display.
  Reuses existing validators and adds cross-system checks.
  """

  def validate_all do
    %{
      prototypes: PrototypeLinter.lint(),
      quests: QuestValidator.validate_all(),
      dialogues: DialogueValidator.validate_all(),
      world: WorldValidator.validate_all(),
      cross_system: validate_cross_system()
    }
  end

  defp validate_cross_system do
    [
      validate_quest_giver_npcs_spawned(),
      validate_objective_targets_exist(),
      validate_turn_in_dialogues_complete(),
      validate_item_objectives_spawnable(),
      validate_room_exits_bidirectional()
    ]
  end
end
```

**Visual Indicators:**
| Issue Type | Map Indicator | Diagram Indicator | Detail Panel |
|------------|---------------|-------------------|--------------|
| Missing NPC | ⚠️ on room | Red node border | ❌ with message |
| Broken exit | Dashed line | N/A | ⚠️ with message |
| No turn-in | N/A | ⚠️ on node | ❌ with message |
| Orphan room | Red border | N/A | ⚠️ with message |
| Missing item | ⚠️ on room | ⚠️ on objective | ❌ with message |

### 7. Editing Capabilities

**Edit Flow:**
1. Select entity (room, quest, NPC)
2. Click "Edit" button in detail panel
3. Modal opens with editable fields
4. Save → writes to YAML file
5. Automatic prototype reload
6. Map/diagram updates live

**Edit Modal Fields:**

For Quest:
- Name, description
- Giver NPC (dropdown)
- Turn-in NPC (dropdown)
- Objectives (inline editor)
- Rewards (XP, gold, items)
- Prerequisites (multi-select)

For Room:
- Name, description
- Exits (direction → room dropdowns)
- Spawns (NPC/item multi-select)
- Ambient messages

## Extensibility

### Adding New Objective Types

The World Designer uses a registry pattern for objective rendering:

```elixir
defmodule Loka.Admin.WorldDesigner.ObjectiveRenderer do
  @moduledoc """
  Registry of how to render each objective type.
  New types register their rendering behavior here.
  """

  @renderers %{
    talk: &render_talk/1,
    kill: &render_kill/1,
    get_item: &render_get_item/1,
    go_to: &render_go_to/1
    # New types added here
  }

  def render(objective) do
    renderer = Map.get(@renderers, objective.type, &render_unknown/1)
    renderer.(objective)
  end

  # Returns: %{icon: "🗣️", label: "Talk to X", room: "room_id", validation: [...]}
end
```

**Adding a New Type (e.g., `wait_in_room`):**

1. Define the objective type in quest system
2. Add renderer function:
```elixir
defp render_wait_in_room(obj) do
  %{
    icon: "⏱️",
    label: "Wait #{obj.duration}s",
    room: obj.room_id,
    validation: validate_room_exists(obj.room_id)
  }
end
```
3. Register in `@renderers` map
4. World Designer automatically renders it

### Future Complex Quests

The architecture supports complex quest mechanics like:
- **Wait timers**: `wait_in_room`, `survive_duration`
- **Triggered events**: Monster swallowing, teleportation
- **State machines**: Plant growth, crafting progress
- **Cutscene triggers**: Location + condition based

Each new mechanic:
1. Implements quest objective type
2. Registers a renderer for World Designer
3. Adds validation rules if needed

## Implementation Phases

### Phase 1: Foundation ✅ (Current)
- [x] Design document
- [ ] Create `world_designer_tab.ex` with basic layout
- [ ] Implement `data_aggregator.ex`
- [ ] Add to admin sidebar
- [ ] Basic room list (before SVG)
- [ ] Basic quest list (before SVG)

### Phase 2: World Map
- [ ] Room layout algorithm using coordinates
- [ ] SVG rendering of room grid
- [ ] Exit connection lines
- [ ] Room icons based on contents
- [ ] Pan/zoom with JS hook
- [ ] Click room → detail panel

### Phase 3: Quest Diagram
- [ ] Quest layout algorithm (hierarchical)
- [ ] SVG rendering of quest nodes
- [ ] Prerequisite arrows
- [ ] Act grouping
- [ ] Storyline selector
- [ ] Click quest → detail panel + map highlight

### Phase 4: Detail Panel
- [ ] Room detail view
- [ ] Quest detail view
- [ ] NPC detail view
- [ ] Objective breakdown
- [ ] Related entities links

### Phase 5: Validation Integration
- [ ] Aggregate existing validators
- [ ] Cross-system validations
- [ ] Visual overlays (borders, icons)
- [ ] "Warnings only" filter

### Phase 6: Player Progress
- [ ] Player selector dropdown
- [ ] Player location on map
- [ ] Quest completion status on diagram
- [ ] Active objective highlighting

### Phase 7: Editing
- [ ] Edit button and modal
- [ ] YAML file writing
- [ ] Prototype hot reload
- [ ] Live UI updates

### Phase 8: Polish
- [ ] Keyboard shortcuts
- [ ] Minimap for world map
- [ ] Search/find functionality
- [ ] Export diagram as image

## Technical Notes

### SVG Pan/Zoom Implementation

Using a JS hook for smooth pan/zoom:

```javascript
// assets/js/hooks/world_map_hook.js
export const WorldMapHook = {
  mounted() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;

    this.el.addEventListener('wheel', this.handleZoom.bind(this));
    this.el.addEventListener('mousedown', this.startPan.bind(this));

    // Click handling - send to LiveView
    this.el.querySelectorAll('[data-room-id]').forEach(room => {
      room.addEventListener('click', () => {
        this.pushEvent('select_room', {id: room.dataset.roomId});
      });
    });
  },

  handleZoom(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.scale *= delta;
    this.updateTransform();
  },

  updateTransform() {
    const svg = this.el.querySelector('svg');
    svg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }
};
```

### Room Layout Algorithm

Using existing WorldGraph coordinates:

```elixir
defmodule Loka.Admin.WorldDesigner.Layout.RoomLayout do
  @cell_size 100  # pixels per grid cell
  @padding 50

  def layout_rooms(rooms) do
    rooms
    |> Enum.map(fn room ->
      coords = get_coordinates(room)
      %{
        id: room.id,
        key: room.key,
        x: coords.x * @cell_size + @padding,
        y: coords.y * @cell_size + @padding,
        # ... other room data
      }
    end)
  end
end
```

### Quest Layout Algorithm

Hierarchical layout for DAG:

```elixir
defmodule Loka.Admin.WorldDesigner.Layout.QuestLayout do
  @node_width 180
  @node_height 60
  @horizontal_gap 40
  @vertical_gap 80

  def layout_storyline(storyline) do
    # Group quests by act
    acts = group_by_act(storyline)

    # Position each act row
    acts
    |> Enum.with_index()
    |> Enum.flat_map(fn {{act, quests}, row} ->
      layout_act_row(quests, row)
    end)
  end

  defp layout_act_row(quests, row) do
    quests
    |> Enum.with_index()
    |> Enum.map(fn {quest, col} ->
      %{
        id: quest.id,
        x: col * (@node_width + @horizontal_gap),
        y: row * (@node_height + @vertical_gap),
        width: @node_width,
        height: @node_height
      }
    end)
  end
end
```

## References

- `docs/architecture/entity-system.md` - Entity-Component-Behavior pattern
- `docs/framework/quest-system.md` - Quest architecture
- `docs/framework/quest-listeners.md` - Hook-driven quest objectives
- `docs/architecture/storylines.md` - Storyline and act system
- `lib/loka/testing/content/` - Existing validators to reuse
