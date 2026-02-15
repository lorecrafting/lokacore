defmodule Loka.Content.Resource do
  @moduledoc """
  Resource definition - OOC Entity.

  Resources define pools like health, mana, and energy
  with max formulas and regeneration rules.
  """

  alias Loka.Engine.{Entity, Entities}

  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :resource) do
      {:ok, %Entity{type: :resource}} = result -> result
      {:ok, _} -> {:error, :not_found}
      error -> error
    end
  end

  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, resource} -> resource
      {:error, :not_found} -> raise "Resource not found: #{key}"
    end
  end

  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :resource, is_prototype: true)
  end

  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :resource, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @spec regenerating() :: [Entity.t()]
  def regenerating do
    all_published()
    |> Enum.filter(fn resource ->
      rate = get_data(resource, "regen_rate", 0)
      condition = get_data(resource, "regen_condition", "never")
      rate > 0 and condition != "never"
    end)
  end

  def max_formula(%Entity{type: :resource} = resource),
    do: get_data(resource, "max_formula", "100")

  def regen_rate(%Entity{type: :resource} = resource),
    do: get_data(resource, "regen_rate", 0)

  def regen_condition(%Entity{type: :resource} = resource),
    do: get_data(resource, "regen_condition", "never")

  def starts_full(%Entity{type: :resource} = resource),
    do: get_data(resource, "starts_full", true)

  def min_value(%Entity{type: :resource} = resource),
    do: get_data(resource, "min_value", 0)

  def hidden(%Entity{type: :resource} = resource),
    do: get_data(resource, "hidden", false)

  @doc "Checks if a resource regenerates automatically."
  def regenerates?(%Entity{type: :resource} = resource) do
    rate = regen_rate(resource)
    condition = regen_condition(resource)
    rate > 0 and condition != "never"
  end

  @doc "Checks if resource should regenerate given the current context."
  def should_regen?(%Entity{type: :resource} = resource, context) do
    condition = regen_condition(resource)
    in_combat = Map.get(context, :in_combat, false)
    resting = Map.get(context, :resting, false)

    case to_string(condition) do
      "always" -> true
      "never" -> false
      "out_of_combat" -> not in_combat
      "in_combat" -> in_combat
      "resting" -> resting
      _ -> true
    end
  end

  defp get_data(%Entity{} = entity, field, default) do
    data = entity.components["data"] || %{}
    val = Map.get(data, field)
    if is_nil(val), do: default, else: val
  end
end
