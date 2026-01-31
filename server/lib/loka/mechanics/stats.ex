defmodule Loka.Mechanics.Stats do
  @moduledoc """
  Character stats system - 6 primary stats with allocation rules.

  All configurable values are loaded from `priv/config/balance.yml` under the
  `stats` section. This module reads from Balance config with sensible defaults.

  ## The Six Stats

  | Stat | Abbr | Primary Role | Combat Bonus |
  |------|------|--------------|--------------|
  | Strength | STR | Physical power | Slashing damage |
  | Dexterity | DEX | Speed, precision | Piercing damage, dodge |
  | Constitution | CON | Durability | Bludgeoning damage, HP |
  | Intelligence | INT | Mental capacity | Mana pool, spell damage |
  | Perception | PER | Awareness | Crit chance, detection |
  | Spirit | SPI | Magical healing | Heal power, magic resist |

  ## Allocation Rules (from Balance config)

  - **Starting pool:** 60 points at character creation
  - **Min per stat:** 5
  - **Max per stat at creation:** 30
  - **Per level:** +5 stat points
  - **Level 50 total:** ~300 points (60 base + 240 from levels)
  - **Max per stat:** 100

  ## Configuration

  These values are configurable in `priv/config/balance.yml`:

      stats:
        creation:
          pool: 60
          min_per_stat: 5
          max_per_stat: 30
        points_per_level: 5
        max_stat: 100
        max_level: 50

  ## Usage

      alias Loka.Mechanics.Stats

      # Validate creation allocation
      stats = %{str: 15, dex: 12, con: 10, int: 8, per: 8, spi: 7}
      {:ok, stats} = Stats.validate_creation(stats)

      # Allocate on level up
      {:ok, new_stats} = Stats.allocate(stats, :str, 3)

      # Get stat total
      Stats.total(stats)  # => 60
  """

  alias Loka.Config.Balance

  @type stat :: :str | :dex | :con | :int | :per | :spi
  @type stats :: %{
          str: non_neg_integer(),
          dex: non_neg_integer(),
          con: non_neg_integer(),
          int: non_neg_integer(),
          per: non_neg_integer(),
          spi: non_neg_integer()
        }

  @all_stats [:str, :dex, :con, :int, :per, :spi]

  # Defaults (used when Balance config not loaded)
  @default_creation_pool 60
  @default_creation_min 5
  @default_creation_max 30
  @default_points_per_level 5
  @default_max_stat 100
  @default_max_level 50

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Returns list of all stat keys.
  """
  @spec all() :: [stat()]
  def all, do: @all_stats

  @doc """
  Returns the default stats for a new character (10 in each).
  """
  @spec default() :: stats()
  def default do
    %{str: 10, dex: 10, con: 10, int: 10, per: 10, spi: 10}
  end

  @doc """
  Calculates total stat points allocated.
  """
  @spec total(stats()) :: non_neg_integer()
  def total(stats) do
    Enum.reduce(@all_stats, 0, fn stat, acc ->
      acc + Map.get(stats, stat, 0)
    end)
  end

  @doc """
  Returns points available at a given level.

  Level 1: 60 points (creation pool)
  Level N: 60 + (N-1) * 5
  """
  @spec points_at_level(pos_integer()) :: pos_integer()
  def points_at_level(level) when level >= 1 do
    creation_pool() + (level - 1) * points_per_level()
  end

  @doc """
  Returns unspent stat points for a character.
  """
  @spec unspent_points(stats(), pos_integer()) :: integer()
  def unspent_points(stats, level) do
    points_at_level(level) - total(stats)
  end

  # =============================================================================
  # Creation Validation
  # =============================================================================

  @doc """
  Validates stat allocation for character creation.

  Rules:
  - Total must equal 60 points
  - Each stat must be between 5-30
  - All 6 stats must be present

  ## Examples

      stats = %{str: 15, dex: 12, con: 10, int: 8, per: 8, spi: 7}
      {:ok, stats} = Stats.validate_creation(stats)

      # Too many points
      {:error, {:invalid_total, 65, 60}} = Stats.validate_creation(%{str: 20, ...})

      # Stat too low
      {:error, {:stat_below_min, :str, 3, 5}} = Stats.validate_creation(%{str: 3, ...})
  """
  @spec validate_creation(stats()) :: {:ok, stats()} | {:error, term()}
  def validate_creation(stats) do
    with :ok <- validate_all_stats_present(stats),
         :ok <- validate_stat_bounds(stats, creation_min(), creation_max()),
         :ok <- validate_total(stats, creation_pool()) do
      {:ok, normalize(stats)}
    end
  end

  @doc """
  Validates and normalizes stats from external input (e.g., YAML, database).

  More permissive than creation validation - allows any valid stat values.
  """
  @spec validate(stats()) :: {:ok, stats()} | {:error, term()}
  def validate(stats) do
    with :ok <- validate_all_stats_present(stats),
         :ok <- validate_stat_bounds(stats, 0, max_stat()) do
      {:ok, normalize(stats)}
    end
  end

  # =============================================================================
  # Stat Allocation
  # =============================================================================

  @doc """
  Allocates points to a stat.

  Returns error if:
  - Not enough unspent points
  - Would exceed max stat (100)
  - Invalid stat key

  ## Examples

      stats = %{str: 15, dex: 12, con: 10, int: 8, per: 8, spi: 7}
      {:ok, new_stats, audit} = Stats.allocate(stats, :str, 3, level: 2)

      # Not enough points
      {:error, {:insufficient_points, 5, 10}} = Stats.allocate(stats, :str, 10, level: 1)
  """
  @spec allocate(stats(), stat(), pos_integer(), keyword()) ::
          {:ok, stats(), map()} | {:error, term()}
  def allocate(stats, stat, points, opts \\ []) when points > 0 do
    level = Keyword.get(opts, :level, 1)

    with :ok <- validate_stat_key(stat),
         :ok <- validate_has_points(stats, points, level),
         :ok <- validate_not_exceeds_max(stats, stat, points) do
      current = Map.get(stats, stat, 0)
      new_stats = Map.put(stats, stat, current + points)

      audit = %{
        operation: :allocate_stat,
        stat: stat,
        before: current,
        after: current + points,
        points_spent: points,
        level: level,
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_stats, audit}
    end
  end

  @doc """
  Allocates multiple stat points at once (e.g., for level up).

  ## Examples

      allocations = %{str: 2, dex: 2, con: 1}
      {:ok, new_stats, audit} = Stats.allocate_many(stats, allocations, level: 2)
  """
  @spec allocate_many(stats(), map(), keyword()) :: {:ok, stats(), map()} | {:error, term()}
  def allocate_many(stats, allocations, opts \\ []) when is_map(allocations) do
    level = Keyword.get(opts, :level, 1)
    total_points = Enum.reduce(allocations, 0, fn {_stat, pts}, acc -> acc + pts end)

    with :ok <- validate_allocation_keys(allocations),
         :ok <- validate_has_points(stats, total_points, level),
         :ok <- validate_allocations_not_exceed_max(stats, allocations) do
      new_stats =
        Enum.reduce(allocations, stats, fn {stat, points}, acc ->
          Map.update!(acc, stat, &(&1 + points))
        end)

      changes =
        Enum.map(allocations, fn {stat, _points} ->
          %{stat: stat, before: Map.get(stats, stat), after: Map.get(new_stats, stat)}
        end)

      audit = %{
        operation: :allocate_stats,
        changes: changes,
        total_points_spent: total_points,
        level: level,
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_stats, audit}
    end
  end

  # =============================================================================
  # Stat Lookup
  # =============================================================================

  @doc """
  Gets a stat value, with optional default.
  """
  @spec get(stats(), stat(), non_neg_integer()) :: non_neg_integer()
  def get(stats, stat, default \\ 0) do
    Map.get(stats, stat, default)
  end

  @doc """
  Gets multiple stats as a map.
  """
  @spec get_many(stats(), [stat()]) :: map()
  def get_many(stats, stat_keys) do
    Map.take(stats, stat_keys)
  end

  # =============================================================================
  # Stat Names and Display
  # =============================================================================

  @doc """
  Returns the full name of a stat.
  """
  @spec name(stat()) :: String.t()
  def name(:str), do: "Strength"
  def name(:dex), do: "Dexterity"
  def name(:con), do: "Constitution"
  def name(:int), do: "Intelligence"
  def name(:per), do: "Perception"
  def name(:spi), do: "Spirit"
  def name(_), do: "Unknown"

  @doc """
  Returns the abbreviation of a stat.
  """
  @spec abbrev(stat()) :: String.t()
  def abbrev(:str), do: "STR"
  def abbrev(:dex), do: "DEX"
  def abbrev(:con), do: "CON"
  def abbrev(:int), do: "INT"
  def abbrev(:per), do: "PER"
  def abbrev(:spi), do: "SPI"
  def abbrev(_), do: "???"

  @doc """
  Returns stat description.
  """
  @spec description(stat()) :: String.t()
  def description(:str), do: "Physical power. Increases slashing damage."
  def description(:dex), do: "Speed and precision. Increases piercing damage and dodge chance."
  def description(:con), do: "Durability. Increases bludgeoning damage, HP, and poison resist."
  def description(:int), do: "Mental capacity. Increases mana pool and spell damage."
  def description(:per), do: "Awareness. Increases critical hit chance and detection."
  def description(:spi), do: "Magical healing. Increases healing power and magic resist."
  def description(_), do: "Unknown stat."

  # =============================================================================
  # Constants Access (from Balance config)
  # =============================================================================

  @doc "Returns creation point pool (default: 60)."
  @spec creation_pool() :: pos_integer()
  def creation_pool do
    Balance.get(:stats, :creation, :pool, default: @default_creation_pool)
  end

  @doc "Returns minimum stat at creation (default: 5)."
  @spec creation_min() :: non_neg_integer()
  def creation_min do
    Balance.get(:stats, :creation, :min_per_stat, default: @default_creation_min)
  end

  @doc "Returns maximum stat at creation (default: 30)."
  @spec creation_max() :: pos_integer()
  def creation_max do
    Balance.get(:stats, :creation, :max_per_stat, default: @default_creation_max)
  end

  @doc "Returns points gained per level (default: 5)."
  @spec points_per_level() :: pos_integer()
  def points_per_level do
    Balance.get(:stats, :points_per_level, default: @default_points_per_level)
  end

  @doc "Returns maximum value for any stat (default: 100)."
  @spec max_stat() :: pos_integer()
  def max_stat do
    Balance.get(:stats, :max_stat, default: @default_max_stat)
  end

  @doc "Returns maximum character level (default: 50)."
  @spec max_level() :: pos_integer()
  def max_level do
    Balance.get(:stats, :max_level, default: @default_max_level)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp normalize(stats) do
    %{
      str: Map.get(stats, :str) || Map.get(stats, "str", 0),
      dex: Map.get(stats, :dex) || Map.get(stats, "dex", 0),
      con: Map.get(stats, :con) || Map.get(stats, "con", 0),
      int: Map.get(stats, :int) || Map.get(stats, "int", 0),
      per: Map.get(stats, :per) || Map.get(stats, "per", 0),
      spi: Map.get(stats, :spi) || Map.get(stats, "spi", 0)
    }
  end

  defp validate_all_stats_present(stats) do
    missing =
      Enum.filter(@all_stats, fn stat ->
        not (Map.has_key?(stats, stat) or Map.has_key?(stats, to_string(stat)))
      end)

    case missing do
      [] -> :ok
      _ -> {:error, {:missing_stats, missing}}
    end
  end

  defp validate_stat_bounds(stats, min, max) do
    Enum.reduce_while(@all_stats, :ok, fn stat, _acc ->
      value = Map.get(stats, stat) || Map.get(stats, to_string(stat), 0)

      cond do
        value < min -> {:halt, {:error, {:stat_below_min, stat, value, min}}}
        value > max -> {:halt, {:error, {:stat_above_max, stat, value, max}}}
        true -> {:cont, :ok}
      end
    end)
  end

  defp validate_total(stats, expected) do
    actual = total(normalize(stats))

    if actual == expected do
      :ok
    else
      {:error, {:invalid_total, actual, expected}}
    end
  end

  defp validate_stat_key(stat) when stat in @all_stats, do: :ok
  defp validate_stat_key(stat), do: {:error, {:invalid_stat, stat}}

  defp validate_allocation_keys(allocations) do
    invalid = Enum.filter(Map.keys(allocations), fn k -> k not in @all_stats end)

    case invalid do
      [] -> :ok
      _ -> {:error, {:invalid_stats, invalid}}
    end
  end

  defp validate_has_points(stats, points_needed, level) do
    available = unspent_points(stats, level)

    if available >= points_needed do
      :ok
    else
      {:error, {:insufficient_points, available, points_needed}}
    end
  end

  defp validate_not_exceeds_max(stats, stat, points) do
    current = Map.get(stats, stat, 0)
    new_value = current + points
    max = max_stat()

    if new_value <= max do
      :ok
    else
      {:error, {:exceeds_max, stat, new_value, max}}
    end
  end

  defp validate_allocations_not_exceed_max(stats, allocations) do
    max = max_stat()

    Enum.reduce_while(allocations, :ok, fn {stat, points}, _acc ->
      current = Map.get(stats, stat, 0)
      new_value = current + points

      if new_value <= max do
        {:cont, :ok}
      else
        {:halt, {:error, {:exceeds_max, stat, new_value, max}}}
      end
    end)
  end
end
