defmodule Loka.Framework.Inventory.LootTable do
  @moduledoc """
  Handles weighted random item selection from loot tables.

  Loot tables are used to:
  - Generate initial container contents when spawning
  - Regenerate container contents on respawn
  - NPC drop tables (future)
  - Treasure generation (future)

  ## Loot Table Format (YAML)

      loot_table:
        - item: gold_coin
          weight: 50
          quantity: [1, 5]  # Random 1-5 coins
        - item: health_potion
          weight: 30
          quantity: 1       # Always 1
        - item: rare_gem
          weight: 5
          quantity: 1
        - weight: 15        # 15% chance of nothing (no item key)

  ## Usage

      alias Loka.Framework.Inventory.LootTable

      # Roll once on the table
      LootTable.roll(loot_table)
      # => %{item: "gold_coin", quantity: 3} | nil

      # Roll multiple times
      LootTable.roll(loot_table, count: 5)
      # => [%{item: "gold_coin", quantity: 7}, %{item: "health_potion", quantity: 1}]

      # Generate initial contents for a container
      LootTable.generate_contents(loot_table, capacity: 5)
      # => [%{item: "gold_coin", quantity: 2}, ...]
  """

  alias Loka.Utils.MapHelpers

  @type loot_entry :: %{
          optional(:item) => String.t(),
          :weight => pos_integer(),
          optional(:quantity) => pos_integer() | list(pos_integer())
        }

  @type loot_table :: [loot_entry()]

  @type item_result :: %{item: String.t(), quantity: pos_integer()}

  @doc """
  Roll once on the loot table, returning selected item or nil.

  ## Examples

      iex> LootTable.roll([%{item: "gold", weight: 100, quantity: 1}])
      %{item: "gold", quantity: 1}

      iex> LootTable.roll([%{weight: 100}])  # 100% nothing
      nil
  """
  @spec roll(loot_table()) :: item_result() | nil
  def roll([]), do: nil

  def roll(table) when is_list(table) do
    total_weight = calculate_total_weight(table)

    if total_weight <= 0 do
      nil
    else
      roll_value = :rand.uniform(total_weight)
      entry = select_entry(table, roll_value, 0)
      resolve_entry(entry)
    end
  end

  @doc """
  Roll multiple times on the loot table.

  Results are consolidated - same items have their quantities summed.

  ## Options

    - `:count` - Number of rolls (default: 1)

  ## Examples

      iex> LootTable.roll(table, count: 5)
      [%{item: "gold", quantity: 12}, %{item: "potion", quantity: 2}]
  """
  @spec roll(loot_table(), keyword()) :: [item_result()]
  def roll(table, opts) when is_list(table) do
    count = Keyword.get(opts, :count, 1)

    if count <= 0 do
      []
    else
      1..count
      |> Enum.map(fn _ -> roll(table) end)
      |> Enum.reject(&is_nil/1)
      |> consolidate_items()
    end
  end

  @doc """
  Generate initial contents for a container based on its loot table.

  Rolls `capacity` times and returns consolidated results.

  ## Options

    - `:capacity` - Number of rolls (required)

  ## Examples

      iex> LootTable.generate_contents(table, capacity: 5)
      [%{item: "gold_coin", quantity: 8}, %{item: "herb", quantity: 2}]
  """
  @spec generate_contents(loot_table(), keyword()) :: [item_result()]
  def generate_contents(table, opts) do
    capacity = Keyword.get(opts, :capacity, 5)
    roll(table, count: capacity)
  end

  @doc """
  Calculate the total weight of a loot table.
  """
  @spec total_weight(loot_table()) :: non_neg_integer()
  def total_weight(table) do
    calculate_total_weight(table)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp calculate_total_weight(table) do
    Enum.reduce(table, 0, fn entry, acc ->
      weight = get_weight(entry)
      acc + weight
    end)
  end

  defp get_weight(entry) when is_map(entry) do
    MapHelpers.get_flexible(entry, :weight, 0)
  end

  defp get_weight(_), do: 0

  defp select_entry([], _roll_value, _accumulated), do: nil

  defp select_entry([entry | rest], roll_value, accumulated) do
    weight = get_weight(entry)
    new_acc = accumulated + weight

    if roll_value <= new_acc do
      entry
    else
      select_entry(rest, roll_value, new_acc)
    end
  end

  defp resolve_entry(nil), do: nil

  defp resolve_entry(entry) when is_map(entry) do
    item = MapHelpers.get_flexible(entry, :item, nil)

    if item do
      quantity = resolve_quantity(entry)
      %{item: item, quantity: quantity}
    else
      # Entry without item key means "nothing"
      nil
    end
  end

  defp resolve_quantity(entry) do
    case MapHelpers.get_flexible(entry, :quantity, 1) do
      [min, max] when is_integer(min) and is_integer(max) ->
        Enum.random(min..max)

      qty when is_integer(qty) ->
        qty

      _ ->
        1
    end
  end

  defp consolidate_items(items) do
    items
    |> Enum.group_by(& &1.item)
    |> Enum.map(fn {item, entries} ->
      total_qty = Enum.sum(Enum.map(entries, & &1.quantity))
      %{item: item, quantity: total_qty}
    end)
  end
end
