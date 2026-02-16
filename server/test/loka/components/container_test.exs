defmodule Loka.Components.ContainerTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Container
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :item, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Container.component_key() == "container"
    refute Container.has?(entity())

    e = Container.put(entity(), %{"capacity" => 10})
    assert Container.has?(e)
  end

  test "capacity/locked?" do
    e = entity(%{"container" => %{"capacity" => 20, "locked" => true}})
    assert Container.capacity(e) == 20
    assert Container.locked?(e)
  end

  test "defaults" do
    e = entity()
    assert Container.capacity(e) == 0
    refute Container.locked?(e)
  end
end
