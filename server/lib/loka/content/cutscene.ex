defmodule Loka.Content.Cutscene do
  @moduledoc """
  Cutscene definition - OOC TypedObject.

  Cutscenes define scripted sequences for major story moments.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, entity} ->
        case Entity.to_typed_object(entity) do
          {:ok, %TypedObject{type: :cutscene} = cutscene} -> {:ok, cutscene}
          _ -> {:error, :not_found}
        end

      error ->
        error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, cutscene} -> cutscene
      {:error, :not_found} -> raise "Cutscene not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :cutscene, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :cutscene, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  def scenes(%TypedObject{type: :cutscene} = cutscene),
    do: TypedObject.get_data(cutscene, "scenes", [])

  def speakers(%TypedObject{type: :cutscene} = cutscene),
    do: TypedObject.get_data(cutscene, "speakers", [])

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
