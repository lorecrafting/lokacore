defmodule Loka.Components.WeaponTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Weapon
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :item, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Weapon.component_key() == "weapon"
    refute Weapon.has?(entity())

    e = Weapon.put(entity(), %{"damage" => 10})
    assert Weapon.has?(e)
  end

  test "damage/weapon_type/speed" do
    e = entity(%{"weapon" => %{"damage" => 15, "type" => "sword", "speed" => 1.5}})
    assert Weapon.damage(e) == 15
    assert Weapon.weapon_type(e) == "sword"
    assert Weapon.speed(e) == 1.5
  end

  test "defaults" do
    e = entity()
    assert Weapon.damage(e) == 0
    assert Weapon.weapon_type(e) == nil
    assert Weapon.speed(e) == 1.0
  end
end
