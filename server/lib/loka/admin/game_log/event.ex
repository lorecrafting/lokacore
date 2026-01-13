defmodule Loka.Admin.GameLog.Event do
  @moduledoc """
  Game event record for admin debugging and audit.

  Events are categorized by domain (quest, combat, social, etc.) and include
  context about who triggered the event, what entity was affected, and where
  it occurred.
  """

  @type category :: :quest | :combat | :social | :exploration | :economy | :system

  defstruct [
    :id,
    :timestamp,
    :category,
    :event_type,
    :player_id,
    :entity_id,
    :room_id,
    :details,
    :metadata
  ]

  @type t :: %__MODULE__{
          id: String.t(),
          timestamp: DateTime.t(),
          category: category(),
          event_type: atom(),
          player_id: String.t() | nil,
          entity_id: String.t() | nil,
          room_id: String.t() | nil,
          details: map(),
          metadata: map()
        }

  @doc """
  Creates a new event with generated ID and timestamp.
  """
  def new(category, event_type, details, opts \\ []) do
    %__MODULE__{
      id: generate_id(),
      timestamp: DateTime.utc_now(),
      category: category,
      event_type: event_type,
      player_id: Keyword.get(opts, :player_id),
      entity_id: Keyword.get(opts, :entity_id),
      room_id: Keyword.get(opts, :room_id),
      details: details,
      metadata: Keyword.get(opts, :metadata, %{})
    }
  end

  @doc """
  Exports event as a JSON-friendly map with ISO8601 timestamp.
  """
  def to_map(%__MODULE__{} = event) do
    %{
      id: event.id,
      timestamp: DateTime.to_iso8601(event.timestamp),
      category: event.category,
      event_type: event.event_type,
      player_id: event.player_id,
      entity_id: event.entity_id,
      room_id: event.room_id,
      details: event.details,
      metadata: event.metadata
    }
  end

  defp generate_id do
    :crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false)
  end
end
