defmodule Loka.Content.RecipeTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Recipe
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "get/1" do
    test "returns recipe by key" do
      {:ok, recipe} =
        TypedObject.new(
          key: "test_recipe",
          type: :recipe,
          name: "Iron Sword",
          data: %{
            "ingredients" => [%{"item" => "iron_ore", "quantity" => 3}],
            "skill_required" => "blacksmithing",
            "station_type" => "forge",
            "output" => [%{"item" => "iron_sword", "quantity" => 1}]
          }
        )

      Registry.put("test_recipe", recipe)

      assert {:ok, fetched} = Recipe.get("test_recipe")
      assert fetched.key == "test_recipe"
    end

    test "returns error for non-recipe" do
      {:ok, entity} = TypedObject.new(key: "not_recipe", type: :entity)
      Registry.put("not_recipe", entity)

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

      {:ok, recipe} =
        TypedObject.new(
          key: "multi_ingredient",
          type: :recipe,
          data: %{"ingredients" => ingredients}
        )

      assert Recipe.ingredients(recipe) == ingredients
    end

    test "returns empty list when no ingredients" do
      {:ok, recipe} =
        TypedObject.new(
          key: "no_ingredients",
          type: :recipe,
          data: %{}
        )

      assert Recipe.ingredients(recipe) == []
    end
  end

  describe "skill_required/1" do
    test "returns required skill" do
      {:ok, recipe} =
        TypedObject.new(
          key: "skilled_recipe",
          type: :recipe,
          data: %{"skill_required" => "alchemy"}
        )

      assert Recipe.skill_required(recipe) == "alchemy"
    end

    test "returns nil when no skill required" do
      {:ok, recipe} =
        TypedObject.new(
          key: "no_skill_recipe",
          type: :recipe,
          data: %{}
        )

      assert Recipe.skill_required(recipe) == nil
    end
  end

  describe "station_type/1" do
    test "returns station type" do
      {:ok, recipe} =
        TypedObject.new(
          key: "station_recipe",
          type: :recipe,
          data: %{"station_type" => "alchemy_table"}
        )

      assert Recipe.station_type(recipe) == "alchemy_table"
    end

    test "returns nil when no station type" do
      {:ok, recipe} =
        TypedObject.new(
          key: "no_station_recipe",
          type: :recipe,
          data: %{}
        )

      assert Recipe.station_type(recipe) == nil
    end
  end

  describe "output/1" do
    test "returns output list" do
      output = [
        %{"item" => "healing_potion", "quantity" => 3}
      ]

      {:ok, recipe} =
        TypedObject.new(
          key: "output_recipe",
          type: :recipe,
          data: %{"output" => output}
        )

      assert Recipe.output(recipe) == output
    end

    test "returns empty list when no output" do
      {:ok, recipe} =
        TypedObject.new(
          key: "no_output_recipe",
          type: :recipe,
          data: %{}
        )

      assert Recipe.output(recipe) == []
    end
  end
end
