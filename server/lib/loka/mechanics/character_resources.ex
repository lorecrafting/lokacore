defmodule Loka.Mechanics.CharacterResources do
  @moduledoc """
  Character resource calculations for HP, Mana, and MV (Movement).

  Uses the 6-stat system to calculate maximum values and regeneration rates.
  All formulas are configurable via `priv/config/balance.yml` under `character_resources`.

  ## Resource Formulas (from Balance config)

  | Resource | Formula | Regen Rate |
  |----------|---------|------------|
  | HP | 50 + (CON × 4) + (Level × 2) | Via healing/rest |
  | Mana | 20 + (INT × 3) + (SPI × 2) | 5 + (INT / 5) per tick |
  | MV | 100 + (CON × 2) + (DEX × 2) | 10 + (DEX / 5) per tick |

  **Tick interval:** 5 seconds

  ## Configuration

  These values are configurable in `priv/config/balance.yml`:

      character_resources:
        hp:
          base: 50
          con_multiplier: 4
          level_multiplier: 2
        mana:
          base: 20
          int_multiplier: 3
          spi_multiplier: 2
          regen_base: 5
          regen_int_divisor: 5
        mv:
          base: 100
          con_multiplier: 2
          dex_multiplier: 2
          regen_base: 10
          regen_dex_divisor: 5
        tick_interval_ms: 5000
        combat_regen_multiplier: 0.5

  ## Usage

      alias Loka.Mechanics.CharacterResources

      stats = %{str: 15, dex: 12, con: 10, int: 8, per: 8, spi: 7}
      level = 5

      CharacterResources.max_hp(stats, level)    # => 80
      CharacterResources.max_mana(stats, level)  # => 58
      CharacterResources.max_mv(stats, level)    # => 144

      # Get all resources
      CharacterResources.all_max(stats, level)
      # => %{hp: 80, mana: 58, mv: 144}
  """

  alias Loka.Config.Balance
  alias Loka.Primitives.ResourcePool

  # Defaults (used when Balance config not loaded)
  @default_tick_interval_ms 5_000
  @default_combat_regen_mult 0.5

  # =============================================================================
  # Maximum Value Calculations
  # =============================================================================

  @doc """
  Calculates maximum HP.

  Formula: base + (CON × con_mult) + (Level × level_mult)
  Default: 50 + (CON × 4) + (Level × 2)

  ## Examples

      iex> CharacterResources.max_hp(%{con: 40}, 1)
      212

      iex> CharacterResources.max_hp(%{con: 80}, 50)
      470
  """
  @spec max_hp(map(), pos_integer()) :: pos_integer()
  def max_hp(stats, level) do
    con = get_stat(stats, :con)
    base = Balance.get(:character_resources, :hp, :base, default: 50)
    con_mult = Balance.get(:character_resources, :hp, :con_multiplier, default: 4)
    level_mult = Balance.get(:character_resources, :hp, :level_multiplier, default: 2)
    base + con * con_mult + level * level_mult
  end

  @doc """
  Calculates maximum Mana.

  Formula: base + (INT × int_mult) + (SPI × spi_mult)
  Default: 20 + (INT × 3) + (SPI × 2)

  ## Examples

      iex> CharacterResources.max_mana(%{int: 80, spi: 80}, 1)
      420

      iex> CharacterResources.max_mana(%{int: 20, spi: 20}, 1)
      120
  """
  @spec max_mana(map(), pos_integer()) :: pos_integer()
  def max_mana(stats, _level) do
    int = get_stat(stats, :int)
    spi = get_stat(stats, :spi)
    base = Balance.get(:character_resources, :mana, :base, default: 20)
    int_mult = Balance.get(:character_resources, :mana, :int_multiplier, default: 3)
    spi_mult = Balance.get(:character_resources, :mana, :spi_multiplier, default: 2)
    base + int * int_mult + spi * spi_mult
  end

  @doc """
  Calculates maximum Movement Points.

  Formula: base + (CON × con_mult) + (DEX × dex_mult)
  Default: 100 + (CON × 2) + (DEX × 2)

  ## Examples

      iex> CharacterResources.max_mv(%{con: 80, dex: 40}, 1)
      340

      iex> CharacterResources.max_mv(%{con: 40, dex: 80}, 1)
      340
  """
  @spec max_mv(map(), pos_integer()) :: pos_integer()
  def max_mv(stats, _level) do
    con = get_stat(stats, :con)
    dex = get_stat(stats, :dex)
    base = Balance.get(:character_resources, :mv, :base, default: 100)
    con_mult = Balance.get(:character_resources, :mv, :con_multiplier, default: 2)
    dex_mult = Balance.get(:character_resources, :mv, :dex_multiplier, default: 2)
    base + con * con_mult + dex * dex_mult
  end

  @doc """
  Returns all maximum resource values as a map.
  """
  @spec all_max(map(), pos_integer()) :: %{
          hp: pos_integer(),
          mana: pos_integer(),
          mv: pos_integer()
        }
  def all_max(stats, level) do
    %{
      hp: max_hp(stats, level),
      mana: max_mana(stats, level),
      mv: max_mv(stats, level)
    }
  end

  # =============================================================================
  # Regeneration Rates
  # =============================================================================

  @doc """
  Returns HP regeneration rate per tick.

  HP does not regenerate automatically (requires healing or rest).
  """
  @spec hp_regen_rate(map()) :: non_neg_integer()
  def hp_regen_rate(_stats), do: 0

  @doc """
  Calculates Mana regeneration rate per tick.

  Formula: regen_base + (INT / regen_int_divisor)
  Default: 5 + (INT / 5)

  ## Examples

      iex> CharacterResources.mana_regen_rate(%{int: 50})
      15

      iex> CharacterResources.mana_regen_rate(%{int: 80})
      21
  """
  @spec mana_regen_rate(map()) :: pos_integer()
  def mana_regen_rate(stats) do
    int = get_stat(stats, :int)
    base = Balance.get(:character_resources, :mana, :regen_base, default: 5)
    divisor = Balance.get(:character_resources, :mana, :regen_int_divisor, default: 5)
    base + div(int, divisor)
  end

  @doc """
  Calculates MV regeneration rate per tick.

  Formula: regen_base + (DEX / regen_dex_divisor)
  Default: 10 + (DEX / 5)

  ## Examples

      iex> CharacterResources.mv_regen_rate(%{dex: 50})
      20

      iex> CharacterResources.mv_regen_rate(%{dex: 80})
      26
  """
  @spec mv_regen_rate(map()) :: pos_integer()
  def mv_regen_rate(stats) do
    dex = get_stat(stats, :dex)
    base = Balance.get(:character_resources, :mv, :regen_base, default: 10)
    divisor = Balance.get(:character_resources, :mv, :regen_dex_divisor, default: 5)
    base + div(dex, divisor)
  end

  @doc """
  Returns all regeneration rates as a map.
  """
  @spec all_regen_rates(map()) :: %{hp: non_neg_integer(), mana: pos_integer(), mv: pos_integer()}
  def all_regen_rates(stats) do
    %{
      hp: hp_regen_rate(stats),
      mana: mana_regen_rate(stats),
      mv: mv_regen_rate(stats)
    }
  end

  @doc """
  Returns the tick interval in milliseconds (default: 5000 = 5 seconds).
  """
  @spec tick_interval() :: pos_integer()
  def tick_interval do
    Balance.get(:character_resources, :tick_interval_ms, default: @default_tick_interval_ms)
  end

  # =============================================================================
  # Resource Pool Creation
  # =============================================================================

  @doc """
  Creates a fresh ResourcePool for HP.
  """
  @spec create_hp_pool(map(), pos_integer()) :: ResourcePool.t()
  def create_hp_pool(stats, level) do
    max = max_hp(stats, level)
    ResourcePool.new(current: max, max: max, min: 0)
  end

  @doc """
  Creates a fresh ResourcePool for Mana.
  """
  @spec create_mana_pool(map(), pos_integer()) :: ResourcePool.t()
  def create_mana_pool(stats, level) do
    max = max_mana(stats, level)
    ResourcePool.new(current: max, max: max, min: 0)
  end

  @doc """
  Creates a fresh ResourcePool for MV.
  """
  @spec create_mv_pool(map(), pos_integer()) :: ResourcePool.t()
  def create_mv_pool(stats, level) do
    max = max_mv(stats, level)
    ResourcePool.new(current: max, max: max, min: 0)
  end

  @doc """
  Creates all resource pools as a map.

  ## Example

      pools = CharacterResources.create_all_pools(stats, level)
      # => %{hp: %ResourcePool{...}, mana: %ResourcePool{...}, mv: %ResourcePool{...}}
  """
  @spec create_all_pools(map(), pos_integer()) :: %{
          hp: ResourcePool.t(),
          mana: ResourcePool.t(),
          mv: ResourcePool.t()
        }
  def create_all_pools(stats, level) do
    %{
      hp: create_hp_pool(stats, level),
      mana: create_mana_pool(stats, level),
      mv: create_mv_pool(stats, level)
    }
  end

  # =============================================================================
  # Resource Update on Level/Stat Change
  # =============================================================================

  @doc """
  Updates resource pools when stats or level change.

  Adjusts max values and current values proportionally.

  ## Example

      old_pools = %{hp: %ResourcePool{current: 50, max: 100}, ...}
      new_pools = CharacterResources.update_pools(old_pools, new_stats, new_level)
  """
  @spec update_pools(map(), map(), pos_integer()) :: map()
  def update_pools(current_pools, stats, level) do
    %{
      hp: update_pool(current_pools.hp, max_hp(stats, level)),
      mana: update_pool(current_pools.mana, max_mana(stats, level)),
      mv: update_pool(current_pools.mv, max_mv(stats, level))
    }
  end

  defp update_pool(%ResourcePool{} = pool, new_max) do
    old_max = pool.max
    old_current = pool.current

    # Calculate new current proportionally (if max increased, current increases too)
    # If at max, stay at max. Otherwise, scale proportionally but add any new capacity.
    new_current =
      if old_current >= old_max do
        new_max
      else
        # Add the difference in max to current (player gets the benefit of stat increase)
        min(old_current + (new_max - old_max), new_max)
      end

    %{pool | max: new_max, current: max(0, new_current)}
  end

  defp update_pool(nil, new_max) do
    ResourcePool.new(current: new_max, max: new_max, min: 0)
  end

  # =============================================================================
  # Tick Processing
  # =============================================================================

  @doc """
  Applies regeneration tick to resource pools.

  - Mana regenerates based on INT
  - MV regenerates based on DEX
  - HP does not regenerate (requires healing)

  ## Options

  - `:in_combat` - If true, reduces regen rates (default: false)

  ## Example

      pools = CharacterResources.apply_regen_tick(pools, stats, in_combat: false)
  """
  @spec apply_regen_tick(map(), map(), keyword()) :: map()
  def apply_regen_tick(pools, stats, opts \\ []) do
    in_combat = Keyword.get(opts, :in_combat, false)

    # Reduce regen in combat (default: 50%)
    combat_mult =
      Balance.get(:character_resources, :combat_regen_multiplier,
        default: @default_combat_regen_mult
      )

    combat_modifier = if in_combat, do: combat_mult, else: 1.0

    mana_regen = trunc(mana_regen_rate(stats) * combat_modifier)
    mv_regen = trunc(mv_regen_rate(stats) * combat_modifier)

    %{
      hp: pools.hp,
      mana: apply_regen(pools.mana, mana_regen),
      mv: apply_regen(pools.mv, mv_regen)
    }
  end

  defp apply_regen(%ResourcePool{} = pool, amount) when amount > 0 do
    {:ok, new_pool, _} = ResourcePool.restore(pool, amount)
    new_pool
  end

  defp apply_regen(pool, _), do: pool

  # =============================================================================
  # Resource Examples by Build
  # =============================================================================

  @doc """
  Returns example resource values for different character builds at level 50.

  Useful for documentation and testing.
  """
  @spec example_builds() :: map()
  def example_builds do
    %{
      warrior: %{
        stats: %{str: 100, dex: 40, con: 80, int: 20, per: 40, spi: 20},
        level: 50,
        hp: 470,
        mana: 120,
        mv: 340
      },
      mage: %{
        stats: %{str: 20, dex: 30, con: 40, int: 80, per: 30, spi: 100},
        level: 50,
        hp: 310,
        mana: 460,
        mv: 240
      },
      rogue: %{
        stats: %{str: 30, dex: 100, con: 30, int: 30, per: 80, spi: 30},
        level: 50,
        hp: 270,
        mana: 170,
        mv: 360
      },
      battlemage: %{
        stats: %{str: 30, dex: 30, con: 50, int: 60, per: 30, spi: 60},
        level: 50,
        hp: 350,
        mana: 320,
        mv: 260
      }
    }
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp get_stat(stats, key) do
    # Handle both atom and string keys
    Map.get(stats, key) || Map.get(stats, to_string(key), 0)
  end
end
