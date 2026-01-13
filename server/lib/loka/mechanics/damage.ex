defmodule Loka.Mechanics.Damage do
  @moduledoc """
  Damage mechanic - calculates and applies damage with full audit trail.

  Uses primitives (ResourcePool, Roll, Value) to perform damage calculations
  with configurable formulas from Balance config.

  ## Usage

      alias Loka.Mechanics.Damage
      alias Loka.Primitives.ResourcePool

      # Calculate damage
      context = %{str: 15, weapon_bonus: 5, level: 3}
      {:ok, damage, audit} = Damage.calculate(context)

      # Apply to a health pool
      health = ResourcePool.new(current: 100, max: 100)
      {:ok, health, result} = Damage.apply(health, damage)

      # Full damage operation (calculate + apply)
      {:ok, health, result} = Damage.deal(health, context)

  ## Audit Trail

  Every operation returns a detailed audit map:

      %{
        operation: :damage,
        base_damage: 20,
        defense: 5,
        variance: 1.15,
        critical: false,
        final_damage: 17,
        health_before: 100,
        health_after: 83,
        timestamp: 1704067200000
      }
  """

  alias Loka.Primitives.{ResourcePool, Roll}
  alias Loka.Config.Balance

  @type context :: %{
          optional(:str) => number(),
          optional(:dex) => number(),
          optional(:sta) => number(),
          optional(:int) => number(),
          optional(:weapon_bonus) => number(),
          optional(:armor_bonus) => number(),
          optional(:level) => number(),
          optional(:skill_level) => number()
        }

  @type damage_result :: %{
          base_damage: number(),
          defense: number(),
          variance: number(),
          critical: boolean(),
          critical_multiplier: number(),
          final_damage: number()
        }

  @type apply_result :: %{
          damage_dealt: number(),
          health_before: number(),
          health_after: number(),
          overkill: number(),
          is_fatal: boolean()
        }

  @type audit :: %{
          operation: :damage,
          result: damage_result() | apply_result(),
          timestamp: integer()
        }

  # =============================================================================
  # Damage Calculation
  # =============================================================================

  @doc """
  Calculates damage based on attacker stats.

  Uses formulas from Balance config. Returns the damage amount before application.

  ## Options

  - `:defense` - Target's defense value (default: 0)
  - `:defending` - Is target in defensive stance? (default: false)
  - `:critical` - Force critical hit (default: nil, rolls normally)

  ## Examples

      context = %{str: 15, weapon_bonus: 5, level: 3}
      {:ok, 18, audit} = Damage.calculate(context)

      {:ok, 12, audit} = Damage.calculate(context, defense: 5)
  """
  @spec calculate(context(), keyword()) :: {:ok, number(), audit()}
  def calculate(context, opts \\ []) do
    # Get config values
    base_formula = Balance.get(:combat, :damage, :base_formula, default: "str + weapon_bonus")
    variance_min = Balance.get(:combat, :damage, :variance_min, default: 0.8)
    variance_max = Balance.get(:combat, :damage, :variance_max, default: 1.2)
    minimum = Balance.get(:combat, :damage, :minimum, default: 1)
    defense_config = Balance.get(:combat, :damage, :defense, default: %{})
    defense_cap = Map.get(defense_config, :cap_percent) || 75
    defend_mult = Balance.get(:combat, :damage, :defend_multiplier, default: 1.5)

    crit_config = Balance.get(:combat, :damage, :critical, default: %{})
    crit_base_chance = get_nested(crit_config, :base_chance, 5)
    crit_dex_bonus = get_nested(crit_config, :dex_bonus, 0.5)
    crit_multiplier = get_nested(crit_config, :multiplier, 2.0)

    # Calculate base damage from formula
    base_damage =
      Balance.eval_formula(:combat, :damage, :base_formula, context) ||
        eval_simple(base_formula, context)

    # Calculate defense
    target_defense = Keyword.get(opts, :defense, 0)
    defending = Keyword.get(opts, :defending, false)

    effective_defense =
      if defending do
        target_defense * defend_mult
      else
        target_defense
      end

    # Apply defense (capped)
    damage_after_defense = max(minimum, base_damage - effective_defense)
    max_reduction = base_damage * (defense_cap / 100)
    damage_after_cap = max(base_damage - max_reduction, damage_after_defense)

    # Roll for critical hit
    dex = Map.get(context, :dex, 0)
    crit_chance = crit_base_chance + dex * crit_dex_bonus

    critical =
      case Keyword.get(opts, :critical) do
        nil ->
          {:ok, roll_result, _} = Roll.check(trunc(crit_chance))
          roll_result.success

        forced ->
          forced
      end

    # Apply critical multiplier
    damage_after_crit =
      if critical do
        damage_after_cap * crit_multiplier
      else
        damage_after_cap
      end

    # Apply variance
    {:ok, variance_result, _} = Roll.range_float(variance_min, variance_max)
    variance = variance_result.value
    final_damage = max(minimum, trunc(damage_after_crit * variance))

    result = %{
      base_damage: base_damage,
      defense: effective_defense,
      variance: variance,
      critical: critical,
      critical_multiplier: if(critical, do: crit_multiplier, else: 1.0),
      final_damage: final_damage
    }

    audit = %{
      operation: :damage,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, final_damage, audit}
  end

  @doc """
  Calculates damage with explicit base (no formula evaluation).

  Useful when base damage is already known.
  """
  @spec calculate_from_base(number(), keyword()) :: {:ok, number(), audit()}
  def calculate_from_base(base_damage, opts \\ []) do
    variance_min = Balance.get(:combat, :damage, :variance_min, default: 0.8)
    variance_max = Balance.get(:combat, :damage, :variance_max, default: 1.2)
    minimum = Balance.get(:combat, :damage, :minimum, default: 1)

    defense = Keyword.get(opts, :defense, 0)
    critical = Keyword.get(opts, :critical, false)
    crit_multiplier = Keyword.get(opts, :critical_multiplier, 2.0)

    damage_after_defense = max(minimum, base_damage - defense)

    damage_after_crit =
      if critical do
        damage_after_defense * crit_multiplier
      else
        damage_after_defense
      end

    {:ok, variance_result, _} = Roll.range_float(variance_min, variance_max)
    variance = variance_result.value
    final_damage = max(minimum, trunc(damage_after_crit * variance))

    result = %{
      base_damage: base_damage,
      defense: defense,
      variance: variance,
      critical: critical,
      critical_multiplier: if(critical, do: crit_multiplier, else: 1.0),
      final_damage: final_damage
    }

    audit = %{
      operation: :damage,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, final_damage, audit}
  end

  # =============================================================================
  # Damage Application
  # =============================================================================

  @doc """
  Applies calculated damage to a health pool.

  ## Examples

      health = ResourcePool.new(current: 100, max: 100)
      {:ok, health, result} = Damage.apply_to(health, 25)

      result.health_before  # => 100
      result.health_after   # => 75
      result.is_fatal       # => false
  """
  @spec apply_to(ResourcePool.t(), number()) :: {:ok, ResourcePool.t(), apply_result()}
  def apply_to(%ResourcePool{} = health, damage) when is_number(damage) and damage >= 0 do
    health_before = health.current
    {:ok, new_health, _pool_audit} = ResourcePool.force_consume(health, damage)
    health_after = new_health.current

    overkill = max(0, damage - health_before)
    is_fatal = health_after <= health.min

    result = %{
      damage_dealt: damage,
      health_before: health_before,
      health_after: health_after,
      overkill: overkill,
      is_fatal: is_fatal
    }

    {:ok, new_health, result}
  end

  @doc """
  Applies damage to a health map (for compatibility with existing code).

  Accepts maps like %{"current" => 100, "max" => 100} or %{current: 100, max: 100}.
  """
  @spec apply_to_map(map(), number()) :: {:ok, map(), apply_result()}
  def apply_to_map(health_map, damage) when is_map(health_map) do
    pool = ResourcePool.from_map(health_map)
    {:ok, new_pool, result} = apply_to(pool, damage)

    # Preserve original key format
    new_health_map =
      if Map.has_key?(health_map, "current") do
        %{
          "current" => new_pool.current,
          "max" => new_pool.max
        }
      else
        %{
          current: new_pool.current,
          max: new_pool.max
        }
      end

    {:ok, new_health_map, result}
  end

  # =============================================================================
  # Combined Operations
  # =============================================================================

  @doc """
  Calculates and applies damage in one operation.

  ## Examples

      health = ResourcePool.new(100)
      context = %{str: 15, weapon_bonus: 5}

      {:ok, health, result} = Damage.deal(health, context)
  """
  @spec deal(ResourcePool.t(), context(), keyword()) ::
          {:ok, ResourcePool.t(), map()}
  def deal(%ResourcePool{} = health, context, opts \\ []) do
    target_defense = Keyword.get(opts, :defense, 0)
    defending = Keyword.get(opts, :defending, false)

    {:ok, damage, calc_audit} =
      calculate(context, defense: target_defense, defending: defending)

    {:ok, new_health, apply_result} = apply_to(health, damage)

    combined_result = %{
      calculation: calc_audit.result,
      application: apply_result,
      final_damage: damage,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_health, combined_result}
  end

  @doc """
  Deals damage from a map health (for compatibility).
  """
  @spec deal_to_map(map(), context(), keyword()) :: {:ok, map(), map()}
  def deal_to_map(health_map, context, opts \\ []) do
    pool = ResourcePool.from_map(health_map)
    {:ok, new_pool, result} = deal(pool, context, opts)

    new_health_map =
      if Map.has_key?(health_map, "current") do
        %{"current" => new_pool.current, "max" => new_pool.max}
      else
        %{current: new_pool.current, max: new_pool.max}
      end

    {:ok, new_health_map, result}
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp eval_simple(formula, context) when is_binary(formula) do
    # Simple evaluation for formulas like "str + weapon_bonus"
    context
    |> Enum.reduce(formula, fn {key, value}, acc ->
      String.replace(acc, to_string(key), to_string(value))
    end)
    |> String.split(~r/[+\-]/, include_captures: true)
    |> Enum.reduce({0, :add}, fn
      "+", {acc, _} ->
        {acc, :add}

      "-", {acc, _} ->
        {acc, :subtract}

      part, {acc, op} ->
        case Float.parse(String.trim(part)) do
          {num, _} when op == :add -> {acc + num, :add}
          {num, _} when op == :subtract -> {acc - num, :add}
          :error -> {acc, op}
        end
    end)
    |> elem(0)
  end

  defp eval_simple(_, _), do: 0

  defp get_nested(map, key, default) when is_map(map) do
    Map.get(map, key) || Map.get(map, to_string(key)) || default
  end

  defp get_nested(_, _, default), do: default
end
