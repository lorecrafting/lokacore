defmodule Loka.Engine.TypedObject.Loader do
  @moduledoc """
  Unified loader for all TypedObject types.

  Replaces PrototypeLoader with support for all content types:
  - Entities (npcs, rooms, items, exits)
  - Content types (quests, dialogues, scripts, zones)

  ## Features

  - Loads from multiple YAML directories
  - Resolves parent inheritance chains
  - Caches in ETS for fast concurrent access
  - Supports hot reload

  ## Directory Structure

      priv/world/
      ├── prototypes/      # Entity prototypes
      │   ├── _base/       # Base prototypes (parents)
      │   ├── rooms/
      │   ├── items/
      │   └── npcs/
      ├── quests/          # Quest definitions
      ├── zones/           # Zone definitions
      ├── dialogues/       # Dialogue trees
      └── scripts/         # Elixir scripts

  Type is inferred from directory path (e.g., files in quests/ get type :quest).

  ## Usage

      # Get a TypedObject by key (with parent merged)
      {:ok, typed_object} = Loader.get("goblin_warrior")

      # List all NPCs
      npcs = Loader.list_by_type(:entity, :npc)

      # Hot-reload all content
      :ok = Loader.reload()
  """

  use GenServer
  require Logger

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  @default_paths [
    "priv/world/prototypes",
    "priv/world/quests",
    "priv/world/zones",
    "priv/world/dialogues",
    "priv/world/scripts"
  ]

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the TypedObject Loader GenServer.

  ## Options

  - `:path` - Path to prototype directory (default: "priv/world/prototypes")
  - `:name` - Process name (default: __MODULE__)
  - `:load_on_start` - Whether to load on start (default: true)
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a TypedObject by key, with parent inheritance resolved.
  """
  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    Registry.get(key)
  end

  @doc """
  Gets a TypedObject by key, raises if not found.
  """
  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    Registry.get!(key)
  end

  @doc """
  Lists all TypedObjects of a specific type.
  """
  @spec list_by_type(atom()) :: [TypedObject.t()]
  def list_by_type(type) when is_atom(type) do
    Registry.list_by_type(type)
  end

  @doc """
  Lists all TypedObjects of a specific type and subtype.
  """
  @spec list_by_type(atom(), atom() | nil) :: [TypedObject.t()]
  def list_by_type(type, subtype) when is_atom(type) do
    Registry.list_by_type(type, subtype)
  end

  @doc """
  Lists all TypedObjects with a specific tag.
  """
  @spec list_by_tag(String.t()) :: [TypedObject.t()]
  def list_by_tag(tag) when is_binary(tag) do
    Registry.list_by_tag(tag)
  end

  @doc """
  Returns all loaded TypedObjects.
  """
  @spec all() :: [TypedObject.t()]
  def all, do: Registry.all()

  @doc """
  Returns the count of loaded TypedObjects.
  """
  @spec count() :: non_neg_integer()
  def count, do: Registry.count()

  @doc """
  Reloads all TypedObjects from disk.
  """
  @spec reload() :: :ok | {:error, term()}
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Loads TypedObjects from a specific path.
  """
  @spec load_from(String.t()) :: :ok | {:error, term()}
  def load_from(path, server \\ __MODULE__) when is_binary(path) do
    GenServer.call(server, {:load_from, path})
  end

  @doc """
  Validates all loaded TypedObjects.
  """
  @spec validate_all() :: :ok | {:error, [term()]}
  def validate_all(server \\ __MODULE__) do
    GenServer.call(server, :validate_all)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    paths = Keyword.get(opts, :paths, @default_paths)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    # Initialize the registry
    Registry.init()

    state = %{
      paths: paths,
      raw_objects: %{},
      load_errors: []
    }

    if load_on_start do
      case do_load_all_paths(state, paths) do
        {:ok, new_state} ->
          Logger.info("TypedObject.Loader loaded #{Registry.count()} objects")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("TypedObject.Loader started with errors: #{inspect(errors)}")
          {:ok, %{state | load_errors: errors}}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all_paths(state, state.paths) do
      {:ok, new_state} ->
        Logger.info("TypedObject.Loader reloaded #{Registry.count()} objects")
        {:reply, :ok, new_state}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  @impl true
  def handle_call({:load_from, path}, _from, state) do
    case do_load_all_paths(state, [path]) do
      {:ok, new_state} ->
        {:reply, :ok, %{new_state | paths: [path]}}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  @impl true
  def handle_call(:validate_all, _from, state) do
    errors = do_validate_all(state.raw_objects)
    result = if Enum.empty?(errors), do: :ok, else: {:error, errors}
    {:reply, result, state}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all_paths(state, paths) do
    # Collect YAML files from all paths
    yaml_files =
      paths
      |> Enum.flat_map(fn path ->
        full_path = resolve_path(path)

        if File.exists?(full_path) do
          find_yaml_files(full_path)
        else
          Logger.debug("TypedObject.Loader: path #{full_path} does not exist, skipping")
          []
        end
      end)

    if Enum.empty?(yaml_files) do
      Logger.debug("TypedObject.Loader: no YAML files found in any path")
      {:ok, %{state | raw_objects: %{}, load_errors: []}}
    else
      # Parse all files into raw TypedObjects
      {raw_objects, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        # Resolve parent inheritance
        case resolve_all_parents(raw_objects) do
          {:ok, resolved} ->
            # Clear and update registry
            Registry.clear()
            Registry.put_all(resolved)

            {:ok, %{state | raw_objects: raw_objects, load_errors: []}}

          {:error, errors} ->
            {:error, errors}
        end
      end
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
    Enum.reduce(files, {%{}, []}, fn file, {objects, errors} ->
      case parse_yaml_file(file) do
        {:ok, typed_object} ->
          {Map.put(objects, typed_object.key, typed_object), errors}

        {:error, reason} ->
          {objects, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, typed_object} <- create_typed_object(data, file) do
      {:ok, typed_object}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp create_typed_object(data, file) do
    # Infer type from directory structure if not specified
    data = infer_type_from_path(data, file)

    TypedObject.new(data)
  end

  defp infer_type_from_path(data, file) do
    path_parts = Path.split(file) |> Enum.map(&String.downcase/1)

    # First, normalize key from id if needed
    data = normalize_key(data)

    # Check if type is already set to a valid TypedObject type
    current_type = Map.get(data, "type") || Map.get(data, :type)
    valid_types = ["entity", "quest", "dialogue", "script", "zone"]

    if current_type in valid_types do
      data
    else
      # Infer type from path - existing 'type' field may be quest_type, etc.
      cond do
        "npcs" in path_parts ->
          data |> Map.put("type", "entity") |> Map.put("subtype", "npc")

        "rooms" in path_parts ->
          data |> Map.put("type", "entity") |> Map.put("subtype", "room")

        "items" in path_parts ->
          data |> Map.put("type", "entity") |> Map.put("subtype", "item")

        "exits" in path_parts ->
          data |> Map.put("type", "entity") |> Map.put("subtype", "exit")

        "quests" in path_parts ->
          # For quests, move existing 'type' to 'quest_type' and set type to quest
          data
          |> maybe_move_type_to_quest_type()
          |> Map.put("type", "quest")

        "dialogues" in path_parts ->
          Map.put(data, "type", "dialogue")

        "scripts" in path_parts ->
          Map.put(data, "type", "script")

        "zones" in path_parts ->
          Map.put(data, "type", "zone")

        true ->
          # Default to entity if in _base or entities
          if "entities" in path_parts or "_base" in path_parts do
            Map.put(data, "type", "entity")
          else
            data
          end
      end
    end
  end

  # Normalize key from id field if key is not present
  defp normalize_key(data) do
    if Map.has_key?(data, "key") or Map.has_key?(data, :key) do
      data
    else
      # Use id as key if present
      id = Map.get(data, "id") || Map.get(data, :id)
      if id, do: Map.put(data, "key", id), else: data
    end
  end

  # Move quest's 'type' field to 'quest_type' since it contains main/side, not TypedObject type
  defp maybe_move_type_to_quest_type(data) do
    type_value = Map.get(data, "type") || Map.get(data, :type)

    if type_value && type_value not in ["quest", :quest] do
      data
      |> Map.put("quest_type", type_value)
      |> Map.delete("type")
      |> Map.delete(:type)
    else
      data
    end
  end

  defp resolve_all_parents(raw_objects) do
    case build_resolution_order(raw_objects) do
      {:ok, order} ->
        resolved =
          Enum.reduce(order, %{}, fn key, acc ->
            raw = Map.fetch!(raw_objects, key)
            resolved_obj = resolve_parent(raw, acc)
            Map.put(acc, key, resolved_obj)
          end)

        {:ok, resolved}

      {:error, errors} ->
        {:error, errors}
    end
  end

  defp build_resolution_order(raw_objects) do
    keys = Map.keys(raw_objects)

    case do_topological_sort(keys, raw_objects, [], MapSet.new()) do
      {:ok, order} -> {:ok, order}
      {:error, cycle} -> {:error, [{:cycle_detected, cycle}]}
    end
  end

  defp do_topological_sort([], _raw, sorted, _visited) do
    {:ok, Enum.reverse(sorted)}
  end

  defp do_topological_sort(remaining, raw, sorted, visited) do
    {ready, not_ready} =
      Enum.split_with(remaining, fn key ->
        obj = Map.get(raw, key)
        obj.parent_key == nil or MapSet.member?(visited, obj.parent_key)
      end)

    cond do
      Enum.empty?(ready) and Enum.empty?(not_ready) ->
        {:ok, Enum.reverse(sorted)}

      Enum.empty?(ready) ->
        # Remaining have broken or cyclic refs - load anyway
        Logger.warning("TypedObjects with broken parent refs: #{inspect(not_ready)}")
        {:ok, Enum.reverse(sorted) ++ not_ready}

      true ->
        new_visited = Enum.reduce(ready, visited, &MapSet.put(&2, &1))
        do_topological_sort(not_ready, raw, ready ++ sorted, new_visited)
    end
  end

  defp resolve_parent(%TypedObject{parent_key: nil} = obj, _resolved), do: obj

  defp resolve_parent(%TypedObject{parent_key: parent_key} = obj, resolved) do
    case Map.get(resolved, parent_key) do
      nil -> obj
      parent -> TypedObject.merge_parent(obj, parent)
    end
  end

  defp do_validate_all(raw_objects) do
    errors = []

    # Check for broken parent references
    broken_refs =
      raw_objects
      |> Enum.filter(fn {_key, obj} ->
        obj.parent_key != nil and not Map.has_key?(raw_objects, obj.parent_key)
      end)
      |> Enum.map(fn {key, obj} ->
        {:broken_parent_ref, key, obj.parent_key}
      end)

    errors ++ broken_refs
  end
end
