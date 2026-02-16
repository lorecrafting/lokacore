defmodule Loka.Components.StatsTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Stats
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :npc, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Stats.component_key() == "stats"
    refute Stats.has?(entity())

    e = Stats.put(entity(), %{"str" => 10})
    assert Stats.has?(e)
    assert Stats.get(e) == %{"str" => 10}
  end

  test "str/dex/sta/level" do
    e = entity(%{"stats" => %{"str" => 10, "dex" => 8, "sta" => 12, "level" => 5}})
    assert Stats.str(e) == 10
    assert Stats.dex(e) == 8
    assert Stats.sta(e) == 12
    assert Stats.level(e) == 5
  end

  test "defaults" do
    e = entity()
    assert Stats.str(e) == 0
    assert Stats.dex(e) == 0
    assert Stats.sta(e) == 0
    assert Stats.level(e) == 1
  end
end
