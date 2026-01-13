defmodule Loka.Mechanics.Heal do
  @moduledoc """
  Healing mechanic - calculates and applies healing with full audit trail.

  Uses primitives (ResourcePool, Roll) to perform healing calculations
  with configurable formulas from Balance config.

  ## Usage

      alias Loka.Mechanics.Heal
      alias Loka.Primitives.ResourcePool

      # Calculate healing
      context = %{int: 15, level: 5}
      {:ok, healing, audit} = Heal.calculate(context)

      # Apply to a health pool
      health = ResourcePool.new(current: 50, max: 100)
      {:ok, health, result} = Heal.apply(health, healing)

      # Full healing operation (calculate + apply)
      {:ok, health, result} = Heal.restore(health, context)

  ## Audit Trail

  Every operation returns a detailed audit map:

      %{
        operation: :heal,
        base_healing: 25,
        variance: 1.05,
        final_healing: 26,
        health_before: 50,
        health_after: 76,
        overheal: 0,
        timestamp: 1704067200000
      }
  """

  alias Loka.Primitives.{ResourcePool, Roll}
  alias Loka.Config.Balance

  @type context :: %{
          optional(:int) => number(),
          optional(:wis) => number(),
          optional(:level) => number(),
          optional(:skill_level) => number()
        }

  @type heal_result :: %{
          base_healing: number(),
          variance: number(),
          final_healing: number()
        }

  @type apply_result :: %{
          healing_done: number(),
          health_before: number(),
          health_after: number(),
          overheal: number()
        }

  @type audit :: %{
          operation: :heal,
          result: heal_result() | apply_result(),
          timestamp: integer()
        }

  # =============================================================================
  # Healing Calculation
  # =============================================================================

  @doc """
  Calculates healing based on healer stats.

  Uses formulas from Balance config. Returns the healing amount before application.

  ## Options

  - `:bonus` - Additional flat healing bonus (default: 0)
  - `:multiplier` - Healing multiplier (default: 1.0)

  ## Examples

      context = %{int: 15, level: 5}
      {:ok, 25, audit} = Heal.calculate(context)

      {:ok, 30, audit} = Heal.calculate(context, bonus: 5)
  """
  @spec calculate(context(), keyword()) :: {:ok, number(), audit()}
  def calculate(context, opts \\ []) do
    # Get config values
    variance_min = Balance.get(:combat, :healing, :variance_min, default: 0.9)
    variance_max = Balance.get(:combat, :healing, :variance_max, default: 1.1)

    # Calculate base healing from formula
    base_healing = Balance.eval_formula(:combat, :healing, :base_formula, context)

    base_healing =
      if is_nil(base_healing) or base_healing == 0 do
        # Fallback formula
        int = Map.get(context, :int, 10)
        level = Map.get(context, :level, 1)
        int + level * 2
      else
        base_healing
      end

    # Apply bonus and multiplier
    bonus = Keyword.get(opts, :bonus, 0)
    multiplier = Keyword.get(opts, :multiplier, 1.0)

    healing_with_bonus = (base_healing + bonus) * multiplier

    # Apply variance
    {:ok, variance_result, _} = Roll.range_float(variance_min, variance_max)
    variance = variance_result.value
    final_healing = max(0, trunc(healing_with_bonus * variance))

    result = %{
      base_healing: base_healing,
      bonus: bonus,
      multiplier: multiplier,
      variance: variance,
      final_healing: final_healing
    }

    audit = %{
      operation: :heal,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, final_healing, audit}
  end

  @doc """
  Calculates healing with explicit base (no formula evaluation).

  Useful when base healing is already known.
  """
  @spec calculate_from_base(number(), keyword()) :: {:ok, number(), audit()}
  def calculate_from_base(base_healing, opts \\ []) do
    variance_min = Balance.get(:combat, :healing, :variance_min, default: 0.9)
    variance_max = Balance.get(:combat, :healing, :variance_max, default: 1.1)

    multiplier = Keyword.get(opts, :multiplier, 1.0)

    {:ok, variance_result, _} = Roll.range_float(variance_min, variance_max)
    variance = variance_result.value
    final_healing = max(0, trunc(base_healing * multiplier * variance))

    result = %{
      base_healing: base_healing,
      variance: variance,
      multiplier: multiplier,
      final_healing: final_healing
    }

    audit = %{
      operation: :heal,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, final_healing, audit}
  end

  # =============================================================================
  # Healing Application
  # =============================================================================

  @doc """
  Applies calculated healing to a health pool.

  ## Options

  - `:allow_overheal` - Allow healing above max (default: from config)
  - `:overheal_cap` - Max overheal multiplier (default: from config)

  ## Examples

      health = ResourcePool.new(current: 50, max: 100)
      {:ok, health, result} = Heal.apply_to(health, 30)

      result.health_before  # => 50
      result.health_after   # => 80
      result.overheal       # => 0
  """
  @spec apply_to(ResourcePool.t(), number(), keyword()) :: {:ok, ResourcePool.t(), apply_result()}
  def apply_to(%ResourcePool{} = health, healing, opts \\ [])
      when is_number(healing) and healing >= 0 do
    allow_overheal =
      Keyword.get(
        opts,
        :allow_overheal,
        Balance.get(:combat, :healing, :allow_overheal, default: false)
      )

    overheal_cap =
      Keyword.get(
        opts,
        :overheal_cap,
        Balance.get(:combat, :healing, :overheal_cap, default: 1.2)
      )

    health_before = health.current

    {new_health, effective_healing, overheal} =
      if allow_overheal do
        max_with_overheal = trunc(health.max * overheal_cap)
        potential_health = health.current + healing
        capped_health = min(potential_health, max_with_overheal)
        overheal_amount = max(0, healing - (health.max - health.current))
        {:ok, pool, _} = ResourcePool.set(health, capped_health)
        {pool, healing, overheal_amount}
      else
        {:ok, pool, _} = ResourcePool.restore(health, healing)
        actual_healing = pool.current - health.current
        overheal_amount = max(0, healing - actual_healing)
        {pool, actual_healing, overheal_amount}
      end

    result = %{
      healing_done: effective_healing,
      health_before: health_before,
      health_after: new_health.current,
      overheal: overheal
    }

    {:ok, new_health, result}
  end

  @doc """
  Applies healing to a health map (for compatibility with existing code).

  Accepts maps like %{"current" => 100, "max" => 100} or %{current: 100, max: 100}.
  """
  @spec apply_to_map(map(), number(), keyword()) :: {:ok, map(), apply_result()}
  def apply_to_map(health_map, healing, opts \\ []) when is_map(health_map) do
    pool = ResourcePool.from_map(health_map)
    {:ok, new_pool, result} = apply_to(pool, healing, opts)

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
  Calculates and applies healing in one operation.

  ## Examples

      health = ResourcePool.new(current: 50, max: 100)
      context = %{int: 15, level: 5}

      {:ok, health, result} = Heal.restore(health, context)
  """
  @spec restore(ResourcePool.t(), context(), keyword()) ::
          {:ok, ResourcePool.t(), map()}
  def restore(%ResourcePool{} = health, context, opts \\ []) do
    {:ok, healing, calc_audit} = calculate(context, opts)
    {:ok, new_health, apply_result} = apply_to(health, healing, opts)

    combined_result = %{
      calculation: calc_audit.result,
      application: apply_result,
      final_healing: healing,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_health, combined_result}
  end

  @doc """
  Restores health to a map (for compatibility).
  """
  @spec restore_to_map(map(), context(), keyword()) :: {:ok, map(), map()}
  def restore_to_map(health_map, context, opts \\ []) do
    pool = ResourcePool.from_map(health_map)
    {:ok, new_pool, result} = restore(pool, context, opts)

    new_health_map =
      if Map.has_key?(health_map, "current") do
        %{"current" => new_pool.current, "max" => new_pool.max}
      else
        %{current: new_pool.current, max: new_pool.max}
      end

    {:ok, new_health_map, result}
  end

  # =============================================================================
  # Convenience Functions
  # =============================================================================

  @doc """
  Heals to full health.
  """
  @spec heal_full(ResourcePool.t()) :: {:ok, ResourcePool.t(), apply_result()}
  def heal_full(%ResourcePool{} = health) do
    deficit = ResourcePool.deficit(health)
    apply_to(health, deficit)
  end

  @doc """
  Heals a flat amount (no variance).
  """
  @spec heal_flat(ResourcePool.t(), number()) :: {:ok, ResourcePool.t(), apply_result()}
  def heal_flat(%ResourcePool{} = health, amount) do
    apply_to(health, amount)
  end

  @doc """
  Heals a percentage of max health.
  """
  @spec heal_percent(ResourcePool.t(), number()) :: {:ok, ResourcePool.t(), apply_result()}
  def heal_percent(%ResourcePool{} = health, percent) when percent >= 0 and percent <= 100 do
    amount = trunc(health.max * percent / 100)
    apply_to(health, amount)
  end
end
