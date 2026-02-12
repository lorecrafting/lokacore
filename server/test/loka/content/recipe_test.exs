defmodule Loka.Content.RecipeTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Recipe
  alias Loka.Engine.{Entity, Entities}

  defp create_recipe(key, data, opts \\ []) do
    entity =
      Entity.new(
        type: :recipe,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns recipe by key" do
      create_recipe(
        "test_recipe",
        %{
          "ingredients" => [%{"item" => "iron_ore", "quantity" => 3}],
          "skill_required" => "blacksmithing",
          "station_type" => "forge",
          "output" => [%{"item" => "iron_sword", "quantity" => 1}]
        }, name: "Iron Sword")

      assert {:ok, fetched} = Recipe.get("test_recipe")
      assert fetched.key == "test_recipe"
    end

    test "returns error for non-recipe" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_recipe",
          short_desc: "Not a recipe",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = Recipe.get("not_recipe")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Recipe.get("missing")
    end
  end

  describe "ingredients/1" do
    test "returns ingredients list" do
      ingredients = [
        %{"item" => "iron_ore", "quantity" => 3},
        %{"item" => "coal", "quantity" => 1},
        %{"item" => "leather_strip", "quantity" => 2}
      ]

      entity = create_recipe("multi_ingredient", %{"ingredients" => ingredients})
      {:ok, recipe} = Entity.to_typed_object(entity)

      assert Recipe.ingredients(recipe) == ingredients
    end

    test "returns empty list when no ingredients" do
      entity = create_recipe("no_ingredients", %{})
      {:ok, recipe} = Entity.to_typed_object(entity)

      assert Recipe.ingredients(recipe) == []
    end
  end

  describe "skill_required/1" do
    test "returns required skill" do
      entity = create_recipe("skilled_recipe", %{"skill_required" => "alchemy"})
      {:ok, recipe} = Entity.to_typed_object(entity)

      assert Recipe.skill_required(recipe) == "alchemy"
    end

    test "returns nil when no skill required" do
      entity = create_recipe("no_skill_recipe", %{})
      {:ok, recipe} = Entity.to_typed_object(entity)

      assert Recipe.skill_required(recipe) == nil
    end
  end

  describe "station_type/1" do
    test "returns station type" do
      entity = create_recipe("station_recipe", %{"station_type" => "alchemy_table"})
      {:ok, recipe} = Entity.to_typed_object(entity)

      assert Recipe.station_type(recipe) == "alchemy_table"
    end

    test "returns nil when no station type" do
      entity = create_recipe("no_station_recipe", %{})
      {:ok, recipe} = Entity.to_typed_object(entity)

      assert Recipe.station_type(recipe) == nil
    end
  end

  describe "output/1" do
    test "returns output list" do
      output = [
        %{"item" => "healing_potion", "quantity" => 3}
      ]

      entity = create_recipe("output_recipe", %{"output" => output})
      {:ok, recipe} = Entity.to_typed_object(entity)

      assert Recipe.output(recipe) == output
    end

    test "returns empty list when no output" do
      entity = create_recipe("no_output_recipe", %{})
      {:ok, recipe} = Entity.to_typed_object(entity)

      assert Recipe.output(recipe) == []
    end
  end
end
