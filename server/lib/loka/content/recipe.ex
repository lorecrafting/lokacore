defmodule Loka.Content.Recipe do
  @moduledoc """
  Recipe definition - OOC TypedObject.

  Recipes define crafting requirements, ingredients, tools,
  and output items.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}
  alias Loka.Utils.MapHelpers

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :recipe) do
      {:ok, entity} ->
        case Entity.to_typed_object(entity) do
          {:ok, %TypedObject{type: :recipe} = recipe} -> {:ok, recipe}
          _ -> {:error, :not_found}
        end

      error ->
        error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, recipe} -> recipe
      {:error, :not_found} -> raise "Recipe not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :recipe, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :recipe, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @spec by_skill(String.t()) :: [TypedObject.t()]
  def by_skill(skill_key) when is_binary(skill_key) do
    all_published()
    |> Enum.filter(fn recipe ->
      TypedObject.get_data(recipe, "skill_required") == skill_key
    end)
  end

  @spec by_station(String.t()) :: [TypedObject.t()]
  def by_station(station_type) when is_binary(station_type) do
    all_published()
    |> Enum.filter(fn recipe ->
      TypedObject.get_data(recipe, "station_type") == station_type
    end)
  end

  def ingredients(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "ingredients", [])

  def skill_required(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "skill_required")

  def station_type(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "station_type")

  def output(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "output", [])

  def skill_level(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "skill_level", 0)

  def tools(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "tools", [])

  def resource_costs(%TypedObject{type: :recipe} = recipe) do
    costs = TypedObject.get_data(recipe, "resource_costs", %{})

    Map.new(costs, fn {key, value} ->
      atom_key = if is_atom(key), do: key, else: String.to_atom(key)
      {atom_key, value}
    end)
  end

  def failure_chance(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "failure_chance", 0.0)

  def failure_output(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "failure_output", [])

  def success_message(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "success_message", "You successfully craft the item!")

  def failure_message(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "failure_message", "Your crafting attempt fails.")

  def xp_reward(%TypedObject{type: :recipe} = recipe),
    do: TypedObject.get_data(recipe, "xp_reward")

  @doc """
  Checks if a recipe requires any skill.
  """
  def requires_skill?(%TypedObject{type: :recipe} = recipe),
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
  @spec available_for(map()) :: [TypedObject.t()]
  def available_for(game_state) do
    skills =
      MapHelpers.get_flexible(game_state.stats || %{}, :skills, %{})

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

  defp to_typed_objects(entities) do
    entities
    |> Enum.map(fn entity ->
      case Entity.to_typed_object(entity) do
        {:ok, to} -> to
        _ -> nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end
end
