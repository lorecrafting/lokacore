# Loka World Builder - Master Design Document

**Status**: Planning
**Version**: 1.0
**Last Updated**: 2026-01-07

---

## Executive Summary

A Unity-style visual world builder for Loka MUD that transforms content creation from manual YAML editing to drag-and-drop 3D design with LLM assistance.

**Goal**: 10x faster world building with built-in validation and live preview.

**Timeline**: 6 months (24 weeks) across 3 tiers
- Tier 1 (Weeks 1-8): Essential building tools
- Tier 2 (Weeks 9-16): Power features
- Tier 3 (Weeks 17-24): LLM & validation
- Tier 4 (Future): Live ops (when you have players)

---

## Architecture Overview

### Core Philosophy

**Single Source of Truth**: TypedObject (your existing system)
- World Builder is a UI layer over TypedObject
- All edits write to YAML/database (existing storage)
- Zero changes to game engine required

**Integration Points**:
```
World Builder (LiveView + React)
    ↓ creates/edits
TypedObject (universal foundation)
    ↓ validates via
Existing Validators (quest, cutscene, dialogue, etc.)
    ↓ persists to
YAML Files + Database
    ↓ version control via
Git (auto-commit)
```

### Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Admin Shell** | Phoenix LiveView | Real-time, server-rendered, auth built-in |
| **3D Viewport** | React Three Fiber | Best-in-class 3D in React, declarative |
| **UI Components** | DaisyUI | Matches existing admin UI |
| **State Bridge** | LiveView PubSub | Sync LiveView ↔ React |
| **Layout** | D3-force-3d | Auto-layout algorithms |
| **LLM** | Anthropic Claude API | Content generation (streaming) |
| **Storage** | YAML + SQLite | Your existing system |
| **Validation** | Existing validators | quest_validator.ex, etc. |

### File Structure

```
server/
├── lib/loka_web/live/admin_live/
│   ├── world_builder.ex              # Main LiveView (replaces world_designer_tab.ex)
│   ├── world_builder/
│   │   ├── hierarchy_panel.ex        # Tree view (zones, rooms, NPCs, quests)
│   │   ├── inspector_panel.ex        # Property editor
│   │   ├── toolbar.ex                # Mode buttons (Edit, View, Test)
│   │   ├── console_panel.ex          # Validation output
│   │   ├── llm_chat.ex               # Claude chat interface
│   │   └── canvas_bridge.ex          # LiveView → React communication
│
├── assets/js/world_builder/
│   ├── WorldBuilderApp.jsx           # React root
│   ├── Scene3D.jsx                   # Three.js scene
│   ├── components/
│   │   ├── RoomNode3D.jsx            # 3D room cube
│   │   ├── ExitLine.jsx              # Connection line
│   │   ├── NPCMarker.jsx             # NPC icon in room
│   │   ├── ItemLabel.jsx             # Floating text
│   │   └── QuestFlow.jsx             # Quest visualization
│   ├── hooks/
│   │   ├── useLiveViewSync.js        # Sync with LiveView
│   │   ├── useSelection.js           # Selection state
│   │   └── useLayout.js              # Auto-layout
│   └── tools/
│       ├── MultiSelect.js            # Box select, lasso
│       ├── ExitCreator.js            # Drag to connect
│       └── TemplateInstantiator.js   # Drag template onto canvas
│
└── lib/loka/admin/world_builder/
    ├── llm_assistant.ex              # Claude API integration
    ├── template_manager.ex           # Load/save templates
    ├── layout_engine.ex              # Auto-layout algorithms
    └── validator_runner.ex           # Run all validators
```

---

## User Interface Design

### Unity-Style Docking Layout

```
┌──────────────────────────────────────────────────────────────┐
│ TOOLBAR (48px fixed)                                         │
│ [🏗️ Edit] [🔍 View] [🧪 Test] │ Search... │ [Filters ▼]     │
├──────────┬──────────────────────────────────────┬────────────┤
│          │                                      │            │
│ HIERARCHY│         3D VIEWPORT                  │ INSPECTOR  │
│ (250px)  │                                      │ (320px)    │
│          │   [Rooms as cubes]                   │            │
│ 🌍 Zones │   [Exits as lines]                   │ Selected:  │
│  └ Town  │   [NPCs as icons]                    │  tavern_bar│
│    └Bar  │   [Items as labels]                  │            │
│    └Shop │                                      │ Name: [__] │
│  └Forest│   [Camera controls]                  │ Desc: [__] │
│          │                                      │ Exits:     │
│ 📜 Quests│                                      │  north →   │
│  └Act1   │                                      │            │
│          │                                      │ [YAML ▼]   │
│          │                                      │            │
├──────────┴──────────────────────────────────────┴────────────┤
│ CONSOLE / VALIDATION (200px, collapsible)                    │
│ ⚠️ 3 warnings │ ✓ 0 errors │ [Run Validation]                │
│ • Room "tavern" missing description                          │
│ • Exit "north" points to non-existent room                   │
└──────────────────────────────────────────────────────────────┘
```

### Hierarchy Panel (Left)

**Tree View**:
```
🌍 World
├─ 🗺️ Zones (3)
│  ├─ 🏘️ Village (12 rooms)
│  │  ├─ 🏠 village_square
│  │  ├─ 🍺 tavern_bar
│  │  └─ 🛍️ general_store
│  ├─ 🌲 Dark Forest (8 rooms)
│  └─ 🏔️ Mountain Pass (5 rooms)
├─ 📜 Quests (15)
│  ├─ ⚠️ Broken quests (2)
│  └─ ✓ Valid quests (13)
├─ 👥 NPCs (45)
│  ├─ 🟢 Quest Givers (8)
│  └─ ⚔️ Enemies (37)
├─ 📦 Items (123)
└─ 🎬 Cutscenes (6)
```

**Actions**:
- Click → Select (highlights in 3D)
- Double-click → Edit
- Right-click → Context menu (Clone, Delete, Properties)
- Drag → Reorder or move to different parent

### Inspector Panel (Right)

**Context-Sensitive Properties**:

When room selected:
```
┌─────────────────────────┐
│ ROOM: tavern_bar        │
├─────────────────────────┤
│ Basic                   │
│ Name: [Prancing Pony  ] │
│ Type: [inn ▼]           │
│ Tags: [safe, indoor]    │
│                         │
│ Description             │
│ [Textarea with editor]  │
│                         │
│ Exits                   │
│ ├─ north → square       │
│ ├─ up → tavern_rooms    │
│ [+ Add Exit]            │
│                         │
│ Contents                │
│ NPCs:  [bartender]      │
│ Items: [table, chair]   │
│                         │
│ Scripts                 │
│ on_enter: [none ▼]      │
│ on_look:  [ambient ▼]   │
│                         │
│ [Show YAML] [Validate]  │
└─────────────────────────┘
```

### 3D Viewport (Center)

**Visual Elements**:
- **Rooms**: Cubes (color-coded by type)
- **Exits**: Lines (solid=bidirectional, dashed=one-way)
- **NPCs**: Icons above rooms
- **Items**: Floating text labels
- **Quests**: Purple dotted lines connecting rooms
- **Validation**: Red glow=error, yellow=warning, green=valid

**Interactions**:
- Click → Select
- Drag → Move room
- Ctrl+Drag → Pan camera
- Scroll → Zoom
- Right-click → Context menu
- Shift+Click → Add to selection

**Floating Tools** (bottom-right):
```
[2D] [3D] │ [Grid ☑] [Snap ☑] │ [Reset View]
```

### Console Panel (Bottom)

**Tabs**: `[Validation] [Logs] [LLM Chat]`

**Validation Tab**:
```
Errors: 2    Warnings: 5    Info: 0

❌ Quest "dragon_hunt" → NPC "dragon" not found
❌ Room "secret_cave" unreachable from spawn
⚠️ Room "tavern" description too short (15 chars)
⚠️ NPC "merchant" has no items to sell
⚠️ Item "legendary_sword" drop rate > 50% (too high)

[Auto-Fix Safe Issues] [Export Report] [Run Full Validation]
```

---

## Feature Tiers

### Tier 1: Essential Building Tools (Weeks 1-8) 🔥 CRITICAL

**Room CRUD**:
- Create room (wizard or click canvas)
- Edit all properties (inspector panel)
- Delete with safety checks ("3 exits point here - redirect?")
- Drag to reposition in 3D
- Undo/redo stack (20 actions)

**Exit Management**:
- Visual exit creator (drag line between rooms)
- Auto-connect mode (snap adjacent rooms)
- Bidirectional toggle
- Exit types: normal, locked, hidden, conditional

**Multi-Select & Batch Operations**:
- Box select, lasso select, filter select
- Batch edit properties
- Clone & offset
- Delete multiple
- Mirror/flip selection

**Templates**:
- Built-in room templates (tavern, shop, dungeon, boss room)
- Zone templates (village, forest, dungeon)
- Custom templates (save your own)
- Drag template onto canvas to instantiate

**Basic Validation**:
- Real-time validation as you build
- Visual indicators (green/yellow/red glow)
- Error list in console
- Click error → jump to problem entity

### Tier 2: Power Features (Weeks 9-16) ⚡ HIGH VALUE

**NPC/Item Building**:
- NPC placement in 3D (drag onto room)
- NPC templates (quest giver, merchant, enemy, boss)
- Item placement and loot tables
- Visual loot table editor (pie chart)

**Quest Builder**:
- Step-by-step quest wizard
- Visual quest flow editor (node-based)
- Quest templates (fetch, kill, escort, discovery)
- Live quest simulation ("Can level 5 player complete?")

**Cutscene Builder**:
- Timeline editor (drag steps to reorder)
- Sequence types: dialogue, narration, fade, choice, sound, animation
- Trigger types: enter_room, quest_complete, talk_to
- Effects: set_flag, give_item, teleport, start_quest
- LLM: "Create a ghost encounter cutscene"

**Auto-Layout Algorithms**:
- Force-directed (organic spread)
- Grid align (orthogonal)
- Hierarchical (tree-like)
- Circular/radial (hub-and-spoke)
- Layered (by Z-axis for multi-level dungeons)

**Zone Management**:
- Zones as containers for rooms
- Drag rooms between zones
- Zone-level operations ("Set all rooms in zone to level 5-10")
- Collapse/expand zones in hierarchy

### Tier 3: LLM & Quality Assurance (Weeks 17-24) 🤖 SPEED BOOST

**LLM Integration**:
- Chat panel for natural language commands
- Context awareness (current zone, nearby rooms)
- Content generation:
  - Single room: "Create a blacksmith shop"
  - Room cluster: "Generate a 5-room haunted mansion"
  - NPCs: "Make a grumpy dwarf merchant"
  - Quests: "Create a 3-quest chain about saving the village"
  - Cutscenes: "Ghost encounter with choices"
  - Dialogue trees
  - Scripts: "Trap that teleports the player"
- Preview system (translucent blue, accept/reject)
- Iterative refinement ("Make it harder", "More atmospheric")
- Toggle LLM on/off (always optional)

**Advanced Validation**:
- Dependency graph analysis (detect circular deps)
- Playability simulation (virtual player attempts quest)
- Content quality checks (LLM-assisted grammar, lore consistency)
- Semantic validation ("Dark zone with humorous description?")
- Cross-entity validation (orphan detection, balance checks)
- Exportable reports (share with team)

**Visual Scripting** (Optional):
- Node-based script editor (no code required)
- Trigger nodes (on_enter, on_look, on_combat_start)
- Condition nodes (has_quest, has_item, level >= X)
- Action nodes (message, spawn_npc, give_item, teleport)
- Compile to Elixir (sandboxed)

### Tier 4: Live Ops (Future - NOT NOW) 🔵 LATER

**Only implement after you have players!**

- Real-time player monitoring (avatars in 3D view)
- Performance analytics (heatmaps, bottlenecks)
- Player management tools (inspect, teleport, kick)
- Hot deployment pipeline (staging → production)
- Admin action logging and audit trail

---

## Content Types

Your system already supports all these via TypedObject:

| Type | Subtype | Storage | Builder Support |
|------|---------|---------|-----------------|
| **Entity** | `:room` | YAML | ✅ Full CRUD |
| **Entity** | `:npc` | YAML | ✅ Full CRUD |
| **Entity** | `:item` | YAML | ✅ Full CRUD |
| **Entity** | `:exit` | YAML | ✅ Visual creator |
| **Quest** | - | YAML | ✅ Wizard + visual flow |
| **Dialogue** | - | YAML | ✅ Tree editor |
| **Script** | - | Database | ✅ Code + visual editor |
| **Zone** | - | YAML | ✅ Container management |
| **Cutscene** | - | YAML | ✅ Timeline editor |

---

## Validation System

### Existing Validators (Already Built!)

You have comprehensive validation:
- `Loka.Testing.Content.QuestValidator`
- `Loka.Testing.Content.CutsceneValidator`
- `Loka.Testing.Content.DialogueValidator`
- `Loka.Testing.Content.WorldValidator`
- `Loka.Testing.Content.PrototypeLinter`
- `Loka.Testing.Content.ReachabilityAnalyzer`

**World Builder Integration**:
```elixir
# Run all validators
{:ok, results} = Loka.Admin.WorldBuilder.ValidatorRunner.run_all()

# results
%{
  rooms: %{errors: 2, warnings: 5},
  quests: %{errors: 0, warnings: 3},
  cutscenes: %{errors: 1, warnings: 0},
  scripts: %{errors: 0, warnings: 2}
}
```

Display in console panel with click-to-jump.

### Real-Time Validation

Validate as you build:
- Room created → Instant check
- Exit added → Verify both ends exist
- Quest objective → Validate target exists
- Script attached → Syntax + security check

Visual feedback in 3D:
- Green glow: Valid
- Yellow glow: Warnings
- Red glow: Errors (must fix)

---

## LLM Integration: Tidewave-Style Embedded Claude

### Architecture Pattern

**Inspiration**: Tidewave, Cursor, Windsurf - Claude embedded directly in the UI with tool access.

**NOT using**:
- ❌ MCP (Model Context Protocol) - too complex
- ❌ External CLI - requires context switching
- ❌ Separate chat window - breaks flow

**Using**:
- ✅ Embedded chat panel in World Builder UI
- ✅ Claude calls tools to modify world in real-time
- ✅ Changes appear immediately in 3D viewport
- ✅ All in browser, no terminal needed

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│ World Builder UI (Browser)                          │
│  ┌──────────┬─────────────┬──────────┐              │
│  │Hierarchy │ 3D Viewport │Inspector │              │
│  │          │ [Selected:  │          │              │
│  │          │  5 rooms]   │          │              │
│  └──────────┴─────────────┴──────────┘              │
│  ┌─────────────────────────────────────────┐        │
│  │ 💬 Claude Chat Panel            [⚙️]    │        │
│  │ ────────────────────────────────────    │        │
│  │ You: Fix validation errors in these     │        │
│  │      selected rooms                      │        │
│  │                                          │        │
│  │ Claude: I see 5 rooms with errors:      │        │
│  │ • forest_path: missing exit              │ ◄──────┼── Anthropic API
│  │ • goblin_camp: empty description         │        │   Streaming
│  │                                          │        │
│  │ [🔧 Calling: update_room(...)]           │        │
│  │ ✓ Fixed forest_path                      │        │
│  │ [🔧 Calling: update_room(...)]           │        │
│  │ ✓ Fixed goblin_camp                      │        │
│  └─────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
                      ↓
       Rooms flash green in 3D as Claude fixes them
       (real-time via Phoenix PubSub)
```

### Flow Diagram

```
User types message in chat panel
    ↓
Frontend: POST /api/world-builder/claude
    ↓
Backend: Build context from LiveView session
    │ - Current selection (rooms/NPCs/items)
    │ - Validation errors
    │ - Zone context
    │ - Existing keys (prevent duplicates)
    ↓
Backend: Call Anthropic API with tools
    │ - Stream: true (real-time responses)
    │ - Tools: update_room, create_room, create_npc, etc.
    │ - System prompt includes context
    ↓
Claude generates response + tool calls
    ↓
Backend: Execute tool calls
    │ - POST /api/world-builder/tools/update_room
    │ - Validate changes
    │ - Broadcast via PubSub
    ↓
Frontend: LiveView receives PubSub event
    ↓
3D Viewport: Room flashes green, updates in real-time
    ↓
Chat Panel: Shows "✓ Updated forest_path"
```

### Available Tools

Claude has access to these tools (via Anthropic Tool Use):

```elixir
tools = [
  %{
    name: "update_room",
    description: "Update room properties (name, description, exits, tags)",
    input_schema: %{
      type: "object",
      properties: %{
        room_key: %{type: "string"},
        changes: %{type: "object"}  # name, description, exits, etc.
      }
    }
  },
  %{
    name: "create_room",
    description: "Create a new room in the current zone",
    input_schema: %{
      type: "object",
      properties: %{
        key: %{type: "string"},
        name: %{type: "string"},
        description: %{type: "string"},
        coordinates: %{type: "object"}  # {x, y, z}
      }
    }
  },
  %{
    name: "create_npc",
    description: "Create an NPC in a room",
    input_schema: %{
      type: "object",
      properties: %{
        key: %{type: "string"},
        room_key: %{type: "string"},
        name: %{type: "string"},
        description: %{type: "string"},
        level: %{type: "integer"}
      }
    }
  },
  %{
    name: "create_item",
    description: "Create an item",
    input_schema: %{type: "object"}
  },
  %{
    name: "add_exit",
    description: "Connect two rooms with an exit",
    input_schema: %{
      type: "object",
      properties: %{
        from_room: %{type: "string"},
        to_room: %{type: "string"},
        direction: %{type: "string"}  # north, south, east, west, up, down
      }
    }
  },
  %{
    name: "run_validation",
    description: "Run validation on specific objects",
    input_schema: %{
      type: "object",
      properties: %{
        object_keys: %{type: "array", items: %{type: "string"}}
      }
    }
  }
]
```

### Context Injection

System prompt automatically includes:

```elixir
# Built from LiveView session state
context = %{
  zone: %{
    id: "forest",
    name: "Whispering Forest",
    room_count: 42
  },
  selection: [
    %{key: "forest_path", name: "Forest Path", coordinates: {5, 3, 0}},
    %{key: "goblin_camp", name: "Goblin Camp", coordinates: {6, 3, 0}}
  ],
  validation_errors: [
    %{
      object_key: "forest_path",
      severity: :error,
      message: "Exit 'north' points to non-existent room 'village_gate'"
    },
    %{
      object_key: "goblin_camp",
      severity: :warning,
      message: "Description is empty"
    }
  ],
  nearby_rooms: ["dark_cave", "river_crossing", "old_bridge"],
  existing_keys: ["forest_path", "goblin_camp", "dark_cave", ...]  # Prevent duplicates
}
```

System prompt template:
```
You are helping build a MUD world in the Loka World Builder.

CURRENT CONTEXT:
Zone: {{zone.name}} ({{zone.room_count}} rooms)

Selected Rooms:
{{#each selection}}
- {{key}}: "{{name}}" at ({{coordinates}})
{{/each}}

Validation Errors:
{{#each validation_errors}}
- {{object_key}}: {{message}} ({{severity}})
{{/each}}

You have tools to modify the world. Use them to make the requested changes.
Always validate after changes using the run_validation tool.
```

### User Experience Examples

**Example 1: Fix Validation Errors**
```
User selects 3 rooms with red glow → types "Fix these errors"

Claude: I can see 3 validation errors:
• forest_path: Invalid exit to 'village_gate' (doesn't exist)
• goblin_camp: Empty description
• dark_cave: NPC 'bat_swarm' doesn't exist

[🔧 Calling: update_room(forest_path, {exits: {...}})]
✓ Removed invalid exit from forest_path

[🔧 Calling: update_room(goblin_camp, {description: "..."})]
✓ Added description to goblin_camp

[🔧 Calling: create_npc(bat_swarm, ...)]
✓ Created missing NPC in dark_cave

[🔧 Calling: run_validation([forest_path, goblin_camp, dark_cave])]
✓ All validation errors fixed!

User sees: Rooms flash green in 3D, red glow → green glow
```

**Example 2: Expand Zone**
```
User clicks empty space east of zone → types "Create a haunted graveyard here"

Claude: I'll create a haunted graveyard east of your current zone.

[🔧 Calling: create_room(graveyard_entrance, ...)]
Created 'Graveyard Entrance' at (8, 0, 0)

[🔧 Calling: create_room(graveyard_center, ...)]
Created 'Graveyard Center' at (9, 0, 0)

[🔧 Calling: create_room(crypt, ...)]
Created 'Ancient Crypt' at (9, 1, 0)

[🔧 Calling: add_exit(forest_edge, graveyard_entrance, east)]
Connected forest → graveyard

[🔧 Calling: create_npc(restless_spirit, graveyard_center, ...)]
Created ghost NPC 'Restless Spirit'

✓ Haunted graveyard complete! 3 rooms + 1 NPC added.

User sees: 3 cubes fade in with animation, exits draw themselves
```

**Example 3: Multi-Turn Conversation**
```
User: Create a dark forest room
Claude: [creates room with spooky description]

User: Make it darker
Claude: [updates description to be more ominous]

User: Add a ghost NPC
Claude: [creates ghost NPC in that room]

User: Give it a scary dialogue tree
Claude: [creates dialogue tree with eerie options]

Context preserved across all turns!
```

### Real-Time Updates

When Claude calls a tool, changes appear instantly:

```jsx
// Frontend: Subscribe to PubSub
useEffect(() => {
  const channel = socket.channel('world_builder:updates')

  channel.on('room_created', (room) => {
    // Add to 3D scene with animation
    addRoomWithAnimation(room)
  })

  channel.on('room_updated', (room) => {
    // Flash green
    flashRoom(room.key, 'green', 500)
    updateRoomInScene(room)
  })

  channel.join()
}, [])
```

### Cost Controls

- **Budget limit**: $50/month (configurable per user)
- **Max tokens per request**: 4,000
- **Rate limiting**: 20 requests/hour (backend enforced)
- **Cost tracker**: Shows "150 tokens / 50,000 budget" in UI
- **Toggle on/off**: Settings gear in chat panel
- **Alert at 80%**: "Warning: 80% of monthly budget used"

### Advanced Features (Week 23-24)

- **Style presets**: "Medieval Fantasy" | "Cyberpunk" | "Cosmic Horror"
- **Preset prompts**: Quick actions dropdown
- **Template learning**: "Create 3 more rooms like these 5"
- **Multi-turn memory**: Conversation persists across refreshes
- **Undo/redo**: Reverse tool calls
- **Export conversation**: Download chat history

### Implementation Files

**Backend**:
```
lib/loka_web/controllers/world_builder/
├── claude_controller.ex         # Proxy to Anthropic API
│   - POST /api/world-builder/claude
│   - Streams responses via SSE
│   - Builds context from LiveView session
│   - Handles tool execution pipeline
│
└── tools_controller.ex          # Tool execution endpoints
    - POST /api/world-builder/tools/update_room
    - POST /api/world-builder/tools/create_room
    - POST /api/world-builder/tools/create_npc
    - POST /api/world-builder/tools/create_item
    - POST /api/world-builder/tools/add_exit
    - POST /api/world-builder/tools/run_validation

lib/loka/world_builder/claude/
├── context_builder.ex           # Builds system prompt context
├── conversation_manager.ex      # Persists chat history
├── style_presets.ex             # Style prompt templates
└── cost_tracker.ex              # Budget tracking
```

**Frontend**:
```
assets/js/world_builder/panels/
├── ClaudePanel.jsx              # Main chat UI
│   - Message display (streaming)
│   - Tool call visualization
│   - Cost tracker
│   - Settings gear
│
├── ClaudePanel/
│   ├── MessageList.jsx          # Chat history
│   ├── ToolCallDisplay.jsx      # "🔧 Calling: update_room..."
│   ├── StylePresets.jsx         # Style dropdown
│   ├── PresetPrompts.jsx        # Quick actions
│   └── Settings.jsx             # Toggle, budget limits
```

**Database Migration**:
```elixir
# priv/repo/migrations/xxx_create_world_builder_conversations.exs
defmodule Loka.Repo.Migrations.CreateWorldBuilderConversations do
  use Ecto.Migration

  def change do
    create table(:world_builder_conversations) do
      add :user_id, references(:users), null: false
      add :messages, :jsonb, null: false  # Chat history
      add :context, :jsonb                # Zone, selection at time
      add :cost_tokens, :integer, default: 0

      timestamps()
    end
  end
end
```

**Environment Variables**:
```bash
# .env or fly.toml secrets
ANTHROPIC_API_KEY=sk-ant-...
```

**Dependencies**:
```elixir
# mix.exs
defp deps do
  [
    # ... existing deps
    {:anthropic, "~> 0.2"},  # Anthropic SDK for Elixir
    {:jason, "~> 1.4"}       # JSON (already included)
  ]
end
```

---

## Future-Proofing

### Player Housing Integration

World Builder supports **two modes**:

**God Mode** (Admins):
- Create entire worlds
- Set spawn rates, loot tables
- Design quests, NPCs, cutscenes

**Player Mode** (In-Game):
- Subset of tools for player housing
- Restricted placement (only in owned plots)
- Templates for furniture, decorations
- Shared building permissions (co-op towns)

**Implementation**: Same UI, different permissions layer
```elixir
if user.role == :admin do
  # Full access
else
  # Restricted to owned plots
  # Limited entity types (furniture, decorations, not NPCs)
end
```

### Social/Cooperative Features

- **Collaborative editing**: See other admins' cursors (LiveView Presence)
- **Shared zones**: Multiple admins can edit same zone
- **Permission system**: "Let Alice edit my town's shops"
- **Template marketplace**: Share custom buildings/rooms
- **Comments**: Leave notes on entities ("TODO: Balance this boss")

### De-Emphasized Grinding Support

LLM trained to generate:
- **Meaningful quests**: Story-driven, not "kill 10 rats"
- **Exploration rewards**: Discovery XP, hidden lore
- **Social hubs**: Gathering spaces, not just combat zones
- **Crafting/building**: Peaceful progression paths
- **Calm, cozy content**: Tea ceremonies, stargazing, gardening

---

## Success Metrics

### Builder Efficiency
- **Time to create 10-room zone**:
  - Before: 2 hours (manual YAML)
  - After: 20 minutes (LLM + visual tools)
- **Error rate**:
  - Before: 15% of content has bugs
  - After: <2% (validation catches most)
- **Content reuse**: 60% uses templates/LLM

### World Quality
- **Validation coverage**: 100% before deploy
- **Player-reported bugs**:
  - Before: 5 bugs/week
  - After: <1 bug/week
- **Content consistency**: Naming, balance, lore checks pass

### Ease of Learning
- **Onboarding time**:
  - Before: 1 week to learn YAML
  - After: 1 hour with visual tools
- **Builder satisfaction**: NPS >8/10
- **Feature adoption**: 80% use LLM, 90% use validation

---

## Implementation Strategy

See `IMPLEMENTATION_ROADMAP.md` for detailed week-by-week plan.

**Phase 1** (Weeks 1-4): Foundation (Unity UI + basic 3D)
**Phase 2** (Weeks 5-8): Core editing tools
**Phase 3** (Weeks 9-12): Power features (NPCs, quests)
**Phase 4** (Weeks 13-16): Advanced building (cutscenes, layout)
**Phase 5** (Weeks 17-20): LLM integration
**Phase 6** (Weeks 21-24): Validation & polish

---

## Appendices

### A. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| N | New room |
| Del | Delete selected |
| Ctrl+D | Duplicate |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| E | Edit selected |
| F2 | Rename |
| Ctrl+F | Search |
| Ctrl+S | Save |
| Arrows | Nudge (1 unit) |
| Shift+Arrows | Nudge (10 units) |

### B. Visual Design Guidelines

**Color Coding**:
- Rooms: By type (green=safe, red=dangerous, blue=dungeon, yellow=town)
- NPCs: Green=quest giver, red=enemy, blue=merchant, gray=ambient
- Items: Yellow labels
- Quests: Purple lines
- Validation: Green=valid, yellow=warning, red=error

**3D Aesthetics**:
- Minimalist, semantic (cubes, not detailed 3D models)
- Performance over photorealism (60 FPS on admin tool)
- Clear labels (always readable)
- Depth cues (shadows, size scaling)

### C. Testing Strategy

**Unit Tests**:
- Validator integration
- YAML generation from UI
- Template instantiation

**Integration Tests**:
- LiveView ↔ React bridge
- LLM API calls (mocked)
- Git auto-commit

**User Testing**:
- Non-technical builder onboarding (observe, collect feedback)
- Power user workflow (measure time savings)
- LLM quality assessment (manual review of generated content)

---

**Document Maintainers**: @raymondluong, @claude
**Last Review**: 2026-01-07
**Next Review**: After Phase 1 completion
