defmodule Loka.Components.RecipeDefTest do
  use ExUnit.Case, async: true

  alias Loka.Components.RecipeDef
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :recipe, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert RecipeDef.component_key() == "recipe"
    refute RecipeDef.has?(entity())

    e = RecipeDef.put(entity(), %{"ingredients" => ["iron"]})
    assert RecipeDef.has?(e)
  end

  test "ingredients/output" do
    e = entity(%{"recipe" => %{"ingredients" => ["iron", "wood"], "output" => "sword"}})
    assert RecipeDef.ingredients(e) == ["iron", "wood"]
    assert RecipeDef.output(e) == "sword"
  end

  test "defaults" do
    e = entity()
    assert RecipeDef.ingredients(e) == []
    assert RecipeDef.output(e) == nil
  end
end
