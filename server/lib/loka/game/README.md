# Game Logic Layer

This directory contains transport-agnostic game logic. All game actions flow
through `Loka.Game.Actions`, which coordinates with Mechanics and Framework
modules.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TRANSPORTS                                      │
│  GameChannel (mobile)  │  LiveView (web)  │  REST API  │  CLI  │  etc.      │
│                                                                              │
│  - Receive events from clients                                               │
│  - Build Context from socket/connection state                                │
│  - Call Game.Actions.execute()                                               │
│  - Apply state changes to socket                                             │
│  - Dispatch events to client                                                 │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Loka.Game.Actions                                    │
│                      (Action Coordinator)                                    │
│                                                                              │
│  execute(:navigate, %{direction: "north"}, ctx)                              │
│  execute(:attack, %{entity_id: "..."}, ctx)                                  │
│  execute(:get_item, %{entity_id: "..."}, ctx)                                │
│                                                                              │
│  Returns: {:ok, Result.t()} | {:error, String.t()}                           │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────┐
│   Loka.Mechanics        │  │   Loka.Session          │  │   Framework         │
│   (Game Molecules)      │  │   (Connection/Presence) │  │   (Domain Logic)    │
│                         │  │                         │  │                     │
│   - Damage              │  │   - connect/disconnect  │  │   - Combat          │
│   - Heal                │  │   - send_to_player      │  │   - Inventory       │
│   - Cost                │  │   - broadcast_to_room   │  │   - Quest           │
│   - Check               │  │   - presence tracking   │  │   - Dialogue        │
│                         │  │   - admin ops           │  │   - etc.            │
└────────────┬────────────┘  └─────────────────────────┘  └─────────────────────┘
             │
             ▼
┌─────────────────────────┐
│   Loka.Primitives       │
│   (Game Atoms)          │
│                         │
│   - Roll (dice)         │
│   - ResourcePool (HP)   │
│   - Value (calculations)│
│   - Timer               │
└─────────────────────────┘
```

## Module Responsibilities

### `Loka.Game.Actions` (this directory)

**Purpose**: Single entry point for all game actions. Transport-agnostic.

**Files**:
- `actions.ex` - Main action coordinator
- `actions/context.ex` - Context struct (player state, room, etc.)
- `actions/result.ex` - Result struct (state changes, events)
- `actions/combat.ex` - Combat-specific actions
- `command_parser.ex` - MUD text command parsing

### `Loka.Session` (lib/loka/session/)

**Purpose**: Connection and presence management. NOT game logic.

**Handles**:
- Player connections across multiple clients
- Message routing (send_to_player, broadcast_to_room)
- Online presence tracking
- Admin operations (kick, list online)

### `Loka.Mechanics` (lib/loka/mechanics/)

**Purpose**: Reusable game calculation "molecules".

**Modules**:
- `Damage` - Damage calculation with formulas, variance, crits
- `Heal` - Healing calculation
- `Cost` - Resource cost checking and deduction
- `Check` - Skill/stat checks

### `Loka.Primitives` (lib/loka/primitives/)

**Purpose**: Atomic building blocks for mechanics.

**Modules**:
- `Roll` - Dice rolling, range rolls, percentage checks
- `ResourcePool` - Health/mana pools with regen
- `Value` - Value calculations with modifiers
- `Timer` - Time-based mechanics

## Usage

### From GameChannel (Mobile)

```elixir
def handle_in("navigate", %{"direction" => dir}, socket) do
  ctx = Context.from_socket(socket)

  case Actions.execute(:navigate, %{direction: dir}, ctx) do
    {:ok, result} ->
      socket = apply_state_changes(socket, result.state)
      dispatch_events(socket, result.events)
      {:reply, :ok, socket}

    {:error, reason} ->
      push(socket, "error", %{message: reason})
      {:reply, :error, socket}
  end
end

defp apply_state_changes(socket, state) do
  socket
  |> maybe_assign(:game_state, state[:game_state])
  |> maybe_assign(:room, state[:room])
  |> maybe_assign(:combat, state[:combat])
end

defp dispatch_events(socket, events) do
  Enum.each(events, fn
    {:event, text} ->
      push(socket, "event", %{text: text})

    {:room_changed, data} ->
      push(socket, "room_update", data)

    {:broadcast_room, room_id, msg} ->
      Phoenix.PubSub.broadcast(Loka.PubSub, "room:#{room_id}", msg)

    {:schedule_timer, name, ms} ->
      Process.send_after(self(), name, ms)

    # ... handle other event types
  end)
end
```

### From LiveView (Web)

```elixir
def handle_event("navigate", %{"direction" => dir}, socket) do
  ctx = Context.from_liveview(socket)

  case Actions.execute(:navigate, %{direction: dir}, ctx) do
    {:ok, result} ->
      socket =
        socket
        |> assign(:game_state, result.state[:game_state] || socket.assigns.game_state)
        |> assign(:room, result.state[:room] || socket.assigns.room)

      # Convert events to LiveView updates
      socket = Enum.reduce(result.events, socket, &apply_event/2)
      {:noreply, socket}

    {:error, reason} ->
      {:noreply, put_flash(socket, :error, reason)}
  end
end
```

## Adding a New Action

### 1. Define the action in `actions.ex`

```elixir
defp do_action(:my_new_action, %{param1: value1}, ctx) do
  # Use Mechanics for calculations
  {:ok, damage, _audit} = Mechanics.Damage.calculate(%{str: ctx.game_state.stats.str})

  # Use Framework for domain logic
  {:ok, new_game_state} = PlayerGameState.update_state(ctx.game_state, %{...})

  # Return Result with state changes and events
  result = Result.new(
    state: %{game_state: new_game_state},
    events: [
      {:event, "Action completed!"},
      {:my_custom_event, %{data: "..."}}
    ]
  )
  {:ok, result}
end
```

### 2. For complex actions, create a dedicated module

```elixir
# lib/loka/game/actions/my_feature.ex
defmodule Loka.Game.Actions.MyFeature do
  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Mechanics.{Damage, Check}

  def do_something(ctx, params) do
    # Complex logic here
    {:ok, Result.new(...)}
  end
end
```

### 3. Handle the events in transport

```elixir
# In GameChannel or LiveView
defp dispatch_event({:my_custom_event, data}, socket) do
  push(socket, "my_custom_event", data)
  socket
end
```

## Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `{:event, text}` | String | Text message to display |
| `{:room_changed, data}` | Map | Player entered new room |
| `{:room_update, data}` | Map | Current room state changed |
| `{:inventory_update, data}` | Map | Inventory changed |
| `{:equipment_update, data}` | Map | Equipment changed |
| `{:stats_update, data}` | Map | Player stats changed |
| `{:combat_start, data}` | Map | Combat initiated |
| `{:combat_update, data}` | Map | Combat round result |
| `{:combat_end, data}` | Map | Combat finished |
| `{:dialogue_start, data}` | Map | NPC dialogue started |
| `{:dialogue_update, data}` | Map | New dialogue node |
| `{:dialogue_end, data}` | Map | Dialogue finished |
| `{:broadcast_room, room_id, msg}` | - | Broadcast to room via PubSub |
| `{:broadcast_player, player_id, msg}` | - | Send to specific player |
| `{:schedule_timer, name, ms}` | - | Schedule a timer |
| `{:cancel_timer, name}` | - | Cancel a timer |
| `{:enter_bardo, killer}` | String | Player died, enter death sequence |

## State Changes

The `Result.state` map can contain:

| Key | Type | Description |
|-----|------|-------------|
| `:game_state` | Map | Updated player game state |
| `:room` | Map | Updated current room |
| `:combat` | Map/nil | Combat state (nil = not in combat) |
| `:dialogue` | Map/nil | Dialogue state |
| `:container` | Map/nil | Open container state |

## Design Principles

1. **Transport Agnostic**: Actions module has no knowledge of sockets, channels, or LiveView
2. **Pure Functions**: Same input always produces same output (modulo database state)
3. **Structured Results**: Always returns `{:ok, Result.t()}` or `{:error, String.t()}`
4. **Event-Based**: Returns events for transport to interpret and dispatch
5. **Composition**: Uses Mechanics (molecules) which use Primitives (atoms)
6. **Separation of Concerns**:
   - Actions = coordination
   - Mechanics = calculations
   - Framework = domain logic
   - Session = connection management
   - Transport = wire protocol

## Testing

```elixir
# Test actions directly without transport
test "navigate moves player to new room" do
  ctx = %Context{
    player_id: "player_1",
    player_name: "TestPlayer",
    game_state: game_state,
    room: starting_room
  }

  assert {:ok, result} = Actions.execute(:navigate, %{direction: "north"}, ctx)
  assert result.state[:room].id == "next_room_id"
  assert {:room_changed, _} = List.first(result.events)
end
```
