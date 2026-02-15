defmodule Loka.Content.GatheringNode do
  @moduledoc """
  Gathering node definition - OOC Entity.

  Gathering nodes define harvestable resources in the world
  with skill requirements and yield tables.
  """

  alias Loka.Engine.{Entity, Entities}

  @spec get(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
  def get(key) when is_binary(key) do
    case Entities.find_one(key: key, type: :gathering_node) do
      {:ok, %Entity{type: :gathering_node}} = result -> result
      {:ok, _} -> {:error, :not_found}
      error -> error
    end
  end

  @spec get!(String.t()) :: Entity.t()
  def get!(key) when is_binary(key) do
    case get(key) do
      {:ok, node} -> node
      {:error, :not_found} -> raise "GatheringNode not found: #{key}"
    end
  end

  @spec all() :: [Entity.t()]
  def all do
    Entities.find_all(type: :gathering_node, is_prototype: true)
  end

  @spec all_published() :: [Entity.t()]
  def all_published do
    Entities.find_all(type: :gathering_node, is_prototype: true)
    |> Enum.reject(&Entity.draft?/1)
  end

  @spec by_skill(String.t()) :: [Entity.t()]
  def by_skill(skill_key) when is_binary(skill_key) do
    all_published()
    |> Enum.filter(fn node ->
      get_data(node, "skill_required") == skill_key
    end)
  end

  def skill_required(%Entity{type: :gathering_node} = node),
    do: get_data(node, "skill_required")

  def yields(%Entity{type: :gathering_node} = node),
    do: get_data(node, "yields", [])

  def respawn_time(%Entity{type: :gathering_node} = node),
    do: get_data(node, "respawn_time", 300)

  def skill_level(%Entity{type: :gathering_node} = node),
    do: get_data(node, "skill_level", 0)

  def uses_per_respawn(%Entity{type: :gathering_node} = node),
    do: get_data(node, "uses_per_respawn", 1)

  def tool_required(%Entity{type: :gathering_node} = node),
    do: get_data(node, "tool_required")

  def xp_reward(%Entity{type: :gathering_node} = node),
    do: get_data(node, "xp_reward")

  def success_message(%Entity{type: :gathering_node} = node),
    do: get_data(node, "success_message", "You find something useful!")

  def failure_message(%Entity{type: :gathering_node} = node),
    do: get_data(node, "failure_message", "You find nothing of value.")

  def exhausted_message(%Entity{type: :gathering_node} = node),
    do: get_data(node, "exhausted_message", "This resource has been depleted.")

  def requires_skill?(%Entity{type: :gathering_node} = node),
    do: skill_required(node) != nil

  def requires_tool?(%Entity{type: :gathering_node} = node),
    do: tool_required(node) != nil

  @doc "Rolls for yields from a node, returning items based on chance."
  def roll_yields(%Entity{type: :gathering_node} = node) do
    alias Loka.Primitives.Roll

    yields(node)
    |> Enum.filter(fn yield_data ->
      chance = Map.get(yield_data, "chance", 1.0)
      target_percent = round(chance * 100)
      {:ok, result, _audit} = Roll.check(target_percent)
      result.success
    end)
    |> Enum.map(fn yield_data ->
      item = Map.get(yield_data, "item", "")
      quantity = Map.get(yield_data, "quantity", 1)
      %{item: item, quantity: calculate_quantity(quantity)}
    end)
  end

  defp calculate_quantity(quantity) when is_integer(quantity), do: quantity

  defp calculate_quantity([min, max]) when is_integer(min) and is_integer(max) do
    alias Loka.Primitives.Roll
    {:ok, result, _audit} = Roll.range(min, max)
    result.value
  end

  defp calculate_quantity(_), do: 1

  defp get_data(%Entity{} = entity, field, default \\ nil) do
    data = entity.components["data"] || %{}
    val = Map.get(data, field)
    if is_nil(val), do: default, else: val
  end
end
