# Loka World Builder - Master Design Document

**Status**: Planning
**Version**: 2.0
**Last Updated**: 2026-01-15

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
World Builder (Pure LiveView + JS Hooks)
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
| **LLM** | Claude Code OAuth (primary) / API Key (secondary) | Content generation (streaming) |
| **Storage** | YAML + SQLite | Your existing system |
| **Validation** | Existing validators | quest_validator.ex, etc. |

### File Structure

```
server/
├── lib/loka_web/live/admin_live/
│   ├── world_builder_live.ex         # Main LiveView
│   ├── world_builder/
│   │   ├── toolbar.ex                # Mode buttons (Edit, View, Test)
│   │   ├── hierarchy_panel.ex        # Tree view (zones, rooms, NPCs, quests)
│   │   ├── viewport_container.ex     # React 3D viewport bridge
│   │   ├── inspector_panel.ex        # Property editor
│   │   ├── chat_panel.ex             # Claude chat interface
│   │   ├── console_panel.ex          # Validation output (collapsible inline)
│   │   └── input_validator.ex        # Form validation
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
└── lib/loka/world_builder/
    ├── room_manager.ex               # Room CRUD
    ├── entity_manager.ex             # NPC/Item CRUD
    ├── quest_manager.ex              # Quest CRUD
    ├── cutscene_manager.ex           # Cutscene CRUD
    ├── template_manager.ex           # Load/save templates
    ├── layout_manager.ex             # Auto-layout algorithms
    ├── batch_operations.ex           # Bulk operations
    ├── validation_manager.ex         # Run all validators
    └── llm/
        ├── auth_manager.ex           # OAuth + API key management
        ├── claude_client.ex          # Claude API integration
        ├── context_builder.ex        # Build system prompt context
        ├── conversation_manager.ex   # Persist chat history
        ├── tool_executor.ex          # Execute tool calls safely
        ├── sandbox.ex                # Sandboxed tool execution
        └── style_presets.ex          # Style prompt templates
```

---

## User Interface Design

### Four-Column Layout with Collapsible Panels

All panels are collapsible to maximize workspace flexibility.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR (48px fixed)                                                         │
│ [🏗️ Edit] [🔍 View] [🧪 Test] │ 🔍 Search... │ [Zone ▼] │ [◀ ▶ ◀▶] panels  │
├───────────┬────────────────────────────────────┬──────────┬───────────────────┤
│ HIERARCHY │           3D VIEWPORT              │ INSPECTOR│ 💬 CLAUDE CHAT   │
│ (200px)   │           (flex)                   │ (260px)  │ (320px)          │
│ [◀ hide]  │                                    │ [hide ▶] │ [hide ▶]         │
│           │                                    │          │                  │
│ 🗂️ Zones  │    ┌─────┐   ┌─────┐               │ 📝 Room  │ ┌──────────────┐ │
│  └ monastery    │room1│───│room2│               │ ────────│ │Context:      │ │
│    └ temple │   └──┬──┘   └─────┘               │          │ │3 selected    │ │
│    └ garden │      │                            │ Key:     │ │2 errors      │ │
│           │    ┌──┴──┐                         │ [______] │ └──────────────┘ │
│ 📜 Quests │    │room3│                         │          │                  │
│  └ intro  │    └─────┘                         │ Name:    │ You:             │
│           │                                    │ [______] │ Create a spooky  │
│ 👥 NPCs   │                                    │          │ graveyard        │
│ 📦 Items  │                                    │ Desc:    │                  │
│ 🎬 Cutscenes                                   │ [______] │ Claude:          │
│           │   [Cam] [Zoom] [Rotate] [2D/3D]    │ [______] │ I'll create 4    │
│           │                                    │          │ rooms connected  │
│ ─ ─ ─ ─ ─ │                                    │ Exits:   │ to forest_edge...│
│ 🔍 filter │   ┌────────────────────────────┐   │ north →  │                  │
│           │   │ ⚠️ 2 errors │ [Validate]   │   │ [+ Add]  │ [🔧 create_room] │
│ [+ Create]│   └────────────────────────────┘   │          │ ✓ graveyard_gate │
│           │   (Console inline, expand on click)│[Validate]│                  │
│           │                                    │ [YAML ▼] │ [Type message...] │
└───────────┴────────────────────────────────────┴──────────┴───────────────────┘
```

### Panel States

| Panel | Default | Collapsed | Expanded |
|-------|---------|-----------|----------|
| **Hierarchy** | 200px | 40px (icons only) | 300px |
| **Inspector** | 260px | 40px (icon only) | 400px |
| **Chat** | 320px | 40px (icon only) | 500px |
| **Console** | Inline (1 line) | Hidden | 200px overlay |

### Keyboard Shortcuts for Panels

| Key | Action |
|-----|--------|
| `1` | Toggle Hierarchy |
| `2` | Toggle Inspector |
| `3` | Toggle Chat |
| `~` | Toggle Console |
| `0` | Reset all panels |

---

## LLM Integration: Claude Code OAuth

### Authentication Architecture

**Primary**: Claude Code OAuth (no API key required)
**Secondary**: Direct Anthropic API Key (fallback)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION A: Claude Code OAuth (Primary - Recommended)                        │
│  ─────────────────────────────────────────────────────                      │
│                                                                             │
│  User clicks "Connect with Claude" in World Builder                         │
│      ↓                                                                      │
│  Redirect to console.anthropic.com OAuth                                    │
│      ↓                                                                      │
│  User authorizes Loka World Builder                                         │
│      ↓                                                                      │
│  Callback with OAuth token                                                  │
│      ↓                                                                      │
│  Store token in user session (encrypted)                                    │
│      ↓                                                                      │
│  Use token for Claude API calls (user's quota)                              │
│                                                                             │
│  Benefits:                                                                  │
│  • No server-side API key needed                                            │
│  • Uses user's own Claude quota/billing                                     │
│  • Simpler setup for users                                                  │
│  • No cost to Loka server                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION B: Server API Key (Secondary - Admin Only)                          │
│  ─────────────────────────────────────────────────                          │
│                                                                             │
│  Admin configures ANTHROPIC_API_KEY in server env                           │
│      ↓                                                                      │
│  Server proxies all requests through its key                                │
│      ↓                                                                      │
│  Server tracks usage per user (rate limiting)                               │
│                                                                             │
│  Use cases:                                                                 │
│  • Shared team environments                                                 │
│  • Demo/trial accounts                                                      │
│  • Offline/air-gapped deployments                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### OAuth Implementation

```elixir
# lib/loka/world_builder/llm/auth_manager.ex
defmodule Loka.WorldBuilder.LLM.AuthManager do
  @moduledoc """
  Manages Claude authentication via OAuth or API key.

  Priority:
  1. User's OAuth token (if connected)
  2. Server's API key (if configured)
  3. None (LLM features disabled)
  """

  @oauth_client_id "loka-world-builder"
  @oauth_scopes ["messages:write", "messages:read"]

  def get_auth(user) do
    cond do
      oauth_token = get_oauth_token(user) ->
        {:oauth, oauth_token}

      api_key = System.get_env("ANTHROPIC_API_KEY") ->
        {:api_key, api_key}

      true ->
        {:error, :no_auth}
    end
  end

  def oauth_authorize_url(user_id) do
    state = generate_state(user_id)

    "https://console.anthropic.com/oauth/authorize?" <>
    URI.encode_query(%{
      client_id: @oauth_client_id,
      redirect_uri: oauth_callback_url(),
      scope: Enum.join(@oauth_scopes, " "),
      state: state,
      response_type: "code"
    })
  end

  def handle_oauth_callback(code, state) do
    with {:ok, user_id} <- verify_state(state),
         {:ok, token} <- exchange_code_for_token(code) do
      store_oauth_token(user_id, token)
      {:ok, user_id}
    end
  end
end
```

### Sandboxing & API Surface Area

The LLM has access to a **strictly limited set of tools**. All tool execution is sandboxed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SANDBOX ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Claude's Tool Calls                                                        │
│       ↓                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SANDBOX LAYER (tool_executor.ex)                                     │   │
│  │                                                                      │   │
│  │ 1. ALLOWLIST CHECK                                                   │   │
│  │    Only these tools are permitted:                                   │   │
│  │    ✓ create_room, update_room, delete_room                          │   │
│  │    ✓ create_npc, update_npc, delete_npc                             │   │
│  │    ✓ create_item, update_item, delete_item                          │   │
│  │    ✓ create_quest, update_quest, delete_quest                       │   │
│  │    ✓ create_cutscene, update_cutscene, delete_cutscene              │   │
│  │    ✓ create_dialogue, update_dialogue, delete_dialogue              │   │
│  │    ✓ add_exit, remove_exit                                          │   │
│  │    ✓ run_validation                                                 │   │
│  │    ✓ list_rooms, list_npcs, list_items, list_quests                 │   │
│  │    ✓ get_room, get_npc, get_item, get_quest                         │   │
│  │    ✗ NOTHING ELSE                                                    │   │
│  │                                                                      │   │
│  │ 2. PARAMETER VALIDATION                                              │   │
│  │    • Keys must match ^[a-z][a-z0-9_]*$ (safe identifiers)           │   │
│  │    • Coordinates must be integers in range -1000..1000               │   │
│  │    • Descriptions max 10,000 characters                              │   │
│  │    • No path traversal in any field                                  │   │
│  │    • No code injection in script fields                              │   │
│  │                                                                      │   │
│  │ 3. RATE LIMITING                                                     │   │
│  │    • Max 100 tool calls per conversation                             │   │
│  │    • Max 50 creates per hour                                         │   │
│  │    • Max 200 updates per hour                                        │   │
│  │    • Max 20 deletes per hour                                         │   │
│  │                                                                      │   │
│  │ 4. AUDIT LOGGING                                                     │   │
│  │    • Every tool call logged with user, timestamp, params             │   │
│  │    • Failures logged with reason                                     │   │
│  │    • Anomaly detection (unusual patterns)                            │   │
│  │                                                                      │   │
│  │ 5. ROLLBACK CAPABILITY                                               │   │
│  │    • All changes within conversation can be rolled back              │   │
│  │    • "Undo all" button in chat panel                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       ↓                                                                     │
│  World Builder Managers (RoomManager, EntityManager, etc.)                  │
│       ↓                                                                     │
│  TypedObject / YAML Files                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Claude CAN and CANNOT Do

| CAN DO | CANNOT DO |
|--------|-----------|
| Create/edit/delete rooms, NPCs, items, quests, cutscenes, dialogues | Execute arbitrary Elixir code |
| Connect rooms with exits | Access database directly |
| Run validation checks | Read/write arbitrary files |
| Query existing content | Access player data |
| Apply style presets | Modify game engine code |
| Generate descriptions | Access network/external APIs |
| Suggest fixes for errors | Delete system files |
| Bulk generate content | Bypass rate limits |

### Tool Definitions

```elixir
@tools [
  # ─────────────────────────────────────────────────────────────────────────
  # ROOM TOOLS
  # ─────────────────────────────────────────────────────────────────────────
  %{
    name: "create_room",
    description: "Create a new room in the world",
    input_schema: %{
      type: "object",
      required: ["key", "name"],
      properties: %{
        key: %{type: "string", pattern: "^[a-z][a-z0-9_]*$", description: "Unique identifier"},
        name: %{type: "string", maxLength: 100, description: "Display name"},
        description: %{type: "string", maxLength: 10000, description: "Room description"},
        x: %{type: "integer", minimum: -1000, maximum: 1000, description: "X coordinate"},
        y: %{type: "integer", minimum: -1000, maximum: 1000, description: "Y coordinate"},
        z: %{type: "integer", minimum: -1000, maximum: 1000, description: "Z coordinate (level)"},
        zone: %{type: "string", description: "Zone this room belongs to"},
        tags: %{type: "array", items: %{type: "string"}, description: "Room tags"}
      }
    }
  },
  %{
    name: "update_room",
    description: "Update an existing room's properties",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string", description: "Room key to update"},
        name: %{type: "string", maxLength: 100},
        description: %{type: "string", maxLength: 10000},
        x: %{type: "integer", minimum: -1000, maximum: 1000},
        y: %{type: "integer", minimum: -1000, maximum: 1000},
        z: %{type: "integer", minimum: -1000, maximum: 1000},
        zone: %{type: "string"},
        tags: %{type: "array", items: %{type: "string"}}
      }
    }
  },
  %{
    name: "delete_room",
    description: "Delete a room (will also remove all exits pointing to it)",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string", description: "Room key to delete"}
      }
    }
  },
  %{
    name: "add_exit",
    description: "Add an exit from one room to another",
    input_schema: %{
      type: "object",
      required: ["from_room", "direction", "to_room"],
      properties: %{
        from_room: %{type: "string", description: "Source room key"},
        direction: %{type: "string", enum: ["north", "south", "east", "west", "up", "down", "northeast", "northwest", "southeast", "southwest"], description: "Exit direction"},
        to_room: %{type: "string", description: "Destination room key"},
        bidirectional: %{type: "boolean", default: true, description: "Also create reverse exit"}
      }
    }
  },
  %{
    name: "remove_exit",
    description: "Remove an exit from a room",
    input_schema: %{
      type: "object",
      required: ["from_room", "direction"],
      properties: %{
        from_room: %{type: "string", description: "Source room key"},
        direction: %{type: "string", description: "Exit direction to remove"},
        bidirectional: %{type: "boolean", default: true, description: "Also remove reverse exit"}
      }
    }
  },

  # ─────────────────────────────────────────────────────────────────────────
  # NPC TOOLS
  # ─────────────────────────────────────────────────────────────────────────
  %{
    name: "create_npc",
    description: "Create a new NPC",
    input_schema: %{
      type: "object",
      required: ["key", "name"],
      properties: %{
        key: %{type: "string", pattern: "^[a-z][a-z0-9_]*$"},
        name: %{type: "string", maxLength: 100},
        description: %{type: "string", maxLength: 10000},
        level: %{type: "integer", minimum: 1, maximum: 100, default: 1},
        room_key: %{type: "string", description: "Room where NPC spawns"},
        npc_type: %{type: "string", enum: ["quest_giver", "merchant", "enemy", "ambient", "boss"]},
        dialogue_key: %{type: "string", description: "Dialogue tree to use"},
        tags: %{type: "array", items: %{type: "string"}}
      }
    }
  },
  %{
    name: "update_npc",
    description: "Update an existing NPC",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"},
        name: %{type: "string", maxLength: 100},
        description: %{type: "string", maxLength: 10000},
        level: %{type: "integer", minimum: 1, maximum: 100},
        room_key: %{type: "string"},
        npc_type: %{type: "string", enum: ["quest_giver", "merchant", "enemy", "ambient", "boss"]},
        dialogue_key: %{type: "string"},
        tags: %{type: "array", items: %{type: "string"}}
      }
    }
  },
  %{
    name: "delete_npc",
    description: "Delete an NPC",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"}
      }
    }
  },

  # ─────────────────────────────────────────────────────────────────────────
  # ITEM TOOLS
  # ─────────────────────────────────────────────────────────────────────────
  %{
    name: "create_item",
    description: "Create a new item",
    input_schema: %{
      type: "object",
      required: ["key", "name"],
      properties: %{
        key: %{type: "string", pattern: "^[a-z][a-z0-9_]*$"},
        name: %{type: "string", maxLength: 100},
        description: %{type: "string", maxLength: 10000},
        item_type: %{type: "string", enum: ["weapon", "armor", "consumable", "quest_item", "misc", "key", "tool"]},
        tags: %{type: "array", items: %{type: "string"}}
      }
    }
  },
  %{
    name: "update_item",
    description: "Update an existing item",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"},
        name: %{type: "string", maxLength: 100},
        description: %{type: "string", maxLength: 10000},
        item_type: %{type: "string", enum: ["weapon", "armor", "consumable", "quest_item", "misc", "key", "tool"]},
        tags: %{type: "array", items: %{type: "string"}}
      }
    }
  },
  %{
    name: "delete_item",
    description: "Delete an item",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"}
      }
    }
  },

  # ─────────────────────────────────────────────────────────────────────────
  # QUEST TOOLS
  # ─────────────────────────────────────────────────────────────────────────
  %{
    name: "create_quest",
    description: "Create a new quest with objectives",
    input_schema: %{
      type: "object",
      required: ["key", "name", "giver_key"],
      properties: %{
        key: %{type: "string", pattern: "^[a-z][a-z0-9_]*$"},
        name: %{type: "string", maxLength: 100},
        description: %{type: "string", maxLength: 10000},
        quest_type: %{type: "string", enum: ["main", "side", "daily", "tutorial"]},
        giver_key: %{type: "string", description: "NPC who gives this quest"},
        objectives: %{type: "array", items: %{
          type: "object",
          properties: %{
            type: %{type: "string", enum: ["talk", "kill", "get_item", "go_to", "use_item"]},
            target: %{type: "string"},
            count: %{type: "integer", minimum: 1},
            description: %{type: "string"}
          }
        }},
        rewards: %{type: "object", properties: %{
          xp: %{type: "integer"},
          gold: %{type: "integer"},
          items: %{type: "array", items: %{type: "string"}}
        }},
        prerequisites: %{type: "array", items: %{type: "string"}, description: "Quest keys that must be completed first"}
      }
    }
  },
  %{
    name: "update_quest",
    description: "Update an existing quest",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"},
        name: %{type: "string"},
        description: %{type: "string"},
        quest_type: %{type: "string"},
        giver_key: %{type: "string"},
        objectives: %{type: "array"},
        rewards: %{type: "object"},
        prerequisites: %{type: "array"}
      }
    }
  },
  %{
    name: "delete_quest",
    description: "Delete a quest",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"}
      }
    }
  },

  # ─────────────────────────────────────────────────────────────────────────
  # DIALOGUE TOOLS
  # ─────────────────────────────────────────────────────────────────────────
  %{
    name: "create_dialogue",
    description: "Create a dialogue tree for an NPC",
    input_schema: %{
      type: "object",
      required: ["key", "npc_key"],
      properties: %{
        key: %{type: "string", pattern: "^[a-z][a-z0-9_]*$"},
        npc_key: %{type: "string", description: "NPC this dialogue belongs to"},
        nodes: %{type: "array", items: %{
          type: "object",
          properties: %{
            id: %{type: "string"},
            text: %{type: "string"},
            choices: %{type: "array", items: %{
              type: "object",
              properties: %{
                text: %{type: "string"},
                next: %{type: "string"},
                conditions: %{type: "object"},
                actions: %{type: "array"}
              }
            }}
          }
        }}
      }
    }
  },
  %{
    name: "update_dialogue",
    description: "Update an existing dialogue tree",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"},
        npc_key: %{type: "string"},
        nodes: %{type: "array"}
      }
    }
  },
  %{
    name: "delete_dialogue",
    description: "Delete a dialogue tree",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"}
      }
    }
  },

  # ─────────────────────────────────────────────────────────────────────────
  # CUTSCENE TOOLS
  # ─────────────────────────────────────────────────────────────────────────
  %{
    name: "create_cutscene",
    description: "Create a cutscene/event sequence",
    input_schema: %{
      type: "object",
      required: ["id", "trigger"],
      properties: %{
        id: %{type: "string", pattern: "^[a-z][a-z0-9_]*$"},
        trigger: %{type: "object", properties: %{
          type: %{type: "string", enum: ["enter_room", "talk_to", "quest_complete", "use_item", "manual"]},
          target: %{type: "string"}
        }},
        sequence: %{type: "array", items: %{
          type: "object",
          properties: %{
            type: %{type: "string", enum: ["narration", "dialogue", "fade", "wait", "sound", "teleport", "give_item", "set_flag", "start_quest"]},
            params: %{type: "object"}
          }
        }}
      }
    }
  },
  %{
    name: "update_cutscene",
    description: "Update an existing cutscene",
    input_schema: %{
      type: "object",
      required: ["id"],
      properties: %{
        id: %{type: "string"},
        trigger: %{type: "object"},
        sequence: %{type: "array"}
      }
    }
  },
  %{
    name: "delete_cutscene",
    description: "Delete a cutscene",
    input_schema: %{
      type: "object",
      required: ["id"],
      properties: %{
        id: %{type: "string"}
      }
    }
  },

  # ─────────────────────────────────────────────────────────────────────────
  # QUERY TOOLS (Read-only)
  # ─────────────────────────────────────────────────────────────────────────
  %{
    name: "list_rooms",
    description: "List all rooms, optionally filtered by zone",
    input_schema: %{
      type: "object",
      properties: %{
        zone: %{type: "string", description: "Filter by zone"},
        limit: %{type: "integer", maximum: 100, default: 50}
      }
    }
  },
  %{
    name: "get_room",
    description: "Get detailed information about a specific room",
    input_schema: %{
      type: "object",
      required: ["key"],
      properties: %{
        key: %{type: "string"}
      }
    }
  },
  %{
    name: "list_npcs",
    description: "List all NPCs, optionally filtered",
    input_schema: %{
      type: "object",
      properties: %{
        room_key: %{type: "string"},
        npc_type: %{type: "string"},
        limit: %{type: "integer", maximum: 100, default: 50}
      }
    }
  },
  %{
    name: "list_items",
    description: "List all items",
    input_schema: %{
      type: "object",
      properties: %{
        item_type: %{type: "string"},
        limit: %{type: "integer", maximum: 100, default: 50}
      }
    }
  },
  %{
    name: "list_quests",
    description: "List all quests",
    input_schema: %{
      type: "object",
      properties: %{
        quest_type: %{type: "string"},
        giver_key: %{type: "string"},
        limit: %{type: "integer", maximum: 100, default: 50}
      }
    }
  },

  # ─────────────────────────────────────────────────────────────────────────
  # VALIDATION TOOLS
  # ─────────────────────────────────────────────────────────────────────────
  %{
    name: "run_validation",
    description: "Run validation checks on specified entities or all entities",
    input_schema: %{
      type: "object",
      properties: %{
        entity_keys: %{type: "array", items: %{type: "string"}, description: "Specific keys to validate (empty = all)"},
        types: %{type: "array", items: %{type: "string", enum: ["room", "npc", "item", "quest", "dialogue", "cutscene"]}, description: "Entity types to validate"}
      }
    }
  }
]
```

---

## Comprehensive Feature Specifications

### 1. Layout & Panels

#### 1.1 Toolbar
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| TB-001 | Mode Buttons | Edit/View/Test mode toggle | Click each mode, verify UI changes |
| TB-002 | Global Search | Search all entities by name/key | Type "tavern", verify results |
| TB-003 | Zone Selector | Dropdown to filter by zone | Select zone, verify hierarchy filters |
| TB-004 | Panel Toggles | Show/hide each panel | Toggle each, verify collapse/expand |
| TB-005 | Undo/Redo | Ctrl+Z/Ctrl+Y for actions | Create room, undo, verify removed |
| TB-006 | Save Indicator | Shows unsaved changes | Edit room, verify indicator |

#### 1.2 Hierarchy Panel
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| HP-001 | Tree View | Expandable tree of all entities | Expand/collapse nodes |
| HP-002 | Entity Counts | Badge showing count per category | Create entity, verify count updates |
| HP-003 | Click to Select | Single click selects in viewport | Click room, verify 3D selection |
| HP-004 | Double-click Edit | Opens inspector for editing | Double-click, verify inspector opens |
| HP-005 | Right-click Menu | Clone, Delete, Properties | Right-click, verify menu appears |
| HP-006 | Drag to Reorder | Reorder items in tree | Drag room, verify new position |
| HP-007 | Filter by Type | Filter buttons for entity types | Click "Quests", verify filter |
| HP-008 | Search in Tree | Local search within hierarchy | Type in filter, verify results |
| HP-009 | Validation Icons | Warning/error icons on items | Create invalid room, verify icon |
| HP-010 | Collapse Panel | Toggle to 40px icons-only mode | Click collapse, verify width |

#### 1.3 Viewport (3D)
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| VP-001 | Room Cubes | Render rooms as 3D cubes | Create room, verify cube appears |
| VP-002 | Exit Lines | Lines connecting rooms | Add exit, verify line draws |
| VP-003 | NPC Markers | Icons above rooms with NPCs | Create NPC in room, verify icon |
| VP-004 | Item Labels | Floating text for items | Create item, verify label |
| VP-005 | Click to Select | Click cube to select | Click room cube, verify selected |
| VP-006 | Drag to Move | Drag cube to reposition | Drag room, verify coords update |
| VP-007 | Box Select | Shift+drag to multi-select | Draw box, verify multiple selected |
| VP-008 | Camera Pan | Ctrl+drag or middle-click | Pan camera, verify movement |
| VP-009 | Camera Zoom | Scroll wheel zoom | Scroll, verify zoom level |
| VP-010 | Camera Rotate | Right-drag to orbit | Orbit camera, verify rotation |
| VP-011 | 2D/3D Toggle | Switch between top-down and 3D | Toggle, verify view mode |
| VP-012 | Grid Display | Optional grid overlay | Toggle grid, verify display |
| VP-013 | Snap to Grid | Snap positions to grid | Move room, verify snaps |
| VP-014 | Validation Glow | Red/yellow/green glow on cubes | Create invalid room, verify red glow |
| VP-015 | Selection Highlight | Outline on selected items | Select room, verify highlight |
| VP-016 | Hover Tooltip | Show name on hover | Hover room, verify tooltip |
| VP-017 | Reset View | Button to reset camera | Click reset, verify default view |
| VP-018 | Fit to Selection | Zoom to show selected items | Select rooms, click fit, verify |

#### 1.4 Inspector Panel
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| IP-001 | Context Sensitive | Shows form for selected type | Select room, verify room form |
| IP-002 | Room Form | Key, name, desc, coords, zone, tags | Edit each field, verify saves |
| IP-003 | NPC Form | Key, name, desc, level, type, room | Edit each field, verify saves |
| IP-004 | Item Form | Key, name, desc, type, tags | Edit each field, verify saves |
| IP-005 | Quest Form | Key, name, giver, objectives, rewards | Edit each field, verify saves |
| IP-006 | Exit Editor | List of exits with add/remove | Add exit, verify in viewport |
| IP-007 | Contents List | NPCs/items in selected room | Add NPC to room, verify shows |
| IP-008 | YAML Preview | Toggle to show raw YAML | Click YAML, verify display |
| IP-009 | Validate Button | Run validation on selected | Click validate, verify results |
| IP-010 | Delete Button | Delete selected entity | Click delete, verify removed |
| IP-011 | Clone Button | Clone selected entity | Click clone, verify copy created |
| IP-012 | Collapse Panel | Toggle to 40px icon mode | Click collapse, verify width |
| IP-013 | Multi-select Edit | Edit common fields for multiple | Select 3 rooms, edit zone, verify all updated |

#### 1.5 Chat Panel
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| CP-001 | Message Display | Show conversation history | Send message, verify displays |
| CP-002 | Streaming Response | Real-time streaming from Claude | Send request, verify streams |
| CP-003 | Tool Call Display | Show [🔧 tool_name] indicators | Send "create room", verify tool shown |
| CP-004 | Context Summary | Show selected items, errors at top | Select 3 rooms, verify context |
| CP-005 | Send Message | Input field + send button | Type message, click send |
| CP-006 | OAuth Connect | "Connect with Claude" button | Click, verify OAuth redirect |
| CP-007 | Auth Status | Show connected/disconnected | Connect, verify status badge |
| CP-008 | Conversation History | Persist across refreshes | Send message, refresh, verify persists |
| CP-009 | Clear History | Button to clear conversation | Click clear, verify empty |
| CP-010 | Undo All | Rollback all LLM changes | Click undo all, verify reverts |
| CP-011 | Style Presets | Dropdown for style | Select "dark fantasy", send request |
| CP-012 | Collapse Panel | Toggle to 40px icon mode | Click collapse, verify width |
| CP-013 | Error Display | Show API errors gracefully | Disconnect, verify error message |

#### 1.6 Console Panel
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| CN-001 | Inline Display | Show error/warning count inline | Create invalid room, verify count |
| CN-002 | Expand on Click | Click to expand full console | Click inline, verify expands |
| CN-003 | Error List | List all validation errors | Run validation, verify list |
| CN-004 | Click to Select | Click error to select entity | Click error, verify selects in viewport |
| CN-005 | Auto-Fix Button | Fix safe issues automatically | Click auto-fix, verify fixes |
| CN-006 | Export Report | Download validation report | Click export, verify download |
| CN-007 | Filter by Severity | Show only errors/warnings/info | Toggle filter, verify results |
| CN-008 | Clear Console | Clear all messages | Click clear, verify empty |

### 2. Entity Management

#### 2.1 Room Operations
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| RM-001 | Create Room | Create room via UI | Fill form, submit, verify created |
| RM-002 | Create Room (LLM) | "Create a tavern" | Send to Claude, verify room created |
| RM-003 | Update Room | Edit room properties | Change name, verify updated |
| RM-004 | Update Room (LLM) | "Make it spookier" | Send to Claude, verify updated |
| RM-005 | Delete Room | Delete room | Click delete, verify removed |
| RM-006 | Delete Room (LLM) | "Delete the tavern" | Send to Claude, verify deleted |
| RM-007 | Clone Room | Duplicate room | Click clone, verify copy |
| RM-008 | Batch Move | Move multiple rooms | Select 3, move by offset |
| RM-009 | Batch Delete | Delete multiple rooms | Select 3, delete all |
| RM-010 | Batch Clone | Clone multiple rooms | Select 3, clone with offset |
| RM-011 | Add Exit | Connect two rooms | Use UI or drag in viewport |
| RM-012 | Add Exit (LLM) | "Connect tavern to square" | Send to Claude, verify exit |
| RM-013 | Remove Exit | Remove connection | Click X on exit, verify removed |
| RM-014 | Bidirectional Exit | Toggle auto-create reverse | Create exit, verify reverse created |
| RM-015 | Template Create | Create from template | Select template, instantiate |
| RM-016 | Save as Template | Save room as template | Click save as template, verify |
| RM-017 | Coordinate Update | Drag updates x/y/z | Drag in viewport, verify coords |
| RM-018 | Zone Assignment | Assign room to zone | Select zone in form, verify |

#### 2.2 NPC Operations
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| NP-001 | Create NPC | Create NPC via UI | Fill form, submit, verify |
| NP-002 | Create NPC (LLM) | "Create a grumpy merchant" | Send to Claude, verify |
| NP-003 | Update NPC | Edit NPC properties | Change level, verify |
| NP-004 | Delete NPC | Delete NPC | Click delete, verify |
| NP-005 | Assign to Room | Set spawn room | Select room, verify |
| NP-006 | Link Dialogue | Connect dialogue tree | Select dialogue, verify |
| NP-007 | NPC Type | Set type (quest_giver, etc.) | Change type, verify icon |

#### 2.3 Item Operations
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| IT-001 | Create Item | Create item via UI | Fill form, submit, verify |
| IT-002 | Create Item (LLM) | "Create a magic sword" | Send to Claude, verify |
| IT-003 | Update Item | Edit item properties | Change type, verify |
| IT-004 | Delete Item | Delete item | Click delete, verify |
| IT-005 | Item Type | Set type (weapon, armor, etc.) | Change type, verify |

#### 2.4 Quest Operations
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| QU-001 | Create Quest | Create quest via wizard | Fill form, submit, verify |
| QU-002 | Create Quest (LLM) | "Create a fetch quest" | Send to Claude, verify |
| QU-003 | Update Quest | Edit quest properties | Change rewards, verify |
| QU-004 | Delete Quest | Delete quest | Click delete, verify |
| QU-005 | Add Objective | Add quest objective | Click add, fill, verify |
| QU-006 | Remove Objective | Remove objective | Click remove, verify |
| QU-007 | Set Prerequisites | Link to other quests | Add prereq, verify |
| QU-008 | Set Rewards | XP, gold, items | Set rewards, verify |
| QU-009 | Quest Giver | Assign NPC as giver | Select NPC, verify |
| QU-010 | Quest Validation | Validate quest chain | Run validation, verify |

#### 2.5 Dialogue Operations
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| DI-001 | Create Dialogue | Create dialogue tree | Create nodes, verify |
| DI-002 | Create Dialogue (LLM) | "Create spooky dialogue" | Send to Claude, verify |
| DI-003 | Update Dialogue | Edit dialogue nodes | Change text, verify |
| DI-004 | Delete Dialogue | Delete dialogue | Click delete, verify |
| DI-005 | Add Node | Add dialogue node | Click add, verify |
| DI-006 | Add Choice | Add player choice | Click add choice, verify |
| DI-007 | Link to NPC | Assign to NPC | Select NPC, verify |
| DI-008 | Add Conditions | Conditional branches | Add condition, verify |
| DI-009 | Add Actions | Quest start, give item, etc. | Add action, verify |

#### 2.6 Cutscene Operations
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| CU-001 | Create Cutscene | Create cutscene | Create trigger + sequence |
| CU-002 | Create Cutscene (LLM) | "Create ghost encounter" | Send to Claude, verify |
| CU-003 | Update Cutscene | Edit cutscene | Change sequence, verify |
| CU-004 | Delete Cutscene | Delete cutscene | Click delete, verify |
| CU-005 | Set Trigger | Room enter, talk, etc. | Set trigger, verify |
| CU-006 | Add Sequence Step | Narration, dialogue, fade | Add step, verify |
| CU-007 | Reorder Steps | Drag to reorder | Drag step, verify order |
| CU-008 | Preview Cutscene | Play preview | Click play, verify plays |

### 3. LLM Features

#### 3.1 Authentication
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| AU-001 | OAuth Connect | Connect via Claude OAuth | Click connect, complete flow |
| AU-002 | OAuth Callback | Handle OAuth callback | Complete flow, verify connected |
| AU-003 | Token Storage | Store token securely | Connect, verify token persists |
| AU-004 | Token Refresh | Auto-refresh expired token | Wait for expiry, verify refresh |
| AU-005 | Disconnect | Remove OAuth connection | Click disconnect, verify |
| AU-006 | API Key Fallback | Use server key if no OAuth | Configure key, verify works |
| AU-007 | Auth Status UI | Show connection status | View UI, verify correct status |

#### 3.2 Context Building
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| CX-001 | Selection Context | Include selected entities | Select 3 rooms, send message, verify context |
| CX-002 | Zone Context | Include current zone info | Select zone, send message, verify context |
| CX-003 | Validation Errors | Include validation errors | Create invalid room, send message, verify |
| CX-004 | Existing Keys | Include all keys (no duplicates) | Send "create room", verify unique key |
| CX-005 | Nearby Entities | Include adjacent rooms | Select room, verify neighbors in context |

#### 3.3 Tool Execution
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| TX-001 | Execute Create | Execute create_* tools | Send "create room", verify created |
| TX-002 | Execute Update | Execute update_* tools | Send "rename room", verify updated |
| TX-003 | Execute Delete | Execute delete_* tools | Send "delete room", verify deleted |
| TX-004 | Execute Query | Execute list_*/get_* tools | Send "list rooms", verify response |
| TX-005 | Execute Validation | Execute run_validation | Send "validate", verify results |
| TX-006 | Parameter Validation | Reject invalid params | Send bad key format, verify error |
| TX-007 | Rate Limiting | Enforce rate limits | Send 51 creates, verify rate limit |
| TX-008 | Audit Logging | Log all tool calls | Check logs after call |

#### 3.4 Real-time Updates
| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| RT-001 | Room Created | Flash animation on create | Create via LLM, verify flash |
| RT-002 | Room Updated | Flash animation on update | Update via LLM, verify flash |
| RT-003 | Room Deleted | Fade animation on delete | Delete via LLM, verify fade |
| RT-004 | Exit Created | Line draws animation | Add exit via LLM, verify animation |
| RT-005 | Hierarchy Update | Tree updates in real-time | Create entity, verify tree updates |
| RT-006 | Inspector Update | Inspector refreshes | Update selected, verify inspector |

### 4. Validation

| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| VA-001 | Room Validation | Missing exits, unreachable | Create orphan room, verify error |
| VA-002 | Quest Validation | Missing giver, invalid objectives | Create bad quest, verify error |
| VA-003 | Dialogue Validation | Missing nodes, dead ends | Create broken dialogue, verify |
| VA-004 | Cutscene Validation | Invalid triggers, missing targets | Create bad cutscene, verify |
| VA-005 | Cross-entity Validation | NPC references missing room | Create NPC for missing room, verify |
| VA-006 | Real-time Validation | Validate on every change | Edit room, verify immediate feedback |
| VA-007 | Batch Validation | Validate all entities | Click "Validate All", verify |
| VA-008 | Visual Indicators | Glow colors in viewport | Create invalid room, verify red glow |
| VA-009 | Click to Navigate | Click error to select entity | Click error, verify selection |

### 5. Templates & Presets

| Feature ID | Feature | Description | Testable |
|------------|---------|-------------|----------|
| TP-001 | Built-in Templates | Tavern, shop, dungeon, etc. | List templates, verify exists |
| TP-002 | Template Preview | Preview before instantiate | Hover template, verify preview |
| TP-003 | Instantiate Template | Create room from template | Select template, instantiate |
| TP-004 | Save as Template | Save room as template | Save, verify in template list |
| TP-005 | Template Search | Search templates | Type "dungeon", verify results |
| TP-006 | Style Presets | Dark fantasy, whimsical, etc. | Select style, send LLM request |

---

## End-to-End Testing Strategy

### Test Harness: Mini Subzone Builder

The E2E test creates a complete **"Test Graveyard" subzone** connected to the main monastery zone, exercises all features, validates data integrity, and tears down cleanly.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     E2E TEST: GRAVEYARD SUBZONE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SETUP                                                                   │
│     • Record initial state (room count, NPC count, etc.)                    │
│     • Start test transaction (for rollback)                                 │
│                                                                             │
│  2. CREATE ZONE STRUCTURE                                                   │
│     Via UI:                                                                 │
│     • Create room "test_graveyard_entrance"                                 │
│     • Create room "test_graveyard_center"                                   │
│     • Create room "test_crypt"                                              │
│     • Add exits between rooms                                               │
│     • Connect to monastery zone (test_graveyard_entrance → monastery_gate)  │
│                                                                             │
│     Via LLM:                                                                │
│     • "Create 2 more spooky rooms in the graveyard"                         │
│     • Verify rooms created with appropriate descriptions                    │
│     • Verify exits connected                                                │
│                                                                             │
│  3. POPULATE WITH ENTITIES                                                  │
│     Via UI:                                                                 │
│     • Create NPC "test_ghost" in test_crypt                                 │
│     • Create NPC "test_gravedigger" in test_graveyard_entrance              │
│     • Create Item "test_ancient_key" (quest item)                           │
│     • Create Item "test_rusty_shovel" (tool)                                │
│                                                                             │
│     Via LLM:                                                                │
│     • "Create a spooky dialogue for the ghost"                              │
│     • "Create a quest where player finds the ancient key"                   │
│     • Verify quest objectives reference correct entities                    │
│                                                                             │
│  4. CREATE CUTSCENE                                                         │
│     • Create cutscene "test_ghost_encounter"                                │
│     • Trigger: enter test_crypt                                             │
│     • Sequence: narration → dialogue → give item                            │
│     • Verify trigger and sequence valid                                     │
│                                                                             │
│  5. VALIDATION CHECKS                                                       │
│     • Run full validation                                                   │
│     • Verify 0 errors                                                       │
│     • Verify all test_* entities connected correctly                        │
│     • Verify exits are bidirectional                                        │
│     • Verify quest chain is completable                                     │
│                                                                             │
│  6. DATA INTEGRITY CHECKS                                                   │
│     • Verify rooms in YAML files                                            │
│     • Verify NPCs in YAML files                                             │
│     • Verify items in YAML files                                            │
│     • Verify quest in YAML files                                            │
│     • Verify dialogue in YAML files                                         │
│     • Verify cutscene in YAML files                                         │
│     • Verify all keys are unique                                            │
│     • Verify no orphaned references                                         │
│                                                                             │
│  7. VIEWPORT VERIFICATION                                                   │
│     • Verify all rooms visible as cubes                                     │
│     • Verify all exits visible as lines                                     │
│     • Verify NPC markers on rooms                                           │
│     • Verify selection works                                                │
│     • Verify drag-to-move works                                             │
│                                                                             │
│  8. INSPECTOR VERIFICATION                                                  │
│     • Select each room, verify inspector shows correct data                 │
│     • Edit room via inspector, verify saves                                 │
│     • Verify exit editor works                                              │
│     • Verify contents list accurate                                         │
│                                                                             │
│  9. LLM INTEGRATION VERIFICATION                                            │
│     • Verify context includes selected entities                             │
│     • Verify tool calls execute correctly                                   │
│     • Verify streaming response works                                       │
│     • Verify real-time updates flash in viewport                            │
│                                                                             │
│  10. TEARDOWN                                                               │
│     Via LLM:                                                                │
│     • "Delete all test_* entities"                                          │
│     • Verify all test entities removed                                      │
│                                                                             │
│     Via UI (fallback):                                                      │
│     • Delete any remaining test_* entities                                  │
│     • Remove exit from monastery_gate to test zone                          │
│                                                                             │
│  11. VERIFY CLEAN STATE                                                     │
│     • Verify room count matches initial                                     │
│     • Verify NPC count matches initial                                      │
│     • Verify no test_* keys remain in any YAML                              │
│     • Verify validation still passes                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Implementation

```elixir
# test/integration/world_builder_e2e_test.exs
defmodule Loka.WorldBuilder.E2ETest do
  use Loka.DataCase, async: false
  use Loka.FeatureCase

  @test_prefix "test_e2e_"

  describe "World Builder E2E: Graveyard Subzone" do
    setup do
      # Record initial state
      initial_room_count = RoomManager.count_rooms()
      initial_npc_count = EntityManager.count_entities(:npc)

      on_exit(fn ->
        # Cleanup any remaining test entities
        cleanup_test_entities()
      end)

      %{
        initial_room_count: initial_room_count,
        initial_npc_count: initial_npc_count
      }
    end

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 1: Room Creation
    # ─────────────────────────────────────────────────────────────────────────

    test "creates rooms via UI", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin/world-builder")

      # Create entrance room
      view
      |> element("[data-action='create-room']")
      |> render_click()

      view
      |> form("#create-room-form", %{
        key: "#{@test_prefix}graveyard_entrance",
        name: "Graveyard Entrance",
        description: "A rusted iron gate marks the entrance.",
        x: 100, y: 0, z: 0
      })
      |> render_submit()

      # Verify room created
      assert {:ok, room} = RoomManager.get_room("#{@test_prefix}graveyard_entrance")
      assert room.name == "Graveyard Entrance"

      # Verify appears in viewport
      assert view |> element("[data-room-key='#{@test_prefix}graveyard_entrance']") |> has_element?()
    end

    test "creates rooms via LLM", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/admin/world-builder")

      # Send LLM request
      view
      |> element("#chat-input")
      |> render_change(%{message: "Create a spooky crypt room east of #{@test_prefix}graveyard_entrance"})

      view
      |> element("[data-action='send-message']")
      |> render_click()

      # Wait for LLM response
      assert_receive {:tool_executed, "create_room", _}, 10_000

      # Verify room created
      rooms = RoomManager.list_rooms()
      crypt = Enum.find(rooms, &String.contains?(&1.key, "crypt"))
      assert crypt != nil
      assert String.contains?(crypt.description, ["spooky", "dark", "crypt"])
    end

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 2: Exit Management
    # ─────────────────────────────────────────────────────────────────────────

    test "creates exits via UI", %{conn: conn} do
      # ... (similar pattern)
    end

    test "creates bidirectional exits via LLM", %{conn: conn} do
      # ... (similar pattern)
    end

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 3: NPC/Item Creation
    # ─────────────────────────────────────────────────────────────────────────

    test "creates NPCs with dialogue via LLM", %{conn: conn} do
      # ... (similar pattern)
    end

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 4: Quest Creation
    # ─────────────────────────────────────────────────────────────────────────

    test "creates quest with objectives via LLM", %{conn: conn} do
      # ... (similar pattern)
    end

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 5: Validation
    # ─────────────────────────────────────────────────────────────────────────

    test "validates entire test zone", %{conn: conn} do
      # Run validation
      {:ok, results} = ValidationManager.validate_all()

      # Filter to test entities
      test_errors = Enum.filter(results.errors, &String.starts_with?(&1.key, @test_prefix))

      # Should have no errors
      assert test_errors == []
    end

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 6: Data Integrity
    # ─────────────────────────────────────────────────────────────────────────

    test "verifies YAML file integrity", %{conn: conn} do
      # Check rooms YAML
      room_files = Path.wildcard("priv/world/prototypes/rooms/#{@test_prefix}*.yml")
      assert length(room_files) > 0

      for file <- room_files do
        {:ok, content} = YamlElixir.read_from_file(file)
        assert is_map(content)
        assert Map.has_key?(content, "key")
      end
    end

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 7: Teardown
    # ─────────────────────────────────────────────────────────────────────────

    test "tears down test zone via LLM", %{conn: conn, initial_room_count: initial} do
      {:ok, view, _html} = live(conn, ~p"/admin/world-builder")

      # Request deletion
      view
      |> element("#chat-input")
      |> render_change(%{message: "Delete all entities with keys starting with #{@test_prefix}"})

      view
      |> element("[data-action='send-message']")
      |> render_click()

      # Wait for completion
      Process.sleep(5000)

      # Verify cleanup
      final_room_count = RoomManager.count_rooms()
      assert final_room_count == initial
    end
  end

  defp cleanup_test_entities do
    # Delete all test_e2e_* entities
    RoomManager.list_rooms()
    |> Enum.filter(&String.starts_with?(&1.key, @test_prefix))
    |> Enum.each(&RoomManager.delete_room(&1.key))

    EntityManager.list_entities(:npc)
    |> Enum.filter(&String.starts_with?(&1.key, @test_prefix))
    |> Enum.each(&EntityManager.delete_entity(&1.id))

    # ... similar for items, quests, dialogues, cutscenes
  end
end
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Update layout to 4-column with collapsible panels
- [ ] Implement panel collapse/expand UI
- [ ] Basic 3D viewport with room cubes
- [ ] Basic hierarchy tree view

### Phase 2: Core CRUD (Weeks 5-8)
- [ ] Room CRUD (UI)
- [ ] Exit management (UI)
- [ ] NPC/Item CRUD (UI)
- [ ] Inspector panel forms
- [ ] Real-time PubSub updates

### Phase 3: LLM Integration (Weeks 9-12)
- [ ] OAuth authentication flow
- [ ] Chat panel UI
- [ ] Context builder
- [ ] Tool definitions
- [ ] Sandbox execution
- [ ] Streaming responses

### Phase 4: Advanced Features (Weeks 13-16)
- [ ] Quest builder
- [ ] Dialogue tree editor
- [ ] Cutscene timeline
- [ ] Templates system
- [ ] Batch operations

### Phase 5: Validation & Polish (Weeks 17-20)
- [ ] Real-time validation
- [ ] Visual indicators (glow)
- [ ] Console panel
- [ ] Click-to-navigate errors
- [ ] Auto-fix suggestions

### Phase 6: Testing & Documentation (Weeks 21-24)
- [ ] E2E test suite
- [ ] Unit tests for managers
- [ ] Performance optimization
- [ ] Documentation
- [ ] User onboarding

---

**Document Maintainers**: @raymondluong, @claude
**Last Review**: 2026-01-15
**Next Review**: After Phase 1 completion
