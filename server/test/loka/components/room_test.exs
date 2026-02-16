defmodule Loka.Components.RoomTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Room
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :room, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Room.component_key() == "room"
    refute Room.has?(entity())

    e = Room.put(entity(), %{"spawns" => ["goblin"]})
    assert Room.has?(e)
  end

  test "spawns/1" do
    e = entity(%{"room" => %{"spawns" => ["goblin", "rat"]}})
    assert Room.spawns(e) == ["goblin", "rat"]
  end

  test "spawns defaults to empty list" do
    assert Room.spawns(entity()) == []
  end
end
