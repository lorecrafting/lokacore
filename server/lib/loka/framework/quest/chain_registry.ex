defmodule Loka.Framework.Quest.ChainRegistry do
  @moduledoc """
  Registry for quest chain definitions.

  In V2 this is a simple module that loads chains from YAML on demand
  (no GenServer needed). Results are cached in a persistent term for fast lookup.
  """

  require Logger

  alias Loka.Engine.Constants.WorldPaths
  alias Loka.Framework.Quest.Chain.{Chain, ChainNode, Branch}

  @default_path WorldPaths.quest_chains_dir()

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Gets a chain by ID.
  """
  def get(chain_id, _server \\ nil) when is_binary(chain_id) do
    chains = load_chains()

    case Map.get(chains, chain_id) do
      nil -> {:error, :not_found}
      chain -> {:ok, chain}
    end
  end

  @doc """
  Returns all loaded chains.
  """
  def all(_server \\ nil) do
    load_chains() |> Map.values()
  end

  @doc """
  Gets the chain that contains a specific quest.
  """
  def get_chain_for_quest(quest_id, _server \\ nil) when is_binary(quest_id) do
    chains = load_chains()

    result =
      Enum.find_value(chains, fn {_id, chain} ->
        if Enum.any?(chain.nodes, &(&1.quest_id == quest_id)) do
          chain
        end
      end)

    case result do
      nil -> {:error, :not_found}
      chain -> {:ok, chain}
    end
  end

  @doc """
  Registers a programmatically-defined chain (stores in persistent term cache).
  """
  def register(%Chain{} = chain, _server \\ nil) do
    chains = load_chains()
    updated = Map.put(chains, chain.id, chain)
    :persistent_term.put({__MODULE__, :chains}, updated)
    :ok
  end

  @doc """
  Returns chains with a specific tag.
  """
  def by_tag(tag, _server \\ nil) when is_binary(tag) do
    all() |> Enum.filter(&(tag in &1.tags))
  end

  @doc """
  Returns the count of loaded chains.
  """
  def count(_server \\ nil), do: load_chains() |> map_size()

  @doc """
  Reloads all chains from disk (clears cache).
  """
  def reload(_server \\ nil) do
    :persistent_term.erase({__MODULE__, :chains})
    load_chains()
    :ok
  end

  # No-op for backwards compat
  def start_link(_opts \\ []), do: :ignore

  # =============================================================================
  # Loading
  # =============================================================================

  defp load_chains do
    case :persistent_term.get({__MODULE__, :chains}, nil) do
      nil ->
        chains = do_load_all(@default_path)
        :persistent_term.put({__MODULE__, :chains}, chains)
        chains

      chains ->
        chains
    end
  end

  defp do_load_all(path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      yaml_files = Path.wildcard(Path.join([full_path, "**", "*.{yml,yaml}"]))
      {chains, _errors} = parse_yaml_files(yaml_files)
      count = map_size(chains)

      if count > 0 do
        Logger.info("#{__MODULE__} loaded #{count} chains")
      end

      chains
    else
      %{}
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
          if(nodes != [], do: hd(nodes).quest_id)

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

  defp parse_condition(%{"type" => "quest_completed", "quest_id" => quest_id}),
    do: {:quest_completed, quest_id}

  defp parse_condition(%{type: "quest_completed", quest_id: quest_id}),
    do: {:quest_completed, quest_id}

  defp parse_condition(%{"type" => "level_gte", "level" => level}), do: {:level_gte, level}
  defp parse_condition(%{type: "level_gte", level: level}), do: {:level_gte, level}

  defp parse_condition(%{"type" => "item_has", "item_id" => item_id}), do: {:item_has, item_id}
  defp parse_condition(%{type: "item_has", item_id: item_id}), do: {:item_has, item_id}
  defp parse_condition(_), do: :default
end
