defmodule Loka.Framework.Farming.FarmPlot do
  @moduledoc """
  Farm plot component behavior for rooms.

  Farm plots are areas in rooms where players can plant and grow crops.
  Each plot has multiple slots with soil quality affecting yield.

  ## Farm Plot Configuration (in room prototype YAML)

      components:
        farm_plot:
          slots: 4
          soil_quality: good
          quality_bonus: 1.2
          crops: []  # Runtime state

  ## Soil Quality Levels

  - `poor` - 0.8x yield bonus
  - `normal` - 1.0x yield bonus
  - `good` - 1.2x yield bonus
  - `excellent` - 1.5x yield bonus

  ## Crop State

  Each planted crop in a slot tracks:
  - `slot` - Which slot (0-indexed)
  - `crop_key` - The crop type
  - `current_stage` - Current growth stage
  - `stage_timer` - Timestamp when current stage ends
  - `watered` - Whether watered this cycle
  - `wither_timer` - Timestamp when crop withers (if not watered)
  """

  alias Loka.Utils.MapHelpers

  @type crop_state :: %{
          slot: non_neg_integer(),
          crop_key: String.t(),
          current_stage: String.t(),
          stage_timer: integer() | nil,
          watered: boolean(),
          wither_timer: integer() | nil
        }

  @type t :: %__MODULE__{
          slots: pos_integer(),
          soil_quality: String.t(),
          quality_bonus: float(),
          crops: [crop_state()]
        }

  defstruct slots: 4,
            soil_quality: "normal",
            quality_bonus: 1.0,
            crops: []

  @soil_bonuses %{
    "poor" => 0.8,
    "normal" => 1.0,
    "good" => 1.2,
    "excellent" => 1.5
  }

  @doc """
  Gets the farm plot from a room entity.

  Returns the farm plot struct or nil if no plot exists.
  """
  def get_plot(nil), do: nil

  def get_plot(room_entity) do
    components = Map.get(room_entity, :components, %{})
    plot_data = MapHelpers.get_flexible(components, :farm_plot, nil)

    case plot_data do
      nil -> nil
      data -> from_component(data)
    end
  end

  @doc """
  Parses a farm plot from component data.
  """
  def from_component(data) when is_map(data) do
    soil = MapHelpers.get_flexible(data, :soil_quality, "normal")

    %__MODULE__{
      slots: MapHelpers.get_flexible(data, :slots, 4),
      soil_quality: soil,
      quality_bonus: MapHelpers.get_flexible(data, :quality_bonus, @soil_bonuses[soil] || 1.0),
      crops: parse_crops(data)
    }
  end

  def from_component(_), do: nil

  defp parse_crops(data) do
    crops = MapHelpers.get_flexible(data, :crops, [])

    Enum.map(crops, fn crop_data ->
      %{
        slot: MapHelpers.get_flexible(crop_data, :slot, 0),
        crop_key: MapHelpers.get_flexible(crop_data, :crop_key, ""),
        current_stage: MapHelpers.get_flexible(crop_data, :current_stage, "planted"),
        stage_timer: MapHelpers.get_flexible(crop_data, :stage_timer, nil),
        watered: MapHelpers.get_flexible(crop_data, :watered, false),
        wither_timer: MapHelpers.get_flexible(crop_data, :wither_timer, nil)
      }
    end)
  end

  @doc """
  Checks if a slot is available (empty).
  """
  def slot_available?(%__MODULE__{slots: slots, crops: crops}, slot) do
    slot >= 0 and slot < slots and not Enum.any?(crops, &(&1.slot == slot))
  end

  @doc """
  Gets the crop in a specific slot.
  """
  def get_crop_in_slot(%__MODULE__{crops: crops}, slot) do
    Enum.find(crops, &(&1.slot == slot))
  end

  @doc """
  Gets all occupied slots.
  """
  def occupied_slots(%__MODULE__{crops: crops}) do
    Enum.map(crops, & &1.slot) |> Enum.sort()
  end

  @doc """
  Gets all available (empty) slots.
  """
  def available_slots(%__MODULE__{slots: slots, crops: crops}) do
    occupied = Enum.map(crops, & &1.slot) |> MapSet.new()
    Enum.reject(0..(slots - 1), &MapSet.member?(occupied, &1))
  end

  @doc """
  Returns the soil quality bonus for this plot.
  """
  def get_quality_bonus(%__MODULE__{quality_bonus: bonus}), do: bonus

  @doc """
  Creates a new crop state for planting.
  """
  def new_crop_state(slot, crop_key, initial_stage, current_time, stage_duration) do
    stage_timer =
      if stage_duration do
        current_time + stage_duration
      else
        nil
      end

    %{
      slot: slot,
      crop_key: crop_key,
      current_stage: initial_stage,
      stage_timer: stage_timer,
      watered: false,
      wither_timer: nil
    }
  end

  @doc """
  Adds a crop to a slot.
  """
  def add_crop(%__MODULE__{} = plot, crop_state) do
    %{plot | crops: [crop_state | plot.crops]}
  end

  @doc """
  Removes a crop from a slot.
  """
  def remove_crop(%__MODULE__{crops: crops} = plot, slot) do
    %{plot | crops: Enum.reject(crops, &(&1.slot == slot))}
  end

  @doc """
  Updates a crop in a slot.
  """
  def update_crop(%__MODULE__{crops: crops} = plot, slot, updates) do
    updated_crops =
      Enum.map(crops, fn crop ->
        if crop.slot == slot do
          Map.merge(crop, updates)
        else
          crop
        end
      end)

    %{plot | crops: updated_crops}
  end

  @doc """
  Returns all valid soil quality types.
  """
  def soil_qualities, do: Map.keys(@soil_bonuses)

  @doc """
  Gets the default bonus for a soil quality.
  """
  def default_bonus(soil_quality) do
    Map.get(@soil_bonuses, soil_quality, 1.0)
  end
end
