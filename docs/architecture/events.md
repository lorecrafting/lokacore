# Event System Architecture

Events are the primary communication mechanism in ExMUD, enabling loose coupling between entities and systems.

## Event Structure

```elixir
defmodule Exmud.Engine.Event do
  defstruct [
    :id,              # Unique event ID
    :type,            # Event type atom
    :source,          # Entity that caused the event
    :target,          # Entity receiving the event (optional)
    :location,        # Room where event occurred
    :payload,         # Event-specific data
    :timestamp,       # When event was created
    :cancellable?,    # Can handlers cancel this?
    :cancelled?,      # Has it been cancelled?
    :metadata,        # Additional tracking info
  ]
end
```

## Event Types

| Category | Event Types |
|----------|-------------|
| Movement | :move, :enter_room, :leave_room |
| Communication | :say, :tell, :whisper, :shout, :emote |
| Combat | :attack, :defend, :damage, :heal, :death |
| Items | :get, :drop, :give, :equip, :unequip, :use |
| World | :tick, :weather_change, :time_change |
| System | :connect, :disconnect, :save, :load |

## Event Bus

Uses Phoenix.PubSub for routing:

```elixir
defmodule Exmud.Engine.EventBus do
  @pubsub Exmud.PubSub

  def emit(%Event{} = event) do
    # Broadcast to relevant topics
    topics = build_topics(event)

    Enum.each(topics, fn topic ->
      Phoenix.PubSub.broadcast(@pubsub, topic, {:event, event})
    end)

    # Also process through entity behaviors
    if event.target do
      EntityServer.process_event(event.target, event)
    end
  end

  def subscribe(topic) do
    Phoenix.PubSub.subscribe(@pubsub, topic)
  end

  defp build_topics(event) do
    ["events:global"]
    |> maybe_add_type_topic(event)
    |> maybe_add_location_topic(event)
    |> maybe_add_entity_topic(event)
  end

  defp maybe_add_location_topic(topics, %{location: nil}), do: topics
  defp maybe_add_location_topic(topics, %{location: loc}) do
    ["room:#{loc}" | topics]
  end
end
```

## PubSub Topics

| Topic Pattern | Purpose |
|---------------|---------|
| `events:global` | All events (for logging, analytics) |
| `room:{id}` | Events in a specific room |
| `player:{id}` | Events targeting a specific player |
| `entity:{id}` | Events targeting a specific entity |
| `world:tick` | World simulation tick events |

## Event Hooks for Scripting

Predefined hook points that Lua scripts can attach to:

```elixir
@hooks %{
  # Entity lifecycle
  at_entity_creation: "Called when entity is first created",
  at_entity_init: "Called when entity is loaded into memory",
  at_entity_save: "Called before entity is saved",

  # Room events
  at_pre_move: "Before an entity moves (cancellable)",
  at_post_move: "After an entity has moved",
  at_player_enter: "When a player enters the room",
  at_player_leave: "When a player leaves the room",

  # Object events
  at_pre_get: "Before object is picked up (cancellable)",
  at_post_get: "After object is picked up",
  at_pre_drop: "Before object is dropped (cancellable)",
  at_post_drop: "After object is dropped",
  at_use: "When object is used",

  # Combat events
  at_pre_attack: "Before attack is processed (cancellable)",
  at_post_attack: "After attack is processed",
  at_damage: "When entity takes damage",
  at_death: "When entity dies",

  # NPC events
  at_tick: "On world tick (for AI)",
  at_greet: "When player first interacts",
  at_dialogue: "During conversation",
}
```

## World Tick System

```elixir
defmodule World.TickServer do
  use GenServer

  @tick_interval_ms 1000  # 1 second base tick

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @impl true
  def init(_) do
    schedule_tick()
    {:ok, %{
      tick_count: 0,
      game_time: %{hour: 8, minute: 0, day: 1, season: :spring}
    }}
  end

  @impl true
  def handle_info(:tick, state) do
    new_state = state
    |> advance_game_time()
    |> process_weather()
    |> process_npc_ai()
    |> process_respawns()
    |> broadcast_tick()

    schedule_tick()
    {:noreply, %{new_state | tick_count: state.tick_count + 1}}
  end

  defp schedule_tick do
    Process.send_after(self(), :tick, @tick_interval_ms)
  end

  defp broadcast_tick(state) do
    Phoenix.PubSub.broadcast(
      Exmud.PubSub,
      "world:tick",
      {:tick, state.tick_count, state.game_time}
    )
    state
  end
end
```

## Subscribing to Events in LiveView

```elixir
defmodule ExmudWeb.GameLive do
  use ExmudWeb, :live_view

  def mount(_params, session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(Exmud.PubSub, "player:#{session.player_id}")
      Phoenix.PubSub.subscribe(Exmud.PubSub, "room:#{session.location_id}")
    end
    {:ok, socket}
  end

  def handle_info({:event, %Event{type: :display, payload: message}}, socket) do
    {:noreply, push_message(socket, message)}
  end

  def handle_info({:event, %Event{type: :room_update, payload: room}}, socket) do
    {:noreply, assign(socket, room: room)}
  end
end
```

## Event Flow Example

```
Player types "look sword"
    ↓
CommandPipeline.process/2
    ↓
LookCommand.execute/2
    ↓
Returns: {:ok, [%Event{type: :display, payload: sword_description}]}
    ↓
EventBus.emit/1
    ↓
PubSub broadcasts to "player:{id}"
    ↓
GameLive.handle_info/2 receives event
    ↓
Socket assigns updated, client re-renders
```

## Related
- [Commands](./commands.md) - How commands emit events
- [Scripting](./scripting.md) - Lua scripts responding to events
- [Entity System](./entity-system.md) - Behaviors handling events
