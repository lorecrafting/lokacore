defmodule Exmud.Framework.Farming do
  @moduledoc """
  Core farming execution logic.

  Handles planting, watering, harvesting, and crop growth progression.

  ## Usage

      alias Exmud.Framework.Farming

      # List plots in a room
      case Farming.get_plot(room_entity) do
        nil -> "No farm plot here"
        plot -> "Found plot with \#{plot.slots} slots"
      end

      # Plant a seed
      case Farming.plant(game_state, room_entity, 0, "wheat_seeds") do
        {:ok, result} -> result.message
        {:error, reason} -> "Cannot plant: \#{inspect(reason)}"
      end

      # Water a crop
      case Farming.water(room_entity, 0) do
        {:ok, message} -> message
        {:error, reason} -> "Cannot water: \#{inspect(reason)}"
      end

      # Harvest
      case Farming.harvest(game_state, room_entity, 0) do
        {:ok, result} -> "Harvested: \#{inspect(result.items)}"
        {:error, reason} -> "Cannot harvest: \#{inspect(reason)}"
      end
  """

  require Logger

  alias Exmud.Framework.Farming.{Crop, CropRegistry, FarmPlot}
  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @type plant_result :: %{
          message: String.t(),
          crop_key: String.t(),
          slot: non_neg_integer()
        }

  @type harvest_result :: %{
          items: [%{item: String.t(), quantity: pos_integer()}],
          message: String.t(),
          xp: map() | nil,
          slot: non_neg_integer()
        }

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Gets the farm plot from a room entity.
  """
  def get_plot(room_entity) do
    FarmPlot.get_plot(room_entity)
  end

  @doc """
  Lists all crops currently planted in a room's farm plot.
  """
  def list_crops(room_entity) do
    case get_plot(room_entity) do
      nil -> []
      plot -> plot.crops
    end
  end

  @doc """
  Gets the status of a crop in a specific slot.
  """
  def get_crop_status(room_entity, slot) do
    case get_plot(room_entity) do
      nil ->
        {:error, :no_farm_plot}

      plot ->
        case FarmPlot.get_crop_in_slot(plot, slot) do
          nil ->
            {:error, :empty_slot}

          crop_state ->
            case CropRegistry.get(crop_state.crop_key) do
              {:ok, crop_def} ->
                stage = Crop.get_stage(crop_def, crop_state.current_stage)

                {:ok,
                 %{
                   crop: crop_def.name,
                   stage: crop_state.current_stage,
                   description: stage && stage.description,
                   watered: crop_state.watered,
                   harvestable: Crop.harvestable_stage?(crop_def, crop_state.current_stage)
                 }}

              {:error, _} ->
                {:error, :unknown_crop}
            end
        end
    end
  end

  @doc """
  Checks if an entity can plant a seed in a slot.

  Returns `:ok` or `{:error, reason}`.
  """
  def can_plant?(%GameState{} = game_state, room_entity, slot, seed_item) do
    with {:ok, plot} <- require_plot(room_entity),
         :ok <- check_slot_available(plot, slot),
         {:ok, crop_def} <- get_crop_for_seed(seed_item),
         :ok <- check_has_seed(game_state, seed_item),
         :ok <- check_skill_requirements(game_state, crop_def) do
      :ok
    end
  end

  @doc """
  Plants a seed in a farm plot slot.

  Returns `{:ok, result}` or `{:error, reason}`.
  """
  def plant(%GameState{} = game_state, room_entity, slot, seed_item) do
    with {:ok, plot} <- require_plot(room_entity),
         :ok <- can_plant?(game_state, room_entity, slot, seed_item),
         {:ok, crop_def} <- get_crop_for_seed(seed_item) do
      current_time = System.system_time(:second)
      initial_stage = Crop.initial_stage(crop_def)
      stage_def = Crop.get_stage(crop_def, initial_stage)
      duration = stage_def && stage_def.duration

      crop_state =
        FarmPlot.new_crop_state(slot, crop_def.key, initial_stage, current_time, duration)

      _updated_plot = FarmPlot.add_crop(plot, crop_state)

      result = %{
        message: crop_def.plant_message,
        crop_key: crop_def.key,
        slot: slot,
        new_crop_state: crop_state
      }

      {:ok, result}
    end
  end

  @doc """
  Waters a crop in a slot.

  Returns `{:ok, message}` or `{:error, reason}`.
  """
  def water(room_entity, slot) do
    with {:ok, plot} <- require_plot(room_entity),
         {:ok, crop_state} <- require_crop_in_slot(plot, slot),
         {:ok, crop_def} <- CropRegistry.get(crop_state.crop_key) do
      if crop_state.watered do
        {:ok, "The crop has already been watered."}
      else
        updated_state = %{crop_state | watered: true, wither_timer: nil}
        _updated_plot = FarmPlot.update_crop(plot, slot, updated_state)

        {:ok, crop_def.water_message}
      end
    end
  end

  @doc """
  Checks if a crop can be harvested.
  """
  def can_harvest?(room_entity, slot) do
    with {:ok, plot} <- require_plot(room_entity),
         {:ok, crop_state} <- require_crop_in_slot(plot, slot),
         {:ok, crop_def} <- CropRegistry.get(crop_state.crop_key) do
      if Crop.harvestable_stage?(crop_def, crop_state.current_stage) do
        :ok
      else
        {:error, :not_harvestable}
      end
    end
  end

  @doc """
  Harvests a crop from a slot.

  Returns `{:ok, result}` or `{:error, reason}`.
  """
  def harvest(%GameState{} = _game_state, room_entity, slot) do
    with {:ok, plot} <- require_plot(room_entity),
         {:ok, crop_state} <- require_crop_in_slot(plot, slot),
         {:ok, crop_def} <- CropRegistry.get(crop_state.crop_key),
         :ok <- check_harvestable(crop_def, crop_state) do
      # Roll for yields with quality bonus
      items = Crop.roll_harvest_yields(crop_def, plot.quality_bonus)

      # Remove crop from plot
      _updated_plot = FarmPlot.remove_crop(plot, slot)

      result = %{
        items: items,
        message: crop_def.harvest_message,
        xp: crop_def.xp_reward,
        slot: slot,
        crop_key: crop_def.key
      }

      {:ok, result}
    end
  end

  @doc """
  Processes growth ticks for all crops in a room.

  Called by the game loop. Returns updated crop states.
  """
  def tick_growth(room_entity, current_time \\ nil) do
    current_time = current_time || System.system_time(:second)

    case get_plot(room_entity) do
      nil ->
        {:ok, nil}

      plot ->
        updated_crops =
          Enum.map(plot.crops, fn crop_state ->
            process_crop_growth(crop_state, current_time)
          end)
          |> Enum.reject(&is_nil/1)

        {:ok, %{plot | crops: updated_crops}}
    end
  end

  # =============================================================================
  # Validation Checks
  # =============================================================================

  defp require_plot(room_entity) do
    case get_plot(room_entity) do
      nil -> {:error, :no_farm_plot}
      plot -> {:ok, plot}
    end
  end

  defp check_slot_available(plot, slot) do
    cond do
      slot < 0 or slot >= plot.slots ->
        {:error, {:invalid_slot, slot, plot.slots}}

      not FarmPlot.slot_available?(plot, slot) ->
        {:error, :slot_occupied}

      true ->
        :ok
    end
  end

  defp require_crop_in_slot(plot, slot) do
    case FarmPlot.get_crop_in_slot(plot, slot) do
      nil -> {:error, :empty_slot}
      crop -> {:ok, crop}
    end
  end

  defp get_crop_for_seed(seed_item) do
    CropRegistry.by_seed(seed_item)
  end

  defp check_has_seed(%GameState{inventory: inventory}, seed_item) do
    if Enum.any?(inventory, fn item_id ->
         item_id == seed_item or String.starts_with?(to_string(item_id), seed_item)
       end) do
      :ok
    else
      {:error, {:missing_seed, seed_item}}
    end
  end

  defp check_skill_requirements(%GameState{} = game_state, %Crop{} = crop_def) do
    if crop_def.skill_required do
      skills = get_skills(game_state)
      player_level = Map.get(skills, crop_def.skill_required, 0)

      if player_level >= crop_def.skill_level do
        :ok
      else
        {:error, {:skill_required, crop_def.skill_required, crop_def.skill_level, player_level}}
      end
    else
      :ok
    end
  end

  defp check_harvestable(crop_def, crop_state) do
    if Crop.harvestable_stage?(crop_def, crop_state.current_stage) do
      :ok
    else
      {:error, :not_harvestable}
    end
  end

  # =============================================================================
  # Growth Processing
  # =============================================================================

  defp process_crop_growth(crop_state, current_time) do
    case CropRegistry.get(crop_state.crop_key) do
      {:ok, crop_def} ->
        crop_state
        |> maybe_advance_stage(crop_def, current_time)
        |> maybe_wither(crop_def, current_time)

      {:error, _} ->
        crop_state
    end
  end

  defp maybe_advance_stage(crop_state, crop_def, current_time) do
    stage_timer = crop_state.stage_timer

    cond do
      # No timer set (harvestable stage or error)
      is_nil(stage_timer) ->
        crop_state

      # Timer hasn't elapsed yet
      current_time < stage_timer ->
        crop_state

      # Time to advance
      true ->
        case Crop.next_stage(crop_def, crop_state.current_stage) do
          nil ->
            # Already at final stage
            crop_state

          next_stage ->
            Logger.debug("Crop #{crop_state.crop_key} advancing to #{next_stage.stage}")

            new_timer =
              if next_stage.duration do
                current_time + next_stage.duration
              else
                nil
              end

            %{
              crop_state
              | current_stage: next_stage.stage,
                stage_timer: new_timer,
                watered: false
            }
        end
    end
  end

  defp maybe_wither(nil, _crop_def, _current_time), do: nil

  defp maybe_wither(crop_state, crop_def, current_time) do
    cond do
      # Doesn't wither
      not crop_def.can_wither ->
        crop_state

      # Already watered
      crop_state.watered ->
        crop_state

      # No wither timer set, start one
      is_nil(crop_state.wither_timer) and crop_def.requires_water ->
        %{crop_state | wither_timer: current_time + crop_def.wither_time}

      # Wither timer elapsed - crop dies
      crop_state.wither_timer && current_time >= crop_state.wither_timer ->
        Logger.debug("Crop #{crop_state.crop_key} in slot #{crop_state.slot} has withered")
        nil

      # Still waiting
      true ->
        crop_state
    end
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp get_skills(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :skills, %{})
  end
end
