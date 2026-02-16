defmodule Loka.Framework.InventoryTest do
  use Loka.DataCase

  alias Loka.Framework.Inventory
  alias Loka.Engine.Entity

  import Loka.EngineFixtures

  # Helper to create an item entity (using Entities directly to avoid fixture conflicts)
  defp create_item(attrs \\ %{}) do
    {:ok, entity} =
      Loka.Engine.Entities.create_entity(%{
        key: attrs[:key] || "item_#{System.unique_integer([:positive])}",
        short_desc: attrs[:short_desc] || attrs[:name] || "Test Item",
        extra_desc: attrs[:extra_desc] || attrs[:description] || "A test item",
        type: "item",
        components: attrs[:components] || %{},
        tags: attrs[:tags] || []
      })

    entity
  end

  # Helper to create a consumable item
  defp consumable_fixture(heal_amount \\ 50) do
    create_item(%{
      short_desc: "Health Potion",
      extra_desc: "Restores health",
      components: %{"consumable" => %{"heal" => heal_amount}}
    })
  end

  describe "add_item/2" do
    test "adds an existing item to inventory" do
      item = create_item()
      state = character_fixture()

      assert {:ok, updated_state} = Inventory.add_item(state, item.id)
      assert item.id in (Entity.get_component(updated_state, "inventory") || [])
    end

    test "returns error for non-existent item" do
      state = character_fixture()
      fake_id = Ecto.UUID.generate()

      assert {:error, :item_not_found} = Inventory.add_item(state, fake_id)
    end

    test "can add multiple items" do
      item1 = create_item(%{name: "Item 1"})
      item2 = create_item(%{name: "Item 2"})
      state = character_fixture()

      {:ok, state} = Inventory.add_item(state, item1.id)
      {:ok, state} = Inventory.add_item(state, item2.id)

      inventory = Entity.get_component(state, "inventory") || []
      assert item1.id in inventory
      assert item2.id in inventory
      assert length(inventory) == 2
    end

    test "can add same item multiple times (stacking)" do
      item = create_item()
      state = character_fixture()

      {:ok, state} = Inventory.add_item(state, item.id)
      {:ok, state} = Inventory.add_item(state, item.id)

      inventory = Entity.get_component(state, "inventory") || []
      assert length(inventory) == 2
      assert Enum.count(inventory, &(&1 == item.id)) == 2
    end
  end

  describe "add_item_unchecked/2" do
    test "adds item without entity lookup" do
      state = character_fixture()
      fake_id = "fake_item_id"

      assert {:ok, updated_state} = Inventory.add_item_unchecked(state, fake_id)
      assert fake_id in (Entity.get_component(updated_state, "inventory") || [])
    end

    test "useful for bootstrapping/testing" do
      state = character_fixture()

      {:ok, state} = Inventory.add_item_unchecked(state, "test_1")
      {:ok, state} = Inventory.add_item_unchecked(state, "test_2")

      assert length(Entity.get_component(state, "inventory") || []) == 2
    end
  end

  describe "remove_item/2" do
    test "removes item from inventory" do
      item = create_item()
      state = character_fixture()

      {:ok, state} = Inventory.add_item(state, item.id)
      assert {:ok, updated_state} = Inventory.remove_item(state, item.id)
      refute item.id in (Entity.get_component(updated_state, "inventory") || [])
    end

    test "returns error for item not in inventory" do
      state = character_fixture()
      fake_id = Ecto.UUID.generate()

      assert {:error, :not_found} = Inventory.remove_item(state, fake_id)
    end

    test "removes only one instance when duplicates exist" do
      state = character_fixture()

      {:ok, state} = Inventory.add_item_unchecked(state, "potion")
      {:ok, state} = Inventory.add_item_unchecked(state, "potion")

      inventory = Entity.get_component(state, "inventory") || []
      assert length(inventory) == 2

      {:ok, state} = Inventory.remove_item(state, "potion")

      inventory = Entity.get_component(state, "inventory") || []
      assert length(inventory) == 1
      assert "potion" in inventory
    end
  end

  describe "has_item?/2" do
    test "returns true when item is in inventory" do
      state = character_fixture()

      {:ok, state} = Inventory.add_item_unchecked(state, "sword")

      assert Inventory.has_item?(state, "sword") == true
    end

    test "returns false when item is not in inventory" do
      state = character_fixture()

      assert Inventory.has_item?(state, "sword") == false
    end

    test "returns false for empty inventory" do
      state = character_fixture()

      assert Inventory.has_item?(state, "anything") == false
    end
  end

  describe "list_items/1" do
    test "returns list of item details" do
      item = create_item(%{name: "Magic Sword", description: "A glowing blade"})
      state = character_fixture()

      {:ok, state} = Inventory.add_item(state, item.id)

      items = Inventory.list_items(state)

      assert length(items) == 1
      [item_map] = items
      assert item_map.id == item.id
      assert item_map.name == "Magic Sword"
      assert item_map.description == "A glowing blade"
    end

    test "returns empty list for empty inventory" do
      state = character_fixture()

      assert Inventory.list_items(state) == []
    end

    test "filters out non-existent items" do
      item = create_item()
      state = character_fixture()

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
      potion = consumable_fixture(50)

      state =
        character_fixture(
          resources: %{
            "health" => %{"current" => 50, "max" => 100},
            "mana" => %{"current" => 100, "max" => 100},
            "mv" => %{"current" => 150, "max" => 150}
          }
        )

      {:ok, state} = Inventory.add_item(state, potion.id)

      assert {:ok, updated_state, effect} = Inventory.use_item(state, potion.id)

      assert effect.healed == 50
      resources = Entity.get_component(updated_state, "resources")
      health = resources["health"]
      assert health["current"] == 100
      refute potion.id in (Entity.get_component(updated_state, "inventory") || [])
    end

    test "caps healing at max health" do
      potion = consumable_fixture(100)

      state =
        character_fixture(
          resources: %{
            "health" => %{"current" => 90, "max" => 100},
            "mana" => %{"current" => 100, "max" => 100},
            "mv" => %{"current" => 150, "max" => 150}
          }
        )

      {:ok, state} = Inventory.add_item(state, potion.id)

      assert {:ok, updated_state, effect} = Inventory.use_item(state, potion.id)

      assert effect.healed == 10
      resources = Entity.get_component(updated_state, "resources")
      health = resources["health"]
      assert health["current"] == 100
    end

    test "heals nothing when at max health" do
      potion = consumable_fixture(50)
      state = character_fixture()

      {:ok, state} = Inventory.add_item(state, potion.id)

      assert {:ok, _updated_state, effect} = Inventory.use_item(state, potion.id)

      assert effect.healed == 0
    end

    test "returns error for item not in inventory" do
      potion = consumable_fixture()
      state = character_fixture()

      assert {:error, :not_in_inventory} = Inventory.use_item(state, potion.id)
    end

    test "returns error for non-usable item" do
      item = create_item(%{name: "Regular Item", components: %{}})
      state = character_fixture()

      {:ok, state} = Inventory.add_item(state, item.id)

      assert {:error, :not_usable} = Inventory.use_item(state, item.id)
    end

    test "returns error for non-existent item in inventory" do
      state = character_fixture()

      # Add fake item directly without entity lookup
      {:ok, state} = Inventory.add_item_unchecked(state, "fake_item")

      assert {:error, :item_not_found} = Inventory.use_item(state, "fake_item")
    end
  end

  describe "get_item_details/1" do
    test "returns entity for existing item" do
      item = create_item(%{short_desc: "Test Sword"})

      details = Inventory.get_item_details(item.id)

      assert details != nil
      assert details.short_desc == "Test Sword"
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
      state = character_fixture()

      assert Inventory.count(state) == 0
    end

    test "returns correct count for non-empty inventory" do
      state = character_fixture()

      {:ok, state} = Inventory.add_item_unchecked(state, "item_1")
      {:ok, state} = Inventory.add_item_unchecked(state, "item_2")
      {:ok, state} = Inventory.add_item_unchecked(state, "item_3")

      assert Inventory.count(state) == 3
    end
  end

  describe "empty?/1" do
    test "returns true for empty inventory" do
      state = character_fixture()

      assert Inventory.empty?(state) == true
    end

    test "returns false for non-empty inventory" do
      state = character_fixture()

      {:ok, state} = Inventory.add_item_unchecked(state, "item_1")

      assert Inventory.empty?(state) == false
    end
  end
end
