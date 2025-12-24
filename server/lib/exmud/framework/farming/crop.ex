defmodule Exmud.Framework.Farming.Crop do
  @moduledoc """
  Crop definition struct and parsing for the farming system.

  Crops are plants that can be grown in farm plots over time,
  progressing through growth stages until harvestable.

  ## Crop Structure

      %Crop{
        key: "wheat_crop",
        name: "Wheat",
        seed_item: "wheat_seeds",
        growth_stages: [
          %{stage: "planted", duration: 300, description: "Seeds freshly planted."},
          %{stage: "sprouting", duration: 600, description: "Small green shoots."},
          %{stage: "harvestable", duration: nil, description: "Golden wheat ready."}
        ],
        harvest_yield: [%{item: "wheat", quantity: {3, 6}, chance: 1.0}],
        requires_water: true,
        can_wither: true,
        wither_time: 1800,
        skill_required: "farming",
        xp_reward: %{skill: "farming", amount: 15}
      }

  ## Growth Stages

  Crops progress through stages over time. Each stage has:
  - `stage` - Stage name (planted, sprouting, growing, harvestable)
  - `duration` - Seconds until next stage (nil = final stage)
  - `description` - What the player sees
  """

  alias Exmud.Utils.MapHelpers

  @type growth_stage :: %{
          stage: String.t(),
          duration: non_neg_integer() | nil,
          description: String.t()
        }

  @type yield :: %{
          item: String.t(),
          quantity: pos_integer() | {pos_integer(), pos_integer()},
          chance: float()
        }

  @type t :: %__MODULE__{
          key: String.t(),
          name: String.t(),
          seed_item: String.t(),
          growth_stages: [growth_stage()],
          harvest_yield: [yield()],
          requires_water: boolean(),
          can_wither: boolean(),
          wither_time: non_neg_integer(),
          skill_required: String.t() | nil,
          skill_level: non_neg_integer(),
          xp_reward: map() | nil,
          plant_message: String.t(),
          water_message: String.t(),
          harvest_message: String.t(),
          wither_message: String.t(),
          tags: [String.t()]
        }

  defstruct [
    :key,
    :name,
    :seed_item,
    growth_stages: [],
    harvest_yield: [],
    requires_water: false,
    can_wither: false,
    wither_time: 1800,
    skill_required: nil,
    skill_level: 0,
    xp_reward: nil,
    plant_message: "You plant the seeds in the soil.",
    water_message: "You water the growing plants.",
    harvest_message: "You harvest the crop.",
    wither_message: "The plants have withered from neglect.",
    tags: []
  ]

  @doc """
  Creates a Crop struct from a map (typically loaded from YAML).

  Returns `{:ok, crop}` or `{:error, reason}`.
  """
  def from_map(data) when is_map(data) do
    with {:ok, key} <- require_field(data, "key"),
         {:ok, name} <- require_field(data, "name"),
         {:ok, seed_item} <- require_field(data, "seed_item") do
      crop = %__MODULE__{
        key: key,
        name: name,
        seed_item: seed_item,
        growth_stages: parse_growth_stages(data),
        harvest_yield: parse_harvest_yield(data),
        requires_water: MapHelpers.get_flexible(data, :requires_water, false),
        can_wither: MapHelpers.get_flexible(data, :can_wither, false),
        wither_time: MapHelpers.get_flexible(data, :wither_time, 1800),
        skill_required: MapHelpers.get_flexible(data, :skill_required, nil),
        skill_level: MapHelpers.get_flexible(data, :skill_level, 0),
        xp_reward: parse_xp_reward(data),
        plant_message:
          MapHelpers.get_flexible(data, :plant_message, "You plant the seeds in the soil."),
        water_message:
          MapHelpers.get_flexible(data, :water_message, "You water the growing plants."),
        harvest_message: MapHelpers.get_flexible(data, :harvest_message, "You harvest the crop."),
        wither_message:
          MapHelpers.get_flexible(data, :wither_message, "The plants have withered from neglect."),
        tags: MapHelpers.get_flexible(data, :tags, [])
      }

      {:ok, crop}
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

  defp parse_growth_stages(data) do
    stages = MapHelpers.get_flexible(data, :growth_stages, [])

    Enum.map(stages, fn stage_data ->
      %{
        stage: MapHelpers.get_flexible(stage_data, :stage, "planted"),
        duration: MapHelpers.get_flexible(stage_data, :duration, nil),
        description: MapHelpers.get_flexible(stage_data, :description, "")
      }
    end)
  end

  defp parse_harvest_yield(data) do
    yield = MapHelpers.get_flexible(data, :harvest_yield, [])

    Enum.map(yield, fn yield_data ->
      quantity = MapHelpers.get_flexible(yield_data, :quantity, 1)

      %{
        item: MapHelpers.get_flexible(yield_data, :item, ""),
        quantity: parse_quantity(quantity),
        chance: MapHelpers.get_flexible(yield_data, :chance, 1.0)
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
      nil ->
        nil

      reward when is_map(reward) ->
        %{
          skill: MapHelpers.get_flexible(reward, :skill, nil),
          amount: MapHelpers.get_flexible(reward, :amount, 0)
        }

      _ ->
        nil
    end
  end

  @doc """
  Gets the initial growth stage for a crop.
  """
  def initial_stage(%__MODULE__{growth_stages: [first | _]}), do: first.stage
  def initial_stage(%__MODULE__{}), do: "planted"

  @doc """
  Gets the next growth stage after the current one.
  Returns nil if already at final stage.
  """
  def next_stage(%__MODULE__{growth_stages: stages}, current_stage) do
    stages
    |> Enum.with_index()
    |> Enum.find(fn {stage, _idx} -> stage.stage == current_stage end)
    |> case do
      nil -> nil
      {_stage, idx} when idx + 1 < length(stages) -> Enum.at(stages, idx + 1)
      _ -> nil
    end
  end

  @doc """
  Gets the stage definition by name.
  """
  def get_stage(%__MODULE__{growth_stages: stages}, stage_name) do
    Enum.find(stages, fn stage -> stage.stage == stage_name end)
  end

  @doc """
  Checks if a stage is the final (harvestable) stage.
  """
  def harvestable_stage?(%__MODULE__{} = crop, stage_name) do
    case get_stage(crop, stage_name) do
      nil -> false
      stage -> is_nil(stage.duration)
    end
  end

  @doc """
  Calculates the actual yield quantity for a harvest item.
  """
  def calculate_quantity({min, max}) when is_integer(min) and is_integer(max) do
    Enum.random(min..max)
  end

  def calculate_quantity(quantity) when is_integer(quantity), do: quantity
  def calculate_quantity(_), do: 1

  @doc """
  Rolls for harvest yields based on chances and quantities.
  """
  def roll_harvest_yields(%__MODULE__{harvest_yield: yields}, quality_bonus \\ 1.0) do
    yields
    |> Enum.filter(fn %{chance: chance} ->
      :rand.uniform() <= chance
    end)
    |> Enum.map(fn %{item: item, quantity: quantity} ->
      base_quantity = calculate_quantity(quantity)
      boosted_quantity = round(base_quantity * quality_bonus)
      %{item: item, quantity: max(1, boosted_quantity)}
    end)
  end
end
