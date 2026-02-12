defmodule Loka.Behaviors.Patrol do
  @moduledoc """
  Makes an NPC walk a predefined patrol route on a timer.

  ## Configuration (in behavior_config.patrol)

  - `path` - List of room keys to visit (required)
  - `pause_seconds` - Seconds to wait at each room (default: 30)
  - `loop` - Return to start after reaching end (default: true)
  - `start_index` - Starting position in path (default: 0)
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event, Entities}
  alias Loka.Engine.EntityServer.Volatile
  alias Loka.Behaviors.Runner

  @impl true
  def on_init(entity) do
    config = Runner.get_config(entity, __MODULE__)
    path = config[:path] || []
    start_index = config[:start_index] || 0

    current_index = find_current_index(entity, path, start_index)

    Volatile.set(:path_index, current_index)
    Volatile.set(:last_move_at, DateTime.utc_now())
    Volatile.set(:direction, 1)

    {:ok, entity}
  end

  @impl true
  def on_tick(entity) do
    config = Runner.get_config(entity, __MODULE__)
    path = config[:path] || []
    pause_seconds = config[:pause_seconds] || 30

    path_index = Volatile.get(:path_index, 0)
    last_move_at = Volatile.get(:last_move_at, DateTime.utc_now())
    direction = Volatile.get(:direction, 1)

    if path != [] && should_move?(last_move_at, pause_seconds) do
      {next_index, new_direction} =
        calculate_next_index(path_index, direction, path, config[:loop] != false)

      if next_index != path_index do
        target_room = Enum.at(path, next_index)

        EventBus.emit(
          Event.new(:patrol_move, %{
            payload: %{
              entity_id: entity.id,
              target_room_key: target_room,
              from_index: path_index,
              to_index: next_index
            }
          })
        )

        Volatile.set(:path_index, next_index)
        Volatile.set(:last_move_at, DateTime.utc_now())
        Volatile.set(:direction, new_direction)
      end
    end

    {:ok, entity}
  end

  @impl true
  def on_event(entity, _event, _payload), do: {:ok, entity}

  # Private helpers

  defp find_current_index(entity, path, default) do
    if entity.location_id do
      case Entities.get_entity(entity.location_id) do
        nil ->
          default

        room ->
          case Enum.find_index(path, &(&1 == room.key)) do
            nil -> default
            idx -> idx
          end
      end
    else
      default
    end
  end

  defp should_move?(last_move_at, pause_seconds) do
    DateTime.diff(DateTime.utc_now(), last_move_at, :second) >= pause_seconds
  end

  defp calculate_next_index(current, direction, path, loop?) do
    path_length = length(path)
    next = current + direction

    cond do
      next >= path_length ->
        if loop?, do: {0, 1}, else: {current - 1, -1}

      next < 0 ->
        if loop?, do: {path_length - 1, 1}, else: {1, 1}

      true ->
        {next, direction}
    end
  end
end
