defmodule Loka.Components.EquipmentTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Equipment
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :character, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Equipment.component_key() == "equipment"
    refute Equipment.has?(entity())

    e = Equipment.put(entity(), %{"weapon" => "uuid-1"})
    assert Equipment.has?(e)
  end

  test "slot/2" do
    e = entity(%{"equipment" => %{"weapon" => "uuid-1", "armor" => "uuid-2"}})
    assert Equipment.slot(e, "weapon") == "uuid-1"
    assert Equipment.slot(e, "armor") == "uuid-2"
    assert Equipment.slot(e, "shield") == nil
  end
end
