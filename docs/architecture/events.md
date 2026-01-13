# Event System Architecture

Events are the primary communication mechanism in Loka, enabling loose coupling between entities and systems.

## Event Structure

```elixir
defmodule Loka.Engine.Event do
  defstruct [
    :id,              # Unique event ID
    :type,            # Event type atom (validated at runtime)
    :source,          # Entity that caused the event
    :target,          # Entity receiving the event (optional)
    :location,        # Room where event occurred
    :payload,         # Event-specific data (validated against schema)
    :timestamp,       # When event was created
    :cancellable?,    # Can handlers cancel this?
    :cancelled?,      # Has it been cancelled?
    :metadata,        # Additional tracking info
    :correlation_id,  # Groups related events (auto-generated)
    :caused_by,       # Parent event ID (for event chains)
  ]
end
```

## Event Correlation & Tracing

Events support tracing through `correlation_id` and `caused_by`:

- **correlation_id** - Groups related events from one action (e.g., all events from an attack)
- **caused_by** - Links to the parent event that triggered this one

### Event Chain Example

```elixir
# Player attacks enemy → damage → death → loot drop
attack = Event.new(:attack, source: player_id, target: enemy_id, payload: %{damage: 50})
# attack.correlation_id = "abc-123" (auto-generated)

damage = Event.caused_by(attack, :damage, payload: %{amount: 50})
# damage.correlation_id = "abc-123" (inherited)
# damage.caused_by = attack.id

death = Event.caused_by(damage, :death, target: enemy_id)
# death.correlation_id = "abc-123" (inherited)
# death.caused_by = damage.id
```

All three events share the same `correlation_id`, enabling log tracing:

```elixir
# Find all events from the same player action
Event.find_correlated(events, "abc-123")

# Build the causal chain from an event
Event.build_chain(events, death.id)
# => [attack, damage, death]
```

## Event Type Validation

Event types are validated at creation time. Creating an event with an invalid type raises `ArgumentError`:

```elixir
Event.new(:attack, ...)  # ✅ Valid
Event.new(:attakc, ...)  # ❌ Raises ArgumentError

# Check if a type is valid
Event.valid_type?(:attack)  # => true
Event.valid_type?(:foo)     # => false
```

## Event Types

| Category | Event Types |
|----------|-------------|
| Movement | :move, :enter_room, :leave_room, :before_move |
| Communication | :say, :tell, :whisper, :shout, :emote |
| Combat | :attack, :defend, :damage, :damage_taken, :heal, :death, :initiate_combat, :flee |
| Entity Interactions | :entity_entered, :entity_left |
| Items | :get, :drop, :give, :equip, :unequip, :use |
| World | :tick, :weather_change, :time_change |
| System | :connect, :disconnect, :save, :load |
| Display | :display, :message, :notify_room |
| Quest | :quest_started, :quest_completed, :quest_failed, :objective_progress |
| Economy | :currency_changed, :item_purchased, :item_sold |

## Payload Schemas

Events can have payload schemas for validation. Use `Event.validate_payload/1`:

```elixir
event = Event.new(:damage, payload: %{amount: 50})
:ok = Event.validate_payload(event)

event = Event.new(:damage, payload: %{})
{:error, ["missing required field: amount"]} = Event.validate_payload(event)
```

### Defined Schemas

| Event Type | Required Fields | Optional Fields |
|------------|-----------------|-----------------|
| `:damage` | amount | damage_type, source_name, resisted |
| `:heal` | amount | source_name, overheal |
| `:move` | direction | from_room, to_room |
| `:enter_room` | room_id | from_direction |
| `:leave_room` | room_id | direction |
| `:say` | message | language |
| `:tell` | message, recipient | - |
| `:shout` | message | - |
| `:emote` | emote_key | target_id, text |
| `:get` | item_id | item_name, quantity |
| `:drop` | item_id | item_name, quantity |
| `:equip` | item_id, slot | item_name |
| `:unequip` | slot | item_id, item_name |
| `:currency_changed` | currency, amount, new_total | reason |
| `:quest_started` | quest_id | quest_title |
| `:quest_completed` | quest_id | quest_title, rewards |
| `:objective_progress` | quest_id, objective_id | current, target |

Events without schemas are considered valid (schema-free events).

## Event Bus

Uses Phoenix.PubSub for routing:

```elixir
defmodule Loka.Engine.EventBus do
  @pubsub Loka.PubSub

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

Predefined hook points that Elixir scripts can attach to:

```elixir
@hooks %{
  # Entity lifecycle
  at_entity_creation: "Called when entity is first created",
  at_entity_init: "Called when entity is loaded into memory",
  at_entity_save: "Called before entity is saved",

  # Room events
  at_before_move: "Before an entity moves (cancellable)",
  at_after_move: "After an entity has moved",
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
      Loka.PubSub,
      "world:tick",
      {:tick, state.tick_count, state.game_time}
    )
    state
  end
end
```

## Subscribing to Events in Game Clients

Game clients (GameChannel or the deprecated GameLive) subscribe to PubSub topics:

```elixir
# In GameChannel or GameLive
Phoenix.PubSub.subscribe(Loka.PubSub, "player:#{player_id}")
Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{room_id}")

# Handle incoming events
def handle_info({:event, %Event{type: :display, payload: message}}, socket) do
  # Push to client or update assigns
end
```

## Event Flow Example

```
Player action (e.g., "look sword")
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
GameChannel.handle_info/2 receives event
    ↓
push(socket, "event", payload) sends to client
```

## Session Integration

Sessions automatically subscribe to player-specific events via PubSub. This unifies EventBus and Session messaging:

```elixir
# Both approaches deliver to all connected clients:

# 1. Direct session messaging (synchronous)
Session.Server.send_message(player_id, {:room_message, "Hello!"})

# 2. Via EventBus (async, decoupled)
Event.new(:message, target: player_id, payload: %{text: "Hello!"})
|> EventBus.emit()
```

### When to Use Each

| Use Session.send_message when... | Use EventBus when... |
|----------------------------------|----------------------|
| You need synchronous confirmation | You're in an event-driven flow |
| Sending from non-event code | You want async/decoupled messaging |
| Simple point-to-point messages | You need event correlation/tracing |

---

## Events vs Hooks

Events and Hooks serve different purposes:

| Aspect | Events | Hooks |
|--------|--------|-------|
| **Purpose** | Communication between systems | Extension points for custom logic |
| **Direction** | Broadcast (1:many) | Pipeline (sequential handlers) |
| **Coupling** | Loose (pub/sub) | Registered callbacks |
| **Cancellation** | Optional (`cancellable?: true`) | Via `{:halt, reason}` return |
| **Timing** | After-the-fact or request | Before/after lifecycle points |
| **Validation** | Payload schemas | Callback existence at registration |

### Use Events For:
- Broadcasting state changes (player entered room, item dropped)
- Cross-system communication (combat system → UI, quest system → rewards)
- Tracing/logging/analytics (events have correlation_id)
- Async notifications

### Use Hooks For:
- Intercepting/modifying behavior (prevent movement, modify damage)
- Adding custom logic at lifecycle points (on entity creation, before save)
- Validation before actions (can player pick this up?)
- Scripting integration (Elixir scripts responding to game events)

### Example: Attack Flow

```elixir
# 1. HOOK: Before attack (can prevent)
case Hooks.run_until_halt(:at_before_attack, [attacker, target]) do
  {:halt, reason} -> {:error, reason}
  :ok ->
    # 2. Process attack logic...
    damage = calculate_damage(attacker, target)

    # 3. EVENT: Notify systems (async, can't prevent)
    Event.new(:attack, source: attacker.id, target: target.id, payload: %{damage: damage})
    |> EventBus.emit()

    # 4. HOOK: After attack (logging, effects)
    Hooks.run(:at_after_attack, [attacker, target, damage])
end
```

## Related
- [Commands](./commands.md) - How commands emit events
- [Hooks and Locks](./hooks-and-locks.md) - Hook system details
- [Scripting](./elixir-scripts-design.md) - Elixir scripts responding to events
- [Entity System](./entity-system.md) - Behaviors handling events
- [Session System](./session-system.md) - Client connection management
