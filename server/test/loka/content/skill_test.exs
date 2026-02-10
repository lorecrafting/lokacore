defmodule Loka.Content.SkillTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Skill
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "get/1" do
    test "returns skill by key" do
      {:ok, skill} =
        TypedObject.new(
          key: "test_skill",
          type: :skill,
          name: "Mining",
          data: %{
            "category" => "gathering",
            "max_level" => 50,
            "prerequisites" => []
          }
        )

      Registry.put("test_skill", skill)

      assert {:ok, fetched} = Skill.get("test_skill")
      assert fetched.key == "test_skill"
    end

    test "returns error for non-skill" do
      {:ok, entity} = TypedObject.new(key: "not_skill", type: :entity)
      Registry.put("not_skill", entity)

      assert {:error, :not_found} = Skill.get("not_skill")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Skill.get("missing")
    end
  end

  describe "max_level/1" do
    test "returns configured max level" do
      {:ok, skill} =
        TypedObject.new(
          key: "capped_skill",
          type: :skill,
          data: %{"max_level" => 75}
        )

      assert Skill.max_level(skill) == 75
    end

    test "defaults to 100" do
      {:ok, skill} =
        TypedObject.new(
          key: "default_level",
          type: :skill,
          data: %{}
        )

      assert Skill.max_level(skill) == 100
    end
  end

  describe "prerequisites/1" do
    test "returns prerequisites list" do
      prereqs = [
        %{"skill" => "mining", "level" => 10},
        %{"skill" => "strength", "level" => 5}
      ]

      {:ok, skill} =
        TypedObject.new(
          key: "advanced_skill",
          type: :skill,
          data: %{"prerequisites" => prereqs}
        )

      assert Skill.prerequisites(skill) == prereqs
    end

    test "returns empty list when no prerequisites" do
      {:ok, skill} =
        TypedObject.new(
          key: "basic_skill",
          type: :skill,
          data: %{}
        )

      assert Skill.prerequisites(skill) == []
    end
  end

  describe "category/1" do
    test "returns category" do
      {:ok, skill} =
        TypedObject.new(
          key: "categorized_skill",
          type: :skill,
          data: %{"category" => "combat"}
        )

      assert Skill.category(skill) == "combat"
    end

    test "defaults to general" do
      {:ok, skill} =
        TypedObject.new(
          key: "no_category",
          type: :skill,
          data: %{}
        )

      assert Skill.category(skill) == "general"
    end
  end
end
