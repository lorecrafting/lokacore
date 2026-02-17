defmodule Loka.Framework.Quest.Progress do
  @moduledoc """
  Quest progress management for the game framework.

  Handles accepting quests, tracking progress, completing objectives,
  and claiming rewards. Operates on character Entity structs.

  ## Submodules

  - `Progress.Rewards` - Reward application (XP, gold, items)
  - `Progress.Tracking` - Objective progress tracking

  ## Player Quest State

  Quests are stored in the character entity's components under `quest_progress`:

      entity.components["quest_progress"] = %{
        "active" => %{
          "quest_id" => %{
            "objectives" => %{
              "obj_1" => %{"completed" => false, "progress" => 0},
              "obj_2" => %{"completed" => true, "progress" => 5}
            },
            "accepted_at" => ~U[2024-01-01 00:00:00Z]
          }
        },
        "completed" => ["old_quest_1", "old_quest_2"]
      }

  ## Usage

      alias Loka.Framework.Quest.Progress

      # Accept a new quest
      {:ok, entity} = Progress.accept_quest(entity, "find_sword")

      # Check progress
      Progress.get_active_quests(entity)

      # Complete an objective manually
      {:ok, entity} = Progress.complete_objective(entity, "find_sword", "talk_to_blacksmith")

      # Check if quest is complete
      Progress.is_complete?(entity, "find_sword")

      # Turn in for rewards
      {:ok, entity, rewards} = Progress.turn_in_quest(entity, "find_sword")
  """

  alias Loka.Engine.{Entity, StateMachine}
  alias Loka.Framework.Quest.{StateHelper, TimerManager, QuestItemSpawner}
  alias Loka.Framework.Quest.Progress.{Rewards, Tracking}
  alias Loka.Components.QuestProgress, as: QP
  alias Loka.Admin.GameLog
  alias Loka.Content

  # =============================================================================
  # Quest Acceptance
  # =============================================================================

  @doc """
  Accepts a quest for the player.

  Creates a new entry in the player's active quests with fresh objective progress.

  Returns `{:ok, updated_entity}` on success.
  Returns `{:error, reason}` if the quest can't be accepted.
  """
  def accept_quest(%Entity{} = entity, quest_id) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)
    completed = StateHelper.get_completed(quests)

    cond do
      Map.has_key?(active, quest_id) ->
        {:error, :already_active}

      quest_id in completed ->
        {:error, :already_completed}

      true ->
        case check_quest_prerequisites(quest_id, completed) do
          {:error, reason} ->
            {:error, reason}

          :ok ->
            case Content.Quest.definition(quest_id) do
              nil ->
                {:error, :quest_not_found}

              quest_def ->
                accepted_at = DateTime.utc_now()
                objectives = initialize_objectives(quest_def.objectives, accepted_at)

                quest_data =
                  %{
                    "objectives" => objectives,
                    "accepted_at" => accepted_at,
                    "status" => "accepted"
                  }
                  |> maybe_advance_quest_status(objectives)

                new_active = Map.put(active, quest_id, quest_data)

                new_quests = Map.put(quests, "active", new_active)

                GameLog.Quest.log_accepted(entity.account_id, quest_id)

                # Start timers for timed objectives (must happen after
                # quest_progress component is updated so timer data
                # can be stored in the objective)
                temp_entity = Entity.add_component(entity, "quest_progress", new_quests)

                temp_entity =
                  start_objective_timers(
                    temp_entity,
                    quest_id,
                    quest_def.objectives,
                    accepted_at
                  )

                # Re-extract the updated quests (timers may have modified objectives)
                new_quests = Entity.get_component(temp_entity, "quest_progress")

                # Spawn player-instanced quest items for objectives with quest_spawn: true
                QuestItemSpawner.spawn_quest_items(quest_def, entity.account_id)

                {:ok, Entity.add_component(entity, "quest_progress", new_quests)}
            end
        end
    end
  end

  @doc """
  Checks if a quest's prerequisites are met.

  Checks two sources:
  1. The quest's `requires_quest` field (direct quest prerequisite)
  2. The storyline system (quests in earlier acts must be completed)

  Returns `:ok` or `{:error, {:missing_prerequisites, [quest_ids]}}`.
  """
  def check_quest_prerequisites(quest_id, completed_quests) do
    # First check the quest's own requires_quest field
    case check_quest_requires_quest(quest_id, completed_quests) do
      {:error, reason} ->
        {:error, reason}

      :ok ->
        # Then check storyline prerequisites
        check_storyline_prerequisites(quest_id, completed_quests)
    end
  end

  # Checks the quest's direct `requires_quest` field
  defp check_quest_requires_quest(quest_id, completed_quests) do
    case Content.Quest.definition(quest_id) do
      nil ->
        :ok

      quest_def ->
        required = quest_def.requires_quest

        if required && required not in completed_quests do
          {:error, {:missing_prerequisites, [required]}}
        else
          :ok
        end
    end
  end

  # Checks storyline-based prerequisites (acts)
  defp check_storyline_prerequisites(quest_id, completed_quests) do
    case Content.Storyline.check_prerequisites(quest_id, completed_quests) do
      {:ok, :available} -> :ok
      {:error, {:missing_prerequisites, missing}} -> {:error, {:missing_prerequisites, missing}}
      _ -> :ok
    end
  end

  # =============================================================================
  # Progress Updates
  # =============================================================================

  @doc """
  Updates quest progress based on a game event.

  Automatically checks active quests for matching objectives and updates progress.

  ## Event Format

      %{type: :talk, target_id: "npc_blacksmith"}
      %{type: :kill, target_id: "goblin", count: 1}
      %{type: :get_item, target_id: "magic_sword"}
      %{type: :go_to, target_id: "dark_forest"}

  Returns `{:ok, updated_entity, completed_objectives}`.
  """
  def update_progress(%Entity{} = entity, event) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    player_id = entity.account_id
    active = StateHelper.get_active(quests)

    {new_active, completed} =
      Enum.reduce(active, {%{}, []}, fn {quest_id, quest_data}, {acc_active, acc_completed} ->
        objectives = StateHelper.get_objectives(quest_data)

        {updated_objectives, newly_completed} =
          Tracking.update_objectives(objectives, event, quest_id, player_id)

        new_quest_data =
          quest_data
          |> Map.put("objectives", updated_objectives)
          |> maybe_advance_quest_status(updated_objectives)

        {Map.put(acc_active, quest_id, new_quest_data), acc_completed ++ newly_completed}
      end)

    new_quests = Map.put(quests, "active", new_active)
    new_entity = Entity.add_component(entity, "quest_progress", new_quests)
    {:ok, new_entity, completed}
  end

  @doc """
  Manually completes an objective for a quest.

  Useful for objectives that can't be auto-tracked.

  Returns `{:ok, updated_entity}` on success.
  """
  def complete_objective(%Entity{} = entity, quest_id, objective_id) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)

    case Map.get(active, quest_id) do
      nil ->
        {:error, :quest_not_active}

      quest_data ->
        objectives = StateHelper.get_objectives(quest_data)

        case Map.get(objectives, objective_id) do
          nil ->
            {:error, :objective_not_found}

          _objective ->
            updated_objective = %{"completed" => true, "progress" => 1}
            updated_objectives = Map.put(objectives, objective_id, updated_objective)

            updated_quest_data =
              quest_data
              |> Map.put("objectives", updated_objectives)
              |> maybe_advance_quest_status(updated_objectives)

            new_active = Map.put(active, quest_id, updated_quest_data)
            new_quests = Map.put(quests, "active", new_active)
            {:ok, Entity.add_component(entity, "quest_progress", new_quests)}
        end
    end
  end

  # =============================================================================
  # Quest Queries
  # =============================================================================

  @doc """
  Checks if all objectives for a quest are complete.
  """
  def is_complete?(%Entity{} = entity, quest_id) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)

    case Map.get(active, quest_id) do
      nil ->
        false

      quest_data ->
        objectives = StateHelper.get_objectives(quest_data)
        all_objectives_complete?(objectives)
    end
  end

  @doc """
  Gets all active quests with their progress.

  Returns a list of maps with quest info and progress.
  """
  def get_active_quests(%Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    player_id = entity.account_id
    active = StateHelper.get_active(quests)

    Enum.map(active, fn {quest_id, quest_data} ->
      quest_def = Content.Quest.definition(quest_id)

      objectives = StateHelper.get_objectives(quest_data)
      accepted_at = quest_data["accepted_at"] || quest_data[:accepted_at]

      %{
        id: quest_id,
        name: quest_def && quest_def.name,
        description: quest_def && quest_def.description,
        giver: quest_def && quest_def.giver,
        giver_name: get_giver_name(quest_def),
        objectives: format_objectives(objectives, quest_def, player_id, quest_id),
        accepted_at: accepted_at,
        is_complete: all_objectives_complete?(objectives)
      }
    end)
  end

  @doc """
  Gets the list of completed quest IDs.
  """
  def get_completed_quests(%Entity{} = entity) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    StateHelper.get_completed(quests)
  end

  @doc """
  Gets the progress for a specific quest.

  Returns nil if the quest is not active.
  """
  def get_quest_progress(%Entity{} = entity, quest_id) do
    quests = Entity.get_component(entity, "quest_progress") || %{}
    active = StateHelper.get_active(quests)
    Map.get(active, quest_id)
  end

  # =============================================================================
  # Quest Completion
  # =============================================================================

  @doc """
  Turns in a completed quest and claims rewards.

  Moves the quest from active to completed and applies rewards.

  Returns `{:ok, updated_entity, rewards}` on success.
  Returns `{:error, reason}` if the quest can't be turned in.

  ## Reward Types

  - `:xp` - Experience points
  - `:gold` - Gold currency (stored in flags)
  - `:items` - List of item IDs to add to inventory
  """
  def turn_in_quest(%Entity{} = entity, quest_id) do
    if not is_complete?(entity, quest_id) do
      {:error, :quest_not_complete}
    else
      quests = Entity.get_component(entity, "quest_progress") || %{}
      active = StateHelper.get_active(quests)
      # Default to "objectives_complete" for pre-existing quests without a status field,
      # since is_complete? already passed above
      current_status = get_in(active, [quest_id, "status"]) || "objectives_complete"

      case StateMachine.transition(QP.machine(), current_status, "turned_in") do
        {:error, _reason} ->
          {:error, :invalid_quest_state}

        {:ok, _} ->
          case Content.Quest.definition(quest_id) do
            nil ->
              {:error, :quest_not_found}

            quest_def ->
              completed = StateHelper.get_completed(quests)

              new_active = Map.delete(active, quest_id)
              new_completed = [quest_id | completed]

              new_quests =
                quests
                |> Map.put("active", new_active)
                |> Map.put("completed", new_completed)

              entity = Entity.add_component(entity, "quest_progress", new_quests)

              with {:ok, entity} <- Rewards.apply(entity, quest_def.rewards) do
                GameLog.Quest.log_completed(entity.account_id, quest_id, quest_def.rewards)

                # Trigger chain progression (auto-start next quest if in a chain)
                entity = trigger_chain_progression(entity, quest_id)

                {:ok, entity, quest_def.rewards}
              end
          end
      end
    end
  end

  # V2: Chain progression is handled by the storyline system.
  # This is a no-op stub that returns the entity unchanged.
  defp trigger_chain_progression(entity, _completed_quest_id), do: entity

  # =============================================================================
  # Private - Initialization
  # =============================================================================

  defp initialize_objectives(objectives, accepted_at) do
    objectives
    |> Enum.map(fn obj ->
      base = %{"completed" => false, "progress" => 0}

      if obj.time_limit do
        Map.put(base, "started_at", DateTime.to_iso8601(accepted_at))
      else
        base
      end
      |> then(&{obj.id, &1})
    end)
    |> Map.new()
  end

  defp start_objective_timers(entity, quest_id, objectives, accepted_at) do
    Enum.reduce(objectives, entity, fn obj, acc_entity ->
      if obj.time_limit do
        case TimerManager.start_objective_timer(
               acc_entity,
               quest_id,
               obj.id,
               obj.time_limit,
               started_at: accepted_at
             ) do
          {:ok, updated_entity, _expires_at} -> updated_entity
          {:error, _reason} -> acc_entity
        end
      else
        acc_entity
      end
    end)
  end

  # =============================================================================
  # Private - Helpers
  # =============================================================================

  defp maybe_advance_quest_status(quest_data, objectives) do
    current_status = quest_data["status"] || "accepted"
    machine = QP.machine()

    cond do
      all_objectives_complete?(objectives) ->
        # May need to advance through in_progress first if coming from accepted
        status_after_progress =
          if current_status == "accepted" do
            case StateMachine.transition(machine, "accepted", "in_progress") do
              {:ok, s} -> s
              {:error, _} -> current_status
            end
          else
            current_status
          end

        case StateMachine.transition(machine, status_after_progress, "objectives_complete") do
          {:ok, new_status} -> Map.put(quest_data, "status", new_status)
          {:error, _} -> Map.put(quest_data, "status", status_after_progress)
        end

      current_status == "accepted" && any_objective_has_progress?(objectives) ->
        case StateMachine.transition(machine, current_status, "in_progress") do
          {:ok, new_status} -> Map.put(quest_data, "status", new_status)
          {:error, _} -> quest_data
        end

      true ->
        quest_data
    end
  end

  defp any_objective_has_progress?(objectives) do
    Enum.any?(objectives, fn {_id, obj} ->
      progress = Map.get(obj, "progress") || Map.get(obj, :progress, 0)
      progress > 0
    end)
  end

  defp all_objectives_complete?(objectives) do
    Enum.all?(objectives, fn {_id, obj} ->
      Map.get(obj, "completed") || Map.get(obj, :completed, false)
    end)
  end

  # Gets a human-readable name for the quest giver NPC
  defp get_giver_name(nil), do: nil

  defp get_giver_name(quest_def) do
    case quest_def.giver do
      nil ->
        nil

      "system" ->
        nil

      giver_key ->
        case Loka.Engine.Entities.find_one(key: giver_key) do
          {:ok, npc} -> npc.short_desc || humanize_key(giver_key)
          _ -> humanize_key(giver_key)
        end
    end
  end

  # Converts a key like "abbot_jampa" to "Abbot Jampa"
  defp humanize_key(key) when is_binary(key) do
    key
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp humanize_key(_), do: nil

  defp format_objectives(progress_map, quest_def, _player_id, _quest_id) do
    if quest_def do
      Enum.map(quest_def.objectives, fn obj ->
        progress = Map.get(progress_map, obj.id, %{"completed" => false, "progress" => 0})
        prog_val = Map.get(progress, "progress") || Map.get(progress, :progress, 0)
        completed_val = Map.get(progress, "completed") || Map.get(progress, :completed, false)
        expired_val = Map.get(progress, "expired") || Map.get(progress, :expired, false)

        base = %{
          id: obj.id,
          type: obj.type,
          description: obj.description,
          target_count: obj.target_count,
          progress: prog_val,
          completed: completed_val,
          expired: expired_val
        }

        if obj.time_limit do
          # Timer data is now embedded in objective progress
          expires_at = Map.get(progress, "expires_at")

          remaining =
            if expires_at, do: max(0, expires_at - System.os_time(:second)), else: 0

          base
          |> Map.put(:time_limit, obj.time_limit)
          |> Map.put(:remaining_seconds, remaining)
          |> Map.put(:is_timed, true)
        else
          Map.put(base, :is_timed, false)
        end
      end)
    else
      []
    end
  end
end
