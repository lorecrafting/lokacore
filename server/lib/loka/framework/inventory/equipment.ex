defmodule Loka.Framework.Equipment do
  @moduledoc """
  Equipment management system for the game framework.

  Handles equipping, unequipping, and calculating stat bonuses from equipment.
  Works with the PlayerGameState and Inventory system.

  ## LegendMUD Equipment Slots

  - `:head` - worn on head (helmets, hats)
  - `:neck` - worn around neck (necklaces, scarves)
  - `:torso` - worn on torso (shirts, robes, armor)
  - `:about` - worn about body (cloaks, capes)
  - `:arms` - worn on arms (bracers, sleeves)
  - `:hands` - worn on hands (gloves, gauntlets)
  - `:waist` - worn around waist (belts, sashes)
  - `:legs` - worn on legs (pants, greaves)
  - `:feet` - worn on feet (boots, shoes)
  - `:held` - held in hand (torches, shields)
  - `:wielded` - wielded weapon (swords, staves)
  - `:light` - light source (lamps, candles)
  - `:finger_left` - worn on left finger (rings)
  - `:finger_right` - worn on right finger (rings)
  - `:wrist_left` - worn on left wrist (bracelets)
  - `:wrist_right` - worn on right wrist (bracelets)

  ## Stat Calculations

  Final stats are calculated as:
  - Attack = (STR * 2) + weapon_bonus
  - Defense = STA + armor_bonus
  - Max Health = STA * 10

  ## Usage

      alias Loka.Framework.Equipment
      alias Loka.Framework.Player.GameState

      {:ok, state} = GameState.get_or_create_state(player_id)

      # Equip an item (moves from inventory to slot)
      {:ok, state} = Equipment.equip(state, "iron_sword_01")

      # Get all equipped items
      equipped = Equipment.get_equipped(state)

      # Calculate total bonuses
      bonuses = Equipment.get_total_bonuses(state)

      # Unequip an item (moves back to inventory)
      {:ok, state} = Equipment.unequip(state, :wielded)
  """

  alias Loka.Framework.Player.GameState
  alias Loka.Framework.Inventory
  alias Loka.Framework.Inventory.Equipable

  @slots [
    :head,
    :neck,
    :torso,
    :about,
    :arms,
    :hands,
    :waist,
    :legs,
    :feet,
    :held,
    :wielded,
    :light,
    :finger_left,
    :finger_right,
    :wrist_left,
    :wrist_right
  ]

  @doc """
  Returns the list of valid equipment slots.
  """
  def slots, do: @slots

  @doc """
  Equips an item from the player's inventory to the appropriate slot.

  If the slot is already occupied, the existing item is moved back to inventory.

  Returns `{:ok, updated_state}` on success.
  Returns `{:error, reason}` if the item can't be equipped.

  ## Examples

      iex> equip(state, "iron_sword_01")
      {:ok, %GameState{equipment: %{weapon: "iron_sword_01", ...}}}
  """
  def equip(%GameState{} = state, item_id) when is_binary(item_id) do
    cond do
      not Inventory.has_item?(state, item_id) ->
        {:error, :not_in_inventory}

      true ->
        case get_item_equipable(item_id) do
          nil ->
            {:error, :not_equipable}

          equipable ->
            case check_requirements(state, equipable) do
              :ok ->
                do_equip(state, item_id, equipable.slot)

              {:error, _} = error ->
                error
            end
        end
    end
  end

  @doc """
  Unequips an item from a slot and returns it to inventory.

  Returns `{:ok, updated_state}` on success.
  Returns `{:error, :slot_empty}` if nothing is equipped in that slot.

  ## Examples

      iex> unequip(state, :weapon)
      {:ok, %GameState{equipment: %{weapon: nil, ...}}}
  """
  def unequip(%GameState{equipment: equipment} = state, slot) when slot in @slots do
    # Handle both atom and string keys from DB
    item_id = get_equipped_item(equipment, slot)

    case item_id do
      nil ->
        {:error, :slot_empty}

      item_id ->
        # Use atom key for in-memory struct, JSON serialization handles key conversion
        new_equipment = Map.put(equipment, slot, nil)
        new_inventory = state.inventory ++ [item_id]

        GameState.update_state(state, %{
          equipment: new_equipment,
          inventory: new_inventory
        })
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

  ## Examples

      iex> get_equipped(state)
      %{weapon: %{id: "sword_01", name: "Iron Sword", ...}, armor: nil, accessory: nil}
  """
  def get_equipped(%GameState{equipment: equipment}) do
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
  def get_equipped_id(%GameState{equipment: equipment}, slot) when slot in @slots do
    get_equipped_item(equipment, slot)
  end

  @doc """
  Calculates the total stat bonuses from all equipped items.

  Returns a map of bonus_type => total_value.

  ## Examples

      iex> get_total_bonuses(state)
      %{attack: 15, defense: 5, crit: 2}
  """
  def get_total_bonuses(%GameState{equipment: equipment}) do
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

  ## Examples

      iex> calculate_combat_stats(state)
      %{attack: 25, defense: 12, max_health: 100}
  """
  def calculate_combat_stats(%GameState{stats: stats} = state) do
    bonuses = get_total_bonuses(state)

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
  def equipped?(%GameState{equipment: equipment}, item_id) do
    Enum.any?(equipment, fn {_slot, id} -> id == item_id end)
  end

  # Private functions

  defp do_equip(state, item_id, slot) do
    # First, unequip any existing item in the slot
    state =
      case get_equipped_item(state.equipment, slot) do
        nil ->
          state

        _existing_id ->
          {:ok, new_state} = unequip(state, slot)
          new_state
      end

    # Remove item from inventory and add to equipment
    # Use atom key for in-memory struct, JSON serialization handles key conversion
    new_inventory = List.delete(state.inventory, item_id)
    new_equipment = Map.put(state.equipment, slot, item_id)

    GameState.update_state(state, %{
      inventory: new_inventory,
      equipment: new_equipment
    })
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

  defp check_requirements(state, %Equipable{requirements: requirements}) do
    # Stats may have string keys from DB load
    level = Map.get(state.stats, "level") || Map.get(state.stats, :level, 1)
    stats = Map.merge(state.stats, %{"level" => level})

    missing =
      requirements
      |> Enum.filter(fn {stat, required} ->
        Map.get(stats, stat, 0) < required
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
