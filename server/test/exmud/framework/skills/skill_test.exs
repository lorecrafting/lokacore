defmodule Exmud.Framework.Skills.SkillTest do
  use ExUnit.Case, async: true

  alias Exmud.Framework.Skills.Skill

  describe "from_map/1" do
    test "creates skill with required fields" do
      data = %{
        "key" => "swordsmanship",
        "name" => "Swordsmanship"
      }

      assert {:ok, skill} = Skill.from_map(data)
      assert skill.key == "swordsmanship"
      assert skill.name == "Swordsmanship"
      assert skill.category == "general"
      assert skill.max_level == 100
      assert skill.description == ""
      assert skill.prerequisites == []
      assert skill.unlocks == []
      assert skill.trainers == []
      assert skill.practice_actions == []
      assert skill.xp_per_use == 1
      assert skill.xp_per_level == 100
      assert skill.point_cost_formula == "level"
      assert skill.tags == []
    end

    test "creates skill with all custom fields" do
      data = %{
        "key" => "swordsmanship",
        "name" => "Swordsmanship",
        "category" => "combat",
        "max_level" => 75,
        "description" => "Mastery of blade weapons",
        "prerequisites" => [
          %{"skill" => "basic_combat", "level" => 10}
        ],
        "unlocks" => ["parry", "riposte"],
        "trainers" => ["weapons_master"],
        "practice_actions" => ["attack_with_sword", "spar"],
        "xp_per_use" => 2,
        "xp_per_level" => 150,
        "point_cost_formula" => "level_squared",
        "tags" => ["weapon", "melee"]
      }

      assert {:ok, skill} = Skill.from_map(data)
      assert skill.key == "swordsmanship"
      assert skill.name == "Swordsmanship"
      assert skill.category == "combat"
      assert skill.max_level == 75
      assert skill.description == "Mastery of blade weapons"
      assert skill.prerequisites == [%{skill: "basic_combat", level: 10}]
      assert skill.unlocks == ["parry", "riposte"]
      assert skill.trainers == ["weapons_master"]
      assert skill.practice_actions == ["attack_with_sword", "spar"]
      assert skill.xp_per_use == 2
      assert skill.xp_per_level == 150
      assert skill.point_cost_formula == "level_squared"
      assert skill.tags == ["weapon", "melee"]
    end

    test "accepts atom keys" do
      data = %{
        key: "archery",
        name: "Archery",
        category: "combat"
      }

      assert {:ok, skill} = Skill.from_map(data)
      assert skill.key == "archery"
      assert skill.name == "Archery"
      assert skill.category == "combat"
    end

    test "handles multiple prerequisites" do
      data = %{
        "key" => "blade_dance",
        "name" => "Blade Dance",
        "prerequisites" => [
          %{"skill" => "swordsmanship", "level" => 50},
          %{"skill" => "agility", "level" => 30}
        ]
      }

      assert {:ok, skill} = Skill.from_map(data)
      assert length(skill.prerequisites) == 2
      assert Enum.at(skill.prerequisites, 0) == %{skill: "swordsmanship", level: 50}
      assert Enum.at(skill.prerequisites, 1) == %{skill: "agility", level: 30}
    end

    test "returns error when key is missing" do
      data = %{"name" => "No Key"}

      assert {:error, {:missing_field, "key"}} = Skill.from_map(data)
    end

    test "returns error when name is missing" do
      data = %{"key" => "no_name"}

      assert {:error, {:missing_field, "name"}} = Skill.from_map(data)
    end

    test "handles empty prerequisites list" do
      data = %{
        "key" => "basic_skill",
        "name" => "Basic Skill",
        "prerequisites" => []
      }

      assert {:ok, skill} = Skill.from_map(data)
      assert skill.prerequisites == []
    end

    test "handles prerequisite with defaults when level is missing" do
      data = %{
        "key" => "test_skill",
        "name" => "Test Skill",
        "prerequisites" => [%{"skill" => "basic_combat"}]
      }

      assert {:ok, skill} = Skill.from_map(data)
      assert skill.prerequisites == [%{skill: "basic_combat", level: 1}]
    end
  end

  describe "xp_for_level/2" do
    test "calculates XP for level 1" do
      skill = %Skill{xp_per_level: 100}

      assert Skill.xp_for_level(skill, 1) == 100
    end

    test "calculates XP for higher levels with progressive curve" do
      skill = %Skill{xp_per_level: 100}

      assert Skill.xp_for_level(skill, 1) == 100
      assert Skill.xp_for_level(skill, 2) == 200
      assert Skill.xp_for_level(skill, 5) == 500
      assert Skill.xp_for_level(skill, 10) == 1000
    end

    test "scales with custom xp_per_level" do
      skill = %Skill{xp_per_level: 50}

      assert Skill.xp_for_level(skill, 1) == 50
      assert Skill.xp_for_level(skill, 5) == 250
    end

    test "handles level 0" do
      skill = %Skill{xp_per_level: 100}

      assert Skill.xp_for_level(skill, 0) == 0
    end
  end

  describe "point_cost/2" do
    test "calculates linear cost with 'level' formula" do
      skill = %Skill{point_cost_formula: "level"}

      assert Skill.point_cost(skill, 1) == 1
      assert Skill.point_cost(skill, 5) == 5
      assert Skill.point_cost(skill, 10) == 10
    end

    test "calculates squared cost with 'level_squared' formula" do
      skill = %Skill{point_cost_formula: "level_squared"}

      assert Skill.point_cost(skill, 1) == 1
      assert Skill.point_cost(skill, 5) == 25
      assert Skill.point_cost(skill, 10) == 100
    end

    test "defaults to linear for unknown formula" do
      skill = %Skill{point_cost_formula: "unknown"}

      assert Skill.point_cost(skill, 5) == 5
    end

    test "handles level 0" do
      skill = %Skill{point_cost_formula: "level"}

      assert Skill.point_cost(skill, 0) == 0
    end
  end

  describe "total_points_spent/2" do
    test "calculates total for level 1" do
      skill = %Skill{point_cost_formula: "level"}

      assert Skill.total_points_spent(skill, 1) == 1
    end

    test "calculates cumulative total with linear formula" do
      skill = %Skill{point_cost_formula: "level"}

      # Level 1: 1, Level 2: 2, Level 3: 3
      assert Skill.total_points_spent(skill, 1) == 1
      assert Skill.total_points_spent(skill, 2) == 3
      assert Skill.total_points_spent(skill, 3) == 6
      assert Skill.total_points_spent(skill, 5) == 15
    end

    test "calculates cumulative total with squared formula" do
      skill = %Skill{point_cost_formula: "level_squared"}

      # Level 1: 1, Level 2: 4, Level 3: 9
      assert Skill.total_points_spent(skill, 1) == 1
      assert Skill.total_points_spent(skill, 2) == 5
      assert Skill.total_points_spent(skill, 3) == 14
    end

    test "returns 0 for level 0" do
      skill = %Skill{point_cost_formula: "level"}

      assert Skill.total_points_spent(skill, 0) == 0
    end

    test "handles high levels" do
      skill = %Skill{point_cost_formula: "level"}

      # Sum of 1..10 = 55
      assert Skill.total_points_spent(skill, 10) == 55
    end
  end

  describe "prerequisites_met?/2" do
    test "returns true when no prerequisites" do
      skill = %Skill{prerequisites: []}
      player_skills = %{"swordsmanship" => 50}

      assert Skill.prerequisites_met?(skill, player_skills) == true
    end

    test "returns true when single prerequisite is met" do
      skill = %Skill{prerequisites: [%{skill: "basic_combat", level: 10}]}
      player_skills = %{"basic_combat" => 15}

      assert Skill.prerequisites_met?(skill, player_skills) == true
    end

    test "returns true when prerequisite is exactly met" do
      skill = %Skill{prerequisites: [%{skill: "basic_combat", level: 10}]}
      player_skills = %{"basic_combat" => 10}

      assert Skill.prerequisites_met?(skill, player_skills) == true
    end

    test "returns false when prerequisite is not met" do
      skill = %Skill{prerequisites: [%{skill: "basic_combat", level: 10}]}
      player_skills = %{"basic_combat" => 5}

      assert Skill.prerequisites_met?(skill, player_skills) == false
    end

    test "returns false when prerequisite skill is missing" do
      skill = %Skill{prerequisites: [%{skill: "basic_combat", level: 10}]}
      player_skills = %{}

      assert Skill.prerequisites_met?(skill, player_skills) == false
    end

    test "returns true when all prerequisites are met" do
      skill = %Skill{
        prerequisites: [
          %{skill: "basic_combat", level: 10},
          %{skill: "strength", level: 5}
        ]
      }

      player_skills = %{
        "basic_combat" => 15,
        "strength" => 8
      }

      assert Skill.prerequisites_met?(skill, player_skills) == true
    end

    test "returns false when any prerequisite is not met" do
      skill = %Skill{
        prerequisites: [
          %{skill: "basic_combat", level: 10},
          %{skill: "strength", level: 5}
        ]
      }

      player_skills = %{
        "basic_combat" => 15,
        "strength" => 3
      }

      assert Skill.prerequisites_met?(skill, player_skills) == false
    end

    test "handles player with level 0 in skill" do
      skill = %Skill{prerequisites: [%{skill: "basic_combat", level: 1}]}
      player_skills = %{"basic_combat" => 0}

      assert Skill.prerequisites_met?(skill, player_skills) == false
    end
  end

  describe "valid_categories/0" do
    test "returns list of valid categories" do
      categories = Skill.valid_categories()

      assert is_list(categories)
      assert "combat" in categories
      assert "magic" in categories
      assert "crafting" in categories
      assert "gathering" in categories
      assert "social" in categories
      assert "knowledge" in categories
      assert "survival" in categories
      assert "general" in categories
    end

    test "returns exactly 8 categories" do
      categories = Skill.valid_categories()

      assert length(categories) == 8
    end
  end
end
