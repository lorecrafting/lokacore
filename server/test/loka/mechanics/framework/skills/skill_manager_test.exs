defmodule Loka.Framework.Skills.SkillManagerTest do
  use Loka.DataCase, async: false

  alias Loka.Framework.Skills.SkillManager
  alias Loka.Engine.Entity

  import Loka.EngineFixtures

  setup do
    # Create skill entities in the DB (replaces old SkillRegistry setup)
    skill_fixture(%{
      key: "basic_combat",
      name: "Basic Combat",
      category: "combat",
      max_level: 100,
      xp_per_use: 1,
      xp_per_level: 100,
      point_cost_formula: "level"
    })

    skill_fixture(%{
      key: "swordsmanship",
      name: "Swordsmanship",
      category: "combat",
      max_level: 100,
      prerequisites: [%{"skill" => "basic_combat", "level" => 10}],
      xp_per_use: 2,
      xp_per_level: 150,
      point_cost_formula: "level"
    })

    skill_fixture(%{
      key: "expensive_skill",
      name: "Expensive Skill",
      category: "combat",
      max_level: 50,
      xp_per_use: 1,
      xp_per_level: 100,
      point_cost_formula: "level_squared"
    })

    skill_fixture(%{
      key: "capped_skill",
      name: "Capped Skill",
      category: "general",
      max_level: 5,
      xp_per_use: 1,
      xp_per_level: 50,
      point_cost_formula: "level"
    })

    state = character_fixture()

    {:ok, state: state}
  end

  # Helper to set player skills
  defp set_skills(entity, skills) do
    stats = Entity.get_component(entity, "stats") || %{}
    updated_stats = Map.put(stats, :skills, skills)
    Entity.add_component(entity, "stats", updated_stats)
  end

  # Helper to set max skill points
  defp set_max_points(entity, max) do
    stats = Entity.get_component(entity, "stats") || %{}
    updated_stats = Map.put(stats, :max_skill_points, max)
    Entity.add_component(entity, "stats", updated_stats)
  end

  describe "get_level/2" do
    test "returns 0 for untrained skill", %{state: state} do
      assert SkillManager.get_level(state, "basic_combat") == 0
    end

    test "returns correct level for trained skill", %{state: state} do
      skills = %{"basic_combat" => %{level: 15, xp: 0}}
      state = set_skills(state, skills)

      assert SkillManager.get_level(state, "basic_combat") == 15
    end

    test "returns 0 for non-existent skill", %{state: state} do
      assert SkillManager.get_level(state, "nonexistent") == 0
    end
  end

  describe "get_xp/2" do
    test "returns 0 for untrained skill", %{state: state} do
      assert SkillManager.get_xp(state, "basic_combat") == 0
    end

    test "returns correct XP for trained skill", %{state: state} do
      skills = %{"basic_combat" => %{level: 5, xp: 50}}
      state = set_skills(state, skills)

      assert SkillManager.get_xp(state, "basic_combat") == 50
    end
  end

  describe "list_trained_skills/1" do
    test "returns empty list when no skills trained", %{state: state} do
      assert SkillManager.list_trained_skills(state) == []
    end

    test "returns list of trained skills with level > 0", %{state: state} do
      skills = %{
        "basic_combat" => %{level: 10, xp: 25},
        "swordsmanship" => %{level: 5, xp: 100}
      }

      state = set_skills(state, skills)

      trained = SkillManager.list_trained_skills(state)

      assert length(trained) == 2
      assert %{skill: "basic_combat", level: 10, xp: 25} in trained
      assert %{skill: "swordsmanship", level: 5, xp: 100} in trained
    end

    test "excludes skills with level 0", %{state: state} do
      skills = %{
        "basic_combat" => %{level: 10, xp: 0},
        "untrained" => %{level: 0, xp: 50}
      }

      state = set_skills(state, skills)

      trained = SkillManager.list_trained_skills(state)

      assert length(trained) == 1
      assert hd(trained).skill == "basic_combat"
    end
  end

  describe "points_spent/1" do
    test "returns 0 when no skills trained", %{state: state} do
      assert SkillManager.points_spent(state) == 0
    end

    test "calculates points for single skill with linear formula", %{state: state} do
      # basic_combat at level 3 costs 1+2+3 = 6 points
      skills = %{"basic_combat" => %{level: 3, xp: 0}}
      state = set_skills(state, skills)

      assert SkillManager.points_spent(state) == 6
    end

    test "calculates points for multiple skills", %{state: state} do
      # basic_combat level 3: 1+2+3 = 6
      # swordsmanship level 2: 1+2 = 3
      skills = %{
        "basic_combat" => %{level: 3, xp: 0},
        "swordsmanship" => %{level: 2, xp: 0}
      }

      state = set_skills(state, skills)

      assert SkillManager.points_spent(state) == 9
    end

    test "calculates points for skill with squared formula", %{state: state} do
      # expensive_skill at level 3 costs 1+4+9 = 14 points
      skills = %{"expensive_skill" => %{level: 3, xp: 0}}
      state = set_skills(state, skills)

      assert SkillManager.points_spent(state) == 14
    end

    test "handles skills at level 0", %{state: state} do
      skills = %{
        "basic_combat" => %{level: 5, xp: 0},
        "unused" => %{level: 0, xp: 0}
      }

      state = set_skills(state, skills)

      # Only basic_combat should count (1+2+3+4+5 = 15)
      assert SkillManager.points_spent(state) == 15
    end

    test "handles unknown skill gracefully", %{state: state} do
      # If skill definition not found, falls back to simple level sum
      skills = %{"unknown_skill" => %{level: 3, xp: 0}}
      state = set_skills(state, skills)

      assert SkillManager.points_spent(state) == 3
    end
  end

  describe "points_remaining/1" do
    test "returns max points when no skills trained", %{state: state} do
      assert SkillManager.points_remaining(state) == 100
    end

    test "calculates remaining points correctly", %{state: state} do
      # basic_combat level 10: 1+2+...+10 = 55 points
      skills = %{"basic_combat" => %{level: 10, xp: 0}}
      state = set_skills(state, skills)

      assert SkillManager.points_remaining(state) == 45
    end

    test "respects custom max_skill_points", %{state: state} do
      state = set_max_points(state, 50)
      skills = %{"basic_combat" => %{level: 5, xp: 0}}
      state = set_skills(state, skills)

      # Level 5 costs 15 points, 50-15 = 35 remaining
      assert SkillManager.points_remaining(state) == 35
    end

    test "can return 0 when all points spent", %{state: state} do
      state = set_max_points(state, 10)
      # Level 4 costs exactly 10 points (1+2+3+4)
      skills = %{"basic_combat" => %{level: 4, xp: 0}}
      state = set_skills(state, skills)

      assert SkillManager.points_remaining(state) == 0
    end
  end

  describe "get_max_points/1" do
    test "returns default max points", %{state: state} do
      assert SkillManager.get_max_points(state) == 100
    end

    test "returns custom max points", %{state: state} do
      state = set_max_points(state, 150)

      assert SkillManager.get_max_points(state) == 150
    end
  end

  describe "train/2" do
    test "trains skill from level 0 to 1", %{state: state} do
      assert {:ok, updated_state} = SkillManager.train(state, "basic_combat")

      assert SkillManager.get_level(updated_state, "basic_combat") == 1
    end

    test "trains skill from level 1 to 2", %{state: state} do
      skills = %{"basic_combat" => %{level: 1, xp: 0}}
      state = set_skills(state, skills)

      assert {:ok, updated_state} = SkillManager.train(state, "basic_combat")

      assert SkillManager.get_level(updated_state, "basic_combat") == 2
    end

    test "preserves existing XP when training", %{state: state} do
      skills = %{"basic_combat" => %{level: 1, xp: 50}}
      state = set_skills(state, skills)

      assert {:ok, updated_state} = SkillManager.train(state, "basic_combat")

      assert SkillManager.get_xp(updated_state, "basic_combat") == 50
    end

    test "returns error for unknown skill", %{state: state} do
      assert {:error, :not_found} = SkillManager.train(state, "nonexistent")
    end

    test "returns error when prerequisites not met", %{state: state} do
      # swordsmanship requires basic_combat level 10
      assert {:error, {:prerequisites_not_met, _}} = SkillManager.train(state, "swordsmanship")
    end

    test "allows training when prerequisites are met", %{state: state} do
      skills = %{"basic_combat" => %{level: 10, xp: 0}}
      state = set_skills(state, skills)

      assert {:ok, updated_state} = SkillManager.train(state, "swordsmanship")
      assert SkillManager.get_level(updated_state, "swordsmanship") == 1
    end

    test "returns error when insufficient points", %{state: state} do
      state = set_max_points(state, 20)
      # Try to train to level 6 which costs 6 points
      # Level 5 costs 15 points total (1+2+3+4+5)
      # With max 20, we have 5 remaining, but level 6 costs 6 points
      skills = %{"basic_combat" => %{level: 5, xp: 0}}
      state = set_skills(state, skills)

      assert {:error, {:insufficient_points, 6, 5}} = SkillManager.train(state, "basic_combat")
    end

    test "returns error when skill is maxed", %{state: state} do
      # capped_skill has max_level of 5
      skills = %{"capped_skill" => %{level: 5, xp: 0}}
      state = set_skills(state, skills)

      assert {:error, :skill_maxed} = SkillManager.train(state, "capped_skill")
    end

    test "deducts correct points for linear formula", %{state: state} do
      # Training to level 1 costs 1 point
      assert {:ok, updated_state} = SkillManager.train(state, "basic_combat")
      assert SkillManager.points_remaining(updated_state) == 99

      # Training to level 2 costs 2 more points
      assert {:ok, updated_state} = SkillManager.train(updated_state, "basic_combat")
      assert SkillManager.points_remaining(updated_state) == 97
    end

    test "deducts correct points for squared formula", %{state: state} do
      # Training expensive_skill to level 1 costs 1 point
      assert {:ok, updated_state} = SkillManager.train(state, "expensive_skill")
      assert SkillManager.points_remaining(updated_state) == 99

      # Training to level 2 costs 4 more points (2^2)
      assert {:ok, updated_state} = SkillManager.train(updated_state, "expensive_skill")
      assert SkillManager.points_remaining(updated_state) == 95
    end
  end

  describe "practice/3" do
    test "grants default XP to untrained skill", %{state: state} do
      assert {:ok, updated_state} = SkillManager.practice(state, "basic_combat")

      # basic_combat has xp_per_use = 1
      assert SkillManager.get_xp(updated_state, "basic_combat") == 1
      assert SkillManager.get_level(updated_state, "basic_combat") == 0
    end

    test "grants custom XP amount", %{state: state} do
      assert {:ok, updated_state} = SkillManager.practice(state, "basic_combat", 25)

      assert SkillManager.get_xp(updated_state, "basic_combat") == 25
    end

    test "accumulates XP across multiple practice calls", %{state: state} do
      {:ok, state} = SkillManager.practice(state, "basic_combat", 10)
      {:ok, state} = SkillManager.practice(state, "basic_combat", 15)

      assert SkillManager.get_xp(state, "basic_combat") == 25
    end

    test "levels up when XP threshold reached and points available", %{state: state} do
      # basic_combat needs 100 XP for level 1
      # Give player level 0 to start, then add enough points
      {:ok, updated_state} = SkillManager.practice(state, "basic_combat", 100)

      assert SkillManager.get_level(updated_state, "basic_combat") == 1
      assert SkillManager.get_xp(updated_state, "basic_combat") == 0
    end

    test "carries over excess XP after level up", %{state: state} do
      {:ok, updated_state} = SkillManager.practice(state, "basic_combat", 125)

      assert SkillManager.get_level(updated_state, "basic_combat") == 1
      assert SkillManager.get_xp(updated_state, "basic_combat") == 25
    end

    test "does not level up when insufficient points", %{state: state} do
      state = set_max_points(state, 0)

      {:ok, updated_state} = SkillManager.practice(state, "basic_combat", 100)

      # XP accumulated but no level up
      assert SkillManager.get_level(updated_state, "basic_combat") == 0
      assert SkillManager.get_xp(updated_state, "basic_combat") == 100
    end

    test "does not gain XP when skill is maxed", %{state: state} do
      # capped_skill maxes at level 5
      skills = %{"capped_skill" => %{level: 5, xp: 0}}
      state = set_skills(state, skills)

      {:ok, updated_state} = SkillManager.practice(state, "capped_skill", 50)

      # No change when maxed
      assert SkillManager.get_level(updated_state, "capped_skill") == 5
      assert SkillManager.get_xp(updated_state, "capped_skill") == 0
    end

    test "returns error for unknown skill", %{state: state} do
      assert {:error, :unknown_skill} = SkillManager.practice(state, "nonexistent")
    end

    test "uses skill's xp_per_use when amount not specified", %{state: state} do
      # swordsmanship has xp_per_use = 2
      {:ok, updated_state} = SkillManager.practice(state, "swordsmanship")

      assert SkillManager.get_xp(updated_state, "swordsmanship") == 2
    end

    test "levels up from trained skill with accumulated XP", %{state: state} do
      # Start at level 1 with 90 XP
      skills = %{"basic_combat" => %{level: 1, xp: 90}}
      state = set_skills(state, skills)

      # Add 20 more XP (need 200 total for level 2, have 110 now)
      {:ok, updated_state} = SkillManager.practice(state, "basic_combat", 110)

      # Should level up to 2 and have 0 XP left
      assert SkillManager.get_level(updated_state, "basic_combat") == 2
      assert SkillManager.get_xp(updated_state, "basic_combat") == 0
    end
  end
end
