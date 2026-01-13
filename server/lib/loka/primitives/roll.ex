defmodule Loka.Primitives.Roll do
  @moduledoc """
  Pure data structure for dice rolling and weighted random selection.

  This is a primitive - no game logic, just randomization with audit trails.
  Roll provides dice notation parsing, weighted tables, and success checks.

  ## Dice Notation

  Supports standard dice notation: `NdS+M` or `NdS-M`
  - N = number of dice (default 1)
  - S = sides per die
  - M = modifier (optional)

  Examples: "1d20", "2d6+3", "3d8-2", "d100"

  ## Usage

      alias Loka.Primitives.Roll

      # Dice rolls
      {:ok, result, audit} = Roll.dice("2d6+3")
      result.total     # => 11
      result.rolls     # => [4, 4]
      result.modifier  # => 3

      # Success checks
      {:ok, result, audit} = Roll.check(75)  # 75% success
      result.success   # => true/false
      result.roll      # => 42

      # Weighted selection
      table = [
        {70, :common},
        {25, :uncommon},
        {5, :rare}
      ]
      {:ok, result, audit} = Roll.weighted(table)
      result.selected  # => :common

      # Range roll
      {:ok, result, audit} = Roll.range(10, 20)
      result.value     # => 15
  """

  @type dice_result :: %{
          total: integer(),
          rolls: [integer()],
          dice: integer(),
          sides: integer(),
          modifier: integer(),
          expression: String.t()
        }

  @type check_result :: %{
          success: boolean(),
          roll: integer(),
          target: integer()
        }

  @type weighted_result :: %{
          selected: any(),
          roll: integer(),
          weight: integer()
        }

  @type range_result :: %{
          value: integer(),
          min: integer(),
          max: integer()
        }

  @type audit :: %{
          operation: atom(),
          result: any(),
          timestamp: integer()
        }

  # Dice notation regex: optional count, d, sides, optional +/- modifier
  @dice_regex ~r/^(\d*)d(\d+)([+-]\d+)?$/i

  # =============================================================================
  # Dice Rolls
  # =============================================================================

  @doc """
  Rolls dice using standard notation.

  ## Examples

      Roll.dice("1d20")     # Roll a d20
      Roll.dice("2d6+3")    # Roll 2d6 and add 3
      Roll.dice("3d8-2")    # Roll 3d8 and subtract 2
      Roll.dice("d100")     # Roll percentile (1d100)

  Returns {:ok, result, audit} or {:error, :invalid_notation}.
  """
  @spec dice(String.t()) :: {:ok, dice_result(), audit()} | {:error, :invalid_notation}
  def dice(expression) when is_binary(expression) do
    case parse_dice(expression) do
      {:ok, count, sides, modifier} ->
        rolls = for _ <- 1..count, do: :rand.uniform(sides)
        total = Enum.sum(rolls) + modifier

        result = %{
          total: total,
          rolls: rolls,
          dice: count,
          sides: sides,
          modifier: modifier,
          expression: expression
        }

        audit = %{
          operation: :dice,
          result: result,
          timestamp: System.system_time(:millisecond)
        }

        {:ok, result, audit}

      :error ->
        {:error, :invalid_notation}
    end
  end

  @doc """
  Rolls dice with explicit parameters (no parsing needed).

  ## Examples

      Roll.dice(2, 6, 3)  # 2d6+3
  """
  @spec dice(integer(), integer(), integer()) :: {:ok, dice_result(), audit()}
  def dice(count, sides, modifier \\ 0)
      when is_integer(count) and count > 0 and
             is_integer(sides) and sides > 0 do
    rolls = for _ <- 1..count, do: :rand.uniform(sides)
    total = Enum.sum(rolls) + modifier

    sign = if modifier >= 0, do: "+", else: ""
    mod_str = if modifier != 0, do: "#{sign}#{modifier}", else: ""
    expression = "#{count}d#{sides}#{mod_str}"

    result = %{
      total: total,
      rolls: rolls,
      dice: count,
      sides: sides,
      modifier: modifier,
      expression: expression
    }

    audit = %{
      operation: :dice,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  @doc """
  Shorthand for rolling a single die.

  ## Examples

      Roll.d(20)   # Roll 1d20
      Roll.d(6)    # Roll 1d6
  """
  @spec d(integer()) :: {:ok, dice_result(), audit()}
  def d(sides) when is_integer(sides) and sides > 0 do
    dice(1, sides, 0)
  end

  @doc """
  Rolls multiple dice expressions and sums them.

  ## Examples

      Roll.sum(["1d6", "1d6", "1d6"])  # 3d6 but tracked separately
  """
  @spec sum([String.t()]) :: {:ok, dice_result(), audit()} | {:error, :invalid_notation}
  def sum(expressions) when is_list(expressions) do
    results =
      Enum.reduce_while(expressions, {:ok, []}, fn expr, {:ok, acc} ->
        case dice(expr) do
          {:ok, result, _audit} -> {:cont, {:ok, [result | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)

    case results do
      {:ok, dice_results} ->
        dice_results = Enum.reverse(dice_results)
        total = Enum.sum(Enum.map(dice_results, & &1.total))
        all_rolls = Enum.flat_map(dice_results, & &1.rolls)

        result = %{
          total: total,
          rolls: all_rolls,
          dice: length(all_rolls),
          sides: 0,
          modifier: 0,
          expression: Enum.join(expressions, " + ")
        }

        audit = %{
          operation: :sum,
          result: result,
          timestamp: System.system_time(:millisecond)
        }

        {:ok, result, audit}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # =============================================================================
  # Success Checks
  # =============================================================================

  @doc """
  Performs a percentage-based success check.

  Rolls 1-100 and succeeds if roll <= target.

  ## Examples

      Roll.check(75)   # 75% chance of success
      Roll.check(100)  # Always succeeds
      Roll.check(0)    # Always fails
  """
  @spec check(integer()) :: {:ok, check_result(), audit()}
  def check(target_percent) when is_integer(target_percent) do
    roll = :rand.uniform(100)
    success = roll <= target_percent

    result = %{
      success: success,
      roll: roll,
      target: target_percent
    }

    audit = %{
      operation: :check,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  @doc """
  Performs a check against a target number (like D&D ability checks).

  Rolls the given dice and compares against target.

  ## Examples

      Roll.check_against("1d20+5", 15)  # D&D-style skill check
  """
  @spec check_against(String.t(), integer()) ::
          {:ok, check_result(), audit()} | {:error, :invalid_notation}
  def check_against(dice_expr, target) do
    case dice(dice_expr) do
      {:ok, dice_result, _} ->
        success = dice_result.total >= target

        result = %{
          success: success,
          roll: dice_result.total,
          target: target,
          dice_result: dice_result
        }

        audit = %{
          operation: :check_against,
          result: result,
          timestamp: System.system_time(:millisecond)
        }

        {:ok, result, audit}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # =============================================================================
  # Weighted Selection
  # =============================================================================

  @doc """
  Selects from a weighted table.

  Table format: [{weight, value}, ...]
  Weights don't need to sum to 100.

  ## Examples

      table = [
        {70, :common},
        {25, :uncommon},
        {5, :rare}
      ]
      Roll.weighted(table)
  """
  @spec weighted([{number(), any()}]) :: {:ok, weighted_result(), audit()}
  def weighted(table) when is_list(table) and length(table) > 0 do
    total_weight = table |> Enum.map(&elem(&1, 0)) |> Enum.sum()
    roll = :rand.uniform() * total_weight

    {selected, selected_weight} = select_weighted(table, roll, 0)

    result = %{
      selected: selected,
      roll: Float.round(roll, 2),
      weight: selected_weight
    }

    audit = %{
      operation: :weighted,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  defp select_weighted([{weight, value}], _roll, _acc), do: {value, weight}

  defp select_weighted([{weight, value} | rest], roll, acc) do
    if roll <= acc + weight do
      {value, weight}
    else
      select_weighted(rest, roll, acc + weight)
    end
  end

  @doc """
  Selects from a table with equal weights.

  ## Examples

      Roll.pick([:sword, :axe, :mace, :dagger])
  """
  @spec pick([any()]) :: {:ok, weighted_result(), audit()}
  def pick(items) when is_list(items) and length(items) > 0 do
    table = Enum.map(items, &{1, &1})
    weighted(table)
  end

  # =============================================================================
  # Range Rolls
  # =============================================================================

  @doc """
  Rolls a random integer in a range (inclusive).

  ## Examples

      Roll.range(10, 20)   # Random between 10 and 20
      Roll.range(1, 100)   # Percentile
  """
  @spec range(integer(), integer()) :: {:ok, range_result(), audit()}
  def range(min_val, max_val) when min_val <= max_val do
    value = min_val + :rand.uniform(max_val - min_val + 1) - 1

    result = %{
      value: value,
      min: min_val,
      max: max_val
    }

    audit = %{
      operation: :range,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  @doc """
  Rolls a random float in a range.

  ## Examples

      Roll.range_float(0.5, 1.5)  # Damage variance
  """
  @spec range_float(number(), number()) :: {:ok, range_result(), audit()}
  def range_float(min_val, max_val) when min_val <= max_val do
    value = min_val + :rand.uniform() * (max_val - min_val)

    result = %{
      value: Float.round(value, 4),
      min: min_val,
      max: max_val
    }

    audit = %{
      operation: :range_float,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  # =============================================================================
  # Utility Functions
  # =============================================================================

  @doc """
  Parses a dice expression without rolling.

  Returns {:ok, count, sides, modifier} or :error.
  """
  @spec parse_dice(String.t()) :: {:ok, integer(), integer(), integer()} | :error
  def parse_dice(expression) when is_binary(expression) do
    case Regex.run(@dice_regex, String.trim(expression)) do
      [_, count_str, sides_str] ->
        count = if count_str == "", do: 1, else: String.to_integer(count_str)
        sides = String.to_integer(sides_str)
        {:ok, count, sides, 0}

      [_, count_str, sides_str, modifier_str] ->
        count = if count_str == "", do: 1, else: String.to_integer(count_str)
        sides = String.to_integer(sides_str)
        modifier = String.to_integer(modifier_str)
        {:ok, count, sides, modifier}

      nil ->
        :error
    end
  end

  @doc """
  Returns the minimum possible value for a dice expression.
  """
  @spec min_value(String.t()) :: integer() | nil
  def min_value(expression) do
    case parse_dice(expression) do
      {:ok, count, _sides, modifier} -> count + modifier
      :error -> nil
    end
  end

  @doc """
  Returns the maximum possible value for a dice expression.
  """
  @spec max_value(String.t()) :: integer() | nil
  def max_value(expression) do
    case parse_dice(expression) do
      {:ok, count, sides, modifier} -> count * sides + modifier
      :error -> nil
    end
  end

  @doc """
  Returns the average value for a dice expression.
  """
  @spec average(String.t()) :: float() | nil
  def average(expression) do
    case parse_dice(expression) do
      {:ok, count, sides, modifier} ->
        count * (sides + 1) / 2 + modifier

      :error ->
        nil
    end
  end
end
