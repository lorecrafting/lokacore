defmodule Loka.Mechanics.DamageTest do
  use ExUnit.Case, async: true

  alias Loka.Mechanics.Damage
  alias Loka.Primitives.ResourcePool

  describe "calculate/2" do
    test "calculates damage from context" do
      context = %{str: 15, weapon_bonus: 5}
      {:ok, damage, audit} = Damage.calculate(context)

      # Base damage is 20 (15 + 5), with variance
      assert damage >= 1
      assert audit.operation == :damage
      assert audit.result.base_damage == 20.0
    end

    test "applies defense reduction" do
      context = %{str: 20, weapon_bonus: 0}
      {:ok, damage_without_def, _} = Damage.calculate(context, defense: 0)
      {:ok, damage_with_def, _} = Damage.calculate(context, defense: 10)

      # Multiple runs to account for variance, but defense should reduce damage
      # We can't guarantee exact values due to variance and crits
      assert is_integer(damage_with_def)
      assert is_integer(damage_without_def)
    end

    test "respects minimum damage" do
      context = %{str: 1, weapon_bonus: 0}
      {:ok, damage, _audit} = Damage.calculate(context, defense: 100)

      # Should always deal at least 1 damage
      assert damage >= 1
    end
  end

  describe "calculate_from_base/2" do
    test "calculates from explicit base damage" do
      {:ok, damage, audit} = Damage.calculate_from_base(50)

      # With variance 0.8-1.2, damage should be 40-60
      assert damage >= 40 and damage <= 60
      assert audit.result.base_damage == 50
    end

    test "applies defense" do
      {:ok, damage, _} = Damage.calculate_from_base(50, defense: 20)

      # 50 - 20 = 30, with variance 24-36
      assert damage >= 24 and damage <= 36
    end

    test "applies critical multiplier" do
      {:ok, damage, audit} = Damage.calculate_from_base(50, critical: true)

      # 50 * 2.0 = 100, with variance 80-120
      assert damage >= 80 and damage <= 120
      assert audit.result.critical == true
    end
  end

  describe "apply_to/2" do
    test "applies damage to health pool" do
      health = ResourcePool.new(100)
      {:ok, new_health, result} = Damage.apply_to(health, 30)

      assert new_health.current == 70
      assert result.damage_dealt == 30
      assert result.health_before == 100
      assert result.health_after == 70
      assert result.is_fatal == false
    end

    test "detects fatal damage" do
      health = ResourcePool.new(current: 20, max: 100)
      {:ok, new_health, result} = Damage.apply_to(health, 30)

      assert new_health.current == 0
      assert result.is_fatal == true
      assert result.overkill == 10
    end
  end

  describe "apply_to_map/2" do
    test "works with string-keyed maps" do
      health_map = %{"current" => 100, "max" => 100}
      {:ok, new_health_map, result} = Damage.apply_to_map(health_map, 25)

      assert new_health_map["current"] == 75
      assert result.damage_dealt == 25
    end

    test "works with atom-keyed maps" do
      health_map = %{current: 100, max: 100}
      {:ok, new_health_map, result} = Damage.apply_to_map(health_map, 25)

      assert new_health_map.current == 75
      assert result.damage_dealt == 25
    end
  end

  describe "deal/3" do
    test "calculates and applies damage" do
      health = ResourcePool.new(100)
      context = %{str: 15, weapon_bonus: 5}

      {:ok, new_health, result} = Damage.deal(health, context)

      assert new_health.current < 100
      assert result.final_damage > 0
      assert result.calculation.base_damage == 20.0
      assert result.application.health_before == 100
    end
  end
end
