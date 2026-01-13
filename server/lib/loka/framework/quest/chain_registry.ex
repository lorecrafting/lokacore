defmodule Loka.Framework.Quest.ChainRegistry do
  @moduledoc """
  Registry for quest chain definitions.

  Loads chains from YAML files and stores programmatically-defined chains.
  Provides lookup by chain ID or by quest ID.

  ## YAML Format

      # priv/world/quests/_chains/main_story.yml
      id: main_story_chain
      name: "The Main Story"
      description: |
        The epic journey through the monastery.
      start_quest: intro_quest
      nodes:
        - quest_id: intro_quest
          next: [choice_quest]
          auto_start: true
        - quest_id: choice_quest
          branches:
            - condition:
                type: flag
                flag: chose_good
              next: good_path_quest
            - condition:
                type: flag
                flag: chose_evil
              next: evil_path_quest
            - condition:
                type: default
              next: neutral_path_quest
        - quest_id: good_path_quest
        - quest_id: evil_path_quest
        - quest_id: neutral_path_quest
      tags: [main, story]
  """

  use GenServer
  require Logger

  alias Loka.Framework.Quest.Chain.{Chain, ChainNode, Branch}

  @table :loka_quest_chains
  @default_path "priv/world/quests/_chains"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the chain registry.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a chain by ID.

  Returns `{:ok, chain}` or `{:error, :not_found}`.
  """
  def get(chain_id, server \\ __MODULE__) when is_binary(chain_id) do
    GenServer.call(server, {:get, chain_id})
  end

  @doc """
  Returns all loaded chains.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Gets the chain that contains a specific quest.

  Returns `{:ok, chain}` or `{:error, :not_found}`.
  """
  def get_chain_for_quest(quest_id, server \\ __MODULE__) when is_binary(quest_id) do
    GenServer.call(server, {:get_chain_for_quest, quest_id})
  end

  @doc """
  Registers a programmatically-defined chain.
  """
  def register(%Chain{} = chain, server \\ __MODULE__) do
    GenServer.call(server, {:register, chain})
  end

  @doc """
  Unregisters a chain by ID.
  """
  def unregister(chain_id, server \\ __MODULE__) when is_binary(chain_id) do
    GenServer.call(server, {:unregister, chain_id})
  end

  @doc """
  Returns chains with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc """
  Returns the count of loaded chains.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Reloads all chains from disk.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(@table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      chains: %{},
      quest_to_chain: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          count = map_size(new_state.chains)
          Logger.info("#{__MODULE__} loaded #{count} chains")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("#{__MODULE__} started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      Logger.info("#{__MODULE__} started (load_on_start: false)")
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, chain_id}, _from, state) do
    result =
      case Map.get(state.chains, chain_id) do
        nil -> {:error, :not_found}
        chain -> {:ok, chain}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.chains), state}
  end

  @impl true
  def handle_call({:get_chain_for_quest, quest_id}, _from, state) do
    result =
      case Map.get(state.quest_to_chain, quest_id) do
        nil ->
          {:error, :not_found}

        chain_id ->
          case Map.get(state.chains, chain_id) do
            nil -> {:error, :not_found}
            chain -> {:ok, chain}
          end
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:register, chain}, _from, state) do
    new_chains = Map.put(state.chains, chain.id, chain)

    # Update quest-to-chain index
    new_quest_to_chain =
      Enum.reduce(chain.nodes, state.quest_to_chain, fn node, acc ->
        Map.put(acc, node.quest_id, chain.id)
      end)

    :ets.insert(state.table, {chain.id, chain})

    Logger.debug("[ChainRegistry] Registered chain: #{chain.id}")

    {:reply, :ok, %{state | chains: new_chains, quest_to_chain: new_quest_to_chain}}
  end

  @impl true
  def handle_call({:unregister, chain_id}, _from, state) do
    case Map.get(state.chains, chain_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      chain ->
        new_chains = Map.delete(state.chains, chain_id)

        # Remove from quest-to-chain index
        quest_ids = Enum.map(chain.nodes, & &1.quest_id)

        new_quest_to_chain =
          Enum.reduce(quest_ids, state.quest_to_chain, fn quest_id, acc ->
            Map.delete(acc, quest_id)
          end)

        :ets.delete(state.table, chain_id)

        {:reply, :ok, %{state | chains: new_chains, quest_to_chain: new_quest_to_chain}}
    end
  end

  @impl true
  def handle_call({:by_tag, tag}, _from, state) do
    chains =
      state.chains
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, chains, state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.chains), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        count = map_size(new_state.chains)
        Logger.info("#{__MODULE__} reloaded #{count} chains")
        {:reply, :ok, new_state}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  # =============================================================================
  # Private - Loading
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      yaml_files = Path.wildcard(Path.join([full_path, "**", "*.{yml,yaml}"]))
      {chains, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        # Build quest-to-chain index
        quest_to_chain =
          Enum.reduce(chains, %{}, fn {_id, chain}, acc ->
            Enum.reduce(chain.nodes, acc, fn node, inner_acc ->
              Map.put(inner_acc, node.quest_id, chain.id)
            end)
          end)

        update_ets(state.table, chains)
        {:ok, %{state | chains: chains, quest_to_chain: quest_to_chain}}
      end
    else
      Logger.debug("#{__MODULE__}: path #{full_path} does not exist, starting empty")
      {:ok, %{state | chains: %{}, quest_to_chain: %{}}}
    end
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  defp parse_yaml_files(files) do
    Enum.reduce(files, {%{}, []}, fn file, {chains, errors} ->
      case parse_yaml_file(file) do
        {:ok, chain} ->
          {Map.put(chains, chain.id, chain), errors}

        {:error, reason} ->
          {chains, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, chain} <- chain_from_map(data) do
      {:ok, chain}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp chain_from_map(data) when is_map(data) do
    id = data["id"] || data[:id]

    if is_nil(id) do
      {:error, :missing_id}
    else
      nodes_data = data["nodes"] || data[:nodes] || []
      nodes = Enum.map(nodes_data, &node_from_map/1)

      start_quest =
        data["start_quest"] || data[:start_quest] ||
          if(length(nodes) > 0, do: hd(nodes).quest_id)

      chain = %Chain{
        id: id,
        name: data["name"] || data[:name] || id,
        description: data["description"] || data[:description],
        nodes: nodes,
        start_quest: start_quest,
        tags: data["tags"] || data[:tags] || []
      }

      {:ok, chain}
    end
  end

  defp chain_from_map(_), do: {:error, :invalid_data}

  defp node_from_map(data) when is_map(data) do
    quest_id = data["quest_id"] || data[:quest_id]
    next = data["next"] || data[:next] || []
    branches_data = data["branches"] || data[:branches] || []
    branches = Enum.map(branches_data, &branch_from_map/1)
    optional = data["optional"] || data[:optional] || false
    auto_start = data["auto_start"] || data[:auto_start]
    auto_start = if is_nil(auto_start), do: true, else: auto_start

    %ChainNode{
      quest_id: quest_id,
      next: List.wrap(next),
      branches: branches,
      optional: optional,
      auto_start: auto_start
    }
  end

  defp node_from_map(_), do: %ChainNode{}

  defp branch_from_map(data) when is_map(data) do
    condition_data = data["condition"] || data[:condition] || %{}
    condition = parse_condition(condition_data)
    next = data["next"] || data[:next]

    %Branch{
      condition: condition,
      next: next
    }
  end

  defp branch_from_map(_), do: %Branch{condition: :default}

  defp parse_condition(%{"type" => "default"}), do: :default
  defp parse_condition(%{type: "default"}), do: :default
  defp parse_condition(%{"type" => "default", "flag" => _}), do: :default

  defp parse_condition(%{"type" => "flag", "flag" => flag}), do: {:flag, flag}
  defp parse_condition(%{type: "flag", flag: flag}), do: {:flag, flag}

  defp parse_condition(%{"type" => "quest_completed", "quest_id" => quest_id}) do
    {:quest_completed, quest_id}
  end

  defp parse_condition(%{type: "quest_completed", quest_id: quest_id}) do
    {:quest_completed, quest_id}
  end

  defp parse_condition(%{"type" => "level_gte", "level" => level}) do
    {:level_gte, level}
  end

  defp parse_condition(%{type: "level_gte", level: level}) do
    {:level_gte, level}
  end

  defp parse_condition(%{"type" => "item_has", "item_id" => item_id}) do
    {:item_has, item_id}
  end

  defp parse_condition(%{type: "item_has", item_id: item_id}) do
    {:item_has, item_id}
  end

  defp parse_condition(_), do: :default

  defp update_ets(table, chains) do
    :ets.delete_all_objects(table)

    Enum.each(chains, fn {id, chain} ->
      :ets.insert(table, {id, chain})
    end)
  end
end
