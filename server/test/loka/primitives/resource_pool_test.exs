defmodule Loka.Primitives.ResourcePoolTest do
  use ExUnit.Case, async: true

  alias Loka.Primitives.ResourcePool

  describe "new/1" do
    test "creates pool with max value" do
      pool = ResourcePool.new(100)
      assert pool.current == 100
      assert pool.max == 100
      assert pool.min == 0
    end

    test "creates pool from keyword list" do
      pool = ResourcePool.new(current: 50, max: 100, min: -10)
      assert pool.current == 50
      assert pool.max == 100
      assert pool.min == -10
    end

    test "clamps current to min/max" do
      pool = ResourcePool.new(current: 150, max: 100)
      assert pool.current == 100

      pool = ResourcePool.new(current: -10, max: 100, min: 0)
      assert pool.current == 0
    end
  end

  describe "from_map/1" do
    test "creates pool from string-keyed map" do
      pool = ResourcePool.from_map(%{"current" => 50, "max" => 100})
      assert pool.current == 50
      assert pool.max == 100
    end

    test "creates pool from atom-keyed map" do
      pool = ResourcePool.from_map(%{current: 50, max: 100})
      assert pool.current == 50
      assert pool.max == 100
    end
  end

  describe "consume/2" do
    test "consumes amount when sufficient" do
      pool = ResourcePool.new(100)
      {:ok, new_pool, audit} = ResourcePool.consume(pool, 30)

      assert new_pool.current == 70
      assert audit.operation == :consume
      assert audit.before == 100
      assert audit.after == 70
      assert audit.amount == 30
    end

    test "returns error when insufficient" do
      pool = ResourcePool.new(current: 20, max: 100)
      assert {:error, :insufficient} = ResourcePool.consume(pool, 30)
    end

    test "clamps to min value" do
      pool = ResourcePool.new(current: 100, max: 100, min: 10)
      {:ok, new_pool, audit} = ResourcePool.consume(pool, 95)

      assert new_pool.current == 10
      assert audit.clamped == true
    end
  end

  describe "force_consume/2" do
    test "consumes even when exceeds current" do
      pool = ResourcePool.new(current: 20, max: 100)
      {:ok, new_pool, audit} = ResourcePool.force_consume(pool, 50)

      assert new_pool.current == 0
      assert audit.operation == :force_consume
      assert audit.clamped == true
    end
  end

  describe "restore/2" do
    test "restores amount up to max" do
      pool = ResourcePool.new(current: 50, max: 100)
      {:ok, new_pool, audit} = ResourcePool.restore(pool, 30)

      assert new_pool.current == 80
      assert audit.operation == :restore
    end

    test "caps at max" do
      pool = ResourcePool.new(current: 90, max: 100)
      {:ok, new_pool, audit} = ResourcePool.restore(pool, 50)

      assert new_pool.current == 100
      assert audit.clamped == true
    end
  end

  describe "queries" do
    test "has_enough?/2" do
      pool = ResourcePool.new(current: 50, max: 100)
      assert ResourcePool.has_enough?(pool, 30) == true
      assert ResourcePool.has_enough?(pool, 50) == true
      assert ResourcePool.has_enough?(pool, 60) == false
    end

    test "percentage/1" do
      pool = ResourcePool.new(current: 25, max: 100)
      assert ResourcePool.percentage(pool) == 0.25
    end

    test "is_full?/1" do
      assert ResourcePool.is_full?(ResourcePool.new(100)) == true
      assert ResourcePool.is_full?(ResourcePool.new(current: 99, max: 100)) == false
    end

    test "is_empty?/1" do
      assert ResourcePool.is_empty?(ResourcePool.new(current: 0, max: 100)) == true
      assert ResourcePool.is_empty?(ResourcePool.new(current: 1, max: 100)) == false
    end

    test "deficit/1" do
      pool = ResourcePool.new(current: 70, max: 100)
      assert ResourcePool.deficit(pool) == 30
    end

    test "available/1" do
      pool = ResourcePool.new(current: 70, max: 100, min: 10)
      assert ResourcePool.available(pool) == 60
    end
  end

  describe "set/2" do
    test "sets value directly" do
      pool = ResourcePool.new(100)
      {:ok, new_pool, _audit} = ResourcePool.set(pool, 42)
      assert new_pool.current == 42
    end

    test "clamps to bounds" do
      pool = ResourcePool.new(100)
      {:ok, new_pool, _audit} = ResourcePool.set(pool, 150)
      assert new_pool.current == 100
    end
  end

  describe "set_max/2" do
    test "updates max and clamps current" do
      pool = ResourcePool.new(current: 80, max: 100)
      {:ok, new_pool, _audit} = ResourcePool.set_max(pool, 60)

      assert new_pool.max == 60
      assert new_pool.current == 60
    end
  end

  describe "fill/1 and empty/1" do
    test "fill sets to max" do
      pool = ResourcePool.new(current: 50, max: 100)
      {:ok, new_pool, _audit} = ResourcePool.fill(pool)
      assert new_pool.current == 100
    end

    test "empty sets to min" do
      pool = ResourcePool.new(current: 50, max: 100, min: 10)
      {:ok, new_pool, _audit} = ResourcePool.empty(pool)
      assert new_pool.current == 10
    end
  end

  describe "to_map/1" do
    test "converts to map with string keys" do
      pool = ResourcePool.new(current: 50, max: 100)
      map = ResourcePool.to_map(pool)

      assert map == %{"current" => 50, "max" => 100, "min" => 0}
    end
  end
end
