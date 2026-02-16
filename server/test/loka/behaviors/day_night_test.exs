defmodule Loka.Behaviors.DayNightTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.DayNight
  alias Loka.Engine.Entity
  alias Loka.Engine.EntityServer.Volatile

  setup do
    Volatile.clear()
    :ok
  end

  defp time_entity(opts \\ %{}) do
    time_state = Map.get(opts, :time, %{"phase" => "day"})
    config = Map.get(opts, :config, %{})

    %Entity{
      id: "time_system",
      type: :system,
      key: "day_night",
      components: %{
        "time" => time_state,
        "behavior_config" => %{"day_night" => config}
      }
    }
  end

  describe "on_init/1" do
    test "initializes tick count to 0" do
      entity = time_entity()
      assert {:ok, ^entity} = DayNight.on_init(entity)
      assert Volatile.get(:tick_count) == 0
    end
  end

  describe "on_tick/1" do
    test "increments tick count when below phase threshold" do
      entity = time_entity(%{config: %{"ticks_per_phase" => 5}})
      Volatile.set(:tick_count, 0)

      assert {:ok, ^entity} = DayNight.on_tick(entity)
      assert Volatile.get(:tick_count) == 1
    end

    test "advances phase at threshold" do
      entity = time_entity(%{time: %{"phase" => "dawn"}, config: %{"ticks_per_phase" => 1}})
      Volatile.set(:tick_count, 0)

      assert {:ok, updated} = DayNight.on_tick(entity)
      assert Volatile.get(:tick_count) == 0
      assert updated.components["time"]["phase"] == "day"
    end

    test "cycles through phases in order" do
      phases = ~w(dawn day dusk night)

      Enum.reduce(phases, "dawn", fn _phase, current ->
        entity = time_entity(%{time: %{"phase" => current}, config: %{"ticks_per_phase" => 1}})
        Volatile.set(:tick_count, 0)

        {:ok, updated} = DayNight.on_tick(entity)
        next = updated.components["time"]["phase"]

        expected_index = rem((Enum.find_index(phases, &(&1 == current)) || 0) + 1, 4)
        assert next == Enum.at(phases, expected_index)

        next
      end)
    end

    test "wraps from night back to dawn" do
      entity = time_entity(%{time: %{"phase" => "night"}, config: %{"ticks_per_phase" => 1}})
      Volatile.set(:tick_count, 0)

      assert {:ok, updated} = DayNight.on_tick(entity)
      assert updated.components["time"]["phase"] == "dawn"
    end

    test "uses default ticks_per_phase of 15" do
      entity = time_entity()
      Volatile.set(:tick_count, 10)

      assert {:ok, ^entity} = DayNight.on_tick(entity)
      assert Volatile.get(:tick_count) == 11
    end

    test "respects custom phases" do
      entity =
        time_entity(%{
          time: %{"phase" => "morning"},
          config: %{
            "phases" => ~w(morning afternoon evening),
            "ticks_per_phase" => 1
          }
        })

      Volatile.set(:tick_count, 0)

      assert {:ok, updated} = DayNight.on_tick(entity)
      assert updated.components["time"]["phase"] == "afternoon"
    end
  end

  describe "on_event/3" do
    test "passes through all events" do
      entity = time_entity()
      assert {:ok, ^entity} = DayNight.on_event(entity, :tick, %{})
    end
  end
end
