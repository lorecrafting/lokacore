defmodule Loka.Engine.Event do
  @moduledoc """
  Events are the primary communication mechanism in Loka.

  Events can be:
  - Synchronous (must be handled before continuing)
  - Asynchronous (fire and forget)
  - Cancellable (handlers can prevent the event)

  ## Event Correlation

  Events support tracing through `correlation_id` and `caused_by`:

  - `correlation_id` - Groups related events (e.g., all events from one player action)
  - `caused_by` - Links to the parent event that triggered this one

  Example chain: attack → damage → death → loot_drop

      attack_event = Event.new(:attack, %{source: player_id, target: enemy_id})
      damage_event = Event.caused_by(attack_event, :damage, %{amount: 50})
      death_event = Event.caused_by(damage_event, :death, %{})

  All three events share the same `correlation_id` for easy tracing.

  ## Event Types

  Valid event types are defined in `@event_types`. Creating an event with an
  invalid type will raise an error at runtime. Use `valid_type?/1` to check.

  ## Payload Schemas

  Each event type can have an associated payload schema. Use `validate_payload/1`
  to check if a payload matches the expected schema for its event type.
  """

  require Logger

  @type t :: %__MODULE__{
          id: String.t(),
          type: event_type(),
          source: String.t() | nil,
          target: String.t() | nil,
          location: String.t() | nil,
          payload: map(),
          timestamp: DateTime.t(),
          cancellable?: boolean(),
          cancelled?: boolean(),
          metadata: map(),
          correlation_id: String.t() | nil,
          caused_by: String.t() | nil
        }

  # All valid event types - used for runtime validation
  @event_types [
    # Movement
    :move,
    :enter_room,
    :leave_room,
    :before_move,
    # Communication
    :say,
    :tell,
    :whisper,
    :shout,
    :emote,
    # Combat
    :attack,
    :defend,
    :damage,
    :damage_taken,
    :heal,
    :death,
    :initiate_combat,
    :flee,
    # Entity interactions
    :entity_entered,
    :entity_left,
    # Items
    :get,
    :drop,
    :give,
    :equip,
    :unequip,
    :use,
    :pick_up_item,
    :item_dropped,
    :destroy_item,
    # World
    :tick,
    :weather_change,
    :time_change,
    # NPC behavior events
    :patrol_move,
    :wander_move,
    # System
    :connect,
    :disconnect,
    :save,
    :load,
    # Display
    :display,
    :message,
    :notify_room,
    :room_message,
    # Quest
    :quest_started,
    :quest_completed,
    :quest_failed,
    :objective_progress,
    # Economy
    :currency_changed,
    :item_purchased,
    :item_sold,
    # Signals (entity-to-entity scripted events)
    :signal
  ]

  # Payload schemas per event type
  # Each schema is a map of {field_name => type} where type is :string, :integer, :map, :list, :any
  @payload_schemas %{
    attack: %{required: [], optional: [:damage, :weapon_id, :skill_used]},
    damage: %{required: [:amount], optional: [:damage_type, :source_name, :resisted]},
    death: %{required: [], optional: [:killer_id, :killer_name, :cause]},
    heal: %{required: [:amount], optional: [:source_name, :overheal]},
    move: %{required: [:direction], optional: [:from_room, :to_room]},
    enter_room: %{required: [:room_id], optional: [:from_direction]},
    leave_room: %{required: [:room_id], optional: [:direction]},
    say: %{required: [:message], optional: [:language]},
    tell: %{required: [:message, :recipient], optional: []},
    shout: %{required: [:message], optional: []},
    emote: %{required: [:emote_key], optional: [:target_id, :text]},
    get: %{required: [:item_id], optional: [:item_name, :quantity]},
    drop: %{required: [:item_id], optional: [:item_name, :quantity]},
    equip: %{required: [:item_id, :slot], optional: [:item_name]},
    unequip: %{required: [:slot], optional: [:item_id, :item_name]},
    currency_changed: %{required: [:currency, :amount, :new_total], optional: [:reason]},
    quest_started: %{required: [:quest_id], optional: [:quest_title]},
    quest_completed: %{required: [:quest_id], optional: [:quest_title, :rewards]},
    objective_progress: %{required: [:quest_id, :objective_id], optional: [:current, :target]},
    signal: %{required: [:signal_name], optional: [:data]}
  }

  @type event_type ::
          :move
          | :enter_room
          | :leave_room
          | :before_move
          | :say
          | :tell
          | :whisper
          | :shout
          | :emote
          | :attack
          | :defend
          | :damage
          | :damage_taken
          | :heal
          | :death
          | :initiate_combat
          | :flee
          | :entity_entered
          | :entity_left
          | :get
          | :drop
          | :give
          | :equip
          | :unequip
          | :use
          | :tick
          | :weather_change
          | :time_change
          | :connect
          | :disconnect
          | :save
          | :load
          | :display
          | :message
          | :notify_room
          | :quest_started
          | :quest_completed
          | :quest_failed
          | :objective_progress
          | :currency_changed
          | :item_purchased
          | :item_sold
          | :signal

  defstruct [
    :id,
    :type,
    :source,
    :target,
    :location,
    :timestamp,
    :correlation_id,
    :caused_by,
    payload: %{},
    cancellable?: false,
    cancelled?: false,
    metadata: %{}
  ]

  @doc """
  Returns the list of valid event types.
  """
  @spec event_types() :: [event_type()]
  def event_types, do: @event_types

  @doc """
  Checks if an event type is valid.
  """
  @spec valid_type?(atom()) :: boolean()
  def valid_type?(type), do: type in @event_types

  @doc """
  Creates a new event with a generated UUID.

  Raises `ArgumentError` if the event type is not valid.

  ## Options

  - `:source` - Entity ID that caused the event
  - `:target` - Entity ID that the event affects
  - `:location` - Room ID where the event occurred
  - `:payload` - Event-specific data
  - `:cancellable?` - Whether handlers can cancel this event
  - `:correlation_id` - ID to group related events (auto-generated if not provided)

  ## Examples

      Event.new(:attack, source: player_id, target: enemy_id, payload: %{damage: 10})
      Event.new(:say, source: player_id, location: room_id, payload: %{message: "Hello"})
  """
  @spec new(event_type(), map()) :: t()
  def new(type, attrs \\ %{})

  def new(type, attrs) when type in @event_types do
    correlation_id = Map.get(attrs, :correlation_id) || Ecto.UUID.generate()

    %__MODULE__{
      id: Ecto.UUID.generate(),
      type: type,
      timestamp: DateTime.utc_now(),
      correlation_id: correlation_id
    }
    |> Map.merge(
      Map.take(attrs, [:source, :target, :location, :payload, :cancellable?, :caused_by])
    )
  end

  def new(type, _attrs) do
    raise ArgumentError,
          "Invalid event type: #{inspect(type)}. Valid types: #{inspect(@event_types)}"
  end

  @doc """
  Creates an event without type validation. **FOR TESTING ONLY**.

  This bypasses the event type validation, allowing arbitrary event types.
  Do not use in production code - use `new/2` instead.
  """
  @spec new_unchecked(atom(), map()) :: t()
  def new_unchecked(type, attrs \\ %{}) do
    correlation_id = Map.get(attrs, :correlation_id) || Ecto.UUID.generate()

    %__MODULE__{
      id: Ecto.UUID.generate(),
      type: type,
      timestamp: DateTime.utc_now(),
      correlation_id: correlation_id
    }
    |> Map.merge(
      Map.take(attrs, [:source, :target, :location, :payload, :cancellable?, :caused_by])
    )
  end

  @doc """
  Creates a new event that was caused by a parent event.

  The new event inherits the `correlation_id` from the parent and sets
  `caused_by` to the parent's ID. This enables tracing event chains.

  ## Examples

      attack = Event.new(:attack, source: player_id, target: enemy_id)
      damage = Event.caused_by(attack, :damage, payload: %{amount: 50})
      # damage.correlation_id == attack.correlation_id
      # damage.caused_by == attack.id
  """
  @spec caused_by(t(), event_type(), map()) :: t()
  def caused_by(%__MODULE__{} = parent, type, attrs \\ %{}) do
    attrs
    |> Map.put(:correlation_id, parent.correlation_id)
    |> Map.put(:caused_by, parent.id)
    |> then(&new(type, &1))
  end

  @doc """
  Cancels an event if it's cancellable.
  """
  @spec cancel(t()) :: t()
  def cancel(%__MODULE__{cancellable?: true} = event) do
    %{event | cancelled?: true}
  end

  def cancel(%__MODULE__{} = event), do: event

  @doc """
  Checks if an event has been cancelled.
  """
  @spec cancelled?(t()) :: boolean()
  def cancelled?(%__MODULE__{cancelled?: cancelled}), do: cancelled

  @doc """
  Validates an event's payload against its schema.

  Returns `:ok` if valid, or `{:error, reasons}` with a list of validation errors.
  Events without a defined schema are considered valid.

  ## Examples

      event = Event.new(:damage, payload: %{amount: 50})
      :ok = Event.validate_payload(event)

      event = Event.new(:damage, payload: %{})
      {:error, ["missing required field: amount"]} = Event.validate_payload(event)
  """
  @spec validate_payload(t()) :: :ok | {:error, [String.t()]}
  def validate_payload(%__MODULE__{type: type, payload: payload}) do
    case Map.get(@payload_schemas, type) do
      nil ->
        # No schema defined for this event type - allow anything
        :ok

      schema ->
        errors = validate_against_schema(payload, schema)

        if errors == [] do
          :ok
        else
          {:error, errors}
        end
    end
  end

  @doc """
  Returns the payload schema for an event type, if defined.
  """
  @spec payload_schema(event_type()) :: map() | nil
  def payload_schema(type), do: Map.get(@payload_schemas, type)

  @doc """
  Returns all defined payload schemas.
  """
  @spec payload_schemas() :: map()
  def payload_schemas, do: @payload_schemas

  # Validates a payload against a schema
  defp validate_against_schema(payload, %{required: required, optional: optional}) do
    payload_keys = Map.keys(payload) |> MapSet.new()
    required_set = MapSet.new(required)
    optional_set = MapSet.new(optional)
    allowed_keys = MapSet.union(required_set, optional_set)

    # Check for missing required fields
    missing =
      required_set
      |> MapSet.difference(payload_keys)
      |> Enum.map(&"missing required field: #{&1}")

    # Check for unknown fields (warning only, not error)
    unknown =
      payload_keys
      |> MapSet.difference(allowed_keys)
      |> Enum.to_list()

    if unknown != [] do
      Logger.debug("Event payload has unknown fields: #{inspect(unknown)}")
    end

    missing
  end

  @doc """
  Finds all events with a given correlation_id from a list.

  Useful for tracing event chains in logs or debugging.

  ## Examples

      events = [event1, event2, event3]
      related = Event.find_correlated(events, correlation_id)
  """
  @spec find_correlated([t()], String.t()) :: [t()]
  def find_correlated(events, correlation_id) when is_list(events) do
    Enum.filter(events, &(&1.correlation_id == correlation_id))
  end

  @doc """
  Builds an event chain by following `caused_by` links.

  Returns events in order from root cause to final effect.

  ## Examples

      chain = Event.build_chain(events, leaf_event_id)
      # Returns [root_event, middle_event, leaf_event]
  """
  @spec build_chain([t()], String.t()) :: [t()]
  def build_chain(events, event_id) when is_list(events) do
    events_by_id = Map.new(events, &{&1.id, &1})
    build_chain_recursive(events_by_id, event_id, [])
  end

  defp build_chain_recursive(_events_by_id, nil, acc), do: acc

  defp build_chain_recursive(events_by_id, event_id, acc) do
    case Map.get(events_by_id, event_id) do
      nil ->
        acc

      event ->
        build_chain_recursive(events_by_id, event.caused_by, [event | acc])
    end
  end
end
