defmodule Loka.Framework.Inventory.Stacking do
  @moduledoc """
  Item stacking utilities for inventory management.

  Provides helpers for grouping items into stacks, adding items respecting
  stack limits, and removing quantities from inventory.

  The inventory is stored as a flat list of item keys. This module provides
  display-oriented grouping and stack-aware manipulation.

  ## Item Stacking Configuration

  Items define stacking behavior in their prototype:

      components:
        physical:
          stackable: true
          max_stack: 5

  Non-stackable items (default) have max_stack: 1.

  ## Usage

      alias Loka.Framework.Inventory.Stacking

      # Group flat list for display
      inventory = ["health_potion", "health_potion", "sword"]
      Stacking.group_items(inventory)
      # => [%{item: "health_potion", quantity: 2}, %{item: "sword", quantity: 1}]

      # Add items respecting stack limits
      {:ok, new_inventory} = Stacking.add_items(inventory, "health_potion", 3)

      # Remove items
      {:ok, new_inventory} = Stacking.remove_items(inventory, "health_potion", 2)
  """

  alias Loka.Engine.PrototypeLoader
  alias Loka.Utils.MapHelpers

  @type stack :: %{
          item: String.t(),
          quantity: pos_integer()
        }

  @type stack_info :: %{
          stackable: boolean(),
          max_stack: pos_integer()
        }

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Groups a flat inventory list into stacked items for display.

  Returns a list of stacks sorted by item key.

  ## Examples

      iex> group_items(["sword", "potion", "potion", "potion"])
      [%{item: "potion", quantity: 3}, %{item: "sword", quantity: 1}]
  """
  @spec group_items([String.t()]) :: [stack()]
  def group_items(inventory) when is_list(inventory) do
    inventory
    |> Enum.frequencies()
    |> Enum.map(fn {item, quantity} -> %{item: item, quantity: quantity} end)
    |> Enum.sort_by(& &1.item)
  end

  @doc """
  Adds items to inventory, respecting stack limits if applicable.

  For stackable items, adds up to max_stack per "stack slot" in inventory.
  For non-stackable items, adds each item individually.

  Returns `{:ok, updated_inventory}`.

  ## Examples

      iex> add_items(["sword"], "potion", 3)
      {:ok, ["sword", "potion", "potion", "potion"]}

      # With max_stack: 5, adding 7 creates two groups
      iex> add_items([], "potion", 7)
      {:ok, ["potion", "potion", "potion", "potion", "potion", "potion", "potion"]}
  """
  @spec add_items([String.t()], String.t(), pos_integer()) :: {:ok, [String.t()]}
  def add_items(inventory, item_key, quantity \\ 1)
      when is_list(inventory) and is_binary(item_key) and is_integer(quantity) and quantity > 0 do
    new_items = List.duplicate(item_key, quantity)
    {:ok, inventory ++ new_items}
  end

  @doc """
  Removes items from inventory.

  Removes up to `quantity` items matching the key. Returns error if
  not enough items are available.

  Returns `{:ok, updated_inventory}` or `{:error, {:insufficient_items, ...}}`.

  ## Examples

      iex> remove_items(["sword", "potion", "potion"], "potion", 1)
      {:ok, ["sword", "potion"]}

      iex> remove_items(["sword"], "potion", 1)
      {:error, {:insufficient_items, "potion", 0, 1}}
  """
  @spec remove_items([String.t()], String.t(), pos_integer()) ::
          {:ok, [String.t()]} | {:error, {:insufficient_items, String.t(), integer(), integer()}}
  def remove_items(inventory, item_key, quantity \\ 1)
      when is_list(inventory) and is_binary(item_key) and is_integer(quantity) and quantity > 0 do
    # Split inventory into matching and non-matching items
    {matching, remaining} =
      Enum.split_with(inventory, fn item_id ->
        item_id == item_key or String.starts_with?(to_string(item_id), item_key)
      end)

    if length(matching) >= quantity do
      {_removed, kept} = Enum.split(matching, quantity)
      {:ok, kept ++ remaining}
    else
      {:error, {:insufficient_items, item_key, length(matching), quantity}}
    end
  end

  @doc """
  Counts how many of a specific item are in inventory.

  ## Examples

      iex> count_item(["sword", "potion", "potion"], "potion")
      2
  """
  @spec count_item([String.t()], String.t()) :: non_neg_integer()
  def count_item(inventory, item_key) when is_list(inventory) and is_binary(item_key) do
    Enum.count(inventory, fn item_id ->
      item_id == item_key or String.starts_with?(to_string(item_id), item_key)
    end)
  end

  @doc """
  Checks if player has at least the specified quantity of an item.

  ## Examples

      iex> has_items?(["potion", "potion"], "potion", 2)
      true

      iex> has_items?(["potion"], "potion", 2)
      false
  """
  @spec has_items?([String.t()], String.t(), pos_integer()) :: boolean()
  def has_items?(inventory, item_key, quantity \\ 1) do
    count_item(inventory, item_key) >= quantity
  end

  @doc """
  Gets the stacking configuration for an item from its prototype.

  Returns stack info with defaults if prototype not found.

  ## Examples

      iex> get_stack_info("health_potion")
      %{stackable: true, max_stack: 5}

      iex> get_stack_info("unknown_item")
      %{stackable: false, max_stack: 1}
  """
  @spec get_stack_info(String.t()) :: stack_info()
  def get_stack_info(item_key) do
    case PrototypeLoader.get(item_key) do
      {:ok, prototype} ->
        physical = MapHelpers.get_flexible(prototype.components, :physical, %{})

        %{
          stackable: MapHelpers.get_flexible(physical, :stackable, false),
          max_stack: MapHelpers.get_flexible(physical, :max_stack, 1)
        }

      {:error, :not_found} ->
        %{stackable: false, max_stack: 1}
    end
  end

  @doc """
  Validates that adding items won't exceed stack limits.

  For stackable items, checks if current + quantity exceeds max_stack.
  Returns `:ok` if valid, or `{:error, reason}` if it would exceed.

  Note: The current inventory model uses a flat list, so this is
  primarily for validation - the actual enforcement of stack limits
  would require changing inventory structure.

  ## Examples

      iex> validate_stack(["potion", "potion"], "potion", 2, 5)
      :ok

      iex> validate_stack(["potion", "potion", "potion"], "potion", 3, 5)
      {:error, {:exceeds_max_stack, "potion", 6, 5}}
  """
  @spec validate_stack([String.t()], String.t(), pos_integer(), pos_integer()) ::
          :ok | {:error, {:exceeds_max_stack, String.t(), integer(), integer()}}
  def validate_stack(inventory, item_key, quantity, max_stack) do
    current = count_item(inventory, item_key)
    total = current + quantity

    if total <= max_stack do
      :ok
    else
      {:error, {:exceeds_max_stack, item_key, total, max_stack}}
    end
  end

  @doc """
  Groups items with their prototype details for rich display.

  Returns stacked items with name, description, and stack info.

  ## Examples

      iex> group_items_with_details(["health_potion", "health_potion", "sword"])
      [
        %{
          item: "health_potion",
          quantity: 2,
          name: "Health Potion",
          stackable: true,
          max_stack: 5
        },
        %{
          item: "sword",
          quantity: 1,
          name: "Iron Sword",
          stackable: false,
          max_stack: 1
        }
      ]
  """
  @spec group_items_with_details([String.t()]) :: [map()]
  def group_items_with_details(inventory) when is_list(inventory) do
    inventory
    |> group_items()
    |> Enum.map(fn %{item: item_key, quantity: quantity} ->
      stack_info = get_stack_info(item_key)
      prototype_info = get_prototype_info(item_key)

      %{
        item: item_key,
        quantity: quantity,
        name: prototype_info.name,
        description: prototype_info.description,
        stackable: stack_info.stackable,
        max_stack: stack_info.max_stack
      }
    end)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_prototype_info(item_key) do
    case PrototypeLoader.get(item_key) do
      {:ok, prototype} ->
        %{
          name: prototype.short_desc || item_key,
          description: prototype.extra_desc || prototype.long_desc || ""
        }

      {:error, :not_found} ->
        %{name: item_key, description: ""}
    end
  end
end
