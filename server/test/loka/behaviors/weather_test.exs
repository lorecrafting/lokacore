defmodule Loka.Behaviors.WeatherTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Weather
  alias Loka.Engine.Entity
  alias Loka.Engine.EntityServer.Volatile

  setup do
    Volatile.clear()
    :ok
  end

  defp weather_entity(opts \\ %{}) do
    weather_state = Map.get(opts, :weather, %{"current" => "clear"})
    config = Map.get(opts, :config, %{})

    %Entity{
      id: "weather_system",
      type: :system,
      key: "weather",
      components: %{
        "weather" => weather_state,
        "behavior_config" => %{"weather" => config}
      }
    }
  end

  describe "on_init/1" do
    test "initializes tick count to 0" do
      entity = weather_entity()
      assert {:ok, ^entity} = Weather.on_init(entity)
      assert Volatile.get(:tick_count) == 0
    end
  end

  describe "on_tick/1" do
    test "increments tick count when below transition threshold" do
      entity = weather_entity(%{config: %{"transition_ticks" => 5}})
      Volatile.set(:tick_count, 0)

      assert {:ok, ^entity} = Weather.on_tick(entity)
      assert Volatile.get(:tick_count) == 1
    end

    test "resets tick count and advances weather at threshold" do
      entity = weather_entity(%{config: %{"transition_ticks" => 1}})
      Volatile.set(:tick_count, 0)

      assert {:ok, updated} = Weather.on_tick(entity)
      assert Volatile.get(:tick_count) == 0
      assert updated.components["weather"]["current"] in ~w(clear cloudy rainy stormy foggy)
    end

    test "uses default transition_ticks of 10" do
      entity = weather_entity()
      Volatile.set(:tick_count, 5)

      assert {:ok, ^entity} = Weather.on_tick(entity)
      assert Volatile.get(:tick_count) == 6
    end

    test "respects custom weather_types" do
      entity =
        weather_entity(%{
          weather: %{"current" => "snow"},
          config: %{
            "weather_types" => ~w(snow blizzard hail),
            "transition_ticks" => 1
          }
        })

      Volatile.set(:tick_count, 0)

      assert {:ok, updated} = Weather.on_tick(entity)
      assert updated.components["weather"]["current"] in ~w(snow blizzard hail)
    end
  end

  describe "on_event/3" do
    test "passes through all events" do
      entity = weather_entity()
      assert {:ok, ^entity} = Weather.on_event(entity, :tick, %{})
      assert {:ok, ^entity} = Weather.on_event(entity, :damage, %{})
    end
  end
end
