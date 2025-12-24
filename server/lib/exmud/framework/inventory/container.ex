defmodule Exmud.Framework.Inventory.Container do
  @moduledoc """
  Container system for items that can hold other items.

  Containers can be:
  - Bags/backpacks (carried)
  - Chests/boxes (in rooms)
  - Locked containers (require keys)
  - Special containers (limit what can be stored)

  ## Container Configuration (YAML - Item Prototype)

      key: leather_backpack
      name: "Leather Backpack"
      type: item
      components:
        container:
          capacity: 20           # Max items
          weight_capacity: 50    # Max weight
          accepts:               # Item types allowed (empty = all)
            - item
            - material
          rejects:               # Item types rejected
            - weapon
            - armor
          locked: false
          lock_key: null
          description_open: "The backpack lies open, revealing its contents."
          description_closed: "A sturdy leather backpack."

  ## Usage

      alias Exmud.Framework.Inventory.Container

      # Check if item is a container
      Container.container?(item_entity)

      # Get container component
      container = Container.get_container(item_entity)

      # Put item in container
      {:ok, container} = Container.put_item(container, item_id)

      # Take item from container
      {:ok, container, item} = Container.take_item(container, item_id)

      # Lock/unlock
      {:ok, container} = Container.unlock(container, "gold_key")
  """

  alias Exmud.Utils.MapHelpers

  @type t :: %__MODULE__{
          capacity: pos_integer(),
          weight_capacity: non_neg_integer() | nil,
          accepts: [String.t()],
          rejects: [String.t()],
          locked: boolean(),
          lock_key: String.t() | nil,
          contents: [String.t()],
          description_open: String.t(),
          description_closed: String.t()
        }

  defstruct capacity: 10,
            weight_capacity: nil,
            accepts: [],
            rejects: [],
            locked: false,
            lock_key: nil,
            contents: [],
            description_open: "The container is open.",
            description_closed: "A closed container."

  @doc """
  Checks if an entity is a container.
  """
  def container?(nil), do: false

  def container?(entity) do
    components = Map.get(entity, :components, %{})
    MapHelpers.get_flexible(components, :container, nil) != nil
  end

  @doc """
  Gets the container component from an entity.
  """
  def get_container(nil), do: nil

  def get_container(entity) do
    components = Map.get(entity, :components, %{})

    case MapHelpers.get_flexible(components, :container, nil) do
      nil -> nil
      data -> from_component(data)
    end
  end

  @doc """
  Parses container from component data.
  """
  def from_component(data) when is_map(data) do
    %__MODULE__{
      capacity: MapHelpers.get_flexible(data, :capacity, 10),
      weight_capacity: MapHelpers.get_flexible(data, :weight_capacity, nil),
      accepts: MapHelpers.get_flexible(data, :accepts, []),
      rejects: MapHelpers.get_flexible(data, :rejects, []),
      locked: MapHelpers.get_flexible(data, :locked, false),
      lock_key: MapHelpers.get_flexible(data, :lock_key, nil),
      contents: MapHelpers.get_flexible(data, :contents, []),
      description_open:
        MapHelpers.get_flexible(data, :description_open, "The container is open."),
      description_closed:
        MapHelpers.get_flexible(data, :description_closed, "A closed container.")
    }
  end

  def from_component(_), do: nil

  @doc """
  Puts an item into the container.
  """
  def put_item(%__MODULE__{} = container, item_id, item_type \\ nil) do
    cond do
      container.locked ->
        {:error, :container_locked}

      length(container.contents) >= container.capacity ->
        {:error, :container_full}

      not accepts_item?(container, item_type) ->
        {:error, :item_type_not_accepted}

      true ->
        {:ok, %{container | contents: [item_id | container.contents]}}
    end
  end

  @doc """
  Takes an item from the container.
  """
  def take_item(%__MODULE__{} = container, item_id) do
    cond do
      container.locked ->
        {:error, :container_locked}

      item_id not in container.contents ->
        {:error, :item_not_found}

      true ->
        new_contents = List.delete(container.contents, item_id)
        {:ok, %{container | contents: new_contents}, item_id}
    end
  end

  @doc """
  Lists contents of the container.
  """
  def list_contents(%__MODULE__{locked: true}), do: {:error, :container_locked}
  def list_contents(%__MODULE__{contents: contents}), do: {:ok, contents}

  @doc """
  Checks if container is empty.
  """
  def empty?(%__MODULE__{contents: []}), do: true
  def empty?(%__MODULE__{}), do: false

  @doc """
  Gets remaining capacity.
  """
  def remaining_capacity(%__MODULE__{capacity: cap, contents: contents}) do
    cap - length(contents)
  end

  @doc """
  Attempts to unlock the container with a key.
  """
  def unlock(%__MODULE__{locked: false} = container, _key_id) do
    {:ok, container}
  end

  def unlock(%__MODULE__{lock_key: nil} = container, _key_id) do
    {:ok, %{container | locked: false}}
  end

  def unlock(%__MODULE__{lock_key: key} = container, key_id) do
    if key_id == key do
      {:ok, %{container | locked: false}}
    else
      {:error, :wrong_key}
    end
  end

  @doc """
  Locks the container.
  """
  def lock(%__MODULE__{} = container) do
    {:ok, %{container | locked: true}}
  end

  @doc """
  Gets appropriate description based on lock state.
  """
  def get_description(%__MODULE__{locked: true} = container) do
    container.description_closed
  end

  def get_description(%__MODULE__{} = container) do
    container.description_open
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp accepts_item?(%__MODULE__{accepts: [], rejects: []}, _type), do: true

  defp accepts_item?(%__MODULE__{accepts: accepts, rejects: rejects}, type) do
    cond do
      type in rejects -> false
      accepts == [] -> true
      true -> type in accepts
    end
  end

  defp accepts_item?(_, nil), do: true
end
