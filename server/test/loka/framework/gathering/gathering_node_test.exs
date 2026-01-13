defmodule Loka.Framework.Gathering.GatheringNodeTest do
  use Loka.DataCase

  alias Loka.Framework.Gathering.GatheringNode

  describe "from_map/1" do
    test "creates gathering node from valid map with required fields" do
      data = %{
        "key" => "herb_patch",
        "name" => "Herb Patch"
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.key == "herb_patch"
      assert node.name == "Herb Patch"
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
    end

    test "parses all fields correctly" do
      data = %{
        "key" => "iron_vein",
        "name" => "Iron Vein",
        "skill_required" => "mining",
        "skill_level" => 5,
        "yields" => [
          %{"item" => "iron_ore", "chance" => 0.8, "quantity" => [1, 3]},
          %{"item" => "gem_ruby", "chance" => 0.1, "quantity" => 1}
        ],
        "respawn_time" => 600,
        "uses_per_respawn" => 5,
        "tool_required" => "pickaxe",
        "xp_reward" => %{"skill" => "mining", "amount" => 10},
        "gather_message" => "You swing your pickaxe at the vein.",
        "success_message" => "You extract some ore!",
        "failure_message" => "The ore crumbles to dust.",
        "exhausted_message" => "The vein is depleted.",
        "tags" => ["mining", "ore"]
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.key == "iron_vein"
      assert node.name == "Iron Vein"
      assert node.skill_required == "mining"
      assert node.skill_level == 5
      assert length(node.yields) == 2
      assert node.respawn_time == 600
      assert node.uses_per_respawn == 5
      assert node.tool_required == "pickaxe"
      assert node.xp_reward == %{skill: "mining", amount: 10}
      assert node.gather_message == "You swing your pickaxe at the vein."
      assert node.success_message == "You extract some ore!"
      assert node.failure_message == "The ore crumbles to dust."
      assert node.exhausted_message == "The vein is depleted."
      assert node.tags == ["mining", "ore"]
    end

    test "parses yields with fixed quantity" do
      data = %{
        "key" => "simple_node",
        "name" => "Simple Node",
        "yields" => [
          %{"item" => "wood", "chance" => 1.0, "quantity" => 5}
        ]
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert length(node.yields) == 1
      [yield] = node.yields
      assert yield.item == "wood"
      assert yield.chance == 1.0
      assert yield.quantity == 5
    end

    test "parses yields with range quantity" do
      data = %{
        "key" => "random_node",
        "name" => "Random Node",
        "yields" => [
          %{"item" => "herb", "chance" => 0.5, "quantity" => [2, 8]}
        ]
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert length(node.yields) == 1
      [yield] = node.yields
      assert yield.item == "herb"
      assert yield.chance == 0.5
      assert yield.quantity == {2, 8}
    end

    test "parses yields with missing fields using defaults" do
      data = %{
        "key" => "minimal_node",
        "name" => "Minimal Node",
        "yields" => [%{"item" => "stone"}]
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert length(node.yields) == 1
      [yield] = node.yields
      assert yield.item == "stone"
      assert yield.chance == 1.0
      assert yield.quantity == 1
    end

    test "parses empty yields list" do
      data = %{
        "key" => "empty_node",
        "name" => "Empty Node",
        "yields" => []
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.yields == []
    end

    test "handles missing yields field" do
      data = %{
        "key" => "no_yield_node",
        "name" => "No Yield Node"
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.yields == []
    end

    test "parses xp_reward with all fields" do
      data = %{
        "key" => "xp_node",
        "name" => "XP Node",
        "xp_reward" => %{"skill" => "herbalism", "amount" => 25}
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.xp_reward == %{skill: "herbalism", amount: 25}
    end

    test "handles missing xp_reward" do
      data = %{
        "key" => "no_xp_node",
        "name" => "No XP Node"
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.xp_reward == nil
    end

    test "handles invalid xp_reward format" do
      data = %{
        "key" => "bad_xp_node",
        "name" => "Bad XP Node",
        "xp_reward" => "invalid"
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.xp_reward == nil
    end

    test "parses xp_reward with missing fields using defaults" do
      data = %{
        "key" => "partial_xp_node",
        "name" => "Partial XP Node",
        "xp_reward" => %{}
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.xp_reward == %{skill: nil, amount: 0}
    end

    test "accepts atom keys in input map" do
      data = %{
        key: "atom_node",
        name: "Atom Node",
        skill_required: "mining",
        skill_level: 3
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.key == "atom_node"
      assert node.name == "Atom Node"
      assert node.skill_required == "mining"
      assert node.skill_level == 3
    end

    test "accepts mixed string and atom keys" do
      data =
        Map.merge(
          %{"key" => "mixed_node", "skill_level" => 2},
          %{name: "Mixed Node", respawn_time: 400}
        )

      assert {:ok, node} = GatheringNode.from_map(data)
      assert node.key == "mixed_node"
      assert node.name == "Mixed Node"
      assert node.skill_level == 2
      assert node.respawn_time == 400
    end

    test "returns error when key is missing" do
      data = %{"name" => "No Key Node"}
      assert {:error, {:missing_field, :key}} = GatheringNode.from_map(data)
    end

    test "returns error when name is missing" do
      data = %{"key" => "no_name_node"}
      assert {:error, {:missing_field, :name}} = GatheringNode.from_map(data)
    end

    test "returns error when both key and name are missing" do
      data = %{"skill_required" => "mining"}
      assert {:error, {:missing_field, :key}} = GatheringNode.from_map(data)
    end
  end

  describe "calculate_quantity/1" do
    test "returns fixed quantity when given integer" do
      assert GatheringNode.calculate_quantity(5) == 5
      assert GatheringNode.calculate_quantity(1) == 1
      assert GatheringNode.calculate_quantity(100) == 100
    end

    test "returns random value within range when given tuple" do
      # Test multiple times to ensure randomness stays within range
      for _ <- 1..100 do
        result = GatheringNode.calculate_quantity({1, 5})
        assert result >= 1
        assert result <= 5
      end
    end

    test "handles single-value range" do
      # Test multiple times to ensure it always returns the same value
      for _ <- 1..10 do
        assert GatheringNode.calculate_quantity({3, 3}) == 3
      end
    end

    test "handles large range" do
      for _ <- 1..100 do
        result = GatheringNode.calculate_quantity({1, 1000})
        assert result >= 1
        assert result <= 1000
      end
    end

    test "returns 1 for invalid input" do
      assert GatheringNode.calculate_quantity(nil) == 1
      assert GatheringNode.calculate_quantity("invalid") == 1
      assert GatheringNode.calculate_quantity([1, 2, 3]) == 1
      assert GatheringNode.calculate_quantity(%{}) == 1
    end
  end

  describe "requires_skill?/1" do
    test "returns false when skill_required is nil" do
      node = %GatheringNode{skill_required: nil}
      assert GatheringNode.requires_skill?(node) == false
    end

    test "returns true when skill_required is set" do
      node = %GatheringNode{skill_required: "herbalism"}
      assert GatheringNode.requires_skill?(node) == true
    end

    test "returns true even if skill_required is empty string" do
      node = %GatheringNode{skill_required: ""}
      assert GatheringNode.requires_skill?(node) == true
    end
  end

  describe "requires_tool?/1" do
    test "returns false when tool_required is nil" do
      node = %GatheringNode{tool_required: nil}
      assert GatheringNode.requires_tool?(node) == false
    end

    test "returns true when tool_required is set" do
      node = %GatheringNode{tool_required: "pickaxe"}
      assert GatheringNode.requires_tool?(node) == true
    end

    test "returns true even if tool_required is empty string" do
      node = %GatheringNode{tool_required: ""}
      assert GatheringNode.requires_tool?(node) == true
    end
  end

  describe "roll_yields/1" do
    test "returns empty list when node has no yields" do
      node = %GatheringNode{yields: []}
      assert GatheringNode.roll_yields(node) == []
    end

    test "always returns item with 100% chance" do
      node = %GatheringNode{
        yields: [
          %{item: "guaranteed_item", chance: 1.0, quantity: 5}
        ]
      }

      # Test multiple times to ensure consistency
      for _ <- 1..10 do
        results = GatheringNode.roll_yields(node)
        assert length(results) == 1
        [result] = results
        assert result.item == "guaranteed_item"
        assert result.quantity == 5
      end
    end

    test "never returns item with 0% chance" do
      node = %GatheringNode{
        yields: [
          %{item: "impossible_item", chance: 0.0, quantity: 1}
        ]
      }

      # Test multiple times to ensure it never appears
      for _ <- 1..10 do
        results = GatheringNode.roll_yields(node)
        assert results == []
      end
    end

    test "rolls for each yield independently" do
      node = %GatheringNode{
        yields: [
          %{item: "common_item", chance: 1.0, quantity: 1},
          %{item: "rare_item", chance: 1.0, quantity: 1}
        ]
      }

      results = GatheringNode.roll_yields(node)
      assert length(results) == 2
      items = Enum.map(results, & &1.item)
      assert "common_item" in items
      assert "rare_item" in items
    end

    test "returns items with varying chances" do
      node = %GatheringNode{
        yields: [
          %{item: "guaranteed", chance: 1.0, quantity: 1},
          %{item: "likely", chance: 0.9, quantity: 1},
          %{item: "unlikely", chance: 0.1, quantity: 1},
          %{item: "impossible", chance: 0.0, quantity: 1}
        ]
      }

      # Test multiple times and track results
      results_over_time =
        for _ <- 1..100 do
          GatheringNode.roll_yields(node)
        end

      # Guaranteed item should appear in all rolls
      guaranteed_count =
        Enum.count(results_over_time, fn results ->
          Enum.any?(results, &(&1.item == "guaranteed"))
        end)

      assert guaranteed_count == 100

      # Impossible item should never appear
      impossible_count =
        Enum.count(results_over_time, fn results ->
          Enum.any?(results, &(&1.item == "impossible"))
        end)

      assert impossible_count == 0

      # Likely item should appear most of the time (statistically around 90 times)
      likely_count =
        Enum.count(results_over_time, fn results ->
          Enum.any?(results, &(&1.item == "likely"))
        end)

      assert likely_count > 70

      # Unlikely item should appear some of the time (statistically around 10 times)
      unlikely_count =
        Enum.count(results_over_time, fn results ->
          Enum.any?(results, &(&1.item == "unlikely"))
        end)

      assert unlikely_count > 0
      assert unlikely_count < 30
    end

    test "calculates quantity for rolled items with fixed quantity" do
      node = %GatheringNode{
        yields: [
          %{item: "wood", chance: 1.0, quantity: 10}
        ]
      }

      results = GatheringNode.roll_yields(node)
      assert length(results) == 1
      [result] = results
      assert result.quantity == 10
    end

    test "calculates quantity for rolled items with range quantity" do
      node = %GatheringNode{
        yields: [
          %{item: "herb", chance: 1.0, quantity: {1, 5}}
        ]
      }

      # Test multiple times to verify range
      for _ <- 1..20 do
        results = GatheringNode.roll_yields(node)
        assert length(results) == 1
        [result] = results
        assert result.quantity >= 1
        assert result.quantity <= 5
      end
    end

    test "handles multiple yields with different quantities" do
      node = %GatheringNode{
        yields: [
          %{item: "common", chance: 1.0, quantity: 5},
          %{item: "rare", chance: 1.0, quantity: {1, 3}}
        ]
      }

      results = GatheringNode.roll_yields(node)
      assert length(results) == 2

      common = Enum.find(results, &(&1.item == "common"))
      rare = Enum.find(results, &(&1.item == "rare"))

      assert common.quantity == 5
      assert rare.quantity >= 1
      assert rare.quantity <= 3
    end

    test "returns results in same order as yields" do
      node = %GatheringNode{
        yields: [
          %{item: "first", chance: 1.0, quantity: 1},
          %{item: "second", chance: 1.0, quantity: 1},
          %{item: "third", chance: 1.0, quantity: 1}
        ]
      }

      results = GatheringNode.roll_yields(node)
      items = Enum.map(results, & &1.item)
      assert items == ["first", "second", "third"]
    end
  end

  describe "integration scenarios" do
    test "creates a complete herbalism node" do
      data = %{
        "key" => "healing_herbs",
        "name" => "Patch of Healing Herbs",
        "skill_required" => "herbalism",
        "skill_level" => 3,
        "yields" => [
          %{"item" => "healing_herb", "chance" => 0.7, "quantity" => [1, 3]},
          %{"item" => "rare_herb", "chance" => 0.2, "quantity" => 1}
        ],
        "respawn_time" => 180,
        "uses_per_respawn" => 3,
        "tool_required" => "gathering_knife",
        "xp_reward" => %{"skill" => "herbalism", "amount" => 8},
        "gather_message" => "You carefully examine the herbs.",
        "success_message" => "You gather some useful herbs!",
        "failure_message" => "The herbs crumble in your hands.",
        "exhausted_message" => "There are no more herbs to gather here.",
        "tags" => ["herbalism", "medicinal"]
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      assert GatheringNode.requires_skill?(node)
      assert GatheringNode.requires_tool?(node)

      # Roll yields multiple times
      for _ <- 1..10 do
        results = GatheringNode.roll_yields(node)
        # Should get 0-2 items based on chances
        assert length(results) <= 2

        # Verify each result has proper structure
        for result <- results do
          assert result.item in ["healing_herb", "rare_herb"]
          assert is_integer(result.quantity)
          assert result.quantity >= 1
        end
      end
    end

    test "creates a simple mining node" do
      data = %{
        "key" => "copper_vein",
        "name" => "Copper Vein",
        "skill_required" => "mining",
        "skill_level" => 1,
        "yields" => [
          %{"item" => "copper_ore", "chance" => 1.0, "quantity" => 3}
        ],
        "respawn_time" => 300,
        "uses_per_respawn" => 1,
        "tool_required" => "pickaxe",
        "xp_reward" => %{"skill" => "mining", "amount" => 5}
      }

      assert {:ok, node} = GatheringNode.from_map(data)

      results = GatheringNode.roll_yields(node)
      assert length(results) == 1
      [result] = results
      assert result.item == "copper_ore"
      assert result.quantity == 3
    end

    test "creates a node with no requirements" do
      data = %{
        "key" => "berries",
        "name" => "Berry Bush",
        "yields" => [
          %{"item" => "berry", "chance" => 1.0, "quantity" => [3, 8]}
        ]
      }

      assert {:ok, node} = GatheringNode.from_map(data)
      refute GatheringNode.requires_skill?(node)
      refute GatheringNode.requires_tool?(node)

      # Should still be able to gather
      results = GatheringNode.roll_yields(node)
      assert length(results) == 1
      [result] = results
      assert result.item == "berry"
      assert result.quantity >= 3
      assert result.quantity <= 8
    end
  end
end
