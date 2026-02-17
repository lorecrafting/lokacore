defmodule Loka.Framework.Inventory.StackingPropertyTest do
  use ExUnit.Case, async: true
  use ExUnitProperties

  import Loka.Test.Generators

  alias Loka.Framework.Inventory.Stacking

  describe "group_items properties" do
    property "grouping preserves total count" do
      check all(inventory <- inventory_list()) do
        groups = Stacking.group_items(inventory)
        total = Enum.sum(Enum.map(groups, & &1.quantity))
        assert total == length(inventory)
      end
    end

    property "each item key appears exactly once in groups" do
      check all(inventory <- inventory_list()) do
        groups = Stacking.group_items(inventory)
        keys = Enum.map(groups, & &1.item)
        assert keys == Enum.uniq(keys)
      end
    end

    property "groups are sorted by item key" do
      check all(inventory <- inventory_list()) do
        groups = Stacking.group_items(inventory)
        keys = Enum.map(groups, & &1.item)
        assert keys == Enum.sort(keys)
      end
    end
  end

  describe "add_items/remove_items roundtrip" do
    property "add then remove returns original inventory" do
      check all(
              inventory <- inventory_list(),
              item <- member_of(["health_potion", "mana_potion", "sword"]),
              qty <- integer(1..5)
            ) do
        {:ok, after_add} = Stacking.add_items(inventory, item, qty)
        assert length(after_add) == length(inventory) + qty

        {:ok, after_remove} = Stacking.remove_items(after_add, item, qty)
        # After removing the same qty we added, we should be back to original length
        assert length(after_remove) == length(inventory)
      end
    end

    property "remove more than available returns error" do
      check all(
              item <- member_of(["health_potion", "mana_potion"]),
              qty <- integer(1..5)
            ) do
        # Empty inventory
        assert {:error, {:insufficient_items, ^item, 0, ^qty}} =
                 Stacking.remove_items([], item, qty)
      end
    end
  end

  describe "count_item properties" do
    property "count matches Enum.count" do
      check all(inventory <- inventory_list()) do
        for item <- Enum.uniq(inventory) do
          expected = Enum.count(inventory, &(&1 == item))
          assert Stacking.count_item(inventory, item) == expected
        end
      end
    end

    property "count of absent item is 0" do
      check all(inventory <- inventory_list()) do
        assert Stacking.count_item(inventory, "nonexistent_item_xyz") == 0
      end
    end
  end

  describe "has_items? properties" do
    property "has_items? is true when count >= quantity" do
      check all(
              inventory <- inventory_list(),
              item <- member_of(["health_potion", "mana_potion", "sword"]),
              qty <- integer(1..3)
            ) do
        count = Stacking.count_item(inventory, item)
        assert Stacking.has_items?(inventory, item, qty) == count >= qty
      end
    end
  end

  describe "validate_stack properties" do
    property "validate_stack passes when total <= max" do
      check all(
              max_stack <- integer(1..20),
              current_qty <- integer(0..max_stack),
              add_qty <- integer(1..5)
            ) do
        inventory = List.duplicate("item", current_qty)
        total = current_qty + add_qty

        result = Stacking.validate_stack(inventory, "item", add_qty, max_stack)

        if total <= max_stack do
          assert result == :ok
        else
          assert {:error, {:exceeds_max_stack, "item", ^total, ^max_stack}} = result
        end
      end
    end
  end
end
