defmodule Loka.Framework.Inventory.LootTableTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Inventory.LootTable

  describe "roll/1" do
    test "returns nil for empty table" do
      assert LootTable.roll([]) == nil
    end

    test "returns item from single-entry table" do
      table = [%{item: "gold", weight: 100, quantity: 1}]
      result = LootTable.roll(table)

      assert result == %{item: "gold", quantity: 1}
    end

    test "returns nil when entry has no item key" do
      table = [%{weight: 100}]
      result = LootTable.roll(table)

      assert result == nil
    end

    test "handles quantity range" do
      table = [%{item: "coin", weight: 100, quantity: [5, 10]}]
      result = LootTable.roll(table)

      assert result.item == "coin"
      assert result.quantity >= 5
      assert result.quantity <= 10
    end

    test "defaults quantity to 1 when not specified" do
      table = [%{item: "sword", weight: 100}]
      result = LootTable.roll(table)

      assert result == %{item: "sword", quantity: 1}
    end

    test "handles string keys from YAML" do
      table = [%{"item" => "gem", "weight" => 100, "quantity" => 3}]
      result = LootTable.roll(table)

      assert result == %{item: "gem", quantity: 3}
    end

    test "weighted selection respects weights" do
      # Run 100 rolls - with 99% weight on gold, should get mostly gold
      table = [
        %{item: "gold", weight: 99},
        %{item: "diamond", weight: 1}
      ]

      results =
        1..100
        |> Enum.map(fn _ -> LootTable.roll(table) end)
        |> Enum.group_by(& &1.item)

      gold_count = length(Map.get(results, "gold", []))
      # Expect at least 80 gold out of 100 (statistically very likely)
      assert gold_count >= 80
    end
  end

  describe "roll/2 with count option" do
    test "returns empty list for 0 rolls" do
      table = [%{item: "gold", weight: 100, quantity: 1}]
      result = LootTable.roll(table, count: 0)

      assert result == []
    end

    test "returns consolidated results" do
      # With 100% chance of gold, 5 rolls should give one consolidated entry
      table = [%{item: "gold", weight: 100, quantity: 1}]
      result = LootTable.roll(table, count: 5)

      assert length(result) == 1
      assert hd(result) == %{item: "gold", quantity: 5}
    end

    test "consolidates same items from different rolls" do
      table = [%{item: "coin", weight: 100, quantity: [1, 3]}]
      result = LootTable.roll(table, count: 10)

      # Should be a single consolidated coin entry
      assert length(result) == 1
      assert hd(result).item == "coin"
      # Quantity should be sum of 10 rolls, each 1-3, so 10-30
      assert hd(result).quantity >= 10
      assert hd(result).quantity <= 30
    end

    test "excludes nil results (nothing entries)" do
      # 50% nothing, 50% gold
      table = [
        %{weight: 50},
        %{item: "gold", weight: 50, quantity: 1}
      ]

      # Run many times, should only get gold entries (no nils)
      result = LootTable.roll(table, count: 100)

      assert Enum.all?(result, fn entry -> Map.has_key?(entry, :item) end)
    end
  end

  describe "generate_contents/2" do
    test "generates items based on capacity" do
      table = [%{item: "herb", weight: 100, quantity: 1}]
      result = LootTable.generate_contents(table, capacity: 5)

      assert length(result) == 1
      assert hd(result) == %{item: "herb", quantity: 5}
    end

    test "defaults capacity to 5" do
      table = [%{item: "item", weight: 100, quantity: 1}]
      result = LootTable.generate_contents(table, [])

      assert hd(result).quantity == 5
    end
  end

  describe "total_weight/1" do
    test "calculates sum of weights" do
      table = [
        %{item: "a", weight: 10},
        %{item: "b", weight: 20},
        %{item: "c", weight: 30}
      ]

      assert LootTable.total_weight(table) == 60
    end

    test "returns 0 for empty table" do
      assert LootTable.total_weight([]) == 0
    end

    test "handles entries without weight" do
      table = [
        %{item: "a", weight: 10},
        %{item: "b"}
      ]

      assert LootTable.total_weight(table) == 10
    end
  end
end
