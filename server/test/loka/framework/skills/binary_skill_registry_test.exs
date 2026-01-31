defmodule Loka.Framework.Skills.BinarySkillRegistryTest do
  use Loka.DataCase, async: false

  alias Loka.Framework.Skills.{BinarySkillRegistry, BinarySkill}

  @moduletag :capture_log

  describe "basic operations" do
    test "count returns number of loaded skills" do
      count = BinarySkillRegistry.count()
      assert count > 0
    end

    test "all returns list of skills" do
      skills = BinarySkillRegistry.all()
      assert is_list(skills)
      assert length(skills) > 0
      assert Enum.all?(skills, fn s -> is_struct(s, BinarySkill) end)
    end

    test "get returns skill by key" do
      {:ok, skill} = BinarySkillRegistry.get("kick")
      assert skill.key == "kick"
      assert skill.name == "Kick"
      assert skill.category == :combat_melee
    end

    test "get returns error for non-existent skill" do
      assert {:error, :not_found} = BinarySkillRegistry.get("nonexistent_skill")
    end

    test "get! raises for non-existent skill" do
      assert_raise RuntimeError, ~r/not found/, fn ->
        BinarySkillRegistry.get!("nonexistent_skill")
      end
    end

    test "exists? returns true for existing skill" do
      assert BinarySkillRegistry.exists?("kick")
    end

    test "exists? returns false for non-existent skill" do
      refute BinarySkillRegistry.exists?("nonexistent_skill")
    end
  end

  describe "query functions" do
    test "by_category returns skills in category" do
      melee_skills = BinarySkillRegistry.by_category(:combat_melee)
      assert length(melee_skills) > 0
      assert Enum.all?(melee_skills, fn s -> s.category == :combat_melee end)
    end

    test "by_category with string works" do
      melee_skills = BinarySkillRegistry.by_category("combat_melee")
      assert length(melee_skills) > 0
    end

    test "by_stat returns skills with governing stat" do
      str_skills = BinarySkillRegistry.by_stat(:str)
      assert length(str_skills) > 0
      assert Enum.all?(str_skills, fn s -> s.stat == :str end)
    end

    test "by_trainer returns skills taught by trainer" do
      trainer_skills = BinarySkillRegistry.by_trainer("monastery_martial_master")
      assert length(trainer_skills) > 0
      assert Enum.all?(trainer_skills, fn s -> "monastery_martial_master" in s.trainers end)
    end
  end

  describe "skill data integrity" do
    test "kick skill has correct data" do
      {:ok, kick} = BinarySkillRegistry.get("kick")

      assert kick.key == "kick"
      assert kick.name == "Kick"
      assert kick.category == :combat_melee
      assert kick.cost == 1
      assert kick.stat == :str
      assert kick.lag > 0
      assert "combat_trainer" in kick.trainers or "monastery_martial_master" in kick.trainers
    end

    test "meditate skill has correct data" do
      {:ok, meditate} = BinarySkillRegistry.get("meditate")

      assert meditate.key == "meditate"
      assert meditate.category == :magic_utility
      assert meditate.stat == :spi
    end

    test "all skills have required fields" do
      skills = BinarySkillRegistry.all()

      for skill <- skills do
        assert skill.key != nil, "Skill missing key"
        assert skill.name != nil, "Skill #{skill.key} missing name"
        assert skill.category != nil, "Skill #{skill.key} missing category"
        assert skill.cost >= 1 and skill.cost <= 3, "Skill #{skill.key} has invalid cost"

        assert skill.stat in [:str, :dex, :con, :int, :per, :spi],
               "Skill #{skill.key} has invalid stat"
      end
    end
  end
end
