defmodule Loka.Content.Recipe do
  @moduledoc """
  Recipe definition - OOC TypedObject.

  Recipes define crafting requirements, ingredients, tools,
  and output items.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

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
