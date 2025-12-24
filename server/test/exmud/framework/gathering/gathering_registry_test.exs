defmodule Exmud.Framework.Gathering.GatheringRegistryTest do
  use ExUnit.Case, async: false

  alias Exmud.Framework.Gathering.GatheringRegistry
  alias Exmud.Framework.Gathering.GatheringNode

  @test_nodes_dir "test/fixtures/gathering_nodes"

  setup do
    # Create a unique registry for each test
    registry_name = :"registry_#{:erlang.unique_integer([:positive])}"

    # Clean up any existing test directory
    if File.exists?(@test_nodes_dir) do
      File.rm_rf!(@test_nodes_dir)
    end

    on_exit(fn ->
      # Clean up test directory
      if File.exists?(@test_nodes_dir) do
        File.rm_rf!(@test_nodes_dir)
      end
    end)

    {:ok, registry: registry_name}
  end

  describe "start_link/1" do
    test "starts registry with default options" do
      assert {:ok, pid} =
               GatheringRegistry.start_link(name: :test_registry_1, load_on_start: false)

      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "starts registry and loads nodes from path", %{registry: name} do
      create_test_node_file("herb_patch.yml", """
      key: herb_patch
      name: "Herb Patch"
      skill_required: herbalism
      skill_level: 1
      yields:
        - item: herb_healing
          chance: 0.6
          quantity: [1, 3]
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      assert Process.alive?(pid)
      assert {:ok, _node} = GatheringRegistry.get("herb_patch", name)

      GenServer.stop(pid)
    end

    test "starts empty when path doesn't exist", %{registry: name} do
      {:ok, pid} =
        GatheringRegistry.start_link(
          name: name,
          path: "nonexistent/path",
          load_on_start: true
        )

      assert Process.alive?(pid)
      assert GatheringRegistry.count(name) == 0

      GenServer.stop(pid)
    end

    test "starts without loading on start", %{registry: name} do
      create_test_node_file("herb_patch.yml", """
      key: herb_patch
      name: "Herb Patch"
      """)

      {:ok, pid} =
        GatheringRegistry.start_link(
          name: name,
          path: @test_nodes_dir,
          load_on_start: false
        )

      assert Process.alive?(pid)
      assert GatheringRegistry.count(name) == 0

      GenServer.stop(pid)
    end
  end

  describe "get/2" do
    test "returns node when it exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      assert {:ok, node} = GatheringRegistry.get("herb_patch", name)
      assert node.key == "herb_patch"
      assert node.name == "Herb Patch"
      assert node.skill_required == "herbalism"

      GenServer.stop(pid)
    end

    test "returns error when node not found", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      assert {:error, :not_found} = GatheringRegistry.get("nonexistent", name)

      GenServer.stop(pid)
    end

    test "retrieved node has correct structure", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      {:ok, node} = GatheringRegistry.get("ore_vein", name)
      assert %GatheringNode{} = node
      assert node.key == "ore_vein"
      assert node.name == "Iron Ore Vein"
      assert node.skill_required == "mining"
      assert node.skill_level == 5

      GenServer.stop(pid)
    end
  end

  describe "get!/2" do
    test "returns node when it exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      node = GatheringRegistry.get!("herb_patch", name)
      assert node.key == "herb_patch"

      GenServer.stop(pid)
    end

    test "raises when node not found", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      assert_raise RuntimeError, "Gathering node not found: nonexistent", fn ->
        GatheringRegistry.get!("nonexistent", name)
      end

      GenServer.stop(pid)
    end
  end

  describe "by_skill/2" do
    test "returns nodes requiring specified skill", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      herbalism_nodes = GatheringRegistry.by_skill("herbalism", name)

      assert length(herbalism_nodes) == 1
      assert hd(herbalism_nodes).key == "herb_patch"
      assert hd(herbalism_nodes).skill_required == "herbalism"

      GenServer.stop(pid)
    end

    test "returns empty list when no nodes require skill", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      nodes = GatheringRegistry.by_skill("unknown_skill", name)

      assert nodes == []

      GenServer.stop(pid)
    end

    test "returns multiple nodes with same skill requirement", %{registry: name} do
      create_test_node_file("copper_vein.yml", """
      key: copper_vein
      name: "Copper Vein"
      skill_required: mining
      skill_level: 1
      """)

      create_test_node_file("iron_vein.yml", """
      key: iron_vein
      name: "Iron Vein"
      skill_required: mining
      skill_level: 10
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      mining_nodes = GatheringRegistry.by_skill("mining", name)

      assert length(mining_nodes) == 2
      node_keys = Enum.map(mining_nodes, & &1.key) |> Enum.sort()
      assert node_keys == ["copper_vein", "iron_vein"]

      GenServer.stop(pid)
    end
  end

  describe "by_tag/2" do
    test "returns nodes with specified tag", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      plant_nodes = GatheringRegistry.by_tag("plant", name)

      assert length(plant_nodes) == 1
      assert hd(plant_nodes).key == "herb_patch"

      GenServer.stop(pid)
    end

    test "returns empty list when no nodes have tag", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      nodes = GatheringRegistry.by_tag("nonexistent_tag", name)

      assert nodes == []

      GenServer.stop(pid)
    end

    test "returns multiple nodes with same tag", %{registry: name} do
      create_test_node_file("oak_tree.yml", """
      key: oak_tree
      name: "Oak Tree"
      skill_required: logging
      tags:
        - tree
        - wood
      """)

      create_test_node_file("pine_tree.yml", """
      key: pine_tree
      name: "Pine Tree"
      skill_required: logging
      tags:
        - tree
        - wood
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      tree_nodes = GatheringRegistry.by_tag("tree", name)

      assert length(tree_nodes) == 2
      node_keys = Enum.map(tree_nodes, & &1.key) |> Enum.sort()
      assert node_keys == ["oak_tree", "pine_tree"]

      GenServer.stop(pid)
    end
  end

  describe "all/1" do
    test "returns all registered nodes", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      all_nodes = GatheringRegistry.all(name)

      assert length(all_nodes) == 3
      node_keys = Enum.map(all_nodes, & &1.key) |> Enum.sort()
      assert node_keys == ["fish_spot", "herb_patch", "ore_vein"]

      GenServer.stop(pid)
    end

    test "returns empty list when no nodes registered", %{registry: name} do
      {:ok, pid} = GatheringRegistry.start_link(name: name, load_on_start: false)

      assert GatheringRegistry.all(name) == []

      GenServer.stop(pid)
    end
  end

  describe "count/1" do
    test "returns number of registered nodes", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      assert GatheringRegistry.count(name) == 3

      GenServer.stop(pid)
    end

    test "returns 0 when no nodes registered", %{registry: name} do
      {:ok, pid} = GatheringRegistry.start_link(name: name, load_on_start: false)

      assert GatheringRegistry.count(name) == 0

      GenServer.stop(pid)
    end
  end

  describe "exists?/2" do
    test "returns true for existing node", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      assert GatheringRegistry.exists?("herb_patch", name) == true

      GenServer.stop(pid)
    end

    test "returns false for non-existent node", %{registry: name} do
      {:ok, pid} = start_registry_with_test_nodes(name)

      assert GatheringRegistry.exists?("nonexistent", name) == false

      GenServer.stop(pid)
    end
  end

  describe "reload/1" do
    test "reloads nodes from disk", %{registry: name} do
      create_test_node_file("node1.yml", """
      key: node1
      name: "Node 1"
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      assert GatheringRegistry.count(name) == 1

      # Add another node file
      create_test_node_file("node2.yml", """
      key: node2
      name: "Node 2"
      """)

      # Reload
      assert :ok = GatheringRegistry.reload(name)

      assert GatheringRegistry.count(name) == 2
      assert {:ok, _} = GatheringRegistry.get("node2", name)

      GenServer.stop(pid)
    end

    test "replaces existing nodes on reload", %{registry: name} do
      create_test_node_file("node1.yml", """
      key: node1
      name: "Original Name"
      skill_required: herbalism
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      {:ok, original} = GatheringRegistry.get("node1", name)
      assert original.name == "Original Name"

      # Update the file
      create_test_node_file("node1.yml", """
      key: node1
      name: "Updated Name"
      skill_required: mining
      """)

      assert :ok = GatheringRegistry.reload(name)

      {:ok, updated} = GatheringRegistry.get("node1", name)
      assert updated.name == "Updated Name"
      assert updated.skill_required == "mining"

      GenServer.stop(pid)
    end

    test "removes deleted nodes on reload", %{registry: name} do
      create_test_node_file("node1.yml", """
      key: node1
      name: "Node 1"
      """)

      create_test_node_file("node2.yml", """
      key: node2
      name: "Node 2"
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      assert GatheringRegistry.count(name) == 2

      # Delete one node
      File.rm!(Path.join(@test_nodes_dir, "node1.yml"))

      assert :ok = GatheringRegistry.reload(name)

      assert GatheringRegistry.count(name) == 1
      assert {:error, :not_found} = GatheringRegistry.get("node1", name)
      assert {:ok, _} = GatheringRegistry.get("node2", name)

      GenServer.stop(pid)
    end

    test "returns error when files have parse errors", %{registry: name} do
      create_test_node_file("valid.yml", """
      key: valid
      name: "Valid Node"
      """)

      create_test_node_file("invalid.yml", """
      key: invalid
      # Missing required 'name' field
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      # Reload should return error due to invalid file
      result = GatheringRegistry.reload(name)

      assert {:error, errors} = result
      assert is_list(errors)
      assert length(errors) > 0

      GenServer.stop(pid)
    end
  end

  describe "load_from/2" do
    test "loads nodes from a different path", %{registry: name} do
      # Create initial nodes
      create_test_node_file("node1.yml", """
      key: node1
      name: "Node 1"
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      assert GatheringRegistry.count(name) == 1

      # Create a different directory with different nodes
      alt_path = "test/fixtures/alt_gathering_nodes"
      File.mkdir_p!(alt_path)

      File.write!(Path.join(alt_path, "alt_node.yml"), """
      key: alt_node
      name: "Alt Node"
      skill_required: foraging
      """)

      # Load from alternative path
      assert :ok = GatheringRegistry.load_from(alt_path, name)

      # Should now have only the new node
      assert GatheringRegistry.count(name) == 1
      assert {:ok, node} = GatheringRegistry.get("alt_node", name)
      assert node.name == "Alt Node"
      assert {:error, :not_found} = GatheringRegistry.get("node1", name)

      File.rm_rf!(alt_path)
      GenServer.stop(pid)
    end

    test "updates path for future reloads", %{registry: name} do
      create_test_node_file("node1.yml", """
      key: node1
      name: "Node 1"
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      # Load from alternative path
      alt_path = "test/fixtures/alt_gathering_nodes"
      File.mkdir_p!(alt_path)

      File.write!(Path.join(alt_path, "alt_node.yml"), """
      key: alt_node
      name: "Alt Node"
      """)

      assert :ok = GatheringRegistry.load_from(alt_path, name)

      # Add another file to alt path
      File.write!(Path.join(alt_path, "alt_node2.yml"), """
      key: alt_node2
      name: "Alt Node 2"
      """)

      # Reload should use the new path
      assert :ok = GatheringRegistry.reload(name)
      assert GatheringRegistry.count(name) == 2

      File.rm_rf!(alt_path)
      GenServer.stop(pid)
    end
  end

  describe "YAML loading" do
    test "loads node with all fields", %{registry: name} do
      create_test_node_file("full_node.yml", """
      key: full_node
      name: "Full Node"
      skill_required: herbalism
      skill_level: 10
      yields:
        - item: herb_rare
          chance: 0.1
          quantity: 1
        - item: herb_common
          chance: 0.6
          quantity: [2, 5]
      respawn_time: 600
      uses_per_respawn: 5
      tool_required: gathering_knife
      xp_reward:
        skill: herbalism
        amount: 15
      gather_message: "You carefully examine the herbs."
      success_message: "You harvest some valuable herbs!"
      failure_message: "The herbs are not ready yet."
      exhausted_message: "This patch has been picked clean."
      tags:
        - plant
        - rare
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      {:ok, node} = GatheringRegistry.get("full_node", name)

      assert node.key == "full_node"
      assert node.name == "Full Node"
      assert node.skill_required == "herbalism"
      assert node.skill_level == 10
      assert length(node.yields) == 2
      assert node.respawn_time == 600
      assert node.uses_per_respawn == 5
      assert node.tool_required == "gathering_knife"
      assert node.xp_reward == %{skill: "herbalism", amount: 15}
      assert node.gather_message == "You carefully examine the herbs."
      assert node.success_message == "You harvest some valuable herbs!"
      assert node.failure_message == "The herbs are not ready yet."
      assert node.exhausted_message == "This patch has been picked clean."
      assert node.tags == ["plant", "rare"]

      GenServer.stop(pid)
    end

    test "loads node with minimal fields", %{registry: name} do
      create_test_node_file("minimal.yml", """
      key: minimal
      name: "Minimal Node"
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      {:ok, node} = GatheringRegistry.get("minimal", name)

      assert node.key == "minimal"
      assert node.name == "Minimal Node"
      assert node.skill_required == nil
      assert node.skill_level == 0
      assert node.yields == []
      assert node.respawn_time == 300
      assert node.uses_per_respawn == 1
      assert node.tool_required == nil
      assert node.xp_reward == nil
      assert node.gather_message == "You gather from the node."
      assert node.success_message == "You find something useful!"
      assert node.failure_message == "You find nothing of value."
      assert node.exhausted_message == "This resource has been depleted."
      assert node.tags == []

      GenServer.stop(pid)
    end

    test "loads nodes from nested directories", %{registry: name} do
      # Create nested directory structure
      nested_dir = Path.join(@test_nodes_dir, "herbalism")
      File.mkdir_p!(nested_dir)

      File.write!(
        Path.join(nested_dir, "herb_patch.yml"),
        """
        key: herb_patch
        name: "Herb Patch"
        skill_required: herbalism
        """
      )

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      assert {:ok, node} = GatheringRegistry.get("herb_patch", name)
      assert node.name == "Herb Patch"

      GenServer.stop(pid)
    end

    test "supports both .yml and .yaml extensions", %{registry: name} do
      create_test_node_file("node1.yml", """
      key: node1
      name: "Node 1"
      """)

      File.mkdir_p!(@test_nodes_dir)

      File.write!(
        Path.join(@test_nodes_dir, "node2.yaml"),
        """
        key: node2
        name: "Node 2"
        """
      )

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      assert {:ok, _} = GatheringRegistry.get("node1", name)
      assert {:ok, _} = GatheringRegistry.get("node2", name)
      assert GatheringRegistry.count(name) == 2

      GenServer.stop(pid)
    end

    test "parses yields correctly", %{registry: name} do
      create_test_node_file("yields_test.yml", """
      key: yields_test
      name: "Yields Test"
      yields:
        - item: item_fixed
          chance: 1.0
          quantity: 5
        - item: item_range
          chance: 0.5
          quantity: [1, 10]
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      {:ok, node} = GatheringRegistry.get("yields_test", name)

      assert length(node.yields) == 2

      [yield1, yield2] = node.yields

      assert yield1.item == "item_fixed"
      assert yield1.chance == 1.0
      assert yield1.quantity == 5

      assert yield2.item == "item_range"
      assert yield2.chance == 0.5
      assert yield2.quantity == {1, 10}

      GenServer.stop(pid)
    end
  end

  describe "error handling" do
    test "handles invalid YAML gracefully", %{registry: name} do
      File.mkdir_p!(@test_nodes_dir)

      # Create invalid YAML
      File.write!(Path.join(@test_nodes_dir, "bad.yml"), "key: test\n  invalid: : : yaml")

      # Registry should start but may have errors
      {:ok, pid} =
        GatheringRegistry.start_link(
          name: name,
          path: @test_nodes_dir,
          load_on_start: true
        )

      assert Process.alive?(pid)
      # No nodes should be loaded from invalid file
      assert GatheringRegistry.count(name) == 0

      GenServer.stop(pid)
    end

    test "handles missing required fields", %{registry: name} do
      File.mkdir_p!(@test_nodes_dir)

      # Create node without required 'name' field
      File.write!(
        Path.join(@test_nodes_dir, "bad.yml"),
        "key: bad_node\nskill_required: mining"
      )

      {:ok, pid} =
        GatheringRegistry.start_link(
          name: name,
          path: @test_nodes_dir,
          load_on_start: true
        )

      # Node with missing fields should not be loaded
      assert GatheringRegistry.count(name) == 0

      GenServer.stop(pid)
    end

    test "handles malformed yield data", %{registry: name} do
      create_test_node_file("malformed_yields.yml", """
      key: malformed
      name: "Malformed Yields"
      yields:
        - item: test_item
          # Missing chance field (should default to 1.0)
          quantity: 5
      """)

      {:ok, pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      {:ok, node} = GatheringRegistry.get("malformed", name)
      assert length(node.yields) == 1
      assert hd(node.yields).chance == 1.0

      GenServer.stop(pid)
    end
  end

  describe "ETS table operations" do
    test "stores nodes in ETS table", %{registry: name} do
      create_test_node_file("test_node.yml", """
      key: test_node
      name: "Test Node"
      """)

      {:ok, _pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      # ETS table should be created and contain the node
      assert {:ok, node} = GatheringRegistry.get("test_node", name)
      assert node.key == "test_node"
    end

    test "clears ETS table on reload", %{registry: name} do
      create_test_node_file("node1.yml", """
      key: node1
      name: "Node 1"
      """)

      {:ok, _pid} = GatheringRegistry.start_link(name: name, path: @test_nodes_dir)

      assert GatheringRegistry.count(name) == 1

      # Create new file and remove old one
      create_test_node_file("node2.yml", """
      key: node2
      name: "Node 2"
      """)

      File.rm!(Path.join(@test_nodes_dir, "node1.yml"))

      GatheringRegistry.reload(name)

      # Old node should be gone, new node should be present
      assert {:error, :not_found} = GatheringRegistry.get("node1", name)
      assert {:ok, _} = GatheringRegistry.get("node2", name)
      assert GatheringRegistry.count(name) == 1
    end
  end

  describe "concurrent access" do
    test "handles concurrent reads", %{registry: name} do
      {:ok, _pid} = start_registry_with_test_nodes(name)

      # Spawn multiple processes that read concurrently
      tasks =
        for _ <- 1..10 do
          Task.async(fn ->
            {:ok, node} = GatheringRegistry.get("herb_patch", name)
            assert node.key == "herb_patch"
          end)
        end

      # All tasks should complete successfully
      Enum.each(tasks, &Task.await/1)
    end

    test "handles concurrent by_skill queries", %{registry: name} do
      {:ok, _pid} = start_registry_with_test_nodes(name)

      tasks =
        for _ <- 1..10 do
          Task.async(fn ->
            nodes = GatheringRegistry.by_skill("herbalism", name)
            assert length(nodes) == 1
          end)
        end

      Enum.each(tasks, &Task.await/1)
    end
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp create_test_node_file(filename, content) do
    File.mkdir_p!(@test_nodes_dir)
    File.write!(Path.join(@test_nodes_dir, filename), content)
  end

  defp start_registry_with_test_nodes(name) do
    create_test_node_file("herb_patch.yml", """
    key: herb_patch
    name: "Herb Patch"
    skill_required: herbalism
    skill_level: 1
    yields:
      - item: herb_healing
        chance: 0.6
        quantity: [1, 3]
    respawn_time: 300
    uses_per_respawn: 3
    tags:
      - plant
    """)

    create_test_node_file("ore_vein.yml", """
    key: ore_vein
    name: "Iron Ore Vein"
    skill_required: mining
    skill_level: 5
    yields:
      - item: iron_ore
        chance: 0.8
        quantity: [1, 2]
    respawn_time: 600
    tool_required: pickaxe
    tags:
      - ore
      - metal
    """)

    create_test_node_file("fish_spot.yml", """
    key: fish_spot
    name: "Fishing Spot"
    skill_required: fishing
    skill_level: 1
    yields:
      - item: fish_trout
        chance: 0.5
        quantity: 1
    tool_required: fishing_rod
    xp_reward:
      skill: fishing
      amount: 10
    tags:
      - water
    """)

    GatheringRegistry.start_link(name: name, path: @test_nodes_dir)
  end
end
