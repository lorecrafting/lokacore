defmodule Loka.Mechanics.Check do
  @moduledoc """
  Check mechanic - skill checks and stat comparisons with full audit trail.

  Uses Roll primitive to perform success checks based on skills, stats,
  and difficulty levels from Balance config.

  ## Usage

      alias Loka.Mechanics.Check

      # Percentage-based check
      {:ok, result, audit} = Check.percent(75)
      result.success  # => true/false

      # Skill check (D&D-style)
      context = %{skill_level: 5, dex: 14}
      {:ok, result, audit} = Check.skill(context, difficulty: :normal)

      # Opposed check
      {:ok, result, audit} = Check.opposed(%{str: 18}, %{str: 14})

      # Stat comparison
      Check.compare(%{level: 10}, %{level: 8}, :level)
      # => {:gt, 2}  # First is greater by 2

  ## Difficulty Levels

  Configured in balance.yml:
  - `:trivial` - Very easy (-20 modifier)
  - `:easy` - Below average (-10)
  - `:normal` - Standard (0)
  - `:hard` - Challenging (+10)
  - `:very_hard` - Very challenging (+20)
  - `:legendary` - Nearly impossible (+30)

  ## Audit Trail

  Every operation returns a detailed audit map:

      %{
        operation: :skill_check,
        roll: 17,
        target: 15,
        difficulty: :normal,
        modifier: 0,
        success: true,
        margin: 2,
        timestamp: 1704067200000
      }
  """

  alias Loka.Primitives.Roll
  alias Loka.Config.Balance

  @type context :: %{
          optional(:skill_level) => number(),
          optional(:str) => number(),
          optional(:dex) => number(),
          optional(:sta) => number(),
          optional(:int) => number(),
          optional(:wis) => number(),
          optional(:cha) => number(),
          optional(:stat) => number(),
          optional(:level) => number()
        }

  @type difficulty :: :trivial | :easy | :normal | :hard | :very_hard | :legendary

  @type check_result :: %{
          success: boolean(),
          roll: number(),
          target: number(),
          margin: number(),
          critical_success: boolean(),
          critical_failure: boolean()
        }

  @type audit :: %{
          operation: atom(),
          result: check_result(),
          timestamp: integer()
        }

  @difficulties [:trivial, :easy, :normal, :hard, :very_hard, :legendary]

  # =============================================================================
  # Percentage Checks
  # =============================================================================

  @doc """
  Performs a simple percentage-based success check.

  Rolls 1-100 and succeeds if roll <= target_percent.

  ## Examples

      {:ok, result, audit} = Check.percent(75)  # 75% chance
      result.success  # => true/false
      result.roll     # => 42
  """
  @spec percent(number()) :: {:ok, check_result(), audit()}
  def percent(target_percent) when is_number(target_percent) do
    {:ok, roll_result, _} = Roll.check(trunc(target_percent))

    result = %{
      success: roll_result.success,
      roll: roll_result.roll,
      target: target_percent,
      margin: target_percent - roll_result.roll,
      critical_success: roll_result.roll <= 5,
      critical_failure: roll_result.roll >= 96
    }

    audit = %{
      operation: :percent_check,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  # =============================================================================
  # Skill Checks
  # =============================================================================

  @doc """
  Performs a skill check based on skill level and stat.

  Uses formula from Balance config: skill_level * 5 + stat

  ## Options

  - `:difficulty` - Difficulty level (default: :normal)
  - `:stat` - Override which stat to use
  - `:bonus` - Additional flat bonus

  ## Examples

      context = %{skill_level: 5, dex: 14}
      {:ok, result, audit} = Check.skill(context, difficulty: :hard)
  """
  @spec skill(context(), keyword()) :: {:ok, check_result(), audit()}
  def skill(context, opts \\ []) do
    difficulty = Keyword.get(opts, :difficulty, :normal)
    bonus = Keyword.get(opts, :bonus, 0)

    # Get difficulty modifier from config
    difficulty_modifier = get_difficulty_modifier(difficulty)

    # Calculate skill bonus
    skill_level = Map.get(context, :skill_level, 0)
    stat = Keyword.get(opts, :stat) || Map.get(context, :stat, 0)

    # Base formula: skill_level * 5 + stat
    skill_formula_result =
      Balance.eval_formula(:combat, :checks, :base_formula, %{
        skill_level: skill_level,
        stat: stat
      })

    skill_bonus = skill_formula_result || skill_level * 5 + stat

    # Calculate target (base 50% + skill bonus - difficulty)
    base_target = 50 + skill_bonus + bonus - difficulty_modifier
    # Clamp to 5-95%
    target = max(5, min(95, base_target))

    {:ok, roll_result, _} = Roll.check(trunc(target))

    result = %{
      success: roll_result.success,
      roll: roll_result.roll,
      target: target,
      difficulty: difficulty,
      difficulty_modifier: difficulty_modifier,
      skill_bonus: skill_bonus,
      margin: target - roll_result.roll,
      critical_success: roll_result.roll <= 5,
      critical_failure: roll_result.roll >= 96
    }

    audit = %{
      operation: :skill_check,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  @doc """
  Performs a skill check against a specific DC (Difficulty Class).

  Rolls dice and compares against target DC.

  ## Options

  - `:dice` - Dice expression (default: "1d20")
  - `:bonus` - Flat bonus to roll

  ## Examples

      context = %{skill_level: 5, dex: 14}
      {:ok, result, audit} = Check.against_dc(context, 15, dice: "1d20")
  """
  @spec against_dc(context(), number(), keyword()) :: {:ok, check_result(), audit()}
  def against_dc(context, dc, opts \\ []) do
    dice = Keyword.get(opts, :dice, "1d20")
    bonus = Keyword.get(opts, :bonus, 0)

    skill_level = Map.get(context, :skill_level, 0)
    stat = Map.get(context, :stat, 0)

    total_bonus = skill_level + stat + bonus

    {:ok, dice_result, _} = Roll.dice(dice)
    total_roll = dice_result.total + total_bonus

    success = total_roll >= dc

    # Check for natural 20 or natural 1
    natural_20 = dice_result.total == dice_result.sides
    natural_1 = dice_result.total == 1

    result = %{
      success: success,
      roll: total_roll,
      natural_roll: dice_result.total,
      target: dc,
      bonus: total_bonus,
      margin: total_roll - dc,
      critical_success: natural_20,
      critical_failure: natural_1
    }

    audit = %{
      operation: :dc_check,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  # =============================================================================
  # Opposed Checks
  # =============================================================================

  @doc """
  Performs an opposed check between two entities.

  Both roll and add their stat, higher wins.

  ## Options

  - `:stat` - Which stat to compare (default: :str)
  - `:dice` - Dice expression (default: "1d20")

  ## Examples

      {:ok, result, audit} = Check.opposed(%{str: 18}, %{str: 14}, stat: :str)
      result.winner  # => :first or :second or :tie
  """
  @spec opposed(context(), context(), keyword()) :: {:ok, map(), audit()}
  def opposed(first, second, opts \\ []) do
    stat_key = Keyword.get(opts, :stat, :str)
    dice = Keyword.get(opts, :dice, "1d20")

    first_stat = Map.get(first, stat_key, 0)
    second_stat = Map.get(second, stat_key, 0)

    {:ok, first_roll, _} = Roll.dice(dice)
    {:ok, second_roll, _} = Roll.dice(dice)

    first_total = first_roll.total + first_stat
    second_total = second_roll.total + second_stat

    winner =
      cond do
        first_total > second_total -> :first
        second_total > first_total -> :second
        true -> :tie
      end

    result = %{
      winner: winner,
      first: %{
        roll: first_roll.total,
        stat: first_stat,
        total: first_total
      },
      second: %{
        roll: second_roll.total,
        stat: second_stat,
        total: second_total
      },
      margin: abs(first_total - second_total)
    }

    audit = %{
      operation: :opposed_check,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, result, audit}
  end

  # =============================================================================
  # Stat Comparisons
  # =============================================================================

  @doc """
  Compares a stat between two contexts.

  Returns {:gt | :lt | :eq, difference}

  ## Examples

      Check.compare(%{level: 10}, %{level: 8}, :level)
      # => {:gt, 2}

      Check.compare(%{str: 14}, %{str: 18}, :str)
      # => {:lt, 4}
  """
  @spec compare(context(), context(), atom()) :: {:gt | :lt | :eq, number()}
  def compare(first, second, stat_key) do
    first_value = Map.get(first, stat_key, 0)
    second_value = Map.get(second, stat_key, 0)
    difference = abs(first_value - second_value)

    cond do
      first_value > second_value -> {:gt, difference}
      first_value < second_value -> {:lt, difference}
      true -> {:eq, 0}
    end
  end

  @doc """
  Returns true if first has higher stat than second.
  """
  @spec higher?(context(), context(), atom()) :: boolean()
  def higher?(first, second, stat_key) do
    case compare(first, second, stat_key) do
      {:gt, _} -> true
      _ -> false
    end
  end

  @doc """
  Returns the context with the higher stat value.
  """
  @spec higher(context(), context(), atom()) :: context()
  def higher(first, second, stat_key) do
    if higher?(first, second, stat_key), do: first, else: second
  end

  # =============================================================================
  # Utility Functions
  # =============================================================================

  @doc """
  Returns all valid difficulty levels.
  """
  @spec difficulties() :: [difficulty()]
  def difficulties, do: @difficulties

  @doc """
  Gets the modifier for a difficulty level.
  """
  @spec get_difficulty_modifier(difficulty()) :: number()
  def get_difficulty_modifier(difficulty) when difficulty in @difficulties do
    config = Balance.get(:combat, :checks, :difficulty, default: %{})

    case difficulty do
      :trivial -> get_nested(config, :trivial, -20)
      :easy -> get_nested(config, :easy, -10)
      :normal -> get_nested(config, :normal, 0)
      :hard -> get_nested(config, :hard, 10)
      :very_hard -> get_nested(config, :very_hard, 20)
      :legendary -> get_nested(config, :legendary, 30)
    end
  end

  def get_difficulty_modifier(_), do: 0

  @doc """
  Calculates success chance for a skill check.

  Useful for displaying to the player before they commit.
  """
  @spec success_chance(context(), keyword()) :: number()
  def success_chance(context, opts \\ []) do
    difficulty = Keyword.get(opts, :difficulty, :normal)
    bonus = Keyword.get(opts, :bonus, 0)

    difficulty_modifier = get_difficulty_modifier(difficulty)

    skill_level = Map.get(context, :skill_level, 0)
    stat = Map.get(context, :stat, 0)

    skill_bonus = skill_level * 5 + stat

    base_target = 50 + skill_bonus + bonus - difficulty_modifier
    max(5, min(95, base_target))
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_nested(map, key, default) when is_map(map) do
    Map.get(map, key) || Map.get(map, to_string(key)) || default
  end

  defp get_nested(_, _, default), do: default
end
