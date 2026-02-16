defmodule Loka.Components.QuestDefTest do
  use ExUnit.Case, async: true

  alias Loka.Components.QuestDef
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :quest, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert QuestDef.component_key() == "quest"
    refute QuestDef.has?(entity())

    e = QuestDef.put(entity(), %{"giver" => "npc_1"})
    assert QuestDef.has?(e)
  end

  test "objectives/rewards/giver" do
    e =
      entity(%{
        "quest" => %{
          "objectives" => [%{"type" => "kill"}],
          "rewards" => %{"xp" => 100},
          "giver" => "npc_1"
        }
      })

    assert QuestDef.objectives(e) == [%{"type" => "kill"}]
    assert QuestDef.rewards(e) == %{"xp" => 100}
    assert QuestDef.giver(e) == "npc_1"
  end

  test "defaults" do
    e = entity()
    assert QuestDef.objectives(e) == []
    assert QuestDef.rewards(e) == %{}
    assert QuestDef.giver(e) == nil
  end
end
