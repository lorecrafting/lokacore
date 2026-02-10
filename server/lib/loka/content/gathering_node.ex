defmodule Loka.Content.GatheringNode do
  @moduledoc """
  Gathering node definition - OOC TypedObject.

  Gathering nodes define harvestable resources in the world
  with skill requirements and yield tables.
  """

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.{Loader, Registry}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Loader.get(key) do
      {:ok, %TypedObject{type: :gathering_node} = node} -> {:ok, node}
      {:ok, _} -> {:error, :not_found}
      error -> error
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
  def all, do: Registry.list_by_type(:gathering_node)

  @spec all_published() :: [TypedObject.t()]
  def all_published, do: Registry.list_by_type_published(:gathering_node)

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
end
