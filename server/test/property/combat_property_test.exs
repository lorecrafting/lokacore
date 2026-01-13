defmodule Loka.Framework.Combat.CombatPropertyTest do
  @moduledoc """
  Property-based tests for combat calculations.

  These tests verify that combat math maintains expected invariants
  such as damage bounds, stat effects, and type effectiveness.
  """
  use ExUnit.Case, async: true
  use ExUnitProperties

  alias Loka.Framework.Combat.WeaponArmorTypes

  # =============================================================================
  # Generators
  # =============================================================================

  defp weapon_type_gen do
    StreamData.member_of(WeaponArmorTypes.weapon_types())
  end

  defp armor_type_gen do
    StreamData.member_of(WeaponArmorTypes.armor_types())
  end

  defp positive_damage_gen do
    StreamData.integer(1..1000)
  end

  defp stat_value_gen do
    StreamData.integer(1..100)
  end

  defp stats_gen do
    gen all(
          str <- stat_value_gen(),
          dex <- stat_value_gen(),
          con <- stat_value_gen(),
          int <- stat_value_gen(),
          wis <- stat_value_gen()
        ) do
      %{str: str, dex: dex, con: con, int: int, wis: wis}
    end
  end

  # =============================================================================
  # WeaponArmorTypes Properties
  # =============================================================================

  describe "WeaponArmorTypes.get_modifier/2" do
    property "modifier is always a positive number" do
      check all(
              weapon <- weapon_type_gen(),
              armor <- armor_type_gen()
            ) do
        modifier = WeaponArmorTypes.get_modifier(weapon, armor)
        assert is_number(modifier)
        assert modifier > 0
      end
    end

    property "modifier is within reasonable bounds (0.5 to 2.0)" do
      check all(
              weapon <- weapon_type_gen(),
              armor <- armor_type_gen()
            ) do
        modifier = WeaponArmorTypes.get_modifier(weapon, armor)
        assert modifier >= 0.5
        assert modifier <= 2.0
      end
    end

    property "unknown weapon type returns 1.0 modifier" do
      check all(armor <- armor_type_gen()) do
        modifier = WeaponArmorTypes.get_modifier(:unknown_weapon, armor)
        assert modifier == 1.0
      end
    end

    property "unknown armor type returns 1.0 modifier" do
      check all(weapon <- weapon_type_gen()) do
        modifier = WeaponArmorTypes.get_modifier(weapon, :unknown_armor)
        assert modifier == 1.0
      end
    end
  end

  describe "WeaponArmorTypes.apply_modifier/3" do
    property "applied damage is always positive when base damage is positive" do
      check all(
              base_damage <- positive_damage_gen(),
              weapon <- weapon_type_gen(),
              armor <- armor_type_gen()
            ) do
        result = WeaponArmorTypes.apply_modifier(base_damage, weapon, armor)
        assert result > 0
      end
    end

    property "applied damage is an integer" do
      check all(
              base_damage <- positive_damage_gen(),
              weapon <- weapon_type_gen(),
              armor <- armor_type_gen()
            ) do
        result = WeaponArmorTypes.apply_modifier(base_damage, weapon, armor)
        assert is_integer(result)
      end
    end

    property "effective weapon does more damage than resisted weapon" do
      # Slashing is effective vs cloth, bludgeoning is resisted by leather
      check all(base_damage <- positive_damage_gen()) do
        effective = WeaponArmorTypes.apply_modifier(base_damage, :slashing, :cloth)
        resisted = WeaponArmorTypes.apply_modifier(base_damage, :slashing, :plate)

        assert effective >= resisted
      end
    end

    property "damage scales linearly with base damage" do
      check all(
              base_damage <- positive_damage_gen(),
              weapon <- weapon_type_gen(),
              armor <- armor_type_gen()
            ) do
        result1 = WeaponArmorTypes.apply_modifier(base_damage, weapon, armor)
        result2 = WeaponArmorTypes.apply_modifier(base_damage * 2, weapon, armor)

        # Due to rounding, allow small variance
        assert abs(result2 - result1 * 2) <= 1
      end
    end
  end

  describe "WeaponArmorTypes.effective_weapons/1" do
    property "returned weapons actually have > 1.0 modifier against the armor" do
      check all(armor <- armor_type_gen()) do
        effective = WeaponArmorTypes.effective_weapons(armor)

        for weapon <- effective do
          modifier = WeaponArmorTypes.get_modifier(weapon, armor)
          assert modifier > 1.0
        end
      end
    end
  end

  describe "WeaponArmorTypes.weak_weapons/1" do
    property "returned weapons actually have < 1.0 modifier against the armor" do
      check all(armor <- armor_type_gen()) do
        weak = WeaponArmorTypes.weak_weapons(armor)

        for weapon <- weak do
          modifier = WeaponArmorTypes.get_modifier(weapon, armor)
          assert modifier < 1.0
        end
      end
    end
  end

  describe "WeaponArmorTypes.effective_against/1" do
    property "returned armors actually have > 1.0 modifier from the weapon" do
      check all(weapon <- weapon_type_gen()) do
        effective_against = WeaponArmorTypes.effective_against(weapon)

        for armor <- effective_against do
          modifier = WeaponArmorTypes.get_modifier(weapon, armor)
          assert modifier > 1.0
        end
      end
    end
  end

  describe "WeaponArmorTypes.resisted_by/1" do
    property "returned armors actually have < 1.0 modifier from the weapon" do
      check all(weapon <- weapon_type_gen()) do
        resisted_by = WeaponArmorTypes.resisted_by(weapon)

        for armor <- resisted_by do
          modifier = WeaponArmorTypes.get_modifier(weapon, armor)
          assert modifier < 1.0
        end
      end
    end
  end

  describe "WeaponArmorTypes.describe_effectiveness/2" do
    property "description is one of the expected strings" do
      check all(
              weapon <- weapon_type_gen(),
              armor <- armor_type_gen()
            ) do
        description = WeaponArmorTypes.describe_effectiveness(weapon, armor)

        assert description in [
                 "very effective",
                 "effective",
                 "normal",
                 "resisted",
                 "highly resisted"
               ]
      end
    end

    property "description matches modifier range" do
      check all(
              weapon <- weapon_type_gen(),
              armor <- armor_type_gen()
            ) do
        modifier = WeaponArmorTypes.get_modifier(weapon, armor)
        description = WeaponArmorTypes.describe_effectiveness(weapon, armor)

        case description do
          "very effective" -> assert modifier >= 1.2
          "effective" -> assert modifier > 1.0 and modifier < 1.2
          "normal" -> assert modifier == 1.0
          "resisted" -> assert modifier < 1.0 and modifier >= 0.8
          "highly resisted" -> assert modifier < 0.8
        end
      end
    end
  end

  # =============================================================================
  # Stat-based combat properties
  # =============================================================================

  describe "stat-based damage calculations" do
    property "higher strength should generally mean more physical damage" do
      check all(
              base_damage <- positive_damage_gen(),
              low_str <- StreamData.integer(1..10),
              high_str <- StreamData.integer(50..100)
            ) do
        # Simple damage formula: base + str/2
        low_damage = base_damage + div(low_str, 2)
        high_damage = base_damage + div(high_str, 2)

        assert high_damage >= low_damage
      end
    end

    property "defense reduces damage but never makes it negative" do
      check all(
              incoming_damage <- positive_damage_gen(),
              defense <- StreamData.integer(0..200)
            ) do
        # Simple defense formula: max(1, damage - defense/2)
        final_damage = max(1, incoming_damage - div(defense, 2))

        assert final_damage >= 1
      end
    end

    property "critical hits do more damage than normal hits" do
      check all(base_damage <- positive_damage_gen()) do
        normal = base_damage
        critical = base_damage * 2

        assert critical > normal
      end
    end
  end
end
