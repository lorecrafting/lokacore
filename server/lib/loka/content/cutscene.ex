defmodule Loka.Content.Cutscene do
  @moduledoc """
  Cutscene definition - OOC Entity.

  Cutscenes define scripted sequences for major story moments.
  """

  alias Loka.Engine.{Entity, Entities}

  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :cutscene) do
      {:ok, %Entity{type: :cutscene}} = result -> result
      {:ok, _} -> {:error, :not_found}
      error -> error
    end
  end

  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, cutscene} -> cutscene
      {:error, :not_found} -> raise "Cutscene not found: #{key}"
    end
  end

  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :cutscene, is_prototype: true)
  end

  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :cutscene, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  def scenes(%Entity{type: :cutscene} = cutscene),
    do: get_data(cutscene, "scenes", [])

  def speakers(%Entity{type: :cutscene} = cutscene),
    do: get_data(cutscene, "speakers", [])

  defp get_data(%Entity{} = entity, field, default) do
    data = entity.components["data"] || %{}
    val = Map.get(data, field)
    if is_nil(val), do: default, else: val
  end
end
