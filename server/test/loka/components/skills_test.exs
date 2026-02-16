defmodule Loka.Components.SkillsTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Skills
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :character, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Skills.component_key() == "skills"
    refute Skills.has?(entity())

    e = Skills.put(entity(), %{"learned" => ["kick"]})
    assert Skills.has?(e)
  end

  test "learned/1" do
    e = entity(%{"skills" => %{"learned" => ["kick", "sneak"]}})
    assert Skills.learned(e) == ["kick", "sneak"]
  end

  test "learned defaults to empty list" do
    assert Skills.learned(entity()) == []
  end
end
