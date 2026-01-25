# World Builder - Comprehensive Implementation Plan

**Version**: 4.0
**Created**: 2026-01-15
**Status**: Ready for Implementation
**Timeline**: 10-11 weeks

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Decisions](#2-design-decisions)
3. [Architecture Overview](#3-architecture-overview)
4. [UI/UX Specifications](#4-uiux-specifications)
5. [Feature Specifications](#5-feature-specifications)
6. [Scripts System](#6-scripts-system)
7. [LLM Integration](#7-llm-integration)
8. [Data Models](#8-data-models)
9. [Implementation Phases](#9-implementation-phases)
10. [Testing Strategy](#10-testing-strategy)
11. [File Structure](#11-file-structure)
12. [API Reference](#12-api-reference)

---

## 1. Executive Summary

### 1.1 Vision
A comprehensive LLM-assisted world building tool for non-technical content creators ("builders") that enables rapid creation of MUD game content through both manual UI controls and natural language commands.

### 1.2 Key Principles
1. **LLM-First but Not LLM-Only** - Full functionality without LLM, enhanced with LLM
2. **Real-time Feedback** - Immediate validation and visual updates
3. **Builder-Friendly** - Non-technical users can create content including scripts
4. **Future-Ready** - Architecture supports multi-admin collaboration

### 1.3 Current State (Pre-Implementation)

| Component | Status | Notes |
|-----------|--------|-------|
| 3D Viewport | ✅ Working | React Three Fiber, room cubes, exit lines |
| Room CRUD | 🟡 Bug | Create/delete work, **update broken for DB rooms** |
| NPC/Item CRUD | ✅ Working | EntityManager functional |
| Quest CRUD | ✅ Working | YAML persistence |
| Dialogue | ✅ Working | 24 dialogues validated |
| Cutscene CRUD | ✅ Working | YAML persistence, no runtime |
| Scripts | 🟡 Read-only | View source only, no create/edit UI |
| LLM Chat | 🔴 Missing | Backend modules exist, no UI |
| Undo/Redo | 🔴 Missing | Not implemented |
| Git Integration | 🔴 Missing | Not implemented |

### 1.4 Target State (Post-Implementation)

| Component | Target |
|-----------|--------|
| All Entity CRUD | ✅ Full create/read/update/delete with validation |
| Scripts | ✅ Full editor + 15 templates for common patterns |
| LLM Chat | ✅ Streaming responses, tool execution, cost tracking |
| Undo/Redo | ✅ 50-action stack with Ctrl+Z/Ctrl+Y |
| Validation | ✅ Real-time + visual glow on cubes |
| Viewport | ✅ Icons inside cubes for NPCs/items |
| Git | ✅ Manual commit with diff preview |
| Authentication | ✅ BYOK (Bring Your Own Key) |

### 1.5 Timeline Summary

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 2 weeks | Bug fixes, undo/redo, validation, icons |
| Phase 2 | 2 weeks | LLM chat panel, tool execution |
| Phase 3 | 2 weeks | Entity editors (quest, dialogue, cutscene) |
| Phase 4 | 2-3 weeks | **Scripts system + templates** |
| Phase 5 | 2 weeks | Git integration, polish, testing |
| **Total** | **10-11 weeks** | Production-ready |

---

## 2. Design Decisions

### 2.1 Content Style
**Tone**: Clear, informative, lighthearted, light-giving

Claude generates content that is:
- **Clear**: Easy to understand, no purple prose
- **Informative**: Useful descriptions that help gameplay
- **Lighthearted**: Warm and welcoming, not grimdark
- **Light-giving**: Hopeful, positive undertones even in challenges

**Example room description**:
> *"Sunlight filters through paper screens, casting warm patterns across the meditation hall's worn wooden floor. The faint scent of incense lingers in the air, and somewhere a wind chime sings softly."*

### 2.2 Naming Conventions
**Pattern**: `{zone}_{descriptive_name}`

| Entity Type | Example Keys |
|-------------|--------------|
| Room | `monastery_kitchen`, `forest_clearing`, `graveyard_crypt` |
| NPC | `monastery_elder_monk`, `forest_wandering_spirit` |
| Item | `monastery_prayer_beads`, `graveyard_ancient_key` |
| Quest | `intro_welcome`, `main_find_master`, `side_lost_item` |
| Script | `graveyard_crypt_on_enter`, `elder_monk_on_look` |

**Rules**:
- Lowercase letters, numbers, underscores only
- Zone prefix for rooms, NPCs, items, scripts
- Quest prefix by type (intro_, main_, side_, daily_)
- Max 50 characters

### 2.3 Zone System
**Implementation**: Tags on rooms (e.g., `tags: ["monastery", "indoor"]`)

Zones are organizational via tags, not separate entities. Future: visual grouping in viewport by tag filters.

### 2.4 Exit System
**Default**: Bidirectional exits (creates reverse automatically)
**Future**: Special exits (locked doors, portals, conditional)

### 2.5 Validation Strategy

| Timing | Behavior |
|--------|----------|
| Real-time | Validate on every change, show warnings inline |
| On Save | Block save if critical errors exist |
| Visual | Red glow = error, yellow = warning, green flash = valid |

### 2.6 Authentication
**Model**: BYOK (Bring Your Own Key)

- User provides Anthropic API key
- Stored encrypted in browser localStorage
- API calls made client-side (no server proxy needed for auth)
- User pays their own API costs

**Rationale**: Anthropic blocked OAuth for third-party apps (Jan 2026).

### 2.7 Git Integration
**Manual commit button** with:
1. Diff preview (what files changed)
2. Auto-generated commit message (editable)
3. Commit only (no auto-push)
4. Separate push button

### 2.8 Scripts Philosophy
**Goal**: Non-technical builders can create dynamic content

**Approach**:
- **Templates**: 15 pre-built script patterns for common use cases
- **Full Editor**: Code editor for advanced users
- **LLM Generation**: Claude can write scripts (with validation)
- **Sandbox**: All scripts run in restricted environment

---

## 3. Architecture Overview

### 3.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Phoenix LiveView                                 │   │
│  │  ┌──────────┬─────────────────────┬───────────┬──────────────────┐  │   │
│  │  │Hierarchy │      Viewport       │ Inspector │    Chat Panel    │  │   │
│  │  │  Panel   │   (React Three)     │   Panel   │   (LLM Chat)     │  │   │
│  │  └──────────┴─────────────────────┴───────────┴──────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              JavaScript Layer                                        │   │
│  │  - React Three Fiber (3D viewport)                                  │   │
│  │  - Anthropic Client (BYOK, streaming)                               │   │
│  │  - Monaco Editor (script editing)                                   │   │
│  │  - UndoManager (action stack)                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                         WebSocket (LiveView)
                                     │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WorldBuilderLive                                  │   │
│  │  - Panel state management                                           │   │
│  │  - Selection state                                                  │   │
│  │  - Event handlers for all CRUD                                      │   │
│  │  - Tool execution for LLM                                           │   │
│  │  - PubSub broadcasts                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    World Builder Managers                            │   │
│  │  ┌────────────┬────────────┬────────────┬────────────┬────────────┐ │   │
│  │  │   Room     │   Entity   │   Quest    │  Cutscene  │  Template  │ │   │
│  │  │  Manager   │  Manager   │  Manager   │  Manager   │  Manager   │ │   │
│  │  └────────────┴────────────┴────────────┴────────────┴────────────┘ │   │
│  │  ┌────────────┬────────────┬────────────┐                           │   │
│  │  │  Script    │ Validation │    Git     │                           │   │
│  │  │  Manager   │  Manager   │  Manager   │  ← NEW                    │   │
│  │  └────────────┴────────────┴────────────┘                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Engine Layer                                      │   │
│  │  - TypedObject / Registry (YAML entities)                           │   │
│  │  - Entity / Ecto (database entities)                                │   │
│  │  - Script Sandbox (execution)                                       │   │
│  │  - Script Validator (security)                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │   priv/world/*.yml   │  │      SQLite DB       │                        │
│  │   (YAML files)       │  │  (dynamic entities)  │                        │
│  └──────────────────────┘  └──────────────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

**Create Entity (UI)**:
```
User fills form → LiveView event → Manager.create() → YAML/DB write → PubSub broadcast → UI update
```

**Create Entity (LLM)**:
```
User message → Anthropic API → Tool call → LiveView event → Manager.create() → PubSub → UI update
```

**Undo**:
```
Ctrl+Z → UndoManager.undo() → Get inverse action → LiveView event → Manager (reverse) → UI update
```

---

## 4. UI/UX Specifications

### 4.1 Main Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR (48px)                                                               │
│ [Undo][Redo] | [Edit][View][Test] | 🔍 Search | [Zone▼] | [Commit] | [⚙️]   │
├───────────┬────────────────────────────────────┬──────────┬───────────────────┤
│ HIERARCHY │           3D VIEWPORT              │ INSPECTOR│   💬 CHAT        │
│ (200px)   │           (flex)                   │ (260px)  │   (320px)        │
│ [◀]       │                                    │ [▶]      │   [▶]            │
│           │                                    │          │                  │
│ 🔍 Filter │    ┌─────┐   ┌─────┐               │ 📝 Room  │ ┌──────────────┐ │
│           │    │ 👤  │───│ 👤  │               │ ──────── │ │ Context:     │ │
│ ▼ Rooms   │    │ 📦  │   │     │               │          │ │ Zone: forest │ │
│ ▼ NPCs    │    └──┬──┘   └─────┘               │ Key:     │ │ Selected: 2  │ │
│ ▼ Items   │       │                            │[________]│ │ Errors: 1    │ │
│ ▼ Quests  │    ┌──┴──┐                         │          │ └──────────────┘ │
│ ▼ Dialogues    │ 🏠  │                         │ Name:    │                  │
│ ▼ Cutscenes    └─────┘                         │[________]│ Claude:          │
│ ▼ Scripts │                                    │          │ I'll create...   │
│           │   ┌────────────────────────────┐   │ [YAML ▼] │                  │
│ [+ Create]│   │ ⚠️ 1 error [Validate]      │   │[Validate]│ [🔧 create_room] │
│           │   └────────────────────────────┘   │ [Delete] │ ✓ Done           │
│           │   [2D/3D] [Grid] [Fit]             │          │                  │
│           │                                    │          │ Tokens: 1,234    │
│           │                                    │          │ Cost: $0.02      │
│           │                                    │          │ [Type message...] │
└───────────┴────────────────────────────────────┴──────────┴───────────────────┘
```

### 4.2 Panel Specifications

#### 4.2.1 Toolbar

| Element | Behavior |
|---------|----------|
| Undo (Ctrl+Z) | Undo last action, disabled when stack empty |
| Redo (Ctrl+Y) | Redo last undone action |
| Mode buttons | Edit (default), View (read-only), Test (simulation) |
| Search | Global fuzzy search all entities by name/key |
| Zone dropdown | Filter hierarchy and viewport by zone tag |
| Commit | Opens git commit modal with diff |
| Settings gear | API key config, model selection, preferences |

#### 4.2.2 Hierarchy Panel

| Element | Behavior |
|---------|----------|
| Filter input | Real-time filter by name/key |
| Category headers | Collapsible, show count badge |
| Entity rows | Click=select, double-click=edit, right-click=context menu |
| Validation icons | ⚠️ warning, ❌ error badge on row |
| Create button | Dropdown: Room, NPC, Item, Quest, Dialogue, Cutscene, Script |
| Collapse [◀] | Shrink to 40px icons-only mode |

#### 4.2.3 Viewport

| Element | Behavior |
|---------|----------|
| Room cubes | 3D boxes at x,y,z coordinates |
| Icons inside cubes | 👤 = NPC, 📦 = item (stacked if multiple) |
| Exit lines | Arrows between rooms (double-arrow = bidirectional) |
| Selection | Click=select, Shift+click=multi, drag=box select |
| Camera | Scroll=zoom, right-drag=orbit, middle-drag=pan |
| Validation glow | Red=error, yellow=warning, green flash=success |
| Console inline | "⚠️ N errors" badge, click to expand |
| Controls | 2D/3D toggle, Grid toggle, Fit-to-selection |

#### 4.2.4 Inspector Panel

| Element | Behavior |
|---------|----------|
| Entity header | Type icon + key |
| Property form | Context-sensitive fields based on entity type |
| Exit editor | For rooms: list of exits with add/remove |
| Contents list | For rooms: NPCs and items inside |
| Scripts list | For rooms/NPCs: attached scripts |
| Validate button | Run validation on selected entity |
| Clone button | Duplicate with new key prompt |
| Delete button | Delete with confirmation |
| YAML toggle | Show raw YAML (read-only) |

#### 4.2.5 Chat Panel

| Element | Behavior |
|---------|----------|
| Context summary | Current zone, selection count, error count |
| Message history | Scrollable conversation, user/Claude alternating |
| Tool calls | [🔧 tool_name] with ✓/❌ result |
| Input | Multi-line, Enter=send, Shift+Enter=newline |
| Model selector | Dropdown: Opus 4.5 (default), Sonnet, Haiku |
| Token counter | Tokens used this message |
| Cost display | Estimated cost this message, session total |

### 4.3 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save (trigger validation) |
| `Delete` | Delete selected |
| `Ctrl+D` | Duplicate selected |
| `Ctrl+A` | Select all in viewport |
| `Escape` | Deselect all |
| `1` | Toggle hierarchy panel |
| `2` | Toggle inspector panel |
| `3` | Toggle chat panel |
| `~` | Toggle console |
| `F` | Fit viewport to selection |
| `G` | Toggle grid |
| `/` | Focus search |
| `N` | New entity (opens create dropdown) |

### 4.4 Color Scheme

| Element | Color | Hex |
|---------|-------|-----|
| Room cube default | Light gray | `#E5E7EB` |
| Selected outline | Blue | `#3B82F6` |
| Multi-select outline | Orange | `#F97316` |
| Error glow | Red | `#EF4444` |
| Warning glow | Yellow | `#F59E0B` |
| Success flash | Green | `#10B981` |
| NPC icon | Purple | `#8B5CF6` |
| Item icon | Yellow | `#EAB308` |
| Script badge | Cyan | `#06B6D4` |

---

## 5. Feature Specifications

### 5.1 Priority Levels

- **P0**: Must have for MVP
- **P1**: High priority, MVP+
- **P2**: Medium priority, post-MVP
- **P3**: Future enhancement

### 5.2 Feature List

#### 5.2.1 Core Infrastructure (P0)

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| CORE-001 | Fix room update bug | RoomManager.update_room checks both Registry and DB | Update works for YAML and DB rooms |
| CORE-002 | Undo/redo system | 50-action stack with keyboard shortcuts | Ctrl+Z undoes, Ctrl+Y redoes any action |
| CORE-003 | Real-time validation | Validate on every change | Errors show <500ms after change |
| CORE-004 | Validation glow | Visual glow on cubes by state | Red/yellow/green glow visible |
| CORE-005 | Viewport icons | NPC/item icons inside room cubes | Icons render correctly |
| CORE-006 | Panel collapse | All panels collapsible | Click [◀] collapses to 40px |

#### 5.2.2 LLM Integration (P0)

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| LLM-001 | Chat panel UI | Vertical chat panel with messages | Messages display, scroll works |
| LLM-002 | API key config | Settings modal for BYOK | Key saved to localStorage |
| LLM-003 | Streaming responses | Real-time text streaming | Text appears word-by-word |
| LLM-004 | Tool execution | Execute Claude tool calls | Tools create/update entities |
| LLM-005 | Context builder | Build system prompt with context | Selection, zone, errors included |
| LLM-006 | Cost tracking | Token and cost display | Accurate token count, cost calc |
| LLM-007 | Model selector | Choose Opus/Sonnet/Haiku | Model switch works |
| LLM-008 | Conversation history | Session-persistent history | History survives refresh |

#### 5.2.3 Entity Editors (P1)

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| EDIT-001 | Room editor | Full form for room properties | All fields editable |
| EDIT-002 | NPC editor | Full form for NPC properties | Level, type, room_key editable |
| EDIT-003 | Item editor | Full form for item properties | Type, tags editable |
| EDIT-004 | Quest editor | Objectives, rewards, prereqs | Add/remove/reorder objectives |
| EDIT-005 | Dialogue editor | Tree view of nodes | Add/edit/delete nodes |
| EDIT-006 | Cutscene editor | Timeline of sequence steps | Add/reorder/delete steps |
| EDIT-007 | Exit editor | List with add/remove | Bidirectional toggle works |

#### 5.2.4 Scripts (P0)

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| SCRIPT-001 | ScriptManager | CRUD for scripts | Create/read/update/delete work |
| SCRIPT-002 | Script list | Scripts in hierarchy panel | Shows all scripts with badges |
| SCRIPT-003 | Script editor | Monaco code editor | Syntax highlighting, line numbers |
| SCRIPT-004 | Script templates | 15 pre-built patterns | Template picker, preview, apply |
| SCRIPT-005 | Script validation | Real-time syntax check | Errors highlighted inline |
| SCRIPT-006 | Script testing | Dry-run with mock context | Test button, result display |
| SCRIPT-007 | Hook selector | Dropdown for 8 hooks | All hooks selectable |
| SCRIPT-008 | Binding reference | Searchable API docs | 70+ functions documented |
| SCRIPT-009 | LLM script generation | Claude creates scripts | Generated scripts validate |

#### 5.2.5 Git Integration (P1)

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| GIT-001 | Commit modal | Diff preview, message editor | Shows changed files |
| GIT-002 | Auto message | Generate commit message | Message reflects changes |
| GIT-003 | Commit action | Execute git commit | Commit succeeds |
| GIT-004 | Push button | Optional push after commit | Push works |
| GIT-005 | Export ZIP | Download world content | ZIP contains all YAML |

#### 5.2.6 Batch Operations (P1)

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| BATCH-001 | Multi-select | Shift+click, box select | Multiple items selected |
| BATCH-002 | Batch move | Move multiple rooms | All selected rooms move |
| BATCH-003 | Batch delete | Delete multiple items | All selected deleted |
| BATCH-004 | Batch clone | Clone with offset | Clones created at offset |

---

## 6. Scripts System

### 6.1 Overview

Scripts are sandboxed Elixir code that customize game behavior. Non-technical builders use **templates** for common patterns; advanced users can write custom code.

### 6.2 Script Data Model

```yaml
# priv/world/scripts/graveyard_crypt_on_enter.yml
key: graveyard_crypt_on_enter
type: script
name: "Crypt Entry Chill"
description: "Shows spooky message when entering the crypt"
tags: [graveyard, atmosphere, room]
data:
  hook: on_enter
  entity_key: graveyard_crypt  # Optional: auto-attach to entity
  source: |
    if not has_flag?("visited_crypt") do
      message("A chill runs down your spine as you descend into darkness...")
      set_flag("visited_crypt", true)
    end
    continue()
  timeout_ms: 5000
```

### 6.3 Supported Hooks

| Hook | Trigger | Mode | Return Values |
|------|---------|------|---------------|
| `on_enter` | Entity enters room | fire_and_forget | `continue()` |
| `on_leave` | Entity leaves room | fire_and_forget | `continue()` |
| `on_look` | Entity looks at something | validate | `default()`, `{:append, text}`, `{:replace, text}` |
| `on_say` | Entity speaks | validate | `default()`, `deny()`, `{:modify, text}` |
| `on_move` | Before movement | validate | `allow()`, `deny(reason)` |
| `on_attack` | Before attack | validate | `allow()`, `deny(reason)` |
| `on_damage` | After damage dealt | fire_and_forget | `continue()` |
| `on_death` | Entity dies | fire_and_forget | `continue()` |

### 6.4 Script API (70+ Functions)

#### 6.4.1 Context (Read-Only)
```elixir
entity        # The entity this script is attached to
player        # Current player (if applicable)
context       # Event context (room, trigger, args)
room()        # Current room data
```

#### 6.4.2 Query Functions
```elixir
# Flags
has_flag?(flag)
get_flag(flag)
get_flag(flag, default)

# Inventory
has_item?(key)
has_item?(key, count)
item_count(key)

# Stats
get_stat(stat)
get_attribute(attr)
get_skill(skill)
get_level()

# Quests
quest_active?(quest_key)
quest_complete?(quest_key)
quest_objective_done?(quest_key, objective_id)

# Entities
entities_in_room()
players_in_room()
npcs_in_room()
entity_present?(key)
find_entity(opts)
find_entities_by_tag(tag)

# World
time_of_day()           # :dawn, :morning, :noon, :afternoon, :dusk, :evening, :night, :midnight
current_hour()          # 0-23
current_weather()       # :clear, :cloudy, :rain, :storm, :fog, :snow
is_outdoor?()
is_dark?()
```

#### 6.4.3 Action Functions (Queued)
```elixir
# Communication
say(message)
emote(action)
message(text)                    # Private message to player
message(text, target_id)         # Message to specific entity
announce_room(text)              # Message to all in room

# State
set_flag(flag, value)
clear_flag(flag)
complete_objective(quest_key, objective_id)
start_quest(quest_key)
complete_quest(quest_key)

# Inventory
give_item(key)
give_item(key, count)
remove_item(key)
remove_item(key, count)

# Spawning
spawn_npc(key)
spawn_npc(key, room_id)
spawn_item(key)
spawn_item(key, room_id)
despawn(entity_id)

# Movement
teleport(entity_id, room_key)
move_to(room_key)

# Combat
damage(target_id, amount)
damage(target_id, amount, type)
heal(target_id, amount)

# Effects
apply_effect(target_id, effect_key)
remove_effect(target_id, effect_key)

# Room
set_room_attr(key, value)
lock_exit(direction)
unlock_exit(direction)

# Scheduling
after(delay_seconds, script_key)
```

#### 6.4.4 Utility Functions
```elixir
# Randomness
chance?(percent)        # chance?(25) = 25% true
roll(dice_string)       # roll("2d6+3")
random(min, max)
pick(list)              # Random element from list

# String
contains?(text, substring)
downcase(text)
upcase(text)

# List
any?(list, func)
all?(list, func)
find(list, func)
filter(list, func)
count(list)
first(list)
last(list)

# Debug
log(message)
```

#### 6.4.5 Control Flow
```elixir
# Actions that determine what happens
deny()                  # Block the action
deny(reason)            # Block with message
allow()                 # Allow the action
default()               # Use default behavior
continue()              # Continue processing
handled()               # Script handled it, stop chain

# For on_look
{:append, text}         # Add to description
{:replace, text}        # Replace description
```

### 6.5 Script Templates

#### Template List (15 Templates)

| ID | Name | Hook | Use Case |
|----|------|------|----------|
| TPL-01 | Message on Enter | on_enter | Show message when entering room |
| TPL-02 | Message on Enter (Once) | on_enter | Show message only first time |
| TPL-03 | Block Exit | on_move | Require item/flag to leave |
| TPL-04 | Spawn on Enter | on_enter | Spawn NPC/item when entering |
| TPL-05 | Give Item (Once) | on_enter | Give item on first visit |
| TPL-06 | Trigger Dialogue | on_look | Start dialogue when looking |
| TPL-07 | Damage Trap | on_enter | Damage player on enter |
| TPL-08 | Conditional Trap | on_enter | Damage unless has item |
| TPL-09 | Ambient Messages | on_enter | Random atmospheric messages |
| TPL-10 | Lock/Unlock Exit | on_enter | Lock exit based on condition |
| TPL-11 | Start Quest | on_enter | Start quest when entering |
| TPL-12 | Time-based Message | on_enter | Different message by time of day |
| TPL-13 | Weather Effect | on_enter | Effect based on weather |
| TPL-14 | NPC Reaction | on_look | NPC says something when looked at |
| TPL-15 | Death Respawn | on_death | Custom respawn behavior |

#### Template Detail: TPL-01 Message on Enter

```yaml
# Template metadata
template_id: TPL-01
name: "Message on Enter"
description: "Shows a message when a player enters the room"
hook: on_enter
category: atmosphere

# User inputs (form fields)
inputs:
  - id: message
    label: "Message to show"
    type: textarea
    placeholder: "You feel a strange presence..."
    required: true
  - id: condition
    label: "Condition (optional)"
    type: select
    options:
      - { value: "always", label: "Always show" }
      - { value: "once", label: "Only once per player" }
      - { value: "night", label: "Only at night" }
      - { value: "has_item", label: "Only if player has item" }
    default: "always"
  - id: condition_item
    label: "Required item (if condition is 'has item')"
    type: text
    show_if: { condition: "has_item" }

# Generated code template
code_template: |
  {{#if condition_once}}
  if not has_flag?("{{flag_name}}") do
    message("{{message}}")
    set_flag("{{flag_name}}", true)
  end
  {{/if}}
  {{#if condition_night}}
  if time_of_day() in [:night, :midnight] do
    message("{{message}}")
  end
  {{/if}}
  {{#if condition_has_item}}
  if has_item?("{{condition_item}}") do
    message("{{message}}")
  end
  {{/if}}
  {{#if condition_always}}
  message("{{message}}")
  {{/if}}
  continue()
```

#### Template Detail: TPL-03 Block Exit

```yaml
template_id: TPL-03
name: "Block Exit"
description: "Prevents leaving unless player has an item or flag"
hook: on_move
category: puzzle

inputs:
  - id: direction
    label: "Direction to block"
    type: select
    options:
      - { value: "north", label: "North" }
      - { value: "south", label: "South" }
      - { value: "east", label: "East" }
      - { value: "west", label: "West" }
      - { value: "up", label: "Up" }
      - { value: "down", label: "Down" }
      - { value: "any", label: "Any direction" }
    required: true
  - id: requirement_type
    label: "Requirement type"
    type: select
    options:
      - { value: "item", label: "Must have item" }
      - { value: "flag", label: "Must have flag" }
      - { value: "quest", label: "Must complete quest" }
    required: true
  - id: requirement_key
    label: "Item/Flag/Quest key"
    type: text
    required: true
  - id: deny_message
    label: "Message when blocked"
    type: textarea
    placeholder: "The door won't budge..."
    required: true

code_template: |
  direction = context.direction
  {{#if direction_any}}
  blocked = true
  {{else}}
  blocked = direction == "{{direction}}"
  {{/if}}

  if blocked do
    {{#if requirement_item}}
    if has_item?("{{requirement_key}}") do
      allow()
    else
      message("{{deny_message}}")
      deny()
    end
    {{/if}}
    {{#if requirement_flag}}
    if has_flag?("{{requirement_flag}}") do
      allow()
    else
      message("{{deny_message}}")
      deny()
    end
    {{/if}}
    {{#if requirement_quest}}
    if quest_complete?("{{requirement_key}}") do
      allow()
    else
      message("{{deny_message}}")
      deny()
    end
    {{/if}}
  else
    allow()
  end
```

#### Template Detail: TPL-07 Damage Trap

```yaml
template_id: TPL-07
name: "Damage Trap"
description: "Damages the player when entering the room"
hook: on_enter
category: combat

inputs:
  - id: damage_amount
    label: "Damage amount"
    type: number
    min: 1
    max: 100
    default: 10
    required: true
  - id: damage_type
    label: "Damage type"
    type: select
    options:
      - { value: "physical", label: "Physical" }
      - { value: "fire", label: "Fire" }
      - { value: "cold", label: "Cold" }
      - { value: "poison", label: "Poison" }
      - { value: "spirit", label: "Spirit" }
    default: "physical"
  - id: message
    label: "Trap message"
    type: textarea
    placeholder: "You trigger a hidden trap!"
    required: true
  - id: once_only
    label: "Trigger only once?"
    type: checkbox
    default: false

code_template: |
  {{#if once_only}}
  if not has_flag?("{{trap_flag}}") do
    message("{{message}}")
    damage(player.id, {{damage_amount}}, "{{damage_type}}")
    set_flag("{{trap_flag}}", true)
  end
  {{else}}
  message("{{message}}")
  damage(player.id, {{damage_amount}}, "{{damage_type}}")
  {{/if}}
  continue()
```

### 6.6 Script Editor UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Script Editor: graveyard_crypt_on_enter                          [X] Close │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Properties ─────────────────────────────────────────────────────────┐  │
│  │ Key:  [graveyard_crypt_on_enter    ]                                 │  │
│  │ Name: [Crypt Entry Chill           ]                                 │  │
│  │ Hook: [on_enter ▼]  Entity: [graveyard_crypt ▼] (optional)          │  │
│  │ Tags: [graveyard] [atmosphere] [x] [+ Add]                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Source Code ─────────────────────────────────────┬─ Templates ──────┐  │
│  │  1 │ if not has_flag?("visited_crypt") do        │ [🔍 Search...]    │  │
│  │  2 │   message("A chill runs down your spine...") │                  │  │
│  │  3 │   set_flag("visited_crypt", true)           │ ▼ Atmosphere      │  │
│  │  4 │ end                                          │   Message on Enter│  │
│  │  5 │ continue()                                   │   Message (Once)  │  │
│  │  6 │                                              │   Ambient Messages│  │
│  │    │                                              │   Time-based Msg  │  │
│  │    │                                              │ ▼ Puzzle          │  │
│  │    │                                              │   Block Exit      │  │
│  │    │                                              │   Lock/Unlock     │  │
│  │    │                                              │ ▼ Combat          │  │
│  │    │                                              │   Damage Trap     │  │
│  │    │                                              │   Conditional Trap│  │
│  └────┴──────────────────────────────────────────────┴──────────────────┘  │
│                                                                             │
│  ┌─ Validation ─────────────────────────────────────────────────────────┐  │
│  │ ✅ Script is valid                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ API Reference ──────────────────────────────────────────────────────┐  │
│  │ [🔍 Search functions...]                                              │  │
│  │ ▼ Flags: has_flag?, get_flag, set_flag, clear_flag                   │  │
│  │ ▼ Inventory: has_item?, give_item, remove_item                       │  │
│  │ ▼ Communication: say, message, emote, announce_room                  │  │
│  │ ▶ Quests   ▶ Combat   ▶ Movement   ▶ Utility   ▶ Control             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Test ───────────────────────────────────────────────────────────────┐  │
│  │ Entity: [player_test ▼]  Context: [entering room ▼]  [▶ Run Test]    │  │
│  │ Result: ✅ Success - Actions queued: message(), set_flag()           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                     [Cancel]  [Save Script]                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.7 Template Picker Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Choose Script Template                                           [X] Close │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [🔍 Search templates...]                                                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ ▼ ATMOSPHERE (4 templates)                                              ││
│ │   ┌─────────────────────────────────────────────────────────────────┐  ││
│ │   │ 📝 Message on Enter                                              │  ││
│ │   │ Shows a message when a player enters the room                    │  ││
│ │   │ Hook: on_enter                                        [Select]   │  ││
│ │   └─────────────────────────────────────────────────────────────────┘  ││
│ │   ┌─────────────────────────────────────────────────────────────────┐  ││
│ │   │ 📝 Message on Enter (Once)                                       │  ││
│ │   │ Shows message only the first time player enters                  │  ││
│ │   │ Hook: on_enter                                        [Select]   │  ││
│ │   └─────────────────────────────────────────────────────────────────┘  ││
│ │                                                                         ││
│ │ ▶ PUZZLE (3 templates)                                                  ││
│ │ ▶ COMBAT (3 templates)                                                  ││
│ │ ▶ QUEST (2 templates)                                                   ││
│ │ ▶ NPC (2 templates)                                                     ││
│ │ ▶ SPECIAL (1 template)                                                  ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                                          [Cancel]  [Create from Scratch]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.8 Template Configuration Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Configure: Message on Enter (Once)                               [X] Close │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ This template shows a message only the first time a player enters.         │
│                                                                             │
│ ┌─ Script Details ──────────────────────────────────────────────────────┐  │
│ │ Key:    [graveyard_crypt_on_enter   ]  (auto-generated)               │  │
│ │ Name:   [Crypt Entry Message        ]                                 │  │
│ │ Entity: [graveyard_crypt ▼]  (attach to this room)                    │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ ┌─ Template Options ────────────────────────────────────────────────────┐  │
│ │                                                                        │  │
│ │ Message to show: *                                                     │  │
│ │ ┌──────────────────────────────────────────────────────────────────┐  │  │
│ │ │ A chill runs down your spine as you descend into the ancient     │  │  │
│ │ │ crypt. The air grows cold and still...                           │  │  │
│ │ └──────────────────────────────────────────────────────────────────┘  │  │
│ │                                                                        │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ ┌─ Preview ─────────────────────────────────────────────────────────────┐  │
│ │  1 │ if not has_flag?("visited_graveyard_crypt") do                   │  │
│ │  2 │   message("A chill runs down your spine as you descend into the  │  │
│ │  3 │   ancient crypt. The air grows cold and still...")               │  │
│ │  4 │   set_flag("visited_graveyard_crypt", true)                      │  │
│ │  5 │ end                                                               │  │
│ │  6 │ continue()                                                        │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ ✅ Valid script                                                             │
│                                                                             │
│                                     [Back]  [Cancel]  [Create Script]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. LLM Integration

### 7.1 Authentication Flow

```
User opens World Builder
    ↓
Check localStorage for API key
    ↓
If no key → Show "Connect API Key" button in chat panel
    ↓
User clicks → Opens settings modal
    ↓
User enters Anthropic API key
    ↓
Validate key with test API call
    ↓
Store encrypted in localStorage
    ↓
Chat panel enabled
```

### 7.2 Message Flow

```
User types message
    ↓
Build context (selection, zone, errors, history)
    ↓
POST to Anthropic API (client-side, streaming)
    ↓
Stream response chunks to chat UI
    ↓
If tool_use → Push LiveView event "execute_tool"
    ↓
LiveView validates and executes via Manager
    ↓
Broadcast via PubSub
    ↓
Return tool result to Claude
    ↓
Claude continues or completes
```

### 7.3 Tool Definitions

#### 7.3.1 Entity Tools

```javascript
const ENTITY_TOOLS = [
  {
    name: "create_room",
    description: "Create a new room. Use zone prefix in key (e.g., 'forest_clearing').",
    input_schema: {
      type: "object",
      required: ["key", "name", "description"],
      properties: {
        key: { type: "string", pattern: "^[a-z][a-z0-9_]{2,48}$" },
        name: { type: "string", maxLength: 100 },
        description: { type: "string", maxLength: 2000 },
        x: { type: "integer", default: 0 },
        y: { type: "integer", default: 0 },
        z: { type: "integer", default: 0 },
        tags: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "update_room",
    description: "Update an existing room",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: {
        key: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        x: { type: "integer" },
        y: { type: "integer" },
        z: { type: "integer" },
        tags: { type: "array" }
      }
    }
  },
  {
    name: "delete_room",
    description: "Delete a room and its exits",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: { key: { type: "string" } }
    }
  },
  {
    name: "add_exit",
    description: "Connect two rooms (bidirectional by default)",
    input_schema: {
      type: "object",
      required: ["from_room", "direction", "to_room"],
      properties: {
        from_room: { type: "string" },
        direction: { type: "string", enum: ["north","south","east","west","up","down","northeast","northwest","southeast","southwest"] },
        to_room: { type: "string" },
        bidirectional: { type: "boolean", default: true }
      }
    }
  },
  {
    name: "remove_exit",
    description: "Remove an exit",
    input_schema: {
      type: "object",
      required: ["from_room", "direction"],
      properties: {
        from_room: { type: "string" },
        direction: { type: "string" },
        bidirectional: { type: "boolean", default: true }
      }
    }
  },
  {
    name: "create_npc",
    description: "Create an NPC",
    input_schema: {
      type: "object",
      required: ["key", "name", "description"],
      properties: {
        key: { type: "string", pattern: "^[a-z][a-z0-9_]{2,48}$" },
        name: { type: "string", maxLength: 100 },
        description: { type: "string", maxLength: 2000 },
        level: { type: "integer", minimum: 1, maximum: 100, default: 1 },
        room_key: { type: "string" },
        npc_type: { type: "string", enum: ["quest_giver","merchant","enemy","ambient","boss"] },
        tags: { type: "array" }
      }
    }
  },
  {
    name: "update_npc",
    description: "Update an NPC",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: {
        key: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        level: { type: "integer" },
        room_key: { type: "string" },
        npc_type: { type: "string" },
        tags: { type: "array" }
      }
    }
  },
  {
    name: "delete_npc",
    description: "Delete an NPC",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: { key: { type: "string" } }
    }
  },
  {
    name: "create_item",
    description: "Create an item",
    input_schema: {
      type: "object",
      required: ["key", "name", "description"],
      properties: {
        key: { type: "string", pattern: "^[a-z][a-z0-9_]{2,48}$" },
        name: { type: "string", maxLength: 100 },
        description: { type: "string", maxLength: 2000 },
        item_type: { type: "string", enum: ["weapon","armor","consumable","quest_item","misc","key","tool"] },
        tags: { type: "array" }
      }
    }
  },
  {
    name: "update_item",
    description: "Update an item",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: {
        key: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        item_type: { type: "string" },
        tags: { type: "array" }
      }
    }
  },
  {
    name: "delete_item",
    description: "Delete an item",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: { key: { type: "string" } }
    }
  },
  {
    name: "create_quest",
    description: "Create a quest with objectives",
    input_schema: {
      type: "object",
      required: ["key", "name", "description", "giver_key", "objectives"],
      properties: {
        key: { type: "string", pattern: "^[a-z][a-z0-9_]{2,48}$" },
        name: { type: "string", maxLength: 100 },
        description: { type: "string", maxLength: 2000 },
        quest_type: { type: "string", enum: ["main","side","daily","tutorial"], default: "side" },
        giver_key: { type: "string" },
        objectives: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "type", "description"],
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["talk","kill","get_item","go_to","craft"] },
              target_id: { type: "string" },
              count: { type: "integer", minimum: 1, default: 1 },
              description: { type: "string" }
            }
          }
        },
        rewards: {
          type: "object",
          properties: {
            xp: { type: "integer" },
            gold: { type: "integer" },
            items: { type: "array", items: { type: "string" } }
          }
        },
        prerequisites: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "update_quest",
    description: "Update a quest",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: {
        key: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        quest_type: { type: "string" },
        giver_key: { type: "string" },
        objectives: { type: "array" },
        rewards: { type: "object" },
        prerequisites: { type: "array" }
      }
    }
  },
  {
    name: "delete_quest",
    description: "Delete a quest",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: { key: { type: "string" } }
    }
  },
  {
    name: "create_dialogue",
    description: "Create a dialogue tree",
    input_schema: {
      type: "object",
      required: ["key", "npc_key", "nodes"],
      properties: {
        key: { type: "string", pattern: "^[a-z][a-z0-9_]{2,48}$" },
        npc_key: { type: "string" },
        entry_node: { type: "string", default: "start" },
        nodes: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              text: { type: "string" },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    next: { type: "string" },
                    action: { type: "array" }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  {
    name: "update_dialogue",
    description: "Update a dialogue",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: {
        key: { type: "string" },
        npc_key: { type: "string" },
        entry_node: { type: "string" },
        nodes: { type: "object" }
      }
    }
  },
  {
    name: "delete_dialogue",
    description: "Delete a dialogue",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: { key: { type: "string" } }
    }
  },
  {
    name: "create_cutscene",
    description: "Create a cutscene",
    input_schema: {
      type: "object",
      required: ["id", "name", "trigger", "sequence"],
      properties: {
        id: { type: "string", pattern: "^[a-z][a-z0-9_]{2,48}$" },
        name: { type: "string" },
        trigger: {
          type: "object",
          required: ["type"],
          properties: {
            type: { type: "string", enum: ["enter_room","talk_to","quest_complete","use_item","manual"] },
            location: { type: "string" },
            target: { type: "string" },
            condition: { type: "string" }
          }
        },
        sequence: {
          type: "array",
          items: {
            type: "object",
            required: ["type"],
            properties: {
              type: { type: "string", enum: ["narration","dialogue","pause","fade_out","fade_in","give_item","set_flag","start_quest"] },
              text: { type: "string" },
              speaker: { type: "string" },
              duration: { type: "number" },
              flag: { type: "string" },
              value: { type: "boolean" },
              item: { type: "string" },
              quest: { type: "string" }
            }
          }
        }
      }
    }
  },
  {
    name: "update_cutscene",
    description: "Update a cutscene",
    input_schema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        trigger: { type: "object" },
        sequence: { type: "array" }
      }
    }
  },
  {
    name: "delete_cutscene",
    description: "Delete a cutscene",
    input_schema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } }
    }
  }
];
```

#### 7.3.2 Script Tools

```javascript
const SCRIPT_TOOLS = [
  {
    name: "create_script",
    description: "Create a script. Use entity_key_hook naming (e.g., 'graveyard_crypt_on_enter').",
    input_schema: {
      type: "object",
      required: ["key", "name", "hook", "source"],
      properties: {
        key: { type: "string", pattern: "^[a-z][a-z0-9_]{2,48}$" },
        name: { type: "string", maxLength: 100 },
        description: { type: "string", maxLength: 500 },
        hook: { type: "string", enum: ["on_enter","on_leave","on_look","on_say","on_move","on_attack","on_damage","on_death"] },
        entity_key: { type: "string", description: "Optional: auto-attach to this entity" },
        source: { type: "string", maxLength: 10000, description: "Elixir script code" },
        tags: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "update_script",
    description: "Update a script",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: {
        key: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        hook: { type: "string" },
        entity_key: { type: "string" },
        source: { type: "string" },
        tags: { type: "array" }
      }
    }
  },
  {
    name: "delete_script",
    description: "Delete a script",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: { key: { type: "string" } }
    }
  },
  {
    name: "create_script_from_template",
    description: "Create a script using a pre-built template",
    input_schema: {
      type: "object",
      required: ["template_id", "key", "entity_key", "options"],
      properties: {
        template_id: {
          type: "string",
          enum: ["TPL-01","TPL-02","TPL-03","TPL-04","TPL-05","TPL-06","TPL-07","TPL-08","TPL-09","TPL-10","TPL-11","TPL-12","TPL-13","TPL-14","TPL-15"],
          description: "Template ID (e.g., TPL-01 for Message on Enter)"
        },
        key: { type: "string", description: "Script key (e.g., 'graveyard_crypt_on_enter')" },
        name: { type: "string", description: "Human-readable name" },
        entity_key: { type: "string", description: "Entity to attach script to" },
        options: {
          type: "object",
          description: "Template-specific options (message, condition, etc.)",
          additionalProperties: true
        }
      }
    }
  }
];
```

#### 7.3.3 Query Tools

```javascript
const QUERY_TOOLS = [
  {
    name: "list_rooms",
    description: "List rooms, optionally filtered",
    input_schema: {
      type: "object",
      properties: {
        zone_tag: { type: "string" },
        limit: { type: "integer", maximum: 100, default: 50 }
      }
    }
  },
  {
    name: "get_room",
    description: "Get room details",
    input_schema: {
      type: "object",
      required: ["key"],
      properties: { key: { type: "string" } }
    }
  },
  {
    name: "list_npcs",
    description: "List NPCs",
    input_schema: {
      type: "object",
      properties: {
        room_key: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "list_items",
    description: "List items",
    input_schema: {
      type: "object",
      properties: {
        item_type: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "list_quests",
    description: "List quests",
    input_schema: {
      type: "object",
      properties: {
        quest_type: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "list_scripts",
    description: "List scripts",
    input_schema: {
      type: "object",
      properties: {
        hook: { type: "string" },
        entity_key: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "list_script_templates",
    description: "List available script templates",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["atmosphere","puzzle","combat","quest","npc","special"] }
      }
    }
  },
  {
    name: "run_validation",
    description: "Validate entities",
    input_schema: {
      type: "object",
      properties: {
        entity_keys: { type: "array", items: { type: "string" } },
        types: { type: "array", items: { type: "string", enum: ["room","npc","item","quest","dialogue","cutscene","script"] } }
      }
    }
  }
];
```

### 7.4 System Prompt

```javascript
const SYSTEM_PROMPT = `You are an assistant helping build a MUD (text-based RPG) world using the Loka World Builder.

## Your Role
Help builders create rooms, NPCs, items, quests, dialogues, cutscenes, and scripts. You can execute tools to make changes directly.

## Content Style
- **Tone**: Clear, informative, lighthearted, warm and welcoming
- **Descriptions**: Evocative but concise, sensory details
- **Avoid**: Purple prose, grimdark themes, excessive violence
- **Embrace**: Hope, wonder, gentle humor, meaningful challenges

## Naming Conventions
- Pattern: zone_descriptive_name (e.g., monastery_kitchen, forest_clearing)
- Lowercase, underscores, 3-50 characters
- Scripts: entity_key_hook (e.g., graveyard_crypt_on_enter)

## Script Guidelines
When creating scripts:
1. Prefer templates for common patterns (use create_script_from_template)
2. Keep scripts simple and focused
3. Always end with a control flow function (continue(), allow(), deny(), default())
4. Use meaningful flag names (visited_location, met_npc, etc.)
5. Test scripts before deploying

## Available Script Templates
- TPL-01: Message on Enter - Show message when entering
- TPL-02: Message on Enter (Once) - Show message only first time
- TPL-03: Block Exit - Require item/flag to leave
- TPL-04: Spawn on Enter - Spawn NPC/item when entering
- TPL-05: Give Item (Once) - Give item on first visit
- TPL-06: Trigger Dialogue - Start dialogue when looking
- TPL-07: Damage Trap - Damage player on enter
- TPL-08: Conditional Trap - Damage unless has item
- TPL-09: Ambient Messages - Random atmospheric messages
- TPL-10: Lock/Unlock Exit - Lock exit based on condition
- TPL-11: Start Quest - Start quest when entering
- TPL-12: Time-based Message - Different message by time of day
- TPL-13: Weather Effect - Effect based on weather
- TPL-14: NPC Reaction - NPC says something when looked at
- TPL-15: Death Respawn - Custom respawn behavior

## Current Context
Zone: {{zone}}
Selected: {{selection_count}} entities
{{#if selection}}
Selected:
{{#each selection}}
- {{type}}: {{key}} "{{name}}"
{{/each}}
{{/if}}

{{#if validation_errors}}
Errors ({{error_count}}):
{{#each validation_errors}}
- {{entity_key}}: {{message}}
{{/each}}
{{/if}}

Existing keys (do not duplicate):
{{existing_keys}}

## Instructions
1. Use appropriate tools for each action
2. Follow naming conventions
3. Write descriptions in the specified style
4. Create bidirectional exits by default
5. Use script templates when possible
6. Validate changes after creating`;
```

### 7.5 Cost Calculation

```javascript
const PRICING = {
  'claude-opus-4-5-20250514': { input: 15.00, output: 75.00 },  // per 1M tokens
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 }
};

function calculateCost(model, inputTokens, outputTokens) {
  const p = PRICING[model];
  return ((inputTokens * p.input) + (outputTokens * p.output)) / 1_000_000;
}
```

---

## 8. Data Models

### 8.1 Room

```yaml
key: graveyard_crypt
type: room
name: "Ancient Crypt"
description: "Stone steps descend into darkness..."
x: 100
y: 20
z: -1
tags: [graveyard, indoor, underground]
exits:
  up: graveyard_center
spawns:
  - prototype: graveyard_ghost
  - prototype: ancient_key
scripts:
  - graveyard_crypt_on_enter
```

### 8.2 NPC

```yaml
key: graveyard_ghost
type: npc
name: "Restless Spirit"
description: "A translucent figure..."
level: 5
npc_type: ambient
tags: [graveyard, undead, non_hostile]
components:
  ambient_actions:
    messages: ["The ghost drifts silently...", "A cold whisper echoes..."]
    interval: [30, 60]
```

### 8.3 Item

```yaml
key: ancient_key
type: item
name: "Ancient Key"
description: "A tarnished brass key..."
item_type: key
tags: [graveyard, quest_item]
```

### 8.4 Quest

```yaml
key: side_restless_dead
type: quest
name: "The Restless Dead"
description: "Help the ghost find peace"
quest_type: side
giver_key: graveyard_ghost
objectives:
  - id: find_key
    type: get_item
    target_id: ancient_key
    description: "Find the ancient key in the crypt"
  - id: open_chapel
    type: go_to
    target_id: graveyard_chapel
    description: "Open the chapel door"
  - id: return_ghost
    type: talk
    target_id: graveyard_ghost
    description: "Return to the ghost"
rewards:
  xp: 100
  items: [spirit_blessing]
```

### 8.5 Script

```yaml
key: graveyard_crypt_on_enter
type: script
name: "Crypt Entry Chill"
description: "Shows spooky message on first entry"
tags: [graveyard, atmosphere]
data:
  hook: on_enter
  entity_key: graveyard_crypt
  source: |
    if not has_flag?("visited_crypt") do
      message("A chill runs down your spine...")
      set_flag("visited_crypt", true)
    end
    continue()
  timeout_ms: 5000
```

---

## 9. Implementation Phases

### 9.1 Phase 1: Foundation (Weeks 1-2)

**Goal**: Fix bugs, establish core infrastructure

| Task | Est. Hours | Priority |
|------|------------|----------|
| Fix RoomManager.update_room bug | 2 | P0 |
| Add unit tests for room CRUD | 4 | P0 |
| Implement UndoManager (JS) | 6 | P0 |
| Undo/redo for room operations | 4 | P0 |
| Undo/redo for entity operations | 4 | P0 |
| Add viewport icons for NPCs/items | 6 | P0 |
| Real-time validation on change | 8 | P0 |
| Validation glow on cubes | 4 | P1 |
| Panel collapse functionality | 4 | P1 |
| Write integration tests | 8 | P0 |
| **Total** | **50 hours** | |

**Deliverable**: Stable CRUD with undo/redo and visual feedback

### 9.2 Phase 2: LLM Chat (Weeks 3-4)

**Goal**: Working LLM chat with tool execution

| Task | Est. Hours | Priority |
|------|------------|----------|
| Chat panel LiveView component | 8 | P0 |
| Chat panel styling/layout | 4 | P0 |
| API key settings modal | 4 | P0 |
| Anthropic client (JS, streaming) | 8 | P0 |
| Context builder | 6 | P0 |
| Entity tool definitions | 4 | P0 |
| Tool executor (LiveView) | 8 | P0 |
| Tool result handling | 4 | P0 |
| Token/cost counter | 4 | P0 |
| Model selector | 2 | P0 |
| Conversation history (session) | 4 | P1 |
| E2E tests for LLM flow | 8 | P0 |
| **Total** | **64 hours** | |

**Deliverable**: Working LLM chat that can create/edit entities

### 9.3 Phase 3: Entity Editors (Weeks 5-6)

**Goal**: Full UI for all entity types

| Task | Est. Hours | Priority |
|------|------------|----------|
| Quest editor (objectives, rewards) | 12 | P1 |
| Dialogue editor (tree view) | 12 | P1 |
| Cutscene editor (timeline) | 12 | P1 |
| NPC editor (full form) | 6 | P1 |
| Item editor (full form) | 6 | P1 |
| Exit editor improvements | 4 | P1 |
| Batch operations UI | 8 | P1 |
| Tests for editors | 8 | P1 |
| **Total** | **68 hours** | |

**Deliverable**: Complete editing capability for all entity types

### 9.4 Phase 4: Scripts System (Weeks 7-9)

**Goal**: Full script editing with templates

| Task | Est. Hours | Priority |
|------|------------|----------|
| ScriptManager module | 8 | P0 |
| Script list in hierarchy | 4 | P0 |
| Script editor modal (basic) | 8 | P0 |
| Monaco editor integration | 8 | P0 |
| Hook selector dropdown | 2 | P0 |
| Real-time validation display | 6 | P0 |
| Script template data model | 4 | P0 |
| Template picker modal | 8 | P0 |
| Template configuration modal | 8 | P0 |
| Implement 15 templates | 16 | P0 |
| Template code generation | 8 | P0 |
| Script testing UI | 8 | P0 |
| API reference panel | 6 | P1 |
| LLM script tools | 4 | P0 |
| Script E2E tests | 8 | P0 |
| **Total** | **106 hours** | |

**Deliverable**: Full script system with templates

### 9.5 Phase 5: Polish & Git (Weeks 10-11)

**Goal**: Production-ready with Git integration

| Task | Est. Hours | Priority |
|------|------------|----------|
| GitManager module | 6 | P1 |
| Git commit modal | 8 | P1 |
| Diff preview | 6 | P1 |
| Auto commit message | 4 | P1 |
| Export ZIP function | 4 | P1 |
| Click-to-fix validation | 4 | P1 |
| Keyboard shortcuts | 4 | P1 |
| Panel state persistence | 4 | P1 |
| Performance optimization | 8 | P1 |
| Documentation | 8 | P1 |
| Final E2E test suite | 16 | P0 |
| Bug fixes & polish | 16 | P0 |
| **Total** | **88 hours** | |

**Deliverable**: Production-ready World Builder

### 9.6 Summary

| Phase | Duration | Hours | Focus |
|-------|----------|-------|-------|
| Phase 1 | 2 weeks | 50h | Foundation, undo/redo |
| Phase 2 | 2 weeks | 64h | LLM chat |
| Phase 3 | 2 weeks | 68h | Entity editors |
| Phase 4 | 2-3 weeks | 106h | Scripts + templates |
| Phase 5 | 2 weeks | 88h | Git, polish |
| **Total** | **10-11 weeks** | **376h** | |

---

## 10. Testing Strategy

### 10.1 Test Pyramid

```
                    ┌─────────┐
                    │  E2E    │  5 test suites
                   ┌┴─────────┴┐
                   │Integration │  20+ tests
                  ┌┴───────────┴┐
                  │    Unit      │  50+ tests
                 └───────────────┘
```

### 10.2 Unit Tests

| Module | Tests |
|--------|-------|
| RoomManager | create, get, update (YAML), update (DB), delete, add_exit, remove_exit |
| EntityManager | create_npc, create_item, update, delete, list |
| ScriptManager | create, get, update, delete, validate, test_script |
| TemplateManager | list, get, save_as_template, create_from_template |
| QuestManager | create, update, delete, search |
| ValidationManager | validate_room, validate_quest, validate_script |
| InputValidator | validate_key, validate_name, validate_script_source |

### 10.3 Integration Tests

| Test | Description |
|------|-------------|
| Room CRUD flow | Create → Update → Delete with PubSub |
| Undo/redo | Create → Undo → Redo |
| LLM tool execution | Mock API → Tool call → Entity created |
| Script validation | Invalid script → Error returned |
| Template instantiation | Template → Config → Script created |

### 10.4 E2E Test: Graveyard Zone

**File**: `test/integration/world_builder_graveyard_test.exs`

```elixir
defmodule Loka.WorldBuilder.GraveyardE2ETest do
  use Loka.FeatureCase, async: false

  @test_prefix "test_graveyard_"

  describe "Complete Graveyard Zone Build" do
    # Phase 1: Create rooms via UI
    test "1.1: creates 3 rooms via UI"
    test "1.2: creates exits between rooms"

    # Phase 2: Create rooms via LLM
    test "2.1: creates 2 more rooms via LLM"
    test "2.2: LLM connects rooms with exits"

    # Phase 3: Create entities
    test "3.1: creates NPC (ghost) via UI"
    test "3.2: creates item (key) via LLM"

    # Phase 4: Create quest
    test "4.1: creates quest via LLM with 3 objectives"
    test "4.2: quest validation passes"

    # Phase 5: Create dialogue
    test "5.1: creates dialogue tree via LLM"
    test "5.2: dialogue attached to NPC"

    # Phase 6: Create scripts
    test "6.1: creates script from template (message on enter)"
    test "6.2: creates custom script via LLM"
    test "6.3: script validation passes"
    test "6.4: script test runs successfully"

    # Phase 7: Create cutscene
    test "7.1: creates cutscene via UI"

    # Phase 8: Validation
    test "8.1: full zone validation passes"
    test "8.2: all entities connected correctly"

    # Phase 9: Undo/Redo
    test "9.1: undo room creation"
    test "9.2: redo room creation"

    # Phase 10: Data integrity
    test "10.1: YAML files exist for all entities"
    test "10.2: all scripts validate"

    # Phase 11: Teardown
    test "11.1: delete all test entities via LLM"
    test "11.2: verify clean state"
  end
end
```

### 10.5 Script-Specific Tests

```elixir
defmodule Loka.WorldBuilder.ScriptTest do
  describe "ScriptManager" do
    test "creates script from source"
    test "validates script before save"
    test "rejects invalid script patterns"
    test "tests script with mock context"
    test "updates existing script"
    test "deletes script and YAML file"
  end

  describe "Script Templates" do
    test "lists all 15 templates"
    test "generates code from TPL-01 (message on enter)"
    test "generates code from TPL-03 (block exit)"
    test "generates code from TPL-07 (damage trap)"
    test "template options apply correctly"
    test "generated code validates"
  end

  describe "Script Validation" do
    test "allows valid bindings"
    test "blocks forbidden patterns (defmodule)"
    test "blocks forbidden patterns (Code.eval)"
    test "blocks forbidden patterns (System.cmd)"
    test "enforces max length"
    test "validates hook type"
  end

  describe "LLM Script Generation" do
    test "Claude creates script via create_script tool"
    test "Claude uses template via create_script_from_template"
    test "generated scripts pass validation"
  end
end
```

---

## 11. File Structure

### 11.1 New Files to Create

```
server/
├── lib/
│   ├── loka_web/
│   │   └── live/
│   │       └── admin_live/
│   │           ├── world_builder_live.ex          # MODIFY
│   │           └── world_builder/
│   │               ├── chat_panel.ex              # NEW - LLM chat
│   │               ├── settings_modal.ex          # NEW - API key
│   │               ├── commit_modal.ex            # NEW - Git commit
│   │               ├── script_editor.ex           # NEW - Script editing
│   │               ├── script_template_picker.ex  # NEW - Template selection
│   │               ├── script_template_config.ex  # NEW - Template config
│   │               ├── quest_editor.ex            # NEW - Quest editing
│   │               ├── dialogue_editor.ex         # NEW - Dialogue tree
│   │               └── cutscene_editor.ex         # NEW - Cutscene timeline
│   │
│   └── loka/
│       └── world_builder/
│           ├── room_manager.ex                    # MODIFY - Fix bug
│           ├── script_manager.ex                  # NEW - Script CRUD
│           ├── script_templates.ex                # NEW - Template definitions
│           ├── git_manager.ex                     # NEW - Git operations
│           └── tool_executor.ex                   # NEW - LLM tool execution
│
├── assets/
│   └── js/
│       └── world_builder/
│           ├── App.jsx                            # MODIFY - Add panels
│           ├── ChatPanel.jsx                      # NEW - Chat UI
│           ├── AnthropicClient.js                 # NEW - API client
│           ├── ContextBuilder.js                  # NEW - Prompt builder
│           ├── ToolDefinitions.js                 # NEW - Tool schemas
│           ├── UndoManager.js                     # NEW - Undo/redo
│           ├── ScriptEditor.jsx                   # NEW - Monaco wrapper
│           └── components/
│               ├── RoomCube.jsx                   # MODIFY - Add icons
│               ├── CostTracker.jsx                # NEW - Token display
│               └── TemplateCard.jsx               # NEW - Template UI
│
├── priv/
│   └── world/
│       └── script_templates/                      # NEW - Template definitions
│           ├── TPL-01-message-on-enter.yml
│           ├── TPL-02-message-once.yml
│           ├── TPL-03-block-exit.yml
│           ├── ... (15 total)
│
└── test/
    ├── loka/
    │   └── world_builder/
    │       ├── room_manager_test.exs              # MODIFY - Add update tests
    │       ├── script_manager_test.exs            # NEW
    │       └── script_templates_test.exs          # NEW
    │
    └── integration/
        ├── world_builder_e2e_test.exs             # MODIFY - Expand
        ├── world_builder_graveyard_test.exs       # NEW - Full E2E
        ├── world_builder_llm_test.exs             # NEW - LLM tests
        └── world_builder_scripts_test.exs         # NEW - Script tests
```

### 11.2 Dependencies to Add

```elixir
# mix.exs
defp deps do
  [
    # ... existing deps
    {:jason, "~> 1.4"},  # Already present
  ]
end
```

```json
// package.json (assets/)
{
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",  // Code editor
    // ... existing deps
  }
}
```

---

## 12. API Reference

### 12.1 LiveView Events (World Builder)

| Event | Params | Description |
|-------|--------|-------------|
| `create_room` | `%{key, name, description, x, y, z, tags}` | Create room |
| `update_room` | `%{key, ...fields}` | Update room |
| `delete_room` | `%{key}` | Delete room |
| `add_exit` | `%{from_room, direction, to_room, bidirectional}` | Add exit |
| `remove_exit` | `%{from_room, direction, bidirectional}` | Remove exit |
| `create_npc` | `%{key, name, ...}` | Create NPC |
| `create_item` | `%{key, name, ...}` | Create item |
| `create_quest` | `%{key, name, objectives, ...}` | Create quest |
| `create_dialogue` | `%{key, npc_key, nodes}` | Create dialogue |
| `create_cutscene` | `%{id, trigger, sequence}` | Create cutscene |
| `create_script` | `%{key, name, hook, source}` | Create script |
| `create_script_from_template` | `%{template_id, key, entity_key, options}` | Create from template |
| `update_script` | `%{key, ...fields}` | Update script |
| `delete_script` | `%{key}` | Delete script |
| `test_script` | `%{key, entity_key, context}` | Test script |
| `execute_tool` | `%{tool, params}` | Execute LLM tool |
| `undo` | `%{}` | Undo last action |
| `redo` | `%{}` | Redo last undone |
| `git_commit` | `%{message}` | Commit changes |
| `git_push` | `%{}` | Push to remote |

### 12.2 PubSub Topics

| Topic | Events |
|-------|--------|
| `world_builder:updates` | `:room_created`, `:room_updated`, `:room_deleted` |
| | `:npc_created`, `:npc_updated`, `:npc_deleted` |
| | `:item_created`, `:item_updated`, `:item_deleted` |
| | `:quest_created`, `:quest_updated`, `:quest_deleted` |
| | `:script_created`, `:script_updated`, `:script_deleted` |
| | `:validation_changed` |

### 12.3 Manager Function Signatures

```elixir
# RoomManager
RoomManager.create_room(attrs) :: {:ok, room} | {:error, reason}
RoomManager.get_room(key) :: {:ok, room} | {:error, :not_found}
RoomManager.update_room(key, attrs) :: {:ok, room} | {:error, reason}
RoomManager.delete_room(key) :: :ok | {:error, reason}
RoomManager.add_exit(from, dir, to, bidirectional \\ true) :: :ok | {:error, reason}
RoomManager.remove_exit(from, dir, bidirectional \\ true) :: :ok | {:error, reason}
RoomManager.list_rooms() :: [room]

# ScriptManager
ScriptManager.create_script(attrs) :: {:ok, script} | {:error, reason}
ScriptManager.get_script(key) :: {:ok, script} | {:error, :not_found}
ScriptManager.update_script(key, attrs) :: {:ok, script} | {:error, reason}
ScriptManager.delete_script(key) :: :ok | {:error, reason}
ScriptManager.validate_script(source) :: :ok | {:error, [errors]}
ScriptManager.test_script(key, entity, context) :: {:ok, result} | {:error, reason}
ScriptManager.list_scripts() :: [script]
ScriptManager.create_from_template(template_id, key, entity_key, opts) :: {:ok, script} | {:error, reason}

# ScriptTemplates
ScriptTemplates.list_templates() :: [template]
ScriptTemplates.get_template(id) :: {:ok, template} | {:error, :not_found}
ScriptTemplates.generate_code(template_id, options) :: {:ok, code} | {:error, reason}
```

---

## Summary

This document provides a complete specification for implementing the Loka World Builder with:

1. **Full entity CRUD** for rooms, NPCs, items, quests, dialogues, cutscenes
2. **Scripts system** with 15 templates and full code editor
3. **LLM integration** with BYOK auth and tool execution
4. **Undo/redo** for all operations
5. **Real-time validation** with visual feedback
6. **Git integration** for version control

**Timeline**: 10-11 weeks
**Total Effort**: ~376 hours

Ready for implementation. Create tasks from this plan and begin Phase 1.

---

**Document Maintainers**: @raymondluong, @claude
**Version**: 4.0
**Last Updated**: 2026-01-15
