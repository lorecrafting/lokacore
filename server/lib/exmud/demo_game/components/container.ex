defmodule Exmud.DemoGame.Components.Container do
  @moduledoc """
  Component for entities that can hold items.

  Used for chests, bags, corpses, and any other entity that can contain items.

  ## Fields

  - `items` - List of item entity IDs contained in this container
  - `capacity` - Maximum number of items this container can hold (nil = unlimited)
  - `locked` - Whether the container is currently locked
  - `key_id` - Entity ID of the key that can unlock this container (nil = no key needed)

  ## Example

      %Container{
        items: ["sword_01", "potion_02"],
        capacity: 10,
        locked: true,
        key_id: "brass_key_01"
      }
  """

  @type t :: %__MODULE__{
          items: [String.t()],
          capacity: pos_integer() | nil,
          locked: boolean(),
          key_id: String.t() | nil
        }

  defstruct items: [],
            capacity: nil,
            locked: false,
            key_id: nil

  @doc """
  Creates a new Container with the given attributes.
  """
  def new(attrs \\ %{}) do
    struct(__MODULE__, attrs)
  end

  @doc """
  Returns the number of items in the container.
  """
  def count(%__MODULE__{items: items}), do: length(items)

  @doc """
  Returns true if the container is full.
  """
  def full?(%__MODULE__{capacity: nil}), do: false
  def full?(%__MODULE__{items: items, capacity: capacity}), do: length(items) >= capacity

  @doc """
  Returns true if the container is empty.
  """
  def empty?(%__MODULE__{items: []}), do: true
  def empty?(%__MODULE__{}), do: false

  @doc """
  Adds an item to the container if there's room.
  Returns `{:ok, updated_container}` or `{:error, :full}`.
  """
  def add_item(%__MODULE__{} = container, item_id) do
    if full?(container) do
      {:error, :full}
    else
      {:ok, %{container | items: container.items ++ [item_id]}}
    end
  end

  @doc """
  Removes an item from the container.
  Returns `{:ok, updated_container}` or `{:error, :not_found}`.
  """
  def remove_item(%__MODULE__{items: items} = container, item_id) do
    if item_id in items do
      {:ok, %{container | items: List.delete(items, item_id)}}
    else
      {:error, :not_found}
    end
  end

  @doc """
  Returns true if the container has the specified item.
  """
  def has_item?(%__MODULE__{items: items}, item_id), do: item_id in items
end
