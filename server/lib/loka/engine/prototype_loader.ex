defmodule Loka.Engine.PrototypeLoader do
  @moduledoc """
  Loads prototypes from YAML files into an ETS registry.

  Prototypes are stored as YAML files in `priv/world/prototypes/`. This loader:
  - Reads all YAML files from the prototype directories
  - Parses and validates each prototype
  - Resolves parent inheritance chains
  - Stores prototypes in ETS for fast concurrent lookup

  ## Directory Structure

      priv/world/prototypes/
      ├── _base/           # Base prototypes (parents)
      ├── rooms/           # Room prototypes
      ├── npcs/            # NPC prototypes
      ├── items/           # Item prototypes
      └── exits/           # Exit prototypes

  ## Usage

      # Get a prototype by key (with parent merged)
      {:ok, prototype} = PrototypeLoader.get("goblin_warrior")

      # List all NPC prototypes
      npcs = PrototypeLoader.list_by_type(:npc)

      # Hot-reload all prototypes
      :ok = PrototypeLoader.reload()
  """

  use GenServer
  require Logger

  alias Loka.Engine.Prototype

  @prototype_table :loka_prototypes
  @default_path "priv/world/prototypes"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the PrototypeLoader GenServer.

  ## Options

  - `:path` - Path to prototype directory (default: "priv/world/prototypes")
  - `:name` - Process name (default: __MODULE__)
  - `:load_on_start` - Whether to load prototypes on start (default: true)
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a prototype by key, with parent inheritance resolved.

  Returns `{:ok, prototype}` or `{:error, :not_found}`.
  """
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc """
  Gets a prototype by key, raises if not found.
  """
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, prototype} -> prototype
      {:error, :not_found} -> raise "Prototype not found: #{key}"
    end
  end

  @doc """
  Lists all prototypes of a specific type.
  """
  def list_by_type(type, server \\ __MODULE__) when is_atom(type) do
    GenServer.call(server, {:list_by_type, type})
  end

  @doc """
  Lists all prototypes marked as templates.

  Templates are reusable prototypes meant for instantiation in the editor,
  not for direct world spawning.
  """
  def list_templates(server \\ __MODULE__) do
    GenServer.call(server, :list_templates)
  end

  @doc """
  Lists templates of a specific type.
  """
  def list_templates_by_type(type, server \\ __MODULE__) when is_atom(type) do
    GenServer.call(server, {:list_templates_by_type, type})
  end

  @doc """
  Returns all loaded prototypes.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns the count of loaded prototypes.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Validates all prototypes for broken references and cycles.

  Returns `:ok` if valid, or `{:error, errors}` with list of issues.
  """
  def validate_all(server \\ __MODULE__) do
    GenServer.call(server, :validate_all)
  end

  @doc """
  Reloads all prototypes from disk. Hot-reload without restart.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Loads prototypes from a specific path (useful for testing).
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

    # Create ETS table for prototype storage
    table = :ets.new(@prototype_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      raw_prototypes: %{},
      resolved_prototypes: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info(
            "PrototypeLoader loaded #{map_size(new_state.resolved_prototypes)} prototypes"
          )

          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("PrototypeLoader started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.resolved_prototypes, key) do
        nil -> {:error, :not_found}
        proto -> {:ok, proto}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:list_by_type, type}, _from, state) do
    prototypes =
      state.resolved_prototypes
      |> Map.values()
      |> Enum.filter(&(&1.type == type))

    {:reply, prototypes, state}
  end

  @impl true
  def handle_call(:list_templates, _from, state) do
    templates =
      state.resolved_prototypes
      |> Map.values()
      |> Enum.filter(&Prototype.template?/1)

    {:reply, templates, state}
  end

  @impl true
  def handle_call({:list_templates_by_type, type}, _from, state) do
    templates =
      state.resolved_prototypes
      |> Map.values()
      |> Enum.filter(fn p -> p.type == type and Prototype.template?(p) end)

    {:reply, templates, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.resolved_prototypes), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.resolved_prototypes), state}
  end

  @impl true
  def handle_call(:validate_all, _from, state) do
    errors = do_validate_all(state.raw_prototypes, state.resolved_prototypes)

    result = if Enum.empty?(errors), do: :ok, else: {:error, errors}
    {:reply, result, state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info(
          "PrototypeLoader reloaded #{map_size(new_state.resolved_prototypes)} prototypes"
        )

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
      # Find all YAML files recursively
      yaml_files = find_yaml_files(full_path)

      # Parse all files into raw prototypes
      {raw_prototypes, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        # Resolve parent inheritance
        case resolve_all_parents(raw_prototypes) do
          {:ok, resolved} ->
            # Update ETS table
            update_ets(state.table, resolved)

            {:ok, %{state | raw_prototypes: raw_prototypes, resolved_prototypes: resolved}}

          {:error, errors} ->
            {:error, errors}
        end
      end
    else
      Logger.debug("PrototypeLoader: path #{full_path} does not exist, starting empty")
      {:ok, %{state | raw_prototypes: %{}, resolved_prototypes: %{}}}
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
    Enum.reduce(files, {%{}, []}, fn file, {prototypes, errors} ->
      case parse_yaml_file(file) do
        {:ok, proto} ->
          {Map.put(prototypes, proto.key, proto), errors}

        {:error, reason} ->
          {prototypes, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, proto} <- Prototype.from_map(data) do
      {:ok, proto}
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp resolve_all_parents(raw_prototypes) do
    # Build dependency order (topological sort)
    case build_resolution_order(raw_prototypes) do
      {:ok, order} ->
        # Resolve each prototype in order
        resolved =
          Enum.reduce(order, %{}, fn key, acc ->
            raw = Map.fetch!(raw_prototypes, key)
            resolved_proto = resolve_parent(raw, acc)
            Map.put(acc, key, resolved_proto)
          end)

        {:ok, resolved}

      {:error, errors} ->
        {:error, errors}
    end
  end

  defp build_resolution_order(raw_prototypes) do
    # Simple topological sort: process prototypes without parents first,
    # then those whose parents are already processed
    keys = Map.keys(raw_prototypes)

    case do_topological_sort(keys, raw_prototypes, [], MapSet.new()) do
      {:ok, order} -> {:ok, order}
      {:error, cycle} -> {:error, [{:cycle_detected, cycle}]}
    end
  end

  defp do_topological_sort([], _raw, sorted, _visited) do
    {:ok, Enum.reverse(sorted)}
  end

  defp do_topological_sort(remaining, raw, sorted, visited) do
    # Find prototypes that can be resolved (no parent or parent already resolved)
    {ready, not_ready} =
      Enum.split_with(remaining, fn key ->
        proto = Map.get(raw, key)
        proto.parent == nil or MapSet.member?(visited, proto.parent)
      end)

    cond do
      Enum.empty?(ready) and Enum.empty?(not_ready) ->
        {:ok, Enum.reverse(sorted)}

      Enum.empty?(ready) ->
        # Remaining prototypes have broken or cyclic parent refs
        # Load them anyway (without parent resolution) - validation will catch issues
        # The ContentValidator will fail startup if validation mode is :strict
        Logger.warning("Prototypes with broken parent refs: #{inspect(not_ready)}")
        {:ok, Enum.reverse(sorted) ++ not_ready}

      true ->
        new_visited = Enum.reduce(ready, visited, &MapSet.put(&2, &1))
        do_topological_sort(not_ready, raw, ready ++ sorted, new_visited)
    end
  end

  defp resolve_parent(%Prototype{parent: nil} = proto, _resolved) do
    proto
  end

  defp resolve_parent(%Prototype{parent: parent_key} = proto, resolved) do
    case Map.get(resolved, parent_key) do
      nil ->
        # Parent not found (should be caught during validation)
        proto

      parent ->
        Prototype.merge_parent(proto, parent)
    end
  end

  defp update_ets(table, resolved_prototypes) do
    # Get current keys before update
    current_keys = :ets.foldl(fn {key, _}, acc -> [key | acc] end, [], table) |> MapSet.new()
    new_keys = MapSet.new(Map.keys(resolved_prototypes))

    # Insert/update all new prototypes atomically (overwrites existing)
    Enum.each(resolved_prototypes, fn {key, proto} ->
      :ets.insert(table, {key, proto})
    end)

    # Remove orphaned entries (keys that no longer exist in new set)
    orphaned_keys = MapSet.difference(current_keys, new_keys)

    Enum.each(orphaned_keys, fn key ->
      :ets.delete(table, key)
    end)
  end

  defp do_validate_all(raw_prototypes, _resolved) do
    errors = []

    # Check for broken parent references
    broken_refs =
      raw_prototypes
      |> Enum.filter(fn {_key, proto} ->
        proto.parent != nil and not Map.has_key?(raw_prototypes, proto.parent)
      end)
      |> Enum.map(fn {key, proto} ->
        {:broken_parent_ref, key, proto.parent}
      end)

    errors ++ broken_refs
  end
end
