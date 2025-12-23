defmodule Exmud.Framework.Status.StatusRegistry do
  @moduledoc """
  Loads and stores status effect definitions from YAML files.

  Status effects are stored as YAML files in `priv/world/statuses/`. This registry:
  - Reads all YAML files from the statuses directory
  - Parses each status effect definition
  - Stores status effects in ETS for fast concurrent lookup

  ## Usage

      alias Exmud.Framework.Status.StatusRegistry

      # Get a status by key
      {:ok, status} = StatusRegistry.get("poisoned")

      # List all statuses
      statuses = StatusRegistry.all()

      # List buffs only
      buffs = StatusRegistry.by_type(:buff)

      # Hot-reload from disk
      :ok = StatusRegistry.reload()
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Status.StatusEffect

  @status_table :exmud_statuses
  @default_path "priv/world/statuses"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the StatusRegistry GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a status effect by key.

  Returns `{:ok, status}` or `{:error, :not_found}`.
  """
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc """
  Gets a status effect by key, raises if not found.
  """
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, status} -> status
      {:error, :not_found} -> raise "Status effect not found: #{key}"
    end
  end

  @doc """
  Lists all status effects of a specific type.
  """
  def by_type(type, server \\ __MODULE__) when is_atom(type) do
    GenServer.call(server, {:by_type, type})
  end

  @doc """
  Lists all status effects with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc """
  Returns all loaded status effects.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns the count of loaded status effects.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Checks if a status effect exists.
  """
  def exists?(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  @doc """
  Reloads all status effects from disk.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Loads status effects from a specific path (useful for testing).
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

    table = :ets.new(@status_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      statuses: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("StatusRegistry loaded #{map_size(new_state.statuses)} status effects")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("StatusRegistry started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.statuses, key) do
        nil -> {:error, :not_found}
        status -> {:ok, status}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:by_type, type}, _from, state) do
    statuses =
      state.statuses
      |> Map.values()
      |> Enum.filter(&(&1.type == type))

    {:reply, statuses, state}
  end

  @impl true
  def handle_call({:by_tag, tag}, _from, state) do
    statuses =
      state.statuses
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, statuses, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.statuses), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.statuses), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("StatusRegistry reloaded #{map_size(new_state.statuses)} status effects")
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
      {statuses, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        update_ets(state.table, statuses)
        {:ok, %{state | statuses: statuses}}
      end
    else
      Logger.debug("StatusRegistry: path #{full_path} does not exist, starting empty")
      {:ok, %{state | statuses: %{}}}
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
    Enum.reduce(files, {%{}, []}, fn file, {statuses, errors} ->
      case parse_yaml_file(file) do
        {:ok, status} ->
          {Map.put(statuses, status.key, status), errors}

        {:error, reason} ->
          {statuses, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, status} <- StatusEffect.from_map(data) do
      {:ok, status}
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp update_ets(table, statuses) do
    :ets.delete_all_objects(table)

    Enum.each(statuses, fn {key, status} ->
      :ets.insert(table, {key, status})
    end)
  end
end
