defmodule Loka.Framework.World.DayNightTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.World.DayNight

  describe "start_link/1" do
    test "starts the GenServer with default options" do
      assert {:ok, pid} =
               DayNight.start_link(name: :"DayNight#{System.unique_integer([:positive])}")

      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "starts with custom cycle duration" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      assert {:ok, pid} = DayNight.start_link(name: name, cycle_duration: 1800)
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "starts with custom start hour" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      assert {:ok, pid} = DayNight.start_link(name: name, start_hour: 18)
      {hour, _minute} = DayNight.get_time(name)
      # Should start at approximately 18:00
      assert hour >= 17 and hour <= 19
      GenServer.stop(pid)
    end
  end

  describe "get_time/1" do
    test "returns time as {hour, minute} tuple" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name)

      {hour, minute} = DayNight.get_time(name)

      assert is_integer(hour)
      assert is_integer(minute)
      assert hour >= 0 and hour < 24
      assert minute >= 0 and minute < 60

      GenServer.stop(pid)
    end

    test "time progresses over real time" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      # Very short cycle for testing (10 seconds = 1 game day)
      # This means 1 real second = 2.4 game hours = 144 game minutes
      {:ok, pid} = DayNight.start_link(name: name, cycle_duration: 10, start_hour: 0)

      {hour1, minute1} = DayNight.get_time(name)
      # Sleep for at least 1 second since System.system_time(:second) has second-level granularity
      Process.sleep(1100)
      {hour2, minute2} = DayNight.get_time(name)

      # Time should have progressed
      time1 = hour1 * 60 + minute1
      time2 = hour2 * 60 + minute2
      assert time2 > time1

      GenServer.stop(pid)
    end
  end

  describe "get_phase/1" do
    test "returns dawn phase (5:00-7:00)" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 6)

      assert DayNight.get_phase(name) == :dawn

      GenServer.stop(pid)
    end

    test "returns day phase (7:00-17:00)" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 12)

      assert DayNight.get_phase(name) == :day

      GenServer.stop(pid)
    end

    test "returns dusk phase (17:00-19:00)" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 18)

      assert DayNight.get_phase(name) == :dusk

      GenServer.stop(pid)
    end

    test "returns night phase (19:00-5:00)" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 22)

      assert DayNight.get_phase(name) == :night

      GenServer.stop(pid)
    end

    test "returns night phase for early morning (0:00-5:00)" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 2)

      assert DayNight.get_phase(name) == :night

      GenServer.stop(pid)
    end
  end

  describe "get_light_level/1" do
    test "returns 1.0 for day" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 12)

      assert DayNight.get_light_level(name) == 1.0

      GenServer.stop(pid)
    end

    test "returns 0.5 for dawn" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 6)

      assert DayNight.get_light_level(name) == 0.5

      GenServer.stop(pid)
    end

    test "returns 0.5 for dusk" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 18)

      assert DayNight.get_light_level(name) == 0.5

      GenServer.stop(pid)
    end

    test "returns 0.1 for night" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 22)

      assert DayNight.get_light_level(name) == 0.1

      GenServer.stop(pid)
    end
  end

  describe "get_effects/1" do
    test "returns empty effects for day" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 12)

      assert DayNight.get_effects(name) == %{}

      GenServer.stop(pid)
    end

    test "returns perception penalty for dawn" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 6)

      effects = DayNight.get_effects(name)
      assert effects[:perception] == -0.1

      GenServer.stop(pid)
    end

    test "returns perception penalty for dusk" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 18)

      effects = DayNight.get_effects(name)
      assert effects[:perception] == -0.1

      GenServer.stop(pid)
    end

    test "returns multiple effects for night" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 22)

      effects = DayNight.get_effects(name)
      assert effects[:perception] == -0.3
      assert effects[:requires_light] == true

      GenServer.stop(pid)
    end
  end

  describe "requires_light?/1" do
    test "returns false during day" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 12)

      refute DayNight.requires_light?(name)

      GenServer.stop(pid)
    end

    test "returns false during dawn" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 6)

      refute DayNight.requires_light?(name)

      GenServer.stop(pid)
    end

    test "returns false during dusk" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 18)

      refute DayNight.requires_light?(name)

      GenServer.stop(pid)
    end

    test "returns true during night" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 22)

      assert DayNight.requires_light?(name)

      GenServer.stop(pid)
    end
  end

  describe "format_time/1" do
    test "formats midnight as 12:00 AM" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 0)

      formatted = DayNight.format_time(name)
      assert formatted =~ ~r/12:\d{2} AM/

      GenServer.stop(pid)
    end

    test "formats noon as 12:00 PM" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 12)

      formatted = DayNight.format_time(name)
      assert formatted =~ ~r/12:\d{2} PM/

      GenServer.stop(pid)
    end

    test "formats morning hours with AM" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 9)

      formatted = DayNight.format_time(name)
      assert formatted =~ ~r/\d{1,2}:\d{2} AM/

      GenServer.stop(pid)
    end

    test "formats afternoon hours with PM" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 15)

      formatted = DayNight.format_time(name)
      assert formatted =~ ~r/\d{1,2}:\d{2} PM/

      GenServer.stop(pid)
    end

    test "pads minutes with leading zero" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name)

      formatted = DayNight.format_time(name)
      assert formatted =~ ~r/\d{1,2}:\d{2} (AM|PM)/

      GenServer.stop(pid)
    end
  end

  describe "describe_time/1" do
    test "describes dawn" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 6)

      assert DayNight.describe_time(name) == "The first light of dawn breaks over the horizon."

      GenServer.stop(pid)
    end

    test "describes day" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 12)

      assert DayNight.describe_time(name) == "The sun shines brightly overhead."

      GenServer.stop(pid)
    end

    test "describes dusk" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 18)

      assert DayNight.describe_time(name) == "The sun sets, painting the sky in orange and red."

      GenServer.stop(pid)
    end

    test "describes night" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 22)

      assert DayNight.describe_time(name) == "Stars twinkle in the dark night sky."

      GenServer.stop(pid)
    end
  end

  describe "set_time/3" do
    test "sets the time to a specific hour" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 0)

      assert :ok = DayNight.set_time(15, 0, name)
      {hour, minute} = DayNight.get_time(name)

      # Should be approximately 15:00 (allowing for small timing differences)
      assert hour == 15
      assert minute >= 0 and minute < 5

      GenServer.stop(pid)
    end

    test "sets the time with specific minutes" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 0)

      assert :ok = DayNight.set_time(14, 30, name)
      {hour, minute} = DayNight.get_time(name)

      # Should be approximately 14:30
      assert hour == 14
      assert minute >= 28 and minute <= 32

      GenServer.stop(pid)
    end

    test "can set time to midnight" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 12)

      assert :ok = DayNight.set_time(0, 0, name)
      {hour, _minute} = DayNight.get_time(name)

      assert hour == 0

      GenServer.stop(pid)
    end

    test "can set time to end of day" do
      name = :"DayNight#{System.unique_integer([:positive])}"
      {:ok, pid} = DayNight.start_link(name: name, start_hour: 0)

      assert :ok = DayNight.set_time(23, 59, name)
      {hour, minute} = DayNight.get_time(name)

      assert hour == 23
      assert minute >= 57

      GenServer.stop(pid)
    end
  end

  describe "get_phase_info/1" do
    test "returns dawn phase info" do
      info = DayNight.get_phase_info(:dawn)

      assert info.start_hour == 5
      assert info.end_hour == 7
      assert info.light_level == 0.5
      assert info.effects[:perception] == -0.1
    end

    test "returns day phase info" do
      info = DayNight.get_phase_info(:day)

      assert info.start_hour == 7
      assert info.end_hour == 17
      assert info.light_level == 1.0
      assert info.effects == %{}
    end

    test "returns dusk phase info" do
      info = DayNight.get_phase_info(:dusk)

      assert info.start_hour == 17
      assert info.end_hour == 19
      assert info.light_level == 0.5
      assert info.effects[:perception] == -0.1
    end

    test "returns night phase info" do
      info = DayNight.get_phase_info(:night)

      assert info.start_hour == 19
      assert info.end_hour == 5
      assert info.light_level == 0.1
      assert info.effects[:perception] == -0.3
      assert info.effects[:requires_light] == true
    end

    test "returns nil for invalid phase" do
      assert DayNight.get_phase_info(:invalid) == nil
    end
  end
end
