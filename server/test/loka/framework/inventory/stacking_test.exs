defmodule Loka.Framework.Inventory.StackingTest do
  use Loka.DataCase

  alias Loka.Framework.Inventory.Stacking
  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

  setup do
    # Ensure production prototypes are loaded (other tests may reload during parallel execution)
    TypedObjectLoader.reload()
    :ok
  end

  # =============================================================================
  # group_items/1 Tests
  # =============================================================================

  describe "group_items/1" do
    test "groups identical items together" do
      inventory = ["health_potion", "health_potion", "health_potion"]

      result = Stacking.group_items(inventory)

      assert result == [%{item: "health_potion", quantity: 3}]
    end

    test "handles mixed items" do
      inventory = ["sword", "health_potion", "health_potion", "shield"]

      result = Stacking.group_items(inventory)

      assert result == [
               %{item: "health_potion", quantity: 2},
               %{item: "shield", quantity: 1},
               %{item: "sword", quantity: 1}
             ]
    end

    test "handles empty inventory" do
      assert Stacking.group_items([]) == []
    end

    test "handles single item" do
      assert Stacking.group_items(["sword"]) == [%{item: "sword", quantity: 1}]
    end

    test "maintains stable sort order by item key" do
      inventory = ["z_item", "a_item", "m_item", "a_item"]

      result = Stacking.group_items(inventory)

      items = Enum.map(result, & &1.item)
      assert items == ["a_item", "m_item", "z_item"]
    end
  end

  # =============================================================================
  # add_items/3 Tests
  # =============================================================================

  describe "add_items/3" do
    test "adds items to empty inventory" do
      assert {:ok, result} = Stacking.add_items([], "health_potion", 3)
      assert result == ["health_potion", "health_potion", "health_potion"]
    end

    test "adds items to existing inventory" do
      assert {:ok, result} = Stacking.add_items(["sword"], "health_potion", 2)
      assert result == ["sword", "health_potion", "health_potion"]
    end

    test "adds single item with default quantity" do
      assert {:ok, result} = Stacking.add_items(["sword"], "health_potion")
      assert result == ["sword", "health_potion"]
    end

    test "preserves existing items" do
      assert {:ok, result} = Stacking.add_items(["a", "b", "c"], "d", 1)
      assert result == ["a", "b", "c", "d"]
    end
  end

  # =============================================================================
  # remove_items/3 Tests
  # =============================================================================

  describe "remove_items/3" do
    test "removes items from inventory" do
      assert {:ok, result} = Stacking.remove_items(["potion", "potion", "sword"], "potion", 1)
      assert "sword" in result
      assert Stacking.count_item(result, "potion") == 1
    end

    test "removes all matching items" do
      assert {:ok, result} = Stacking.remove_items(["potion", "potion"], "potion", 2)
      assert result == []
    end

    test "removes single item with default quantity" do
      assert {:ok, result} = Stacking.remove_items(["potion", "sword"], "potion")
      assert result == ["sword"]
    end

    test "returns error when not enough items" do
      assert {:error, {:insufficient_items, "potion", 1, 3}} =
               Stacking.remove_items(["potion"], "potion", 3)
    end

    test "returns error when item not in inventory" do
      assert {:error, {:insufficient_items, "potion", 0, 1}} =
               Stacking.remove_items(["sword"], "potion", 1)
    end

    test "handles prefix matching for instanced items" do
      inventory = ["potion_01", "potion_02", "sword"]
      assert {:ok, result} = Stacking.remove_items(inventory, "potion", 1)
      assert length(result) == 2
      assert "sword" in result
    end
  end

  # =============================================================================
  # count_item/2 Tests
  # =============================================================================

  describe "count_item/2" do
    test "counts matching items" do
      assert Stacking.count_item(["a", "a", "a", "b"], "a") == 3
    end

    test "returns 0 for non-existent item" do
      assert Stacking.count_item(["a", "b"], "c") == 0
    end

    test "handles empty inventory" do
      assert Stacking.count_item([], "a") == 0
    end

    test "handles prefix matching" do
      inventory = ["item_01", "item_02", "other"]
      assert Stacking.count_item(inventory, "item") == 2
    end
  end

  # =============================================================================
  # has_items?/3 Tests
  # =============================================================================

  describe "has_items?/3" do
    test "returns true when enough items" do
      assert Stacking.has_items?(["a", "a", "a"], "a", 2) == true
    end

    test "returns true when exact count" do
      assert Stacking.has_items?(["a", "a"], "a", 2) == true
    end

    test "returns false when not enough items" do
      assert Stacking.has_items?(["a"], "a", 2) == false
    end

    test "returns false when item not present" do
      assert Stacking.has_items?(["b"], "a", 1) == false
    end

    test "defaults to quantity 1" do
      assert Stacking.has_items?(["a"], "a") == true
      assert Stacking.has_items?([], "a") == false
    end
  end

  # =============================================================================
  # get_stack_info/1 Tests
  # =============================================================================

  describe "get_stack_info/1" do
    test "returns stack info for existing prototype" do
      # offering_incense has stackable: true, max_stack: 5
      info = Stacking.get_stack_info("offering_incense")

      assert info.stackable == true
      assert info.max_stack == 5
    end

    test "returns default info for non-stackable items" do
      # travelers_staff has stackable: false (inherited from base_weapon)
      info = Stacking.get_stack_info("travelers_staff")

      assert info.stackable == false
      assert info.max_stack == 1
    end

    test "returns default info for non-existent prototype" do
      info = Stacking.get_stack_info("nonexistent_item")

      assert info.stackable == false
      assert info.max_stack == 1
    end
  end

  # =============================================================================
  # validate_stack/4 Tests
  # =============================================================================

  describe "validate_stack/4" do
    test "returns :ok when within stack limit" do
      assert :ok = Stacking.validate_stack(["a", "a"], "a", 2, 5)
    end

    test "returns :ok when at exact limit" do
      assert :ok = Stacking.validate_stack(["a", "a"], "a", 3, 5)
    end

    test "returns error when exceeds limit" do
      assert {:error, {:exceeds_max_stack, "a", 6, 5}} =
               Stacking.validate_stack(["a", "a", "a"], "a", 3, 5)
    end

    test "handles empty inventory" do
      assert :ok = Stacking.validate_stack([], "a", 5, 10)
    end
  end

  # =============================================================================
  # group_items_with_details/1 Tests
  # =============================================================================

  describe "group_items_with_details/1" do
    test "returns detailed stack info for known items" do
      inventory = ["travelers_staff", "travelers_staff", "offering_incense"]

      result = Stacking.group_items_with_details(inventory)

      # Find the staff entry
      staff = Enum.find(result, &(&1.item == "travelers_staff"))
      assert staff != nil
      assert staff.quantity == 2
      assert staff.name == "Traveler's Staff"
      assert staff.stackable == false
      assert staff.max_stack == 1

      # Find the incense entry
      incense = Enum.find(result, &(&1.item == "offering_incense"))
      assert incense != nil
      assert incense.quantity == 1
      assert incense.name == "Offering Incense"
      assert incense.stackable == true
      assert incense.max_stack == 5
    end

    test "handles unknown items with defaults" do
      result = Stacking.group_items_with_details(["unknown_item"])

      assert length(result) == 1
      item = hd(result)
      assert item.item == "unknown_item"
      assert item.name == "unknown_item"
      assert item.stackable == false
      assert item.max_stack == 1
    end

    test "handles empty inventory" do
      assert Stacking.group_items_with_details([]) == []
    end
  end

  # =============================================================================
  # Integration Tests
  # =============================================================================

  describe "integration" do
    test "add and remove workflow" do
      inventory = []

      # Add items
      {:ok, inventory} = Stacking.add_items(inventory, "health_potion", 5)
      {:ok, inventory} = Stacking.add_items(inventory, "sword", 1)

      assert Stacking.count_item(inventory, "health_potion") == 5
      assert Stacking.count_item(inventory, "sword") == 1

      # Group for display
      stacks = Stacking.group_items(inventory)
      assert length(stacks) == 2

      # Remove some items
      {:ok, inventory} = Stacking.remove_items(inventory, "health_potion", 3)
      assert Stacking.count_item(inventory, "health_potion") == 2

      # Try to remove too many
      assert {:error, _} = Stacking.remove_items(inventory, "health_potion", 10)
    end
  end
end
