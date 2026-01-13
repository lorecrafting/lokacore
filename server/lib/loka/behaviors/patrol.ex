defmodule Loka.Behaviors.Patrol do
  @moduledoc """
  Makes an NPC walk a predefined patrol route on a timer.

  Patrol behavior allows NPCs to move between rooms on a schedule.
  Great for town guards, wandering merchants, or any NPC that should move.

  ## Supported Types
  - `:npc`

  ## Configuration

  | Option | Type | Required | Default | Description |
  |--------|------|----------|---------|-------------|
  | path | list | yes | - | List of room keys to visit |
  | pause_seconds | integer | no | 30 | Seconds to wait at each room |
  | loop | boolean | no | true | Return to start after reaching end |
  | ambient_messages | list | no | [] | Random messages (handled by NpcAmbient.Scheduler) |
  | start_index | integer | no | 0 | Starting position in path |

  ## Example

      key: patrol_guard
      behaviors:
        - Loka.Behaviors.Patrol
      attributes:
        behavior_config:
          patrol:
            path:
              - town_square
              - north_gate
              - market
              - south_gate
            pause_seconds: 60
            loop: true
            ambient_messages:
              - "The guard looks around alertly."
              - "The guard adjusts his armor."
              - "The guard nods to passersby."

  Note: ambient_messages are handled by `NpcAmbient.Scheduler`, not by this behavior.
  They are configured here for convenience but emitted separately on a timer.

  ## Events Handled

  - `:tick` - Check if it's time to move to next patrol point
  - `:patrol_move` - Actually perform the move

  ## State

  The behavior maintains state tracking:
  - `path_index` - Current position in the path
  - `last_move_at` - Timestamp of last movement
  - `direction` - 1 for forward, -1 for backward (when not looping)
  """

  use Loka.Behaviors.Base

  require Logger

  @impl true
  def supported_types, do: [:npc]

  @impl true
  def init(entity, config) do
    path = config[:path] || []
    start_index = config[:start_index] || 0

    # Find current position in path if entity is already at a path location
    current_index = find_current_index(entity, path, start_index)

    state = %{
      path_index: current_index,
      last_move_at: DateTime.utc_now(),
      direction: 1
    }

    {:ok, state}
  end

  @impl true
  def handle_event(entity, %Event{type: :tick}, state) do
    config = get_config(entity, __MODULE__)
    path = config[:path] || []
    pause_seconds = config[:pause_seconds] || 30

    if path != [] && should_move?(state, pause_seconds) do
      # Time to move
      {next_index, direction} = calculate_next_index(state, path, config[:loop] != false)

      if next_index != state.path_index do
        target_room = Enum.at(path, next_index)

        # Emit move event
        move_event =
          Event.new(:patrol_move, %{
            payload: %{
              entity_id: entity.id,
              target_room_key: target_room,
              from_index: state.path_index,
              to_index: next_index
            }
          })

        new_state = %{
          state
          | path_index: next_index,
            last_move_at: DateTime.utc_now(),
            direction: direction
        }

        Logger.debug("Patrol #{entity.id} moving to #{target_room} (index #{next_index})")
        {:ok, new_state, [move_event]}
      else
        {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  def handle_event(_entity, _event, state) do
    {:ok, state}
  end

  # Private helpers

  defp find_current_index(entity, path, default) do
    current_room = get_current_room_key(entity)

    if current_room do
      case Enum.find_index(path, &(&1 == current_room)) do
        nil -> default
        idx -> idx
      end
    else
      default
    end
  end

  defp get_current_room_key(entity) do
    # Try to find the room entity and get its key
    if entity.location_id do
      case Entities.get_entity(entity.location_id) do
        nil -> nil
        room -> room.key
      end
    else
      nil
    end
  end

  defp should_move?(state, pause_seconds) do
    now = DateTime.utc_now()
    diff = DateTime.diff(now, state.last_move_at, :second)
    diff >= pause_seconds
  end

  defp calculate_next_index(state, path, loop?) do
    path_length = length(path)
    current = state.path_index
    direction = state.direction

    next_index = current + direction

    cond do
      # Past the end
      next_index >= path_length ->
        if loop? do
          {0, 1}
        else
          # Reverse direction
          {current - 1, -1}
        end

      # Before the start
      next_index < 0 ->
        if loop? do
          {path_length - 1, 1}
        else
          # Reverse direction
          {1, 1}
        end

      # Normal case
      true ->
        {next_index, direction}
    end
  end
end
