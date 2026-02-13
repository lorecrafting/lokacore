defmodule Loka.Framework.Crafting.CraftingStation do
  @moduledoc """
  Crafting station component behavior for rooms.

  Crafting stations are placed in rooms and enable specific types of recipes.
  Different station types (forge, alchemy bench, kitchen, etc.) unlock
  different sets of recipes and may provide quality bonuses.

  ## Station Configuration (in room prototype YAML)

      components:
        crafting_station:
          type: forge
          bonus: 0.05
          recipes_enabled:
            - recipe_iron_sword
            - recipe_steel_sword

  ## Station Types

  - `forge` - Metalworking, weapons, armor
  - `alchemy_bench` - Potions, elixirs, transmutation
  - `workbench` - General crafting, woodworking
  - `kitchen` - Food, drinks, cooking
  - `loom` - Textiles, clothing
  - `anvil` - Heavy metalwork
  - `enchanting_table` - Magical item creation

  ## Usage

      alias Loka.Framework.Crafting.CraftingStation

      # Check if room has a station
      case CraftingStation.get_station(room_entity) do
        nil -> "No crafting station here"
        station -> "Found a \#{station.type}"
      end

      # Get available recipes at station
      recipes = CraftingStation.get_available_recipes(room_entity)

      # Get station quality bonus
      bonus = CraftingStation.get_bonus(room_entity)
  """

  alias Loka.Content.Recipe, as: ContentRecipe
  alias Loka.Utils.MapHelpers

  @type t :: %__MODULE__{
          type: String.t(),
          bonus: float(),
          recipes_enabled: [String.t()] | :all,
          name: String.t(),
          description: String.t()
        }

  defstruct [
    :type,
    bonus: 0.0,
    recipes_enabled: :all,
    name: "Crafting Station",
    description: "A place to craft items."
  ]

  @valid_station_types [
    "forge",
    "alchemy_bench",
    "workbench",
    "kitchen",
    "loom",
    "anvil",
    "enchanting_table",
    "tanning_rack",
    "smelter",
    "sawmill"
  ]

  @doc """
  Gets the crafting station from a room entity.

  Returns the station struct or nil if no station exists.
  """
  def get_station(nil), do: nil

  def get_station(room_entity) do
    components = Map.get(room_entity, :components, %{})
    station_data = MapHelpers.get_flexible(components, :crafting_station, nil)

    case station_data do
      nil -> nil
      data -> from_component(data)
    end
  end

  @doc """
  Parses a crafting station from component data.
  """
  def from_component(data) when is_map(data) do
    type = MapHelpers.get_flexible(data, :type, "workbench")

    %__MODULE__{
      type: type,
      bonus: MapHelpers.get_flexible(data, :bonus, 0.0),
      recipes_enabled: parse_recipes_enabled(data),
      name: MapHelpers.get_flexible(data, :name, default_name(type)),
      description: MapHelpers.get_flexible(data, :description, default_description(type))
    }
  end

  def from_component(_), do: nil

  @doc """
  Gets all recipes available at a station.

  If the station has specific recipes_enabled, returns only those.
  Otherwise returns all recipes for the station type.
  """
  def get_available_recipes(room_entity) do
    case get_station(room_entity) do
      nil ->
        []

      %__MODULE__{recipes_enabled: :all, type: type} ->
        ContentRecipe.by_station(type)

      %__MODULE__{recipes_enabled: recipe_keys} when is_list(recipe_keys) ->
        recipe_keys
        |> Enum.map(&ContentRecipe.get/1)
        |> Enum.filter(&match?({:ok, _}, &1))
        |> Enum.map(fn {:ok, recipe} -> recipe end)
    end
  end

  @doc """
  Gets the quality bonus from a station.

  The bonus reduces failure chance for crafting.
  """
  def get_bonus(room_entity) do
    case get_station(room_entity) do
      nil -> 0.0
      %__MODULE__{bonus: bonus} -> bonus
    end
  end

  @doc """
  Checks if a room has a specific station type.
  """
  def has_station_type?(room_entity, station_type) do
    case get_station(room_entity) do
      nil -> false
      %__MODULE__{type: type} -> type == station_type
    end
  end

  @doc """
  Checks if a station can craft a specific recipe.
  """
  def can_craft_recipe?(room_entity, recipe_key) do
    case get_station(room_entity) do
      nil ->
        false

      %__MODULE__{recipes_enabled: :all, type: type} ->
        case ContentRecipe.get(recipe_key) do
          {:ok, recipe} ->
            station = ContentRecipe.station_type(recipe)
            station == type or station == nil

          {:error, _} ->
            false
        end

      %__MODULE__{recipes_enabled: recipe_keys} ->
        recipe_key in recipe_keys
    end
  end

  @doc """
  Returns the list of valid station types.
  """
  def valid_station_types, do: @valid_station_types

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp parse_recipes_enabled(data) do
    case MapHelpers.get_flexible(data, :recipes_enabled, nil) do
      nil -> :all
      "all" -> :all
      recipes when is_list(recipes) -> recipes
      _ -> :all
    end
  end

  defp default_name(type) do
    type
    |> String.replace("_", " ")
    |> String.split()
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp default_description("forge"), do: "A blazing forge for metalwork."
  defp default_description("alchemy_bench"), do: "A cluttered bench with bubbling vials."
  defp default_description("workbench"), do: "A sturdy wooden workbench."
  defp default_description("kitchen"), do: "A well-equipped kitchen."
  defp default_description("loom"), do: "A wooden loom for weaving textiles."
  defp default_description("anvil"), do: "A heavy iron anvil."
  defp default_description("enchanting_table"), do: "A mystical table humming with power."
  defp default_description("tanning_rack"), do: "A wooden rack for curing leather."
  defp default_description("smelter"), do: "A furnace for smelting ore."
  defp default_description("sawmill"), do: "Equipment for processing lumber."
  defp default_description(_), do: "A crafting station."
end
