defmodule Exmud.Framework.InventoryTest do
  use Exmud.DataCase

  alias Exmud.Framework.Inventory
  alias Exmud.Framework.Player.GameState

  import Exmud.AccountsFixtures

  # Helper to create an item entity (using Entities directly to avoid fixture conflicts)
  defp create_item(attrs \\ %{}) do
    {:ok, entity} =
      Exmud.Engine.Entities.create_entity(%{
        key: attrs[:key] || "item_#{System.unique_integer([:positive])}",
        name: attrs[:name] || "Test Item",
        description: attrs[:description] || "A test item",
        type: "item",
        components: attrs[:components] || %{},
        tags: attrs[:tags] || []
      })

    entity
  end

  # Helper to create a consumable item
  defp consumable_fixture(heal_amount \\ 50) do
    create_item(%{
      name: "Health Potion",
      description: "Restores health",
      components: %{"consumable" => %{"heal" => heal_amount}}
    })
  end

  # Helper to create a game state for testing
  defp game_state_fixture(player_id, attrs \\ %{}) do
    {:ok, state} = GameState.create_state(player_id)

    if map_size(attrs) > 0 do
      {:ok, state} = GameState.update_state(state, attrs)
      state
    else
      state
    end
  end

  describe "add_item/2" do
    test "adds an existing item to inventory" do
      player = player_fixture()
      item = create_item()
      state = game_state_fixture(player.id)

      assert {:ok, updated_state} = Inventory.add_item(state, item.id)
      assert item.id in updated_state.inventory
    end

    test "returns error for non-existent item" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      fake_id = Ecto.UUID.generate()

      assert {:error, :item_not_found} = Inventory.add_item(state, fake_id)
    end

    test "can add multiple items" do
      player = player_fixture()
      item1 = create_item(%{name: "Item 1"})
      item2 = create_item(%{name: "Item 2"})
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, item1.id)
      {:ok, state} = Inventory.add_item(state, item2.id)

      assert item1.id in state.inventory
      assert item2.id in state.inventory
      assert length(state.inventory) == 2
    end

    test "can add same item multiple times (stacking)" do
      player = player_fixture()
      item = create_item()
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, item.id)
      {:ok, state} = Inventory.add_item(state, item.id)

      assert length(state.inventory) == 2
      assert Enum.count(state.inventory, &(&1 == item.id)) == 2
    end
  end

  describe "add_item_unchecked/2" do
    test "adds item without entity lookup" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      fake_id = "fake_item_id"

      assert {:ok, updated_state} = Inventory.add_item_unchecked(state, fake_id)
      assert fake_id in updated_state.inventory
    end

    test "useful for bootstrapping/testing" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item_unchecked(state, "test_1")
      {:ok, state} = Inventory.add_item_unchecked(state, "test_2")

      assert length(state.inventory) == 2
    end
  end

  describe "remove_item/2" do
    test "removes item from inventory" do
      player = player_fixture()
      item = create_item()
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, item.id)
      assert {:ok, updated_state} = Inventory.remove_item(state, item.id)
      refute item.id in updated_state.inventory
    end

    test "returns error for item not in inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      fake_id = Ecto.UUID.generate()

      assert {:error, :not_found} = Inventory.remove_item(state, fake_id)
    end

    test "removes only one instance when duplicates exist" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item_unchecked(state, "potion")
      {:ok, state} = Inventory.add_item_unchecked(state, "potion")

      assert length(state.inventory) == 2

      {:ok, state} = Inventory.remove_item(state, "potion")

      assert length(state.inventory) == 1
      assert "potion" in state.inventory
    end
  end

  describe "has_item?/2" do
    test "returns true when item is in inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item_unchecked(state, "sword")

      assert Inventory.has_item?(state, "sword") == true
    end

    test "returns false when item is not in inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Inventory.has_item?(state, "sword") == false
    end

    test "returns false for empty inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Inventory.has_item?(state, "anything") == false
    end
  end

  describe "list_items/1" do
    test "returns list of item details" do
      player = player_fixture()
      item = create_item(%{name: "Magic Sword", description: "A glowing blade"})
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, item.id)

      items = Inventory.list_items(state)

      assert length(items) == 1
      [item_map] = items
      assert item_map.id == item.id
      assert item_map.name == "Magic Sword"
      assert item_map.description == "A glowing blade"
    end

    test "returns empty list for empty inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Inventory.list_items(state) == []
    end

    test "filters out non-existent items" do
      player = player_fixture()
      item = create_item()
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, item.id)
      {:ok, state} = Inventory.add_item_unchecked(state, "fake_item")

      items = Inventory.list_items(state)

      # Only the real item should be returned
      assert length(items) == 1
      assert hd(items).id == item.id
    end
  end

  describe "use_item/2" do
    test "uses consumable and applies healing" do
      player = player_fixture()
      potion = consumable_fixture(50)
      # Note: health must use atom keys because apply_healing expects them
      state = game_state_fixture(player.id, %{health: %{current: 50, max: 100}})

      {:ok, state} = Inventory.add_item(state, potion.id)

      assert {:ok, updated_state, effect} = Inventory.use_item(state, potion.id)

      assert effect.healed == 50
      assert updated_state.health.current == 100
      refute potion.id in updated_state.inventory
    end

    test "caps healing at max health" do
      player = player_fixture()
      potion = consumable_fixture(100)
      state = game_state_fixture(player.id, %{health: %{current: 90, max: 100}})

      {:ok, state} = Inventory.add_item(state, potion.id)

      assert {:ok, updated_state, effect} = Inventory.use_item(state, potion.id)

      assert effect.healed == 10
      assert updated_state.health.current == 100
    end

    test "heals nothing when at max health" do
      player = player_fixture()
      potion = consumable_fixture(50)
      state = game_state_fixture(player.id, %{health: %{current: 100, max: 100}})

      {:ok, state} = Inventory.add_item(state, potion.id)

      assert {:ok, _updated_state, effect} = Inventory.use_item(state, potion.id)

      assert effect.healed == 0
    end

    test "returns error for item not in inventory" do
      player = player_fixture()
      potion = consumable_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :not_in_inventory} = Inventory.use_item(state, potion.id)
    end

    test "returns error for non-consumable item" do
      player = player_fixture()
      item = create_item(%{name: "Regular Item", components: %{}})
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item(state, item.id)

      assert {:error, :not_consumable} = Inventory.use_item(state, item.id)
    end

    test "returns error for non-existent item in inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      # Add fake item directly without entity lookup
      {:ok, state} = Inventory.add_item_unchecked(state, "fake_item")

      assert {:error, :item_not_found} = Inventory.use_item(state, "fake_item")
    end
  end

  describe "get_item_details/1" do
    test "returns entity for existing item" do
      item = create_item(%{name: "Test Sword"})

      details = Inventory.get_item_details(item.id)

      assert details != nil
      assert details.name == "Test Sword"
    end

    test "returns nil for non-existent item" do
      fake_id = Ecto.UUID.generate()

      assert Inventory.get_item_details(fake_id) == nil
    end

    test "returns nil for nil input" do
      assert Inventory.get_item_details(nil) == nil
    end

    test "returns nil for non-binary input" do
      assert Inventory.get_item_details(123) == nil
    end
  end

  describe "count/1" do
    test "returns 0 for empty inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Inventory.count(state) == 0
    end

    test "returns correct count for non-empty inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item_unchecked(state, "item_1")
      {:ok, state} = Inventory.add_item_unchecked(state, "item_2")
      {:ok, state} = Inventory.add_item_unchecked(state, "item_3")

      assert Inventory.count(state) == 3
    end
  end

  describe "empty?/1" do
    test "returns true for empty inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Inventory.empty?(state) == true
    end

    test "returns false for non-empty inventory" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      {:ok, state} = Inventory.add_item_unchecked(state, "item_1")

      assert Inventory.empty?(state) == false
    end
  end
end
