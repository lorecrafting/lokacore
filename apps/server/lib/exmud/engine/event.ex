defmodule Exmud.Engine.Event do
  @moduledoc """
  Events are the primary communication mechanism in ExMUD.

  Events can be:
  - Synchronous (must be handled before continuing)
  - Asynchronous (fire and forget)
  - Cancellable (handlers can prevent the event)
  """

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
          metadata: map()
        }

  # Movement
  @type event_type ::
          :move
          | :enter_room
          | :leave_room
          # Communication
          | :say
          | :tell
          | :whisper
          | :shout
          | :emote
          # Combat
          | :attack
          | :defend
          | :damage
          | :heal
          | :death
          # Items
          | :get
          | :drop
          | :give
          | :equip
          | :unequip
          | :use
          # World
          | :tick
          | :weather_change
          | :time_change
          # System
          | :connect
          | :disconnect
          | :save
          | :load
          # Display
          | :display
          | :message
          | :notify_room

  defstruct [
    :id,
    :type,
    :source,
    :target,
    :location,
    :timestamp,
    payload: %{},
    cancellable?: false,
    cancelled?: false,
    metadata: %{}
  ]

  @doc """
  Creates a new event with a generated UUID.
  """
  def new(type, attrs \\ %{}) do
    %__MODULE__{
      id: UUID.uuid4(),
      type: type,
      timestamp: DateTime.utc_now()
    }
    |> Map.merge(Map.take(attrs, [:source, :target, :location, :payload, :cancellable?]))
  end

  @doc """
  Cancels an event if it's cancellable.
  """
  def cancel(%__MODULE__{cancellable?: true} = event) do
    %{event | cancelled?: true}
  end

  def cancel(%__MODULE__{} = event), do: event

  @doc """
  Checks if an event has been cancelled.
  """
  def cancelled?(%__MODULE__{cancelled?: cancelled}), do: cancelled
end
