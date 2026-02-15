defmodule Loka.Framework.ProgressionTest do
  use Loka.DataCase

  alias Loka.Framework.Progression
  alias Loka.Engine.Entity

  import Loka.EngineFixtures

  describe "xp_for_level/1" do
    test "returns 0 for level 1 or less" do
      assert Progression.xp_for_level(1) == 0
      assert Progression.xp_for_level(0) == 0
      assert Progression.xp_for_level(-1) == 0
    end

    test "returns correct XP for higher levels" do
      # Formula: 100 * level^1.8 (gentler curve than quadratic)
      assert Progression.xp_for_level(2) == 348
      assert Progression.xp_for_level(3) == 722
      assert Progression.xp_for_level(4) == 1212
      assert Progression.xp_for_level(5) == 1811
      assert Progression.xp_for_level(10) == 6309
    end
  end

  describe "xp_to_next_level/1" do
    test "returns XP needed for next level" do
      # From level 1: need 348 XP to reach level 2
      assert Progression.xp_to_next_level(1) == 348

      # From level 2: need 722 XP to reach level 3
      assert Progression.xp_to_next_level(2) == 722

      # From level 9: need 6309 XP to reach level 10
      assert Progression.xp_to_next_level(9) == 6309
    end
  end

  describe "level_for_xp/1" do
    test "returns level 1 for 0 XP" do
      assert Progression.level_for_xp(0) == 1
    end

    test "returns level 1 for XP below threshold" do
      assert Progression.level_for_xp(100) == 1
      assert Progression.level_for_xp(347) == 1
    end

    test "returns level 2 at exactly 348 XP" do
      assert Progression.level_for_xp(348) == 2
    end

    test "returns correct level for various XP values" do
      assert Progression.level_for_xp(400) == 2
      assert Progression.level_for_xp(721) == 2
      assert Progression.level_for_xp(722) == 3
      assert Progression.level_for_xp(1000) == 3
      assert Progression.level_for_xp(1212) == 4
      assert Progression.level_for_xp(6309) == 10
      assert Progression.level_for_xp(10_000) == 12
    end
  end

  describe "award_xp/2" do
    test "adds XP without level up" do
      state = character_fixture()

      assert {:ok, updated_state, nil} = Progression.award_xp(state, 100)
      assert Entity.get_component(updated_state, "stats")["xp"] == 100
      assert Entity.get_component(updated_state, "stats")["level"] == 1
    end

    test "triggers level up when XP threshold reached" do
      state = character_fixture()

      assert {:ok, updated_state, level_up_info} = Progression.award_xp(state, 400)

      assert Entity.get_component(updated_state, "stats")["level"] == 2
      assert Entity.get_component(updated_state, "stats")["xp"] == 400
      assert level_up_info.new_level == 2
      assert level_up_info.old_level == 1
      assert level_up_info.skill_points_gained == 3
    end

    test "awards skill points on level up (3 per level)" do
      state = character_fixture()

      {:ok, updated_state, _} = Progression.award_xp(state, 400)

      assert Entity.get_component(updated_state, "stats")["skill_points"] == 3
    end

    test "handles multiple level ups at once" do
      state = character_fixture()

      # Award enough XP to go from level 1 to level 3 (need 722 XP)
      assert {:ok, updated_state, level_up_info} = Progression.award_xp(state, 800)

      assert Entity.get_component(updated_state, "stats")["level"] == 3
      assert level_up_info.new_level == 3
      # 2 levels gained * 3 skill points = 6
      assert level_up_info.skill_points_gained == 6
      assert Entity.get_component(updated_state, "stats")["skill_points"] == 6
    end

    test "increases max health on level up (+10 per level)" do
      state =
        character_fixture(
          resources: %{
            "health" => %{"current" => 100, "max" => 100},
            "mana" => %{"current" => 100, "max" => 100},
            "mv" => %{"current" => 150, "max" => 150}
          }
        )

      {:ok, updated_state, _} = Progression.award_xp(state, 400)

      health = Entity.get_component(updated_state, "resources")["health"]
      # +10 max health for 1 level gained
      assert health["max"] == 110
      # Also heals on level up
      assert health["current"] == 110
    end

    test "accumulates XP across multiple awards" do
      state = character_fixture()

      {:ok, state, nil} = Progression.award_xp(state, 100)
      {:ok, state, nil} = Progression.award_xp(state, 100)
      {:ok, state, nil} = Progression.award_xp(state, 100)

      assert Entity.get_component(state, "stats")["xp"] == 300
      assert Entity.get_component(state, "stats")["level"] == 1

      # Now trigger level up (348 XP needed for level 2)
      {:ok, state, level_up_info} = Progression.award_xp(state, 100)

      assert Entity.get_component(state, "stats")["xp"] == 400
      assert Entity.get_component(state, "stats")["level"] == 2
      assert level_up_info != nil
    end
  end

  describe "get_progression_stats/1" do
    test "returns correct stats for level 1 player" do
      state = character_fixture()

      stats = Progression.get_progression_stats(state)

      assert stats.level == 1
      assert stats.total_xp == 0
      assert stats.xp_into_level == 0
      assert stats.xp_needed_for_next == 348
      assert stats.xp_progress_percent == 0
      assert stats.skill_points == 0
      assert stats.learned_skills == []
    end

    test "calculates progress percent correctly" do
      state = character_fixture(stats: %{"xp" => 174, "level" => 1})

      stats = Progression.get_progression_stats(state)

      # 174 out of 348 = 50%
      assert stats.xp_into_level == 174
      assert stats.xp_progress_percent == 50
    end

    test "shows learned skills" do
      state =
        character_fixture(
          stats: %{"level" => 5, "xp" => 2500, "skills" => ["power_strike", "heal"]}
        )

      stats = Progression.get_progression_stats(state)

      assert stats.learned_skills == ["power_strike", "heal"]
    end
  end

  describe "can_learn_skill?/2" do
    test "returns true when player has enough skill points" do
      state = character_fixture(stats: %{"skill_points" => 5})

      assert Progression.can_learn_skill?(state, 3) == true
      assert Progression.can_learn_skill?(state, 5) == true
    end

    test "returns false when player lacks skill points" do
      state = character_fixture(stats: %{"skill_points" => 2})

      assert Progression.can_learn_skill?(state, 3) == false
    end

    test "returns true for zero cost" do
      state = character_fixture(stats: %{"skill_points" => 0})

      assert Progression.can_learn_skill?(state, 0) == true
    end
  end

  describe "learn_skill/3" do
    test "learns a skill and deducts skill points" do
      state = character_fixture(stats: %{"skill_points" => 5, "skills" => []})

      assert {:ok, updated_state} = Progression.learn_skill(state, "power_strike", 2)

      assert Entity.get_component(updated_state, "stats")["skill_points"] == 3
      assert "power_strike" in Entity.get_component(updated_state, "stats")["skills"]
    end

    test "returns error when not enough skill points" do
      state = character_fixture(stats: %{"skill_points" => 1, "skills" => []})

      assert {:error, :not_enough_skill_points} =
               Progression.learn_skill(state, "power_strike", 2)
    end

    test "returns error when skill already learned" do
      state =
        character_fixture(stats: %{"skill_points" => 5, "skills" => ["power_strike"]})

      assert {:error, :already_learned} = Progression.learn_skill(state, "power_strike", 2)
    end

    test "can learn multiple skills" do
      state = character_fixture(stats: %{"skill_points" => 10, "skills" => []})

      {:ok, state} = Progression.learn_skill(state, "power_strike", 2)
      {:ok, state} = Progression.learn_skill(state, "heal", 2)
      {:ok, state} = Progression.learn_skill(state, "shield_wall", 2)

      stats = Entity.get_component(state, "stats")
      assert stats["skill_points"] == 4
      assert "power_strike" in stats["skills"]
      assert "heal" in stats["skills"]
      assert "shield_wall" in stats["skills"]
    end
  end

  describe "has_skill?/2" do
    test "returns true when skill is learned" do
      state =
        character_fixture(stats: %{"skills" => ["power_strike", "heal"]})

      assert Progression.has_skill?(state, "power_strike") == true
      assert Progression.has_skill?(state, "heal") == true
    end

    test "returns false when skill is not learned" do
      state = character_fixture(stats: %{"skills" => ["power_strike"]})

      assert Progression.has_skill?(state, "heal") == false
    end

    test "returns false for empty skills list" do
      state = character_fixture(stats: %{"skills" => []})

      assert Progression.has_skill?(state, "power_strike") == false
    end
  end
end
