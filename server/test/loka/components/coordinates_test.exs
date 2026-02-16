defmodule Loka.Components.CoordinatesTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Coordinates
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :room, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Coordinates.component_key() == "coordinates"
    refute Coordinates.has?(entity())

    e = Coordinates.put(entity(), %{"x" => 1, "y" => 2, "z" => 3})
    assert Coordinates.has?(e)
  end

  test "x/y/z" do
    e = entity(%{"coordinates" => %{"x" => 5, "y" => 10, "z" => -1}})
    assert Coordinates.x(e) == 5
    assert Coordinates.y(e) == 10
    assert Coordinates.z(e) == -1
  end

  test "defaults to 0" do
    e = entity()
    assert Coordinates.x(e) == 0
    assert Coordinates.y(e) == 0
    assert Coordinates.z(e) == 0
  end
end
