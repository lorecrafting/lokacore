# Session System Architecture

The session system provides unified client messaging for Loka, enabling multi-client support, admin visibility, and graceful disconnect handling.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Loka.Session                              │
│                    (Public API Module)                          │
│                                                                 │
│  connect/4, send_to_player/2, broadcast_to_room/2,             │
│  broadcast_all/1, list_online/0, disconnect/2, stats/0         │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Session.Registry│    │ Session.Server  │    │Session.Supervisor│
│                 │    │ (per player)    │    │                 │
│ • Player lookup │    │ • Client mgmt   │    │ • Start/stop    │
│ • Room index    │    │ • State tracking│    │ • Fault tolerance│
│ • Online count  │    │ • Message routing│   │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Elixir.Registry │    │ Process.monitor │
│ (PlayerRegistry)│    │ (Client tracking)│
└─────────────────┘    └─────────────────┘
```

## Components

### Loka.Session (Public API)

The main entry point for all session operations. Provides a clean API that hides implementation details.

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `connect/4` | Connect a player from any client type |
| `send_to_player/2` | Send message to specific player |
| `broadcast_to_room/2` | Send message to all players in room |
| `broadcast_all/1` | Server-wide announcement |
| `update_room/2` | Update player's current room |
| `list_online/0` | Get all online players with info |
| `disconnect/2` | Force disconnect (admin kick) |
| `stats/0` | System statistics |

### Session.Registry

Handles fast lookups using two data structures:

1. **Elixir Registry** (`Loka.Session.PlayerRegistry`)
   - Maps `player_id` → `session_pid`
   - O(1) lookup
   - Automatic cleanup on process termination

2. **ETS Table** (`:loka_session_room_index`)
   - Maps `room_id` → `[session_pid, ...]`
   - `:bag` type for multiple players per room
   - Must be manually updated on room changes

### Session.Server

A GenServer per online player that manages:

- **Connected clients**: Tracks all client processes via `Process.monitor/1`
- **State**: Current room, combat state, dialogue state
- **Message routing**: Forwards messages to all connected clients
- **Graceful disconnect**: 30-second grace period before session terminates

### Session.Supervisor

A DynamicSupervisor managing Session.Server processes:

- `:temporary` restart strategy (no auto-restart on crash)
- `:one_for_one` supervision (isolated failures)
- Dynamic child management as players connect/disconnect

## Data Flow

### Player Connection

```
1. LiveView mounts
2. Calls Session.connect(player, :liveview, self())
3. Session.Supervisor.get_or_start_session(player)
   - Starts new Session.Server if needed
4. Session.Server.register_client(:liveview, pid)
   - Monitors client process
   - Adds to clients map
5. Returns {:ok, session_pid}
```

### Message Delivery

```
Session.send_to_player(player_id, message)
    │
    ▼
Session.Server receives {:send_message, message}
    │
    ▼
For each {ref, {type, pid, meta}} in clients:
    │
    ▼
send(pid, {:session_message, message})
    │
    ▼
LiveView.handle_info({:session_message, ...})
```

### Room Broadcast

```
Session.broadcast_to_room(room_id, message)
    │
    ▼
Registry.sessions_in_room(room_id)
  [via ETS lookup, O(1)]
    │
    ▼
For each session_pid:
    │
    ▼
send(session_pid, {:broadcast, message})
    │
    ▼
Session.Server.handle_info({:broadcast, message})
    │
    ▼
Forwards to all connected clients
```

### Client Disconnect

```
Client process terminates (tab close, network error)
    │
    ▼
Session.Server receives {:DOWN, ref, :process, pid, reason}
    │
    ▼
Removes client from clients map
    │
    ▼
If no clients remaining:
    │
    ▼
Starts 30-second disconnect timer
    │
    ├─── Client reconnects before timeout ───▶ Cancel timer, continue
    │
    └─── Timeout expires ───▶ Session terminates
                                    │
                                    ▼
                              Clean up room index
```

## Supported Client Types

| Type | Transport | Status |
|------|-----------|--------|
| `:liveview` | Phoenix WebSocket | ✅ Implemented |
| `:ssh` | SSH/Telnet | 📋 Future |
| `:mobile` | WebSocket | 📋 Future |
| `:discord` | Discord API | 📋 Future |

## Message Types

Messages sent via the session system are delivered as `{:session_message, payload}`.

### Standard Payloads

```elixir
# Room narrative text
{:room_message, "A wolf howls in the distance."}

# Server announcement
{:announcement, "Server restart in 5 minutes"}

# Force disconnect (admin kick)
{:force_disconnect, "Kicked by admin"}

# Player action visible to room
{:player_action, "Alice", "draws a sword"}

# Custom game events
{:combat_start, %{enemy: "goblin"}}
{:quest_complete, %{quest_id: "rescue_villagers"}}
```

## Integration Example

### LiveView Mount

```elixir
def mount(_params, _session, socket) do
  player = socket.assigns.current_scope.player
  room = load_room(player)

  if connected?(socket) do
    # Connect to session system
    {:ok, _pid} = Session.connect(player, :liveview, self())
    Session.update_room(player.id, room.id)

    # Also subscribe to PubSub for direct room events
    Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{room.id}")
  end

  {:ok, assign(socket, room: room)}
end
```

### Handling Session Messages

```elixir
def handle_info({:session_message, message}, socket) do
  case message do
    {:room_message, text} ->
      {:noreply, add_event(socket, text)}

    {:announcement, text} ->
      {:noreply, add_event(socket, "[Announcement] #{text}")}

    {:force_disconnect, reason} ->
      {:noreply, redirect(socket, to: "/login?reason=#{reason}")}

    _ ->
      {:noreply, socket}
  end
end
```

### Room Navigation

```elixir
def handle_navigate(socket, new_room) do
  player_id = socket.assigns.player.id

  # Update session's room index
  Session.update_room(player_id, new_room.id)

  {:noreply, assign(socket, room: new_room)}
end
```

## Admin Operations

### List Online Players

```elixir
iex> Session.list_online()
[
  %{
    player_id: "abc123",
    player_email: "alice@example.com",
    current_room_id: "room_courtyard",
    in_combat: false,
    in_dialogue: true,
    client_count: 2,
    client_types: [:liveview, :mobile],
    created_at: ~U[2024-01-15 10:30:00Z]
  },
  ...
]
```

### Server Announcement

```elixir
Session.broadcast_all({:announcement, "Maintenance in 10 minutes"})
```

### Kick Player

```elixir
Session.disconnect(player_id, "Kicked for harassment")
```

### System Stats

```elixir
iex> Session.stats()
%{
  online_players: 42,
  active_sessions: 42,
  players_in_combat: 5,
  players_in_dialogue: 3
}
```

## OTP Guarantees

| Guarantee | Implementation |
|-----------|----------------|
| **Fault isolation** | DynamicSupervisor with `:one_for_one` |
| **No orphan processes** | Process monitors auto-detect client death |
| **Fast lookups** | Elixir Registry + ETS = O(1) |
| **Memory efficiency** | Session terminates 30s after last client |
| **Race-free state** | GenServer serializes all state changes |
| **Observable** | Standard OTP introspection works |

## Future Enhancements

### SSH/Telnet Support

```elixir
# Future: SSH client would call
Session.connect(player, :ssh, self(), %{ip: client_ip})
```

### Discord Integration

```elixir
# Future: Discord bot would call
Session.connect(player, :discord, self(), %{channel: channel_id})
```

### Multi-Server Scaling

If scaling beyond a single BEAM VM:
1. Replace Elixir Registry with distributed registry (Horde, :global)
2. Replace ETS room index with distributed cache (Cachex cluster, Redis)
3. Session processes can remain local to each node

## Files

| File | Purpose |
|------|---------|
| `lib/loka/session.ex` | Public API |
| `lib/loka/session/registry.ex` | Player & room lookups |
| `lib/loka/session/server.ex` | Per-player GenServer |
| `lib/loka/session/supervisor.ex` | DynamicSupervisor |
