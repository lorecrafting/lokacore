defmodule Loka.Engine.ZoneLoader do
  @moduledoc """
  Loads zone definitions from YAML files into an ETS registry.

  Zones are stored as YAML files in `priv/world/zones/`. This loader:
  - Reads all YAML files from the zones directory
  - Parses and validates each zone definition
  - Stores zones in ETS for fast concurrent lookup

  ## Directory Structure

      priv/world/zones/
      ├── monastery.yml
      ├── village.yml
      └── forest.yml

  ## Usage

      # Get a zone by key
      {:ok, zone} = ZoneLoader.get("monastery")

      # List all zones
      zones = ZoneLoader.all()

      # Hot-reload all zones
      :ok = ZoneLoader.reload()
  """

  use GenServer
  require Logger

  alias Loka.Engine.Constants.WorldPaths
  alias Loka.Engine.Zone

  @zone_table :loka_zones
  @default_path WorldPaths.zones_dir()

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the ZoneLoader GenServer.

  ## Options

  - `:path` - Path to zones directory (default: "priv/world/zones")
  - `:name` - Process name (default: __MODULE__)
  - `:load_on_start` - Whether to load zones on start (default: true)
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a zone by key.

  Returns `{:ok, zone}` or `{:error, :not_found}`.
  """
  @spec get(String.t(), GenServer.server()) :: {:ok, Zone.t()} | {:error, :not_found}
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc """
  Gets a zone by key, raises if not found.
  """
  @spec get!(String.t(), GenServer.server()) :: Zone.t()
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, zone} -> zone
      {:error, :not_found} -> raise "Zone not found: #{key}"
    end
  end

  @doc """
  Returns all loaded zones.
  """
  @spec all(GenServer.server()) :: [Zone.t()]
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns all enabled zones.
  """
  @spec enabled(GenServer.server()) :: [Zone.t()]
  def enabled(server \\ __MODULE__) do
    GenServer.call(server, :enabled)
  end

  @doc """
  Returns the count of loaded zones.
  """
  @spec count(GenServer.server()) :: non_neg_integer()
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Validates all zones for broken references.

  Returns `:ok` if valid, or `{:error, errors}` with list of issues.
  """
  @spec validate_all(GenServer.server()) :: :ok | {:error, [term()]}
  def validate_all(server \\ __MODULE__) do
    GenServer.call(server, :validate_all)
  end

  @doc """
  Reloads all zones from disk. Hot-reload without restart.
  """
  @spec reload(GenServer.server()) :: :ok | {:error, term()}
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Updates a zone's last_reset_at timestamp.
  """
  @spec update_last_reset(String.t(), DateTime.t(), GenServer.server()) :: :ok
  def update_last_reset(key, timestamp, server \\ __MODULE__) do
    GenServer.cast(server, {:update_last_reset, key, timestamp})
  end

  @doc """
  Enables or disables a zone.
  """
  @spec set_enabled(String.t(), boolean(), GenServer.server()) :: :ok | {:error, :not_found}
  def set_enabled(key, enabled, server \\ __MODULE__) do
    GenServer.call(server, {:set_enabled, key, enabled})
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    # Create ETS table for zone storage
    table = :ets.new(@zone_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      zones: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("ZoneLoader loaded #{map_size(new_state.zones)} zones")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("ZoneLoader started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.zones, key) do
        nil -> {:error, :not_found}
        zone -> {:ok, zone}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.zones), state}
  end

  @impl true
  def handle_call(:enabled, _from, state) do
    enabled_zones =
      state.zones
      |> Map.values()
      |> Enum.filter(& &1.enabled)

    {:reply, enabled_zones, state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.zones), state}
  end

  @impl true
  def handle_call(:validate_all, _from, state) do
    errors = do_validate_all(state.zones)
    result = if Enum.empty?(errors), do: :ok, else: {:error, errors}
    {:reply, result, state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("ZoneLoader reloaded #{map_size(new_state.zones)} zones")
        {:reply, :ok, new_state}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  @impl true
  def handle_call({:set_enabled, key, enabled}, _from, state) do
    case Map.get(state.zones, key) do
      nil ->
        {:reply, {:error, :not_found}, state}

      zone ->
        updated_zone = %{zone | enabled: enabled}
        new_zones = Map.put(state.zones, key, updated_zone)
        :ets.insert(state.table, {key, updated_zone})
        {:reply, :ok, %{state | zones: new_zones}}
    end
  end

  @impl true
  def handle_cast({:update_last_reset, key, timestamp}, state) do
    case Map.get(state.zones, key) do
      nil ->
        {:noreply, state}

      zone ->
        updated_zone = %{zone | last_reset_at: timestamp}
        new_zones = Map.put(state.zones, key, updated_zone)
        :ets.insert(state.table, {key, updated_zone})
        {:noreply, %{state | zones: new_zones}}
    end
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      # Find all YAML files
      yaml_files = find_yaml_files(full_path)

      # Parse all files into zones
      {zones, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        # Update ETS table
        update_ets(state.table, zones)
        {:ok, %{state | zones: zones}}
      end
    else
      Logger.debug("ZoneLoader: path #{full_path} does not exist, starting empty")
      {:ok, %{state | zones: %{}}}
    end
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  defp find_yaml_files(dir) do
    Path.wildcard(Path.join([dir, "**", "*.{yml,yaml}"]))
  end

  defp parse_yaml_files(files) do
    Enum.reduce(files, {%{}, []}, fn file, {zones, errors} ->
      case parse_yaml_file(file) do
        {:ok, zone} ->
          {Map.put(zones, zone.key, zone), errors}

        {:error, reason} ->
          {zones, [{file, reason} | errors]}
      end
    end)
  end

  # sobelow_skip ["Traversal.FileModule"]
  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, zone} <- Zone.new(data) do
      {:ok, zone}
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp update_ets(table, zones) do
    # Clear existing entries
    :ets.delete_all_objects(table)

    # Insert all zones
    Enum.each(zones, fn {key, zone} ->
      :ets.insert(table, {key, zone})
    end)
  end

  defp do_validate_all(zones) do
    # Validate that rooms and prototypes referenced in zones exist
    # This requires access to TypedObject.Loader, which we'll check at reset time
    # For now, just validate the zone structs themselves
    zones
    |> Map.values()
    |> Enum.flat_map(fn zone ->
      case Zone.validate(zone) do
        {:ok, _} -> []
        {:error, errors} -> Enum.map(errors, &{zone.key, &1})
      end
    end)
  end
end
