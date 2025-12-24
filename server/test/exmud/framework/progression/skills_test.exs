defmodule Exmud.Framework.SkillsTest do
  use ExUnit.Case, async: true

  alias Exmud.Framework.Skills

  describe "all_skills/0" do
    test "returns all defined skills" do
      skills = Skills.all_skills()

      assert is_map(skills)
      assert map_size(skills) == 9

      # Verify some expected skills exist
      assert Map.has_key?(skills, "power_strike")
      assert Map.has_key?(skills, "shield_wall")
      assert Map.has_key?(skills, "heal")
    end
  end

  describe "get_skill/1" do
    test "returns skill data for valid skill_id" do
      skill = Skills.get_skill("power_strike")

      assert skill.name == "Power Strike"
      assert skill.category == :combat
      assert skill.cost == 2
      assert skill.effect.damage_bonus == 0.5
    end

    test "returns nil for invalid skill_id" do
      assert Skills.get_skill("nonexistent_skill") == nil
    end

    test "returns correct data for all skill categories" do
      # Combat skill
      combat_skill = Skills.get_skill("critical_eye")
      assert combat_skill.category == :combat
      assert combat_skill.cost == 3

      # Defense skill
      defense_skill = Skills.get_skill("parry")
      assert defense_skill.category == :defense
      assert defense_skill.cost == 3

      # Magic skill
      magic_skill = Skills.get_skill("flame_touch")
      assert magic_skill.category == :magic
      assert magic_skill.cost == 3
    end
  end

  describe "skills_by_category/1" do
    test "returns only combat skills for :combat category" do
      skills = Skills.skills_by_category(:combat)

      assert map_size(skills) == 3
      assert Map.has_key?(skills, "power_strike")
      assert Map.has_key?(skills, "critical_eye")
      assert Map.has_key?(skills, "berserker_rage")

      # All returned skills should have :combat category
      Enum.each(skills, fn {_id, skill} ->
        assert skill.category == :combat
      end)
    end

    test "returns only defense skills for :defense category" do
      skills = Skills.skills_by_category(:defense)

      assert map_size(skills) == 3
      assert Map.has_key?(skills, "shield_wall")
      assert Map.has_key?(skills, "parry")
      assert Map.has_key?(skills, "fortitude")

      Enum.each(skills, fn {_id, skill} ->
        assert skill.category == :defense
      end)
    end

    test "returns only magic skills for :magic category" do
      skills = Skills.skills_by_category(:magic)

      assert map_size(skills) == 3
      assert Map.has_key?(skills, "heal")
      assert Map.has_key?(skills, "flame_touch")
      assert Map.has_key?(skills, "arcane_shield")

      Enum.each(skills, fn {_id, skill} ->
        assert skill.category == :magic
      end)
    end

    test "returns empty map for unknown category" do
      skills = Skills.skills_by_category(:unknown)
      assert skills == %{}
    end
  end

  describe "get_trainer_skills/1" do
    test "returns combat skills for combat_trainer" do
      skills = Skills.get_trainer_skills("combat_trainer")

      assert map_size(skills) == 3
      assert Map.has_key?(skills, "power_strike")
      assert Map.has_key?(skills, "critical_eye")
      assert Map.has_key?(skills, "berserker_rage")
    end

    test "returns defense skills for defense_trainer" do
      skills = Skills.get_trainer_skills("defense_trainer")

      assert map_size(skills) == 3
      assert Map.has_key?(skills, "shield_wall")
      assert Map.has_key?(skills, "parry")
      assert Map.has_key?(skills, "fortitude")
    end

    test "returns magic skills for magic_trainer" do
      skills = Skills.get_trainer_skills("magic_trainer")

      assert map_size(skills) == 3
      assert Map.has_key?(skills, "heal")
      assert Map.has_key?(skills, "flame_touch")
      assert Map.has_key?(skills, "arcane_shield")
    end

    test "returns empty map for unknown trainer type" do
      assert Skills.get_trainer_skills("unknown_trainer") == %{}
    end
  end

  describe "valid_skill?/1" do
    test "returns true for valid skill IDs" do
      assert Skills.valid_skill?("power_strike") == true
      assert Skills.valid_skill?("heal") == true
      assert Skills.valid_skill?("fortitude") == true
    end

    test "returns false for invalid skill IDs" do
      assert Skills.valid_skill?("invalid_skill") == false
      assert Skills.valid_skill?("") == false
      assert Skills.valid_skill?("POWER_STRIKE") == false
    end
  end

  describe "skill effect structure" do
    test "combat skills have damage-related effects" do
      power_strike = Skills.get_skill("power_strike")
      assert Map.has_key?(power_strike.effect, :damage_bonus)

      critical_eye = Skills.get_skill("critical_eye")
      assert Map.has_key?(critical_eye.effect, :crit_chance)

      berserker = Skills.get_skill("berserker_rage")
      assert Map.has_key?(berserker.effect, :damage_bonus)
      assert Map.has_key?(berserker.effect, :damage_taken)
    end

    test "defense skills have defensive effects" do
      shield_wall = Skills.get_skill("shield_wall")
      assert Map.has_key?(shield_wall.effect, :defense_bonus)

      parry = Skills.get_skill("parry")
      assert Map.has_key?(parry.effect, :dodge_chance)

      fortitude = Skills.get_skill("fortitude")
      assert Map.has_key?(fortitude.effect, :max_health)
    end

    test "magic skills have magic-related effects" do
      heal = Skills.get_skill("heal")
      assert Map.has_key?(heal.effect, :heal)

      flame_touch = Skills.get_skill("flame_touch")
      assert Map.has_key?(flame_touch.effect, :fire_damage)

      arcane_shield = Skills.get_skill("arcane_shield")
      assert Map.has_key?(arcane_shield.effect, :absorb)
    end
  end

  describe "skill costs" do
    test "all skills have positive costs" do
      Skills.all_skills()
      |> Enum.each(fn {_id, skill} ->
        assert skill.cost > 0, "Skill #{skill.name} should have positive cost"
      end)
    end

    test "skill costs range from 2 to 4" do
      Skills.all_skills()
      |> Enum.each(fn {_id, skill} ->
        assert skill.cost >= 2 and skill.cost <= 4,
               "Skill #{skill.name} cost should be between 2 and 4"
      end)
    end
  end
end
