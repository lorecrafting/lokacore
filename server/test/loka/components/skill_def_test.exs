defmodule Loka.Components.SkillDefTest do
  use ExUnit.Case, async: true

  alias Loka.Components.SkillDef
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :skill, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert SkillDef.component_key() == "skill_def"
    refute SkillDef.has?(entity())

    e = SkillDef.put(entity(), %{"cooldown" => 5})
    assert SkillDef.has?(e)
  end

  test "cooldown/cost/effects" do
    e =
      entity(%{
        "skill_def" => %{"cooldown" => 3, "cost" => %{"mana" => 10}, "effects" => ["stun"]}
      })

    assert SkillDef.cooldown(e) == 3
    assert SkillDef.cost(e) == %{"mana" => 10}
    assert SkillDef.effects(e) == ["stun"]
  end

  test "defaults" do
    e = entity()
    assert SkillDef.cooldown(e) == 0
    assert SkillDef.cost(e) == %{}
    assert SkillDef.effects(e) == []
  end
end
