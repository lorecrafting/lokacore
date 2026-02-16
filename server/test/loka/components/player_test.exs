defmodule Loka.Components.PlayerTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Player
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :character, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Player.component_key() == "player"
    refute Player.has?(entity())

    e = Player.put(entity(), %{"character_name" => "Hero"})
    assert Player.has?(e)
    assert Player.get(e) == %{"character_name" => "Hero"}
  end

  test "character_name/1" do
    e = entity(%{"player" => %{"character_name" => "Hero"}})
    assert Player.character_name(e) == "Hero"
  end

  test "settings/1 defaults to empty map" do
    assert Player.settings(entity()) == %{}
    e = entity(%{"player" => %{"settings" => %{"color" => true}}})
    assert Player.settings(e) == %{"color" => true}
  end
end
