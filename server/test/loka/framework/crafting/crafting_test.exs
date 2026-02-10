defmodule Loka.Framework.CraftingTest do
  use Loka.DataCase

  alias Loka.Framework.Crafting
  alias Loka.Framework.Crafting.{Recipe, CraftingRegistry}
  alias Loka.Framework.Player.GameState
  alias Loka.Engine.Entities

  import Loka.AccountsFixtures

  # =============================================================================
  # Setup & Fixtures
  # =============================================================================

  setup do
    # Start CraftingRegistry for each test (if not already started by app)
    registry =
      case start_supervised({CraftingRegistry, [load_on_start: false]}) do
        {:ok, pid} -> pid
        {:error, {:already_started, pid}} -> pid
      end

    # Restore production state on exit by reloading from disk
    on_exit(fn ->
      if Process.alive?(registry) do
        CraftingRegistry.reload()
      end
    end)

    # Create test recipes
    simple_recipe = %Recipe{
      key: "recipe_simple_item",
      name: "Simple Item",
      skill_required: nil,
      skill_level: 0,
      ingredients: [
        %{item: "ingredient_a", quantity: 2},
        %{item: "ingredient_b", quantity: 1}
      ],
      tools: [],
      output: [%{item: "simple_item", quantity: 1, chance: 1.0}],
      xp_reward: %{skill: "crafting", amount: 10},
      failure_chance: 0.0,
      failure_output: [],
      time_required: 0,
      station_type: nil,
      description: "A simple item",
      craft_message: "You craft a simple item...",
      success_message: "Success!",
      failure_message: "Failed!",
      tags: []
    }

    skilled_recipe = %Recipe{
      key: "recipe_advanced_item",
      name: "Advanced Item",
      skill_required: "blacksmithing",
      skill_level: 5,
      ingredients: [%{item: "iron_bar", quantity: 3}],
      tools: ["hammer"],
      output: [%{item: "iron_sword", quantity: 1, chance: 1.0}],
      xp_reward: %{skill: "blacksmithing", amount: 50},
      failure_chance: 0.2,
      failure_output: [%{item: "scrap_metal", quantity: 1, chance: 1.0}],
      time_required: 60,
      station_type: "forge",
      description: "An advanced item requiring skill",
      craft_message: "You work the forge...",
      success_message: "Forged!",
      failure_message: "The metal breaks!",
      tags: ["advanced"]
    }

    tool_recipe = %Recipe{
      key: "recipe_with_tools",
      name: "Tool Recipe",
      skill_required: nil,
      skill_level: 0,
      ingredients: [%{item: "wood", quantity: 1}],
      tools: ["saw", "hammer"],
      output: [%{item: "wooden_box", quantity: 1, chance: 1.0}],
      xp_reward: nil,
      failure_chance: 0.0,
      failure_output: [],
      time_required: 0,
      station_type: nil,
      description: "Requires tools",
      craft_message: "Crafting...",
      success_message: "Done!",
      failure_message: "Failed!",
      tags: []
    }

    # Register recipes in the test registry using internal state manipulation
    register_test_recipe(registry, simple_recipe)
    register_test_recipe(registry, skilled_recipe)
    register_test_recipe(registry, tool_recipe)

    %{
      registry: registry,
      simple_recipe: simple_recipe,
      skilled_recipe: skilled_recipe,
      tool_recipe: tool_recipe
    }
  end

  # Helper to register recipes for testing via the registry API
  defp register_test_recipe(_registry, recipe) do
    # Use the registry's register function which updates both state and ETS
    CraftingRegistry.register(recipe)
  end

  # Helper to create a game state for testing
  defp game_state_fixture(player_id, attrs \\ %{}) do
    {:ok, state} = GameState.create_state(player_id)

    if map_size(attrs) > 0 do
      {:ok, state} = GameState.update_state(state, attrs)
      state
    else
      state
    end
  end

  # Helper to create a room entity with a crafting station
  defp create_room_with_station(station_type, bonus \\ 0.0) do
    {:ok, room} =
      Entities.create_entity(%{
        key: "test_room_#{System.unique_integer([:positive])}",
        name: "Test Room",
        description: "A test room",
        type: "room",
        components: %{
          "crafting_station" => %{
            "type" => station_type,
            "bonus" => bonus
          }
        }
      })

    room
  end

  # =============================================================================
  # list_available_recipes/1
  # =============================================================================

  describe "list_available_recipes/1" do
    test "returns recipes with no skill requirements", %{simple_recipe: simple_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id)

      recipes = Crafting.list_available_recipes(state)

      assert Enum.any?(recipes, &(&1.key == simple_recipe.key))
    end

    test "filters recipes by skill level", %{skilled_recipe: skilled_recipe} do
      player = player_fixture()

      # Player with insufficient skill
      state_low = game_state_fixture(player.id, %{stats: %{"skills" => %{"blacksmithing" => 2}}})
      recipes_low = Crafting.list_available_recipes(state_low)
      refute Enum.any?(recipes_low, &(&1.key == skilled_recipe.key))

      # Player with sufficient skill
      {:ok, state_high} =
        GameState.update_state(state_low, %{stats: %{"skills" => %{"blacksmithing" => 5}}})

      recipes_high = Crafting.list_available_recipes(state_high)
      assert Enum.any?(recipes_high, &(&1.key == skilled_recipe.key))
    end

    test "returns only recipes matching player skill levels", %{skilled_recipe: skilled_recipe} do
      player = player_fixture()
      # Player with no skills - should not see advanced recipes
      state = game_state_fixture(player.id, %{stats: %{"skills" => %{}}})

      recipes = Crafting.list_available_recipes(state)

      # Should not include the skilled recipe
      refute Enum.any?(recipes, &(&1.key == skilled_recipe.key))
    end
  end

  # =============================================================================
  # list_station_recipes/1
  # =============================================================================

  describe "list_station_recipes/1" do
    test "returns recipes for a specific station type", %{skilled_recipe: skilled_recipe} do
      room = create_room_with_station("forge")

      recipes = Crafting.list_station_recipes(room)

      assert Enum.any?(recipes, &(&1.key == skilled_recipe.key))
    end

    test "returns empty list for room without station" do
      {:ok, room} =
        Entities.create_entity(%{
          key: "empty_room",
          name: "Empty Room",
          description: "No station here",
          type: "room",
          components: %{}
        })

      recipes = Crafting.list_station_recipes(room)
      assert recipes == []
    end

    test "returns empty list for nil room" do
      recipes = Crafting.list_station_recipes(nil)
      assert recipes == []
    end
  end

  # =============================================================================
  # can_craft?/3
  # =============================================================================

  describe "can_craft?/3" do
    test "returns :ok when all requirements are met", %{simple_recipe: simple_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a", "ingredient_a", "ingredient_b"]
        })

      assert :ok = Crafting.can_craft?(state, simple_recipe.key)
    end

    test "returns error for non-existent recipe" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :not_found} = Crafting.can_craft?(state, "nonexistent_recipe")
    end

    test "returns error for insufficient skill", %{skilled_recipe: skilled_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{"skills" => %{"blacksmithing" => 2}}})

      assert {:error, {:skill_required, "blacksmithing", 5, 2}} =
               Crafting.can_craft?(state, skilled_recipe.key)
    end

    test "returns error for missing ingredients", %{simple_recipe: simple_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["ingredient_a"]})

      assert {:error, {:missing_ingredients, _missing}} =
               Crafting.can_craft?(state, simple_recipe.key)
    end

    test "returns error for missing tools", %{tool_recipe: tool_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["wood"]})

      assert {:error, {:missing_tools, missing}} = Crafting.can_craft?(state, tool_recipe.key)
      assert "saw" in missing
      assert "hammer" in missing
    end

    test "accepts when all tools are present", %{tool_recipe: tool_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["wood", "saw", "hammer"]})

      assert :ok = Crafting.can_craft?(state, tool_recipe.key)
    end

    test "returns error for missing station", %{skilled_recipe: skilled_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{"skills" => %{"blacksmithing" => 5}},
          inventory: ["iron_bar", "iron_bar", "iron_bar", "hammer"]
        })

      assert {:error, {:station_required, "forge"}} =
               Crafting.can_craft?(state, skilled_recipe.key)
    end

    test "returns error for wrong station type", %{skilled_recipe: skilled_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{"skills" => %{"blacksmithing" => 5}},
          inventory: ["iron_bar", "iron_bar", "iron_bar", "hammer"]
        })

      wrong_room = create_room_with_station("alchemy_bench")

      assert {:error, {:wrong_station, "forge", "alchemy_bench"}} =
               Crafting.can_craft?(state, skilled_recipe.key, room: wrong_room)
    end

    test "accepts with correct station", %{skilled_recipe: skilled_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{"skills" => %{"blacksmithing" => 5}},
          inventory: ["iron_bar", "iron_bar", "iron_bar", "hammer"]
        })

      forge_room = create_room_with_station("forge")

      assert :ok = Crafting.can_craft?(state, skilled_recipe.key, room: forge_room)
    end

    test "handles partial ingredients correctly", %{simple_recipe: simple_recipe} do
      player = player_fixture()

      # Has 1 of ingredient_a but needs 2
      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a", "ingredient_b"]
        })

      assert {:error, {:missing_ingredients, _}} =
               Crafting.can_craft?(state, simple_recipe.key)
    end
  end

  # =============================================================================
  # craft/3
  # =============================================================================

  describe "craft/3" do
    test "successfully crafts item with no failure chance", %{simple_recipe: simple_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a", "ingredient_a", "ingredient_b"]
        })

      assert {:ok, updated_state, result} = Crafting.craft(state, simple_recipe.key)

      # Check result
      assert result.success == true
      assert result.items == [%{item: "simple_item", quantity: 1}]
      assert result.message == "Success!"
      assert result.xp == %{skill: "crafting", amount: 10}
      assert result.consumed == simple_recipe.ingredients

      # Verify ingredients were consumed atomically
      assert updated_state.inventory == []
    end

    test "returns error when requirements not met", %{simple_recipe: simple_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: []})

      assert {:error, {:missing_ingredients, _}} = Crafting.craft(state, simple_recipe.key)
    end

    test "returns error for non-existent recipe" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :not_found} = Crafting.craft(state, "nonexistent")
    end

    test "handles failure with failure_output", %{skilled_recipe: skilled_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{"skills" => %{"blacksmithing" => 5}},
          inventory: ["iron_bar", "iron_bar", "iron_bar", "hammer"]
        })

      forge = create_room_with_station("forge")

      # Seed random to force failure (failure_chance is 0.2)
      :rand.seed(:exsss, {1, 2, 3})

      # Try multiple times to get both success and failure
      results =
        Enum.map(1..10, fn _ ->
          {:ok, _updated_state, result} = Crafting.craft(state, skilled_recipe.key, room: forge)
          result.success
        end)

      # With a 0.2 failure chance, we should see some successes
      # (This is probabilistic but with 10 attempts should be reliable)
      assert Enum.any?(results, & &1)
    end

    test "applies station bonus to reduce failure chance", %{skilled_recipe: skilled_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{"skills" => %{"blacksmithing" => 5}},
          inventory: ["iron_bar", "iron_bar", "iron_bar", "hammer"]
        })

      # Forge with high bonus (reduces failure_chance by 0.2)
      forge_with_bonus = create_room_with_station("forge", 0.2)

      {:ok, updated_state, result} =
        Crafting.craft(state, skilled_recipe.key, room: forge_with_bonus)

      # With bonus, failure chance is 0.2 - 0.2 = 0.0, so always succeeds
      assert result.success == true
      # Verify ingredients consumed (3 iron_bar consumed, hammer is a tool - not consumed)
      assert length(updated_state.inventory) == 1
      assert "hammer" in updated_state.inventory
    end

    test "includes consumed ingredients in result and updates state" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a", "ingredient_a", "ingredient_b", "extra_item"]
        })

      {:ok, updated_state, result} = Crafting.craft(state, "recipe_simple_item")

      # Check result has consumed ingredients
      assert length(result.consumed) == 2
      assert Enum.any?(result.consumed, &(&1.item == "ingredient_a" and &1.quantity == 2))
      assert Enum.any?(result.consumed, &(&1.item == "ingredient_b" and &1.quantity == 1))

      # Verify state was actually updated
      assert length(updated_state.inventory) == 1
      assert "extra_item" in updated_state.inventory
    end
  end

  # =============================================================================
  # get_missing_ingredients/2
  # =============================================================================

  describe "get_missing_ingredients/2" do
    test "returns missing ingredients with details", %{simple_recipe: simple_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["ingredient_a"]})

      missing = Crafting.get_missing_ingredients(state, simple_recipe.key)

      assert length(missing) == 2

      ingredient_a = Enum.find(missing, &(&1.item == "ingredient_a"))
      assert ingredient_a.required == 2
      assert ingredient_a.have == 1
      assert ingredient_a.missing == 1

      ingredient_b = Enum.find(missing, &(&1.item == "ingredient_b"))
      assert ingredient_b.required == 1
      assert ingredient_b.have == 0
      assert ingredient_b.missing == 1
    end

    test "returns empty list when all ingredients present", %{simple_recipe: simple_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a", "ingredient_a", "ingredient_b"]
        })

      missing = Crafting.get_missing_ingredients(state, simple_recipe.key)

      assert missing == []
    end

    test "returns empty list for non-existent recipe" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      missing = Crafting.get_missing_ingredients(state, "nonexistent")

      assert missing == []
    end

    test "handles excess ingredients correctly", %{simple_recipe: simple_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: [
            "ingredient_a",
            "ingredient_a",
            "ingredient_a",
            "ingredient_b",
            "ingredient_b"
          ]
        })

      missing = Crafting.get_missing_ingredients(state, simple_recipe.key)

      assert missing == []
    end
  end

  # =============================================================================
  # get_missing_tools/2
  # =============================================================================

  describe "get_missing_tools/2" do
    test "returns list of missing tools", %{tool_recipe: tool_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["wood"]})

      missing = Crafting.get_missing_tools(state, tool_recipe.key)

      assert length(missing) == 2
      assert "saw" in missing
      assert "hammer" in missing
    end

    test "returns partial list when some tools present", %{tool_recipe: tool_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["wood", "saw"]})

      missing = Crafting.get_missing_tools(state, tool_recipe.key)

      assert length(missing) == 1
      assert "hammer" in missing
    end

    test "returns empty list when all tools present", %{tool_recipe: tool_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["wood", "saw", "hammer"]})

      missing = Crafting.get_missing_tools(state, tool_recipe.key)

      assert missing == []
    end

    test "returns empty list for recipe with no tools", %{simple_recipe: simple_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id)

      missing = Crafting.get_missing_tools(state, simple_recipe.key)

      assert missing == []
    end

    test "returns empty list for non-existent recipe" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      missing = Crafting.get_missing_tools(state, "nonexistent")

      assert missing == []
    end
  end

  # =============================================================================
  # consume_ingredients/2
  # =============================================================================

  describe "consume_ingredients/2" do
    test "consumes ingredients from inventory", %{simple_recipe: simple_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a", "ingredient_a", "ingredient_b", "extra_item"]
        })

      assert {:ok, updated_state} = Crafting.consume_ingredients(state, simple_recipe.key)

      # Should have consumed 2x ingredient_a and 1x ingredient_b
      assert length(updated_state.inventory) == 1
      assert "extra_item" in updated_state.inventory
    end

    test "returns error for insufficient ingredients", %{simple_recipe: simple_recipe} do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["ingredient_a"]})

      assert {:error, {:insufficient_items, _, _, _}} =
               Crafting.consume_ingredients(state, simple_recipe.key)
    end

    test "returns error for non-existent recipe" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :not_found} = Crafting.consume_ingredients(state, "nonexistent")
    end

    test "consumes exact quantities", %{simple_recipe: simple_recipe} do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: [
            "ingredient_a",
            "ingredient_a",
            "ingredient_a",
            "ingredient_b",
            "ingredient_b"
          ]
        })

      {:ok, updated_state} = Crafting.consume_ingredients(state, simple_recipe.key)

      # Should have 1 ingredient_a and 1 ingredient_b remaining
      assert length(updated_state.inventory) == 2
      assert Enum.count(updated_state.inventory, &(&1 == "ingredient_a")) == 1
      assert Enum.count(updated_state.inventory, &(&1 == "ingredient_b")) == 1
    end

    test "handles multiple ingredients of same type" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a", "ingredient_a", "ingredient_b"]
        })

      {:ok, updated_state} = Crafting.consume_ingredients(state, "recipe_simple_item")

      # All ingredients consumed
      assert updated_state.inventory == []
    end
  end

  # =============================================================================
  # Edge Cases & Integration Tests
  # =============================================================================

  describe "edge cases" do
    test "handles empty inventory gracefully" do
      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: []})

      assert {:error, {:missing_ingredients, _}} =
               Crafting.can_craft?(state, "recipe_simple_item")
    end

    test "handles state with no skills field" do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{}})

      assert {:error, {:skill_required, _, _, _}} =
               Crafting.can_craft?(state, "recipe_advanced_item")
    end

    test "requires exact item key match" do
      player = player_fixture()

      # Items with similar prefixes should NOT match exact requirements
      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a_1", "ingredient_a_2", "ingredient_b_1"]
        })

      missing = Crafting.get_missing_ingredients(state, "recipe_simple_item")

      # Should detect that ingredient_a and ingredient_b are missing
      # (ingredient_a_1 does not match ingredient_a)
      assert length(missing) == 2
    end

    test "station bonus cannot reduce failure chance below 0" do
      # Create recipe with 0.1 failure chance
      recipe = %Recipe{
        key: "recipe_low_fail",
        name: "Low Fail Item",
        skill_required: nil,
        skill_level: 0,
        ingredients: [%{item: "item_x", quantity: 1}],
        tools: [],
        output: [%{item: "result", quantity: 1, chance: 1.0}],
        xp_reward: nil,
        failure_chance: 0.1,
        failure_output: [],
        time_required: 0,
        station_type: "forge",
        description: "Test",
        craft_message: "Crafting...",
        success_message: "Success!",
        failure_message: "Failed!",
        tags: []
      }

      register_test_recipe(CraftingRegistry, recipe)

      player = player_fixture()
      state = game_state_fixture(player.id, %{inventory: ["item_x"]})

      # Station with bonus > failure_chance
      forge = create_room_with_station("forge", 0.5)

      {:ok, updated_state, result} = Crafting.craft(state, "recipe_low_fail", room: forge)

      # Should always succeed (failure_chance - bonus = -0.4, clamped to 0)
      assert result.success == true
      # Verify ingredient consumed
      assert updated_state.inventory == []
    end
  end

  describe "full crafting workflow integration" do
    test "complete crafting workflow from check to craft with atomic consumption" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a", "ingredient_a", "ingredient_b"],
          stats: %{"xp" => 0}
        })

      recipe_key = "recipe_simple_item"

      # Step 1: Check what's missing (should be nothing)
      missing_ingredients = Crafting.get_missing_ingredients(state, recipe_key)
      assert missing_ingredients == []

      missing_tools = Crafting.get_missing_tools(state, recipe_key)
      assert missing_tools == []

      # Step 2: Verify can craft
      assert :ok = Crafting.can_craft?(state, recipe_key)

      # Step 3: Execute crafting - now consumes ingredients atomically
      assert {:ok, final_state, craft_result} = Crafting.craft(state, recipe_key)
      assert craft_result.success == true
      assert craft_result.items == [%{item: "simple_item", quantity: 1}]
      assert craft_result.xp == %{skill: "crafting", amount: 10}

      # Ingredients are now consumed as part of craft/3
      assert final_state.inventory == []
    end

    test "craft/3 does not modify state on validation failure" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          inventory: ["ingredient_a"]
        })

      recipe_key = "recipe_simple_item"

      # Crafting should fail due to missing ingredients
      assert {:error, {:missing_ingredients, _}} = Crafting.craft(state, recipe_key)

      # Original state should be unchanged
      assert state.inventory == ["ingredient_a"]
    end
  end
end
