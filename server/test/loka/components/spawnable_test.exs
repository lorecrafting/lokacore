defmodule Loka.Components.SpawnableTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Spawnable
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :npc, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Spawnable.component_key() == "spawnable"
    refute Spawnable.has?(entity())

    e = Spawnable.put(entity(), %{"respawn_time" => 60})
    assert Spawnable.has?(e)
  end

  test "respawn_time/max_instances" do
    e = entity(%{"spawnable" => %{"respawn_time" => 120, "max_instances" => 3}})
    assert Spawnable.respawn_time(e) == 120
    assert Spawnable.max_instances(e) == 3
  end

  test "defaults" do
    e = entity()
    assert Spawnable.respawn_time(e) == 0
    assert Spawnable.max_instances(e) == 1
  end
end
