defmodule Exmud.DemoGame.Components.Equipable do
  @moduledoc """
  Component for items that can be equipped by players.

  Defines the equipment slot, stat bonuses, and requirements for the item.

  ## Fields

  - `slot` - Which equipment slot this item occupies (`:weapon`, `:armor`, `:accessory`)
  - `bonuses` - Map of stat bonuses granted when equipped
  - `requirements` - Map of stat requirements to equip this item

  ## Example

      %Equipable{
        slot: :weapon,
        bonuses: %{attack: 5, crit: 2},
        requirements: %{str: 15, level: 5}
      }
  """

  @type slot :: :weapon | :armor | :accessory
  @type t :: %__MODULE__{
          slot: slot(),
          bonuses: map(),
          requirements: map()
        }

  @slots [:weapon, :armor, :accessory]

  defstruct slot: :accessory,
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
    slot = case data["slot"] || data[:slot] do
      "weapon" -> :weapon
      "armor" -> :armor
      "accessory" -> :accessory
      atom when is_atom(atom) -> atom
      _ -> :accessory
    end

    bonuses = data["bonuses"] || data[:bonuses] || %{}
    requirements = data["requirements"] || data[:requirements] || %{}

    %__MODULE__{
      slot: slot,
      bonuses: atomize_keys(bonuses),
      requirements: atomize_keys(requirements)
    }
  end

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
