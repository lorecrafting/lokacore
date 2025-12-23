defmodule Exmud.Framework.Farming.CropRegistry do
  @moduledoc """
  Loads and stores crop definitions from YAML files.

  Crops are stored as YAML files in `priv/world/crops/`. This registry:
  - Reads all YAML files from the crops directory
  - Parses each crop definition
  - Stores crops in ETS for fast concurrent lookup

  ## YAML Format

      key: wheat_crop
      name: "Wheat"
      seed_item: wheat_seeds
      growth_stages:
        - stage: planted
          duration: 300
          description: "Seeds freshly planted."
        - stage: sprouting
          duration: 600
          description: "Small green shoots emerge."
        - stage: harvestable
          duration: null
          description: "Golden wheat ready for harvest."
      harvest_yield:
        - item: wheat
          quantity: [3, 6]
        - item: wheat_seeds
          quantity: [1, 2]
          chance: 0.5
      requires_water: true
      can_wither: true
      wither_time: 1800
      skill_required: farming
      xp_reward:
        skill: farming
        amount: 15

  ## Usage

      alias Exmud.Framework.Farming.CropRegistry

      {:ok, crop} = CropRegistry.get("wheat_crop")
      crops = CropRegistry.all()
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Farming.Crop

  @crop_table :exmud_crops
  @default_path "priv/world/crops"

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, crop} -> crop
      {:error, :not_found} -> raise "Crop not found: #{key}"
    end
  end

  @doc """
  Finds the crop that uses a specific seed item.
  """
  def by_seed(seed_item, server \\ __MODULE__) when is_binary(seed_item) do
    GenServer.call(server, {:by_seed, seed_item})
  end

  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  def exists?(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  def load_from(path, server \\ __MODULE__) when is_binary(path) do
    GenServer.call(server, {:load_from, path})
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(@crop_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      crops: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("CropRegistry loaded #{map_size(new_state.crops)} crops")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("CropRegistry started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.crops, key) do
        nil -> {:error, :not_found}
        crop -> {:ok, crop}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:by_seed, seed_item}, _from, state) do
    crop =
      state.crops
      |> Map.values()
      |> Enum.find(&(&1.seed_item == seed_item))

    result = if crop, do: {:ok, crop}, else: {:error, :not_found}
    {:reply, result, state}
  end

  @impl true
  def handle_call({:by_tag, tag}, _from, state) do
    crops =
      state.crops
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, crops, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.crops), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.crops), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("CropRegistry reloaded #{map_size(new_state.crops)} crops")
        {:reply, :ok, new_state}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  @impl true
  def handle_call({:load_from, path}, _from, state) do
    case do_load_all(state, path) do
      {:ok, new_state} ->
        {:reply, :ok, %{new_state | path: path}}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      yaml_files = find_yaml_files(full_path)
      {crops, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        update_ets(state.table, crops)
        {:ok, %{state | crops: crops}}
      end
    else
      Logger.debug("CropRegistry: path #{full_path} does not exist, starting empty")
      {:ok, %{state | crops: %{}}}
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
    Enum.reduce(files, {%{}, []}, fn file, {crops, errors} ->
      case parse_yaml_file(file) do
        {:ok, crop} ->
          {Map.put(crops, crop.key, crop), errors}

        {:error, reason} ->
          {crops, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, crop} <- Crop.from_map(data) do
      {:ok, crop}
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp update_ets(table, crops) do
    :ets.delete_all_objects(table)

    Enum.each(crops, fn {key, crop} ->
      :ets.insert(table, {key, crop})
    end)
  end
end
