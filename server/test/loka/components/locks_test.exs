defmodule Loka.Components.LocksTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Locks
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :room, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Locks.component_key() == "locks"
    refute Locks.has?(entity())

    e = Locks.put(entity(), %{"enter" => "admin"})
    assert Locks.has?(e)
    assert Locks.get(e) == %{"enter" => "admin"}
  end
end
