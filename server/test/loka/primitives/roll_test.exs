defmodule Loka.Primitives.RollTest do
  use ExUnit.Case, async: true

  alias Loka.Primitives.Roll

  describe "dice/1 with notation" do
    test "parses simple dice notation" do
      {:ok, result, audit} = Roll.dice("1d6")

      assert result.dice == 1
      assert result.sides == 6
      assert result.modifier == 0
      assert result.total >= 1 and result.total <= 6
      assert length(result.rolls) == 1
      assert audit.operation == :dice
    end

    test "parses dice with modifier" do
      {:ok, result, _audit} = Roll.dice("2d6+5")

      assert result.dice == 2
      assert result.sides == 6
      assert result.modifier == 5
      assert result.total >= 7 and result.total <= 17
      assert length(result.rolls) == 2
    end

    test "parses negative modifier" do
      {:ok, result, _audit} = Roll.dice("1d20-2")

      assert result.modifier == -2
      assert result.total >= -1 and result.total <= 18
    end

    test "parses d100 shorthand" do
      {:ok, result, _audit} = Roll.dice("d100")

      assert result.dice == 1
      assert result.sides == 100
    end

    test "returns error for invalid notation" do
      assert {:error, :invalid_notation} = Roll.dice("invalid")
      assert {:error, :invalid_notation} = Roll.dice("abc123")
    end
  end

  describe "dice/3 with explicit params" do
    test "rolls with count, sides, modifier" do
      {:ok, result, _audit} = Roll.dice(3, 8, 2)

      assert result.dice == 3
      assert result.sides == 8
      assert result.modifier == 2
      assert result.total >= 5 and result.total <= 26
      assert length(result.rolls) == 3
      assert result.expression == "3d8+2"
    end
  end

  describe "d/1" do
    test "shorthand for single die" do
      {:ok, result, _audit} = Roll.d(20)

      assert result.dice == 1
      assert result.sides == 20
      assert result.total >= 1 and result.total <= 20
    end
  end

  describe "check/1" do
    test "percentage check with 100% always succeeds" do
      {:ok, result, audit} = Roll.check(100)

      assert result.success == true
      assert result.target == 100
      assert audit.operation == :check
    end

    test "percentage check with 0% always fails" do
      {:ok, result, _audit} = Roll.check(0)

      assert result.success == false
      assert result.target == 0
    end

    test "returns roll value between 1 and 100" do
      {:ok, result, _audit} = Roll.check(50)

      assert result.roll >= 1 and result.roll <= 100
    end
  end

  describe "check_against/2" do
    test "compares dice roll against DC" do
      {:ok, result, audit} = Roll.check_against("1d20+10", 15)

      assert is_boolean(result.success)
      assert result.target == 15
      assert audit.operation == :check_against
    end
  end

  describe "weighted/1" do
    test "selects from weighted table" do
      table = [
        {100, :guaranteed}
      ]

      {:ok, result, audit} = Roll.weighted(table)

      assert result.selected == :guaranteed
      assert audit.operation == :weighted
    end

    test "respects weights" do
      # Run many times to verify distribution
      table = [
        {90, :common},
        {10, :rare}
      ]

      results =
        for _ <- 1..100 do
          {:ok, result, _} = Roll.weighted(table)
          result.selected
        end

      common_count = Enum.count(results, &(&1 == :common))
      # Should be mostly common (allow some variance)
      assert common_count > 60
    end
  end

  describe "pick/1" do
    test "picks random item with equal weight" do
      items = [:a, :b, :c]
      {:ok, result, _audit} = Roll.pick(items)

      assert result.selected in items
    end
  end

  describe "range/2" do
    test "returns value in range" do
      {:ok, result, audit} = Roll.range(10, 20)

      assert result.value >= 10 and result.value <= 20
      assert result.min == 10
      assert result.max == 20
      assert audit.operation == :range
    end
  end

  describe "range_float/2" do
    test "returns float in range" do
      {:ok, result, _audit} = Roll.range_float(0.5, 1.5)

      assert result.value >= 0.5 and result.value <= 1.5
      assert is_float(result.value)
    end
  end

  describe "parse_dice/1" do
    test "parses valid expressions" do
      assert {:ok, 2, 6, 3} = Roll.parse_dice("2d6+3")
      assert {:ok, 1, 20, 0} = Roll.parse_dice("1d20")
      assert {:ok, 1, 100, 0} = Roll.parse_dice("d100")
      assert {:ok, 3, 8, -2} = Roll.parse_dice("3d8-2")
    end

    test "returns error for invalid" do
      assert :error = Roll.parse_dice("invalid")
    end
  end

  describe "min_value/1, max_value/1, average/1" do
    test "calculates min value" do
      assert Roll.min_value("2d6+3") == 5
      assert Roll.min_value("1d20") == 1
    end

    test "calculates max value" do
      assert Roll.max_value("2d6+3") == 15
      assert Roll.max_value("1d20") == 20
    end

    test "calculates average" do
      assert Roll.average("2d6") == 7.0
      assert Roll.average("1d6") == 3.5
    end
  end
end
