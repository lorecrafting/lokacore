defmodule Loka.Components.ArmorTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Armor
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :item, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Armor.component_key() == "armor"
    refute Armor.has?(entity())

    e = Armor.put(entity(), %{"defense" => 5})
    assert Armor.has?(e)
  end

  test "defense/armor_type" do
    e = entity(%{"armor" => %{"defense" => 8, "type" => "leather"}})
    assert Armor.defense(e) == 8
    assert Armor.armor_type(e) == "leather"
  end

  test "defaults" do
    e = entity()
    assert Armor.defense(e) == 0
    assert Armor.armor_type(e) == nil
  end
end
