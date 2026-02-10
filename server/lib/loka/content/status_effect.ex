defmodule Loka.Content.StatusEffect do
  @moduledoc """
  Status effect definition - OOC TypedObject.

  Status effects define buffs, debuffs, and neutral effects
  that can be applied to entities.
  """

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.{Loader, Registry}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Loader.get(key) do
      {:ok, %TypedObject{type: :status} = status} -> {:ok, status}
      {:ok, _} -> {:error, :not_found}
      error -> error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, status} -> status
      {:error, :not_found} -> raise "StatusEffect not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all, do: Registry.list_by_type(:status)

  @spec all_published() :: [TypedObject.t()]
  def all_published, do: Registry.list_by_type_published(:status)

  @spec by_type(String.t()) :: [TypedObject.t()]
  def by_type(type) when is_binary(type) do
    all_published()
    |> Enum.filter(fn status ->
      TypedObject.get_data(status, "type") == type
    end)
  end

  def effect_type(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "type", "neutral")

  def duration(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "duration")

  def stackable?(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "stackable", false)

  def effects(%TypedObject{type: :status} = status),
    do: TypedObject.get_data(status, "effects", [])
end
