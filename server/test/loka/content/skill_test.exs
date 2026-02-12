defmodule Loka.Content.SkillTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Skill
  alias Loka.Engine.{Entity, Entities}

  defp create_skill(key, data, opts \\ []) do
    entity =
      Entity.new(
        type: :skill,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns skill by key" do
      create_skill(
        "test_skill",
        %{
          "category" => "gathering",
          "max_level" => 50,
          "prerequisites" => []
        }, name: "Mining")

      assert {:ok, fetched} = Skill.get("test_skill")
      assert fetched.key == "test_skill"
    end

    test "returns error for non-skill" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_skill",
          short_desc: "Not a skill",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = Skill.get("not_skill")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Skill.get("missing")
    end
  end

  describe "max_level/1" do
    test "returns configured max level" do
      entity = create_skill("capped_skill", %{"max_level" => 75})
      {:ok, skill} = Entity.to_typed_object(entity)

      assert Skill.max_level(skill) == 75
    end

    test "defaults to 100" do
      entity = create_skill("default_level", %{})
      {:ok, skill} = Entity.to_typed_object(entity)

      assert Skill.max_level(skill) == 100
    end
  end

  describe "prerequisites/1" do
    test "returns prerequisites list" do
      prereqs = [
        %{"skill" => "mining", "level" => 10},
        %{"skill" => "strength", "level" => 5}
      ]

      entity = create_skill("advanced_skill", %{"prerequisites" => prereqs})
      {:ok, skill} = Entity.to_typed_object(entity)

      assert Skill.prerequisites(skill) == prereqs
    end

    test "returns empty list when no prerequisites" do
      entity = create_skill("basic_skill", %{})
      {:ok, skill} = Entity.to_typed_object(entity)

      assert Skill.prerequisites(skill) == []
    end
  end

  describe "category/1" do
    test "returns category" do
      entity = create_skill("categorized_skill", %{"category" => "combat"})
      {:ok, skill} = Entity.to_typed_object(entity)

      assert Skill.category(skill) == "combat"
    end

    test "defaults to general" do
      entity = create_skill("no_category", %{})
      {:ok, skill} = Entity.to_typed_object(entity)

      assert Skill.category(skill) == "general"
    end
  end
end
