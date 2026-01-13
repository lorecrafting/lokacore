defmodule Loka.Behaviors.Wander do
  @moduledoc """
  Makes an NPC wander randomly between allowed rooms.

  Unlike Patrol behavior which follows a fixed route, Wander picks
  random destinations from a configured list of allowed rooms. Good for
  atmospheric NPCs like temple cats, pilgrims, or sweeping monks.

  ## Supported Types
  - `:npc`

  ## Configuration

  | Option | Type | Required | Default | Description |
  |--------|------|----------|---------|-------------|
  | allowed_rooms | list | yes | - | Room keys the NPC can wander to |
  | move_chance | float | no | 0.3 | Chance to move each tick (0.0-1.0) |
  | tick_interval | integer | no | 60000 | Milliseconds between move checks |
  | phases | list | no | nil | Day/night phases when active |
  | idle_messages | list | no | [] | Messages when staying put |

  ## Example

      key: temple_cat
      behaviors:
        - Loka.Behaviors.Wander
      attributes:
        behavior_config:
          wander:
            allowed_rooms:
              - monastery_courtyard
              - monastery_garden
              - monastery_kitchen
            move_chance: 0.25
            tick_interval: 60000
            phases:
              - day
            idle_messages:
              - "The cat watches you with half-closed eyes."

  ## Fencing Behavior

  NPCs will ONLY move to rooms in `allowed_rooms`. If the current room
  has no exits leading to allowed rooms, the NPC stays put.

  ## Day/Night Phases

  When `phases` is configured, the NPC only wanders during those phases:
  - `:dawn` - Early morning
  - `:day` - Daytime
  - `:dusk` - Evening
  - `:night` - Nighttime

  ## Events Handled

  - `:tick` - Check if it's time to wander

  ## State

  The behavior maintains:
  - `last_move_at` - Timestamp of last movement
  - `allowed_rooms_set` - MapSet for O(1) room lookups
  """

  use Loka.Behaviors.Base

  require Logger

  alias Loka.Framework.World.DayNight

  @impl true
  def supported_types, do: [:npc]

  @impl true
  def init(entity, config) do
    allowed_rooms = config[:allowed_rooms] || []

    state = %{
      last_move_at: DateTime.utc_now(),
      allowed_rooms_set: MapSet.new(allowed_rooms)
    }

    if allowed_rooms == [] do
      Logger.warning("Wander behavior on #{entity.key}: no allowed_rooms configured")
    end

    {:ok, state}
  end

  @impl true
  def handle_event(entity, %Event{type: :tick}, state) do
    config = get_config(entity, __MODULE__)

    cond do
      # Check if we should even try to move
      not should_attempt_move?(state, config) ->
        {:ok, state}

      # Check day/night phase
      not in_allowed_phase?(config) ->
        {:ok, state}

      # Roll for move chance
      not roll_move_chance?(config) ->
        maybe_emit_idle_message(entity, config, state)

      # Try to move
      true ->
        attempt_wander(entity, config, state)
    end
  end

  def handle_event(_entity, _event, state) do
    {:ok, state}
  end

  # Private helpers

  defp should_attempt_move?(state, config) do
    tick_interval = config[:tick_interval] || 60_000
    min_seconds = div(tick_interval, 1000)

    now = DateTime.utc_now()
    diff = DateTime.diff(now, state.last_move_at, :second)
    diff >= min_seconds
  end

  defp in_allowed_phase?(config) do
    phases = config[:phases]

    if phases && phases != [] do
      current_phase = get_current_phase()

      # Normalize to string for comparison to avoid atom exhaustion
      phase_str =
        if is_atom(current_phase), do: Atom.to_string(current_phase), else: current_phase

      Enum.any?(phases, fn allowed ->
        allowed_str = if is_atom(allowed), do: Atom.to_string(allowed), else: allowed
        allowed_str == phase_str
      end)
    else
      # No phase restriction, always active
      true
    end
  end

  defp get_current_phase do
    if Process.whereis(DayNight) do
      DayNight.get_phase()
    else
      :day
    end
  end

  defp roll_move_chance?(config) do
    move_chance = config[:move_chance] || 0.3
    :rand.uniform() < move_chance
  end

  defp attempt_wander(entity, config, state) do
    # allowed_rooms from config already converted to MapSet in init/2
    allowed_set = state.allowed_rooms_set

    # Get exits from current room that lead to allowed destinations
    valid_exits = get_valid_exits(entity, allowed_set)

    case valid_exits do
      [] ->
        # No valid exits, stay put
        maybe_emit_idle_message(entity, config, state)

      exits ->
        # Pick a random exit and move
        {direction, target_room_key} = Enum.random(exits)

        move_event =
          Event.new(:wander_move, %{
            payload: %{
              entity_id: entity.id,
              direction: direction,
              target_room_key: target_room_key
            }
          })

        new_state = %{state | last_move_at: DateTime.utc_now()}

        Logger.debug("Wander #{entity.key}: moving #{direction} to #{target_room_key}")
        {:ok, new_state, [move_event]}
    end
  end

  defp get_valid_exits(entity, allowed_set) do
    # Get the current room's exits
    room_id = entity.location_id

    if room_id do
      case Entities.get_entity(room_id) do
        nil ->
          []

        room ->
          # Get exits from room components
          exits = get_room_exits(room)

          # Filter to only exits that lead to allowed rooms
          exits
          |> Enum.filter(fn {_direction, dest_key} ->
            MapSet.member?(allowed_set, dest_key)
          end)
      end
    else
      []
    end
  end

  defp get_room_exits(room) do
    # Exits can be stored in different ways
    # Check components.exits or the exits field
    components = room.components || %{}
    exits_component = components["exits"] || components[:exits] || %{}

    # Also check room.exits if it exists as a direct field
    direct_exits = Map.get(room, :exits, %{})

    # Merge both sources
    all_exits = Map.merge(normalize_exits(exits_component), normalize_exits(direct_exits))

    # Convert to list of {direction, destination_key}
    Enum.map(all_exits, fn {direction, dest} ->
      dest_key = if is_map(dest), do: dest["destination"] || dest[:destination], else: dest
      {to_string(direction), dest_key}
    end)
    |> Enum.filter(fn {_dir, dest} -> dest != nil end)
  end

  defp normalize_exits(exits) when is_map(exits), do: exits
  defp normalize_exits(_), do: %{}

  defp maybe_emit_idle_message(entity, config, state) do
    messages = config[:idle_messages] || []

    if messages != [] && :rand.uniform(100) <= 20 do
      message = Enum.random(messages)

      ambient_event =
        Event.new(:room_message, %{
          payload: %{
            room_id: entity.location_id,
            text: message,
            source_id: entity.id
          }
        })

      {:ok, state, [ambient_event]}
    else
      {:ok, state}
    end
  end
end
