defmodule Loka.Content.Storyline do
  @moduledoc """
  Storyline definition - OOC TypedObject.

  Storylines organize quests into acts with progression tracking.
  """

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.{Loader, Registry}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Loader.get(key) do
      {:ok, %TypedObject{type: :storyline} = storyline} -> {:ok, storyline}
      {:ok, _} -> {:error, :not_found}
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
  def all, do: Registry.list_by_type(:storyline)

  @spec all_published() :: [TypedObject.t()]
  def all_published, do: Registry.list_by_type_published(:storyline)

  @spec by_tag(String.t()) :: [TypedObject.t()]
  def by_tag(tag) when is_binary(tag) do
    Registry.list_by_tag_published(tag)
    |> Enum.filter(&(&1.type == :storyline))
  end

  def acts(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "acts", [])

  def side_quests(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "side_quests", [])

  def main_quests(%TypedObject{type: :storyline} = storyline),
    do: TypedObject.get_data(storyline, "main_quests", [])
end
