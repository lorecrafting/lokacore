defmodule Loka.Framework.Quest.Admin do
  @moduledoc """
  Admin-only quest operations for debugging and testing.

  Provides functions for:
  - Viewing player quest state
  - Force-completing objectives
  - Resetting quests
  - Granting quests
  - Viewing quest event logs

  These operations bypass normal game logic and should only be used
  by administrators for debugging purposes.
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Content
  alias Loka.Framework.Quest.Progress
  alias Loka.Admin.GameLog
  alias Loka.Accounts

  # =============================================================================
  # Player Quest State
  # =============================================================================

  @doc """
  Gets all players with their quest summary.

  Returns a list of players with their active quest count and completed count.
  """
  def list_players_with_quests do
    Accounts.list_players()
    |> Enum.map(fn player ->
      character = get_character(player.id)

      quests =
        if character, do: Entity.get_component(character, "quest_progress") || %{}, else: %{}

      active_quests = get_in(quests, ["active"]) || %{}
      completed_quests = get_in(quests, ["completed"]) || []

      %{
        player_id: player.id,
        email: player.email,
        active_count: map_size(active_quests),
        completed_count: length(completed_quests),
        has_character: character != nil
      }
    end)
  end

  @doc """
  Gets detailed quest state for a specific player.
  """
  def get_player_quest_state(player_id) do
    case get_character(player_id) do
      nil ->
        {:error, :no_character}

      character ->
        quests = Entity.get_component(character, "quest_progress") || %{}
        active_quests = get_in(quests, ["active"]) || %{}
        completed_quests = get_in(quests, ["completed"]) || []

        # Enrich with quest definitions
        active =
          active_quests
          |> Enum.map(fn {quest_id, progress} ->
            quest_def = Content.Quest.definition(quest_id)
            objectives_list = format_objectives(quest_def, progress)

            %{
              quest_id: quest_id,
              name: (quest_def && quest_def.name) || quest_id,
              type: (quest_def && quest_def.type) || :unknown,
              objectives: objectives_list,
              is_complete: Enum.all?(objectives_list, & &1.completed)
            }
          end)
          |> Enum.sort_by(& &1.name)

        {:ok,
         %{
           player_id: player_id,
           active_quests: active,
           completed_quests: completed_quests
         }}
    end
  end

  defp format_objectives(nil, _progress), do: []

  defp format_objectives(quest_def, progress) do
    objectives = progress["objectives"] || %{}

    Enum.map(quest_def.objectives, fn obj ->
      obj_progress = Map.get(objectives, obj.id, %{})

      %{
        id: obj.id,
        type: obj.type,
        description: obj.description || describe_objective(obj),
        target_id: obj.target_id,
        target_count: obj.target_count || 1,
        progress: obj_progress["progress"] || 0,
        completed: obj_progress["completed"] || false
      }
    end)
  end

  defp describe_objective(obj) do
    case obj.type do
      :kill -> "Defeat #{obj.target_count || 1} #{obj.target_id}"
      :get_item -> "Collect #{obj.target_id}"
      :go_to -> "Travel to #{obj.target_id}"
      :talk -> "Speak with #{obj.target_id}"
      _ -> "Complete #{obj.type} objective"
    end
  end

  # =============================================================================
  # Quest Manipulation
  # =============================================================================

  @doc """
  Force grants a quest to a player, bypassing prerequisites.
  """
  def force_grant_quest(player_id, quest_id) do
    case get_character(player_id) do
      nil ->
        {:error, :no_character}

      character ->
        case Content.Quest.definition(quest_id) do
          nil ->
            {:error, {:quest_not_found, quest_id}}

          _quest_def ->
            case Progress.accept_quest(character, quest_id) do
              {:ok, updated_character} ->
                Entities.save_entity(updated_character)

                Logger.info(
                  "[Quest.Admin] Force granted quest #{quest_id} to player #{player_id}"
                )

                {:ok, updated_character}

              {:error, reason} ->
                {:error, reason}
            end
        end
    end
  end

  @doc """
  Force completes a specific objective for a player.
  """
  def force_complete_objective(player_id, quest_id, objective_id) do
    case get_character(player_id) do
      nil ->
        {:error, :no_character}

      character ->
        case Progress.complete_objective(character, quest_id, objective_id) do
          {:ok, updated_character} ->
            Entities.save_entity(updated_character)

            Logger.info(
              "[Quest.Admin] Force completed objective #{objective_id} in quest #{quest_id} for player #{player_id}"
            )

            {:ok, updated_character}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  @doc """
  Force completes all objectives for a quest.
  """
  def force_complete_all_objectives(player_id, quest_id) do
    case get_character(player_id) do
      nil ->
        {:error, :no_character}

      character ->
        quest_def = Content.Quest.definition(quest_id)

        if quest_def do
          # Complete each objective in sequence
          result =
            Enum.reduce_while(quest_def.objectives, {:ok, character}, fn obj,
                                                                         {:ok, current_character} ->
              case Progress.complete_objective(current_character, quest_id, obj.id) do
                {:ok, updated} -> {:cont, {:ok, updated}}
                {:error, reason} -> {:halt, {:error, reason}}
              end
            end)

          case result do
            {:ok, final_character} ->
              Entities.save_entity(final_character)

              Logger.info(
                "[Quest.Admin] Force completed all objectives in quest #{quest_id} for player #{player_id}"
              )

              {:ok, final_character}

            error ->
              error
          end
        else
          {:error, {:quest_not_found, quest_id}}
        end
    end
  end

  @doc """
  Force turns in a quest, bypassing objective completion check.

  Note: This modifies the quest state directly.
  """
  def force_turn_in_quest(player_id, quest_id) do
    # First force complete all objectives (also does character lookup)
    case force_complete_all_objectives(player_id, quest_id) do
      {:ok, updated_character} ->
        # Then turn in
        case Progress.turn_in_quest(updated_character, quest_id) do
          {:ok, final_character, rewards} ->
            Entities.save_entity(final_character)
            Logger.info("[Quest.Admin] Force turned in quest #{quest_id} for player #{player_id}")

            {:ok, final_character, rewards}

          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Resets a quest to initial state (removes from active and completed).
  """
  def reset_quest(player_id, quest_id) do
    case get_character(player_id) do
      nil ->
        {:error, :no_character}

      character ->
        quests = Entity.get_component(character, "quest_progress") || %{}
        active_quests = get_in(quests, ["active"]) || %{}
        completed_quests = get_in(quests, ["completed"]) || []

        # Remove from active
        new_active = Map.delete(active_quests, quest_id)

        # Remove from completed
        new_completed = Enum.reject(completed_quests, &(&1 == quest_id))

        new_quests = %{
          "active" => new_active,
          "completed" => new_completed
        }

        updated_character = Entity.add_component(character, "quest_progress", new_quests)
        Entities.save_entity(updated_character)
        Logger.info("[Quest.Admin] Reset quest #{quest_id} for player #{player_id}")
        {:ok, updated_character}
    end
  end

  @doc """
  Resets all quests for a player (clears entire quest state).
  """
  def reset_all_quests(player_id) do
    case get_character(player_id) do
      nil ->
        {:error, :no_character}

      character ->
        new_quests = %{"active" => %{}, "completed" => []}
        updated_character = Entity.add_component(character, "quest_progress", new_quests)
        Entities.save_entity(updated_character)
        Logger.info("[Quest.Admin] Reset all quests for player #{player_id}")
        {:ok, updated_character}
    end
  end

  # =============================================================================
  # Diagnostics
  # =============================================================================

  @doc """
  Diagnoses why an objective hasn't completed.

  Returns a detailed analysis of the objective's state, recent events,
  and possible issues preventing completion.

  ## Example

      Quest.Admin.why_not_complete?(player_id, "find_sword", "kill_goblins")
      # => %{
      #   objective: %{id: "kill_goblins", type: :kill, target_id: "goblin", ...},
      #   current_progress: 3,
      #   target_count: 5,
      #   completed: false,
      #   recent_events: [...],
      #   possible_issues: [
      #     "Progress 3/5 - needs 2 more kills",
      #     "No matching kill events in last 10 minutes"
      #   ],
      #   suggestions: [
      #     "Check if target_id 'goblin' matches enemy prototype key",
      #     "Verify player is in correct area for spawns"
      #   ]
      # }
  """
  def why_not_complete?(player_id, quest_id, objective_id) do
    # Get current state
    case get_player_quest_state(player_id) do
      {:error, _} = error ->
        error

      {:ok, state} ->
        quest = Enum.find(state.active_quests, &(&1.quest_id == quest_id))

        if quest do
          objective = Enum.find(quest.objectives, &(&1.id == objective_id))

          if objective do
            # Get events from game log
            diagnosis = GameLog.diagnose_objective(player_id, quest_id, objective_id)

            # Build comprehensive diagnosis
            %{
              objective: objective,
              current_progress: objective.progress,
              target_count: objective.target_count,
              completed: objective.completed,
              recent_events: Map.get(diagnosis, :events, []),
              possible_issues: build_issues(objective, diagnosis),
              suggestions: build_suggestions(objective)
            }
          else
            {:error, {:objective_not_found, objective_id}}
          end
        else
          {:error, {:quest_not_active, quest_id}}
        end
    end
  end

  defp build_issues(objective, diagnosis) do
    issues = Map.get(diagnosis, :possible_issues, [])

    # Add progress-based issues
    issues =
      if objective.progress < objective.target_count do
        remaining = objective.target_count - objective.progress
        msg = "Progress #{objective.progress}/#{objective.target_count} - needs #{remaining} more"
        [msg | issues]
      else
        issues
      end

    # Add type-specific issues
    case objective.type do
      :kill ->
        if objective.progress == 0 do
          ["No kills recorded - verify enemy key matches '#{objective.target_id}'" | issues]
        else
          issues
        end

      :get_item ->
        if objective.progress == 0 do
          ["No items collected - verify item key matches '#{objective.target_id}'" | issues]
        else
          issues
        end

      :go_to ->
        if not objective.completed do
          ["Room not reached - verify room key matches '#{objective.target_id}'" | issues]
        else
          issues
        end

      :talk ->
        if not objective.completed do
          ["Dialogue not completed - check NPC '#{objective.target_id}' dialogue tree" | issues]
        else
          issues
        end

      _ ->
        issues
    end
  end

  defp build_suggestions(objective) do
    case objective.type do
      :kill ->
        [
          "Verify target_id '#{objective.target_id}' matches enemy prototype key",
          "Check that enemy is spawning in player's area",
          "Confirm combat system is emitting :at_death hooks"
        ]

      :get_item ->
        [
          "Verify target_id '#{objective.target_id}' matches item prototype key",
          "Check item is spawned and pickable",
          "Confirm inventory system is emitting :at_object_receive hooks"
        ]

      :go_to ->
        [
          "Verify target_id '#{objective.target_id}' matches room prototype key",
          "Check room is accessible via exits",
          "Confirm :at_enter_room hook is firing on room entry"
        ]

      :talk ->
        [
          "Verify NPC '#{objective.target_id}' has dialogue_tree configured",
          "Check dialogue_topic matches expected node",
          "Confirm dialogue is processing actions correctly"
        ]

      _ ->
        ["Check ObjectiveRegistry for handler of type :#{objective.type}"]
    end
  end

  @doc """
  Simulates a game event to test quest progression.

  This allows admins to test if the quest system would respond to an event
  without actually performing the game action.

  ## Event Types

  - `:kill` - Simulate defeating an enemy
  - `:get_item` - Simulate picking up an item
  - `:go_to` - Simulate entering a room
  - `:talk` - Simulate reaching a dialogue node

  ## Examples

      # Simulate killing a goblin
      Quest.Admin.simulate_event(player_id, :kill, %{target_id: "goblin"})

      # Simulate entering a room
      Quest.Admin.simulate_event(player_id, :go_to, %{target_id: "temple"})

      # Simulate picking up an item
      Quest.Admin.simulate_event(player_id, :get_item, %{target_id: "ancient_sword"})
  """
  def simulate_event(player_id, event_type, params) do
    case get_character(player_id) do
      nil ->
        {:error, :no_character}

      character ->
        event = build_simulation_event(event_type, params)

        Logger.info(
          "[Quest.Admin] Simulating #{event_type} event for player #{player_id}: #{inspect(params)}"
        )

        # Run the event through quest progress
        {:ok, updated_character, completed_objectives} =
          Progress.update_progress(character, event)

        Logger.info(
          "[Quest.Admin] Simulation result: #{length(completed_objectives)} objectives updated"
        )

        {:ok,
         %{
           state_updated: updated_character != character,
           completed_objectives: completed_objectives,
           new_character: updated_character
         }}
    end
  end

  defp build_simulation_event(:kill, params) do
    %{type: :kill, target_id: params[:target_id] || params["target_id"]}
  end

  defp build_simulation_event(:get_item, params) do
    %{type: :get_item, target_id: params[:target_id] || params["target_id"]}
  end

  defp build_simulation_event(:go_to, params) do
    %{type: :go_to, target_id: params[:target_id] || params["target_id"]}
  end

  defp build_simulation_event(:talk, params) do
    %{
      type: :talk,
      target_id: params[:target_id] || params["target_id"],
      dialogue_topic: params[:dialogue_topic] || params["dialogue_topic"]
    }
  end

  defp build_simulation_event(type, params) do
    Map.merge(%{type: type}, params)
  end

  # =============================================================================
  # Event Log Access
  # =============================================================================

  @doc """
  Gets quest events for a player.
  """
  def get_quest_events(player_id, opts \\ []) do
    opts
    |> Keyword.put(:player_id, player_id)
    |> Keyword.put(:category, :quest)
    |> GameLog.get_events()
  end

  @doc """
  Clears quest events for a player.
  """
  def clear_quest_events(player_id) do
    GameLog.clear(player_id)
    Logger.info("[Quest.Admin] Cleared quest events for player #{player_id}")
    :ok
  end

  # =============================================================================
  # Quest Registry Access
  # =============================================================================

  @doc """
  Lists all registered quests.
  """
  def list_all_quests do
    Content.Quest.all_definitions()
    |> Enum.map(fn quest ->
      %{
        id: quest.id,
        name: quest.name,
        type: quest.type,
        giver: quest.giver,
        objective_count: length(quest.objectives || [])
      }
    end)
    |> Enum.sort_by(& &1.name)
  end

  # Looks up the character entity for a player by account_id
  defp get_character(player_id) do
    case Entities.find_one(account_id: player_id, type: :character) do
      {:ok, entity} -> entity
      {:error, :not_found} -> nil
    end
  end
end
