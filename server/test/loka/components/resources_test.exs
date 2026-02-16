defmodule Loka.Components.ResourcesTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Resources
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :character, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Resources.component_key() == "resources"
    refute Resources.has?(entity())

    e = Resources.put(entity(), %{"gold" => 50})
    assert Resources.has?(e)
  end

  test "gold/xp/mana" do
    e = entity(%{"resources" => %{"gold" => 100, "xp" => 500, "mana" => 30}})
    assert Resources.gold(e) == 100
    assert Resources.xp(e) == 500
    assert Resources.mana(e) == 30
  end

  test "defaults to 0" do
    e = entity()
    assert Resources.gold(e) == 0
    assert Resources.xp(e) == 0
    assert Resources.mana(e) == 0
  end
end
