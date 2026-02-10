defmodule Loka.Content.Cutscene do
  @moduledoc """
  Cutscene definition - OOC TypedObject.

  Cutscenes define scripted sequences for major story moments.
  """

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.{Loader, Registry}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Loader.get(key) do
      {:ok, %TypedObject{type: :cutscene} = cutscene} -> {:ok, cutscene}
      {:ok, _} -> {:error, :not_found}
      error -> error
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
  def all, do: Registry.list_by_type(:cutscene)

  @spec all_published() :: [TypedObject.t()]
  def all_published, do: Registry.list_by_type_published(:cutscene)

  def scenes(%TypedObject{type: :cutscene} = cutscene),
    do: TypedObject.get_data(cutscene, "scenes", [])

  def speakers(%TypedObject{type: :cutscene} = cutscene),
    do: TypedObject.get_data(cutscene, "speakers", [])
end
