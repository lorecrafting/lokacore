defmodule Loka.Testing.Balance.ReportGenerator do
  @moduledoc """
  Generates human-readable reports from balance analysis.

  Supports Markdown and JSON output formats for different use cases:
  - Markdown for human review and documentation
  - JSON for dashboard consumption and programmatic access

  ## Usage

      # Generate Markdown report
      combat_results = CombatSimulator.simulate(player, enemy)
      report = ReportGenerator.combat_report(combat_results, :markdown)

      # Generate full balance report
      report = ReportGenerator.full_report(combat_data, progression_data, :markdown)
  """

  @type format :: :markdown | :json

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Generates a combat analysis report.
  """
  @spec combat_report(map() | [map()], format()) :: String.t() | map()
  def combat_report(results, format \\ :markdown)

  def combat_report(results, :markdown) when is_map(results) do
    """
    ## Combat Analysis

    **Iterations:** #{results.iterations}

    ### Results

    | Outcome | Count | Rate |
    |---------|-------|------|
    | Wins | #{results.wins} | #{format_percent(results.win_rate)} |
    | Losses | #{results.losses} | #{format_percent(results.loss_rate)} |
    | Flees | #{results.flees} | #{format_percent(results.flees / results.iterations)} |

    ### Combat Statistics

    - **Average Turns:** #{Float.round(results.avg_turns, 1)}
    - **Average Damage Dealt:** #{Float.round(results.avg_damage_dealt, 1)}
    - **Average Damage Taken:** #{Float.round(results.avg_damage_taken, 1)}

    ### Damage Distribution

    #{format_histogram(results.damage_dealt_histogram, "Damage Dealt")}
    """
  end

  def combat_report(results, :json) when is_map(results) do
    %{
      type: "combat_analysis",
      iterations: results.iterations,
      outcomes: %{
        wins: results.wins,
        losses: results.losses,
        flees: results.flees,
        win_rate: results.win_rate,
        loss_rate: results.loss_rate
      },
      statistics: %{
        avg_turns: Float.round(results.avg_turns, 2),
        avg_damage_dealt: Float.round(results.avg_damage_dealt, 2),
        avg_damage_taken: Float.round(results.avg_damage_taken, 2)
      },
      histograms: %{
        damage_dealt: results.damage_dealt_histogram,
        damage_taken: results.damage_taken_histogram
      }
    }
  end

  @doc """
  Generates a level progression curve report.
  """
  @spec level_curve_report([{non_neg_integer(), map()}], format()) :: String.t() | map()
  def level_curve_report(level_results, format \\ :markdown)

  def level_curve_report(level_results, :markdown) do
    rows =
      level_results
      |> Enum.map(fn {level, results} ->
        "| #{level} | #{format_percent(results.win_rate)} | #{Float.round(results.avg_turns, 1)} | #{Float.round(results.avg_damage_dealt, 1)} |"
      end)
      |> Enum.join("\n")

    """
    ## Level Progression Curve

    Shows how combat performance changes with player level.

    | Level | Win Rate | Avg Turns | Avg Damage |
    |-------|----------|-----------|------------|
    #{rows}

    ### Win Rate Trend

    #{format_ascii_chart(level_results, :win_rate)}
    """
  end

  def level_curve_report(level_results, :json) do
    %{
      type: "level_curve",
      data:
        Enum.map(level_results, fn {level, results} ->
          %{
            level: level,
            win_rate: results.win_rate,
            avg_turns: Float.round(results.avg_turns, 2),
            avg_damage_dealt: Float.round(results.avg_damage_dealt, 2),
            avg_damage_taken: Float.round(results.avg_damage_taken, 2)
          }
        end)
    }
  end

  @doc """
  Generates a progression analysis report.
  """
  @spec progression_report(map(), format()) :: String.t() | map()
  def progression_report(results, format \\ :markdown)

  def progression_report(results, :markdown) do
    level_rows =
      results.level_progression
      |> Enum.map(fn {level, data} ->
        "| #{level} | #{data.avg_sessions_to_reach} | #{data.sample_size} |"
      end)
      |> Enum.join("\n")

    bottleneck_section =
      if Enum.empty?(results.bottlenecks) do
        "_No significant bottlenecks detected._"
      else
        results.bottlenecks
        |> Enum.map(fn {level, reason} -> "- **Level #{level}:** #{reason}" end)
        |> Enum.join("\n")
      end

    """
    ## Progression Analysis

    **Sessions Simulated:** #{results.sessions_simulated}
    **Target Level:** #{results.target_level}
    **Average Sessions to Target:** #{results.avg_sessions_to_target}

    ### Level Progression

    | Level | Avg Sessions | Samples |
    |-------|--------------|---------|
    #{level_rows}

    ### Bottlenecks

    #{bottleneck_section}
    """
  end

  def progression_report(results, :json) do
    %{
      type: "progression_analysis",
      sessions_simulated: results.sessions_simulated,
      target_level: results.target_level,
      avg_sessions_to_target: results.avg_sessions_to_target,
      level_progression:
        Enum.map(results.level_progression, fn {level, data} ->
          Map.put(data, :level, level)
        end),
      bottlenecks:
        Enum.map(results.bottlenecks, fn {level, reason} ->
          %{level: level, reason: reason}
        end)
    }
  end

  @doc """
  Generates a comprehensive balance report combining all analyses.
  """
  @spec full_report(map(), map(), format()) :: String.t() | map()
  def full_report(combat_data, progression_data, format \\ :markdown)

  def full_report(combat_data, progression_data, :markdown) do
    timestamp = DateTime.utc_now() |> DateTime.to_iso8601()

    """
    # Loka Balance Analysis Report

    **Generated:** #{timestamp}

    ---

    #{combat_report(combat_data, :markdown)}

    ---

    #{progression_report(progression_data, :markdown)}

    ---

    ## Summary

    #{generate_summary(combat_data, progression_data)}
    """
  end

  def full_report(combat_data, progression_data, :json) do
    %{
      type: "full_balance_report",
      generated_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      combat: combat_report(combat_data, :json),
      progression: progression_report(progression_data, :json),
      summary: generate_summary_data(combat_data, progression_data)
    }
  end

  @doc """
  Generates a quick summary of balance health.
  """
  @spec balance_summary(map(), map()) :: map()
  def balance_summary(combat_data, progression_data) do
    combat_health = assess_combat_health(combat_data)
    progression_health = assess_progression_health(progression_data)

    overall =
      case {combat_health.status, progression_health.status} do
        {:good, :good} -> :healthy
        {:warning, _} -> :needs_attention
        {_, :warning} -> :needs_attention
        {:critical, _} -> :critical
        {_, :critical} -> :critical
        _ -> :unknown
      end

    %{
      overall_status: overall,
      combat: combat_health,
      progression: progression_health
    }
  end

  # =============================================================================
  # Private - Formatting Helpers
  # =============================================================================

  defp format_percent(rate) when is_float(rate) do
    "#{Float.round(rate * 100, 1)}%"
  end

  defp format_percent(_), do: "N/A"

  defp format_histogram(histogram, _title) when map_size(histogram) == 0 do
    "_No data_"
  end

  defp format_histogram(histogram, title) do
    max_count = histogram |> Map.values() |> Enum.max()

    bars =
      histogram
      |> Enum.sort_by(fn {bucket, _} -> bucket end)
      |> Enum.map(fn {bucket, count} ->
        bar_length = div(count * 20, max_count)
        bar = String.duplicate("█", bar_length)
        "#{String.pad_leading("#{bucket}-#{bucket + 9}", 8)}: #{bar} (#{count})"
      end)
      |> Enum.join("\n")

    """
    #### #{title}

    ```
    #{bars}
    ```
    """
  end

  defp format_ascii_chart(level_results, field) do
    data =
      Enum.map(level_results, fn {level, results} ->
        {level, Map.get(results, field, 0)}
      end)

    max_val = data |> Enum.map(fn {_, v} -> v end) |> Enum.max()

    chart =
      data
      |> Enum.map(fn {level, value} ->
        bar_length = if max_val > 0, do: trunc(value / max_val * 30), else: 0
        bar = String.duplicate("▓", bar_length)
        "L#{String.pad_leading("#{level}", 2)}: #{bar} #{format_percent(value)}"
      end)
      |> Enum.join("\n")

    """
    ```
    #{chart}
    ```
    """
  end

  # =============================================================================
  # Private - Summary Generation
  # =============================================================================

  defp generate_summary(combat_data, progression_data) do
    combat_status = if combat_data.win_rate >= 0.5, do: "balanced", else: "challenging"

    progression_status =
      if Enum.empty?(progression_data.bottlenecks), do: "smooth", else: "has bottlenecks"

    """
    - **Combat Balance:** #{combat_status} (#{format_percent(combat_data.win_rate)} win rate)
    - **Progression:** #{progression_status}
    - **Recommended Actions:** #{generate_recommendations(combat_data, progression_data)}
    """
  end

  defp generate_summary_data(combat_data, progression_data) do
    %{
      combat_balance: if(combat_data.win_rate >= 0.5, do: "balanced", else: "challenging"),
      combat_win_rate: combat_data.win_rate,
      progression_status:
        if(Enum.empty?(progression_data.bottlenecks), do: "smooth", else: "has_bottlenecks"),
      bottleneck_count: length(progression_data.bottlenecks)
    }
  end

  defp generate_recommendations(combat_data, progression_data) do
    recommendations = []

    recommendations =
      if combat_data.win_rate < 0.3 do
        ["Consider reducing enemy stats or increasing player damage" | recommendations]
      else
        recommendations
      end

    recommendations =
      if combat_data.win_rate > 0.95 do
        ["Combat may be too easy - consider increasing difficulty" | recommendations]
      else
        recommendations
      end

    recommendations =
      if progression_data.bottlenecks != [] do
        ["Review XP curve at bottleneck levels" | recommendations]
      else
        recommendations
      end

    if Enum.empty?(recommendations) do
      "None - balance appears healthy"
    else
      Enum.join(recommendations, "; ")
    end
  end

  defp assess_combat_health(combat_data) do
    cond do
      combat_data.win_rate < 0.2 or combat_data.win_rate > 0.98 ->
        %{
          status: :critical,
          message: "Win rate is extreme (#{format_percent(combat_data.win_rate)})"
        }

      combat_data.win_rate < 0.4 or combat_data.win_rate > 0.9 ->
        %{status: :warning, message: "Win rate may need adjustment"}

      true ->
        %{status: :good, message: "Combat balance is healthy"}
    end
  end

  defp assess_progression_health(progression_data) do
    bottleneck_count = length(progression_data.bottlenecks)

    cond do
      bottleneck_count > 3 ->
        %{status: :critical, message: "Multiple progression bottlenecks detected"}

      bottleneck_count > 0 ->
        %{status: :warning, message: "Some progression bottlenecks exist"}

      true ->
        %{status: :good, message: "Progression curve is smooth"}
    end
  end
end
