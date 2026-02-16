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
  require Logger

  alias Loka.Engine.{EventBus, Event, StateMachine}
  alias Loka.Engine.EntityServer.Volatile
  alias Loka.Behaviors.Runner

  @default_phases ~w(dawn day dusk night)
  @default_ticks_per_phase 15

  @phase_machine StateMachine.new(%{
                   initial: "dawn",
                   transitions: %{
                     "dawn" => ["day"],
                     "day" => ["dusk"],
                     "dusk" => ["night"],
                     "night" => ["dawn"]
                   }
                 })

  def phase_machine, do: @phase_machine

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

    # Validate transition if using default phases
    if phases == @default_phases do
      case StateMachine.transition(@phase_machine, current, next) do
        {:ok, _} ->
          do_advance_phase(entity, time, current, next)

        {:error, {:invalid_transition, from, to}} ->
          Logger.warning("[DayNight] Invalid phase transition: #{from} → #{to}, skipping")

          {:ok, entity}
      end
    else
      # Custom phases bypass the machine (they have different valid transitions)
      do_advance_phase(entity, time, current, next)
    end
  end

  defp do_advance_phase(entity, time, current, next) do
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
