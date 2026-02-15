defmodule Loka.Content.Recipe do
  @moduledoc """
  Recipe definition - OOC Entity.

  Recipes define crafting requirements, ingredients, tools,
  and output items.
  """

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Utils.MapHelpers

  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :recipe) do
      {:ok, %Entity{type: :recipe}} = result -> result
      {:ok, _} -> {:error, :not_found}
      error -> error
    end
  end

  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, recipe} -> recipe
      {:error, :not_found} -> raise "Recipe not found: #{key}"
    end
  end

  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :recipe, is_prototype: true)
  end

  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :recipe, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @spec by_skill(String.t()) :: [Entity.t()]
  def by_skill(skill_key) when is_binary(skill_key) do
    all_published()
    |> Enum.filter(fn recipe ->
      get_data(recipe, "skill_required") == skill_key
    end)
  end

  @spec by_station(String.t()) :: [Entity.t()]
  def by_station(station_type) when is_binary(station_type) do
    all_published()
    |> Enum.filter(fn recipe ->
      get_data(recipe, "station_type") == station_type
    end)
  end

  def ingredients(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "ingredients", [])

  def skill_required(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "skill_required")

  def station_type(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "station_type")

  def output(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "output", [])

  def skill_level(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "skill_level", 0)

  def tools(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "tools", [])

  def resource_costs(%Entity{type: :recipe} = recipe) do
    costs = get_data(recipe, "resource_costs", %{})

    Map.new(costs, fn {key, value} ->
      atom_key = if is_atom(key), do: key, else: String.to_atom(key)
      {atom_key, value}
    end)
  end

  def failure_chance(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "failure_chance", 0.0)

  def failure_output(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "failure_output", [])

  def success_message(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "success_message", "You successfully craft the item!")

  def failure_message(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "failure_message", "Your crafting attempt fails.")

  def xp_reward(%Entity{type: :recipe} = recipe),
    do: get_data(recipe, "xp_reward")

  @doc """
  Checks if a recipe requires any skill.
  """
  def requires_skill?(%Entity{type: :recipe} = recipe),
    do: skill_required(recipe) != nil

  @doc """
  Calculates the actual output quantity for a recipe item.
  Handles both fixed quantities and random ranges.
  """
  def calculate_quantity({min, max}) when is_integer(min) and is_integer(max) do
    Enum.random(min..max)
  end

  def calculate_quantity([min, max]) when is_integer(min) and is_integer(max) do
    Enum.random(min..max)
  end

  def calculate_quantity(quantity) when is_integer(quantity), do: quantity
  def calculate_quantity(_), do: 1

  @doc """
  Lists recipes available for a player based on their skill levels.
  """
  @spec available_for(map()) :: [Entity.t()]
  def available_for(game_state) do
    stats = Entity.get_component(game_state, "stats") || %{}
    skills = MapHelpers.get_flexible(stats, :skills, %{})

    all_published()
    |> Enum.filter(fn recipe -> meets_skill_requirements?(recipe, skills) end)
  end

  defp meets_skill_requirements?(recipe, skills) do
    case skill_required(recipe) do
      nil ->
        true

      skill ->
        level = skill_level(recipe)

        player_level =
          cond do
            is_atom(skill) ->
              MapHelpers.get_flexible(skills, skill, 0)

            is_binary(skill) ->
              case Map.get(skills, skill) do
                nil ->
                  case MapHelpers.safe_to_existing_atom(skill) do
                    nil -> 0
                    atom_key -> Map.get(skills, atom_key, 0)
                  end

                value ->
                  value
              end

            true ->
              0
          end

        player_level >= level
    end
  end

  defp get_data(%Entity{} = entity, field, default \\ nil) do
    data = entity.components["data"] || %{}
    val = Map.get(data, field)
    if is_nil(val), do: default, else: val
  end
end
