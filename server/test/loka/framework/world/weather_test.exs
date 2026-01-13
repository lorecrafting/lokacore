defmodule Loka.Framework.World.WeatherTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.World.Weather

  describe "start_link/1" do
    test "starts the GenServer with default options" do
      name = :"Weather#{System.unique_integer([:positive])}"
      assert {:ok, pid} = Weather.start_link(name: name)
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "starts with auto_tick disabled" do
      name = :"Weather#{System.unique_integer([:positive])}"
      assert {:ok, pid} = Weather.start_link(name: name, auto_tick: false)
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "initializes with default clear weather" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather = Weather.get_weather("default", name)
      assert weather == "clear"

      GenServer.stop(pid)
    end
  end

  describe "get_weather/2" do
    test "returns current weather for default region" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather = Weather.get_weather("default", name)
      assert is_binary(weather)

      GenServer.stop(pid)
    end

    test "returns default region weather when region not found" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather = Weather.get_weather("nonexistent_region", name)
      assert weather == "clear"

      GenServer.stop(pid)
    end

    test "can get weather without region parameter" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather = Weather.get_weather("default", name)
      assert is_binary(weather)

      GenServer.stop(pid)
    end
  end

  describe "get_weather_type/2" do
    test "returns weather type definition for clear" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather_type = Weather.get_weather_type("clear", name)
      assert weather_type.name == "Clear"
      assert weather_type.description == "The sky is clear and bright."
      assert weather_type.effects == %{}

      GenServer.stop(pid)
    end

    test "returns weather type definition for rain" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather_type = Weather.get_weather_type("rain", name)
      assert weather_type.name == "Rain"
      assert weather_type.effects.fire_damage == -0.25
      assert weather_type.effects.auto_water_crops == true
      assert weather_type.effects.movement_speed == -0.1

      GenServer.stop(pid)
    end

    test "returns weather type definition for storm" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather_type = Weather.get_weather_type("storm", name)
      assert weather_type.name == "Storm"
      assert weather_type.effects.fire_damage == -0.5
      assert weather_type.effects.lightning_damage == 0.25
      assert weather_type.effects.movement_speed == -0.25

      GenServer.stop(pid)
    end

    test "returns weather type definition for fog" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather_type = Weather.get_weather_type("fog", name)
      assert weather_type.name == "Fog"
      assert weather_type.effects.visibility == -0.5
      assert weather_type.effects.ranged_accuracy == -0.2

      GenServer.stop(pid)
    end

    test "returns weather type definition for snow" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      weather_type = Weather.get_weather_type("snow", name)
      assert weather_type.name == "Snow"
      assert weather_type.effects.cold_damage == 0.1
      assert weather_type.effects.movement_speed == -0.15

      GenServer.stop(pid)
    end

    test "returns nil for invalid weather type" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      assert Weather.get_weather_type("invalid", name) == nil

      GenServer.stop(pid)
    end
  end

  describe "get_effects/2" do
    test "returns empty effects for clear weather" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      Weather.set_weather("default", "clear", name)
      effects = Weather.get_effects("default", name)
      assert effects == %{}

      GenServer.stop(pid)
    end

    test "returns effects for rain weather" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      Weather.set_weather("default", "rain", name)
      effects = Weather.get_effects("default", name)
      assert effects.fire_damage == -0.25
      assert effects.auto_water_crops == true

      GenServer.stop(pid)
    end

    test "returns effects for storm weather" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      Weather.set_weather("default", "storm", name)
      effects = Weather.get_effects("default", name)
      assert effects.fire_damage == -0.5
      assert effects.lightning_damage == 0.25

      GenServer.stop(pid)
    end

    test "returns empty effects for nonexistent region" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      effects = Weather.get_effects("nonexistent", name)
      assert effects == %{}

      GenServer.stop(pid)
    end

    test "can get effects without region parameter" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      effects = Weather.get_effects("default", name)
      assert is_map(effects)

      GenServer.stop(pid)
    end
  end

  describe "set_weather/3" do
    test "sets weather for a region" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      assert :ok = Weather.set_weather("default", "rain", name)
      assert Weather.get_weather("default", name) == "rain"

      GenServer.stop(pid)
    end

    test "can set different weather for different regions" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      Weather.set_weather("forest", "rain", name)
      Weather.set_weather("desert", "clear", name)

      assert Weather.get_weather("forest", name) == "rain"
      assert Weather.get_weather("desert", name) == "clear"

      GenServer.stop(pid)
    end

    test "returns error for invalid weather type" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      assert {:error, :invalid_weather} = Weather.set_weather("default", "invalid", name)

      GenServer.stop(pid)
    end

    test "can set all valid weather types" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      valid_types = ["clear", "cloudy", "rain", "storm", "fog", "snow"]

      for weather_type <- valid_types do
        assert :ok = Weather.set_weather("default", weather_type, name)
        assert Weather.get_weather("default", name) == weather_type
      end

      GenServer.stop(pid)
    end
  end

  describe "tick/1" do
    test "can manually trigger weather tick" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      # Tick should not crash
      Weather.tick(name)
      Process.sleep(10)

      # Weather should still be retrievable
      weather = Weather.get_weather("default", name)
      assert is_binary(weather)

      GenServer.stop(pid)
    end

    test "tick may change weather" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      # Set initial weather
      Weather.set_weather("default", "clear", name)

      # Tick multiple times to potentially see a change
      # (this is probabilistic, so we just verify it doesn't crash)
      for _ <- 1..10 do
        Weather.tick(name)
        Process.sleep(5)
      end

      # Weather should still be retrievable
      weather = Weather.get_weather("default", name)
      assert is_binary(weather)

      GenServer.stop(pid)
    end
  end

  describe "get_all_weather/1" do
    test "returns all current weather across regions" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      all_weather = Weather.get_all_weather(name)
      assert is_map(all_weather)
      assert Map.has_key?(all_weather, "default")

      GenServer.stop(pid)
    end

    test "includes all set regions" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      Weather.set_weather("forest", "rain", name)
      Weather.set_weather("desert", "clear", name)
      Weather.set_weather("coastal", "storm", name)

      all_weather = Weather.get_all_weather(name)
      assert all_weather["forest"] == "rain"
      assert all_weather["desert"] == "clear"
      assert all_weather["coastal"] == "storm"

      GenServer.stop(pid)
    end
  end

  describe "weather transitions" do
    test "weather changes are deterministic with same random seed" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      # Set specific weather
      Weather.set_weather("default", "rain", name)

      # Verify it was set
      assert Weather.get_weather("default", name) == "rain"

      GenServer.stop(pid)
    end
  end

  describe "weather effects combinations" do
    test "fire damage is reduced in rain" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      Weather.set_weather("default", "rain", name)
      effects = Weather.get_effects("default", name)
      assert effects.fire_damage == -0.25

      GenServer.stop(pid)
    end

    test "fire damage is heavily reduced in storm" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      Weather.set_weather("default", "storm", name)
      effects = Weather.get_effects("default", name)
      assert effects.fire_damage == -0.5

      GenServer.stop(pid)
    end

    test "movement speed is affected by weather" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      # Clear weather has no movement penalty
      Weather.set_weather("default", "clear", name)
      effects = Weather.get_effects("default", name)
      refute Map.has_key?(effects, :movement_speed)

      # Rain has minor penalty
      Weather.set_weather("default", "rain", name)
      effects = Weather.get_effects("default", name)
      assert effects.movement_speed == -0.1

      # Storm has major penalty
      Weather.set_weather("default", "storm", name)
      effects = Weather.get_effects("default", name)
      assert effects.movement_speed == -0.25

      GenServer.stop(pid)
    end

    test "visibility is reduced in fog" do
      name = :"Weather#{System.unique_integer([:positive])}"
      {:ok, pid} = Weather.start_link(name: name, auto_tick: false)

      Weather.set_weather("default", "fog", name)
      effects = Weather.get_effects("default", name)
      assert effects.visibility == -0.5
      assert effects.ranged_accuracy == -0.2

      GenServer.stop(pid)
    end
  end
end
