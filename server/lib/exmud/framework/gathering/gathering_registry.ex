defmodule Exmud.Framework.Gathering.GatheringRegistry do
  @moduledoc """
  Loads and stores gathering node definitions from YAML files.

  Nodes are stored as YAML files in `priv/world/nodes/`. This registry:
  - Reads all YAML files from the nodes directory
  - Parses each node definition
  - Stores nodes in ETS for fast concurrent lookup

  ## Directory Structure

      priv/world/nodes/
      ├── herbalism/       # Plants, mushrooms, flowers
      ├── mining/          # Ore veins, gems
      ├── fishing/         # Fish spots
      └── foraging/        # Wild food, materials

  ## YAML Format

      key: herb_patch
      name: "Herb Patch"
      skill_required: herbalism
      skill_level: 1
      yields:
        - item: herb_healing
          chance: 0.6
          quantity: [1, 3]
        - item: herb_rare
          chance: 0.1
          quantity: 1
      respawn_time: 300
      uses_per_respawn: 3
      tool_required: gathering_knife
      xp_reward:
        skill: herbalism
        amount: 5
      gather_message: "You carefully harvest from the herb patch."
      success_message: "You find some useful herbs!"
      failure_message: "You find nothing of value."
      exhausted_message: "The herb patch has been picked clean."

  ## Usage

      alias Exmud.Framework.Gathering.GatheringRegistry

      {:ok, node} = GatheringRegistry.get("herb_patch")
      nodes = GatheringRegistry.all()
      :ok = GatheringRegistry.reload()
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Gathering.GatheringNode

  @node_table :exmud_gathering_nodes
  @default_path "priv/world/nodes"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the GatheringRegistry GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a node by key.

  Returns `{:ok, node}` or `{:error, :not_found}`.
  """
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc """
  Gets a node by key, raises if not found.
  """
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, node} -> node
      {:error, :not_found} -> raise "Gathering node not found: #{key}"
    end
  end

  @doc """
  Lists all nodes requiring a specific skill.
  """
  def by_skill(skill, server \\ __MODULE__) when is_binary(skill) do
    GenServer.call(server, {:by_skill, skill})
  end

  @doc """
  Lists all nodes with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc """
  Returns all loaded nodes.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns the count of loaded nodes.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Checks if a node exists.
  """
  def exists?(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  @doc """
  Reloads all nodes from disk.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Loads nodes from a specific path (useful for testing).
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

    table = :ets.new(@node_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      nodes: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("GatheringRegistry loaded #{map_size(new_state.nodes)} nodes")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("GatheringRegistry started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.nodes, key) do
        nil -> {:error, :not_found}
        node -> {:ok, node}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:by_skill, skill}, _from, state) do
    nodes =
      state.nodes
      |> Map.values()
      |> Enum.filter(&(&1.skill_required == skill))

    {:reply, nodes, state}
  end

  @impl true
  def handle_call({:by_tag, tag}, _from, state) do
    nodes =
      state.nodes
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, nodes, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.nodes), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.nodes), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("GatheringRegistry reloaded #{map_size(new_state.nodes)} nodes")
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

  @impl true
  def handle_call({:register_test_node, node}, _from, state) do
    new_nodes = Map.put(state.nodes, node.key, node)
    update_ets(state.table, new_nodes)
    {:reply, :ok, %{state | nodes: new_nodes}}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      yaml_files = find_yaml_files(full_path)
      {nodes, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        update_ets(state.table, nodes)
        {:ok, %{state | nodes: nodes}}
      end
    else
      Logger.debug("GatheringRegistry: path #{full_path} does not exist, starting empty")
      {:ok, %{state | nodes: %{}}}
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
    Enum.reduce(files, {%{}, []}, fn file, {nodes, errors} ->
      case parse_yaml_file(file) do
        {:ok, node} ->
          {Map.put(nodes, node.key, node), errors}

        {:error, reason} ->
          {nodes, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, node} <- GatheringNode.from_map(data) do
      {:ok, node}
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp update_ets(table, nodes) do
    :ets.delete_all_objects(table)

    Enum.each(nodes, fn {key, node} ->
      :ets.insert(table, {key, node})
    end)
  end
end
