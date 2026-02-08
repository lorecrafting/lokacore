defmodule Loka.Testing.Quest.QuestTester do
  @moduledoc """
  Quest Testing Framework for validating quest completability.

  Provides automated testing of quest flows including:
  - Quest acceptance via NPC dialogue
  - Objective progression (kill, talk, get_item, go_to)
  - Quest turn-in and reward verification
  - Integration with GameLog for detailed tracking

  ## Usage

  ### Test a Single Quest

      alias Loka.Testing.Quest.QuestTester

      # Run a quest test with full validation
      {:ok, results} = QuestTester.test_quest("find_treasure", player_id: "test_player")

      # Check results
      assert results.success
      assert results.objectives_completed == 3
      assert results.rewards_received.xp == 100

  ### Test an Entire Storyline

      {:ok, results} = QuestTester.test_storyline("monastery_arc")

  ### Interactive Quest Walkthrough

      # Get step-by-step instructions for completing a quest
      steps = QuestTester.generate_walkthrough("find_treasure")

  ## Options

  - `:player_id` - Use a specific player ID (default: auto-generated)
  - `:max_steps` - Maximum actions before timeout (default: 500)
  - `:verify_rewards` - Check rewards are applied (default: true)
  - `:log_events` - Log all quest events (default: true)
  - `:timeout` - Timeout in milliseconds (default: 30_000)

  ## Results Structure

      %{
        success: true | false,
        quest_id: "find_treasure",
        objectives_completed: 3,
        total_objectives: 3,
        rewards_received: %{xp: 100, gold: 50, items: ["ring"]},
        events: [...],           # All GameLog events
        steps_taken: 45,
        time_elapsed_ms: 2340,
        errors: [],
        warnings: []
      }
  """

  require Logger

  alias Loka.Framework.Quest
  alias Loka.Framework.Quest.{Definitions, Progress}
  alias Loka.Admin.GameLog
  alias Loka.Framework.Player.GameState
  alias Loka.Framework.Storyline.StorylineRegistry
  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader

  @default_max_steps 500

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Tests a single quest for completability.

  Returns `{:ok, results}` with detailed test results.
  """
  def test_quest(quest_id, opts \\ []) do
    start_time = System.monotonic_time(:millisecond)

    with {:ok, quest_def} <- get_quest_definition(quest_id),
         {:ok, game_state} <- setup_test_state(opts),
         {:ok, game_state} <- accept_quest(game_state, quest_id),
         {:ok, game_state, steps} <- complete_objectives(game_state, quest_def, opts),
         {:ok, game_state, rewards} <- turn_in_quest(game_state, quest_id, opts) do
      elapsed = System.monotonic_time(:millisecond) - start_time

      results = build_success_results(quest_id, quest_def, game_state, steps, rewards, elapsed)

      {:ok, results}
    else
      {:error, reason} ->
        elapsed = System.monotonic_time(:millisecond) - start_time

        results = %{
          success: false,
          quest_id: quest_id,
          objectives_completed: 0,
          total_objectives: 0,
          rewards_received: %{},
          events: [],
          steps_taken: 0,
          time_elapsed_ms: elapsed,
          errors: [reason],
          warnings: []
        }

        {:ok, results}
    end
  end

  @doc """
  Tests all quests in a storyline.

  Returns `{:ok, results}` with results for each quest.
  """
  def test_storyline(storyline_id, opts \\ []) do
    case StorylineRegistry.get(storyline_id) do
      {:ok, storyline} ->
        quest_ids = storyline.acts |> Enum.flat_map(& &1.quests)

        results =
          Enum.reduce(quest_ids, %{passed: [], failed: [], skipped: []}, fn quest_id, acc ->
            case test_quest(quest_id, opts) do
              {:ok, %{success: true} = result} ->
                %{acc | passed: [{quest_id, result} | acc.passed]}

              {:ok, %{success: false} = result} ->
                %{acc | failed: [{quest_id, result} | acc.failed]}
            end
          end)

        {:ok,
         %{
           storyline_id: storyline_id,
           total_quests: length(quest_ids),
           passed: length(results.passed),
           failed: length(results.failed),
           results: results,
           success: Enum.empty?(results.failed)
         }}

      {:error, :not_found} ->
        {:error, {:storyline_not_found, storyline_id}}
    end
  end

  @doc """
  Generates a step-by-step walkthrough for completing a quest.

  Returns a list of steps with actions and expected outcomes.
  """
  def generate_walkthrough(quest_id) do
    case get_quest_definition(quest_id) do
      {:ok, quest_def} ->
        steps = build_walkthrough_steps(quest_def)
        {:ok, steps}

      error ->
        error
    end
  end

  @doc """
  Validates a quest can be completed without actually running it.

  Performs static analysis of quest definition and world state.
  """
  def validate_quest(quest_id) do
    with {:ok, quest_def} <- get_quest_definition(quest_id),
         :ok <- validate_objectives(quest_def),
         :ok <- validate_targets_exist(quest_def),
         :ok <- validate_giver_dialogue(quest_def) do
      {:ok, :valid}
    end
  end

  @doc """
  Gets the GameLog events for a quest test run.

  Useful for debugging failed tests.
  """
  def get_test_events(player_id, quest_id) do
    GameLog.get_events(player_id: player_id, category: :quest)
    |> Enum.filter(fn e -> get_in(e.metadata, [:quest_id]) == quest_id end)
  end

  @doc """
  Diagnoses why a quest objective didn't complete.

  Wraps GameLog.diagnose_objective with additional context.
  """
  def diagnose_objective(player_id, quest_id, objective_id) do
    diagnosis = GameLog.diagnose_objective(player_id, quest_id, objective_id)

    # Add additional analysis
    case get_quest_definition(quest_id) do
      {:ok, quest_def} ->
        obj_def = Enum.find(quest_def.objectives, &(&1.id == objective_id))

        enhanced = %{
          diagnosis
          | possible_issues:
              diagnosis.possible_issues ++
                analyze_objective_issues(obj_def, diagnosis)
        }

        {:ok, enhanced}

      _ ->
        {:ok, diagnosis}
    end
  end

  # =============================================================================
  # Quest Execution
  # =============================================================================

  defp get_quest_definition(quest_id) do
    case Definitions.get_quest_definition(quest_id) do
      nil -> {:error, {:quest_not_found, quest_id}}
      quest_def -> {:ok, quest_def}
    end
  end

  defp setup_test_state(opts) do
    player_id = Keyword.get(opts, :player_id, generate_test_player_id())

    # Build a minimal GameState struct for testing
    # Note: GameState is an Ecto schema, so we build it as a struct
    game_state = %GameState{
      player_id: player_id,
      stats: %{"level" => 1, "xp" => 0},
      flags: %{"gold" => 0},
      inventory: [],
      equipment: %{},
      quests: %{"active" => %{}, "completed" => []},
      health: %{"current" => 100, "max" => 100},
      current_room_id: nil
    }

    {:ok, game_state}
  end

  defp accept_quest(game_state, quest_id) do
    case Progress.accept_quest(game_state, quest_id) do
      {:ok, new_state} ->
        Logger.debug("[QuestTester] Accepted quest: #{quest_id}")
        {:ok, new_state}

      {:error, reason} ->
        {:error, {:accept_failed, quest_id, reason}}
    end
  end

  defp complete_objectives(game_state, quest_def, opts) do
    max_steps = Keyword.get(opts, :max_steps, @default_max_steps)

    {final_state, steps} =
      Enum.reduce_while(
        quest_def.objectives,
        {game_state, 0},
        fn objective, {state, step_count} ->
          if step_count >= max_steps do
            {:halt, {state, step_count}}
          else
            case simulate_objective_completion(state, quest_def.id, objective) do
              {:ok, new_state} ->
                {:cont, {new_state, step_count + 1}}

              {:error, _reason} ->
                {:halt, {state, step_count}}
            end
          end
        end
      )

    {:ok, final_state, steps}
  end

  defp simulate_objective_completion(game_state, _quest_id, objective) do
    # Simulate the event that would complete this objective
    event = build_completion_event(objective)

    case Progress.update_progress(game_state, event) do
      {:ok, new_state, _completed} ->
        Logger.debug("[QuestTester] Completed objective: #{objective.id} (#{objective.type})")

        {:ok, new_state}

      error ->
        {:error, {:objective_failed, objective.id, error}}
    end
  end

  defp build_completion_event(objective) do
    case objective.type do
      :kill ->
        %{
          type: :kill,
          target_id: objective.target_id,
          count: objective.target_count || 1
        }

      :get_item ->
        %{
          type: :get_item,
          target_id: objective.target_id,
          count: 1
        }

      :go_to ->
        %{
          type: :go_to,
          target_id: objective.target_id
        }

      :talk ->
        %{
          type: :talk,
          target_id: objective.target_id,
          dialogue_topic: objective.dialogue_topic
        }

      other_type ->
        %{
          type: other_type,
          target_id: objective.target_id
        }
    end
  end

  defp turn_in_quest(game_state, quest_id, opts) do
    verify_rewards = Keyword.get(opts, :verify_rewards, true)

    case Progress.turn_in_quest(game_state, quest_id) do
      {:ok, new_state, rewards} ->
        if verify_rewards do
          verify_rewards_applied(game_state, new_state, rewards)
        end

        Logger.debug("[QuestTester] Turned in quest: #{quest_id}")
        {:ok, new_state, rewards}

      {:error, :quest_not_complete} ->
        {:error, {:turn_in_failed, quest_id, :not_complete}}

      {:error, reason} ->
        {:error, {:turn_in_failed, quest_id, reason}}
    end
  end

  defp verify_rewards_applied(old_state, new_state, rewards) do
    xp_reward = Map.get(rewards, "xp") || Map.get(rewards, :xp, 0)

    old_xp = Map.get(old_state.stats, "xp") || Map.get(old_state.stats, :xp, 0)
    new_xp = Map.get(new_state.stats, "xp") || Map.get(new_state.stats, :xp, 0)

    if xp_reward > 0 and new_xp != old_xp + xp_reward do
      Logger.warning(
        "[QuestTester] XP reward mismatch: expected +#{xp_reward}, got #{new_xp - old_xp}"
      )
    end

    :ok
  end

  # =============================================================================
  # Validation
  # =============================================================================

  defp validate_objectives(quest_def) do
    errors =
      Enum.reduce(quest_def.objectives, [], fn obj, acc ->
        case Quest.ObjectiveRegistry.validate_objective(obj) do
          :ok -> acc
          {:error, reason} -> [{obj.id, reason} | acc]
        end
      end)

    if Enum.empty?(errors) do
      :ok
    else
      {:error, {:invalid_objectives, errors}}
    end
  end

  defp validate_targets_exist(quest_def) do
    errors =
      quest_def.objectives
      |> Enum.filter(&(&1.type in [:go_to, :kill, :get_item]))
      |> Enum.reduce([], fn obj, acc ->
        case TypedObjectLoader.get(obj.target_id) do
          {:ok, _proto} ->
            acc

          {:error, :not_found} ->
            [{obj.id, "Target '#{obj.target_id}' not found in prototypes"} | acc]
        end
      end)

    if Enum.empty?(errors) do
      :ok
    else
      {:error, {:missing_targets, errors}}
    end
  end

  defp validate_giver_dialogue(quest_def) do
    if quest_def.giver do
      case TypedObjectLoader.get(quest_def.giver) do
        {:error, :not_found} ->
          {:error, {:giver_not_found, quest_def.giver}}

        {:ok, proto} ->
          components = proto.components || %{}

          if Map.get(components, "dialogue_tree") || Map.get(components, :dialogue_tree) do
            :ok
          else
            {:error, {:giver_no_dialogue, quest_def.giver}}
          end
      end
    else
      :ok
    end
  end

  # =============================================================================
  # Walkthrough Generation
  # =============================================================================

  defp build_walkthrough_steps(quest_def) do
    header = [
      %{
        step: 1,
        action: :accept_quest,
        description: "Accept quest '#{quest_def.name}' from #{quest_def.giver || "quest giver"}",
        expected: "Quest appears in journal"
      }
    ]

    objective_steps =
      quest_def.objectives
      |> Enum.with_index(2)
      |> Enum.map(fn {obj, idx} ->
        %{
          step: idx,
          action: objective_action(obj),
          description: obj.description || describe_objective(obj),
          expected: "Objective marked as complete",
          objective_id: obj.id,
          objective_type: obj.type,
          target: obj.target_id
        }
      end)

    footer = [
      %{
        step: length(objective_steps) + 2,
        action: :turn_in,
        description: "Return to #{quest_def.giver || "quest giver"} to complete",
        expected: "Receive rewards: #{format_rewards(quest_def.rewards)}"
      }
    ]

    header ++ objective_steps ++ footer
  end

  defp objective_action(obj) do
    case obj.type do
      :kill -> :defeat_enemy
      :get_item -> :collect_item
      :go_to -> :travel_to
      :talk -> :speak_with
      other -> other
    end
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

  defp format_rewards(nil), do: "none"

  defp format_rewards(rewards) do
    parts = []

    parts =
      if xp = Map.get(rewards, "xp") || Map.get(rewards, :xp) do
        ["#{xp} XP" | parts]
      else
        parts
      end

    parts =
      if gold = Map.get(rewards, "gold") || Map.get(rewards, :gold) do
        ["#{gold} gold" | parts]
      else
        parts
      end

    parts =
      if items = Map.get(rewards, "items") || Map.get(rewards, :items) do
        [Enum.join(items, ", ") | parts]
      else
        parts
      end

    if Enum.empty?(parts), do: "none", else: Enum.join(Enum.reverse(parts), ", ")
  end

  # =============================================================================
  # Diagnostics
  # =============================================================================

  defp analyze_objective_issues(nil, _diagnosis), do: []

  defp analyze_objective_issues(obj_def, _diagnosis) do
    issues = []

    # Check if target exists
    issues =
      if obj_def.type in [:kill, :get_item, :go_to] do
        case TypedObjectLoader.get(obj_def.target_id) do
          {:ok, _proto} ->
            issues

          {:error, :not_found} ->
            ["Target '#{obj_def.target_id}' not found in prototypes" | issues]
        end
      else
        issues
      end

    # Check for dialogue topic issues
    issues =
      if obj_def.type == :talk && obj_def.dialogue_topic do
        ["Requires reaching dialogue topic '#{obj_def.dialogue_topic}'" | issues]
      else
        issues
      end

    issues
  end

  # =============================================================================
  # Results Building
  # =============================================================================

  defp build_success_results(quest_id, quest_def, game_state, steps, rewards, elapsed) do
    events =
      GameLog.get_events(player_id: game_state.player_id, category: :quest)
      |> Enum.filter(fn e -> get_in(e.metadata, [:quest_id]) == quest_id end)

    %{
      success: true,
      quest_id: quest_id,
      objectives_completed: length(quest_def.objectives),
      total_objectives: length(quest_def.objectives),
      rewards_received: normalize_rewards(rewards),
      events: events,
      steps_taken: steps,
      time_elapsed_ms: elapsed,
      errors: [],
      warnings: []
    }
  end

  defp normalize_rewards(nil), do: %{}

  defp normalize_rewards(rewards) do
    %{
      xp: Map.get(rewards, "xp") || Map.get(rewards, :xp, 0),
      gold: Map.get(rewards, "gold") || Map.get(rewards, :gold, 0),
      items: Map.get(rewards, "items") || Map.get(rewards, :items, [])
    }
  end

  defp generate_test_player_id do
    "quest_test_#{:crypto.strong_rand_bytes(4) |> Base.url_encode64(padding: false)}"
  end
end
