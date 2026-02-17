defmodule Loka.Mechanics.DamagePropertyTest do
  use ExUnit.Case, async: true
  use ExUnitProperties

  alias Loka.Mechanics.Damage
  alias Loka.Primitives.ResourcePool

  describe "calculate properties" do
    property "damage is always >= 1 (minimum floor)" do
      check all(
              str <- integer(0..50),
              weapon_bonus <- integer(0..20),
              defense <- integer(0..100)
            ) do
        context = %{str: str, weapon_bonus: weapon_bonus}
        {:ok, damage, _audit} = Damage.calculate(context, defense: defense)
        assert damage >= 1
      end
    end

    property "critical hits apply crit multiplier in audit trail" do
      check all(
              str <- integer(5..30),
              weapon_bonus <- integer(1..15)
            ) do
        context = %{str: str, weapon_bonus: weapon_bonus}
        {:ok, _crit_damage, crit_audit} = Damage.calculate(context, critical: true)
        {:ok, _normal_damage, normal_audit} = Damage.calculate(context, critical: false)

        # Crit audit records multiplier > 1, non-crit records 1.0
        assert crit_audit.result.critical_multiplier > normal_audit.result.critical_multiplier
      end
    end
  end

  describe "calculate_from_base properties" do
    property "damage from base is always >= 1" do
      check all(
              base <- integer(1..100),
              defense <- integer(0..50)
            ) do
        {:ok, damage, _audit} = Damage.calculate_from_base(base, defense: defense)
        assert damage >= 1
      end
    end
  end

  describe "apply_to properties" do
    property "health never goes below pool minimum after damage" do
      check all(
              max_hp <- integer(10..200),
              current_hp <- integer(1..max_hp),
              damage_amount <- integer(0..300)
            ) do
        pool = ResourcePool.new(current: current_hp, max: max_hp)
        {:ok, new_pool, _result} = Damage.apply_to(pool, damage_amount)
        assert new_pool.current >= new_pool.min
      end
    end

    property "is_fatal is true iff health reaches minimum" do
      check all(
              max_hp <- integer(10..200),
              current_hp <- integer(1..max_hp),
              damage_amount <- integer(0..300)
            ) do
        pool = ResourcePool.new(current: current_hp, max: max_hp)
        {:ok, new_pool, result} = Damage.apply_to(pool, damage_amount)

        if new_pool.current <= new_pool.min do
          assert result.is_fatal
        else
          refute result.is_fatal
        end
      end
    end

    property "overkill is max(0, damage - health_before)" do
      check all(
              max_hp <- integer(10..200),
              current_hp <- integer(1..max_hp),
              damage_amount <- integer(0..300)
            ) do
        pool = ResourcePool.new(current: current_hp, max: max_hp)
        {:ok, _new_pool, result} = Damage.apply_to(pool, damage_amount)
        assert result.overkill == max(0, damage_amount - current_hp)
      end
    end
  end
end
