defmodule Loka.Mechanics.DamageTypes do
  @moduledoc """
  Damage type system for physical and magical damage.

  Extends the base Damage mechanic with typed damage that scales with stats.

  ## Physical Damage Types

  | Type | Scales With | Weapons |
  |------|-------------|---------|
  | Slashing | STR | Swords, Axes |
  | Piercing | DEX | Daggers, Bows, Spears |
  | Bludgeoning | CON | Maces, Hammers, Fists |

  ## Magical Damage Types

  All magical damage scales with INT for damage.

  | Type | Source | Element |
  |------|--------|---------|
  | Fire | AGNI spells | fire |
  | Ice | HIMA spells | ice |
  | Lightning | VIDYUT spells | lightning |
  | Poison | VISHA spells | poison |
  | Force | VAYU spells | force |

  ## Usage

      alias Loka.Mechanics.DamageTypes

      # Calculate typed physical damage
      {:ok, damage, audit} = DamageTypes.calculate_physical(
        %{str: 60, dex: 40, con: 50, int: 30, per: 40, spi: 30},
        :slashing,
        base_damage: 15,
        target_ac: 10
      )

      # Calculate typed magic damage
      {:ok, damage, audit} = DamageTypes.calculate_magic(
        %{str: 30, dex: 30, con: 30, int: 70, per: 30, spi: 50},
        :fire,
        base_damage: 25,
        target_stats: %{spi: 40}
      )
  """

  alias Loka.Mechanics.CombatStats
  alias Loka.Primitives.Roll

  @physical_types [:slashing, :piercing, :bludgeoning]
  @magical_types [:fire, :ice, :lightning, :poison, :force, :drain, :light, :darkness]

  @type damage_type ::
          :slashing
          | :piercing
          | :bludgeoning
          | :fire
          | :ice
          | :lightning
          | :poison
          | :force
          | :drain
          | :light
          | :darkness
  @type stats :: map()

  # =============================================================================
  # Type Classification
  # =============================================================================

  @doc "Returns all physical damage types."
  @spec physical_types() :: [atom()]
  def physical_types, do: @physical_types

  @doc "Returns all magical damage types."
  @spec magical_types() :: [atom()]
  def magical_types, do: @magical_types

  @doc "Returns all damage types."
  @spec all_types() :: [atom()]
  def all_types, do: @physical_types ++ @magical_types

  @doc "Checks if damage type is physical."
  @spec physical?(damage_type()) :: boolean()
  def physical?(type), do: type in @physical_types

  @doc "Checks if damage type is magical."
  @spec magical?(damage_type()) :: boolean()
  def magical?(type), do: type in @magical_types

  # =============================================================================
  # Stat Mapping
  # =============================================================================

  @doc """
  Returns which stat provides the damage bonus for a given type.
  """
  @spec stat_for_type(damage_type()) :: atom()
  def stat_for_type(:slashing), do: :str
  def stat_for_type(:piercing), do: :dex
  def stat_for_type(:bludgeoning), do: :con
  def stat_for_type(type) when type in @magical_types, do: :int
  def stat_for_type(_), do: nil

  @doc """
  Returns which damage type is associated with a weapon category.
  """
  @spec type_for_weapon(String.t() | atom()) :: damage_type()
  def type_for_weapon(weapon) when is_atom(weapon), do: type_for_weapon(to_string(weapon))

  def type_for_weapon(weapon) do
    weapon_lower = String.downcase(weapon)

    cond do
      weapon_lower in ~w(sword axe claw scimitar katana saber) -> :slashing
      weapon_lower in ~w(dagger bow arrow spear rapier pike lance) -> :piercing
      weapon_lower in ~w(mace hammer fist staff club flail maul) -> :bludgeoning
      weapon_lower in ~w(wand scepter orb) -> :fire
      true -> :bludgeoning
    end
  end

  # =============================================================================
  # Physical Damage Calculation
  # =============================================================================

  @doc """
  Calculates physical damage with type-based stat bonus.

  ## Options

  - `:base_damage` - Base weapon damage (required)
  - `:target_ac` - Target's armor class (default: 0)
  - `:defending` - Is target defending? (default: false)
  - `:critical` - Force critical hit result (default: nil, rolls)

  ## Attack Resolution

  1. Calculate base: weapon_damage + stat_bonus
  2. Apply variance (0.8-1.2)
  3. Check for critical hit (PER-based)
  4. Subtract AC (minimum 1 damage)
  """
  @spec calculate_physical(stats(), damage_type(), keyword()) ::
          {:ok, non_neg_integer(), map()}
  def calculate_physical(attacker_stats, damage_type, opts \\ [])
      when damage_type in @physical_types do
    base_damage = Keyword.fetch!(opts, :base_damage)
    target_ac = Keyword.get(opts, :target_ac, 0)
    defending = Keyword.get(opts, :defending, false)
    force_critical = Keyword.get(opts, :critical)

    # Get stat bonus for this damage type
    stat_bonus = CombatStats.damage_bonus(attacker_stats, damage_type)

    # Calculate base damage
    raw_damage = base_damage + stat_bonus

    # Apply variance (0.8-1.2)
    {:ok, variance_result, _} = Roll.range_float(0.8, 1.2)
    variance = variance_result.value
    damage_with_variance = trunc(raw_damage * variance)

    # Check for critical hit
    crit_chance = CombatStats.crit_chance(attacker_stats)

    critical =
      case force_critical do
        nil ->
          {:ok, crit_roll, _} = Roll.check(crit_chance)
          crit_roll.success

        forced ->
          forced
      end

    # Apply critical multiplier (2x)
    crit_multiplier = if critical, do: 2.0, else: 1.0
    damage_after_crit = trunc(damage_with_variance * crit_multiplier)

    # Apply AC (defense doubles if defending)
    effective_ac = if defending, do: target_ac * 2, else: target_ac
    final_damage = max(1, damage_after_crit - effective_ac)

    audit = %{
      operation: :physical_damage,
      damage_type: damage_type,
      base_damage: base_damage,
      stat_bonus: stat_bonus,
      raw_damage: raw_damage,
      variance: variance,
      critical: critical,
      critical_multiplier: crit_multiplier,
      target_ac: effective_ac,
      final_damage: final_damage,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, final_damage, audit}
  end

  # =============================================================================
  # Magic Damage Calculation
  # =============================================================================

  @doc """
  Calculates magical damage with INT-based scaling and resistance.

  ## Options

  - `:base_damage` - Base spell damage (required)
  - `:target_stats` - Target's stats for resistance (default: %{})
  - `:guna_multiplier` - Modifier multiplier (default: 1.0)
  - `:piercing` - Ignore 50% resistance (BHEDA modifier)

  ## Calculation

  1. Base × (1 + INT/100) × guna_multiplier
  2. Apply variance (0.9-1.1, less than physical)
  3. Apply resistance (SPI-based for most, CON for poison)
  """
  @spec calculate_magic(stats(), damage_type(), keyword()) ::
          {:ok, non_neg_integer(), map()}
  def calculate_magic(caster_stats, damage_type, opts \\ [])
      when damage_type in @magical_types do
    base_damage = Keyword.fetch!(opts, :base_damage)
    target_stats = Keyword.get(opts, :target_stats, %{})
    guna_multiplier = Keyword.get(opts, :guna_multiplier, 1.0)
    piercing = Keyword.get(opts, :piercing, false)

    # Get spell power multiplier from INT
    power_mult = CombatStats.spell_power_multiplier(caster_stats)

    # Calculate scaled damage
    scaled_damage = base_damage * power_mult * guna_multiplier

    # Apply variance (tighter range for magic: 0.9-1.1)
    {:ok, variance_result, _} = Roll.range_float(0.9, 1.1)
    variance = variance_result.value
    damage_with_variance = trunc(scaled_damage * variance)

    # Apply resistance
    resist_mult = CombatStats.resistance_multiplier(target_stats, damage_type)

    # BHEDA (piercing) ignores 50% of resistance
    effective_resist_mult =
      if piercing do
        # If resist is 0.75 (25% resist), with piercing: 1 - (1-0.75)*0.5 = 0.875 (12.5% resist)
        1.0 - (1.0 - resist_mult) * 0.5
      else
        resist_mult
      end

    final_damage = max(1, trunc(damage_with_variance * effective_resist_mult))

    audit = %{
      operation: :magic_damage,
      damage_type: damage_type,
      base_damage: base_damage,
      power_multiplier: power_mult,
      guna_multiplier: guna_multiplier,
      scaled_damage: scaled_damage,
      variance: variance,
      resistance_multiplier: resist_mult,
      piercing: piercing,
      effective_resistance: effective_resist_mult,
      final_damage: final_damage,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, final_damage, audit}
  end

  # =============================================================================
  # Healing Calculation
  # =============================================================================

  @doc """
  Calculates healing amount with SPI-based scaling.

  ## Options

  - `:base_healing` - Base heal amount (required)
  - `:guna_multiplier` - Modifier multiplier (default: 1.0)

  ## Calculation

  1. Base × (1 + SPI/100) × guna_multiplier
  2. Apply variance (0.95-1.05, very tight)
  """
  @spec calculate_healing(stats(), keyword()) :: {:ok, non_neg_integer(), map()}
  def calculate_healing(healer_stats, opts \\ []) do
    base_healing = Keyword.fetch!(opts, :base_healing)
    guna_multiplier = Keyword.get(opts, :guna_multiplier, 1.0)

    # Get healing power multiplier from SPI
    power_mult = CombatStats.heal_power_multiplier(healer_stats)

    # Calculate scaled healing
    scaled_healing = base_healing * power_mult * guna_multiplier

    # Apply variance (very tight: 0.95-1.05)
    {:ok, variance_result, _} = Roll.range_float(0.95, 1.05)
    variance = variance_result.value
    final_healing = max(1, trunc(scaled_healing * variance))

    audit = %{
      operation: :healing,
      base_healing: base_healing,
      power_multiplier: power_mult,
      guna_multiplier: guna_multiplier,
      scaled_healing: scaled_healing,
      variance: variance,
      final_healing: final_healing,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, final_healing, audit}
  end

  # =============================================================================
  # Hit/Miss Resolution
  # =============================================================================

  @doc """
  Resolves whether an attack hits.

  ## Attack Resolution

  1. Attacker rolls: d20 + Hit Bonus
  2. Compare to: 10 + Defender's DEX/5
  3. If hit, defender rolls Dodge %

  Returns `{:hit | :miss | :dodged, audit}`.
  """
  @spec resolve_hit(stats(), stats(), keyword()) :: {:hit | :miss | :dodged, map()}
  def resolve_hit(attacker_stats, defender_stats, opts \\ []) do
    force_hit = Keyword.get(opts, :force_hit)
    # When force_hit is true and force_dodge isn't explicitly set, default to no dodge
    # This ensures force_hit: true guarantees a :hit outcome
    force_dodge = Keyword.get(opts, :force_dodge, if(force_hit == true, do: false, else: nil))

    hit_bonus = CombatStats.hit_bonus(attacker_stats)
    defense_target = CombatStats.defense_target(defender_stats)
    dodge_chance = CombatStats.dodge_chance(defender_stats)

    # Roll d20 + hit bonus
    {:ok, attack_roll, _} = Roll.dice(1, 20)
    total_attack = attack_roll.total + hit_bonus

    hit_success =
      case force_hit do
        nil -> total_attack >= defense_target
        forced -> forced
      end

    if not hit_success do
      audit = %{
        operation: :attack_resolution,
        result: :miss,
        attack_roll: attack_roll.total,
        hit_bonus: hit_bonus,
        total_attack: total_attack,
        defense_target: defense_target,
        timestamp: System.system_time(:millisecond)
      }

      {:miss, audit}
    else
      # Hit succeeded, check for dodge
      dodged =
        case force_dodge do
          nil ->
            {:ok, dodge_roll, _} = Roll.check(dodge_chance)
            dodge_roll.success

          forced ->
            forced
        end

      if dodged do
        audit = %{
          operation: :attack_resolution,
          result: :dodged,
          attack_roll: attack_roll.total,
          hit_bonus: hit_bonus,
          total_attack: total_attack,
          defense_target: defense_target,
          dodge_chance: dodge_chance,
          timestamp: System.system_time(:millisecond)
        }

        {:dodged, audit}
      else
        audit = %{
          operation: :attack_resolution,
          result: :hit,
          attack_roll: attack_roll.total,
          hit_bonus: hit_bonus,
          total_attack: total_attack,
          defense_target: defense_target,
          dodge_chance: dodge_chance,
          timestamp: System.system_time(:millisecond)
        }

        {:hit, audit}
      end
    end
  end

  # =============================================================================
  # DoT (Damage over Time)
  # =============================================================================

  @doc """
  Calculates DoT damage per tick.

  | Effect | Formula |
  |--------|---------|
  | Burning | 5 + INT/10 |
  | Poisoned | 3 + INT/10 |
  | Bleeding | 3 + STR/10 |
  """
  @spec dot_damage(stats(), atom()) :: non_neg_integer()
  def dot_damage(caster_stats, :burning) do
    int = Map.get(caster_stats, :int, 0)
    5 + div(int, 10)
  end

  def dot_damage(caster_stats, :poisoned) do
    int = Map.get(caster_stats, :int, 0)
    3 + div(int, 10)
  end

  def dot_damage(caster_stats, :bleeding) do
    str = Map.get(caster_stats, :str, 0)
    3 + div(str, 10)
  end

  def dot_damage(_stats, _effect), do: 0

  # =============================================================================
  # Display Helpers
  # =============================================================================

  @doc "Returns human-readable name for damage type."
  @spec name(damage_type()) :: String.t()
  def name(:slashing), do: "Slashing"
  def name(:piercing), do: "Piercing"
  def name(:bludgeoning), do: "Bludgeoning"
  def name(:fire), do: "Fire"
  def name(:ice), do: "Ice"
  def name(:lightning), do: "Lightning"
  def name(:poison), do: "Poison"
  def name(:force), do: "Force"
  def name(:drain), do: "Drain"
  def name(:light), do: "Light"
  def name(:darkness), do: "Darkness"
  def name(_), do: "Unknown"

  @doc "Returns icon/emoji for damage type (for UI)."
  @spec icon(damage_type()) :: String.t()
  def icon(:slashing), do: "/"
  def icon(:piercing), do: "|"
  def icon(:bludgeoning), do: "O"
  def icon(:fire), do: "~"
  def icon(:ice), do: "*"
  def icon(:lightning), do: "!"
  def icon(:poison), do: "+"
  def icon(:force), do: "^"
  def icon(:drain), do: "-"
  def icon(:light), do: "o"
  def icon(:darkness), do: "x"
  def icon(_), do: "?"
end
