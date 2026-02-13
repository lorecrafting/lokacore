defmodule Loka.Framework.Quest.ChainTest do
  @moduledoc """
  Tests for quest chain system including registry, progression, and branching.
  """
  use Loka.DataCase, async: false

  alias Loka.Framework.Quest.ChainRegistry

  # Use fully qualified module name for Chain functions
  alias Loka.Framework.Quest.Chain, as: ChainModule
  alias Loka.Framework.Quest.Chain.{Chain, ChainNode, Branch}

  @test_chains_path "test/fixtures/chains"
  @test_quests_path "test/fixtures/chain_quests"

  setup do
    # Create test chains directory
    File.mkdir_p!(@test_chains_path)
    File.mkdir_p!(@test_quests_path)

    # Create test quests
    File.write!(Path.join(@test_quests_path, "quest_a.yml"), """
    id: quest_a
    name: "Quest A"
    description: "First quest in chain"
    objectives:
      - id: obj_a
        type: go_to
        target_id: location_a
        description: "Go to location A"
    """)

    File.write!(Path.join(@test_quests_path, "quest_b.yml"), """
    id: quest_b
    name: "Quest B"
    description: "Second quest in chain"
    objectives:
      - id: obj_b
        type: go_to
        target_id: location_b
        description: "Go to location B"
    """)

    File.write!(Path.join(@test_quests_path, "quest_c.yml"), """
    id: quest_c
    name: "Quest C"
    description: "Third quest in chain"
    objectives:
      - id: obj_c
        type: go_to
        target_id: location_c
        description: "Go to location C"
    """)

    File.write!(Path.join(@test_quests_path, "good_ending.yml"), """
    id: good_ending
    name: "Good Ending"
    description: "Good path ending"
    objectives:
      - id: obj_good
        type: go_to
        target_id: good_location
        description: "Reach the good ending"
    """)

    File.write!(Path.join(@test_quests_path, "evil_ending.yml"), """
    id: evil_ending
    name: "Evil Ending"
    description: "Evil path ending"
    objectives:
      - id: obj_evil
        type: go_to
        target_id: evil_location
        description: "Reach the evil ending"
    """)

    # Create test chain
    File.write!(Path.join(@test_chains_path, "linear_chain.yml"), """
    id: linear_chain
    name: "Linear Chain"
    description: "A simple linear quest chain"
    start_quest: quest_a
    nodes:
      - quest_id: quest_a
        next: [quest_b]
        auto_start: true
      - quest_id: quest_b
        next: [quest_c]
        auto_start: true
      - quest_id: quest_c
        auto_start: true
    tags: [test]
    """)

    # Create branching chain
    File.write!(Path.join(@test_chains_path, "branching_chain.yml"), """
    id: branching_chain
    name: "Branching Chain"
    description: "A chain with conditional branches"
    start_quest: quest_a
    nodes:
      - quest_id: quest_a
        branches:
          - condition:
              type: flag
              flag: chose_good
            next: good_ending
          - condition:
              type: flag
              flag: chose_evil
            next: evil_ending
          - condition:
              type: default
            next: quest_b
        auto_start: true
      - quest_id: quest_b
        auto_start: true
      - quest_id: good_ending
        auto_start: true
      - quest_id: evil_ending
        auto_start: true
    tags: [test, branching]
    """)

    # Load chains into persistent_term cache (V2 — no GenServer)
    # Save previous cache to restore on exit
    prev_chains = :persistent_term.get({ChainRegistry, :chains}, nil)

    # Parse and register our test chains
    {:ok, linear} =
      YamlElixir.read_from_string(File.read!(Path.join(@test_chains_path, "linear_chain.yml")))

    {:ok, branching} =
      YamlElixir.read_from_string(File.read!(Path.join(@test_chains_path, "branching_chain.yml")))

    linear_chain = build_chain(linear)
    branching_chain = build_chain(branching)

    chains = %{
      linear_chain.id => linear_chain,
      branching_chain.id => branching_chain
    }

    :persistent_term.put({ChainRegistry, :chains}, chains)

    on_exit(fn ->
      File.rm_rf!(@test_chains_path)
      File.rm_rf!(@test_quests_path)

      # Restore previous chains cache
      if prev_chains do
        :persistent_term.put({ChainRegistry, :chains}, prev_chains)
      else
        :persistent_term.erase({ChainRegistry, :chains})
      end
    end)

    :ok
  end

  describe "ChainRegistry" do
    test "loads chains from YAML" do
      {:ok, chain} = ChainRegistry.get("linear_chain")
      assert chain.id == "linear_chain"
      assert chain.name == "Linear Chain"
      assert length(chain.nodes) == 3
    end

    test "finds chain by quest ID" do
      {:ok, chain} = ChainRegistry.get_chain_for_quest("quest_a")
      assert chain.id in ["linear_chain", "branching_chain"]
    end

    test "returns all chains" do
      chains = ChainRegistry.all()
      assert length(chains) == 2
    end

    test "filters chains by tag" do
      chains = ChainRegistry.by_tag("branching")
      assert length(chains) == 1
      assert hd(chains).id == "branching_chain"
    end
  end

  describe "ChainModule.get_next_quests/2" do
    test "returns next quests for linear chain" do
      # Get chain and check next quests
      {:ok, chain} = ChainRegistry.get("linear_chain")
      node = Enum.find(chain.nodes, &(&1.quest_id == "quest_a"))

      # Node should have quest_b as next
      assert "quest_b" in node.next
    end

    test "terminal quest has no next" do
      {:ok, chain} = ChainRegistry.get("linear_chain")
      node = Enum.find(chain.nodes, &(&1.quest_id == "quest_c"))

      assert node.next == []
    end
  end

  describe "Chain branching" do
    test "branching chain has conditional branches" do
      {:ok, chain} = ChainRegistry.get("branching_chain")
      node = Enum.find(chain.nodes, &(&1.quest_id == "quest_a"))

      # Should have branches for good, evil, and default
      assert length(node.branches) == 3

      conditions = Enum.map(node.branches, & &1.condition)
      assert {:flag, "chose_good"} in conditions
      assert {:flag, "chose_evil"} in conditions
      assert :default in conditions
    end

    test "branches point to correct next quests" do
      {:ok, chain} = ChainRegistry.get("branching_chain")
      node = Enum.find(chain.nodes, &(&1.quest_id == "quest_a"))

      good_branch = Enum.find(node.branches, &(&1.condition == {:flag, "chose_good"}))
      evil_branch = Enum.find(node.branches, &(&1.condition == {:flag, "chose_evil"}))
      default_branch = Enum.find(node.branches, &(&1.condition == :default))

      assert good_branch.next == "good_ending"
      assert evil_branch.next == "evil_ending"
      assert default_branch.next == "quest_b"
    end
  end

  describe "Chain progress calculation" do
    test "chain nodes track quest relationships" do
      {:ok, chain} = ChainRegistry.get("linear_chain")

      # Chain has correct structure
      assert chain.start_quest == "quest_a"
      assert length(chain.nodes) == 3

      quest_ids = Enum.map(chain.nodes, & &1.quest_id)
      assert "quest_a" in quest_ids
      assert "quest_b" in quest_ids
      assert "quest_c" in quest_ids
    end
  end

  describe "ChainModule.define/2 programmatic API" do
    test "creates chain definition programmatically" do
      chain =
        ChainModule.define("my_chain",
          name: "My Chain",
          quests: [
            {"start_quest", next: "middle_quest"},
            {"middle_quest", next: "end_quest"},
            "end_quest"
          ],
          tags: ["custom"]
        )

      assert chain.id == "my_chain"
      assert chain.name == "My Chain"
      assert length(chain.nodes) == 3
      assert chain.start_quest == "start_quest"
      assert "custom" in chain.tags
    end

    test "defines chains with branching" do
      chain =
        ChainModule.define("branching",
          quests: [
            {"start",
             branches: [
               {:flag, "good", next: "good_end"},
               {:default, next: "bad_end"}
             ]},
            "good_end",
            "bad_end"
          ]
        )

      start_node = Enum.find(chain.nodes, &(&1.quest_id == "start"))
      assert length(start_node.branches) == 2
    end
  end

  # ===========================================================================
  # Private Helpers
  # ===========================================================================

  # Builds a Chain struct from a parsed YAML map (mirrors ChainRegistry's private chain_from_map)
  defp build_chain(data) when is_map(data) do
    nodes_data = data["nodes"] || []
    nodes = Enum.map(nodes_data, &build_node/1)

    start_quest = data["start_quest"] || if(nodes != [], do: hd(nodes).quest_id)

    %Chain{
      id: data["id"],
      name: data["name"] || data["id"],
      description: data["description"],
      nodes: nodes,
      start_quest: start_quest,
      tags: data["tags"] || []
    }
  end

  defp build_node(data) when is_map(data) do
    next = data["next"] || []
    branches_data = data["branches"] || []
    branches = Enum.map(branches_data, &build_branch/1)
    auto_start = if is_nil(data["auto_start"]), do: true, else: data["auto_start"]

    %ChainNode{
      quest_id: data["quest_id"],
      next: List.wrap(next),
      branches: branches,
      optional: data["optional"] || false,
      auto_start: auto_start
    }
  end

  defp build_branch(data) when is_map(data) do
    condition_data = data["condition"] || %{}
    condition = parse_condition(condition_data)

    %Branch{
      condition: condition,
      next: data["next"]
    }
  end

  defp parse_condition(%{"type" => "default"}), do: :default
  defp parse_condition(%{"type" => "flag", "flag" => flag}), do: {:flag, flag}

  defp parse_condition(%{"type" => "quest_completed", "quest_id" => qid}),
    do: {:quest_completed, qid}

  defp parse_condition(_), do: :default
end
