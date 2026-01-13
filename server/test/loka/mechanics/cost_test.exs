defmodule Loka.Mechanics.CostTest do
  use ExUnit.Case, async: true

  alias Loka.Mechanics.Cost
  alias Loka.Primitives.ResourcePool

  describe "can_afford?/2" do
    test "returns true when sufficient" do
      pool = ResourcePool.new(current: 50, max: 100)
      assert Cost.can_afford?(pool, 30) == true
      assert Cost.can_afford?(pool, 50) == true
    end

    test "returns false when insufficient" do
      pool = ResourcePool.new(current: 20, max: 100)
      assert Cost.can_afford?(pool, 30) == false
    end
  end

  describe "can_afford_all?/2" do
    test "returns true when all costs can be paid" do
      resources = %{
        mana: ResourcePool.new(50),
        stamina: ResourcePool.new(100)
      }

      costs = %{mana: 30, stamina: 50}

      assert Cost.can_afford_all?(resources, costs) == true
    end

    test "returns false when any cost cannot be paid" do
      resources = %{
        mana: ResourcePool.new(20),
        stamina: ResourcePool.new(100)
      }

      costs = %{mana: 30, stamina: 50}

      assert Cost.can_afford_all?(resources, costs) == false
    end

    test "returns false when resource is missing" do
      resources = %{mana: ResourcePool.new(50)}
      costs = %{mana: 30, stamina: 50}

      assert Cost.can_afford_all?(resources, costs) == false
    end
  end

  describe "missing_resources/2" do
    test "returns empty map when all affordable" do
      resources = %{mana: ResourcePool.new(50)}
      costs = %{mana: 30}

      assert Cost.missing_resources(resources, costs) == %{}
    end

    test "returns deficit amounts" do
      resources = %{mana: ResourcePool.new(20), stamina: ResourcePool.new(10)}
      costs = %{mana: 50, stamina: 30}

      missing = Cost.missing_resources(resources, costs)

      assert missing.mana == 30
      assert missing.stamina == 20
    end
  end

  describe "pay/2" do
    test "pays cost when sufficient" do
      pool = ResourcePool.new(50)
      {:ok, new_pool, audit} = Cost.pay(pool, 20)

      assert new_pool.current == 30
      assert audit.operation == :pay_cost
      assert audit.result.cost == 20
      assert audit.result.before == 50
      assert audit.result.after == 30
    end

    test "returns error when insufficient" do
      pool = ResourcePool.new(10)
      assert {:error, :insufficient} = Cost.pay(pool, 20)
    end
  end

  describe "pay_all/2" do
    test "pays all costs atomically" do
      resources = %{
        mana: ResourcePool.new(50),
        stamina: ResourcePool.new(100)
      }

      costs = %{mana: 20, stamina: 30}

      {:ok, new_resources, audit} = Cost.pay_all(resources, costs)

      assert new_resources.mana.current == 30
      assert new_resources.stamina.current == 70
      assert audit.operation == :pay_costs
      assert audit.result.total_cost == 50
    end

    test "returns error with missing amounts when insufficient" do
      resources = %{
        mana: ResourcePool.new(10),
        stamina: ResourcePool.new(100)
      }

      costs = %{mana: 30, stamina: 50}

      {:error, {:insufficient, missing}} = Cost.pay_all(resources, costs)

      assert missing.mana == 20
    end

    test "does not consume anything when any cost fails" do
      resources = %{
        mana: ResourcePool.new(50),
        stamina: ResourcePool.new(10)
      }

      costs = %{mana: 30, stamina: 50}

      {:error, _} = Cost.pay_all(resources, costs)

      # Resources should be unchanged
      assert resources.mana.current == 50
      assert resources.stamina.current == 10
    end
  end

  describe "refund/2" do
    test "refunds amount to pool" do
      pool = ResourcePool.new(current: 20, max: 100)
      {:ok, new_pool, audit} = Cost.refund(pool, 30)

      assert new_pool.current == 50
      assert audit.operation == :refund
    end

    test "caps at max" do
      pool = ResourcePool.new(current: 90, max: 100)
      {:ok, new_pool, _audit} = Cost.refund(pool, 50)

      assert new_pool.current == 100
    end
  end

  describe "refund_all/2" do
    test "refunds multiple resources" do
      resources = %{
        mana: ResourcePool.new(current: 20, max: 100),
        stamina: ResourcePool.new(current: 50, max: 100)
      }

      refunds = %{mana: 30, stamina: 20}

      {:ok, new_resources, audit} = Cost.refund_all(resources, refunds)

      assert new_resources.mana.current == 50
      assert new_resources.stamina.current == 70
      assert audit.result.total_refunded == 50
    end
  end

  describe "scale/2" do
    test "scales costs by multiplier" do
      costs = %{mana: 20, stamina: 30}
      scaled = Cost.scale(costs, 1.5)

      assert scaled.mana == 30
      assert scaled.stamina == 45
    end
  end

  describe "reduce/2" do
    test "reduces costs by percentage" do
      costs = %{mana: 100, stamina: 50}
      reduced = Cost.reduce(costs, 20)

      assert reduced.mana == 80
      assert reduced.stamina == 40
    end
  end
end
