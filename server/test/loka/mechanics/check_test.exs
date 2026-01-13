defmodule Loka.Mechanics.CheckTest do
  use ExUnit.Case, async: true

  alias Loka.Mechanics.Check

  describe "percent/1" do
    test "100% always succeeds" do
      {:ok, result, audit} = Check.percent(100)

      assert result.success == true
      assert result.target == 100
      assert audit.operation == :percent_check
    end

    test "0% always fails" do
      {:ok, result, _audit} = Check.percent(0)

      assert result.success == false
      assert result.target == 0
    end

    test "returns roll and margin" do
      {:ok, result, _audit} = Check.percent(50)

      assert result.roll >= 1 and result.roll <= 100
      assert result.margin == 50 - result.roll
    end

    test "detects critical success/failure" do
      # Run multiple times to catch criticals
      results =
        for _ <- 1..200 do
          {:ok, result, _} = Check.percent(50)
          result
        end

      assert Enum.any?(results, & &1.critical_success)
      assert Enum.any?(results, & &1.critical_failure)
    end
  end

  describe "skill/2" do
    test "calculates skill check" do
      context = %{skill_level: 5, stat: 14}
      {:ok, result, audit} = Check.skill(context)

      assert is_boolean(result.success)
      assert result.skill_bonus > 0
      assert audit.operation == :skill_check
    end

    test "applies difficulty modifier" do
      context = %{skill_level: 5, stat: 10}

      {:ok, easy_result, _} = Check.skill(context, difficulty: :easy)
      {:ok, hard_result, _} = Check.skill(context, difficulty: :hard)

      # Easy should have higher target, hard should have lower
      assert easy_result.target > hard_result.target
    end
  end

  describe "against_dc/3" do
    test "compares roll against DC" do
      context = %{skill_level: 10, stat: 5}
      {:ok, result, audit} = Check.against_dc(context, 15)

      assert is_boolean(result.success)
      assert result.target == 15
      # skill_level + stat
      assert result.bonus == 15
      assert audit.operation == :dc_check
    end

    test "detects natural 20 and natural 1" do
      # Run many times to catch naturals
      results =
        for _ <- 1..100 do
          {:ok, result, _} = Check.against_dc(%{}, 10, dice: "1d20")
          result
        end

      assert Enum.any?(results, & &1.critical_success)
      assert Enum.any?(results, & &1.critical_failure)
    end
  end

  describe "opposed/3" do
    test "compares two contexts" do
      first = %{str: 18}
      second = %{str: 14}

      {:ok, result, audit} = Check.opposed(first, second, stat: :str)

      assert result.winner in [:first, :second, :tie]
      assert result.first.stat == 18
      assert result.second.stat == 14
      assert audit.operation == :opposed_check
    end
  end

  describe "compare/3" do
    test "returns :gt when first is greater" do
      assert {:gt, 2} = Check.compare(%{level: 10}, %{level: 8}, :level)
    end

    test "returns :lt when first is less" do
      assert {:lt, 4} = Check.compare(%{str: 14}, %{str: 18}, :str)
    end

    test "returns :eq when equal" do
      assert {:eq, 0} = Check.compare(%{dex: 12}, %{dex: 12}, :dex)
    end
  end

  describe "higher?/3" do
    test "returns true when first is higher" do
      assert Check.higher?(%{level: 10}, %{level: 8}, :level) == true
    end

    test "returns false when first is lower or equal" do
      assert Check.higher?(%{level: 8}, %{level: 10}, :level) == false
      assert Check.higher?(%{level: 10}, %{level: 10}, :level) == false
    end
  end

  describe "higher/3" do
    test "returns context with higher stat" do
      first = %{str: 18, name: "first"}
      second = %{str: 14, name: "second"}

      assert Check.higher(first, second, :str) == first
      assert Check.higher(second, first, :str) == first
    end
  end

  describe "difficulties/0" do
    test "returns all difficulty levels" do
      difficulties = Check.difficulties()

      assert :trivial in difficulties
      assert :easy in difficulties
      assert :normal in difficulties
      assert :hard in difficulties
      assert :very_hard in difficulties
      assert :legendary in difficulties
    end
  end

  describe "get_difficulty_modifier/1" do
    test "returns modifier for each difficulty" do
      assert Check.get_difficulty_modifier(:trivial) < 0
      assert Check.get_difficulty_modifier(:easy) < 0
      assert Check.get_difficulty_modifier(:normal) == 0
      assert Check.get_difficulty_modifier(:hard) > 0
      assert Check.get_difficulty_modifier(:very_hard) > 0
      assert Check.get_difficulty_modifier(:legendary) > 0
    end
  end

  describe "success_chance/2" do
    test "calculates success chance" do
      context = %{skill_level: 5, stat: 10}

      easy_chance = Check.success_chance(context, difficulty: :easy)
      normal_chance = Check.success_chance(context, difficulty: :normal)
      hard_chance = Check.success_chance(context, difficulty: :hard)

      assert easy_chance > normal_chance
      assert normal_chance > hard_chance
    end

    test "clamps to 5-95 range" do
      # Very high skill
      high_chance = Check.success_chance(%{skill_level: 100, stat: 50})
      assert high_chance == 95

      # Very low skill against legendary
      low_chance = Check.success_chance(%{skill_level: 0, stat: 0}, difficulty: :legendary)
      # Should be clamped to minimum of 5
      assert low_chance >= 5 and low_chance <= 95
    end
  end
end
