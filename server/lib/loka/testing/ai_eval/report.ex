defmodule Loka.Testing.AIEval.Report do
  @moduledoc """
  Generates formatted reports from AI eval results.

  Reads stored eval results and produces formatted terminal output
  with phase breakdown, scoring, and comparison to previous runs.
  """

  @doc """
  Print a formatted report of all eval results, or the most recent run.
  """
  @spec print_report(keyword()) :: :ok
  def print_report(opts \\ []) do
    results_dir = Path.join([:code.priv_dir(:loka), "llm_logs", "eval_results"])

    unless File.exists?(results_dir) do
      Mix.shell().info("No eval results found. Run `mix loka.test.ai --eval` first.")
      return_ok()
    end

    files = list_result_files(results_dir, opts)

    if files == [] do
      Mix.shell().info("No eval results found matching criteria.")
      return_ok()
    end

    # Group by date + prompt version
    results =
      files
      |> Enum.map(&load_result/1)
      |> Enum.reject(&is_nil/1)

    latest_version = opts[:prompt] || detect_latest_version(results)

    latest_results = Enum.filter(results, fn r -> r["prompt_version"] == latest_version end)

    print_header(latest_version)
    print_scenario_table(latest_results)
    print_common_issues(latest_results)
    print_comparison(results, latest_version)
    print_footer()

    :ok
  end

  # ---------------------------------------------------------------------------
  # Formatting
  # ---------------------------------------------------------------------------

  defp print_header(version) do
    date = Date.to_iso8601(Date.utc_today())

    Mix.shell().info("")
    Mix.shell().info(String.duplicate("=", 60))
    Mix.shell().info("  AI Builder Eval Report - #{date} (prompt: #{version})")
    Mix.shell().info(String.duplicate("=", 60))
    Mix.shell().info("")
  end

  defp print_scenario_table(results) do
    # Header
    Mix.shell().info(
      "  #{pad("Scenario", 18)} #{pad("Create", 10)} #{pad("Edit", 10)} #{pad("Modify", 10)} #{pad("Delete", 10)} #{pad("Avg", 10)} #{pad("Duration", 10)}"
    )

    Mix.shell().info("  " <> String.duplicate("-", 78))

    Enum.each(results, fn result ->
      phases = result["phases"] || []

      phase_scores =
        Enum.map([:create, :edit, :modify, :delete], fn phase_name ->
          phase =
            Enum.find(phases, fn p ->
              to_string(p["phase"]) == to_string(phase_name)
            end)

          if phase do
            structural = phase["structural"] || %{}
            cq = phase["content_quality"] || %{}
            total = (structural["total"] || 0) + (cq["total"] || 0)
            max = (structural["max"] || 0) + (cq["max"] || 0)
            "#{total}/#{max}"
          else
            "-"
          end
        end)

      total = result["total_score"] || 0
      max = result["max_score"] || 1
      duration_ms = result["total_duration_ms"] || 0
      duration_str = format_duration(duration_ms)

      avg_pct = round(total / max * 100)

      line =
        "  #{pad(result["scenario"] || "?", 18)} " <>
          Enum.map_join(phase_scores, " ", &pad(&1, 10)) <>
          " #{pad("#{avg_pct}%", 10)} #{pad(duration_str, 10)}"

      Mix.shell().info(line)
    end)

    Mix.shell().info("")

    # Overall
    if results != [] do
      total = Enum.sum(Enum.map(results, fn r -> r["total_score"] || 0 end))
      max = Enum.sum(Enum.map(results, fn r -> r["max_score"] || 1 end))
      pct = if max > 0, do: round(total / max * 100), else: 0
      Mix.shell().info("  Overall: #{total}/#{max} (#{pct}%)")
      Mix.shell().info("")
    end
  end

  defp print_common_issues(results) do
    issues =
      results
      |> Enum.flat_map(fn result ->
        (result["phases"] || [])
        |> Enum.flat_map(fn phase ->
          structural = phase["structural"] || %{}
          checks = structural["checks"] || []

          checks
          |> Enum.reject(fn c -> c["passed"] end)
          |> Enum.map(fn c ->
            "#{result["scenario"]}/#{phase["phase"]}: #{c["detail"]}"
          end)
        end)
      end)

    if issues != [] do
      Mix.shell().info("  Common Issues:")

      Enum.each(Enum.take(issues, 10), fn issue ->
        Mix.shell().info("  x #{issue}")
      end)

      Mix.shell().info("")
    end
  end

  defp print_comparison(all_results, current_version) do
    versions =
      all_results
      |> Enum.map(fn r -> r["prompt_version"] end)
      |> Enum.uniq()
      |> Enum.sort()

    if length(versions) > 1 do
      previous_version = Enum.find(Enum.reverse(versions), fn v -> v != current_version end)

      if previous_version do
        prev_results =
          Enum.filter(all_results, fn r -> r["prompt_version"] == previous_version end)

        curr_results =
          Enum.filter(all_results, fn r -> r["prompt_version"] == current_version end)

        prev_avg = avg_score(prev_results)
        curr_avg = avg_score(curr_results)
        diff = curr_avg - prev_avg

        sign = if diff >= 0, do: "+", else: ""

        Mix.shell().info("  vs. Previous (#{previous_version}): #{sign}#{round(diff)}% avg")

        Mix.shell().info("")
      end
    end
  end

  defp print_footer do
    Mix.shell().info(String.duplicate("=", 60))
    Mix.shell().info("")
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp list_result_files(dir, opts) do
    scenario_filter = opts[:scenario]

    dir
    |> File.ls!()
    |> Enum.filter(&String.ends_with?(&1, ".json"))
    |> Enum.filter(fn filename ->
      if scenario_filter do
        String.contains?(filename, scenario_filter)
      else
        true
      end
    end)
    |> Enum.sort(:desc)
    |> Enum.map(&Path.join(dir, &1))
  end

  defp load_result(path) do
    case File.read(path) do
      {:ok, content} ->
        case Jason.decode(content) do
          {:ok, data} -> data
          {:error, _} -> nil
        end

      {:error, _} ->
        nil
    end
  end

  defp detect_latest_version(results) do
    results
    |> Enum.sort_by(fn r -> r["timestamp"] || "" end, :desc)
    |> Enum.map(fn r -> r["prompt_version"] end)
    |> List.first()
    |> Kernel.||("v1")
  end

  defp avg_score(results) do
    if results == [] do
      0.0
    else
      total = Enum.sum(Enum.map(results, fn r -> r["total_score"] || 0 end))
      max = Enum.sum(Enum.map(results, fn r -> r["max_score"] || 1 end))
      if max > 0, do: total / max * 100, else: 0.0
    end
  end

  defp format_duration(ms) when ms < 1000, do: "#{ms}ms"
  defp format_duration(ms) when ms < 60_000, do: "#{div(ms, 1000)}s"

  defp format_duration(ms) do
    minutes = div(ms, 60_000)
    seconds = div(rem(ms, 60_000), 1000)
    "#{minutes}m #{seconds}s"
  end

  defp pad(str, width) do
    String.pad_trailing(to_string(str), width)
  end

  defp return_ok, do: :ok
end
