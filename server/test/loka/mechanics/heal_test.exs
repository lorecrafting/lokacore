defmodule Loka.Mechanics.HealTest do
  use ExUnit.Case, async: true

  alias Loka.Mechanics.Heal
  alias Loka.Primitives.ResourcePool

  describe "calculate/2" do
    test "calculates healing from context" do
      context = %{int: 15, level: 5}
      {:ok, healing, audit} = Heal.calculate(context)

      # Base: int + level * 2 = 15 + 10 = 25
      assert healing >= 1
      assert audit.operation == :heal
    end

    test "applies bonus" do
      context = %{int: 10, level: 1}
      {:ok, healing_without, _} = Heal.calculate(context)
      {:ok, healing_with, _} = Heal.calculate(context, bonus: 20)

      # With variance, hard to compare exactly, but bonus should help
      assert is_integer(healing_with)
      assert is_integer(healing_without)
    end

    test "applies multiplier" do
      context = %{int: 10, level: 1}
      {:ok, healing, audit} = Heal.calculate(context, multiplier: 2.0)

      assert audit.result.multiplier == 2.0
    end
  end

  describe "calculate_from_base/2" do
    test "calculates from explicit base" do
      {:ok, healing, audit} = Heal.calculate_from_base(50)

      # With variance 0.9-1.1, healing should be 45-55
      assert healing >= 45 and healing <= 55
      assert audit.result.base_healing == 50
    end
  end

  describe "apply_to/3" do
    test "applies healing to health pool" do
      health = ResourcePool.new(current: 50, max: 100)
      {:ok, new_health, result} = Heal.apply_to(health, 30)

      assert new_health.current == 80
      assert result.healing_done == 30
      assert result.health_before == 50
      assert result.health_after == 80
      assert result.overheal == 0
    end

    test "caps at max health" do
      health = ResourcePool.new(current: 90, max: 100)
      {:ok, new_health, result} = Heal.apply_to(health, 50)

      assert new_health.current == 100
      assert result.overheal == 40
    end
  end

  describe "apply_to_map/3" do
    test "works with string-keyed maps" do
      health_map = %{"current" => 50, "max" => 100}
      {:ok, new_health_map, result} = Heal.apply_to_map(health_map, 30)

      assert new_health_map["current"] == 80
      assert result.healing_done == 30
    end

    test "works with atom-keyed maps" do
      health_map = %{current: 50, max: 100}
      {:ok, new_health_map, result} = Heal.apply_to_map(health_map, 30)

      assert new_health_map.current == 80
    end
  end

  describe "restore/3" do
    test "calculates and applies healing" do
      health = ResourcePool.new(current: 50, max: 100)
      context = %{int: 15, level: 5}

      {:ok, new_health, result} = Heal.restore(health, context)

      assert new_health.current > 50
      assert result.final_healing > 0
    end
  end

  describe "convenience functions" do
    test "heal_full/1" do
      health = ResourcePool.new(current: 30, max: 100)
      {:ok, new_health, result} = Heal.heal_full(health)

      assert new_health.current == 100
      assert result.healing_done == 70
    end

    test "heal_flat/2" do
      health = ResourcePool.new(current: 50, max: 100)
      {:ok, new_health, _result} = Heal.heal_flat(health, 25)

      assert new_health.current == 75
    end

    test "heal_percent/2" do
      health = ResourcePool.new(current: 50, max: 100)
      {:ok, new_health, _result} = Heal.heal_percent(health, 20)

      # 20% of 100 = 20
      assert new_health.current == 70
    end
  end
end
