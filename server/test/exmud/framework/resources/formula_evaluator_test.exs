defmodule Exmud.Framework.Resources.FormulaEvaluatorTest do
  use ExUnit.Case, async: true

  alias Exmud.Framework.Resources.FormulaEvaluator

  describe "evaluate/2" do
    test "evaluates simple number" do
      assert {:ok, 100} = FormulaEvaluator.evaluate("100", %{})
    end

    test "evaluates float numbers" do
      assert {:ok, 42} = FormulaEvaluator.evaluate("42.5", %{})
      assert {:ok, 99} = FormulaEvaluator.evaluate("99.9", %{})
    end

    test "evaluates addition" do
      assert {:ok, 15} = FormulaEvaluator.evaluate("10 + 5", %{})
      assert {:ok, 30} = FormulaEvaluator.evaluate("10 + 10 + 10", %{})
    end

    test "evaluates subtraction" do
      assert {:ok, 5} = FormulaEvaluator.evaluate("10 - 5", %{})
      assert {:ok, -5} = FormulaEvaluator.evaluate("5 - 10", %{})
    end

    test "evaluates multiplication" do
      assert {:ok, 50} = FormulaEvaluator.evaluate("10 * 5", %{})
      assert {:ok, 200} = FormulaEvaluator.evaluate("10 * 10 * 2", %{})
    end

    test "evaluates division" do
      assert {:ok, 5} = FormulaEvaluator.evaluate("25 / 5", %{})
      assert {:ok, 2} = FormulaEvaluator.evaluate("10 / 4", %{})
    end

    test "evaluates division by zero as 1" do
      assert {:ok, 10} = FormulaEvaluator.evaluate("10 / 0", %{})
    end

    test "evaluates with parentheses" do
      assert {:ok, 30} = FormulaEvaluator.evaluate("(10 + 5) * 2", %{})
      assert {:ok, 20} = FormulaEvaluator.evaluate("10 + (5 * 2)", %{})
      assert {:ok, 14} = FormulaEvaluator.evaluate("2 * (3 + 4)", %{})
    end

    test "evaluates nested parentheses" do
      assert {:ok, 50} = FormulaEvaluator.evaluate("((10 + 5) * 2) + 20", %{})
      # 2 * (3 + (4 * 2)) = 2 * (3 + 8) = 2 * 11 = 22
      assert {:ok, 22} = FormulaEvaluator.evaluate("2 * (3 + (4 * 2))", %{})
    end

    test "evaluates unary minus" do
      assert {:ok, -5} = FormulaEvaluator.evaluate("-5", %{})
      assert {:ok, -15} = FormulaEvaluator.evaluate("-10 - 5", %{})
    end

    test "evaluates with whitespace" do
      assert {:ok, 15} = FormulaEvaluator.evaluate("  10  +  5  ", %{})
      assert {:ok, 30} = FormulaEvaluator.evaluate("\t10\t*\t3\t", %{})
    end

    test "evaluates variable substitution" do
      assert {:ok, 50} = FormulaEvaluator.evaluate("level * 10", %{level: 5})
      assert {:ok, 100} = FormulaEvaluator.evaluate("level * 10", %{level: 10})
    end

    test "evaluates multiple variables" do
      bindings = %{level: 5, sta: 12}
      assert {:ok, 74} = FormulaEvaluator.evaluate("level * 10 + sta * 2", bindings)
    end

    test "evaluates complex formula with variables" do
      bindings = %{level: 10, str: 15, dex: 20}
      assert {:ok, 135} = FormulaEvaluator.evaluate("level * 10 + str + dex", bindings)
    end

    test "defaults unknown variables to 0" do
      assert {:ok, 0} = FormulaEvaluator.evaluate("level * 10", %{})
      assert {:ok, 10} = FormulaEvaluator.evaluate("level * 10 + 10", %{})
    end

    test "accepts atom keys in bindings" do
      assert {:ok, 50} = FormulaEvaluator.evaluate("level * 10", %{level: 5})
    end

    test "accepts string keys in bindings" do
      assert {:ok, 50} = FormulaEvaluator.evaluate("level * 10", %{"level" => 5})
    end

    test "handles string values in bindings" do
      assert {:ok, 50} = FormulaEvaluator.evaluate("level * 10", %{"level" => "5"})
    end

    test "handles errors for non-numeric bindings" do
      # Invalid string numbers will cause an ArgumentError
      assert_raise ArgumentError, fn ->
        FormulaEvaluator.evaluate("level * 10", %{level: "invalid"})
      end
    end

    test "returns error for invalid formula - unexpected character" do
      assert {:error, {:parse_error, _}} = FormulaEvaluator.evaluate("10 & 5", %{})
      assert {:error, {:parse_error, _}} = FormulaEvaluator.evaluate("10 @ 5", %{})
    end

    test "returns error for unclosed parenthesis" do
      assert {:error, {:parse_error, _}} = FormulaEvaluator.evaluate("(10 + 5", %{})
    end

    test "returns error for unexpected end of expression" do
      assert {:error, {:parse_error, _}} = FormulaEvaluator.evaluate("10 +", %{})
      assert {:error, {:parse_error, _}} = FormulaEvaluator.evaluate("10 *", %{})
    end

    test "returns error for non-string formula" do
      assert {:error, {:invalid_formula, _}} = FormulaEvaluator.evaluate(123, %{})
      assert {:error, {:invalid_formula, _}} = FormulaEvaluator.evaluate(nil, %{})
    end

    test "handles empty formula" do
      assert {:error, {:parse_error, _}} = FormulaEvaluator.evaluate("", %{})
    end

    test "respects operator precedence" do
      # Multiplication before addition
      assert {:ok, 17} = FormulaEvaluator.evaluate("2 + 3 * 5", %{})
      # Division before subtraction
      assert {:ok, 5} = FormulaEvaluator.evaluate("10 - 10 / 2", %{})
    end

    test "evaluates left-to-right for same precedence" do
      assert {:ok, 5} = FormulaEvaluator.evaluate("20 / 2 / 2", %{})
      assert {:ok, 8} = FormulaEvaluator.evaluate("10 - 4 + 2", %{})
    end

    test "handles variable names with underscores" do
      assert {:ok, 50} = FormulaEvaluator.evaluate("max_level * 10", %{max_level: 5})
    end

    test "handles mixed case variables" do
      assert {:ok, 100} = FormulaEvaluator.evaluate("MaxHP", %{MaxHP: 100})
    end
  end

  describe "evaluate!/3" do
    test "returns result on success" do
      assert 50 = FormulaEvaluator.evaluate!("level * 10", %{level: 5})
    end

    test "returns default on error" do
      assert 0 = FormulaEvaluator.evaluate!("invalid &", %{}, 0)
      assert 100 = FormulaEvaluator.evaluate!("invalid &", %{}, 100)
    end

    test "returns 0 as default if not specified" do
      assert 0 = FormulaEvaluator.evaluate!("invalid &", %{})
    end

    test "returns default for missing variables when result is NaN" do
      # When all vars are missing and formula divides by them
      result = FormulaEvaluator.evaluate!("100 / level", %{}, 100)
      # Result should be valid since we handle division by zero as 1
      assert is_integer(result)
    end
  end

  describe "real-world resource formulas" do
    test "evaluates typical health formula" do
      stats = %{level: 10, sta: 25}
      assert {:ok, 150} = FormulaEvaluator.evaluate("level * 10 + sta * 2", stats)
    end

    test "evaluates typical mana formula" do
      stats = %{level: 8, int: 30}
      assert {:ok, 140} = FormulaEvaluator.evaluate("level * 10 + int * 2", stats)
    end

    test "evaluates fixed value resource" do
      assert {:ok, 100} = FormulaEvaluator.evaluate("100", %{})
    end

    test "evaluates stamina formula with multiple stats" do
      stats = %{level: 5, sta: 20, str: 15}
      assert {:ok, 105} = FormulaEvaluator.evaluate("level * 10 + sta * 2 + str", stats)
    end

    test "evaluates percentage-based formula" do
      stats = %{max_health: 200}
      assert {:ok, 40} = FormulaEvaluator.evaluate("max_health / 5", stats)
    end

    test "evaluates complex scaling formula" do
      stats = %{level: 15, primary: 40, secondary: 25}
      formula = "(level * 10) + (primary * 3) + (secondary * 2)"
      assert {:ok, 320} = FormulaEvaluator.evaluate(formula, stats)
    end
  end
end
