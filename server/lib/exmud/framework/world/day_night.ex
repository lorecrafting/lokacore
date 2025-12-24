defmodule Exmud.Framework.World.DayNight do
  @moduledoc """
  Day/night cycle system affecting the game world.

  The cycle affects:
  - Room descriptions (day vs night variants)
  - NPC schedules (shops close, nocturnal creatures appear)
  - Gathering (some resources only at certain times)
  - Combat (darkness penalties, night bonuses for undead)
  - Light requirements (torches needed at night)

  ## Time Phases

  - `dawn` (5:00-7:00) - Transition, some bonuses
  - `day` (7:00-17:00) - Normal gameplay
  - `dusk` (17:00-19:00) - Transition, shops close
  - `night` (19:00-5:00) - Darkness, different NPCs

  ## Configuration (YAML)

      # priv/world/config/time.yml
      day_night:
        cycle_duration: 3600       # Real seconds per game day (1 hour)
        phases:
          dawn:
            start_hour: 5
            end_hour: 7
            light_level: 0.5
            effects:
              perception: -0.1
          day:
            start_hour: 7
            end_hour: 17
            light_level: 1.0
            effects: {}
          dusk:
            start_hour: 17
            end_hour: 19
            light_level: 0.5
            effects:
              perception: -0.1
          night:
            start_hour: 19
            end_hour: 5
            light_level: 0.1
            effects:
              perception: -0.3
              undead_power: 0.2
              requires_light: true

  ## Usage

      alias Exmud.Framework.World.DayNight

      # Get current time
      {hour, minute} = DayNight.get_time()

      # Get current phase
      phase = DayNight.get_phase()  # :dawn, :day, :dusk, :night

      # Get light level
      light = DayNight.get_light_level()

      # Check if light is required
      DayNight.requires_light?()
  """

  use GenServer
  require Logger

  # 1 real hour = 1 game day
  @default_cycle_duration 3600
  @hours_per_day 24
  @minutes_per_hour 60

  @phases %{
    dawn: %{start_hour: 5, end_hour: 7, light_level: 0.5, effects: %{perception: -0.1}},
    day: %{start_hour: 7, end_hour: 17, light_level: 1.0, effects: %{}},
    dusk: %{start_hour: 17, end_hour: 19, light_level: 0.5, effects: %{perception: -0.1}},
    night: %{
      start_hour: 19,
      end_hour: 5,
      light_level: 0.1,
      effects: %{perception: -0.3, requires_light: true}
    }
  }

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets the current game time as {hour, minute}.
  """
  def get_time(server \\ __MODULE__) do
    GenServer.call(server, :get_time)
  end

  @doc """
  Gets the current time phase.
  """
  def get_phase(server \\ __MODULE__) do
    GenServer.call(server, :get_phase)
  end

  @doc """
  Gets the current light level (0.0 to 1.0).
  """
  def get_light_level(server \\ __MODULE__) do
    GenServer.call(server, :get_light_level)
  end

  @doc """
  Gets all effects active for the current phase.
  """
  def get_effects(server \\ __MODULE__) do
    GenServer.call(server, :get_effects)
  end

  @doc """
  Checks if light source is required.
  """
  def requires_light?(server \\ __MODULE__) do
    effects = get_effects(server)
    Map.get(effects, :requires_light, false)
  end

  @doc """
  Gets formatted time string.
  """
  def format_time(server \\ __MODULE__) do
    {hour, minute} = get_time(server)
    period = if hour >= 12, do: "PM", else: "AM"
    display_hour = rem(hour, 12)
    display_hour = if display_hour == 0, do: 12, else: display_hour
    "#{display_hour}:#{String.pad_leading(Integer.to_string(minute), 2, "0")} #{period}"
  end

  @doc """
  Gets a description of the current time.
  """
  def describe_time(server \\ __MODULE__) do
    case get_phase(server) do
      :dawn -> "The first light of dawn breaks over the horizon."
      :day -> "The sun shines brightly overhead."
      :dusk -> "The sun sets, painting the sky in orange and red."
      :night -> "Stars twinkle in the dark night sky."
    end
  end

  @doc """
  Manually sets the game time (for testing/admin).
  """
  def set_time(hour, minute \\ 0, server \\ __MODULE__) do
    GenServer.call(server, {:set_time, hour, minute})
  end

  @doc """
  Gets the phase definition.
  """
  def get_phase_info(phase) do
    Map.get(@phases, phase)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    cycle_duration = Keyword.get(opts, :cycle_duration, @default_cycle_duration)
    start_hour = Keyword.get(opts, :start_hour, 12)

    state = %{
      cycle_duration: cycle_duration,
      cycle_start: System.system_time(:second),
      offset_seconds: hour_to_seconds(start_hour, cycle_duration)
    }

    Logger.info("DayNight cycle initialized (#{cycle_duration}s cycle)")
    {:ok, state}
  end

  @impl true
  def handle_call(:get_time, _from, state) do
    {hour, minute} = calculate_time(state)
    {:reply, {hour, minute}, state}
  end

  @impl true
  def handle_call(:get_phase, _from, state) do
    {hour, _minute} = calculate_time(state)
    phase = hour_to_phase(hour)
    {:reply, phase, state}
  end

  @impl true
  def handle_call(:get_light_level, _from, state) do
    {hour, _minute} = calculate_time(state)
    phase = hour_to_phase(hour)
    phase_info = Map.get(@phases, phase, %{light_level: 1.0})
    {:reply, phase_info.light_level, state}
  end

  @impl true
  def handle_call(:get_effects, _from, state) do
    {hour, _minute} = calculate_time(state)
    phase = hour_to_phase(hour)
    phase_info = Map.get(@phases, phase, %{effects: %{}})
    {:reply, phase_info.effects, state}
  end

  @impl true
  def handle_call({:set_time, hour, minute}, _from, state) do
    # Calculate offset to make current time match requested time
    current_elapsed = rem(System.system_time(:second) - state.cycle_start, state.cycle_duration)

    target_seconds =
      hour_to_seconds(hour, state.cycle_duration) +
        minute_to_seconds(minute, state.cycle_duration)

    new_offset = target_seconds - current_elapsed

    {:reply, :ok, %{state | offset_seconds: new_offset}}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp calculate_time(state) do
    elapsed = System.system_time(:second) - state.cycle_start + state.offset_seconds
    raw_position = rem(elapsed, state.cycle_duration)

    cycle_position =
      if raw_position < 0, do: raw_position + state.cycle_duration, else: raw_position

    # Convert to game hours and minutes
    seconds_per_hour = state.cycle_duration / @hours_per_day
    total_hours = cycle_position / seconds_per_hour
    hour = trunc(total_hours) |> rem(@hours_per_day)
    minute = trunc((total_hours - trunc(total_hours)) * @minutes_per_hour)

    {hour, minute}
  end

  defp hour_to_phase(hour) do
    cond do
      hour >= 5 and hour < 7 -> :dawn
      hour >= 7 and hour < 17 -> :day
      hour >= 17 and hour < 19 -> :dusk
      true -> :night
    end
  end

  defp hour_to_seconds(hour, cycle_duration) do
    seconds_per_hour = cycle_duration / @hours_per_day
    trunc(hour * seconds_per_hour)
  end

  defp minute_to_seconds(minute, cycle_duration) do
    seconds_per_minute = cycle_duration / (@hours_per_day * @minutes_per_hour)
    trunc(minute * seconds_per_minute)
  end
end
