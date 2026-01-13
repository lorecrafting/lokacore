defmodule Loka.Testing.Quest.QuestAssertions do
  @moduledoc """
  Assertion helpers for quest testing.

  Provides ExUnit-style assertions for quest state validation.

  ## Usage in Tests

      use ExUnit.Case
      import Loka.Testing.Quest.QuestAssertions

      test "quest can be completed" do
        {:ok, state} = setup_player_with_quest("find_treasure")

        # Assert quest is active
        assert_quest_active(state, "find_treasure")

        # Complete objectives
        state = complete_all_objectives(state, "find_treasure")

        # Assert quest is complete
        assert_quest_complete(state, "find_treasure")

        # Turn in and verify
        {:ok, state, rewards} = Quest.turn_in_quest(state, "find_treasure")
        assert_rewards_received(state, xp: 100, gold: 50)
      end

  ## Assertions

  All assertions raise `ExUnit.AssertionError` on failure.
  """

  alias Loka.Framework.Quest
  alias Loka.Admin.GameLog

  @doc """
  Asserts that a quest is currently active for the player.
  """
  defmacro assert_quest_active(game_state, quest_id) do
    quote do
      game_state = unquote(game_state)
      quest_id = unquote(quest_id)
      active_quests = Quest.get_active_quests(game_state)

      unless Enum.any?(active_quests, &(&1.id == quest_id)) do
        raise ExUnit.AssertionError,
          message: "Expected quest '#{quest_id}' to be active",
          left: Enum.map(active_quests, & &1.id),
          right: quest_id
      end
    end
  end

  @doc """
  Asserts that a quest is NOT active for the player.
  """
  defmacro refute_quest_active(game_state, quest_id) do
    quote do
      game_state = unquote(game_state)
      quest_id = unquote(quest_id)
      active_quests = Quest.get_active_quests(game_state)

      if Enum.any?(active_quests, &(&1.id == quest_id)) do
        raise ExUnit.AssertionError,
          message: "Expected quest '#{quest_id}' to NOT be active"
      end
    end
  end

  @doc """
  Asserts that a quest has been completed (in completed list).
  """
  defmacro assert_quest_completed(game_state, quest_id) do
    quote do
      game_state = unquote(game_state)
      quest_id = unquote(quest_id)
      completed = Quest.get_completed_quests(game_state)

      unless quest_id in completed do
        raise ExUnit.AssertionError,
          message: "Expected quest '#{quest_id}' to be in completed list",
          left: completed,
          right: quest_id
      end
    end
  end

  @doc """
  Asserts that a quest is ready to turn in (all objectives complete).
  """
  defmacro assert_quest_complete(game_state, quest_id) do
    quote do
      game_state = unquote(game_state)
      quest_id = unquote(quest_id)

      unless Quest.is_complete?(game_state, quest_id) do
        progress = Quest.get_quest_progress(game_state, quest_id)
        objectives = progress && (progress["objectives"] || progress[:objectives])

        incomplete =
          if objectives do
            objectives
            |> Enum.reject(fn {_id, obj} ->
              Map.get(obj, "completed") || Map.get(obj, :completed, false)
            end)
            |> Enum.map(fn {id, _} -> id end)
          else
            []
          end

        raise ExUnit.AssertionError,
          message: "Expected all objectives for quest '#{quest_id}' to be complete",
          left: incomplete,
          right: []
      end
    end
  end

  @doc """
  Asserts that a specific objective is complete.
  """
  defmacro assert_objective_complete(game_state, quest_id, objective_id) do
    quote do
      game_state = unquote(game_state)
      quest_id = unquote(quest_id)
      objective_id = unquote(objective_id)

      progress = Quest.get_quest_progress(game_state, quest_id)
      objectives = (progress && (progress["objectives"] || progress[:objectives])) || %{}
      obj_status = Map.get(objectives, objective_id, %{})
      is_complete = Map.get(obj_status, "completed") || Map.get(obj_status, :completed, false)

      unless is_complete do
        raise ExUnit.AssertionError,
          message: "Expected objective '#{objective_id}' in quest '#{quest_id}' to be complete",
          left: obj_status,
          right: %{"completed" => true}
      end
    end
  end

  @doc """
  Asserts that an objective has specific progress.
  """
  defmacro assert_objective_progress(game_state, quest_id, objective_id, expected_progress) do
    quote do
      game_state = unquote(game_state)
      quest_id = unquote(quest_id)
      objective_id = unquote(objective_id)
      expected = unquote(expected_progress)

      progress = Quest.get_quest_progress(game_state, quest_id)
      objectives = (progress && (progress["objectives"] || progress[:objectives])) || %{}
      obj_status = Map.get(objectives, objective_id, %{})
      actual = Map.get(obj_status, "progress") || Map.get(obj_status, :progress, 0)

      unless actual == expected do
        raise ExUnit.AssertionError,
          message: "Expected objective '#{objective_id}' to have progress #{expected}",
          left: actual,
          right: expected
      end
    end
  end

  @doc """
  Asserts that the GameLog contains a specific event type for a quest.
  """
  defmacro assert_event_logged(player_id, event_type, opts \\ []) do
    quote do
      player_id = unquote(player_id)
      event_type = unquote(event_type)
      opts = unquote(opts)

      base_opts = [player_id: player_id, category: :quest, event_type: event_type]
      events = GameLog.get_events(Keyword.merge(base_opts, opts))

      if Enum.empty?(events) do
        all_events = GameLog.get_events(player_id: player_id, category: :quest)

        raise ExUnit.AssertionError,
          message: "Expected GameLog to contain #{event_type} event",
          left: Enum.map(all_events, & &1.event_type),
          right: event_type
      end
    end
  end

  @doc """
  Asserts that rewards were properly applied to game state.
  """
  defmacro assert_rewards_received(game_state, expected) do
    quote do
      game_state = unquote(game_state)
      expected = unquote(expected)

      if xp = Keyword.get(expected, :xp) do
        actual_xp = Map.get(game_state.stats, "xp") || Map.get(game_state.stats, :xp, 0)

        unless actual_xp >= xp do
          raise ExUnit.AssertionError,
            message: "Expected at least #{xp} XP",
            left: actual_xp,
            right: xp
        end
      end

      if gold = Keyword.get(expected, :gold) do
        actual_gold = Map.get(game_state.flags, "gold") || Map.get(game_state.flags, :gold, 0)

        unless actual_gold >= gold do
          raise ExUnit.AssertionError,
            message: "Expected at least #{gold} gold",
            left: actual_gold,
            right: gold
        end
      end

      if items = Keyword.get(expected, :items) do
        Enum.each(items, fn item_id ->
          unless item_id in game_state.inventory do
            raise ExUnit.AssertionError,
              message: "Expected item '#{item_id}' in inventory",
              left: game_state.inventory,
              right: item_id
          end
        end)
      end
    end
  end

  @doc """
  Asserts that a quest definition is valid.
  """
  defmacro assert_quest_valid(quest_id) do
    quote do
      quest_id = unquote(quest_id)

      case Loka.Testing.Quest.QuestTester.validate_quest(quest_id) do
        {:ok, :valid} ->
          :ok

        {:error, reason} ->
          raise ExUnit.AssertionError,
            message: "Quest '#{quest_id}' is invalid: #{inspect(reason)}"
      end
    end
  end

  # =============================================================================
  # Helper Functions (not macros)
  # =============================================================================

  @doc """
  Checks if a quest is active. Returns boolean.
  """
  def quest_active?(game_state, quest_id) do
    active_quests = Quest.get_active_quests(game_state)
    Enum.any?(active_quests, &(&1.id == quest_id))
  end

  @doc """
  Checks if a quest is completed. Returns boolean.
  """
  def quest_completed?(game_state, quest_id) do
    quest_id in Quest.get_completed_quests(game_state)
  end

  @doc """
  Checks if an objective is complete. Returns boolean.
  """
  def objective_complete?(game_state, quest_id, objective_id) do
    progress = Quest.get_quest_progress(game_state, quest_id)
    objectives = (progress && (progress["objectives"] || progress[:objectives])) || %{}
    obj_status = Map.get(objectives, objective_id, %{})
    Map.get(obj_status, "completed") || Map.get(obj_status, :completed, false)
  end

  @doc """
  Gets the progress count for an objective.
  """
  def objective_progress(game_state, quest_id, objective_id) do
    progress = Quest.get_quest_progress(game_state, quest_id)
    objectives = (progress && (progress["objectives"] || progress[:objectives])) || %{}
    obj_status = Map.get(objectives, objective_id, %{})
    Map.get(obj_status, "progress") || Map.get(obj_status, :progress, 0)
  end

  @doc """
  Gets the number of events of a specific type from GameLog.
  """
  def event_count(player_id, event_type, opts \\ []) do
    base_opts = [player_id: player_id, category: :quest, event_type: event_type]
    events = GameLog.get_events(Keyword.merge(base_opts, opts))
    length(events)
  end
end
