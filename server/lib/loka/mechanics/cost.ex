defmodule Loka.Mechanics.Cost do
  @moduledoc """
  Cost mechanic - checks and pays resource costs with full audit trail.

  Uses ResourcePool primitive to verify and consume costs for abilities,
  crafting, economy, etc.

  ## Usage

      alias Loka.Mechanics.Cost
      alias Loka.Primitives.ResourcePool

      # Check if can afford
      mana = ResourcePool.new(current: 50, max: 100)
      Cost.can_afford?(mana, 30)  # => true

      # Pay a single cost
      {:ok, mana, audit} = Cost.pay(mana, 30)

      # Pay multiple costs at once
      resources = %{
        mana: ResourcePool.new(50),
        stamina: ResourcePool.new(100)
      }
      costs = %{mana: 20, stamina: 30}

      {:ok, resources, audit} = Cost.pay_all(resources, costs)

  ## Audit Trail

  Every operation returns a detailed audit map:

      %{
        operation: :pay_cost,
        resource: :mana,
        cost: 30,
        before: 50,
        after: 20,
        success: true,
        timestamp: 1704067200000
      }
  """

  alias Loka.Primitives.ResourcePool

  @type resource_pools :: %{atom() => ResourcePool.t()}
  @type costs :: %{atom() => number()}

  @type pay_result :: %{
          resource: atom(),
          cost: number(),
          before: number(),
          after: number(),
          success: boolean()
        }

  @type pay_all_result :: %{
          costs_paid: [pay_result()],
          total_cost: number(),
          success: boolean()
        }

  @type audit :: %{
          operation: :pay_cost | :pay_costs | :refund,
          result: pay_result() | pay_all_result(),
          timestamp: integer()
        }

  # =============================================================================
  # Cost Checking
  # =============================================================================

  @doc """
  Checks if a resource pool has enough to pay a cost.

  ## Examples

      mana = ResourcePool.new(current: 50, max: 100)
      Cost.can_afford?(mana, 30)  # => true
      Cost.can_afford?(mana, 60)  # => false
  """
  @spec can_afford?(ResourcePool.t(), number()) :: boolean()
  def can_afford?(%ResourcePool{} = pool, cost) when is_number(cost) do
    ResourcePool.has_enough?(pool, cost)
  end

  @doc """
  Checks if multiple resource pools can afford their costs.

  ## Examples

      resources = %{
        mana: ResourcePool.new(50),
        stamina: ResourcePool.new(100)
      }
      costs = %{mana: 20, stamina: 30}

      Cost.can_afford_all?(resources, costs)  # => true
  """
  @spec can_afford_all?(resource_pools(), costs()) :: boolean()
  def can_afford_all?(resources, costs) when is_map(resources) and is_map(costs) do
    Enum.all?(costs, fn {resource_key, cost} ->
      case Map.get(resources, resource_key) do
        nil -> false
        pool -> can_afford?(pool, cost)
      end
    end)
  end

  @doc """
  Returns which costs cannot be afforded.

  ## Examples

      resources = %{mana: ResourcePool.new(20), stamina: ResourcePool.new(10)}
      costs = %{mana: 50, stamina: 5}

      Cost.missing_resources(resources, costs)
      # => %{mana: 30}  # Need 30 more mana
  """
  @spec missing_resources(resource_pools(), costs()) :: costs()
  def missing_resources(resources, costs) when is_map(resources) and is_map(costs) do
    Enum.reduce(costs, %{}, fn {resource_key, cost}, acc ->
      case Map.get(resources, resource_key) do
        nil ->
          Map.put(acc, resource_key, cost)

        pool ->
          deficit = cost - pool.current

          if deficit > 0 do
            Map.put(acc, resource_key, deficit)
          else
            acc
          end
      end
    end)
  end

  # =============================================================================
  # Cost Payment
  # =============================================================================

  @doc """
  Pays a cost from a resource pool.

  Returns {:ok, pool, audit} or {:error, :insufficient}.

  ## Examples

      mana = ResourcePool.new(current: 50, max: 100)
      {:ok, mana, audit} = Cost.pay(mana, 30)
      mana.current  # => 20

      {:error, :insufficient} = Cost.pay(mana, 100)
  """
  @spec pay(ResourcePool.t(), number()) ::
          {:ok, ResourcePool.t(), audit()} | {:error, :insufficient}
  def pay(%ResourcePool{} = pool, cost) when is_number(cost) and cost >= 0 do
    before = pool.current

    case ResourcePool.consume(pool, cost) do
      {:ok, new_pool, _pool_audit} ->
        result = %{
          cost: cost,
          before: before,
          after: new_pool.current,
          success: true
        }

        audit = %{
          operation: :pay_cost,
          result: result,
          timestamp: System.system_time(:millisecond)
        }

        {:ok, new_pool, audit}

      {:error, :insufficient} ->
        {:error, :insufficient}
    end
  end

  @doc """
  Pays multiple costs from multiple resource pools atomically.

  If any cost cannot be paid, no resources are consumed (all-or-nothing).

  ## Examples

      resources = %{
        mana: ResourcePool.new(50),
        stamina: ResourcePool.new(100)
      }
      costs = %{mana: 20, stamina: 30}

      {:ok, resources, audit} = Cost.pay_all(resources, costs)

      # If insufficient:
      {:error, {:insufficient, %{mana: 10}}} = Cost.pay_all(resources, %{mana: 60})
  """
  @spec pay_all(resource_pools(), costs()) ::
          {:ok, resource_pools(), audit()} | {:error, {:insufficient, costs()}}
  def pay_all(resources, costs) when is_map(resources) and is_map(costs) do
    # First check if all costs can be paid
    missing = missing_resources(resources, costs)

    if map_size(missing) > 0 do
      {:error, {:insufficient, missing}}
    else
      # Pay all costs
      {new_resources, results} =
        Enum.reduce(costs, {resources, []}, fn {resource_key, cost}, {res_acc, results_acc} ->
          pool = Map.get(res_acc, resource_key)
          {:ok, new_pool, audit} = pay(pool, cost)

          result = Map.put(audit.result, :resource, resource_key)
          {Map.put(res_acc, resource_key, new_pool), [result | results_acc]}
        end)

      total_cost =
        costs
        |> Map.values()
        |> Enum.sum()

      pay_all_result = %{
        costs_paid: Enum.reverse(results),
        total_cost: total_cost,
        success: true
      }

      audit = %{
        operation: :pay_costs,
        result: pay_all_result,
        timestamp: System.system_time(:millisecond)
      }

      {:ok, new_resources, audit}
    end
  end

  # =============================================================================
  # Cost Refund
  # =============================================================================

  @doc """
  Refunds a cost to a resource pool.

  ## Examples

      mana = ResourcePool.new(current: 20, max: 100)
      {:ok, mana, audit} = Cost.refund(mana, 30)
      mana.current  # => 50
  """
  @spec refund(ResourcePool.t(), number()) :: {:ok, ResourcePool.t(), audit()}
  def refund(%ResourcePool{} = pool, amount) when is_number(amount) and amount >= 0 do
    before = pool.current
    {:ok, new_pool, _pool_audit} = ResourcePool.restore(pool, amount)

    result = %{
      amount: amount,
      before: before,
      after: new_pool.current
    }

    audit = %{
      operation: :refund,
      result: result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_pool, audit}
  end

  @doc """
  Refunds multiple costs to multiple resource pools.

  ## Examples

      resources = %{mana: ResourcePool.new(20), stamina: ResourcePool.new(50)}
      refunds = %{mana: 30, stamina: 20}

      {:ok, resources, audit} = Cost.refund_all(resources, refunds)
  """
  @spec refund_all(resource_pools(), costs()) :: {:ok, resource_pools(), audit()}
  def refund_all(resources, refunds) when is_map(resources) and is_map(refunds) do
    {new_resources, results} =
      Enum.reduce(refunds, {resources, []}, fn {resource_key, amount}, {res_acc, results_acc} ->
        case Map.get(res_acc, resource_key) do
          nil ->
            {res_acc, results_acc}

          pool ->
            {:ok, new_pool, audit} = refund(pool, amount)
            result = Map.put(audit.result, :resource, resource_key)
            {Map.put(res_acc, resource_key, new_pool), [result | results_acc]}
        end
      end)

    total_refunded =
      refunds
      |> Map.values()
      |> Enum.sum()

    refund_all_result = %{
      refunds_given: Enum.reverse(results),
      total_refunded: total_refunded
    }

    audit = %{
      operation: :refund_all,
      result: refund_all_result,
      timestamp: System.system_time(:millisecond)
    }

    {:ok, new_resources, audit}
  end

  # =============================================================================
  # Cost Scaling
  # =============================================================================

  @doc """
  Scales costs by a multiplier.

  ## Examples

      costs = %{mana: 20, stamina: 30}
      Cost.scale(costs, 1.5)
      # => %{mana: 30, stamina: 45}
  """
  @spec scale(costs(), number()) :: costs()
  def scale(costs, multiplier) when is_map(costs) and is_number(multiplier) do
    Map.new(costs, fn {key, value} ->
      {key, trunc(value * multiplier)}
    end)
  end

  @doc """
  Reduces costs by a percentage.

  ## Examples

      costs = %{mana: 100, stamina: 50}
      Cost.reduce(costs, 20)  # 20% reduction
      # => %{mana: 80, stamina: 40}
  """
  @spec reduce(costs(), number()) :: costs()
  def reduce(costs, percent_reduction) when percent_reduction >= 0 and percent_reduction <= 100 do
    multiplier = 1 - percent_reduction / 100
    scale(costs, multiplier)
  end
end
