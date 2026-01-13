# Messaging Architecture

This document describes Loka's messaging systems and the planned MessageBus abstraction for proper layer separation.

## Overview

Loka has multiple messaging patterns for different use cases:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MESSAGING LAYERS                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ Phoenix      │    │ Session      │    │ Social Commands      │  │
│  │ PubSub       │    │ System       │    │ (say, tell, shout)   │  │
│  │              │    │              │    │                      │  │
│  │ Low-level    │    │ Client       │    │ Game messaging       │  │
│  │ broadcast    │    │ connection   │    │ with formatting      │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘  │
│         │                   │                        │              │
│         └───────────────────┼────────────────────────┘              │
│                             │                                        │
│                             ▼                                        │
│                    ┌─────────────────┐                              │
│                    │   LiveView /    │                              │
│                    │   Client UI     │                              │
│                    └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

## 1. Phoenix PubSub (Infrastructure Layer)

**Module**: `Phoenix.PubSub` via `Loka.PubSub`

The foundation for all real-time messaging. Game-agnostic publish/subscribe.

### Topics

| Topic Pattern | Purpose | Subscribers |
|---------------|---------|-------------|
| `room:{id}` | Room events (enter/leave, ambient, combat) | GameChannel |
| `player:{id}` | Direct player messages, notifications | GameChannel |
| `entity:{id}` | Entity-specific events | EntityServer |
| `world:atmosphere` | Weather/time changes | GameChannel |
| `events:global` | All events (logging, analytics) | Telemetry |

### Usage

```elixir
# Broadcast to room
Phoenix.PubSub.broadcast(Loka.PubSub, "room:#{room_id}", {:ambient_message, msg})

# Subscribe in LiveView
def mount(_, _, socket) do
  if connected?(socket) do
    Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{room.id}")
  end
end

# Receive in LiveView
def handle_info({:ambient_message, message}, socket) do
  {:noreply, append_event(socket, %{text: message})}
end
```

### PubSub Message Types

| Message | Topic | Payload |
|---------|-------|---------|
| `{:player_entered, id, name}` | `room:{id}` | Player enters room |
| `{:player_left, id, name, direction}` | `room:{id}` | Player leaves room |
| `{:ambient_message, html}` | `room:{id}` | Room/NPC ambient flavor |
| `{:room_entry_event, html}` | `room:{id}` | On-enter cutscene/event |
| `{:atmosphere_update, weather, time}` | `world:atmosphere` | Time/weather change |

## 2. Session System (Client Management Layer)

**Module**: `Loka.Session`

Handles client connections, multi-client support, and graceful disconnects.

See [session-system.md](./session-system.md) for full documentation.

Key difference from PubSub:
- **PubSub**: Fire-and-forget broadcast
- **Session**: Tracked delivery with client management

## 3. Social Messaging (Framework Layer)

**Module**: `Loka.Framework.Social.MessageRouter`

Game-specific messaging with formatting, scopes, and player interactions.

### Current Architecture (Problem)

```
┌──────────────────────────────────────────────────────────────────┐
│ ENGINE (lib/loka/engine/)                                        │
│                                                                   │
│  say_command.ex ──────────┐                                      │
│  tell_command.ex ─────────┤                                      │
│  shout_command.ex ────────┼───▶ Imports Framework modules        │
│  whisper_command.ex ──────┤     (MessageRouter, ChannelManager)  │
│  ... (14 commands)        │                                      │
│                           │                                       │
│  ⚠️ VIOLATION: Engine depends on Framework                       │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ FRAMEWORK (lib/loka/framework/social/)                           │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ MessageRouter   │  │ ScopedMessage   │  │ ChannelManager  │  │
│  │                 │  │                 │  │                 │  │
│  │ • Route to room │  │ • Format sender │  │ • Global chats  │  │
│  │ • Route to player│ │ • Scope rules   │  │ • Channel mgmt  │  │
│  │ • Admin bypass  │  │ • Color coding  │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐                        │
│  │ PartyManager    │  │ Relationships   │                        │
│  │                 │  │                 │                        │
│  │ • Party chat    │  │ • Friends list  │                        │
│  │ • Party invites │  │ • Block list    │                        │
│  └─────────────────┘  └─────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

### Planned Architecture (MessageBus)

```
┌──────────────────────────────────────────────────────────────────┐
│ ENGINE (lib/loka/engine/)                                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Engine.MessageBus (behaviour)                           │     │
│  │                                                          │     │
│  │ @callback send_to_room(room_id, sender, message, opts)  │     │
│  │ @callback send_to_player(player_id, sender, msg, opts)  │     │
│  │ @callback broadcast(scope, sender, message, opts)       │     │
│  │ @callback format_message(sender, message, opts)         │     │
│  └─────────────────────────────────────────────────────────┘     │
│                              ▲                                    │
│                              │ uses                               │
│  say_command.ex ─────────────┤                                   │
│  tell_command.ex ────────────┤                                   │
│  ... (14 commands)           │                                   │
│                                                                   │
│  ✅ Engine only knows about MessageBus behaviour                 │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ implements
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ FRAMEWORK (lib/loka/framework/social/)                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ MessageRouter implements Engine.MessageBus              │     │
│  │                                                          │     │
│  │ def send_to_room(room_id, sender, message, opts) do     │     │
│  │   # Format with ScopedMessage                            │     │
│  │   # Check relationships (blocked?)                       │     │
│  │   # Broadcast via PubSub                                 │     │
│  │ end                                                      │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

### MessageBus Behaviour (Proposed)

```elixir
defmodule Loka.Engine.MessageBus do
  @moduledoc """
  Behaviour for game message delivery.

  Engine commands use this behaviour without knowing about
  Framework implementation details.
  """

  @type sender :: %{id: String.t(), name: String.t(), type: :player | :npc | :system}
  @type scope :: :room | :zone | :global | :party | {:channel, String.t()}
  @type opts :: [
    exclude: [String.t()],     # Player IDs to exclude
    format: :say | :shout | :whisper | :emote,
    metadata: map()
  ]

  @doc "Send message to all players in a room"
  @callback send_to_room(room_id :: String.t(), sender, message :: String.t(), opts) ::
    :ok | {:error, term()}

  @doc "Send message to specific player"
  @callback send_to_player(player_id :: String.t(), sender, message :: String.t(), opts) ::
    :ok | {:error, :not_found | :blocked | term()}

  @doc "Broadcast to a scope (zone, global, party, channel)"
  @callback broadcast(scope, sender, message :: String.t(), opts) ::
    :ok | {:error, term()}

  @doc "Format message with sender info for display"
  @callback format_message(sender, message :: String.t(), opts) :: String.t()
end
```

### Configuration

Framework registers its MessageBus implementation at startup:

```elixir
# In config/config.exs or runtime.exs
config :loka, :message_bus, Loka.Framework.Social.MessageRouter

# Engine commands use:
@message_bus Application.compile_env(:loka, :message_bus)

def execute(context, args) do
  @message_bus.send_to_room(room_id, sender, message, [])
end
```

## Message Scopes

| Scope | Visibility | Example |
|-------|------------|---------|
| `:room` | Same room only | `say "Hello"` |
| `:adjacent` | Current + neighboring rooms | `shout "Help!"` |
| `:zone` | All rooms in zone | `yell "Fire!"` |
| `:global` | All online players | Admin announcements |
| `:party` | Party members only | Party chat |
| `{:channel, "ooc"}` | Channel subscribers | OOC chat |
| `{:whisper, player_id}` | Single recipient | Private message |

## Message Flow Examples

### Say Command (Room Scope)

```
Player: "say Hello everyone"
    │
    ▼
SayCommand.execute/2
    │
    ▼
MessageBus.send_to_room(room_id, sender, "Hello everyone", format: :say)
    │
    ▼ (Framework implementation)
    │
├─► ScopedMessage.format(sender, "Hello everyone", :say)
│   → "<span class=\"say\"><b>Alice</b> says, \"Hello everyone\"</span>"
│
├─► Check Relationships.blocked?(recipient, sender)
│   → Skip blocked players
│
└─► Phoenix.PubSub.broadcast("room:#{room_id}", {:chat_message, formatted})
        │
        ▼
    GameChannel.handle_info({:chat_message, ...})
        │
        ▼
    push(socket, "event", payload)
```

### Tell Command (Direct Message)

```
Player: "tell bob Hey, want to trade?"
    │
    ▼
TellCommand.execute/2
    │
    ▼
MessageBus.send_to_player("bob_id", sender, "Hey, want to trade?", format: :tell)
    │
    ▼ (Framework implementation)
    │
├─► Relationships.blocked?(bob, sender) → false
│
├─► Session.online?(bob) → true
│
├─► ScopedMessage.format(sender, message, :tell)
│   → "<span class=\"tell\"><b>Alice</b> tells you, \"Hey, want to trade?\"</span>"
│
└─► Session.send_to_player(bob_id, {:chat_message, formatted})
```

## Layer Responsibilities

| Layer | Responsibility | What It Knows |
|-------|---------------|---------------|
| **Engine** | Command parsing, MessageBus behaviour | Nothing about formatting, relationships |
| **Framework** | Message formatting, scope rules, blocking | Game-specific social rules |
| **Session** | Client delivery, online status | Nothing about message content |
| **PubSub** | Raw broadcast | Nothing about game semantics |

## Related Documentation

- [events.md](./events.md) - Event bus for game events
- [session-system.md](./session-system.md) - Client connection management
- [commands.md](./commands.md) - Command pipeline
- [diagrams.md](./diagrams.md) - Visual architecture diagrams

## Implementation Status

| Component | Status | Bead |
|-----------|--------|------|
| Phoenix PubSub | ✅ Complete | - |
| Session System | ✅ Complete | - |
| MessageRouter | ✅ Complete (Framework) | - |
| Engine.MessageBus | 📋 Planned | lokacore-iyvx |
| Commands → MessageBus | 📋 Planned | lokacore-iyvx |
