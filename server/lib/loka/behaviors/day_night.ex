defmodule Loka.Behaviors.DayNight do
  @moduledoc """
  System entity behavior that manages the day/night cycle.

  Replaces the deleted `Loka.Framework.World.DayNight` module.
  Runs as a behavior on a system entity tagged `auto_start`.

  ## Configuration (in behavior_config.day_night)

  - `phases` - Ordered list of time phases (default: ~w(dawn day dusk night))
  - `ticks_per_phase` - Ticks before advancing to next phase (default: 15)

  ## Volatile State

  - `:tick_count` - Ticks since last phase change
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event}
  alias Loka.Engine.EntityServer.Volatile
  alias Loka.Behaviors.Runner

  @default_phases ~w(dawn day dusk night)
  @default_ticks_per_phase 15

  @impl true
  def on_init(entity) do
    Volatile.set(:tick_count, 0)
    {:ok, entity}
  end

  @impl true
  def on_tick(entity) do
    config = Runner.get_config(entity, __MODULE__)
    ticks_per_phase = config[:ticks_per_phase] || @default_ticks_per_phase
    tick_count = Volatile.get(:tick_count, 0) + 1

    if tick_count >= ticks_per_phase do
      Volatile.set(:tick_count, 0)
      advance_phase(entity, config)
    else
      Volatile.set(:tick_count, tick_count)
      {:ok, entity}
    end
  end

  @impl true
  def on_event(entity, _event, _payload), do: {:ok, entity}

  # Private

  defp advance_phase(entity, config) do
    phases = config[:phases] || @default_phases
    time = entity.components["time"] || %{}
    current = time["phase"] || List.first(phases, "day")

    next = next_phase(current, phases)

    EventBus.emit(
      Event.new(:time_change, %{
        payload: %{
          from: current,
          to: next,
          entity_id: entity.id
        }
      })
    )

    updated_components =
      Map.put(entity.components, "time", Map.put(time, "phase", next))

    {:ok, %{entity | components: updated_components}}
  end

  defp next_phase(current, phases) do
    current_index = Enum.find_index(phases, &(&1 == current)) || 0
    next_index = rem(current_index + 1, length(phases))
    Enum.at(phases, next_index)
  end
end
