defmodule Loka.Content.Skill do
  @moduledoc """
  Skill definition - OOC TypedObject.

  Skills define character progression paths with categories,
  prerequisites, and experience formulas.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :skill) do
      {:ok, entity} -> Entity.to_typed_object(entity)
      error -> error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, skill} -> skill
      {:error, :not_found} -> raise "Skill not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :skill, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :skill, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @spec by_category(String.t()) :: [TypedObject.t()]
  def by_category(category) when is_binary(category) do
    all_published()
    |> Enum.filter(fn skill ->
      cat = TypedObject.get_data(skill, "category")
      cat == category
    end)
  end

  @spec by_tag(String.t()) :: [TypedObject.t()]
  def by_tag(tag) when is_binary(tag) do
    Entities.find_all(type: :skill, tags: [tag], is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  def category(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "category", "general")

  def max_level(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "max_level", 100)

  def prerequisites(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "prerequisites", [])

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
