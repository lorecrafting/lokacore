defmodule Loka.Mechanics.CombatStats do
  @moduledoc """
  Derived combat statistics calculated from base stats.

  All combat stats are derived from the 6 primary stats (STR, DEX, CON, INT, PER, SPI).
  Formulas and caps are configurable via `priv/config/balance.yml` under `combat_stats`.

  ## Offensive Stats (from Balance config)

  | Stat | Formula | Source |
  |------|---------|--------|
  | Slashing Bonus | STR / 3 | Strength |
  | Piercing Bonus | DEX / 3 | Dexterity |
  | Bludgeon Bonus | CON / 3 | Constitution |
  | Spell Bonus | INT / 3 | Intelligence |
  | Healing Bonus | SPI / 3 | Spirit |
  | Hit Bonus | DEX/4 + PER/6 | Accuracy |
  | Crit % | PER / 5 | Perception (cap 20%) |

  ## Defensive Stats

  | Stat | Formula | Source |
  |------|---------|--------|
  | AC | From armor | Equipment |
  | Dodge % | DEX / 5 | Dexterity (cap 20%) |
  | Magic Resist % | SPI / 4 | Spirit (cap 25%) |
  | Poison Resist % | CON / 4 | Constitution (cap 25%) |

  ## Configuration

  These values are configurable in `priv/config/balance.yml`:

      combat_stats:
        damage_bonus_divisor: 3
        hit_bonus:
          dex_divisor: 4
          per_divisor: 6
        crit:
          per_divisor: 5
          cap: 20
        dodge:
          dex_divisor: 5
          cap: 20
        magic_resist:
          spi_divisor: 4
          cap: 25
        poison_resist:
          con_divisor: 4
          cap: 25

  ## Usage

      alias Loka.Mechanics.CombatStats

      stats = %{str: 60, dex: 40, con: 50, int: 70, per: 40, spi: 40}

      CombatStats.slashing_bonus(stats)   # => 20
      CombatStats.spell_bonus(stats)      # => 23
      CombatStats.crit_chance(stats)      # => 8%
      CombatStats.dodge_chance(stats)     # => 8%

      # Get all derived stats at once
      CombatStats.all(stats)
  """

  alias Loka.Config.Balance

  # Default caps for percentage-based stats (used when Balance config not loaded)
  @default_crit_cap 20
  @default_dodge_cap 20
  @default_magic_resist_cap 25
  @default_poison_resist_cap 25
  @default_damage_divisor 3

  @type stats :: map()

  # =============================================================================
  # Damage Bonuses
  # =============================================================================

  @doc """
  Calculates slashing damage bonus from STR.

  Formula: STR / damage_bonus_divisor (default: 3)
  """
  @spec slashing_bonus(stats()) :: non_neg_integer()
  def slashing_bonus(stats) do
    divisor = Balance.get(:combat_stats, :damage_bonus_divisor, default: @default_damage_divisor)
    div(get_stat(stats, :str), divisor)
  end

  @doc """
  Calculates piercing damage bonus from DEX.

  Formula: DEX / damage_bonus_divisor (default: 3)
  """
  @spec piercing_bonus(stats()) :: non_neg_integer()
  def piercing_bonus(stats) do
    divisor = Balance.get(:combat_stats, :damage_bonus_divisor, default: @default_damage_divisor)
    div(get_stat(stats, :dex), divisor)
  end

  @doc """
  Calculates bludgeoning damage bonus from CON.

  Formula: CON / damage_bonus_divisor (default: 3)
  """
  @spec bludgeoning_bonus(stats()) :: non_neg_integer()
  def bludgeoning_bonus(stats) do
    divisor = Balance.get(:combat_stats, :damage_bonus_divisor, default: @default_damage_divisor)
    div(get_stat(stats, :con), divisor)
  end

  @doc """
  Calculates spell damage bonus from INT.

  Formula: INT / damage_bonus_divisor (default: 3)
  """
  @spec spell_bonus(stats()) :: non_neg_integer()
  def spell_bonus(stats) do
    divisor = Balance.get(:combat_stats, :damage_bonus_divisor, default: @default_damage_divisor)
    div(get_stat(stats, :int), divisor)
  end

  @doc """
  Calculates healing bonus from SPI.

  Formula: SPI / damage_bonus_divisor (default: 3)
  """
  @spec healing_bonus(stats()) :: non_neg_integer()
  def healing_bonus(stats) do
    divisor = Balance.get(:combat_stats, :damage_bonus_divisor, default: @default_damage_divisor)
    div(get_stat(stats, :spi), divisor)
  end

  @doc """
  Returns the damage bonus for a given damage type.
  """
  @spec damage_bonus(stats(), atom()) :: non_neg_integer()
  def damage_bonus(stats, :slashing), do: slashing_bonus(stats)
  def damage_bonus(stats, :piercing), do: piercing_bonus(stats)
  def damage_bonus(stats, :bludgeoning), do: bludgeoning_bonus(stats)
  def damage_bonus(stats, :magic), do: spell_bonus(stats)
  def damage_bonus(_stats, _), do: 0

  # =============================================================================
  # Accuracy Stats
  # =============================================================================

  @doc """
  Calculates hit bonus for attack accuracy.

  Formula: DEX/4 + PER/6
  """
  @spec hit_bonus(stats()) :: non_neg_integer()
  def hit_bonus(stats) do
    dex = get_stat(stats, :dex)
    per = get_stat(stats, :per)
    div(dex, 4) + div(per, 6)
  end

  @doc """
  Calculates critical hit chance percentage.

  Formula: PER / per_divisor (default: 5, capped at 20%)
  """
  @spec crit_chance(stats()) :: non_neg_integer()
  def crit_chance(stats) do
    per = get_stat(stats, :per)
    divisor = Balance.get(:combat_stats, :crit, :per_divisor, default: 5)
    cap = crit_cap()
    min(div(per, divisor), cap)
  end

  # =============================================================================
  # Defensive Stats
  # =============================================================================

  @doc """
  Calculates dodge chance percentage.

  Formula: DEX / dex_divisor (default: 5, capped at 20%)
  """
  @spec dodge_chance(stats()) :: non_neg_integer()
  def dodge_chance(stats) do
    dex = get_stat(stats, :dex)
    divisor = Balance.get(:combat_stats, :dodge, :dex_divisor, default: 5)
    cap = dodge_cap()
    min(div(dex, divisor), cap)
  end

  @doc """
  Calculates magic resistance percentage.

  Formula: SPI / spi_divisor (default: 4, capped at 25%)
  """
  @spec magic_resist(stats()) :: non_neg_integer()
  def magic_resist(stats) do
    spi = get_stat(stats, :spi)
    divisor = Balance.get(:combat_stats, :magic_resist, :spi_divisor, default: 4)
    cap = magic_resist_cap()
    min(div(spi, divisor), cap)
  end

  @doc """
  Calculates poison resistance percentage.

  Formula: CON / con_divisor (default: 4, capped at 25%)
  """
  @spec poison_resist(stats()) :: non_neg_integer()
  def poison_resist(stats) do
    con = get_stat(stats, :con)
    divisor = Balance.get(:combat_stats, :poison_resist, :con_divisor, default: 4)
    cap = poison_resist_cap()
    min(div(con, divisor), cap)
  end

  # =============================================================================
  # Aggregate Functions
  # =============================================================================

  @doc """
  Returns all derived combat stats as a map.

  ## Example

      CombatStats.all(%{str: 60, dex: 40, con: 50, int: 70, per: 40, spi: 40})
      # => %{
      #   slashing_bonus: 20,
      #   piercing_bonus: 13,
      #   bludgeoning_bonus: 16,
      #   spell_bonus: 23,
      #   healing_bonus: 13,
      #   hit_bonus: 16,
      #   crit_chance: 8,
      #   dodge_chance: 8,
      #   magic_resist: 10,
      #   poison_resist: 12
      # }
  """
  @spec all(stats()) :: map()
  def all(stats) do
    %{
      # Offensive
      slashing_bonus: slashing_bonus(stats),
      piercing_bonus: piercing_bonus(stats),
      bludgeoning_bonus: bludgeoning_bonus(stats),
      spell_bonus: spell_bonus(stats),
      healing_bonus: healing_bonus(stats),
      hit_bonus: hit_bonus(stats),
      crit_chance: crit_chance(stats),
      # Defensive
      dodge_chance: dodge_chance(stats),
      magic_resist: magic_resist(stats),
      poison_resist: poison_resist(stats)
    }
  end

  @doc """
  Returns only offensive combat stats.
  """
  @spec offensive(stats()) :: map()
  def offensive(stats) do
    %{
      slashing_bonus: slashing_bonus(stats),
      piercing_bonus: piercing_bonus(stats),
      bludgeoning_bonus: bludgeoning_bonus(stats),
      spell_bonus: spell_bonus(stats),
      healing_bonus: healing_bonus(stats),
      hit_bonus: hit_bonus(stats),
      crit_chance: crit_chance(stats)
    }
  end

  @doc """
  Returns only defensive combat stats.
  """
  @spec defensive(stats()) :: map()
  def defensive(stats) do
    %{
      dodge_chance: dodge_chance(stats),
      magic_resist: magic_resist(stats),
      poison_resist: poison_resist(stats)
    }
  end

  # =============================================================================
  # Attack Resolution Helpers
  # =============================================================================

  @doc """
  Calculates the defense target number for an attack.

  Formula: 10 + Defender's DEX/5

  Used in attack resolution: Attacker rolls d20 + Hit Bonus vs this value.
  """
  @spec defense_target(stats()) :: non_neg_integer()
  def defense_target(stats) do
    dex = get_stat(stats, :dex)
    10 + div(dex, 5)
  end

  @doc """
  Calculates resistance reduction for damage.

  Returns the multiplier to apply to damage after resistance.

  ## Examples

      # 25% magic resist reduces magic damage to 75%
      CombatStats.resistance_multiplier(stats, :magic)  # => 0.75

      # Physical damage types don't have resistance (handled by AC)
      CombatStats.resistance_multiplier(stats, :slashing)  # => 1.0
  """
  @spec resistance_multiplier(stats(), atom()) :: float()
  def resistance_multiplier(stats, damage_type) do
    resist_percent =
      case damage_type do
        :magic -> magic_resist(stats)
        :fire -> magic_resist(stats)
        :ice -> magic_resist(stats)
        :lightning -> magic_resist(stats)
        :force -> magic_resist(stats)
        :poison -> poison_resist(stats)
        # Physical damage uses AC, not resistance
        _ -> 0
      end

    1.0 - resist_percent / 100.0
  end

  # =============================================================================
  # Mana Cost Reduction
  # =============================================================================

  @doc """
  Calculates mana cost multiplier based on INT.

  Formula: 1 - (INT / mana_cost_stat_divisor)
  Default: 1 - (INT / 200)

  Higher INT reduces mana costs.

  ## Examples

      CombatStats.mana_cost_multiplier(%{int: 0})   # => 1.0 (no reduction)
      CombatStats.mana_cost_multiplier(%{int: 60})  # => 0.7 (30% reduction)
      CombatStats.mana_cost_multiplier(%{int: 100}) # => 0.5 (50% max reduction)
  """
  @spec mana_cost_multiplier(stats()) :: float()
  def mana_cost_multiplier(stats) do
    int = get_stat(stats, :int)
    divisor = Balance.get(:combat_stats, :mana_cost_stat_divisor, default: 200)
    1.0 - int / divisor
  end

  # =============================================================================
  # Spell Power Multipliers
  # =============================================================================

  @doc """
  Calculates spell damage multiplier based on INT.

  Formula: 1 + (INT / spell_power_stat_divisor)
  Default: 1 + (INT / 100)

  ## Examples

      CombatStats.spell_power_multiplier(%{int: 0})   # => 1.0
      CombatStats.spell_power_multiplier(%{int: 60})  # => 1.6
      CombatStats.spell_power_multiplier(%{int: 100}) # => 2.0
  """
  @spec spell_power_multiplier(stats()) :: float()
  def spell_power_multiplier(stats) do
    int = get_stat(stats, :int)
    divisor = Balance.get(:combat_stats, :spell_power_stat_divisor, default: 100)
    1.0 + int / divisor
  end

  @doc """
  Calculates healing power multiplier based on SPI.

  Formula: 1 + (SPI / heal_power_stat_divisor)
  Default: 1 + (SPI / 100)

  ## Examples

      CombatStats.heal_power_multiplier(%{spi: 0})   # => 1.0
      CombatStats.heal_power_multiplier(%{spi: 60})  # => 1.6
      CombatStats.heal_power_multiplier(%{spi: 100}) # => 2.0
  """
  @spec heal_power_multiplier(stats()) :: float()
  def heal_power_multiplier(stats) do
    spi = get_stat(stats, :spi)
    divisor = Balance.get(:combat_stats, :heal_power_stat_divisor, default: 100)
    1.0 + spi / divisor
  end

  # =============================================================================
  # Constants Access (from Balance config)
  # =============================================================================

  @doc "Returns the crit chance cap (default: 20%)."
  @spec crit_cap() :: non_neg_integer()
  def crit_cap do
    Balance.get(:combat_stats, :crit, :cap, default: @default_crit_cap)
  end

  @doc "Returns the dodge chance cap (default: 20%)."
  @spec dodge_cap() :: non_neg_integer()
  def dodge_cap do
    Balance.get(:combat_stats, :dodge, :cap, default: @default_dodge_cap)
  end

  @doc "Returns the magic resist cap (default: 25%)."
  @spec magic_resist_cap() :: non_neg_integer()
  def magic_resist_cap do
    Balance.get(:combat_stats, :magic_resist, :cap, default: @default_magic_resist_cap)
  end

  @doc "Returns the poison resist cap (default: 25%)."
  @spec poison_resist_cap() :: non_neg_integer()
  def poison_resist_cap do
    Balance.get(:combat_stats, :poison_resist, :cap, default: @default_poison_resist_cap)
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp get_stat(stats, key) do
    Map.get(stats, key) || Map.get(stats, to_string(key), 0)
  end
end
