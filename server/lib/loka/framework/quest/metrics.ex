defmodule Loka.Framework.Quest.Metrics do
  @moduledoc """
  Quest metrics and analytics module.

  Tracks and reports on quest-related metrics including:
  - Quest acceptance and completion rates
  - Time to complete quests
  - Most/least popular quests
  - Objective completion patterns

  ## Usage

      # Get overall metrics
      {:ok, metrics} = Metrics.get_summary()

      # Get metrics for a specific quest
      {:ok, quest_metrics} = Metrics.get_quest_metrics("intro_find_temple")

      # Get player-specific quest stats
      {:ok, player_stats} = Metrics.get_player_stats(player_id)

  ## Notes

  This module aggregates data from the GameLog and entity tables.
  For performance, consider caching results for frequently-accessed metrics.
  """

  require Logger

  alias Loka.Framework.Quest.Definitions
  alias Loka.Admin.GameLog
  alias Loka.Engine.Entities

  # =============================================================================
  # Summary Metrics
  # =============================================================================

  @doc """
  Gets overall quest system metrics summary.
  """
  def get_summary do
    all_quests = Definitions.all_quest_definitions()
    player_states = list_all_player_quest_states()

    active_counts = count_active_quests(player_states)
    completed_counts = count_completed_quests(player_states)

    metrics = %{
      total_quests_defined: length(all_quests),
      total_players_with_quests: count_players_with_quests(player_states),
      total_active_quests: active_counts.total,
      total_completed_quests: completed_counts.total,
      most_popular_quests: get_most_popular_quests(completed_counts.by_quest, 5),
      least_completed_quests:
        get_least_completed_quests(all_quests, completed_counts.by_quest, 5),
      completion_rate: calculate_overall_completion_rate(active_counts, completed_counts),
      quests_by_type: group_quests_by_type(all_quests)
    }

    {:ok, metrics}
  end

  @doc """
  Gets metrics for a specific quest.
  """
  def get_quest_metrics(quest_id) do
    player_states = list_all_player_quest_states()

    active_count =
      player_states
      |> Enum.count(fn state ->
        active = get_in(state.quests, ["active"]) || %{}
        Map.has_key?(active, quest_id)
      end)

    completed_count =
      player_states
      |> Enum.count(fn state ->
        completed = get_in(state.quests, ["completed"]) || []
        quest_id in completed
      end)

    # Get objective completion stats from game log
    events =
      GameLog.get_events(category: :quest, limit: 1000)
      |> Enum.filter(fn e -> get_in(e.metadata, [:quest_id]) == quest_id end)

    objective_stats = analyze_objective_events(events)

    metrics = %{
      quest_id: quest_id,
      currently_active: active_count,
      times_completed: completed_count,
      total_attempts: active_count + completed_count,
      completion_rate:
        if(active_count + completed_count > 0,
          do: completed_count / (active_count + completed_count),
          else: 0.0
        ),
      objective_stats: objective_stats,
      recent_events: Enum.take(events, 10)
    }

    {:ok, metrics}
  end

  @doc """
  Gets quest statistics for a specific player.
  """
  def get_player_stats(player_id) do
    case Entities.find_one(account_id: player_id) do
      {:error, :not_found} ->
        {:error, :no_character}

      {:ok, character} ->
        quests = character.components["quest_progress"] || %{}
        active = get_in(quests, ["active"]) || %{}
        completed = get_in(quests, ["completed"]) || []

        events = GameLog.get_events(player_id: player_id, category: :quest, limit: 100)

        stats = %{
          player_id: player_id,
          active_quests: map_size(active),
          completed_quests: length(completed),
          total_quests_attempted: map_size(active) + length(completed),
          recent_events: Enum.take(events, 20),
          active_quest_ids: Map.keys(active),
          completed_quest_ids: completed
        }

        {:ok, stats}
    end
  end

  # =============================================================================
  # Quest Popularity Analysis
  # =============================================================================

  @doc """
  Gets quests sorted by popularity (completion count).
  """
  def get_quests_by_popularity(opts \\ []) do
    limit = Keyword.get(opts, :limit, 10)
    player_states = list_all_player_quest_states()
    completed_counts = count_completed_quests(player_states)

    sorted =
      completed_counts.by_quest
      |> Enum.sort_by(fn {_quest_id, count} -> count end, :desc)
      |> Enum.take(limit)
      |> Enum.map(fn {quest_id, count} ->
        quest = Definitions.get_quest_definition(quest_id)

        %{
          quest_id: quest_id,
          name: (quest && quest.name) || quest_id,
          type: (quest && quest.type) || :unknown,
          completions: count
        }
      end)

    {:ok, sorted}
  end

  @doc """
  Identifies quests that may have issues (high abandonment, low completion).
  """
  def identify_problem_quests do
    player_states = list_all_player_quest_states()
    active_counts = count_active_quests(player_states)
    completed_counts = count_completed_quests(player_states)
    all_quests = Definitions.all_quest_definitions()

    problems =
      all_quests
      |> Enum.map(fn quest ->
        active = Map.get(active_counts.by_quest, quest.id, 0)
        completed = Map.get(completed_counts.by_quest, quest.id, 0)
        total = active + completed

        abandonment_rate =
          if total > 0, do: active / total, else: 0.0

        %{
          quest_id: quest.id,
          name: quest.name,
          type: quest.type,
          active: active,
          completed: completed,
          abandonment_rate: abandonment_rate,
          issue:
            cond do
              total == 0 -> :never_attempted
              abandonment_rate > 0.7 and total >= 3 -> :high_abandonment
              completed == 0 and active >= 3 -> :never_completed
              true -> nil
            end
        }
      end)
      |> Enum.filter(& &1.issue)
      |> Enum.sort_by(& &1.abandonment_rate, :desc)

    {:ok, problems}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp list_all_player_quest_states do
    Entities.find_all(type: :character)
    |> Enum.map(fn entity ->
      %{quests: entity.components["quest_progress"] || %{}}
    end)
  end

  defp count_players_with_quests(player_states) do
    Enum.count(player_states, fn state ->
      active = get_in(state.quests, ["active"]) || %{}
      completed = get_in(state.quests, ["completed"]) || []
      map_size(active) > 0 or completed != []
    end)
  end

  defp count_active_quests(player_states) do
    by_quest =
      player_states
      |> Enum.flat_map(fn state ->
        active = get_in(state.quests, ["active"]) || %{}
        Map.keys(active)
      end)
      |> Enum.frequencies()

    total = Enum.sum(Map.values(by_quest))

    %{total: total, by_quest: by_quest}
  end

  defp count_completed_quests(player_states) do
    by_quest =
      player_states
      |> Enum.flat_map(fn state ->
        get_in(state.quests, ["completed"]) || []
      end)
      |> Enum.frequencies()

    total = Enum.sum(Map.values(by_quest))

    %{total: total, by_quest: by_quest}
  end

  defp get_most_popular_quests(by_quest, limit) do
    by_quest
    |> Enum.sort_by(fn {_quest_id, count} -> count end, :desc)
    |> Enum.take(limit)
    |> Enum.map(fn {quest_id, count} ->
      quest = Definitions.get_quest_definition(quest_id)
      %{quest_id: quest_id, name: (quest && quest.name) || quest_id, completions: count}
    end)
  end

  defp get_least_completed_quests(all_quests, completed_counts, limit) do
    all_quests
    |> Enum.map(fn quest ->
      count = Map.get(completed_counts, quest.id, 0)
      %{quest_id: quest.id, name: quest.name, completions: count}
    end)
    |> Enum.sort_by(& &1.completions, :asc)
    |> Enum.take(limit)
  end

  defp calculate_overall_completion_rate(active_counts, completed_counts) do
    total = active_counts.total + completed_counts.total

    if total > 0 do
      completed_counts.total / total
    else
      0.0
    end
  end

  defp group_quests_by_type(all_quests) do
    all_quests
    |> Enum.group_by(& &1.type)
    |> Enum.map(fn {type, quests} -> {type, length(quests)} end)
    |> Enum.into(%{})
  end

  defp analyze_objective_events(events) do
    events
    |> Enum.filter(&(&1.event_type in [:objective_progress, :objective_completed]))
    |> Enum.group_by(&get_in(&1.data, [:objective_id]))
    |> Enum.map(fn {obj_id, obj_events} ->
      completions = Enum.count(obj_events, &(&1.event_type == :objective_completed))
      progress_updates = Enum.count(obj_events, &(&1.event_type == :objective_progress))

      %{
        objective_id: obj_id,
        completions: completions,
        progress_updates: progress_updates
      }
    end)
  end
end
