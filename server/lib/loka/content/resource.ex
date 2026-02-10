defmodule Loka.Content.Resource do
  @moduledoc """
  Resource definition - OOC TypedObject.

  Resources define pools like health, mana, and energy
  with max formulas and regeneration rules.
  """

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.{Loader, Registry}

  @spec get(String.t()) :: {:ok, TypedObject.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Loader.get(key) do
      {:ok, %TypedObject{type: :resource} = resource} -> {:ok, resource}
      {:ok, _} -> {:error, :not_found}
      error -> error
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
  def all, do: Registry.list_by_type(:resource)

  @spec all_published() :: [TypedObject.t()]
  def all_published, do: Registry.list_by_type_published(:resource)

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
end
