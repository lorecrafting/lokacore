defmodule Loka.Framework.Combat.WeaponArmorTypesTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Combat.WeaponArmorTypes

  describe "get_modifier/2" do
    test "returns expected modifier for slashing vs cloth" do
      assert WeaponArmorTypes.get_modifier(:slashing, :cloth) == 1.25
    end

    test "returns expected modifier for slashing vs plate" do
      assert WeaponArmorTypes.get_modifier(:slashing, :plate) == 0.75
    end

    test "returns expected modifier for bludgeoning vs plate" do
      assert WeaponArmorTypes.get_modifier(:bludgeoning, :plate) == 1.25
    end

    test "returns expected modifier for piercing vs chain" do
      assert WeaponArmorTypes.get_modifier(:piercing, :chain) == 1.25
    end

    test "returns 1.0 for neutral combinations" do
      assert WeaponArmorTypes.get_modifier(:slashing, :chain) == 1.0
    end

    test "returns 1.0 for unknown weapon type" do
      assert WeaponArmorTypes.get_modifier(:unknown, :cloth) == 1.0
    end

    test "returns 1.0 for unknown armor type" do
      assert WeaponArmorTypes.get_modifier(:slashing, :unknown) == 1.0
    end

    test "handles string inputs" do
      assert WeaponArmorTypes.get_modifier("slashing", "cloth") == 1.25
    end

    test "returns 1.0 for none armor type" do
      assert WeaponArmorTypes.get_modifier(:slashing, :none) == 1.0
    end
  end

  describe "apply_modifier/3" do
    test "applies modifier to base damage for effective combo" do
      assert WeaponArmorTypes.apply_modifier(100, :slashing, :cloth) == 125
    end

    test "applies modifier to base damage for resisted combo" do
      assert WeaponArmorTypes.apply_modifier(100, :slashing, :plate) == 75
    end

    test "applies modifier to base damage for neutral combo" do
      assert WeaponArmorTypes.apply_modifier(100, :slashing, :chain) == 100
    end

    test "rounds to nearest integer" do
      # bludgeoning vs leather is 0.9, so 105 * 0.9 = 94.5 -> 95
      assert WeaponArmorTypes.apply_modifier(105, :bludgeoning, :leather) == 95
    end
  end

  describe "effective_weapons/1" do
    test "returns weapons effective against cloth" do
      weapons = WeaponArmorTypes.effective_weapons(:cloth)
      assert :slashing in weapons
    end

    test "returns weapons effective against plate" do
      weapons = WeaponArmorTypes.effective_weapons(:plate)
      assert :bludgeoning in weapons
    end

    test "returns empty list for unknown armor" do
      weapons = WeaponArmorTypes.effective_weapons(:unknown)
      assert weapons == []
    end
  end

  describe "weak_weapons/1" do
    test "returns weapons weak against plate" do
      weapons = WeaponArmorTypes.weak_weapons(:plate)
      assert :slashing in weapons
      assert :piercing in weapons
    end

    test "returns weapons weak against leather" do
      weapons = WeaponArmorTypes.weak_weapons(:leather)
      assert :bludgeoning in weapons
    end
  end

  describe "effective_against/1" do
    test "returns armors weak against slashing" do
      armors = WeaponArmorTypes.effective_against(:slashing)
      assert :cloth in armors
      assert :leather in armors
    end

    test "returns armors weak against bludgeoning" do
      armors = WeaponArmorTypes.effective_against(:bludgeoning)
      assert :plate in armors
    end

    test "returns empty list for unknown weapon" do
      armors = WeaponArmorTypes.effective_against(:unknown)
      assert armors == []
    end
  end

  describe "resisted_by/1" do
    test "returns armors that resist slashing" do
      armors = WeaponArmorTypes.resisted_by(:slashing)
      assert :plate in armors
      assert :scale in armors
    end

    test "returns armors that resist bludgeoning" do
      armors = WeaponArmorTypes.resisted_by(:bludgeoning)
      assert :leather in armors
    end
  end

  describe "describe_effectiveness/2" do
    test "describes very effective" do
      assert WeaponArmorTypes.describe_effectiveness(:slashing, :cloth) == "very effective"
    end

    test "describes effective" do
      assert WeaponArmorTypes.describe_effectiveness(:slashing, :leather) == "effective"
    end

    test "describes normal" do
      assert WeaponArmorTypes.describe_effectiveness(:slashing, :chain) == "normal"
    end

    test "describes resisted" do
      assert WeaponArmorTypes.describe_effectiveness(:slashing, :scale) == "resisted"
    end

    test "describes highly resisted" do
      assert WeaponArmorTypes.describe_effectiveness(:slashing, :plate) == "highly resisted"
    end
  end

  describe "weapon_types/0" do
    test "returns all weapon types" do
      types = WeaponArmorTypes.weapon_types()
      assert :slashing in types
      assert :bludgeoning in types
      assert :piercing in types
      assert :magic in types
    end
  end

  describe "armor_types/0" do
    test "returns all armor types" do
      types = WeaponArmorTypes.armor_types()
      assert :none in types
      assert :cloth in types
      assert :leather in types
      assert :chain in types
      assert :scale in types
      assert :plate in types
    end
  end
end
