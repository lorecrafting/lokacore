defmodule Loka.Content.Storyline do
  @moduledoc """
  Storyline definition - OOC TypedObject.

  Storylines organize quests into acts with progression tracking.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :storyline) do
      {:ok, entity} -> Entity.to_typed_object(entity)
      error -> error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, storyline} -> storyline
      {:error, :not_found} -> raise "Storyline not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :storyline, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :storyline, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @spec by_tag(String.t()) :: [TypedObject.t()]
  def by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :storyline, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  def acts(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "acts", [])

  def side_quests(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "side_quests", [])

  def main_quests(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "main_quests", [])

  defp to_typed_objects(entities) do
    entities
    |> Enum.flat_map(fn entity ->
      case Entity.to_typed_object(entity) do
        {:ok, typed_object} -> [typed_object]
        {:error, _} -> []
      end
    end)
  end
end
