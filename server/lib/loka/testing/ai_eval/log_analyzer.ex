defmodule Loka.Testing.AIEval.LogAnalyzer do
  @moduledoc """
  Parses JSONL log files from the ObservabilityLogger and generates metrics.

  Analyzes tool success rates, usage frequency, average duration,
  common errors, and conversations hitting the iteration limit.
  """

  @type metrics :: %{
          total_calls: non_neg_integer(),
          success_rate: float(),
          tool_usage: %{String.t() => non_neg_integer()},
          avg_duration_ms: %{String.t() => float()},
          error_distribution: %{String.t() => non_neg_integer()},
          sessions: non_neg_integer()
        }

  @doc """
  Analyze all JSONL log files and return aggregated metrics.
  """
  @spec analyze(keyword()) :: metrics()
  def analyze(opts \\ []) do
    log_dir = opts[:log_dir] || Path.join([:code.priv_dir(:loka), "llm_logs"])
    days = opts[:days] || 30

    cutoff = Date.add(Date.utc_today(), -days)

    entries =
      log_dir
      |> list_log_files()
      |> Enum.filter(fn path ->
        date = extract_date(Path.basename(path))
        date && Date.compare(date, cutoff) != :lt
      end)
      |> Enum.flat_map(&parse_jsonl/1)

    build_metrics(entries)
  end

  @doc """
  Print a formatted metrics report.
  """
  @spec print_report(keyword()) :: :ok
  def print_report(opts \\ []) do
    metrics = analyze(opts)

    Mix.shell().info("")
    Mix.shell().info("=" |> String.duplicate(50))
    Mix.shell().info("  LLM Tool Usage Analytics")
    Mix.shell().info("=" |> String.duplicate(50))
    Mix.shell().info("")
    Mix.shell().info("  Total API calls: #{metrics.total_calls}")
    Mix.shell().info("  Unique sessions: #{metrics.sessions}")
    Mix.shell().info("  Success rate: #{Float.round(metrics.success_rate * 100, 1)}%")
    Mix.shell().info("")

    # Top tools by usage
    if metrics.tool_usage != %{} do
      Mix.shell().info("  Top Tools:")

      metrics.tool_usage
      |> Enum.sort_by(fn {_, count} -> count end, :desc)
      |> Enum.take(10)
      |> Enum.each(fn {tool, count} ->
        avg_ms = Map.get(metrics.avg_duration_ms, tool, 0) |> Float.round(0) |> trunc()
        Mix.shell().info("    #{String.pad_trailing(tool, 25)} #{count}x  (avg #{avg_ms}ms)")
      end)

      Mix.shell().info("")
    end

    # Common errors
    if metrics.error_distribution != %{} do
      Mix.shell().info("  Common Errors:")

      metrics.error_distribution
      |> Enum.sort_by(fn {_, count} -> count end, :desc)
      |> Enum.take(5)
      |> Enum.each(fn {error, count} ->
        truncated = String.slice(error, 0..60)
        Mix.shell().info("    #{count}x  #{truncated}")
      end)

      Mix.shell().info("")
    end

    Mix.shell().info("=" |> String.duplicate(50))
    :ok
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp list_log_files(dir) do
    if File.exists?(dir) do
      dir
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".jsonl"))
      |> Enum.map(&Path.join(dir, &1))
    else
      []
    end
  end

  defp extract_date(filename) do
    case Regex.run(~r/^(\d{4}-\d{2}-\d{2})/, filename) do
      [_, date_str] ->
        case Date.from_iso8601(date_str) do
          {:ok, date} -> date
          _ -> nil
        end

      _ ->
        nil
    end
  end

  defp parse_jsonl(path) do
    path
    |> File.stream!()
    |> Enum.flat_map(fn line ->
      case Jason.decode(String.trim(line)) do
        {:ok, entry} -> [entry]
        {:error, _} -> []
      end
    end)
  end

  defp build_metrics(entries) do
    tool_calls = Enum.filter(entries, fn e -> e["type"] == "tool_call" end)

    tool_data =
      Enum.map(tool_calls, fn e ->
        data = e["data"] || %{}

        %{
          tool_name: data["tool_name"] || "unknown",
          success: get_in(data, ["result", "success"]) || false,
          duration_ms: get_in(data, ["result", "duration_ms"]) || 0,
          error:
            unless(get_in(data, ["result", "success"]),
              do: get_in(data, ["result", "result_preview"])
            ),
          session_id: e["session_id"]
        }
      end)

    total = length(tool_data)
    successes = Enum.count(tool_data, & &1.success)

    tool_usage =
      tool_data
      |> Enum.group_by(& &1.tool_name)
      |> Map.new(fn {name, calls} -> {name, length(calls)} end)

    avg_duration =
      tool_data
      |> Enum.group_by(& &1.tool_name)
      |> Map.new(fn {name, calls} ->
        durations = Enum.map(calls, & &1.duration_ms)
        avg = if durations != [], do: Enum.sum(durations) / length(durations), else: 0.0
        {name, avg}
      end)

    error_distribution =
      tool_data
      |> Enum.reject(& &1.success)
      |> Enum.map(& &1.error)
      |> Enum.reject(&is_nil/1)
      |> Enum.frequencies()

    sessions =
      tool_data
      |> Enum.map(& &1.session_id)
      |> Enum.uniq()
      |> length()

    %{
      total_calls: total,
      success_rate: if(total > 0, do: successes / total, else: 0.0),
      tool_usage: tool_usage,
      avg_duration_ms: avg_duration,
      error_distribution: error_distribution,
      sessions: sessions
    }
  end
end
