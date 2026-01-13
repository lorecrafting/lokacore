defmodule Loka.Framework.Inventory.EquipableTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Inventory.Equipable

  describe "new/1" do
    test "creates equipable with defaults" do
      equipable = Equipable.new()

      # Default slot is :held (LegendMUD-style)
      assert equipable.slot == :held
      assert equipable.bonuses == %{}
      assert equipable.requirements == %{}
    end

    test "creates equipable with custom attributes" do
      equipable = Equipable.new(slot: :wielded, bonuses: %{attack: 10}, requirements: %{str: 5})

      assert equipable.slot == :wielded
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
        "slot" => "wielded",
        "bonuses" => %{"attack" => 15, "crit" => 2},
        "requirements" => %{"str" => 10, "level" => 5}
      }

      equipable = Equipable.from_map(data)

      # "wielded" string maps to :wielded atom
      assert equipable.slot == :wielded
      assert equipable.bonuses == %{attack: 15, crit: 2}
      assert equipable.requirements == %{str: 10, level: 5}
    end

    test "converts map with atom keys" do
      data = %{
        slot: :torso,
        bonuses: %{defense: 8},
        requirements: %{sta: 12}
      }

      equipable = Equipable.from_map(data)

      assert equipable.slot == :torso
      assert equipable.bonuses == %{defense: 8}
      assert equipable.requirements == %{sta: 12}
    end

    test "handles all slot types" do
      # Test LegendMUD-style slots
      for slot <- ["head", "torso", "wielded", "held", "hands", "feet"] do
        equipable = Equipable.from_map(%{"slot" => slot})
        assert equipable.slot == String.to_existing_atom(slot)
      end
    end

    test "handles legacy slot names with backwards compatibility" do
      # Legacy "weapon" maps to :wielded, "armor" maps to :torso, "accessory" maps to :held
      assert Equipable.from_map(%{"slot" => "weapon"}).slot == :wielded
      assert Equipable.from_map(%{"slot" => "armor"}).slot == :torso
      assert Equipable.from_map(%{"slot" => "accessory"}).slot == :held
    end

    test "defaults unknown slot to held" do
      equipable = Equipable.from_map(%{"slot" => "unknown"})
      assert equipable.slot == :held
    end

    test "handles missing fields with defaults" do
      equipable = Equipable.from_map(%{})

      # Missing slot defaults to :held (from parse_slot fallback)
      assert equipable.slot == :held
      assert equipable.bonuses == %{}
      assert equipable.requirements == %{}
    end
  end

  describe "slots/0" do
    test "returns all valid LegendMUD-style equipment slots" do
      slots = Equipable.slots()

      # Should include all 15 LegendMUD-style slots
      assert :head in slots
      assert :neck in slots
      assert :torso in slots
      assert :about in slots
      assert :arms in slots
      assert :hands in slots
      assert :waist in slots
      assert :legs in slots
      assert :feet in slots
      assert :held in slots
      assert :wielded in slots
      assert :finger_left in slots
      assert :finger_right in slots
      assert :wrist_left in slots
      assert :wrist_right in slots

      assert length(slots) == 15
    end
  end

  describe "valid_slot?/1" do
    test "returns true for valid slots" do
      assert Equipable.valid_slot?(:wielded) == true
      assert Equipable.valid_slot?(:torso) == true
      assert Equipable.valid_slot?(:held) == true
      assert Equipable.valid_slot?(:head) == true
      assert Equipable.valid_slot?(:feet) == true
    end

    test "returns false for invalid slots" do
      # Legacy slot names are not valid (they get mapped during from_map)
      assert Equipable.valid_slot?(:weapon) == false
      assert Equipable.valid_slot?(:armor) == false
      assert Equipable.valid_slot?(:accessory) == false
      assert Equipable.valid_slot?("wielded") == false
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
