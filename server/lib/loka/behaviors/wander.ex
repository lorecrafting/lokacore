defmodule Loka.Behaviors.Wander do
  @moduledoc """
  Makes an NPC wander randomly between allowed rooms.

  ## Configuration (in behavior_config.wander)

  - `allowed_rooms` - Room keys the NPC can wander to (required)
  - `move_chance` - Chance to move each tick, 0.0-1.0 (default: 0.3)
  - `phases` - Day/night phases when active (nil = always)
  - `idle_messages` - Messages when staying put
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event, Entities}
  alias Loka.Engine.EntityServer.Volatile
  alias Loka.Behaviors.Runner

  @impl true
  def on_init(entity) do
    config = Runner.get_config(entity, __MODULE__)
    allowed_rooms = config[:allowed_rooms] || []
    Volatile.set(:allowed_rooms_set, MapSet.new(allowed_rooms))
    {:ok, entity}
  end

  @impl true
  def on_tick(entity) do
    config = Runner.get_config(entity, __MODULE__)

    cond do
      not in_allowed_phase?(config) ->
        {:ok, entity}

      not roll_move_chance?(config) ->
        maybe_emit_idle_message(entity, config)
        {:ok, entity}

      true ->
        attempt_wander(entity, config)
        {:ok, entity}
    end
  end

  @impl true
  def on_event(entity, _event, _payload), do: {:ok, entity}

  # Private helpers

  defp in_allowed_phase?(config) do
    phases = config[:phases]

    if phases && phases != [] do
      current_phase = get_current_phase()
      phase_str = to_string(current_phase)
      Enum.any?(phases, &(to_string(&1) == phase_str))
    else
      true
    end
  end

  defp get_current_phase do
    # DayNight removed in V2 — always report :day
    :day
  end

  defp roll_move_chance?(config) do
    move_chance = config[:move_chance] || 0.3
    :rand.uniform() < move_chance
  end

  defp attempt_wander(entity, config) do
    allowed_set = Volatile.get(:allowed_rooms_set, MapSet.new(config[:allowed_rooms] || []))
    valid_exits = get_valid_exits(entity, allowed_set)

    case valid_exits do
      [] ->
        maybe_emit_idle_message(entity, config)

      exits ->
        {direction, target_room_key} = Enum.random(exits)

        EventBus.emit(
          Event.new(:wander_move, %{
            payload: %{
              entity_id: entity.id,
              direction: direction,
              target_room_key: target_room_key
            }
          })
        )
    end
  end

  defp get_valid_exits(entity, allowed_set) do
    room_id = entity.location_id

    if room_id do
      case Entities.get_entity(room_id) do
        nil ->
          []

        room ->
          get_room_exits(room)
          |> Enum.filter(fn {_dir, dest_key} -> MapSet.member?(allowed_set, dest_key) end)
      end
    else
      []
    end
  end

  defp get_room_exits(room) do
    components = room.components || %{}
    exits_component = components["exits"] || %{}

    Enum.flat_map(exits_component, fn {direction, dest} ->
      dest_key = if is_map(dest), do: dest["destination"], else: dest
      if dest_key, do: [{to_string(direction), dest_key}], else: []
    end)
  end

  defp maybe_emit_idle_message(entity, config) do
    messages = config[:idle_messages] || []

    if messages != [] && :rand.uniform(100) <= 20 do
      EventBus.emit(
        Event.new(:room_message, %{
          payload: %{
            room_id: entity.location_id,
            text: Enum.random(messages),
            source_id: entity.id
          }
        })
      )
    end
  end
end
