defmodule Loka.Framework.Equipment do
  @moduledoc """
  Equipment management system for the game framework.

  Handles equipping, unequipping, and calculating stat bonuses from equipment.
  Operates as pure functions on Entity structs.

  See `Loka.Engine.Constants.EquipmentSlots` for slot definitions.

  ## Stat Calculations

  Final stats are calculated as:
  - Attack = (STR * 2) + weapon_bonus
  - Defense = STA + armor_bonus
  - Max Health = STA * 10

  ## Usage

      alias Loka.Framework.Equipment
      alias Loka.Engine.Entity

      # Equip an item (moves from inventory to slot)
      {:ok, entity} = Equipment.equip(entity, "iron_sword_01")

      # Get all equipped items
      equipped = Equipment.get_equipped(entity)

      # Calculate total bonuses
      bonuses = Equipment.get_total_bonuses(entity)

      # Unequip an item (moves back to inventory)
      {:ok, entity} = Equipment.unequip(entity, :wielded)
  """

  alias Loka.Engine.Entity
  alias Loka.Framework.Inventory
  alias Loka.Framework.Inventory.Equipable
  alias Loka.Engine.Constants.EquipmentSlots

  # For use in guards (must be compile-time constant)
  @slots EquipmentSlots.all()

  @doc """
  Returns the list of valid equipment slots.
  """
  defdelegate slots, to: EquipmentSlots, as: :all

  @doc """
  Equips an item from the player's inventory to the appropriate slot.

  If the slot is already occupied, the existing item is moved back to inventory.

  Returns `{:ok, updated_entity}` on success.
  Returns `{:error, reason}` if the item can't be equipped.
  """
  def equip(%Entity{} = entity, item_id) when is_binary(item_id) do
    cond do
      not Inventory.has_item?(entity, item_id) ->
        {:error, :not_in_inventory}

      true ->
        case get_item_equipable(item_id) do
          nil ->
            {:error, :not_equipable}

          equipable ->
            case check_requirements(entity, equipable) do
              :ok ->
                do_equip(entity, item_id, equipable.slot)

              {:error, _} = error ->
                error
            end
        end
    end
  end

  @doc """
  Unequips an item from a slot and returns it to inventory.

  Returns `{:ok, updated_entity}` on success.
  Returns `{:error, :slot_empty}` if nothing is equipped in that slot.
  """
  def unequip(%Entity{} = entity, slot) when slot in @slots do
    equipment = Entity.get_component(entity, "equipment") || %{}
    # Handle both atom and string keys from DB
    item_id = get_equipped_item(equipment, slot)

    case item_id do
      nil ->
        {:error, :slot_empty}

      item_id ->
        inventory = Entity.get_component(entity, "inventory") || []
        # Use atom key for in-memory struct, JSON serialization handles key conversion
        new_equipment = Map.put(equipment, slot, nil)
        new_inventory = inventory ++ [item_id]

        entity =
          entity
          |> Entity.add_component("equipment", new_equipment)
          |> Entity.add_component("inventory", new_inventory)

        {:ok, entity}
    end
  end

  def unequip(_, slot), do: {:error, {:invalid_slot, slot}}

  # Helper to get equipped item from slot, handling both atom and string keys
  defp get_equipped_item(equipment, slot) when is_atom(slot) do
    Map.get(equipment, slot) || Map.get(equipment, Atom.to_string(slot))
  end

  @doc """
  Gets all currently equipped items with their details.

  Returns a map of slot => item_details.
  """
  def get_equipped(%Entity{} = entity) do
    equipment = Entity.get_component(entity, "equipment") || %{}

    equipment
    |> Enum.map(fn {slot, item_id} ->
      item = if item_id, do: get_item_details(item_id), else: nil
      {slot, item}
    end)
    |> Map.new()
  end

  @doc """
  Returns the item_id equipped in a specific slot, or nil.
  """
  def get_equipped_id(%Entity{} = entity, slot) when slot in @slots do
    equipment = Entity.get_component(entity, "equipment") || %{}
    get_equipped_item(equipment, slot)
  end

  @doc """
  Calculates the total stat bonuses from all equipped items.

  Returns a map of bonus_type => total_value.
  """
  def get_total_bonuses(%Entity{} = entity) do
    equipment = Entity.get_component(entity, "equipment") || %{}

    equipment
    |> Enum.map(fn {_slot, item_id} -> item_id end)
    |> Enum.reject(&is_nil/1)
    |> Enum.map(&get_item_bonuses/1)
    |> Enum.reduce(%{}, fn bonuses, acc ->
      Map.merge(acc, bonuses, fn _k, v1, v2 -> v1 + v2 end)
    end)
  end

  @doc """
  Calculates the player's final combat stats with equipment bonuses.

  Returns a map with :attack, :defense, and :max_health.

  ## Formulas

  - Attack = (STR * 2) + weapon_attack_bonus
  - Defense = STA + armor_defense_bonus
  - Max Health = STA * 10
  """
  def calculate_combat_stats(%Entity{} = entity) do
    stats = Entity.get_component(entity, "stats") || %{}
    bonuses = get_total_bonuses(entity)

    # Stats from DB use string keys, but may use atom keys if from default
    base_str = Map.get(stats, "str") || Map.get(stats, :str, 10)
    base_sta = Map.get(stats, "sta") || Map.get(stats, :sta, 10)

    # Bonuses are calculated in-memory so can use atom keys
    attack_bonus = Map.get(bonuses, :attack, 0)
    defense_bonus = Map.get(bonuses, :defense, 0)

    %{
      attack: base_str * 2 + attack_bonus,
      defense: base_sta + defense_bonus,
      max_health: base_sta * 10
    }
  end

  @doc """
  Checks if an item is currently equipped.
  """
  def equipped?(%Entity{} = entity, item_id) do
    equipment = Entity.get_component(entity, "equipment") || %{}
    Enum.any?(equipment, fn {_slot, id} -> id == item_id end)
  end

  # Private functions

  defp do_equip(entity, item_id, slot) do
    equipment = Entity.get_component(entity, "equipment") || %{}

    # First, unequip any existing item in the slot
    entity =
      case get_equipped_item(equipment, slot) do
        nil ->
          entity

        _existing_id ->
          {:ok, new_entity} = unequip(entity, slot)
          new_entity
      end

    # Remove item from inventory and add to equipment
    inventory = Entity.get_component(entity, "inventory") || []
    equipment = Entity.get_component(entity, "equipment") || %{}
    new_inventory = List.delete(inventory, item_id)
    new_equipment = Map.put(equipment, slot, item_id)

    entity =
      entity
      |> Entity.add_component("inventory", new_inventory)
      |> Entity.add_component("equipment", new_equipment)

    {:ok, entity}
  end

  defp get_item_equipable(item_id) do
    case Inventory.get_item_details(item_id) do
      nil ->
        nil

      item ->
        # Components from DB use string keys
        case Map.get(item.components, "equipable") do
          nil -> nil
          data -> Equipable.from_map(data)
        end
    end
  end

  defp get_item_details(item_id) do
    case Inventory.get_item_details(item_id) do
      nil -> nil
      item -> item_to_map(item)
    end
  end

  defp get_item_bonuses(item_id) do
    case get_item_equipable(item_id) do
      nil -> %{}
      equipable -> equipable.bonuses
    end
  end

  defp check_requirements(entity, %Equipable{requirements: requirements}) do
    stats = Entity.get_component(entity, "stats") || %{}

    # Requirements use atom keys (from Equipable.from_map), but entity stats
    # use string keys from DB. Look up both key forms for each requirement.
    missing =
      requirements
      |> Enum.filter(fn {stat, required} ->
        value =
          Map.get(stats, stat) ||
            Map.get(stats, Atom.to_string(stat), 0)

        value < required
      end)
      |> Map.new()

    if map_size(missing) == 0 do
      :ok
    else
      {:error, {:requirements_not_met, missing}}
    end
  end

  defp item_to_map(entity) do
    %{
      id: entity.id,
      name: entity.short_desc,
      description: entity.extra_desc,
      type: entity.type,
      components: entity.components,
      tags: entity.tags
    }
  end
end
