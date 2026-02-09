# Game Client Architecture

## Overview

Loka uses `LokaWeb.GameChannel` as the unified transport for all game clients.
Clients connect via WebSocket and exchange structured events.

## Client Types

| Client | Connection | Purpose |
|--------|-----------|---------|
| **Godot** (`godot-client/`) | Phoenix Channel via WebSocket | Primary mobile/web game client |
| **World Builder Terminal** | Phoenix Channel via JS hook | Admin content testing (embedded in World Builder) |

## GameChannel Architecture

```
game_channel.ex
├── join/3 → Authentication, game state initialization
├── handle_in/3 → Client commands (navigate, action, chat, command, etc.)
├── handle_info/2 → PubSub events, timers (combat, bardo)
└── push/3 → Server-to-client events

command_parser.ex
├── parse/1 → Raw text → tagged action tuples
└── Builder commands get :builder_* prefix for security gating

builder_commands.ex
├── execute/3 → Admin command dispatch
└── goto, spawn, give, flags, quests, reload, validate, etc.

room_helpers.ex
├── load_player_room/1 → Load player's current room
├── load_other_players/2 → Get other players in room
└── build_minimap_graph/1 → Generate minimap data
```

### Connection

```javascript
// Connect to socket
const socket = new Socket("wss://host/socket", { params: { token: jwt } });
socket.connect();

// Join game channel
const channel = socket.channel("game:lobby", {});
channel.join()
  .receive("ok", () => console.log("Joined"))
  .receive("error", (resp) => console.error(resp));
```

### Key Events

**Client → Server:**
- `navigate` - Move between rooms
- `click_entity` - Interact with entity
- `action` - Perform action on entity (look, talk, attack, etc.)
- `chat` - Say/shout/yell messages
- `inventory` - Drop/equip/unequip items
- `combat_action` - Combat commands (flee)
- `emote` - Perform emote
- `social` - Set mood/pose
- `gather` - Gather from resource node
- `craft` - Craft item from recipe
- `command` - Raw text input (MUD-style commands, parsed by CommandParser)

**Server → Client:**
- `game_state` - Full game state on join
- `room_update` - Room changed
- `output` - Text output for MUD clients (room descriptions, builder output)
- `event` - Game event text
- `combat_start/update/end` - Combat lifecycle
- `dialogue_start/update/end` - NPC dialogue
- `bardo_enter/message/can_reincarnate/exit` - Death sequence
- `shop_open/close` - Merchant interaction
- `container_open/update/close` - Container interaction
- `broadcast` - System announcements

See `LokaWeb.GameChannel` moduledoc for complete API documentation.

## Text Command System

The `command` event accepts raw text input and parses it via `CommandParser`:

### Player Commands
```
Movement:   north, south, east, west, up, down (or n,s,e,w,u,d)
Look:       look, look <target>
Talk:       talk <npc>
Inventory:  inventory (or i), get <item>, drop <item>, equip, unequip
Chat:       say <message>
Combat:     attack <target>, flee
Other:      who, help
```

### Builder Commands (admin-only)
Builder commands are silently rejected for non-admins (identical "Unknown command" response, zero information leakage).

```
Navigation: goto <room_key>, rooms, where, find <search>
Inspect:    info <entity>, list npcs|items|quests
Spawn:      spawn <npc_key>, purge, give <item_key>
Flags:      setflag <flag>, clearflag <flag>, flags
Quests:     startquest <key>, completequest <key>, resetquest <key>, quests
World:      settime dawn|noon|dusk|midnight, reload, validate
Mode:       godmode
```

### Security Design

1. `CommandParser` tags builder commands with `:builder_*` prefix at parse time
2. `GameChannel.execute_builder_command/3` checks `socket.assigns.player.is_admin`
3. Non-admins receive identical "Unknown command" response (no hint commands exist)
4. `push_help/1` is context-aware: only admins see builder command documentation

## Godot Client

The Godot 4.6 client (`godot-client/`) connects via GameChannel:

- `scripts/phoenix_client.gd` - Channel connection and WebSocket handling
- `scripts/game_state.gd` - Game state management singleton
- `scripts/book_page.gd` - 3D book page UI with text rendering

See `CLAUDE.md` for detailed Godot client documentation.

## World Builder Terminal

The Terminal Builder at `/admin/builder` is a standalone MUD terminal for content creation.
It connects to `GameChannel` via a JS hook (`MudTerminal`) with a JWT token generated
by `AdminLive`.

Key files:
- `lib/loka_web/channels/command_parser.ex` - Text command parser
- `lib/loka_web/channels/builder_commands.ex` - Admin command implementations
- `assets/js/hooks/mud_terminal.js` - Socket connection, output rendering, command history

## UI Style

- **"Living Ebook" aesthetic** - Literary, book-like interface
- Touch/click-based interactions
- Serif typography (Crimson Text/Georgia), grayscale only
- Underlined text for interactive elements
- Context panel for entity interactions
- Compass navigation for room movement

See `docs/ui/living-ebook-style-guide.md` for full UI standards.
