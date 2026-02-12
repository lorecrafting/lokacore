defmodule Loka.Framework.Inventory do
  @moduledoc """
  Inventory management system for the game framework.

  Handles adding, removing, and using items in a player's inventory.
  Works with the PlayerGameState to persist inventory changes.

  ## Usage

      alias Loka.Framework.Inventory
      alias Loka.Framework.Player.GameState

      {:ok, state} = GameState.get_or_create_state(player_id)

      # Add an item
      {:ok, state} = Inventory.add_item(state, "sword_01")

      # Check if player has item
      Inventory.has_item?(state, "sword_01")  # => true

      # List all items with details
      items = Inventory.list_items(state)

      # Use a consumable
      {:ok, state} = Inventory.use_item(state, "health_potion_01")
  """

  require Logger

  alias Loka.Framework.Player.GameState
  alias Loka.Engine.Entities

  @doc """
  Adds an item to the player's inventory.

  Returns `{:ok, updated_state}` on success.
  Returns `{:error, reason}` if the item doesn't exist.

  ## Examples

      iex> add_item(state, "sword_01")
      {:ok, %GameState{inventory: ["sword_01"]}}
  """
  def add_item(%GameState{} = state, item_id) when is_binary(item_id) do
    Logger.debug("[INVENTORY] Adding item: item_id=#{item_id}")

    case get_item_details(item_id) do
      nil ->
        Logger.warning("[INVENTORY] Add failed - item not found: item_id=#{item_id}")
        {:error, :item_not_found}

      item ->
        new_inventory = state.inventory ++ [item_id]
        Logger.info("[INVENTORY] Item added: item=#{item.short_desc || item_id}")
        GameState.update_state(state, %{inventory: new_inventory})
    end
  end

  # Allow adding items without entity lookup for testing/bootstrapping
  def add_item_unchecked(%GameState{} = state, item_id) when is_binary(item_id) do
    new_inventory = state.inventory ++ [item_id]
    GameState.update_state(state, %{inventory: new_inventory})
  end

  @doc """
  Removes an item from the player's inventory.

  Returns `{:ok, updated_state}` on success.
  Returns `{:error, :not_found}` if the item is not in inventory.

  ## Examples

      iex> remove_item(state, "sword_01")
      {:ok, %GameState{inventory: []}}
  """
  def remove_item(%GameState{inventory: inventory} = state, item_id) do
    Logger.debug("[INVENTORY] Removing item: item_id=#{item_id}")

    if item_id in inventory do
      new_inventory = List.delete(inventory, item_id)
      Logger.info("[INVENTORY] Item removed: item_id=#{item_id}")
      GameState.update_state(state, %{inventory: new_inventory})
    else
      Logger.debug("[INVENTORY] Remove failed - item not in inventory: item_id=#{item_id}")
      {:error, :not_found}
    end
  end

  @doc """
  Checks if the player has a specific item in their inventory.

  ## Examples

      iex> has_item?(state, "sword_01")
      true
  """
  def has_item?(%GameState{inventory: inventory}, item_id) do
    item_id in inventory
  end

  @doc """
  Lists all items in the player's inventory with their details.

  Returns a list of maps containing item information.
  Items that no longer exist in the database are filtered out.

  ## Examples

      iex> list_items(state)
      [%{id: "sword_01", name: "Iron Sword", description: "A sturdy blade", ...}]
  """
  def list_items(%GameState{inventory: inventory}) do
    # Batch-load all items in a single query to avoid N+1
    inventory
    |> Entities.get_all_by_ids()
    |> Enum.map(&Entities.to_entity/1)
    |> Enum.map(&item_to_map/1)
  end

  @doc """
  Uses a consumable item from the inventory.

  Applies the item's effect (healing, buffs, etc.) and removes it from inventory.

  Returns `{:ok, updated_state, effect}` on success.
  Returns `{:error, reason}` if the item can't be used.

  ## Examples

      iex> use_item(state, "health_potion_01")
      {:ok, %GameState{}, %{healed: 50}}
  """
  def use_item(%GameState{} = state, item_id) do
    Logger.debug("[INVENTORY] Using item: item_id=#{item_id}")

    cond do
      not has_item?(state, item_id) ->
        Logger.debug("[INVENTORY] Use failed - not in inventory: item_id=#{item_id}")
        {:error, :not_in_inventory}

      true ->
        case get_item_details(item_id) do
          nil ->
            Logger.warning("[INVENTORY] Use failed - item not found: item_id=#{item_id}")
            {:error, :item_not_found}

          item ->
            Logger.info("[INVENTORY] Item used: item=#{item.short_desc || item_id}")
            apply_item_effect(state, item)
        end
    end
  end

  @doc """
  Gets the full entity details for an item.

  Returns the Entity struct or nil if not found.
  """
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
  def count(%GameState{inventory: inventory}), do: length(inventory)

  @doc """
  Returns true if the inventory is empty.
  """
  def empty?(%GameState{inventory: []}), do: true
  def empty?(%GameState{}), do: false

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

  defp apply_item_effect(state, item) do
    # Check for consumable component
    # Components from DB use string keys
    consumable = Map.get(item.components, "consumable", %{})

    cond do
      # Healing item - check for string key from DB
      heal_amount = Map.get(consumable, "heal") ->
        apply_healing(state, item.id, heal_amount)

      # Script-based item effect (on_use script)
      script_key = get_use_script(item) ->
        apply_script_effect(state, item, script_key)

      # Declarative use_effect in components
      use_effect = get_in(item.components, ["use_effect"]) ->
        apply_declarative_effect(state, item, use_effect)

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
  defp apply_script_effect(state, item, script_key) do
    alias Loka.Engine.Script.Executor

    context = %{
      player: %{id: state.player_id},
      game_state: state,
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
          with {:ok, updated_state} <- remove_item(state, item.id) do
            {:ok, updated_state, %{script: script_key, consumed: true}}
          end
        else
          {:ok, state, %{script: script_key, consumed: false}}
        end

      {:error, reason} ->
        Logger.warning(
          "[INVENTORY] Use script failed: script=#{script_key}, reason=#{inspect(reason)}"
        )

        {:error, :script_failed}
    end
  end

  # Apply a declarative effect from item data (no script needed)
  defp apply_declarative_effect(state, item, effect) when is_map(effect) do
    result =
      case Map.get(effect, "type") do
        "heal" ->
          amount = Map.get(effect, "amount", 0)
          apply_healing(state, item.id, amount)

        "apply_status" ->
          status_key = Map.get(effect, "status")
          # Status effects are applied via the action queue / event bus
          # For now, emit the event and consume the item
          alias Loka.Engine.{Event, EventBus}

          event =
            Event.new(:apply_effect, %{
              target: state.player_id,
              payload: %{
                effect_key: status_key,
                duration: Map.get(effect, "duration")
              }
            })

          EventBus.emit(event)

          with {:ok, updated_state} <- remove_item(state, item.id) do
            {:ok, updated_state, %{effect_type: "apply_status", status: status_key}}
          end

        "teleport" ->
          room_key = Map.get(effect, "room")

          alias Loka.Engine.{Event, EventBus}

          event =
            Event.new(:teleport, %{
              target: state.player_id,
              payload: %{room_id: room_key, instant: true}
            })

          EventBus.emit(event)

          if consumable_on_use?(item) do
            with {:ok, updated_state} <- remove_item(state, item.id) do
              {:ok, updated_state, %{effect_type: "teleport", room: room_key}}
            end
          else
            {:ok, state, %{effect_type: "teleport", room: room_key}}
          end

        unknown ->
          Logger.warning("[INVENTORY] Unknown use_effect type: #{inspect(unknown)}")
          {:error, :unknown_effect}
      end

    result
  end

  defp apply_declarative_effect(_state, _item, _effect), do: {:error, :invalid_effect}

  # Check if item should be consumed on use
  defp consumable_on_use?(item) do
    consumable = Map.get(item.components, "consumable", %{})
    components = item.components || %{}

    # Consumed if: consumable component exists, or components.consumable is true
    map_size(consumable) > 0 ||
      Map.get(components, "consumable") == true ||
      Map.get(components, "consumed_on_use") == true
  end

  defp apply_healing(state, item_id, amount) do
    alias Loka.Mechanics.Heal

    # Get current health state
    current_health = GameState.get_health(state)

    # Use Mechanics.Heal for calculation and application
    {:ok, new_health, heal_result} = Heal.apply_to_map(current_health, amount)

    # Remove item and update health via set_health
    with {:ok, state} <- remove_item(state, item_id),
         {:ok, state} <- GameState.set_health(state, new_health) do
      {:ok, state, %{healed: heal_result.healing_done}}
    end
  end
end
