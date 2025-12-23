defmodule Exmud.Framework.Crafting.Recipe do
  @moduledoc """
  Recipe struct and parsing for the crafting system.

  Recipes define how to combine items to create new ones, including
  skill requirements, ingredients, tools, and success rates.

  ## Recipe Structure

      %Recipe{
        key: "recipe_health_potion",
        name: "Brew Health Potion",
        skill_required: "alchemy",
        skill_level: 2,
        ingredients: [%{item: "herb_healing", quantity: 2}],
        tools: ["alchemy_kit"],
        output: [%{item: "health_potion", quantity: 1}],
        xp_reward: %{skill: "alchemy", amount: 10},
        failure_chance: 0.1,
        failure_output: [%{item: "ruined_potion", quantity: 1}],
        time_required: 30,
        station_type: "alchemy_bench",
        description: "Combine healing herbs...",
        craft_message: "You carefully combine...",
        success_message: "Success!",
        failure_message: "The mixture is ruined."
      }

  ## Usage

      alias Exmud.Framework.Crafting.Recipe

      {:ok, recipe} = Recipe.from_map(yaml_data)
  """

  alias Exmud.Utils.MapHelpers

  @type ingredient :: %{item: String.t(), quantity: pos_integer()}
  @type output_item :: %{item: String.t(), quantity: pos_integer() | {pos_integer(), pos_integer()}, chance: float()}

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          skill_required: String.t() | nil,
          skill_level: non_neg_integer(),
          ingredients: [ingredient()],
          tools: [String.t()],
          output: [output_item()],
          xp_reward: map() | nil,
          failure_chance: float(),
          failure_output: [output_item()],
          time_required: non_neg_integer(),
          station_type: String.t() | nil,
          description: String.t(),
          craft_message: String.t(),
          success_message: String.t(),
          failure_message: String.t(),
          tags: [String.t()]
        }

  defstruct [
    :key,
    :name,
    skill_required: nil,
    skill_level: 0,
    ingredients: [],
    tools: [],
    output: [],
    xp_reward: nil,
    failure_chance: 0.0,
    failure_output: [],
    time_required: 0,
    station_type: nil,
    description: "",
    craft_message: "You begin crafting...",
    success_message: "You successfully craft the item!",
    failure_message: "Your crafting attempt fails.",
    tags: []
  ]

  @doc """
  Creates a Recipe struct from a map (typically loaded from YAML).

  Returns `{:ok, recipe}` or `{:error, reason}`.
  """
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, "key"),
         {:ok, name} <- require_field(data, "name") do
      recipe = %__MODULE__{
        key: key,
        name: name,
        skill_required: MapHelpers.get_flexible(data, :skill_required, nil),
        skill_level: MapHelpers.get_flexible(data, :skill_level, 0),
        ingredients: parse_ingredients(data),
        tools: parse_tools(data),
        output: parse_output(data),
        xp_reward: parse_xp_reward(data),
        failure_chance: MapHelpers.get_flexible(data, :failure_chance, 0.0),
        failure_output: parse_failure_output(data),
        time_required: MapHelpers.get_flexible(data, :time_required, 0),
        station_type: MapHelpers.get_flexible(data, :station_type, nil),
        description: MapHelpers.get_flexible(data, :description, ""),
        craft_message: MapHelpers.get_flexible(data, :craft_message, "You begin crafting..."),
        success_message: MapHelpers.get_flexible(data, :success_message, "You successfully craft the item!"),
        failure_message: MapHelpers.get_flexible(data, :failure_message, "Your crafting attempt fails."),
        tags: MapHelpers.get_flexible(data, :tags, [])
      }

      {:ok, recipe}
    end
  end

  defp require_field(data, field) do
    value = MapHelpers.get_flexible(data, String.to_atom(field), nil)

    if value do
      {:ok, value}
    else
      {:error, {:missing_field, field}}
    end
  end

  defp parse_ingredients(data) do
    ingredients = MapHelpers.get_flexible(data, :ingredients, [])

    Enum.map(ingredients, fn ing ->
      %{
        item: MapHelpers.get_flexible(ing, :item, ""),
        quantity: MapHelpers.get_flexible(ing, :quantity, 1)
      }
    end)
  end

  defp parse_tools(data) do
    MapHelpers.get_flexible(data, :tools, [])
  end

  defp parse_output(data) do
    output = MapHelpers.get_flexible(data, :output, [])

    Enum.map(output, fn out ->
      quantity = MapHelpers.get_flexible(out, :quantity, 1)

      %{
        item: MapHelpers.get_flexible(out, :item, ""),
        quantity: parse_quantity(quantity),
        chance: MapHelpers.get_flexible(out, :chance, 1.0)
      }
    end)
  end

  defp parse_failure_output(data) do
    output = MapHelpers.get_flexible(data, :failure_output, [])

    Enum.map(output, fn out ->
      quantity = MapHelpers.get_flexible(out, :quantity, 1)

      %{
        item: MapHelpers.get_flexible(out, :item, ""),
        quantity: parse_quantity(quantity),
        chance: MapHelpers.get_flexible(out, :chance, 1.0)
      }
    end)
  end

  defp parse_quantity(quantity) when is_list(quantity) and length(quantity) == 2 do
    [min, max] = quantity
    {min, max}
  end

  defp parse_quantity(quantity) when is_integer(quantity), do: quantity
  defp parse_quantity(_), do: 1

  defp parse_xp_reward(data) do
    case MapHelpers.get_flexible(data, :xp_reward, nil) do
      nil -> nil
      reward when is_map(reward) ->
        %{
          skill: MapHelpers.get_flexible(reward, :skill, nil),
          amount: MapHelpers.get_flexible(reward, :amount, 0)
        }
      _ -> nil
    end
  end

  @doc """
  Checks if a recipe requires a specific crafting station.
  """
  def requires_station?(%__MODULE__{station_type: nil}), do: false
  def requires_station?(%__MODULE__{}), do: true

  @doc """
  Checks if a recipe has any failure chance.
  """
  def can_fail?(%__MODULE__{failure_chance: chance}) when chance > 0, do: true
  def can_fail?(%__MODULE__{}), do: false

  @doc """
  Checks if a recipe requires any skill.
  """
  def requires_skill?(%__MODULE__{skill_required: nil}), do: false
  def requires_skill?(%__MODULE__{}), do: true

  @doc """
  Calculates the actual output quantity for a recipe item.
  Handles both fixed quantities and random ranges.
  """
  def calculate_quantity({min, max}) when is_integer(min) and is_integer(max) do
    Enum.random(min..max)
  end

  def calculate_quantity(quantity) when is_integer(quantity), do: quantity
  def calculate_quantity(_), do: 1
end
