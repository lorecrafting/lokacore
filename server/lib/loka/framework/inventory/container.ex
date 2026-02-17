defmodule Loka.Framework.Inventory.Container do
  @moduledoc """
  Container system for items that can hold other items.

  Containers can be:
  - Bags/backpacks (carried)
  - Chests/boxes (in rooms)
  - Locked containers (require keys)
  - Special containers (limit what can be stored)
  - Harvestable nodes (herb patches, ore veins) with respawn

  ## Container States

  Containers have three states based on contents:
  - `:full` - At or near capacity
  - `:partial` - Has some items but not full
  - `:empty` - No items

  State-based descriptions allow containers to visually change:

      state_descriptions:
        full: "A lush patch of medicinal herbs grows here."
        partial: "Some herbs remain in this patch."
        empty: "This herb patch has been picked clean."

  ## Container Configuration (YAML - Item Prototype)

      key: leather_backpack
      name: "Leather Backpack"
      type: item
      components:
        container:
          capacity: 20           # Max items
          weight_capacity: 50    # Max weight
          can_put: true          # Players can add items (default: true)
          can_take: true         # Players can take items (default: true)
          accepts:               # Item types allowed (empty = all)
            - item
            - material
          rejects:               # Item types rejected
            - weapon
            - armor
          locked: false
          lock_key: null
          state_descriptions:    # Optional state-based descriptions
            full: "The backpack is stuffed full."
            partial: "The backpack has some room."
            empty: "The backpack is empty."
          respawn:               # Optional respawn configuration
            enabled: true
            delay_seconds: 1800  # 30 minutes
            loot_table:
              - item: gold_coin
                weight: 50
                quantity: [1, 5]
              - item: health_potion
                weight: 30
                quantity: 1

  ## Usage

      alias Loka.Framework.Inventory.Container

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

      # Get current state
      Container.state(container)  # => :full | :partial | :empty

      # Get state-aware description
      Container.get_state_description(container)
  """

  alias Loka.Engine.{Entities, Hooks}
  alias Loka.Utils.MapHelpers

  require Logger

  # =============================================================================
  # Hook Registration
  # =============================================================================

  @doc """
  Registers hooks for container initialization.
  Called from application startup after the Hooks GenServer is started.
  """
  @spec register_hooks() :: :ok
  def register_hooks do
    Hooks.register(:at_entity_creation, __MODULE__, :on_entity_created, priority: 60)
    Logger.debug("[Container] Registered :at_entity_creation hook")
    :ok
  end

  @doc """
  Hook callback for entity creation.
  Initializes container contents from loot table if respawn is enabled.
  """
  def on_entity_created(entity, _context) do
    case get_container(entity) do
      nil ->
        :ok

      container ->
        if respawn_enabled?(container) do
          initialize_container_contents(entity, container)
        else
          :ok
        end
    end
  end

  defp initialize_container_contents(entity, container) do
    initial_contents = generate_initial_contents(container)

    if initial_contents != [] do
      updated_container = %{container | contents: initial_contents}
      components = entity.components || %{}
      updated_components = Map.put(components, "container", to_map(updated_container))

      case Entities.update_entity(entity.id, %{components: updated_components}) do
        {:ok, _schema} ->
          Logger.debug("[Container] Initialized contents for #{entity.id}")
          :ok

        {:error, reason} ->
          Logger.warning("[Container] Failed to initialize contents: #{inspect(reason)}")
          :ok
      end
    else
      :ok
    end
  end

  @type state :: :full | :partial | :empty

  @type respawn_config :: %{
          enabled: boolean(),
          delay_seconds: pos_integer(),
          loot_table: list(map())
        }

  @type t :: %__MODULE__{
          capacity: pos_integer(),
          weight_capacity: non_neg_integer() | nil,
          can_put: boolean(),
          can_take: boolean(),
          accepts: [String.t()],
          rejects: [String.t()],
          locked: boolean(),
          lock_key: String.t() | nil,
          contents: [String.t()],
          state_descriptions: %{state() => String.t()},
          respawn: respawn_config() | nil,
          # Legacy fields for backwards compatibility
          description_open: String.t(),
          description_closed: String.t()
        }

  defstruct capacity: 10,
            weight_capacity: nil,
            can_put: true,
            can_take: true,
            accepts: [],
            rejects: [],
            locked: false,
            lock_key: nil,
            contents: [],
            state_descriptions: %{},
            respawn: nil,
            description_open: "The container is open.",
            description_closed: "A closed container."

  @doc """
  Checks if an entity is a container.
  """
  @spec container?(map() | nil) :: boolean()
  def container?(nil), do: false

  def container?(entity) do
    components = Map.get(entity, :components, %{})
    MapHelpers.get_flexible(components, :container, nil) != nil
  end

  @doc """
  Gets the container component from an entity.
  """
  @spec get_container(map() | nil) :: t() | nil
  def get_container(nil), do: nil

  def get_container(entity) do
    components = Map.get(entity, :components, %{})

    case MapHelpers.get_flexible(components, :container, nil) do
      nil -> nil
      data -> from_component(data)
    end
  end

  @doc """
  Gets the container component from an EntitySchema.
  Works directly with schema structs (before conversion to Entity).
  """
  def get_container_from_schema(nil), do: nil

  def get_container_from_schema(%{components: components}) when is_map(components) do
    case MapHelpers.get_flexible(components, :container, nil) do
      nil -> nil
      data -> from_component(data)
    end
  end

  def get_container_from_schema(_), do: nil

  @doc """
  Parses container from component data.
  """
  @spec from_component(map() | nil) :: t() | nil
  def from_component(data) when is_map(data) do
    %__MODULE__{
      capacity: MapHelpers.get_flexible(data, :capacity, 10),
      weight_capacity: MapHelpers.get_flexible(data, :weight_capacity, nil),
      can_put: MapHelpers.get_flexible(data, :can_put, true),
      can_take: MapHelpers.get_flexible(data, :can_take, true),
      accepts: MapHelpers.get_flexible(data, :accepts, []),
      rejects: MapHelpers.get_flexible(data, :rejects, []),
      locked: MapHelpers.get_flexible(data, :locked, false),
      lock_key: MapHelpers.get_flexible(data, :lock_key, nil),
      contents: MapHelpers.get_flexible(data, :contents, []),
      state_descriptions: parse_state_descriptions(data),
      respawn: parse_respawn_config(data),
      description_open:
        MapHelpers.get_flexible(data, :description_open, "The container is open."),
      description_closed:
        MapHelpers.get_flexible(data, :description_closed, "A closed container.")
    }
  end

  def from_component(_), do: nil

  defp parse_state_descriptions(data) do
    case MapHelpers.get_flexible(data, :state_descriptions, nil) do
      nil -> %{}
      descs when is_map(descs) -> normalize_state_keys(descs)
      _ -> %{}
    end
  end

  defp normalize_state_keys(descs) do
    descs
    |> Enum.map(fn {k, v} ->
      key =
        case k do
          :full -> :full
          :partial -> :partial
          :empty -> :empty
          "full" -> :full
          "partial" -> :partial
          "empty" -> :empty
          _ -> nil
        end

      if key, do: {key, v}, else: nil
    end)
    |> Enum.reject(&is_nil/1)
    |> Map.new()
  end

  defp parse_respawn_config(data) do
    case MapHelpers.get_flexible(data, :respawn, nil) do
      nil ->
        nil

      config when is_map(config) ->
        enabled = MapHelpers.get_flexible(config, :enabled, false)

        if enabled do
          %{
            enabled: true,
            delay_seconds: MapHelpers.get_flexible(config, :delay_seconds, 1800),
            loot_table: MapHelpers.get_flexible(config, :loot_table, [])
          }
        else
          nil
        end

      _ ->
        nil
    end
  end

  @doc """
  Puts an item into the container.

  Checks:
  - Container allows putting items (can_put)
  - Container is not locked
  - Container has capacity
  - Item type is accepted
  """
  @spec put_item(t(), String.t(), String.t() | nil) :: {:ok, t()} | {:error, term()}
  def put_item(%__MODULE__{} = container, item_id, item_type \\ nil) do
    cond do
      not container.can_put ->
        {:error, :cannot_put}

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

  Checks:
  - Container allows taking items (can_take)
  - Container is not locked
  - Item exists in container
  """
  @spec take_item(t(), String.t()) :: {:ok, t(), String.t()} | {:error, term()}
  def take_item(%__MODULE__{} = container, item_id) do
    cond do
      not container.can_take ->
        {:error, :cannot_take}

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
  Takes an item from the container by index.

  Similar to take_item/2 but uses list index instead of item ID.
  Useful for UI interactions where user clicks on nth item.
  """
  @spec take_item_at(t(), non_neg_integer()) :: {:ok, t(), String.t()} | {:error, term()}
  def take_item_at(%__MODULE__{} = container, index) when is_integer(index) do
    cond do
      not container.can_take ->
        {:error, :cannot_take}

      container.locked ->
        {:error, :container_locked}

      index < 0 or index >= length(container.contents) ->
        {:error, :index_out_of_bounds}

      true ->
        {item_id, new_contents} = List.pop_at(container.contents, index)
        {:ok, %{container | contents: new_contents}, item_id}
    end
  end

  @doc """
  Lists contents of the container.
  """
  @spec list_contents(t()) :: {:ok, [String.t()]} | {:error, :container_locked}
  def list_contents(%__MODULE__{locked: true}), do: {:error, :container_locked}
  def list_contents(%__MODULE__{contents: contents}), do: {:ok, contents}

  @doc """
  Checks if container is empty.
  """
  @spec empty?(t()) :: boolean()
  def empty?(%__MODULE__{contents: []}), do: true
  def empty?(%__MODULE__{}), do: false

  @doc """
  Gets remaining capacity.
  """
  @spec remaining_capacity(t()) :: non_neg_integer()
  def remaining_capacity(%__MODULE__{capacity: cap, contents: contents}) do
    cap - length(contents)
  end

  @doc """
  Attempts to unlock the container with a key.
  """
  @spec unlock(t(), String.t()) :: {:ok, t()} | {:error, :wrong_key}
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
  @spec lock(t()) :: {:ok, t()}
  def lock(%__MODULE__{} = container) do
    {:ok, %{container | locked: true}}
  end

  @doc """
  Gets appropriate description based on lock state.

  Note: For state-aware descriptions, use `get_state_description/1` instead.
  """
  @spec get_description(t()) :: String.t()
  def get_description(%__MODULE__{locked: true} = container) do
    container.description_closed
  end

  def get_description(%__MODULE__{} = container) do
    container.description_open
  end

  # =============================================================================
  # State Machine
  # =============================================================================

  @doc """
  Calculates the current state based on contents and capacity.

  Returns `:full`, `:partial`, or `:empty`.
  """
  @spec state(t()) :: state()
  def state(%__MODULE__{contents: []}), do: :empty

  def state(%__MODULE__{contents: contents, capacity: capacity}) do
    count = length(contents)

    cond do
      count >= capacity -> :full
      count > 0 -> :partial
      true -> :empty
    end
  end

  @doc """
  Gets the description for the current state.

  Falls back to:
  1. State-specific description from state_descriptions map
  2. Legacy description_open/description_closed based on lock state
  """
  @spec get_state_description(t()) :: String.t()
  def get_state_description(%__MODULE__{} = container) do
    current_state = state(container)

    case Map.get(container.state_descriptions, current_state) do
      nil -> get_description(container)
      desc -> desc
    end
  end

  @doc """
  Checks if respawn is enabled for this container.
  """
  @spec respawn_enabled?(t()) :: boolean()
  def respawn_enabled?(%__MODULE__{respawn: nil}), do: false
  def respawn_enabled?(%__MODULE__{respawn: %{enabled: enabled}}), do: enabled

  @doc """
  Gets the respawn delay in seconds.
  """
  @spec respawn_delay(t()) :: pos_integer() | nil
  def respawn_delay(%__MODULE__{respawn: nil}), do: nil
  def respawn_delay(%__MODULE__{respawn: %{delay_seconds: delay}}), do: delay

  @doc """
  Gets the loot table for respawn.
  """
  @spec loot_table(t()) :: list(map())
  def loot_table(%__MODULE__{respawn: nil}), do: []
  def loot_table(%__MODULE__{respawn: %{loot_table: table}}), do: table

  @doc """
  Checks if a player can put items into this container.
  """
  @spec can_put?(t()) :: boolean()
  def can_put?(%__MODULE__{can_put: can_put, locked: locked}) do
    can_put and not locked
  end

  @doc """
  Checks if a player can take items from this container.
  """
  @spec can_take?(t()) :: boolean()
  def can_take?(%__MODULE__{can_take: can_take, locked: locked}) do
    can_take and not locked
  end

  @doc """
  Generates initial contents for a container from its loot table.

  This is called when spawning a container entity that has respawn enabled
  and empty contents. Returns a list of item keys (to be spawned as entities).

  ## Example

      container = Container.from_component(%{
        capacity: 5,
        respawn: %{enabled: true, loot_table: [...]}
      })

      item_keys = Container.generate_initial_contents(container)
      # => ["gold_coin", "gold_coin", "health_potion"]
  """
  @spec generate_initial_contents(t()) :: [String.t()]
  def generate_initial_contents(%__MODULE__{} = _container) do
    # V2: LootTable deleted, will be reimplemented as entity behavior
    []
  end

  @doc """
  Converts the container back to a map for persistence.
  """
  @spec to_map(t()) :: map()
  def to_map(%__MODULE__{} = container) do
    base = %{
      capacity: container.capacity,
      can_put: container.can_put,
      can_take: container.can_take,
      accepts: container.accepts,
      rejects: container.rejects,
      locked: container.locked,
      contents: container.contents
    }

    base
    |> maybe_add(:weight_capacity, container.weight_capacity)
    |> maybe_add(:lock_key, container.lock_key)
    |> maybe_add(:state_descriptions, non_empty_map(container.state_descriptions))
    |> maybe_add(:respawn, container.respawn)
  end

  defp maybe_add(map, _key, nil), do: map
  defp maybe_add(map, key, value), do: Map.put(map, key, value)

  defp non_empty_map(map) when map == %{}, do: nil
  defp non_empty_map(map), do: map

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
