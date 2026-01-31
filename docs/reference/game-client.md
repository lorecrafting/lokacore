# Game Client Architecture

## Overview

Loka uses `LokaWeb.GameChannel` as the unified transport for all game clients
(mobile and web). Clients connect via WebSocket and exchange structured events.

## GameChannel Architecture

```
game_channel.ex
├── join/3 → Authentication, game state initialization
├── handle_in/3 → Client commands (navigate, action, chat, etc.)
├── handle_info/2 → PubSub events, timers (combat, bardo)
└── push/3 → Server-to-client events

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

**Server → Client:**
- `game_state` - Full game state on join
- `room_update` - Room changed
- `event` - Game event text
- `combat_start/update/end` - Combat lifecycle
- `dialogue_start/update/end` - NPC dialogue
- `bardo_enter/message/can_reincarnate/exit` - Death sequence
- `shop_open/close` - Merchant interaction
- `container_open/update/close` - Container interaction

See `LokaWeb.GameChannel` moduledoc for complete API documentation.

## Godot Client

The Godot 4.6 client (`godot-client/`) connects via GameChannel:

- `scripts/phoenix_client.gd` - Channel connection and WebSocket handling
- `scripts/game_state.gd` - Game state management singleton
- `scripts/book_page.gd` - 3D book page UI with text rendering

See `CLAUDE.md` for detailed Godot client documentation.

## UI Style

- **"Living Ebook" aesthetic** - Literary, book-like interface
- Touch/click-based interactions
- Serif typography (Crimson Text/Georgia), grayscale only
- Underlined text for interactive elements
- Context panel for entity interactions
- Compass navigation for room movement

See `docs/ui/living-ebook-style-guide.md` for full UI standards.
