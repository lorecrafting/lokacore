defmodule Loka.Content.StatusEffect do
  @moduledoc """
  Status effect definition - OOC TypedObject.

  Status effects define buffs, debuffs, and neutral effects
  that can be applied to entities.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :status) do
      {:ok, entity} ->
        case Entity.to_typed_object(entity) do
          {:ok, %TypedObject{type: :status} = status} -> {:ok, status}
          _ -> {:error, :not_found}
        end

      error ->
        error
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
  def all do
    Entities.find_all(type: :status, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :status, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

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
