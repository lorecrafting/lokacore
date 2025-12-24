defmodule Exmud.Framework.Crafting.RecipeTest do
  use ExUnit.Case, async: true

  alias Exmud.Framework.Crafting.Recipe

  describe "from_map/1" do
    test "creates recipe with minimal required fields" do
      data = %{
        "key" => "simple_recipe",
        "name" => "Simple Recipe"
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.key == "simple_recipe"
      assert recipe.name == "Simple Recipe"
      assert recipe.skill_required == nil
      assert recipe.skill_level == 0
      assert recipe.ingredients == []
      assert recipe.tools == []
      assert recipe.output == []
      assert recipe.xp_reward == nil
      assert recipe.failure_chance == 0.0
      assert recipe.failure_output == []
      assert recipe.time_required == 0
      assert recipe.station_type == nil
      assert recipe.description == ""
      assert recipe.craft_message == "You begin crafting..."
      assert recipe.success_message == "You successfully craft the item!"
      assert recipe.failure_message == "Your crafting attempt fails."
      assert recipe.tags == []
    end

    test "creates recipe with all custom fields" do
      data = %{
        "key" => "health_potion",
        "name" => "Brew Health Potion",
        "skill_required" => "alchemy",
        "skill_level" => 2,
        "ingredients" => [
          %{"item" => "herb_healing", "quantity" => 2},
          %{"item" => "water_vial", "quantity" => 1}
        ],
        "tools" => ["mortar_pestle", "alchemy_kit"],
        "output" => [
          %{"item" => "health_potion", "quantity" => 1, "chance" => 1.0}
        ],
        "xp_reward" => %{"skill" => "alchemy", "amount" => 10},
        "failure_chance" => 0.1,
        "failure_output" => [
          %{"item" => "ruined_potion", "quantity" => 1, "chance" => 1.0}
        ],
        "time_required" => 30,
        "station_type" => "alchemy_bench",
        "description" => "Combine healing herbs to create a restorative potion",
        "craft_message" => "You carefully combine the ingredients...",
        "success_message" => "The potion bubbles to life!",
        "failure_message" => "The mixture is ruined.",
        "tags" => ["potion", "consumable"]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.key == "health_potion"
      assert recipe.name == "Brew Health Potion"
      assert recipe.skill_required == "alchemy"
      assert recipe.skill_level == 2
      assert length(recipe.ingredients) == 2
      assert length(recipe.tools) == 2
      assert length(recipe.output) == 1
      assert recipe.xp_reward == %{skill: "alchemy", amount: 10}
      assert recipe.failure_chance == 0.1
      assert length(recipe.failure_output) == 1
      assert recipe.time_required == 30
      assert recipe.station_type == "alchemy_bench"
      assert recipe.description == "Combine healing herbs to create a restorative potion"
      assert recipe.craft_message == "You carefully combine the ingredients..."
      assert recipe.success_message == "The potion bubbles to life!"
      assert recipe.failure_message == "The mixture is ruined."
      assert recipe.tags == ["potion", "consumable"]
    end

    test "accepts atom keys" do
      data = %{
        key: "test_recipe",
        name: "Test Recipe",
        skill_required: "crafting",
        skill_level: 5
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.key == "test_recipe"
      assert recipe.name == "Test Recipe"
      assert recipe.skill_required == "crafting"
      assert recipe.skill_level == 5
    end

    test "returns error when key is missing" do
      data = %{"name" => "No Key Recipe"}

      assert {:error, {:missing_field, "key"}} = Recipe.from_map(data)
    end

    test "returns error when name is missing" do
      data = %{"key" => "no_name"}

      assert {:error, {:missing_field, "name"}} = Recipe.from_map(data)
    end

    test "parses ingredients correctly" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "ingredients" => [
          %{"item" => "wood", "quantity" => 5},
          %{"item" => "stone", "quantity" => 3}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert length(recipe.ingredients) == 2
      assert Enum.at(recipe.ingredients, 0) == %{item: "wood", quantity: 5}
      assert Enum.at(recipe.ingredients, 1) == %{item: "stone", quantity: 3}
    end

    test "handles ingredients with defaults when quantity is missing" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "ingredients" => [
          %{"item" => "wood"}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.ingredients == [%{item: "wood", quantity: 1}]
    end

    test "handles empty ingredients list" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "ingredients" => []
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.ingredients == []
    end

    test "parses tools as simple list" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "tools" => ["hammer", "anvil", "tongs"]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.tools == ["hammer", "anvil", "tongs"]
    end

    test "handles empty tools list" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "tools" => []
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.tools == []
    end

    test "parses output with fixed quantity" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "output" => [
          %{"item" => "sword", "quantity" => 1, "chance" => 1.0}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert length(recipe.output) == 1
      output = List.first(recipe.output)
      assert output.item == "sword"
      assert output.quantity == 1
      assert output.chance == 1.0
    end

    test "parses output with range quantity" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "output" => [
          %{"item" => "arrow", "quantity" => [5, 10]}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      output = List.first(recipe.output)
      assert output.item == "arrow"
      assert output.quantity == {5, 10}
      assert output.chance == 1.0
    end

    test "parses output with partial chance" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "output" => [
          %{"item" => "rare_gem", "quantity" => 1, "chance" => 0.25}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      output = List.first(recipe.output)
      assert output.item == "rare_gem"
      assert output.quantity == 1
      assert output.chance == 0.25
    end

    test "handles output defaults when fields are missing" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "output" => [
          %{"item" => "basic_item"}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      output = List.first(recipe.output)
      assert output.item == "basic_item"
      assert output.quantity == 1
      assert output.chance == 1.0
    end

    test "parses failure_output correctly" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "failure_output" => [
          %{"item" => "scrap", "quantity" => 1, "chance" => 1.0}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert length(recipe.failure_output) == 1
      output = List.first(recipe.failure_output)
      assert output.item == "scrap"
      assert output.quantity == 1
      assert output.chance == 1.0
    end

    test "parses xp_reward with skill and amount" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "xp_reward" => %{"skill" => "smithing", "amount" => 25}
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.xp_reward == %{skill: "smithing", amount: 25}
    end

    test "handles xp_reward with defaults when fields are missing" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "xp_reward" => %{}
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.xp_reward == %{skill: nil, amount: 0}
    end

    test "handles nil xp_reward" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "xp_reward" => nil
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.xp_reward == nil
    end

    test "handles invalid xp_reward type" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "xp_reward" => "invalid"
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.xp_reward == nil
    end

    test "parses numeric fields correctly" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "skill_level" => 15,
        "failure_chance" => 0.33,
        "time_required" => 120
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.skill_level == 15
      assert recipe.failure_chance == 0.33
      assert recipe.time_required == 120
    end

    test "handles multiple outputs" do
      data = %{
        "key" => "test",
        "name" => "Test",
        "output" => [
          %{"item" => "primary_product", "quantity" => 1, "chance" => 1.0},
          %{"item" => "bonus_material", "quantity" => [1, 3], "chance" => 0.5}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert length(recipe.output) == 2
    end

    test "handles complex recipe with all features" do
      data = %{
        "key" => "legendary_sword",
        "name" => "Forge Legendary Sword",
        "skill_required" => "smithing",
        "skill_level" => 50,
        "ingredients" => [
          %{"item" => "mythril_ore", "quantity" => 10},
          %{"item" => "dragon_scale", "quantity" => 5},
          %{"item" => "ancient_rune", "quantity" => 1}
        ],
        "tools" => ["master_hammer", "enchanted_anvil"],
        "output" => [
          %{"item" => "legendary_sword", "quantity" => 1, "chance" => 0.8},
          %{"item" => "epic_sword", "quantity" => 1, "chance" => 0.2}
        ],
        "xp_reward" => %{"skill" => "smithing", "amount" => 1000},
        "failure_chance" => 0.3,
        "failure_output" => [
          %{"item" => "damaged_blade", "quantity" => 1, "chance" => 1.0}
        ],
        "time_required" => 600,
        "station_type" => "master_forge",
        "description" => "A legendary undertaking",
        "craft_message" => "You begin the sacred forging ritual...",
        "success_message" => "The blade gleams with otherworldly power!",
        "failure_message" => "The blade shatters during the final tempering.",
        "tags" => ["legendary", "weapon", "endgame"]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert recipe.key == "legendary_sword"
      assert length(recipe.ingredients) == 3
      assert length(recipe.tools) == 2
      assert length(recipe.output) == 2
      assert length(recipe.tags) == 3
    end
  end

  describe "requires_station?/1" do
    test "returns true when station_type is set" do
      recipe = %Recipe{key: "test", name: "Test", station_type: "forge"}
      assert Recipe.requires_station?(recipe) == true
    end

    test "returns false when station_type is nil" do
      recipe = %Recipe{key: "test", name: "Test", station_type: nil}
      assert Recipe.requires_station?(recipe) == false
    end

    test "returns true for any non-nil station type" do
      recipe = %Recipe{key: "test", name: "Test", station_type: "alchemy_bench"}
      assert Recipe.requires_station?(recipe) == true
    end
  end

  describe "can_fail?/1" do
    test "returns true when failure_chance is greater than 0" do
      recipe = %Recipe{key: "test", name: "Test", failure_chance: 0.1}
      assert Recipe.can_fail?(recipe) == true
    end

    test "returns false when failure_chance is 0" do
      recipe = %Recipe{key: "test", name: "Test", failure_chance: 0.0}
      assert Recipe.can_fail?(recipe) == false
    end

    test "returns false when failure_chance is 0.0 (explicit)" do
      recipe = %Recipe{key: "test", name: "Test", failure_chance: 0.0}
      assert Recipe.can_fail?(recipe) == false
    end

    test "returns true for high failure chance" do
      recipe = %Recipe{key: "test", name: "Test", failure_chance: 0.95}
      assert Recipe.can_fail?(recipe) == true
    end

    test "returns true for very low failure chance" do
      recipe = %Recipe{key: "test", name: "Test", failure_chance: 0.001}
      assert Recipe.can_fail?(recipe) == true
    end
  end

  describe "requires_skill?/1" do
    test "returns true when skill_required is set" do
      recipe = %Recipe{key: "test", name: "Test", skill_required: "alchemy"}
      assert Recipe.requires_skill?(recipe) == true
    end

    test "returns false when skill_required is nil" do
      recipe = %Recipe{key: "test", name: "Test", skill_required: nil}
      assert Recipe.requires_skill?(recipe) == false
    end

    test "returns true for any non-nil skill" do
      recipe = %Recipe{key: "test", name: "Test", skill_required: "smithing"}
      assert Recipe.requires_skill?(recipe) == true
    end
  end

  describe "calculate_quantity/1" do
    test "returns fixed integer quantity" do
      assert Recipe.calculate_quantity(5) == 5
      assert Recipe.calculate_quantity(1) == 1
      assert Recipe.calculate_quantity(100) == 100
    end

    test "returns random value in range for tuple" do
      # Run multiple times to test randomness
      results = for _ <- 1..50, do: Recipe.calculate_quantity({1, 10})

      # All results should be within range
      assert Enum.all?(results, &(&1 >= 1 and &1 <= 10))

      # Should have some variation (not all the same)
      assert length(Enum.uniq(results)) > 1
    end

    test "handles range with same min and max" do
      assert Recipe.calculate_quantity({5, 5}) == 5
    end

    test "handles range with min = 1, max = 1" do
      assert Recipe.calculate_quantity({1, 1}) == 1
    end

    test "handles larger ranges" do
      results = for _ <- 1..100, do: Recipe.calculate_quantity({50, 100})

      assert Enum.all?(results, &(&1 >= 50 and &1 <= 100))
      assert Enum.min(results) >= 50
      assert Enum.max(results) <= 100
    end

    test "defaults to 1 for invalid input" do
      assert Recipe.calculate_quantity(nil) == 1
      assert Recipe.calculate_quantity("invalid") == 1
      assert Recipe.calculate_quantity([1, 2, 3]) == 1
      assert Recipe.calculate_quantity(%{}) == 1
    end

    test "handles tuple with different values" do
      # Test boundary values
      results = for _ <- 1..30, do: Recipe.calculate_quantity({3, 7})

      assert Enum.all?(results, &(&1 >= 3 and &1 <= 7))
      # Should use full range
      assert Enum.min(results) >= 3
      assert Enum.max(results) <= 7
    end
  end

  describe "integration tests" do
    test "complete crafting workflow with multiple ingredients and tools" do
      data = %{
        "key" => "steel_sword",
        "name" => "Steel Sword",
        "skill_required" => "smithing",
        "skill_level" => 10,
        "ingredients" => [
          %{"item" => "iron_ingot", "quantity" => 3},
          %{"item" => "coal", "quantity" => 2},
          %{"item" => "leather_strips", "quantity" => 1}
        ],
        "tools" => ["hammer", "anvil"],
        "output" => [
          %{"item" => "steel_sword", "quantity" => 1, "chance" => 1.0}
        ],
        "xp_reward" => %{"skill" => "smithing", "amount" => 50},
        "failure_chance" => 0.05,
        "failure_output" => [
          %{"item" => "warped_blade", "quantity" => 1, "chance" => 1.0}
        ],
        "time_required" => 180,
        "station_type" => "forge",
        "description" => "A sturdy steel blade",
        "tags" => ["weapon", "melee"]
      }

      assert {:ok, recipe} = Recipe.from_map(data)

      # Check helper functions
      assert Recipe.requires_station?(recipe) == true
      assert Recipe.can_fail?(recipe) == true
      assert Recipe.requires_skill?(recipe) == true

      # Check structure
      assert length(recipe.ingredients) == 3
      assert length(recipe.tools) == 2
      assert recipe.xp_reward.amount == 50
    end

    test "recipe with random output quantity" do
      data = %{
        "key" => "arrow_batch",
        "name" => "Craft Arrows",
        "output" => [
          %{"item" => "arrow", "quantity" => [10, 15], "chance" => 1.0}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      output = List.first(recipe.output)

      # Verify range stored correctly
      assert output.quantity == {10, 15}

      # Test quantity calculation
      quantity = Recipe.calculate_quantity(output.quantity)
      assert quantity >= 10 and quantity <= 15
    end

    test "no-skill recipe with no station" do
      data = %{
        "key" => "campfire",
        "name" => "Build Campfire",
        "ingredients" => [
          %{"item" => "wood", "quantity" => 5},
          %{"item" => "tinder", "quantity" => 1}
        ],
        "output" => [
          %{"item" => "campfire", "quantity" => 1, "chance" => 1.0}
        ],
        "time_required" => 10
      }

      assert {:ok, recipe} = Recipe.from_map(data)

      assert Recipe.requires_station?(recipe) == false
      assert Recipe.can_fail?(recipe) == false
      assert Recipe.requires_skill?(recipe) == false
      assert recipe.xp_reward == nil
    end

    test "high-risk high-reward recipe" do
      data = %{
        "key" => "philosopher_stone",
        "name" => "Create Philosopher's Stone",
        "skill_required" => "alchemy",
        "skill_level" => 99,
        "failure_chance" => 0.8,
        "output" => [
          %{"item" => "philosopher_stone", "quantity" => 1, "chance" => 1.0}
        ],
        "failure_output" => [
          %{"item" => "ashes", "quantity" => 1, "chance" => 1.0}
        ],
        "xp_reward" => %{"skill" => "alchemy", "amount" => 10000}
      }

      assert {:ok, recipe} = Recipe.from_map(data)

      assert Recipe.can_fail?(recipe) == true
      assert recipe.failure_chance == 0.8
      assert recipe.xp_reward.amount == 10000
      assert recipe.skill_level == 99
    end

    test "recipe with multiple output items with different chances" do
      data = %{
        "key" => "treasure_chest",
        "name" => "Open Treasure Chest",
        "output" => [
          %{"item" => "gold_coins", "quantity" => [50, 100], "chance" => 1.0},
          %{"item" => "magic_gem", "quantity" => 1, "chance" => 0.1},
          %{"item" => "legendary_artifact", "quantity" => 1, "chance" => 0.01}
        ]
      }

      assert {:ok, recipe} = Recipe.from_map(data)
      assert length(recipe.output) == 3

      # Verify each output item
      gold = Enum.at(recipe.output, 0)
      gem = Enum.at(recipe.output, 1)
      artifact = Enum.at(recipe.output, 2)

      assert gold.item == "gold_coins"
      assert gold.quantity == {50, 100}
      assert gold.chance == 1.0

      assert gem.item == "magic_gem"
      assert gem.quantity == 1
      assert gem.chance == 0.1

      assert artifact.item == "legendary_artifact"
      assert artifact.quantity == 1
      assert artifact.chance == 0.01
    end
  end
end
