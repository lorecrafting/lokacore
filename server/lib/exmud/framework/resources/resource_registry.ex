defmodule Exmud.Framework.Resources.ResourceRegistry do
  @moduledoc """
  Loads and stores resource type definitions from YAML files.

  Resources are stored as YAML files in `priv/world/resources/`. This registry:
  - Reads all YAML files from the resources directory
  - Parses each resource definition
  - Stores resources in ETS for fast concurrent lookup

  ## YAML Format

      key: mana
      name: "Mana"
      max_formula: "level * 10 + sta * 2"
      regen_rate: 2
      regen_condition: out_of_combat
      color: blue
      description: "Magical energy for casting spells"

  ## Usage

      alias Exmud.Framework.Resources.ResourceRegistry

      # Get a resource by key
      {:ok, resource} = ResourceRegistry.get("mana")

      # List all resources
      resources = ResourceRegistry.all()

      # Hot-reload from disk
      :ok = ResourceRegistry.reload()
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Resources.Resource

  @resource_table :exmud_resources
  @default_path "priv/world/resources"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the ResourceRegistry GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a resource by key.

  Returns `{:ok, resource}` or `{:error, :not_found}`.
  """
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc """
  Gets a resource by key, raises if not found.
  """
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, resource} -> resource
      {:error, :not_found} -> raise "Resource not found: #{key}"
    end
  end

  @doc """
  Returns all loaded resources.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns the count of loaded resources.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Returns resources that regenerate (regen_rate > 0).
  """
  def regenerating(server \\ __MODULE__) do
    GenServer.call(server, :regenerating)
  end

  @doc """
  Checks if a resource exists.
  """
  def exists?(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  @doc """
  Reloads all resources from disk.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Loads resources from a specific path (useful for testing).
  """
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

    table = :ets.new(@resource_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      resources: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("ResourceRegistry loaded #{map_size(new_state.resources)} resources")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("ResourceRegistry started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.resources, key) do
        nil -> {:error, :not_found}
        resource -> {:ok, resource}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.resources), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.resources), state}
  end

  @impl true
  def handle_call(:regenerating, _from, state) do
    resources =
      state.resources
      |> Map.values()
      |> Enum.filter(&Resource.regenerates?/1)

    {:reply, resources, state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("ResourceRegistry reloaded #{map_size(new_state.resources)} resources")
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
      {resources, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        update_ets(state.table, resources)
        {:ok, %{state | resources: resources}}
      end
    else
      Logger.debug("ResourceRegistry: path #{full_path} does not exist, starting empty")
      {:ok, %{state | resources: %{}}}
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
    Enum.reduce(files, {%{}, []}, fn file, {resources, errors} ->
      case parse_yaml_file(file) do
        {:ok, resource} ->
          {Map.put(resources, resource.key, resource), errors}

        {:error, reason} ->
          {resources, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, resource} <- Resource.from_map(data) do
      {:ok, resource}
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp update_ets(table, resources) do
    :ets.delete_all_objects(table)

    Enum.each(resources, fn {key, resource} ->
      :ets.insert(table, {key, resource})
    end)
  end
end
