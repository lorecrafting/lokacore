defmodule Exmud.Framework.Crafting.CraftingRegistryTest do
  use ExUnit.Case, async: false

  alias Exmud.Framework.Crafting.CraftingRegistry

  @test_recipes_dir "test/fixtures/recipes"

  setup do
    # Create a unique registry for each test
    registry_name = :"registry_#{:erlang.unique_integer([:positive])}"

    # Clean up any existing test directory
    if File.exists?(@test_recipes_dir) do
      File.rm_rf!(@test_recipes_dir)
    end

    on_exit(fn ->
      # Clean up test directory
      if File.exists?(@test_recipes_dir) do
        File.rm_rf!(@test_recipes_dir)
      end
    end)

    {:ok, registry: registry_name}
  end

  describe "start_link/1" do
    test "starts registry with default options" do
      assert {:ok, pid} = CraftingRegistry.start_link(name: :test_registry_1, load_on_start: false)
      assert Process.alive?(pid)
      GenServer.stop(pid)
    end

    test "starts registry and loads recipes from path", %{registry: name} do
      create_test_recipe_file("health_potion.yml", """
      key: recipe_health_potion
      name: "Brew Health Potion"
      skill_required: alchemy
      skill_level: 2
      ingredients:
        - item: herb_healing
          quantity: 2
      output:
        - item: health_potion
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      assert Process.alive?(pid)
      assert {:ok, _recipe} = CraftingRegistry.get("recipe_health_potion", name)

      GenServer.stop(pid)
    end

    test "starts empty when path doesn't exist", %{registry: name} do
      {:ok, pid} = CraftingRegistry.start_link(
        name: name,
        path: "nonexistent/path",
        load_on_start: true
      )

      assert Process.alive?(pid)
      assert CraftingRegistry.count(name) == 0

      GenServer.stop(pid)
    end
  end

  describe "get/2" do
    test "returns recipe when it exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      assert {:ok, recipe} = CraftingRegistry.get("recipe_health_potion", name)
      assert recipe.key == "recipe_health_potion"
      assert recipe.name == "Brew Health Potion"
      assert recipe.skill_required == "alchemy"

      GenServer.stop(pid)
    end

    test "returns error when recipe not found", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      assert {:error, :not_found} = CraftingRegistry.get("nonexistent", name)

      GenServer.stop(pid)
    end
  end

  describe "get!/2" do
    test "returns recipe when it exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      recipe = CraftingRegistry.get!("recipe_health_potion", name)
      assert recipe.key == "recipe_health_potion"

      GenServer.stop(pid)
    end

    test "raises when recipe not found", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      assert_raise RuntimeError, "Recipe not found: nonexistent", fn ->
        CraftingRegistry.get!("nonexistent", name)
      end

      GenServer.stop(pid)
    end
  end

  describe "by_skill/2" do
    test "returns recipes requiring specified skill", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      alchemy_recipes = CraftingRegistry.by_skill("alchemy", name)

      assert length(alchemy_recipes) == 2
      assert Enum.all?(alchemy_recipes, &(&1.skill_required == "alchemy"))

      recipe_keys = Enum.map(alchemy_recipes, & &1.key) |> Enum.sort()
      assert recipe_keys == ["recipe_health_potion", "recipe_mana_potion"]

      GenServer.stop(pid)
    end

    test "returns empty list when no recipes require skill", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      recipes = CraftingRegistry.by_skill("unknown_skill", name)

      assert recipes == []

      GenServer.stop(pid)
    end

    test "returns recipes from specific skill only", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      blacksmithing_recipes = CraftingRegistry.by_skill("blacksmithing", name)

      assert length(blacksmithing_recipes) == 1
      assert hd(blacksmithing_recipes).key == "recipe_iron_sword"

      GenServer.stop(pid)
    end
  end

  describe "by_station/2" do
    test "returns recipes requiring specified station", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      forge_recipes = CraftingRegistry.by_station("forge", name)

      assert length(forge_recipes) == 1
      assert hd(forge_recipes).key == "recipe_iron_sword"

      GenServer.stop(pid)
    end

    test "returns empty list when no recipes use station", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      recipes = CraftingRegistry.by_station("unknown_station", name)

      assert recipes == []

      GenServer.stop(pid)
    end
  end

  describe "by_tag/2" do
    test "returns recipes with specified tag", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      potion_recipes = CraftingRegistry.by_tag("potion", name)

      assert length(potion_recipes) == 2
      recipe_keys = Enum.map(potion_recipes, & &1.key) |> Enum.sort()
      assert recipe_keys == ["recipe_health_potion", "recipe_mana_potion"]

      GenServer.stop(pid)
    end

    test "returns empty list when no recipes have tag", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      recipes = CraftingRegistry.by_tag("nonexistent_tag", name)

      assert recipes == []

      GenServer.stop(pid)
    end

    test "returns multiple recipes with same tag", %{registry: name} do
      create_test_recipe_file("basic_food.yml", """
      key: recipe_bread
      name: "Bake Bread"
      tags:
        - food
        - basic
      output:
        - item: bread
          quantity: 1
      """)

      create_test_recipe_file("advanced_food.yml", """
      key: recipe_cake
      name: "Bake Cake"
      tags:
        - food
        - advanced
      output:
        - item: cake
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      food_recipes = CraftingRegistry.by_tag("food", name)

      assert length(food_recipes) == 2
      recipe_keys = Enum.map(food_recipes, & &1.key) |> Enum.sort()
      assert recipe_keys == ["recipe_bread", "recipe_cake"]

      GenServer.stop(pid)
    end
  end

  describe "all/1" do
    test "returns all registered recipes", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      all_recipes = CraftingRegistry.all(name)

      assert length(all_recipes) == 3
      recipe_keys = Enum.map(all_recipes, & &1.key) |> Enum.sort()
      assert recipe_keys == ["recipe_health_potion", "recipe_iron_sword", "recipe_mana_potion"]

      GenServer.stop(pid)
    end

    test "returns empty list when no recipes registered", %{registry: name} do
      {:ok, pid} = CraftingRegistry.start_link(name: name, load_on_start: false)

      assert CraftingRegistry.all(name) == []

      GenServer.stop(pid)
    end
  end

  describe "count/1" do
    test "returns number of registered recipes", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      assert CraftingRegistry.count(name) == 3

      GenServer.stop(pid)
    end

    test "returns 0 when no recipes registered", %{registry: name} do
      {:ok, pid} = CraftingRegistry.start_link(name: name, load_on_start: false)

      assert CraftingRegistry.count(name) == 0

      GenServer.stop(pid)
    end
  end

  describe "exists?/2" do
    test "returns true when recipe exists", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      assert CraftingRegistry.exists?("recipe_health_potion", name)

      GenServer.stop(pid)
    end

    test "returns false when recipe does not exist", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      refute CraftingRegistry.exists?("nonexistent", name)

      GenServer.stop(pid)
    end
  end

  describe "reload/1" do
    test "reloads recipes from disk", %{registry: name} do
      create_test_recipe_file("recipe1.yml", """
      key: recipe1
      name: "Recipe 1"
      output:
        - item: item1
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      assert CraftingRegistry.count(name) == 1

      # Add another recipe file
      create_test_recipe_file("recipe2.yml", """
      key: recipe2
      name: "Recipe 2"
      output:
        - item: item2
          quantity: 1
      """)

      # Reload
      assert :ok = CraftingRegistry.reload(name)

      assert CraftingRegistry.count(name) == 2
      assert {:ok, _} = CraftingRegistry.get("recipe2", name)

      GenServer.stop(pid)
    end

    test "replaces existing recipes on reload", %{registry: name} do
      create_test_recipe_file("recipe1.yml", """
      key: recipe1
      name: "Original Name"
      skill_required: alchemy
      output:
        - item: item1
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      {:ok, original} = CraftingRegistry.get("recipe1", name)
      assert original.name == "Original Name"

      # Update the file
      create_test_recipe_file("recipe1.yml", """
      key: recipe1
      name: "Updated Name"
      skill_required: blacksmithing
      output:
        - item: item1
          quantity: 1
      """)

      assert :ok = CraftingRegistry.reload(name)

      {:ok, updated} = CraftingRegistry.get("recipe1", name)
      assert updated.name == "Updated Name"
      assert updated.skill_required == "blacksmithing"

      GenServer.stop(pid)
    end

    test "returns error when files have parse errors", %{registry: name} do
      create_test_recipe_file("valid.yml", """
      key: valid
      name: "Valid Recipe"
      output:
        - item: item1
          quantity: 1
      """)

      create_test_recipe_file("invalid.yml", """
      key: invalid
      # Missing required 'name' field
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      # Reload should return error due to invalid file
      result = CraftingRegistry.reload(name)

      assert {:error, errors} = result
      assert is_list(errors)
      assert length(errors) > 0

      GenServer.stop(pid)
    end
  end

  describe "load_from/2" do
    test "loads recipes from specified path", %{registry: name} do
      test_dir = "test/tmp/recipes_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "test_recipe.yml"), """
      key: test_recipe
      name: "Test Recipe"
      output:
        - item: test_item
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, load_on_start: false)

      assert :ok = CraftingRegistry.load_from(test_dir, name)
      assert {:ok, recipe} = CraftingRegistry.get("test_recipe", name)
      assert recipe.name == "Test Recipe"

      GenServer.stop(pid)
      File.rm_rf!(test_dir)
    end

    test "handles non-existent directory gracefully", %{registry: name} do
      {:ok, pid} = CraftingRegistry.start_link(name: name, load_on_start: false)

      assert :ok = CraftingRegistry.load_from("test/nonexistent", name)
      assert CraftingRegistry.count(name) == 0

      GenServer.stop(pid)
    end

    test "loads from nested directories", %{registry: name} do
      test_dir = "test/tmp/recipes_#{:erlang.unique_integer([:positive])}"
      nested_dir = Path.join(test_dir, "alchemy")
      File.mkdir_p!(nested_dir)

      File.write!(Path.join(nested_dir, "potion.yml"), """
      key: recipe_potion
      name: "Brew Potion"
      output:
        - item: potion
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, load_on_start: false)

      CraftingRegistry.load_from(test_dir, name)

      assert {:ok, recipe} = CraftingRegistry.get("recipe_potion", name)
      assert recipe.name == "Brew Potion"

      GenServer.stop(pid)
      File.rm_rf!(test_dir)
    end

    test "supports both .yml and .yaml extensions", %{registry: name} do
      test_dir = "test/tmp/recipes_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "recipe1.yml"), """
      key: recipe1
      name: "Recipe 1"
      output:
        - item: item1
          quantity: 1
      """)

      File.write!(Path.join(test_dir, "recipe2.yaml"), """
      key: recipe2
      name: "Recipe 2"
      output:
        - item: item2
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, load_on_start: false)

      CraftingRegistry.load_from(test_dir, name)

      assert {:ok, _} = CraftingRegistry.get("recipe1", name)
      assert {:ok, _} = CraftingRegistry.get("recipe2", name)
      assert CraftingRegistry.count(name) == 2

      GenServer.stop(pid)
      File.rm_rf!(test_dir)
    end

    test "returns error for invalid YAML", %{registry: name} do
      test_dir = "test/tmp/recipes_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      File.write!(Path.join(test_dir, "invalid.yml"), """
      key: invalid
      # Missing required 'name' field
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, load_on_start: false)

      result = CraftingRegistry.load_from(test_dir, name)
      assert {:error, errors} = result
      assert is_list(errors)
      assert length(errors) > 0

      GenServer.stop(pid)
      File.rm_rf!(test_dir)
    end
  end

  describe "available_for/2" do
    test "returns recipes player can craft based on skill levels", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      game_state = %{
        stats: %{
          "skills" => %{
            "alchemy" => 5,
            "blacksmithing" => 1
          }
        }
      }

      available = CraftingRegistry.available_for(game_state, name)

      # Player has alchemy 5 (can craft both alchemy recipes requiring level 2)
      # Player has blacksmithing 1 (cannot craft iron sword requiring level 3)
      assert length(available) == 2
      recipe_keys = Enum.map(available, & &1.key) |> Enum.sort()
      assert recipe_keys == ["recipe_health_potion", "recipe_mana_potion"]

      GenServer.stop(pid)
    end

    test "returns all recipes when player has no skills", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      game_state = %{stats: %{"skills" => %{}}}

      available = CraftingRegistry.available_for(game_state, name)

      # Only recipes without skill requirements should be available
      assert Enum.all?(available, &(&1.skill_required == nil or &1.skill_level == 0))

      GenServer.stop(pid)
    end

    test "handles game state with atom key skills", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      game_state = %{
        stats: %{
          skills: %{
            alchemy: 10,
            blacksmithing: 5
          }
        }
      }

      available = CraftingRegistry.available_for(game_state, name)

      # Player should be able to craft all recipes with sufficient skills
      assert length(available) == 3

      GenServer.stop(pid)
    end

    test "returns recipes without skill requirements", %{registry: name} do
      create_test_recipe_file("no_skill.yml", """
      key: recipe_no_skill
      name: "Basic Recipe"
      output:
        - item: basic_item
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      game_state = %{stats: %{"skills" => %{}}}

      available = CraftingRegistry.available_for(game_state, name)

      # Should include recipes without skill requirements
      assert Enum.any?(available, &(&1.key == "recipe_no_skill"))

      GenServer.stop(pid)
    end
  end

  describe "using_ingredient/2" do
    test "finds recipes that use specific ingredient", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      recipes = CraftingRegistry.using_ingredient("herb_healing", name)

      assert length(recipes) == 1
      assert hd(recipes).key == "recipe_health_potion"

      GenServer.stop(pid)
    end

    test "returns empty list when no recipes use ingredient", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      recipes = CraftingRegistry.using_ingredient("unknown_item", name)

      assert recipes == []

      GenServer.stop(pid)
    end

    test "finds multiple recipes using same ingredient", %{registry: name} do
      create_test_recipe_file("potion1.yml", """
      key: recipe_potion1
      name: "Potion 1"
      ingredients:
        - item: water
          quantity: 1
      output:
        - item: potion1
          quantity: 1
      """)

      create_test_recipe_file("potion2.yml", """
      key: recipe_potion2
      name: "Potion 2"
      ingredients:
        - item: water
          quantity: 2
      output:
        - item: potion2
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      recipes = CraftingRegistry.using_ingredient("water", name)

      assert length(recipes) == 2
      recipe_keys = Enum.map(recipes, & &1.key) |> Enum.sort()
      assert recipe_keys == ["recipe_potion1", "recipe_potion2"]

      GenServer.stop(pid)
    end
  end

  describe "producing/2" do
    test "finds recipes that produce specific item", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      recipes = CraftingRegistry.producing("health_potion", name)

      assert length(recipes) == 1
      assert hd(recipes).key == "recipe_health_potion"

      GenServer.stop(pid)
    end

    test "returns empty list when no recipes produce item", %{registry: name} do
      {:ok, pid} = start_registry_with_test_recipes(name)

      recipes = CraftingRegistry.producing("unknown_item", name)

      assert recipes == []

      GenServer.stop(pid)
    end

    test "finds multiple recipes producing same item", %{registry: name} do
      create_test_recipe_file("sword1.yml", """
      key: recipe_cheap_sword
      name: "Cheap Sword"
      output:
        - item: basic_sword
          quantity: 1
      """)

      create_test_recipe_file("sword2.yml", """
      key: recipe_quality_sword
      name: "Quality Sword"
      output:
        - item: basic_sword
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      recipes = CraftingRegistry.producing("basic_sword", name)

      assert length(recipes) == 2
      recipe_keys = Enum.map(recipes, & &1.key) |> Enum.sort()
      assert recipe_keys == ["recipe_cheap_sword", "recipe_quality_sword"]

      GenServer.stop(pid)
    end
  end

  describe "YAML loading" do
    test "loads recipe with all fields", %{registry: name} do
      create_test_recipe_file("full_recipe.yml", """
      key: full_recipe
      name: "Full Recipe"
      skill_required: alchemy
      skill_level: 5
      ingredients:
        - item: herb
          quantity: 3
        - item: water
          quantity: 1
      tools:
        - alchemy_kit
        - mortar_pestle
      output:
        - item: potion
          quantity: 2
          chance: 0.9
      xp_reward:
        skill: alchemy
        amount: 25
      failure_chance: 0.15
      failure_output:
        - item: ruined_potion
          quantity: 1
      time_required: 30
      station_type: alchemy_bench
      description: "A complex alchemy recipe"
      craft_message: "You begin mixing ingredients..."
      success_message: "You created a perfect potion!"
      failure_message: "The mixture explodes!"
      tags:
        - advanced
        - alchemy
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      {:ok, recipe} = CraftingRegistry.get("full_recipe", name)

      assert recipe.key == "full_recipe"
      assert recipe.name == "Full Recipe"
      assert recipe.skill_required == "alchemy"
      assert recipe.skill_level == 5
      assert length(recipe.ingredients) == 2
      assert length(recipe.tools) == 2
      assert length(recipe.output) == 1
      assert recipe.xp_reward == %{skill: "alchemy", amount: 25}
      assert recipe.failure_chance == 0.15
      assert length(recipe.failure_output) == 1
      assert recipe.time_required == 30
      assert recipe.station_type == "alchemy_bench"
      assert recipe.description == "A complex alchemy recipe"
      assert recipe.craft_message == "You begin mixing ingredients..."
      assert recipe.success_message == "You created a perfect potion!"
      assert recipe.failure_message == "The mixture explodes!"
      assert recipe.tags == ["advanced", "alchemy"]

      GenServer.stop(pid)
    end

    test "loads recipe with minimal fields", %{registry: name} do
      create_test_recipe_file("minimal.yml", """
      key: minimal
      name: "Minimal Recipe"
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      {:ok, recipe} = CraftingRegistry.get("minimal", name)

      assert recipe.key == "minimal"
      assert recipe.name == "Minimal Recipe"
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

      GenServer.stop(pid)
    end
  end

  describe "edge cases" do
    test "handles recipe with multiple ingredients of same item", %{registry: name} do
      create_test_recipe_file("complex.yml", """
      key: complex_recipe
      name: "Complex Recipe"
      ingredients:
        - item: herb
          quantity: 5
        - item: water
          quantity: 2
        - item: salt
          quantity: 1
      output:
        - item: mixture
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      {:ok, recipe} = CraftingRegistry.get("complex_recipe", name)
      assert length(recipe.ingredients) == 3

      GenServer.stop(pid)
    end

    test "handles recipe with multiple outputs", %{registry: name} do
      create_test_recipe_file("multi_output.yml", """
      key: multi_output
      name: "Multi Output Recipe"
      output:
        - item: item1
          quantity: 2
        - item: item2
          quantity: 1
          chance: 0.5
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      {:ok, recipe} = CraftingRegistry.get("multi_output", name)
      assert length(recipe.output) == 2

      GenServer.stop(pid)
    end

    test "handles recipe with no ingredients", %{registry: name} do
      create_test_recipe_file("no_ingredients.yml", """
      key: no_ingredients
      name: "No Ingredients Recipe"
      output:
        - item: magical_item
          quantity: 1
      """)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: @test_recipes_dir)

      {:ok, recipe} = CraftingRegistry.get("no_ingredients", name)
      assert recipe.ingredients == []

      GenServer.stop(pid)
    end

    test "handles empty recipe directory", %{registry: name} do
      test_dir = "test/tmp/empty_#{:erlang.unique_integer([:positive])}"
      File.mkdir_p!(test_dir)

      {:ok, pid} = CraftingRegistry.start_link(name: name, path: test_dir)

      assert CraftingRegistry.count(name) == 0
      assert CraftingRegistry.all(name) == []

      GenServer.stop(pid)
      File.rm_rf!(test_dir)
    end
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp create_test_recipe_file(filename, content) do
    File.mkdir_p!(@test_recipes_dir)
    File.write!(Path.join(@test_recipes_dir, filename), content)
  end

  defp start_registry_with_test_recipes(name) do
    create_test_recipe_file("health_potion.yml", """
    key: recipe_health_potion
    name: "Brew Health Potion"
    skill_required: alchemy
    skill_level: 2
    ingredients:
      - item: herb_healing
        quantity: 2
      - item: water_flask
        quantity: 1
    tools:
      - alchemy_kit
    output:
      - item: health_potion
        quantity: 1
    xp_reward:
      skill: alchemy
      amount: 10
    failure_chance: 0.1
    tags:
      - potion
      - healing
    """)

    create_test_recipe_file("mana_potion.yml", """
    key: recipe_mana_potion
    name: "Brew Mana Potion"
    skill_required: alchemy
    skill_level: 2
    ingredients:
      - item: herb_mana
        quantity: 2
      - item: water_flask
        quantity: 1
    output:
      - item: mana_potion
        quantity: 1
    tags:
      - potion
      - mana
    """)

    create_test_recipe_file("iron_sword.yml", """
    key: recipe_iron_sword
    name: "Forge Iron Sword"
    skill_required: blacksmithing
    skill_level: 3
    ingredients:
      - item: iron_bar
        quantity: 3
      - item: leather_strip
        quantity: 1
    tools:
      - blacksmith_hammer
    output:
      - item: iron_sword
        quantity: 1
    station_type: forge
    time_required: 60
    xp_reward:
      skill: blacksmithing
      amount: 25
    """)

    CraftingRegistry.start_link(name: name, path: @test_recipes_dir)
  end
end
