defmodule Loka.Admin.GameLog.Quest do
  @moduledoc """
  Quest-specific convenience functions for GameLog.

  Provides the same API as the old Quest.EventLog for easy migration.
  """

  alias Loka.Admin.GameLog

  @doc "Log a quest accepted event."
  def log_accepted(player_id, quest_id, opts \\ []) do
    GameLog.log(
      :quest,
      :quest_accepted,
      %{quest_id: quest_id},
      Keyword.merge(opts, player_id: player_id, metadata: %{quest_id: quest_id})
    )
  end

  @doc "Log a quest abandoned event."
  def log_abandoned(player_id, quest_id, reason \\ nil, opts \\ []) do
    details = %{quest_id: quest_id}
    details = if reason, do: Map.put(details, :reason, reason), else: details

    GameLog.log(
      :quest,
      :quest_abandoned,
      details,
      Keyword.merge(opts, player_id: player_id, metadata: %{quest_id: quest_id})
    )
  end

  @doc "Log a quest completed (turned in) event."
  def log_completed(player_id, quest_id, rewards, opts \\ []) do
    GameLog.log(
      :quest,
      :quest_completed,
      %{quest_id: quest_id, rewards: rewards},
      Keyword.merge(opts, player_id: player_id, metadata: %{quest_id: quest_id})
    )
  end

  @doc "Log objective progress event."
  def log_objective_progress(
        player_id,
        quest_id,
        objective_id,
        old_progress,
        new_progress,
        trigger,
        opts \\ []
      ) do
    GameLog.log(
      :quest,
      :objective_progress,
      %{
        quest_id: quest_id,
        objective_id: objective_id,
        old_progress: old_progress,
        new_progress: new_progress,
        trigger: trigger
      },
      Keyword.merge(opts,
        player_id: player_id,
        metadata: %{quest_id: quest_id, objective_id: objective_id}
      )
    )
  end

  @doc "Log objective completed event."
  def log_objective_completed(player_id, quest_id, objective_id, opts \\ []) do
    GameLog.log(
      :quest,
      :objective_completed,
      %{quest_id: quest_id, objective_id: objective_id},
      Keyword.merge(opts,
        player_id: player_id,
        metadata: %{quest_id: quest_id, objective_id: objective_id}
      )
    )
  end

  @doc "Log objective expired event (timed objectives)."
  def log_objective_expired(player_id, quest_id, objective_id, time_limit, opts \\ []) do
    GameLog.log(
      :quest,
      :objective_expired,
      %{quest_id: quest_id, objective_id: objective_id, time_limit: time_limit},
      Keyword.merge(opts,
        player_id: player_id,
        metadata: %{quest_id: quest_id, objective_id: objective_id}
      )
    )
  end

  @doc "Log chain progression event (auto-starting next quest in chain)."
  def log_chain_progression(player_id, completed_quest_id, auto_started, opts \\ []) do
    GameLog.log(
      :quest,
      :chain_progression,
      %{completed_quest_id: completed_quest_id, auto_started: auto_started},
      Keyword.merge(opts,
        player_id: player_id,
        metadata: %{quest_id: completed_quest_id}
      )
    )
  end
end
