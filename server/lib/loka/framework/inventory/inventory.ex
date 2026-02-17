defmodule Loka.Framework.Inventory do
  @moduledoc """
  Inventory management system for the game framework.

  Handles adding, removing, and using items in a character entity's inventory.
  Operates as pure functions on Entity structs.

  ## Usage

      alias Loka.Framework.Inventory
      alias Loka.Engine.Entity

      # Add an item
      {:ok, entity} = Inventory.add_item(entity, "sword_01")

      # Check if player has item
      Inventory.has_item?(entity, "sword_01")  # => true

      # List all items with details
      items = Inventory.list_items(entity)

      # Use a consumable
      {:ok, entity} = Inventory.use_item(entity, "health_potion_01")
  """

  require Logger

  alias Loka.Engine.Entity
  alias Loka.Engine.Entities

  @doc """
  Adds an item to the player's inventory.

  Returns `{:ok, updated_entity}` on success.
  Returns `{:error, reason}` if the item doesn't exist.
  """
  @spec add_item(Entity.t(), String.t()) :: {:ok, Entity.t()} | {:error, :item_not_found}
  def add_item(%Entity{} = entity, item_id) when is_binary(item_id) do
    Logger.debug("[INVENTORY] Adding item: item_id=#{item_id}")

    case get_item_details(item_id) do
      nil ->
        Logger.warning("[INVENTORY] Add failed - item not found: item_id=#{item_id}")
        {:error, :item_not_found}

      item ->
        inventory = Entity.get_component(entity, "inventory") || []
        new_inventory = inventory ++ [item_id]
        Logger.info("[INVENTORY] Item added: item=#{item.short_desc || item_id}")
        {:ok, Entity.add_component(entity, "inventory", new_inventory)}
    end
  end

  @spec add_item_unchecked(Entity.t(), String.t()) :: {:ok, Entity.t()}
  def add_item_unchecked(%Entity{} = entity, item_id) when is_binary(item_id) do
    inventory = Entity.get_component(entity, "inventory") || []
    new_inventory = inventory ++ [item_id]
    {:ok, Entity.add_component(entity, "inventory", new_inventory)}
  end

  @doc """
  Removes an item from the player's inventory.

  Returns `{:ok, updated_entity}` on success.
  Returns `{:error, :not_found}` if the item is not in inventory.
  """
  @spec remove_item(Entity.t(), String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def remove_item(%Entity{} = entity, item_id) do
    Logger.debug("[INVENTORY] Removing item: item_id=#{item_id}")
    inventory = Entity.get_component(entity, "inventory") || []

    if item_id in inventory do
      new_inventory = List.delete(inventory, item_id)
      Logger.info("[INVENTORY] Item removed: item_id=#{item_id}")
      {:ok, Entity.add_component(entity, "inventory", new_inventory)}
    else
      Logger.debug("[INVENTORY] Remove failed - item not in inventory: item_id=#{item_id}")
      {:error, :not_found}
    end
  end

  @doc """
  Checks if the player has a specific item in their inventory.
  """
  @spec has_item?(Entity.t(), String.t()) :: boolean()
  def has_item?(%Entity{} = entity, item_id) do
    inventory = Entity.get_component(entity, "inventory") || []
    item_id in inventory
  end

  @doc """
  Lists all items in the player's inventory with their details.

  Returns a list of maps containing item information.
  Items that no longer exist in the database are filtered out.
  """
  @spec list_items(Entity.t()) :: [map()]
  def list_items(%Entity{} = entity) do
    inventory = Entity.get_component(entity, "inventory") || []

    # Batch-load all items in a single query to avoid N+1
    inventory
    |> Entities.get_all_by_ids()
    |> Enum.map(&Entities.to_entity/1)
    |> Enum.map(&item_to_map/1)
  end

  @doc """
  Uses a consumable item from the inventory.

  Applies the item's effect (healing, buffs, etc.) and removes it from inventory.

  Returns `{:ok, updated_entity, effect}` on success.
  Returns `{:error, reason}` if the item can't be used.
  """
  @spec use_item(Entity.t(), String.t()) :: {:ok, Entity.t(), map()} | {:error, term()}
  def use_item(%Entity{} = entity, item_id) do
    Logger.debug("[INVENTORY] Using item: item_id=#{item_id}")

    cond do
      not has_item?(entity, item_id) ->
        Logger.debug("[INVENTORY] Use failed - not in inventory: item_id=#{item_id}")
        {:error, :not_in_inventory}

      true ->
        case get_item_details(item_id) do
          nil ->
            Logger.warning("[INVENTORY] Use failed - item not found: item_id=#{item_id}")
            {:error, :item_not_found}

          item ->
            Logger.info("[INVENTORY] Item used: item=#{item.short_desc || item_id}")
            apply_item_effect(entity, item)
        end
    end
  end

  @doc """
  Gets the full entity details for an item.

  Returns the Entity struct or nil if not found.
  """
  @spec get_item_details(String.t() | nil) :: Entity.t() | nil
  def get_item_details(item_id) when is_binary(item_id) do
    case Entities.get_entity(item_id) do
      nil -> nil
      schema -> Entities.to_entity(schema)
    end
  end

  def get_item_details(_), do: nil

  @doc """
  Returns the count of items in the inventory.
  """
  @spec count(Entity.t()) :: non_neg_integer()
  def count(%Entity{} = entity) do
    inventory = Entity.get_component(entity, "inventory") || []
    length(inventory)
  end

  @doc """
  Returns true if the inventory is empty.
  """
  @spec empty?(Entity.t()) :: boolean()
  def empty?(%Entity{} = entity) do
    inventory = Entity.get_component(entity, "inventory") || []
    inventory == []
  end

  # Private functions

  defp item_to_map(entity) do
    %{
      id: entity.id,
      key: entity.key,
      name: entity.short_desc,
      description: entity.extra_desc,
      type: entity.type,
      components: entity.components,
      tags: entity.tags
    }
  end

  defp apply_item_effect(entity, item) do
    # Check for consumable component
    # Components from DB use string keys
    consumable = Map.get(item.components, "consumable", %{})

    cond do
      # Healing item - check for string key from DB
      heal_amount = Map.get(consumable, "heal") ->
        apply_healing(entity, item.id, heal_amount)

      # Script-based item effect (on_use script)
      script_key = get_use_script(item) ->
        apply_script_effect(entity, item, script_key)

      # Declarative use_effect in components
      use_effect = get_in(item.components, ["use_effect"]) ->
        apply_declarative_effect(entity, item, use_effect)

      # Not usable
      true ->
        {:error, :not_usable}
    end
  end

  # Look up on_use script from entity's scripts or data
  defp get_use_script(item) do
    # Check scripts map first (attached scripts)
    scripts = Map.get(item, :scripts, %{}) || %{}
    builder_scripts = Map.get(item, :builder_scripts, %{}) || %{}

    Map.get(scripts, "on_use") ||
      Map.get(scripts, :on_use) ||
      Map.get(builder_scripts, "on_use") ||
      Map.get(builder_scripts, :on_use) ||
      get_in(item.components, ["use_script"])
  end

  # Execute a script attached to the item
  defp apply_script_effect(entity, item, script_key) do
    alias Loka.Engine.Script.Executor

    context = %{
      player: %{id: entity.account_id},
      entity: entity,
      trigger: :use,
      item: %{
        id: item.id,
        key: item.key,
        name: item.short_desc,
        tags: item.tags || [],
        components: item.components || %{}
      }
    }

    case Executor.run_by_key(script_key, item, context) do
      {:ok, _result} ->
        # Check if item should be consumed after use
        if consumable_on_use?(item) do
          with {:ok, updated_entity} <- remove_item(entity, item.id) do
            {:ok, updated_entity, %{script: script_key, consumed: true}}
          end
        else
          {:ok, entity, %{script: script_key, consumed: false}}
        end

      {:error, reason} ->
        Logger.warning(
          "[INVENTORY] Use script failed: script=#{script_key}, reason=#{inspect(reason)}"
        )

        {:error, :script_failed}
    end
  end

  # Apply a declarative effect from item data (no script needed)
  defp apply_declarative_effect(entity, item, effect) when is_map(effect) do
    result =
      case Map.get(effect, "type") do
        "heal" ->
          amount = Map.get(effect, "amount", 0)
          apply_healing(entity, item.id, amount)

        "apply_status" ->
          status_key = Map.get(effect, "status")
          # Status effects are applied via the action queue / event bus
          alias Loka.Engine.{Event, EventBus}

          event =
            Event.new(:apply_effect, %{
              target: entity.account_id,
              payload: %{
                effect_key: status_key,
                duration: Map.get(effect, "duration")
              }
            })

          EventBus.emit(event)

          with {:ok, updated_entity} <- remove_item(entity, item.id) do
            {:ok, updated_entity, %{effect_type: "apply_status", status: status_key}}
          end

        "teleport" ->
          room_key = Map.get(effect, "room")

          alias Loka.Engine.{Event, EventBus}

          event =
            Event.new(:teleport, %{
              target: entity.account_id,
              payload: %{room_id: room_key, instant: true}
            })

          EventBus.emit(event)

          if consumable_on_use?(item) do
            with {:ok, updated_entity} <- remove_item(entity, item.id) do
              {:ok, updated_entity, %{effect_type: "teleport", room: room_key}}
            end
          else
            {:ok, entity, %{effect_type: "teleport", room: room_key}}
          end

        unknown ->
          Logger.warning("[INVENTORY] Unknown use_effect type: #{inspect(unknown)}")
          {:error, :unknown_effect}
      end

    result
  end

  defp apply_declarative_effect(_entity, _item, _effect), do: {:error, :invalid_effect}

  # Check if item should be consumed on use
  defp consumable_on_use?(item) do
    consumable = Map.get(item.components, "consumable", %{})
    components = item.components || %{}

    # Consumed if: consumable component exists, or components.consumable is true
    map_size(consumable) > 0 ||
      Map.get(components, "consumable") == true ||
      Map.get(components, "consumed_on_use") == true
  end

  defp apply_healing(entity, item_id, amount) do
    alias Loka.Mechanics.Heal

    # Get current health from resources component
    resources = Entity.get_component(entity, "resources") || %{}
    current_health = resources["health"] || %{"current" => 100, "max" => 100}

    # Use Mechanics.Heal for calculation and application
    {:ok, new_health, heal_result} = Heal.apply_to_map(current_health, amount)

    # Remove item and update health in resources
    with {:ok, entity} <- remove_item(entity, item_id) do
      new_resources = Map.put(resources, "health", new_health)
      entity = Entity.add_component(entity, "resources", new_resources)
      {:ok, entity, %{healed: heal_result.healing_done}}
    end
  end
end
