defmodule Exmud.Framework.Gathering.GatheringNode do
  @moduledoc """
  Gathering node definition struct and parsing.

  Gathering nodes are resource points in the world that players can harvest
  for materials. Each node has skill requirements, yields, and respawn timers.

  ## Node Structure

      %GatheringNode{
        key: "herb_patch",
        name: "Herb Patch",
        skill_required: "herbalism",
        skill_level: 1,
        yields: [%{item: "herb_healing", chance: 0.6, quantity: {1, 3}}],
        respawn_time: 300,
        uses_per_respawn: 3,
        tool_required: "gathering_knife",
        xp_reward: %{skill: "herbalism", amount: 5},
        gather_message: "You carefully harvest...",
        success_message: "You find some useful herbs!",
        failure_message: "You find nothing of value.",
        exhausted_message: "The herb patch has been picked clean."
      }

  ## Node Types

  - **Herbalism**: Plants, mushrooms, flowers
  - **Mining**: Ore veins, gems, stone
  - **Fishing**: Fish spots
  - **Foraging**: Wild food, materials
  - **Logging**: Trees for wood
  """

  alias Exmud.Utils.MapHelpers

  @type yield :: %{
          item: String.t(),
          chance: float(),
          quantity: pos_integer() | {pos_integer(), pos_integer()}
        }

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          skill_required: String.t() | nil,
          skill_level: non_neg_integer(),
          yields: [yield()],
          respawn_time: non_neg_integer(),
          uses_per_respawn: pos_integer(),
          tool_required: String.t() | nil,
          xp_reward: map() | nil,
          gather_message: String.t(),
          success_message: String.t(),
          failure_message: String.t(),
          exhausted_message: String.t(),
          tags: [String.t()]
        }

  defstruct [
    :key,
    :name,
    skill_required: nil,
    skill_level: 0,
    yields: [],
    respawn_time: 300,
    uses_per_respawn: 1,
    tool_required: nil,
    xp_reward: nil,
    gather_message: "You gather from the node.",
    success_message: "You find something useful!",
    failure_message: "You find nothing of value.",
    exhausted_message: "This resource has been depleted.",
    tags: []
  ]

  @doc """
  Creates a GatheringNode struct from a map (typically loaded from YAML).

  Returns `{:ok, node}` or `{:error, reason}`.
  """
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, "key"),
         {:ok, name} <- require_field(data, "name") do
      node = %__MODULE__{
        key: key,
        name: name,
        skill_required: MapHelpers.get_flexible(data, :skill_required, nil),
        skill_level: MapHelpers.get_flexible(data, :skill_level, 0),
        yields: parse_yields(data),
        respawn_time: MapHelpers.get_flexible(data, :respawn_time, 300),
        uses_per_respawn: MapHelpers.get_flexible(data, :uses_per_respawn, 1),
        tool_required: MapHelpers.get_flexible(data, :tool_required, nil),
        xp_reward: parse_xp_reward(data),
        gather_message: MapHelpers.get_flexible(data, :gather_message, "You gather from the node."),
        success_message: MapHelpers.get_flexible(data, :success_message, "You find something useful!"),
        failure_message: MapHelpers.get_flexible(data, :failure_message, "You find nothing of value."),
        exhausted_message: MapHelpers.get_flexible(data, :exhausted_message, "This resource has been depleted."),
        tags: MapHelpers.get_flexible(data, :tags, [])
      }

      {:ok, node}
    end
  end

  defp require_field(data, field) do
    value = MapHelpers.get_flexible(data, String.to_atom(field), nil)

    if value do
      {:ok, value}
    else
      {:error, {:missing_field, field}}
    end
  end

  defp parse_yields(data) do
    yields = MapHelpers.get_flexible(data, :yields, [])

    Enum.map(yields, fn yield_data ->
      quantity = MapHelpers.get_flexible(yield_data, :quantity, 1)

      %{
        item: MapHelpers.get_flexible(yield_data, :item, ""),
        chance: MapHelpers.get_flexible(yield_data, :chance, 1.0),
        quantity: parse_quantity(quantity)
      }
    end)
  end

  defp parse_quantity(quantity) when is_list(quantity) and length(quantity) == 2 do
    [min, max] = quantity
    {min, max}
  end

  defp parse_quantity(quantity) when is_integer(quantity), do: quantity
  defp parse_quantity(_), do: 1

  defp parse_xp_reward(data) do
    case MapHelpers.get_flexible(data, :xp_reward, nil) do
      nil -> nil
      reward when is_map(reward) ->
        %{
          skill: MapHelpers.get_flexible(reward, :skill, nil),
          amount: MapHelpers.get_flexible(reward, :amount, 0)
        }
      _ -> nil
    end
  end

  @doc """
  Calculates the actual yield quantity for a gathered item.
  Handles both fixed quantities and random ranges.
  """
  def calculate_quantity({min, max}) when is_integer(min) and is_integer(max) do
    Enum.random(min..max)
  end

  def calculate_quantity(quantity) when is_integer(quantity), do: quantity
  def calculate_quantity(_), do: 1

  @doc """
  Checks if a node requires a specific skill.
  """
  def requires_skill?(%__MODULE__{skill_required: nil}), do: false
  def requires_skill?(%__MODULE__{}), do: true

  @doc """
  Checks if a node requires a tool.
  """
  def requires_tool?(%__MODULE__{tool_required: nil}), do: false
  def requires_tool?(%__MODULE__{}), do: true

  @doc """
  Rolls for yields from a node, returning items based on chance.
  """
  def roll_yields(%__MODULE__{yields: yields}) do
    yields
    |> Enum.filter(fn %{chance: chance} ->
      :rand.uniform() <= chance
    end)
    |> Enum.map(fn %{item: item, quantity: quantity} ->
      %{item: item, quantity: calculate_quantity(quantity)}
    end)
  end
end
