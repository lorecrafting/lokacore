defmodule Loka.Framework.World.Weather do
  @moduledoc """
  Dynamic weather system affecting gameplay.

  Weather can affect:
  - Combat (rain reduces fire damage, etc.)
  - Gathering (some resources only available in certain weather)
  - Farming (rain auto-waters crops)
  - Movement (storms may slow travel)
  - NPC behavior

  ## Weather Configuration (YAML)

      # priv/world/config/weather.yml
      weather_types:
        clear:
          name: "Clear"
          description: "The sky is clear and bright."
          effects: {}
        rain:
          name: "Rain"
          description: "Rain falls steadily from grey clouds."
          effects:
            fire_damage: -0.25
            water_damage: 0.1
            auto_water_crops: true
            movement_speed: -0.1
        storm:
          name: "Storm"
          description: "Thunder rumbles and lightning flashes."
          effects:
            fire_damage: -0.5
            lightning_damage: 0.25
            movement_speed: -0.25
            outdoor_combat_chance: 0.1  # Chance of lightning strike

      regions:
        forest:
          rain_chance: 0.3
          storm_chance: 0.1
        desert:
          rain_chance: 0.05
          storm_chance: 0.02
        coastal:
          rain_chance: 0.4
          storm_chance: 0.15

  ## Usage

      alias Loka.Framework.World.Weather

      # Get current weather for a region
      weather = Weather.get_weather("forest")

      # Get weather effects
      effects = Weather.get_effects(weather)

      # Tick weather changes
      Weather.tick()
  """

  use GenServer
  require Logger

  alias Loka.Utils.MapHelpers

  @weather_table :loka_weather
  # 1 minute in milliseconds
  @tick_interval 60_000

  @default_weather_types %{
    "clear" => %{
      name: "Clear",
      description: "The sky is clear and bright.",
      effects: %{}
    },
    "cloudy" => %{
      name: "Cloudy",
      description: "Grey clouds cover the sky.",
      effects: %{}
    },
    "rain" => %{
      name: "Rain",
      description: "Rain falls steadily from grey clouds.",
      effects: %{
        fire_damage: -0.25,
        auto_water_crops: true,
        movement_speed: -0.1
      }
    },
    "storm" => %{
      name: "Storm",
      description: "Thunder rumbles and lightning flashes.",
      effects: %{
        fire_damage: -0.5,
        lightning_damage: 0.25,
        movement_speed: -0.25
      }
    },
    "fog" => %{
      name: "Fog",
      description: "Thick fog limits visibility.",
      effects: %{
        visibility: -0.5,
        ranged_accuracy: -0.2
      }
    },
    "snow" => %{
      name: "Snow",
      description: "Snowflakes drift down from the sky.",
      effects: %{
        cold_damage: 0.1,
        movement_speed: -0.15
      }
    }
  }

  @default_region_chances %{
    "default" => %{clear: 0.5, cloudy: 0.25, rain: 0.15, storm: 0.05, fog: 0.05}
  }

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets the current weather for a region.
  """
  def get_weather(region \\ "default", server \\ __MODULE__) do
    GenServer.call(server, {:get_weather, region})
  end

  @doc """
  Gets the weather type definition.
  """
  def get_weather_type(weather_key, server \\ __MODULE__) do
    GenServer.call(server, {:get_weather_type, weather_key})
  end

  @doc """
  Gets current weather effects for a region.
  """
  def get_effects(region \\ "default", server \\ __MODULE__) do
    case get_weather(region, server) do
      nil ->
        %{}

      weather_key ->
        case get_weather_type(weather_key, server) do
          nil -> %{}
          weather -> weather.effects
        end
    end
  end

  @doc """
  Manually sets weather for a region.
  """
  def set_weather(region, weather_key, server \\ __MODULE__) do
    GenServer.call(server, {:set_weather, region, weather_key})
  end

  @doc """
  Forces a weather change calculation.
  """
  def tick(server \\ __MODULE__) do
    GenServer.cast(server, :tick)
  end

  @doc """
  Gets all current weather across regions.
  """
  def get_all_weather(server \\ __MODULE__) do
    GenServer.call(server, :get_all_weather)
  end

  @doc """
  Reloads weather types and region chances from YAML configuration.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    auto_tick = Keyword.get(opts, :auto_tick, true)
    path = Keyword.get(opts, :path, "priv/world/config/weather.yml")

    table = :ets.new(@weather_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      weather_types: @default_weather_types,
      region_chances: @default_region_chances,
      current_weather: %{"default" => "clear"},
      timer_ref: nil
    }

    # Load from YAML or use defaults
    state = load_weather_config(state)

    # Update ETS table with weather types
    Enum.each(state.weather_types, fn {key, wt} ->
      :ets.insert(state.table, {key, wt})
    end)

    state =
      if auto_tick do
        schedule_tick(state)
      else
        state
      end

    Logger.info(
      "Weather system initialized with #{map_size(state.weather_types)} weather types, " <>
        "#{map_size(state.region_chances)} regions"
    )

    {:ok, state}
  end

  @impl true
  def handle_call({:get_weather, region}, _from, state) do
    weather =
      Map.get(state.current_weather, region, Map.get(state.current_weather, "default", "clear"))

    {:reply, weather, state}
  end

  @impl true
  def handle_call({:get_weather_type, weather_key}, _from, state) do
    {:reply, Map.get(state.weather_types, weather_key), state}
  end

  @impl true
  def handle_call({:set_weather, region, weather_key}, _from, state) do
    if Map.has_key?(state.weather_types, weather_key) do
      updated_weather = Map.put(state.current_weather, region, weather_key)
      {:reply, :ok, %{state | current_weather: updated_weather}}
    else
      {:reply, {:error, :invalid_weather}, state}
    end
  end

  @impl true
  def handle_call(:get_all_weather, _from, state) do
    {:reply, state.current_weather, state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    new_state = load_weather_config(state)

    # Update ETS table
    :ets.delete_all_objects(state.table)

    Enum.each(new_state.weather_types, fn {key, wt} ->
      :ets.insert(state.table, {key, wt})
    end)

    Logger.info(
      "Weather reloaded: #{map_size(new_state.weather_types)} weather types, " <>
        "#{map_size(new_state.region_chances)} regions"
    )

    {:reply, :ok, new_state}
  end

  @impl true
  def handle_cast(:tick, state) do
    new_weather = calculate_weather_changes(state)
    maybe_broadcast_atmosphere_change(state.current_weather, new_weather)
    {:noreply, %{state | current_weather: new_weather}}
  end

  @impl true
  def handle_info(:tick, state) do
    new_weather = calculate_weather_changes(state)
    maybe_broadcast_atmosphere_change(state.current_weather, new_weather)
    state = schedule_tick(%{state | current_weather: new_weather})
    {:noreply, state}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp schedule_tick(state) do
    if state.timer_ref, do: Process.cancel_timer(state.timer_ref)
    ref = Process.send_after(self(), :tick, @tick_interval)
    %{state | timer_ref: ref}
  end

  defp calculate_weather_changes(state) do
    Enum.map(state.current_weather, fn {region, _current} ->
      chances =
        Map.get(state.region_chances, region, Map.get(state.region_chances, "default", %{}))

      new_weather = roll_weather(chances)
      {region, new_weather}
    end)
    |> Enum.into(%{})
  end

  defp roll_weather(chances) do
    roll = :rand.uniform()

    chances
    |> Enum.reduce({0.0, "clear"}, fn {weather, chance}, {acc, current} ->
      new_acc = acc + chance

      if roll <= new_acc and roll > acc do
        {new_acc, Atom.to_string(weather)}
      else
        {new_acc, current}
      end
    end)
    |> elem(1)
  end

  defp maybe_broadcast_atmosphere_change(old_weather, new_weather) do
    if old_weather != new_weather do
      # Get the default region's weather to broadcast
      weather_key = Map.get(new_weather, "default", "clear")
      broadcast_atmosphere_change(weather_key)
    end
  end

  defp broadcast_atmosphere_change(weather_key) do
    alias Loka.Framework.World.Atmosphere

    # Use describe_with_phase_and_weather to avoid calling back to Weather GenServer
    phase = Atmosphere.get_phase()
    atmosphere = Atmosphere.describe_with_phase_and_weather(phase, weather_key)

    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "world:atmosphere",
      {:atmosphere_changed, atmosphere}
    )
  end

  # =============================================================================
  # YAML Loading
  # =============================================================================

  defp load_weather_config(state) do
    full_path = resolve_path(state.path)

    {weather_types, region_chances} =
      if File.exists?(full_path) do
        case load_from_yaml(full_path) do
          {:ok, wt, rc} ->
            {wt, rc}

          {:error, reason} ->
            Logger.warning("Failed to load weather config: #{inspect(reason)}, using defaults")
            {@default_weather_types, @default_region_chances}
        end
      else
        {@default_weather_types, @default_region_chances}
      end

    %{state | weather_types: weather_types, region_chances: region_chances}
  end

  # sobelow_skip ["Traversal.FileModule"] - path from Application.app_dir, not user input
  defp load_from_yaml(path) do
    with {:ok, content} <- File.read(path),
         {:ok, data} <- YamlElixir.read_from_string(content) do
      # Parse weather types
      weather_data = MapHelpers.get_flexible(data, :weather_types, %{})

      weather_types =
        Enum.reduce(weather_data, %{}, fn {key, value}, acc ->
          string_key = to_string(key)

          wt = %{
            name: MapHelpers.get_flexible(value, :name, string_key),
            description: MapHelpers.get_flexible(value, :description, ""),
            effects: parse_effects(MapHelpers.get_flexible(value, :effects, %{}))
          }

          Map.put(acc, string_key, wt)
        end)

      # Parse regions
      region_data = MapHelpers.get_flexible(data, :regions, %{})

      region_chances =
        Enum.reduce(region_data, %{}, fn {key, value}, acc ->
          string_key = to_string(key)

          # Convert atom keys to strings and keep numeric values
          chances =
            Enum.reduce(value, %{}, fn {weather_key, chance}, chances_acc ->
              Map.put(chances_acc, normalize_key(weather_key), chance)
            end)

          Map.put(acc, string_key, chances)
        end)

      {:ok, weather_types, region_chances}
    end
  end

  defp parse_effects(effects) when is_map(effects) do
    Enum.reduce(effects, %{}, fn {key, value}, acc ->
      atom_key = normalize_key(key)
      Map.put(acc, atom_key, value)
    end)
  end

  defp parse_effects(_), do: %{}

  defp normalize_key(key) when is_atom(key), do: key

  # sobelow_skip ["DOS.StringToAtom"] - keys from internal YAML config files
  defp normalize_key(key) when is_binary(key) do
    String.to_existing_atom(key)
  rescue
    ArgumentError -> String.to_atom(key)
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end
end
