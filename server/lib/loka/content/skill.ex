defmodule Loka.Content.Skill do
  @moduledoc """
  Skill definition - OOC TypedObject.

  Skills define character progression paths with categories,
  prerequisites, and experience formulas.
  """

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.{Loader, Registry}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Loader.get(key) do
      {:ok, %TypedObject{type: :skill} = skill} -> {:ok, skill}
      {:ok, _} -> {:error, :not_found}
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
  def all, do: Registry.list_by_type(:skill)

  @spec all_published() :: [TypedObject.t()]
  def all_published, do: Registry.list_by_type_published(:skill)

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
    Registry.list_by_tag_published(tag)
    |> Enum.filter(&(&1.type == :skill))
  end

  def category(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "category", "general")

  def max_level(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "max_level", 100)

  def prerequisites(%TypedObject{type: :skill} = skill),
    do: TypedObject.get_data(skill, "prerequisites", [])
end
