defmodule Loka.Engine.EventBus do
  @moduledoc """
  Central event routing system using Phoenix.PubSub.

  The EventBus is the backbone of Loka's event-driven architecture. It routes
  game events to interested subscribers based on multiple criteria, enabling
  loose coupling between game systems.

  ## Topic Types

  Events are automatically broadcast to multiple topic types:

  - `events:global` - All events (useful for logging, analytics)
  - `events:{type}` - Events of a specific type (e.g., `events:move`, `events:attack`)
  - `room:{id}` - Events occurring in a specific room (for room-based updates)
  - `entity:{id}` - Events targeting a specific entity (for entity-specific handlers)

  ## Usage

  ### Subscribing to Events

      # Subscribe to all events in a room
      EventBus.subscribe("room:\#{room_id}")

      # Subscribe to all attack events
      EventBus.subscribe("events:attack")

      # Subscribe to events targeting a specific player
      EventBus.subscribe("entity:\#{player_id}")

  ### Emitting Events

      event = Event.new(:attack, %{damage: 10}, source: attacker_id, target: defender_id)
      EventBus.emit(event)

  ### Receiving Events

  Subscribers receive events as messages in the format `{:event, %Event{}}`:

      def handle_info({:event, %Event{type: :attack} = event}, state) do
        # Handle the attack event
        {:noreply, state}
      end

  ## Event Flow

  1. A system creates an Event struct with type, payload, and metadata
  2. The Event is passed to `emit/1`
  3. EventBus checks if the event is cancelled (allows for event interception)
  4. If not cancelled, topics are built based on event properties
  5. The event is broadcast to all matching topics via Phoenix.PubSub
  """

  alias Loka.Engine.Event

  # The default PubSub server name, defined in application.ex supervision tree.
  # Can be overridden via optional parameter for testing.
  @default_pubsub Loka.PubSub

  @doc """
  Emits an event to all relevant subscribers.

  The event is broadcast to multiple topics based on its type, location,
  and target entity. Cancelled events are silently dropped.

  Returns `:ok` regardless of whether the event was broadcast or cancelled.

  ## Options

  - `:pubsub` - PubSub server to use (default: `Loka.PubSub`). Useful for testing.

  ## Examples

      iex> event = Event.new(:say, %{message: "Hello"}, location: room_id)
      iex> EventBus.emit(event)
      :ok

      # For testing with a custom PubSub
      iex> EventBus.emit(event, pubsub: MyTest.PubSub)
      :ok

  ## Topics Broadcast

  For an event with type `:attack`, location `"room_123"`, and target `"player_456"`:

  - `events:global`
  - `events:attack`
  - `room:room_123`
  - `entity:player_456`
  """
  def emit(%Event{} = event, opts \\ []) do
    pubsub = Keyword.get(opts, :pubsub, @default_pubsub)

    # Only broadcast if event hasn't been cancelled by a pre-hook
    unless Event.cancelled?(event) do
      topics = build_topics(event)

      # Emit telemetry for PubSub message tracking
      :telemetry.execute(
        [:loka, :pubsub, :emit],
        %{topic_count: length(topics)},
        %{event_type: event.type, location: event.location}
      )

      Enum.each(topics, &broadcast(&1, event, pubsub))
    end

    :ok
  end

  @doc """
  Subscribes the calling process to a specific topic.

  The process will receive messages in the format `{:event, %Event{}}`.

  ## Common Topics

  - `"events:global"` - All events
  - `"events:move"` - All movement events
  - `"room:{room_id}"` - All events in a specific room
  - `"entity:{entity_id}"` - All events targeting a specific entity
  - `"player:{player_id}"` - Player-specific events

  ## Options

  - `:pubsub` - PubSub server to use (default: `Loka.PubSub`). Useful for testing.

  ## Examples

      EventBus.subscribe("room:\#{room_id}")
      EventBus.subscribe("events:combat")

      # For testing
      EventBus.subscribe("room:test", pubsub: MyTest.PubSub)
  """
  def subscribe(topic, opts \\ []) when is_binary(topic) do
    pubsub = Keyword.get(opts, :pubsub, @default_pubsub)
    Phoenix.PubSub.subscribe(pubsub, topic)
  end

  @doc """
  Unsubscribes the calling process from a specific topic.

  ## Options

  - `:pubsub` - PubSub server to use (default: `Loka.PubSub`). Useful for testing.

  ## Examples

      EventBus.unsubscribe("room:\#{old_room_id}")
  """
  def unsubscribe(topic, opts \\ []) when is_binary(topic) do
    pubsub = Keyword.get(opts, :pubsub, @default_pubsub)
    Phoenix.PubSub.unsubscribe(pubsub, topic)
  end

  @doc """
  Broadcasts an event to a specific topic.

  This is a lower-level function used internally by `emit/1`.
  For most use cases, use `emit/1` instead, which handles
  topic building and cancellation checking.

  ## Options

  - Third argument can be a PubSub server (default: `Loka.PubSub`). Useful for testing.

  ## Examples

      EventBus.broadcast("room:lobby", event)
      EventBus.broadcast("room:lobby", event, MyTest.PubSub)
  """
  def broadcast(topic, %Event{} = event, pubsub \\ @default_pubsub) do
    # Emit per-topic telemetry for rate tracking
    :telemetry.execute(
      [:loka, :pubsub, :broadcast],
      %{count: 1},
      %{topic: topic, event_type: event.type}
    )

    Phoenix.PubSub.broadcast(pubsub, topic, {:event, event})
  end

  @doc """
  Builds the list of topics an event should be broadcast to.

  Topics are built based on the event's properties:
  - Always includes `events:global`
  - Always includes `events:{type}` for the event type
  - Includes `room:{id}` if the event has a location
  - Includes `entity:{id}` if the event has a target

  ## Examples

      iex> event = Event.new(:attack, %{}, location: "room_1", target: "npc_2")
      iex> EventBus.build_topics(event)
      ["entity:npc_2", "room:room_1", "events:attack", "events:global"]
  """
  def build_topics(%Event{} = event) do
    # Start with the global topic, then add more specific topics
    ["events:global"]
    |> maybe_add_type_topic(event)
    |> maybe_add_location_topic(event)
    |> maybe_add_entity_topic(event)
  end

  # Adds the event type topic (e.g., "events:move", "events:attack")
  defp maybe_add_type_topic(topics, %Event{type: type}) do
    ["events:#{type}" | topics]
  end

  # Adds the room/location topic if the event has a location
  defp maybe_add_location_topic(topics, %Event{location: nil}), do: topics

  defp maybe_add_location_topic(topics, %Event{location: location}) do
    ["room:#{location}" | topics]
  end

  # Adds the target entity topic if the event has a target
  defp maybe_add_entity_topic(topics, %Event{target: nil}), do: topics

  defp maybe_add_entity_topic(topics, %Event{target: target}) do
    ["entity:#{target}" | topics]
  end
end
