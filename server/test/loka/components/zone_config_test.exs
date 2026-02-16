defmodule Loka.Components.ZoneConfigTest do
  use ExUnit.Case, async: true

  alias Loka.Components.ZoneConfig
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :zone, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert ZoneConfig.component_key() == "zone"
    refute ZoneConfig.has?(entity())

    e = ZoneConfig.put(entity(), %{"theme" => "forest"})
    assert ZoneConfig.has?(e)
  end

  test "level_range/theme" do
    e = entity(%{"zone" => %{"level_range" => [1, 10], "theme" => "forest"}})
    assert ZoneConfig.level_range(e) == [1, 10]
    assert ZoneConfig.theme(e) == "forest"
  end

  test "defaults to nil" do
    e = entity()
    assert ZoneConfig.level_range(e) == nil
    assert ZoneConfig.theme(e) == nil
  end
end
