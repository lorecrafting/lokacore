defmodule Loka.Components.EmotesTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Emotes
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :npc, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Emotes.component_key() == "emotes"
    refute Emotes.has?(entity())

    e = Emotes.put(entity(), %{"greeting" => "Hello!"})
    assert Emotes.has?(e)
  end

  test "idle/combat/greeting" do
    e =
      entity(%{
        "emotes" => %{
          "idle" => ["yawns", "stretches"],
          "combat" => ["roars"],
          "greeting" => "Hello!"
        }
      })

    assert Emotes.idle(e) == ["yawns", "stretches"]
    assert Emotes.combat(e) == ["roars"]
    assert Emotes.greeting(e) == "Hello!"
  end

  test "defaults" do
    e = entity()
    assert Emotes.idle(e) == []
    assert Emotes.combat(e) == []
    assert Emotes.greeting(e) == nil
  end
end
