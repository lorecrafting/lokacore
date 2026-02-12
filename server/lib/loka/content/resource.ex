defmodule Loka.Content.Resource do
  @moduledoc """
  Resource definition - OOC TypedObject.

  Resources define pools like health, mana, and energy
  with max formulas and regeneration rules.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :resource) do
      {:ok, entity} ->
        case Entity.to_typed_object(entity) do
          {:ok, %TypedObject{type: :resource} = resource} -> {:ok, resource}
          _ -> {:error, :not_found}
        end

      error ->
        error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, resource} -> resource
      {:error, :not_found} -> raise "Resource not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :resource, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :resource, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @spec regenerating() :: [TypedObject.t()]
  def regenerating do
    all_published()
    |> Enum.filter(fn resource ->
      rate = TypedObject.get_data(resource, "regen_rate", 0)
      condition = TypedObject.get_data(resource, "regen_condition", "never")
      rate > 0 and condition != "never"
    end)
  end

  def max_formula(%TypedObject{type: :resource} = resource),
    do: TypedObject.get_data(resource, "max_formula", "100")

  def regen_rate(%TypedObject{type: :resource} = resource),
    do: TypedObject.get_data(resource, "regen_rate", 0)

  def regen_condition(%TypedObject{type: :resource} = resource),
    do: TypedObject.get_data(resource, "regen_condition", "never")

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
