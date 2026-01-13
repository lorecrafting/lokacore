defmodule Loka.Framework.Appearance.Clothing do
  @moduledoc """
  Clothing and appearance system.

  Manages non-armor wearable items that affect appearance:
  - Visual description changes based on worn items
  - Social bonuses from fine clothing
  - Disguises and faction uniforms
  - Layered clothing system

  ## Clothing Configuration (YAML - Item Prototype)

      key: noble_cloak
      name: "Noble's Cloak"
      type: item
      components:
        clothing:
          slot: cloak
          layer: outer            # under | middle | outer
          appearance_text: "wearing a fine noble's cloak"
          look_description: "A luxurious cloak of deep purple velvet."
          social_bonus: 2
          warmth: 2
          faction_disguise: nobility
          visibility: true        # Shows in character description
          dyeable: true
          color: purple

  ## Clothing Slots

  - `head` - Hats, hoods, crowns
  - `face` - Masks, veils
  - `neck` - Scarves, necklaces
  - `torso` - Shirts, dresses
  - `cloak` - Cloaks, capes
  - `hands` - Gloves
  - `waist` - Belts, sashes
  - `legs` - Pants, skirts
  - `feet` - Shoes, boots

  ## Usage

      alias Loka.Framework.Appearance.Clothing

      # Get worn clothing
      worn = Clothing.get_worn_clothing(game_state)

      # Get appearance description
      desc = Clothing.get_appearance_description(game_state)

      # Check for disguise
      disguise = Clothing.get_active_disguise(game_state)

      # Get social bonus from clothing
      bonus = Clothing.get_social_bonus(game_state)
  """

  alias Loka.Framework.Player.GameState
  alias Loka.Utils.MapHelpers

  @clothing_slots [:head, :face, :neck, :torso, :cloak, :hands, :waist, :legs, :feet]
  @layers [:under, :middle, :outer]

  @type clothing_item :: %{
          slot: atom(),
          layer: atom(),
          appearance_text: String.t(),
          look_description: String.t(),
          social_bonus: integer(),
          warmth: integer(),
          faction_disguise: String.t() | nil,
          visibility: boolean(),
          dyeable: boolean(),
          color: String.t() | nil
        }

  @doc """
  Gets all worn clothing from a game state.
  """
  def get_worn_clothing(%GameState{} = game_state) do
    equipment = MapHelpers.get_flexible(game_state.stats, :equipment, %{})
    MapHelpers.get_flexible(equipment, :clothing, %{})
  end

  @doc """
  Gets clothing in a specific slot.
  """
  def get_slot(%GameState{} = game_state, slot) do
    clothing = get_worn_clothing(game_state)
    Map.get(clothing, slot)
  end

  @doc """
  Wears a clothing item.
  """
  def wear(%GameState{} = game_state, slot, clothing_data) when slot in @clothing_slots do
    clothing = get_worn_clothing(game_state)
    updated_clothing = Map.put(clothing, slot, clothing_data)

    equipment = MapHelpers.get_flexible(game_state.stats, :equipment, %{})
    updated_equipment = Map.put(equipment, :clothing, updated_clothing)

    {:ok, %{game_state | stats: Map.put(game_state.stats, :equipment, updated_equipment)}}
  end

  def wear(_game_state, slot, _clothing_data) do
    {:error, {:invalid_slot, slot}}
  end

  @doc """
  Removes clothing from a slot.
  """
  def remove(%GameState{} = game_state, slot) do
    clothing = get_worn_clothing(game_state)

    if Map.has_key?(clothing, slot) do
      {item, updated_clothing} = Map.pop(clothing, slot)

      equipment = MapHelpers.get_flexible(game_state.stats, :equipment, %{})
      updated_equipment = Map.put(equipment, :clothing, updated_clothing)

      {:ok, %{game_state | stats: Map.put(game_state.stats, :equipment, updated_equipment)}, item}
    else
      {:error, :nothing_worn}
    end
  end

  @doc """
  Generates appearance description based on worn clothing.
  """
  def get_appearance_description(%GameState{} = game_state) do
    clothing = get_worn_clothing(game_state)

    visible_items =
      clothing
      |> Enum.filter(fn {_slot, item} ->
        Map.get(item, :visibility, true)
      end)
      |> Enum.sort_by(fn {_slot, item} ->
        layer_order(Map.get(item, :layer, :middle))
      end)
      |> Enum.map(fn {_slot, item} ->
        Map.get(item, :appearance_text, "")
      end)
      |> Enum.reject(&(&1 == ""))

    case visible_items do
      [] -> nil
      items -> Enum.join(items, ", ")
    end
  end

  @doc """
  Gets total social bonus from worn clothing.
  """
  def get_social_bonus(%GameState{} = game_state) do
    clothing = get_worn_clothing(game_state)

    Enum.reduce(clothing, 0, fn {_slot, item}, acc ->
      acc + Map.get(item, :social_bonus, 0)
    end)
  end

  @doc """
  Gets total warmth value from worn clothing.
  """
  def get_warmth(%GameState{} = game_state) do
    clothing = get_worn_clothing(game_state)

    Enum.reduce(clothing, 0, fn {_slot, item}, acc ->
      acc + Map.get(item, :warmth, 0)
    end)
  end

  @doc """
  Checks for active faction disguise.
  """
  def get_active_disguise(%GameState{} = game_state) do
    clothing = get_worn_clothing(game_state)

    disguises =
      clothing
      |> Enum.map(fn {_slot, item} -> Map.get(item, :faction_disguise) end)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    case disguises do
      [] -> nil
      [single] -> single
      # Multiple disguises might conflict
      multiple -> multiple
    end
  end

  @doc """
  Dyes a clothing item a new color.
  """
  def dye(%GameState{} = game_state, slot, new_color) do
    clothing = get_worn_clothing(game_state)

    case Map.get(clothing, slot) do
      nil ->
        {:error, :nothing_worn}

      item ->
        if Map.get(item, :dyeable, false) do
          updated_item = Map.put(item, :color, new_color)
          updated_clothing = Map.put(clothing, slot, updated_item)

          equipment = MapHelpers.get_flexible(game_state.stats, :equipment, %{})
          updated_equipment = Map.put(equipment, :clothing, updated_clothing)

          {:ok, %{game_state | stats: Map.put(game_state.stats, :equipment, updated_equipment)}}
        else
          {:error, :not_dyeable}
        end
    end
  end

  @doc """
  Returns valid clothing slots.
  """
  def clothing_slots, do: @clothing_slots

  @doc """
  Returns valid layers.
  """
  def layers, do: @layers

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp layer_order(:under), do: 0
  defp layer_order(:middle), do: 1
  defp layer_order(:outer), do: 2
  defp layer_order(_), do: 1
end
