defmodule Loka.Game.Actions.Result do
  @moduledoc """
  Result struct returned by game actions.

  Contains:
  - `state` - State changes to apply (game_state, room, combat, etc.)
  - `events` - Events for transport to dispatch to client

  ## Event Types

  Events are tuples that the transport layer interprets:

  | Event | Description |
  |-------|-------------|
  | `{:event, text}` | Text message to display |
  | `{:room_changed, data}` | Player entered new room |
  | `{:room_update, data}` | Current room changed |
  | `{:inventory_update, data}` | Inventory changed |
  | `{:equipment_update, data}` | Equipment changed |
  | `{:combat_start, data}` | Combat initiated |
  | `{:combat_update, data}` | Combat state changed |
  | `{:combat_end, data}` | Combat finished |
  | `{:dialogue_start, data}` | Dialogue started |
  | `{:dialogue_update, data}` | New dialogue node |
  | `{:dialogue_end, data}` | Dialogue finished |
  | `{:broadcast_room, room_id, msg}` | Broadcast to room |
  | `{:broadcast_player, player_id, msg}` | Send to specific player |

  ## Usage

      result = Result.new(
        state: %{game_state: new_game_state, room: new_room},
        events: [
          {:event, "You pick up the sword."},
          {:inventory_update, %{action: "add", item_id: item_id}}
        ]
      )
  """

  @type event ::
          {:event, String.t()}
          | {:room_changed, map()}
          | {:room_update, map()}
          | {:inventory_update, map()}
          | {:equipment_update, map()}
          | {:stats_update, map()}
          | {:combat_start, map()}
          | {:combat_update, map()}
          | {:combat_end, map()}
          | {:dialogue_start, map()}
          | {:dialogue_update, map()}
          | {:dialogue_end, map()}
          | {:shop_open, map()}
          | {:shop_close, map()}
          | {:container_open, map()}
          | {:container_update, map()}
          | {:container_close, map()}
          | {:entity_context, map()}
          | {:game_initialized, map()}
          | {:broadcast_room, String.t(), term()}
          | {:broadcast_player, String.t(), term()}
          | {:schedule_timer, atom(), integer()}
          | {:cancel_timer, atom()}

  @type t :: %__MODULE__{
          state: map(),
          events: [event()]
        }

  defstruct state: %{},
            events: []

  @doc """
  Create a new Result.

  ## Options

  - `:state` - Map of state changes (default: %{})
  - `:events` - List of events (default: [])

  ## Examples

      Result.new()
      Result.new(events: [{:event, "Hello"}])
      Result.new(state: %{game_state: gs}, events: [{:event, "Done"}])
  """
  @spec new(keyword()) :: t()
  def new(opts \\ []) do
    %__MODULE__{
      state: Keyword.get(opts, :state, %{}),
      events: Keyword.get(opts, :events, [])
    }
  end

  @doc """
  Add an event to the result.
  """
  @spec add_event(t(), event()) :: t()
  def add_event(result, event) do
    %{result | events: result.events ++ [event]}
  end

  @doc """
  Add multiple events to the result.
  """
  @spec add_events(t(), [event()]) :: t()
  def add_events(result, events) do
    %{result | events: result.events ++ events}
  end

  @doc """
  Update state in the result.
  """
  @spec put_state(t(), atom(), term()) :: t()
  def put_state(result, key, value) do
    %{result | state: Map.put(result.state, key, value)}
  end

  @doc """
  Merge state changes into the result.
  """
  @spec merge_state(t(), map()) :: t()
  def merge_state(result, state_changes) do
    %{result | state: Map.merge(result.state, state_changes)}
  end
end
