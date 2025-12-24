defmodule Exmud.Framework.Inventory.EquipableTest do
  use ExUnit.Case, async: true

  alias Exmud.Framework.Inventory.Equipable

  describe "new/1" do
    test "creates equipable with defaults" do
      equipable = Equipable.new()

      assert equipable.slot == :accessory
      assert equipable.bonuses == %{}
      assert equipable.requirements == %{}
    end

    test "creates equipable with custom attributes" do
      equipable = Equipable.new(slot: :weapon, bonuses: %{attack: 10}, requirements: %{str: 5})

      assert equipable.slot == :weapon
      assert equipable.bonuses == %{attack: 10}
      assert equipable.requirements == %{str: 5}
    end
  end

  describe "from_map/1" do
    test "returns nil for nil input" do
      assert Equipable.from_map(nil) == nil
    end

    test "converts map with string keys" do
      data = %{
        "slot" => "weapon",
        "bonuses" => %{"attack" => 15, "crit" => 2},
        "requirements" => %{"str" => 10, "level" => 5}
      }

      equipable = Equipable.from_map(data)

      assert equipable.slot == :weapon
      assert equipable.bonuses == %{attack: 15, crit: 2}
      assert equipable.requirements == %{str: 10, level: 5}
    end

    test "converts map with atom keys" do
      data = %{
        slot: :armor,
        bonuses: %{defense: 8},
        requirements: %{sta: 12}
      }

      equipable = Equipable.from_map(data)

      assert equipable.slot == :armor
      assert equipable.bonuses == %{defense: 8}
      assert equipable.requirements == %{sta: 12}
    end

    test "handles all slot types" do
      for slot <- ["weapon", "armor", "accessory"] do
        equipable = Equipable.from_map(%{"slot" => slot})
        assert equipable.slot == String.to_existing_atom(slot)
      end
    end

    test "defaults unknown slot to accessory" do
      equipable = Equipable.from_map(%{"slot" => "unknown"})
      assert equipable.slot == :accessory
    end

    test "handles missing fields with defaults" do
      equipable = Equipable.from_map(%{})

      # Note: missing slot returns nil (atom) since nil matches `atom when is_atom(atom)`
      assert equipable.slot == nil
      assert equipable.bonuses == %{}
      assert equipable.requirements == %{}
    end
  end

  describe "slots/0" do
    test "returns all valid equipment slots" do
      assert Equipable.slots() == [:weapon, :armor, :accessory]
    end
  end

  describe "valid_slot?/1" do
    test "returns true for valid slots" do
      assert Equipable.valid_slot?(:weapon) == true
      assert Equipable.valid_slot?(:armor) == true
      assert Equipable.valid_slot?(:accessory) == true
    end

    test "returns false for invalid slots" do
      assert Equipable.valid_slot?(:helmet) == false
      assert Equipable.valid_slot?(:boots) == false
      assert Equipable.valid_slot?("weapon") == false
    end
  end

  describe "meets_requirements?/2" do
    test "returns true when no requirements" do
      equipable = Equipable.new(requirements: %{})
      character_stats = %{str: 10, level: 5}

      assert Equipable.meets_requirements?(equipable, character_stats) == true
    end

    test "returns true when all requirements met" do
      equipable = Equipable.new(requirements: %{str: 10, level: 5})
      character_stats = %{str: 15, level: 10}

      assert Equipable.meets_requirements?(equipable, character_stats) == true
    end

    test "returns true when requirements exactly met" do
      equipable = Equipable.new(requirements: %{str: 10, level: 5})
      character_stats = %{str: 10, level: 5}

      assert Equipable.meets_requirements?(equipable, character_stats) == true
    end

    test "returns error when requirements not met" do
      equipable = Equipable.new(requirements: %{str: 20, level: 10})
      character_stats = %{str: 15, level: 5}

      assert {:error, missing} = Equipable.meets_requirements?(equipable, character_stats)
      assert missing == %{str: 20, level: 10}
    end

    test "handles partial requirement failures" do
      equipable = Equipable.new(requirements: %{str: 10, dex: 15, level: 5})
      character_stats = %{str: 10, dex: 10, level: 5}

      assert {:error, missing} = Equipable.meets_requirements?(equipable, character_stats)
      assert missing == %{dex: 15}
    end

    test "handles missing stats as 0" do
      equipable = Equipable.new(requirements: %{str: 10})
      character_stats = %{}

      assert {:error, missing} = Equipable.meets_requirements?(equipable, character_stats)
      assert missing == %{str: 10}
    end
  end

  describe "get_bonus/2" do
    test "returns bonus value for existing stat" do
      equipable = Equipable.new(bonuses: %{attack: 10, defense: 5})

      assert Equipable.get_bonus(equipable, :attack) == 10
      assert Equipable.get_bonus(equipable, :defense) == 5
    end

    test "returns 0 for non-existent bonus" do
      equipable = Equipable.new(bonuses: %{attack: 10})

      assert Equipable.get_bonus(equipable, :crit) == 0
      assert Equipable.get_bonus(equipable, :speed) == 0
    end

    test "returns 0 for empty bonuses" do
      equipable = Equipable.new(bonuses: %{})

      assert Equipable.get_bonus(equipable, :attack) == 0
    end
  end
end
