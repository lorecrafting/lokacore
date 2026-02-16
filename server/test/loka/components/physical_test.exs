defmodule Loka.Components.PhysicalTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Physical
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :item, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Physical.component_key() == "physical"
    refute Physical.has?(entity())

    e = Physical.put(entity(), %{"weight" => 5})
    assert Physical.has?(e)
  end

  test "weight/1" do
    e = entity(%{"physical" => %{"weight" => 3}})
    assert Physical.weight(e) == 3
  end

  test "stackable?/1" do
    refute Physical.stackable?(entity())
    refute Physical.stackable?(entity(%{"physical" => %{"stackable" => false}}))
    assert Physical.stackable?(entity(%{"physical" => %{"stackable" => true}}))
  end
end
