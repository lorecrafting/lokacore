defmodule Loka.Testing.Balance.ProgressionSimulator do
  @moduledoc """
  Simulates XP progression over play sessions.

  Calculates time-to-level, validates XP curve formula, and identifies
  potential progression issues (too fast, too slow, dead zones).

  ## XP Formula

  The game uses `100 * level^2` for XP requirements per level:
  - Level 2: 400 XP
  - Level 3: 900 XP
  - Level 4: 1600 XP
  - etc.

  ## Usage

      # Simulate progression to level 10
      results = ProgressionSimulator.simulate(target_level: 10, sessions: 100)

      # Validate the XP curve
      curve = ProgressionSimulator.analyze_xp_curve(1, 20)

  ## Result Structure

      %{
        sessions_simulated: 100,
        target_level: 10,
        sessions_to_target: 45.2,
        level_progression: [
          {1, %{avg_sessions: 0, avg_xp_per_session: 150}},
          {2, %{avg_sessions: 2.7, avg_xp_per_session: 150}},
          ...
        ],
        bottlenecks: [{8, "Level 8 takes 2.5x longer than previous"}]
      }
  """

  @type progression_result :: %{
          sessions_simulated: non_neg_integer(),
          target_level: non_neg_integer(),
          avg_sessions_to_target: float(),
          level_progression: [{non_neg_integer(), map()}],
          bottlenecks: [{non_neg_integer(), String.t()}]
        }

  @default_sessions 100

  # XP sources per session (average)
  @default_xp_sources %{
    combat: %{min: 50, max: 150, weight: 0.6},
    quests: %{min: 100, max: 300, weight: 0.25},
    exploration: %{min: 20, max: 50, weight: 0.15}
  }

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Simulates progression to a target level.

  ## Options

  - `:target_level` - Level to reach (default: 10)
  - `:sessions` - Number of simulated "sessions" (default: 100)
  - `:xp_per_session` - Fixed XP per session (overrides xp_sources)
  - `:xp_sources` - Map of XP sources with min/max/weight (see @default_xp_sources)
  - `:starting_level` - Starting level (default: 1)

  Returns progression statistics.
  """
  @spec simulate(keyword()) :: progression_result()
  def simulate(opts \\ []) do
    target_level = Keyword.get(opts, :target_level, 10)
    sessions = Keyword.get(opts, :sessions, @default_sessions)
    xp_sources = Keyword.get(opts, :xp_sources, @default_xp_sources)
    starting_level = Keyword.get(opts, :starting_level, 1)
    fixed_xp = Keyword.get(opts, :xp_per_session)

    # Run multiple simulations
    results =
      Enum.map(1..sessions, fn _ ->
        simulate_single_progression(starting_level, target_level, xp_sources, fixed_xp)
      end)

    aggregate_progression_results(results, sessions, target_level)
  end

  @doc """
  Analyzes the XP curve formula across a level range.

  Returns data about XP requirements, expected time at each level,
  and potential balance issues.
  """
  @spec analyze_xp_curve(non_neg_integer(), non_neg_integer(), keyword()) :: map()
  def analyze_xp_curve(min_level, max_level, opts \\ []) do
    avg_xp_per_session = Keyword.get(opts, :avg_xp_per_session, 100)

    levels = min_level..max_level

    curve_data =
      Enum.map(levels, fn level ->
        xp_required = xp_for_level(level)
        xp_to_next = xp_for_level(level + 1) - xp_required
        sessions_estimate = xp_to_next / avg_xp_per_session

        %{
          level: level,
          total_xp: xp_required,
          xp_to_next: xp_to_next,
          estimated_sessions: Float.round(sessions_estimate, 1)
        }
      end)

    # Identify issues
    issues = identify_curve_issues(curve_data)

    %{
      formula: "100 * level^2",
      min_level: min_level,
      max_level: max_level,
      curve_data: curve_data,
      issues: issues,
      total_xp_to_max: xp_for_level(max_level),
      avg_sessions_to_max: total_sessions_estimate(curve_data)
    }
  end

  @doc """
  Validates the XP curve against expected progression times.

  Returns `:ok` if the curve is balanced, or `{:issues, list}` if problems found.
  """
  @spec validate_xp_curve(keyword()) :: :ok | {:issues, [String.t()]}
  def validate_xp_curve(opts \\ []) do
    min_level = Keyword.get(opts, :min_level, 1)
    max_level = Keyword.get(opts, :max_level, 20)
    max_sessions_per_level = Keyword.get(opts, :max_sessions_per_level, 20)
    max_session_jump = Keyword.get(opts, :max_session_jump, 2.0)

    analysis = analyze_xp_curve(min_level, max_level, opts)

    issues =
      Enum.flat_map(analysis.curve_data, fn data ->
        level_issues = []

        # Check if level takes too long
        level_issues =
          if data.estimated_sessions > max_sessions_per_level do
            [
              "Level #{data.level} takes #{data.estimated_sessions} sessions (max: #{max_sessions_per_level})"
              | level_issues
            ]
          else
            level_issues
          end

        level_issues
      end)

    # Check for sudden jumps in difficulty
    jump_issues =
      analysis.curve_data
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.flat_map(fn [prev, curr] ->
        if curr.estimated_sessions > prev.estimated_sessions * max_session_jump do
          [
            "Level #{curr.level} is #{Float.round(curr.estimated_sessions / prev.estimated_sessions, 1)}x harder than level #{prev.level}"
          ]
        else
          []
        end
      end)

    all_issues = issues ++ jump_issues ++ analysis.issues

    if Enum.empty?(all_issues) do
      :ok
    else
      {:issues, all_issues}
    end
  end

  # =============================================================================
  # Private - Simulation
  # =============================================================================

  defp simulate_single_progression(starting_level, target_level, xp_sources, fixed_xp) do
    # Start with base XP for starting level
    initial_xp = xp_for_level(starting_level)

    state = %{
      level: starting_level,
      xp: initial_xp,
      session_count: 0,
      level_history: [{starting_level, 0, initial_xp}]
    }

    # Run sessions until target level reached
    play_sessions(state, target_level, xp_sources, fixed_xp)
  end

  defp play_sessions(state, target_level, _xp_sources, _fixed_xp)
       when state.level >= target_level do
    state
  end

  defp play_sessions(state, target_level, xp_sources, fixed_xp) do
    # Simulate one session's XP gain
    xp_gained = if fixed_xp, do: fixed_xp, else: calculate_session_xp(xp_sources, state.level)

    new_xp = state.xp + xp_gained
    new_session = state.session_count + 1

    # Check for level ups
    {new_level, new_xp, level_history} =
      check_level_ups(state.level, new_xp, new_session, state.level_history)

    new_state = %{
      state
      | level: new_level,
        xp: new_xp,
        session_count: new_session,
        level_history: level_history
    }

    play_sessions(new_state, target_level, xp_sources, fixed_xp)
  end

  defp calculate_session_xp(xp_sources, player_level) do
    Enum.reduce(xp_sources, 0, fn {_source, config}, acc ->
      if :rand.uniform() <= config.weight do
        # Scale XP with level (higher levels get slightly more)
        level_multiplier = 1 + (player_level - 1) * 0.1
        base_xp = config.min + :rand.uniform(config.max - config.min + 1) - 1
        acc + trunc(base_xp * level_multiplier)
      else
        acc
      end
    end)
  end

  defp check_level_ups(level, xp, session, history) do
    next_level_xp = xp_for_level(level + 1)

    if xp >= next_level_xp do
      new_history = [{level + 1, session, xp} | history]
      check_level_ups(level + 1, xp, session, new_history)
    else
      {level, xp, history}
    end
  end

  # =============================================================================
  # Private - XP Formula
  # =============================================================================

  @doc false
  def xp_for_level(level) when level <= 1, do: 0
  def xp_for_level(level), do: 100 * level * level

  # =============================================================================
  # Private - Results Aggregation
  # =============================================================================

  defp aggregate_progression_results(results, sessions, target_level) do
    # Calculate average sessions to target
    avg_sessions =
      results
      |> Enum.map(& &1.session_count)
      |> Enum.sum()
      |> Kernel./(sessions)

    # Build level progression data
    level_data =
      results
      |> Enum.flat_map(& &1.level_history)
      |> Enum.group_by(fn {level, _, _} -> level end)
      |> Enum.map(fn {level, entries} ->
        sessions_list = Enum.map(entries, fn {_, session, _} -> session end)
        avg = Enum.sum(sessions_list) / length(sessions_list)
        {level, %{avg_sessions_to_reach: Float.round(avg, 1), sample_size: length(entries)}}
      end)
      |> Enum.sort_by(fn {level, _} -> level end)

    # Identify bottlenecks
    bottlenecks = identify_bottlenecks(level_data)

    %{
      sessions_simulated: sessions,
      target_level: target_level,
      avg_sessions_to_target: Float.round(avg_sessions, 1),
      level_progression: level_data,
      bottlenecks: bottlenecks
    }
  end

  defp identify_bottlenecks(level_data) do
    level_data
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.flat_map(fn [{prev_level, prev_data}, {curr_level, curr_data}] ->
      sessions_diff = curr_data.avg_sessions_to_reach - prev_data.avg_sessions_to_reach

      # A level is a bottleneck if it takes significantly longer than the previous
      if sessions_diff > prev_data.avg_sessions_to_reach * 0.5 and sessions_diff > 2 do
        ratio = Float.round(sessions_diff / max(1, prev_data.avg_sessions_to_reach), 1)
        [{curr_level, "Takes #{ratio}x longer than level #{prev_level}"}]
      else
        []
      end
    end)
  end

  defp identify_curve_issues(curve_data) do
    curve_data
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.flat_map(fn [prev, curr] ->
      # Check for very large jumps (more than 50% increase)
      if curr.xp_to_next > prev.xp_to_next * 1.5 do
        ratio = Float.round(curr.xp_to_next / prev.xp_to_next, 1)
        ["Level #{curr.level} XP requirement jumps #{ratio}x from previous"]
      else
        []
      end
    end)
  end

  defp total_sessions_estimate(curve_data) do
    curve_data
    |> Enum.map(& &1.estimated_sessions)
    |> Enum.sum()
    |> Float.round(1)
  end
end
