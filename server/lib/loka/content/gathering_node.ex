defmodule Loka.Content.GatheringNode do
  @moduledoc """
  Gathering node definition - OOC TypedObject.

  Gathering nodes define harvestable resources in the world
  with skill requirements and yield tables.
  """

  alias Loka.Engine.{Entity, Entities, TypedObject}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :gathering_node) do
      {:ok, entity} ->
        case Entity.to_typed_object(entity) do
          {:ok, %TypedObject{type: :gathering_node} = node} -> {:ok, node}
          _ -> {:error, :not_found}
        end

      error ->
        error
    end
  end

  @spec get!(String.t()) :: TypedObject.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, node} -> node
      {:error, :not_found} -> raise "GatheringNode not found: #{key}"
    end
  end

  @spec all() :: [TypedObject.t()]
  def all do
    Entities.find_all(type: :gathering_node, is_prototype: true)
    |> to_typed_objects()
  end

  @spec all_published() :: [TypedObject.t()]
  def all_published do
    Entities.find_all(type: :gathering_node, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
    |> to_typed_objects()
  end

  @spec by_skill(String.t()) :: [TypedObject.t()]
  def by_skill(skill_key) when is_binary(skill_key) do
    all_published()
    |> Enum.filter(fn node ->
      TypedObject.get_data(node, "skill_required") == skill_key
    end)
  end

  def skill_required(%TypedObject{type: :gathering_node} = node),
    do: TypedObject.get_data(node, "skill_required")

  def yields(%TypedObject{type: :gathering_node} = node),
    do: TypedObject.get_data(node, "yields", [])

  def respawn_time(%TypedObject{type: :gathering_node} = node),
    do: TypedObject.get_data(node, "respawn_time", 300)

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
