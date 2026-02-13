defmodule Loka.Framework.Quest.Progress.Tracking do
  @moduledoc """
  Quest objective progress tracking logic.

  Handles updating objective progress based on game events,
  checking objective completion, and timer management.

  ## Event Format

  Events are maps with at minimum a `:type` and `:target_id`:

      %{type: :talk, target_id: "npc_blacksmith"}
      %{type: :kill, target_id: "goblin", count: 1}
      %{type: :get_item, target_id: "magic_sword"}
      %{type: :go_to, target_id: "dark_forest"}

  ## Usage

      alias Loka.Framework.Quest.Progress.Tracking

      # Update objectives based on event
      {updated_objectives, completed_list} =
        Tracking.update_objectives(objectives, event, quest_id, player_id, quest_def)
  """

  alias Loka.Framework.Quest.{Definitions, ObjectiveRegistry, TimerManager}
  alias Loka.Admin.GameLog

  @doc """
  Updates all objectives for a quest based on a game event.

  Returns `{updated_objectives_map, list_of_completed}` where completed
  is a list of `{quest_id, objective_id}` tuples.
  """
  @spec update_objectives(map(), map(), String.t(), term(), map() | nil) ::
          {map(), [{String.t(), String.t()}]}
  def update_objectives(objectives, event, quest_id, player_id, quest_def \\ nil)
      when is_map(objectives) and is_map(event) do
    quest_def = quest_def || Definitions.get_quest_definition(quest_id)

    Enum.reduce(objectives, {%{}, []}, fn {obj_id, obj_data}, {acc_obj, acc_completed} ->
      obj_def = quest_def && Enum.find(quest_def.objectives, &(&1.id == obj_id))

      # Handle both atom and string keys from DB
      is_completed = Map.get(obj_data, "completed") || Map.get(obj_data, :completed, false)
      current_progress = Map.get(obj_data, "progress") || Map.get(obj_data, :progress, 0)

      # Skip if already completed or no definition found
      if is_completed || is_nil(obj_def) do
        {Map.put(acc_obj, obj_id, obj_data), acc_completed}
      else
        # Check if timed objective has expired
        if objective_expired?(obj_def, player_id, quest_id) do
          updated = Map.merge(obj_data, %{"expired" => true})
          {Map.put(acc_obj, obj_id, updated), acc_completed}
        else
          case check_objective(obj_def, event, current_progress) do
            {:ok, new_progress, completed} ->
              updated =
                obj_data
                |> Map.put("progress", new_progress)
                |> Map.put("completed", completed)

              # Log progress if changed
              if new_progress != current_progress do
                GameLog.Quest.log_objective_progress(
                  player_id,
                  quest_id,
                  obj_id,
                  current_progress,
                  new_progress,
                  event
                )
              end

              completed_list =
                if completed do
                  GameLog.Quest.log_objective_completed(player_id, quest_id, obj_id)
                  cancel_timer(player_id, quest_id, obj_id)
                  [{quest_id, obj_id}]
                else
                  []
                end

              {Map.put(acc_obj, obj_id, updated), acc_completed ++ completed_list}

            :no_match ->
              {Map.put(acc_obj, obj_id, obj_data), acc_completed}
          end
        end
      end
    end)
  end

  @doc """
  Checks if an objective matches an event and returns updated progress.

  Uses ObjectiveRegistry if available, falls back to legacy matching.

  Returns:
  - `{:ok, new_progress, is_complete}` if matched
  - `:no_match` if event doesn't match objective
  """
  @spec check_objective(map(), map(), non_neg_integer()) ::
          {:ok, non_neg_integer(), boolean()} | :no_match
  def check_objective(obj_def, event, current_progress) do
    case ObjectiveRegistry.check_event(obj_def, event, current_progress) do
      {:ok, _handler, new_progress, is_complete} ->
        {:ok, new_progress, is_complete}

      :no_match ->
        :no_match

      {:error, :unknown_type} ->
        legacy_check(obj_def, event, current_progress)
    end
  end

  @doc """
  Checks if a timed objective has expired.
  """
  @spec objective_expired?(map(), term(), String.t()) :: boolean()
  def objective_expired?(obj_def, player_id, quest_id) do
    if obj_def.time_limit && Process.whereis(TimerManager) do
      TimerManager.is_expired?(player_id, quest_id, obj_def.id)
    else
      false
    end
  end

  @doc """
  Gets remaining time for a timed objective in seconds.
  """
  @spec get_remaining_time(term(), String.t(), String.t()) :: non_neg_integer()
  def get_remaining_time(player_id, quest_id, objective_id) do
    if Process.whereis(TimerManager) do
      TimerManager.get_remaining_time(player_id, quest_id, objective_id) || 0
    else
      0
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp cancel_timer(player_id, quest_id, objective_id) do
    if Process.whereis(TimerManager) do
      TimerManager.cancel_objective_timer(player_id, quest_id, objective_id)
    end
  end

  # Legacy matching for when ObjectiveRegistry is not available
  defp legacy_check(obj_def, event, current_progress) do
    event_type = Map.get(event, :type)
    target_id = Map.get(event, :target_id)
    count = Map.get(event, :count, 1)
    dialogue_topic = Map.get(event, :dialogue_topic)

    obj_type = Map.get(obj_def, :type) || Map.get(obj_def, "type")
    obj_target = Map.get(obj_def, :target_id) || Map.get(obj_def, "target_id")
    obj_topic = Map.get(obj_def, :dialogue_topic) || Map.get(obj_def, "dialogue_topic")
    target_count = Map.get(obj_def, :target_count) || Map.get(obj_def, "target_count") || 1

    # Normalize type to atom for comparison
    obj_type_atom = if is_binary(obj_type), do: String.to_existing_atom(obj_type), else: obj_type

    type_matches = event_type == obj_type_atom && target_id == obj_target
    topic_matches = is_nil(obj_topic) || obj_topic == "" || obj_topic == dialogue_topic

    if type_matches && topic_matches do
      new_progress =
        case obj_type_atom do
          :go_to -> 1
          :talk -> 1
          _ -> current_progress + count
        end

      completed = new_progress >= target_count
      {:ok, new_progress, completed}
    else
      :no_match
    end
  rescue
    ArgumentError -> :no_match
  end
end
