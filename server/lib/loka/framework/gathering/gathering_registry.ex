defmodule Loka.Framework.Gathering.GatheringRegistry do
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

      alias Loka.Framework.Gathering.GatheringRegistry

      {:ok, node} = GatheringRegistry.get("herb_patch")
      nodes = GatheringRegistry.all()
      :ok = GatheringRegistry.reload()
  """

  alias Loka.Engine.Constants.WorldPaths

  use Loka.Framework.RegistryBase,
    table: :loka_gathering_nodes,
    path: WorldPaths.gathering_nodes_dir(),
    item_module: Loka.Framework.Gathering.GatheringNode,
    item_name: "gathering node",
    state_key: :nodes,
    content_types: [{:gathering_node, nil}]

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

  # Custom call handlers

  @doc false
  def handle_custom_call({:by_skill, skill}, _from, state) do
    nodes =
      state.nodes
      |> Map.values()
      |> Enum.filter(&(&1.skill_required == skill))

    {:reply, nodes, state}
  end

  def handle_custom_call({:by_tag, tag}, _from, state) do
    nodes =
      state.nodes
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, nodes, state}
  end

  # Test helper - allows registering test nodes
  def handle_custom_call({:register_test_node, node}, _from, state) do
    new_nodes = Map.put(state.nodes, node.key, node)

    :ets.delete_all_objects(state.table)
    Enum.each(new_nodes, fn {key, n} -> :ets.insert(state.table, {key, n}) end)

    {:reply, :ok, %{state | nodes: new_nodes}}
  end
end
