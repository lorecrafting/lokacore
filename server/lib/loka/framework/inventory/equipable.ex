defmodule Loka.Framework.Inventory.Equipable do
  @moduledoc """
  Component for items that can be equipped by players.

  Defines the equipment slot, stat bonuses, and requirements for the item.

  ## Fields

  - `slot` - Which equipment slot this item occupies (LegendMUD-style slots)
  - `bonuses` - Map of stat bonuses granted when equipped
  - `requirements` - Map of stat requirements to equip this item

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
  - `:finger_left` - worn on left finger (rings)
  - `:finger_right` - worn on right finger (rings)
  - `:wrist_left` - worn on left wrist (bracelets)
  - `:wrist_right` - worn on right wrist (bracelets)

  ## Example

      %Equipable{
        slot: :wielded,
        bonuses: %{attack: 5, crit: 2},
        requirements: %{str: 15, level: 5}
      }
  """

  @type slot ::
          :head
          | :neck
          | :torso
          | :about
          | :arms
          | :hands
          | :waist
          | :legs
          | :feet
          | :held
          | :wielded
          | :finger_left
          | :finger_right
          | :wrist_left
          | :wrist_right

  @type t :: %__MODULE__{
          slot: slot(),
          bonuses: map(),
          requirements: map()
        }

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
    :finger_left,
    :finger_right,
    :wrist_left,
    :wrist_right
  ]

  defstruct slot: :held,
            bonuses: %{},
            requirements: %{}

  @doc """
  Creates a new Equipable with the given attributes.
  """
  def new(attrs \\ %{}) do
    struct(__MODULE__, attrs)
  end

  @doc """
  Creates an Equipable from a map with string keys (as loaded from JSON/DB).

  Converts string keys to atoms and handles slot conversion.
  """
  def from_map(nil), do: nil

  def from_map(data) when is_map(data) do
    slot = parse_slot(data["slot"] || data[:slot])

    bonuses = data["bonuses"] || data[:bonuses] || %{}
    requirements = data["requirements"] || data[:requirements] || %{}

    %__MODULE__{
      slot: slot,
      bonuses: atomize_keys(bonuses),
      requirements: atomize_keys(requirements)
    }
  end

  defp parse_slot(slot) when is_atom(slot) and slot in @slots, do: slot
  defp parse_slot("head"), do: :head
  defp parse_slot("neck"), do: :neck
  defp parse_slot("torso"), do: :torso
  defp parse_slot("about"), do: :about
  defp parse_slot("arms"), do: :arms
  defp parse_slot("hands"), do: :hands
  defp parse_slot("waist"), do: :waist
  defp parse_slot("legs"), do: :legs
  defp parse_slot("feet"), do: :feet
  defp parse_slot("held"), do: :held
  defp parse_slot("wielded"), do: :wielded
  defp parse_slot("finger_left"), do: :finger_left
  defp parse_slot("finger_right"), do: :finger_right
  defp parse_slot("wrist_left"), do: :wrist_left
  defp parse_slot("wrist_right"), do: :wrist_right
  # Legacy slot mappings for backwards compatibility
  defp parse_slot("weapon"), do: :wielded
  defp parse_slot("armor"), do: :torso
  defp parse_slot("accessory"), do: :held
  defp parse_slot(_), do: :held

  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} ->
      key = if is_binary(k), do: String.to_existing_atom(k), else: k
      {key, v}
    end)
  rescue
    ArgumentError -> map
  end

  defp atomize_keys(other), do: other

  @doc """
  Returns a list of valid equipment slots.
  """
  def slots, do: @slots

  @doc """
  Returns true if the given slot is valid.
  """
  def valid_slot?(slot), do: slot in @slots

  @doc """
  Checks if a character meets the requirements to equip this item.
  Returns `true` if requirements are met, `{:error, missing_requirements}` otherwise.

  ## Parameters

  - `equipable` - The Equipable component to check
  - `character_stats` - Map of character stats (e.g., `%{str: 12, dex: 10, level: 3}`)
  """
  def meets_requirements?(%__MODULE__{requirements: requirements}, character_stats) do
    missing =
      requirements
      |> Enum.filter(fn {stat, required_value} ->
        Map.get(character_stats, stat, 0) < required_value
      end)
      |> Map.new()

    if map_size(missing) == 0 do
      true
    else
      {:error, missing}
    end
  end

  @doc """
  Returns the total bonus for a specific stat.
  """
  def get_bonus(%__MODULE__{bonuses: bonuses}, stat) do
    Map.get(bonuses, stat, 0)
  end
end
