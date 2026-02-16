defmodule Loka.Behaviors.Weather do
  @moduledoc """
  System entity behavior that manages weather transitions.

  Replaces the deleted `Loka.Framework.World.Weather` module.
  Runs as a behavior on a system entity tagged `auto_start`.

  ## Configuration (in behavior_config.weather)

  - `weather_types` - Available weather states (default: ~w(clear cloudy rainy stormy foggy))
  - `transition_ticks` - Ticks between weather changes (default: 10)

  ## Volatile State

  - `:tick_count` - Ticks since last weather change
  """

  @behaviour Loka.Engine.EntityBehavior

  alias Loka.Engine.{EventBus, Event, StateMachine}
  alias Loka.Engine.EntityServer.Volatile
  alias Loka.Behaviors.Runner

  @default_weather_types ~w(clear cloudy rainy stormy foggy)
  @default_transition_ticks 10

  @weather_machine StateMachine.new(%{
                     initial: "clear",
                     transitions: %{
                       "clear" => ["cloudy", "foggy"],
                       "cloudy" => ["clear", "rainy"],
                       "rainy" => ["cloudy", "stormy"],
                       "stormy" => ["rainy", "foggy"],
                       "foggy" => ["clear", "cloudy"]
                     }
                   })

  def weather_machine, do: @weather_machine

  @impl true
  def on_init(entity) do
    Volatile.set(:tick_count, 0)
    {:ok, entity}
  end

  @impl true
  def on_tick(entity) do
    config = Runner.get_config(entity, __MODULE__)
    transition_ticks = config[:transition_ticks] || @default_transition_ticks
    tick_count = Volatile.get(:tick_count, 0) + 1

    if tick_count >= transition_ticks do
      Volatile.set(:tick_count, 0)
      advance_weather(entity, config)
    else
      Volatile.set(:tick_count, tick_count)
      {:ok, entity}
    end
  end

  @impl true
  def on_event(entity, _event, _payload), do: {:ok, entity}

  # Private

  defp advance_weather(entity, config) do
    weather_types = config[:weather_types] || @default_weather_types
    weather = entity.components["weather"] || %{}
    current = weather["current"] || "clear"

    next = pick_next_weather(current, weather_types)

    if next != current do
      EventBus.emit(
        Event.new(:weather_change, %{
          payload: %{
            from: current,
            to: next,
            entity_id: entity.id
          }
        })
      )
    end

    updated_components =
      Map.put(entity.components, "weather", Map.put(weather, "current", next))

    {:ok, %{entity | components: updated_components}}
  end

  defp pick_next_weather(current, weather_types) do
    # Weighted toward adjacent weather (gradual transitions)
    case weather_types do
      [] ->
        current

      types ->
        current_index = Enum.find_index(types, &(&1 == current)) || 0
        max_index = length(types) - 1

        # 40% stay, 30% adjacent forward, 30% adjacent back
        roll = :rand.uniform(100)

        candidate =
          cond do
            roll <= 40 -> current
            roll <= 70 -> Enum.at(types, min(current_index + 1, max_index))
            true -> Enum.at(types, max(current_index - 1, 0))
          end

        # Validate transition if using default weather types
        if candidate != current && weather_types == @default_weather_types do
          if StateMachine.can_transition?(@weather_machine, current, candidate) do
            candidate
          else
            current
          end
        else
          candidate
        end
    end
  end
end
