defmodule Loka.Framework.EquipmentTest do
  use Loka.DataCase

  alias Loka.Framework.Equipment
  alias Loka.Framework.Inventory
  alias Loka.Framework.Player.GameState

  import Loka.AccountsFixtures

  # Helper to create an equipable item
  defp equipable_fixture(slot, bonuses \\ %{}, requirements \\ %{}) do
    {:ok, entity} =
      Loka.Engine.Entities.create_entity(%{
        key: "#{slot}_#{System.unique_integer([:positive])}",
        name: "Test #{slot}",
        description: "A test #{slot} item",
        type: "item",
        components: %{
          "equipable" => %{
            "slot" => to_string(slot),
            "bonuses" => bonuses,
            "requirements" => requirements
          }
        },
        tags: ["equipable"]
      })

    entity
  end

  # Helper to create a game state for testing
  # Uses LegendMUD-style equipment slots
  defp game_state_fixture(player_id, attrs \\ %{}) do
    defaults = %{
      inventory: [],
      equipment: %{
        "head" => nil,
        "neck" => nil,
        "torso" => nil,
        "about" => nil,
        "arms" => nil,
        "hands" => nil,
        "waist" => nil,
        "legs" => nil,
        "feet" => nil,
        "held" => nil,
        "wielded" => nil,
        "light" => nil,
        "finger_left" => nil,
        "finger_right" => nil,
        "wrist_left" => nil,
        "wrist_right" => nil
      },
      stats: %{"str" => 10, "sta" => 10, "dex" => 10, "level" => 1},
      health: %{"current" => 100, "max" => 100}
    }

    merged = Map.merge(defaults, attrs)
    {:ok, state} = GameState.create_state(player_id)
    {:ok, state} = GameState.update_state(state, merged)
    state
  end

  describe "slots/0" do
    test "returns all valid LegendMUD-style equipment slots" do
      slots = Equipment.slots()

      # Should include all 16 LegendMUD-style slots
      assert :head in slots
      assert :torso in slots
      assert :wielded in slots
      assert :held in slots
      assert :light in slots
      assert length(slots) == 16
    end
  end

  describe "equip/2" do
    test "equips item from inventory to correct slot" do
      player = player_fixture()
      # :wielded is the LegendMUD-style slot for weapons
      weapon = equipable_fixture(:wielded, %{"attack" => 10})
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, weapon.id)
      assert {:ok, updated_state} = Equipment.equip(state, weapon.id)

      # Equipment uses string keys in the map
      assert updated_state.equipment.wielded == weapon.id
      refute weapon.id in updated_state.inventory
    end

    test "returns error when item not in inventory" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded)
      state = game_state_fixture(player.id)

      assert {:error, :not_in_inventory} = Equipment.equip(state, weapon.id)
    end

    test "returns error for non-equipable item" do
      player = player_fixture()

      {:ok, regular_item} =
        Loka.Engine.Entities.create_entity(%{
          key: "regular_item_#{System.unique_integer([:positive])}",
          name: "Regular Item",
          description: "Not equipable",
          type: "item",
          components: %{},
          tags: []
        })

      state = game_state_fixture(player.id)
      {:ok, state} = Inventory.add_item(state, regular_item.id)

      assert {:error, :not_equipable} = Equipment.equip(state, regular_item.id)
    end

    test "swaps existing equipment to inventory" do
      player = player_fixture()
      weapon1 = equipable_fixture(:wielded, %{"attack" => 5})
      weapon2 = equipable_fixture(:wielded, %{"attack" => 10})
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, weapon1.id)
      {:ok, state} = Inventory.add_item(state, weapon2.id)

      {:ok, state} = Equipment.equip(state, weapon1.id)
      {:ok, state} = Equipment.equip(state, weapon2.id)

      assert state.equipment.wielded == weapon2.id
      assert weapon1.id in state.inventory
      refute weapon2.id in state.inventory
    end

    test "respects level requirements" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded, %{"attack" => 100}, %{"level" => 10})
      # Use atom keys for stats since requirements are atomized
      state = game_state_fixture(player.id, %{stats: %{level: 5, str: 10, sta: 10, dex: 10}})

      {:ok, state} = Inventory.add_item(state, weapon.id)

      assert {:error, {:requirements_not_met, missing}} = Equipment.equip(state, weapon.id)
      # Requirements are converted to atom keys by Equipable.from_map
      assert Map.has_key?(missing, :level)
    end

    test "allows equipping when requirements met" do
      player = player_fixture()
      # Use atom keys for requirements since Equipable.from_map converts them
      weapon = equipable_fixture(:wielded, %{"attack" => 10}, %{"str" => 10, "level" => 5})
      # Stats must use atom keys to match requirement check (code checks atom keys against stats)
      state = game_state_fixture(player.id, %{stats: %{str: 15, level: 10, sta: 10, dex: 10}})

      {:ok, state} = Inventory.add_item(state, weapon.id)

      assert {:ok, updated_state} = Equipment.equip(state, weapon.id)
      assert updated_state.equipment.wielded == weapon.id
    end
  end

  describe "unequip/2" do
    test "unequips item and returns it to inventory" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded)
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, weapon.id)
      {:ok, state} = Equipment.equip(state, weapon.id)

      assert {:ok, updated_state} = Equipment.unequip(state, :wielded)
      assert updated_state.equipment.wielded == nil
      assert weapon.id in updated_state.inventory
    end

    test "returns error for empty slot" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :slot_empty} = Equipment.unequip(state, :wielded)
    end

    test "returns error for invalid slot" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      # :weapon is now an invalid slot (legacy name)
      assert {:error, {:invalid_slot, :weapon}} = Equipment.unequip(state, :weapon)
    end
  end

  describe "get_equipped/1" do
    test "returns map of slot to item details" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded, %{"attack" => 10})
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, weapon.id)
      {:ok, state} = Equipment.equip(state, weapon.id)

      equipped = Equipment.get_equipped(state)

      # After equipping, the wielded slot should have the item
      # Keys can be atoms (from equip) or strings (from DB defaults)
      wielded_item = equipped[:wielded] || equipped["wielded"]
      assert wielded_item != nil
      assert wielded_item.id == weapon.id

      # Other slots should be nil (using flexible key access)
      torso_item = equipped[:torso] || equipped["torso"]
      held_item = equipped[:held] || equipped["held"]
      assert torso_item == nil
      assert held_item == nil
    end

    test "returns all nil for empty equipment" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      equipped = Equipment.get_equipped(state)

      assert equipped["wielded"] == nil
      assert equipped["torso"] == nil
      assert equipped["held"] == nil
    end
  end

  describe "get_equipped_id/2" do
    test "returns item_id for occupied slot" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded)
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, weapon.id)
      {:ok, state} = Equipment.equip(state, weapon.id)

      assert Equipment.get_equipped_id(state, :wielded) == weapon.id
    end

    test "returns nil for empty slot" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Equipment.get_equipped_id(state, :wielded) == nil
    end
  end

  describe "get_total_bonuses/1" do
    test "sums bonuses from all equipped items" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded, %{"attack" => 10, "crit" => 5})
      armor = equipable_fixture(:torso, %{"defense" => 8, "crit" => 2})
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, weapon.id)
      {:ok, state} = Inventory.add_item(state, armor.id)
      {:ok, state} = Equipment.equip(state, weapon.id)
      {:ok, state} = Equipment.equip(state, armor.id)

      bonuses = Equipment.get_total_bonuses(state)

      assert bonuses[:attack] == 10
      assert bonuses[:defense] == 8
      assert bonuses[:crit] == 7
    end

    test "returns empty map when nothing equipped" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Equipment.get_total_bonuses(state) == %{}
    end
  end

  describe "calculate_combat_stats/1" do
    test "calculates stats with equipment bonuses" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded, %{"attack" => 5})
      armor = equipable_fixture(:torso, %{"defense" => 3})
      state = game_state_fixture(player.id, %{stats: %{"str" => 10, "sta" => 10}})

      {:ok, state} = Inventory.add_item(state, weapon.id)
      {:ok, state} = Inventory.add_item(state, armor.id)
      {:ok, state} = Equipment.equip(state, weapon.id)
      {:ok, state} = Equipment.equip(state, armor.id)

      combat_stats = Equipment.calculate_combat_stats(state)

      # Attack = STR * 2 + weapon_bonus = 10 * 2 + 5 = 25
      assert combat_stats.attack == 25
      # Defense = STA + armor_bonus = 10 + 3 = 13
      assert combat_stats.defense == 13
      # Max Health = STA * 10 = 100
      assert combat_stats.max_health == 100
    end

    test "calculates stats without equipment" do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{"str" => 15, "sta" => 12}})

      combat_stats = Equipment.calculate_combat_stats(state)

      # Attack = STR * 2 + 0 = 30
      assert combat_stats.attack == 30
      # Defense = STA + 0 = 12
      assert combat_stats.defense == 12
      # Max Health = STA * 10 = 120
      assert combat_stats.max_health == 120
    end

    test "handles string key stats from DB" do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{"str" => 20, "sta" => 15}})

      combat_stats = Equipment.calculate_combat_stats(state)

      assert combat_stats.attack == 40
      assert combat_stats.defense == 15
      assert combat_stats.max_health == 150
    end

    test "uses default stats when missing" do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{}})

      combat_stats = Equipment.calculate_combat_stats(state)

      # Defaults to str: 10, sta: 10
      assert combat_stats.attack == 20
      assert combat_stats.defense == 10
      assert combat_stats.max_health == 100
    end
  end

  describe "equipped?/2" do
    test "returns true when item is equipped" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded)
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, weapon.id)
      {:ok, state} = Equipment.equip(state, weapon.id)

      assert Equipment.equipped?(state, weapon.id) == true
    end

    test "returns false when item is not equipped" do
      player = player_fixture()
      weapon = equipable_fixture(:wielded)
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, weapon.id)

      assert Equipment.equipped?(state, weapon.id) == false
    end

    test "returns false for unknown item" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Equipment.equipped?(state, "unknown_item") == false
    end
  end
end
