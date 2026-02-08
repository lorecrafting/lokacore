defmodule Mix.Tasks.Loka.DebugLogs do
  @moduledoc """
  View mobile debug logs for LLM debugging.

  ## Usage

      # View latest 50 logs
      mix loka.debug_logs

      # View latest N logs
      mix loka.debug_logs --limit 100

      # Filter by level
      mix loka.debug_logs --level error

      # Clear all logs
      mix loka.debug_logs --clear

      # Watch mode (tail -f style)
      mix loka.debug_logs --watch

  ## Output Format

  Logs are formatted for easy LLM consumption with timestamps,
  player info, and full context.
  """
  use Mix.Task
  use Boundary, classify_to: Loka

  @log_dir "priv/debug_logs"
  @log_file "priv/debug_logs/mobile_debug.log"

  @impl Mix.Task
  def run(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        switches: [
          limit: :integer,
          level: :string,
          clear: :boolean,
          watch: :boolean,
          since: :integer
        ],
        aliases: [
          l: :limit,
          w: :watch,
          c: :clear
        ]
      )

    cond do
      opts[:clear] ->
        clear_logs()

      opts[:watch] ->
        watch_logs(opts)

      true ->
        show_logs(opts)
    end
  end

  defp show_logs(opts) do
    limit = opts[:limit] || 50
    level = opts[:level]

    logs =
      read_logs()
      |> filter_by_level(level)
      |> Enum.take(-limit)

    if Enum.empty?(logs) do
      Mix.shell().info("No debug logs found.")
      Mix.shell().info("Logs are stored in: #{@log_file}")
    else
      Mix.shell().info(format_header(length(logs)))
      Enum.each(logs, &print_log/1)
    end
  end

  defp watch_logs(opts) do
    Mix.shell().info("Watching debug logs... (Ctrl+C to stop)")
    Mix.shell().info("=" |> String.duplicate(60))

    last_count = 0
    watch_loop(last_count, opts)
  end

  defp watch_loop(last_count, opts) do
    Process.sleep(1000)

    logs = read_logs()
    current_count = length(logs)

    if current_count > last_count do
      new_logs = Enum.drop(logs, last_count)
      Enum.each(new_logs, &print_log/1)
    end

    watch_loop(current_count, opts)
  end

  defp clear_logs do
    File.mkdir_p!(@log_dir)

    Path.join(@log_dir, "*.log")
    |> Path.wildcard()
    |> Enum.each(&File.rm/1)

    Mix.shell().info("Debug logs cleared.")
  end

  defp read_logs do
    File.mkdir_p!(@log_dir)

    Path.join(@log_dir, "*.log")
    |> Path.wildcard()
    |> Enum.sort()
    |> Enum.flat_map(&read_log_file/1)
  end

  defp read_log_file(file) do
    case File.read(file) do
      {:ok, content} ->
        content
        |> String.split("\n", trim: true)
        |> Enum.map(fn line ->
          case Jason.decode(line) do
            {:ok, log} -> log
            _ -> nil
          end
        end)
        |> Enum.reject(&is_nil/1)

      _ ->
        []
    end
  end

  defp filter_by_level(logs, nil), do: logs

  defp filter_by_level(logs, level) do
    Enum.filter(logs, &(&1["level"] == level))
  end

  defp format_header(count) do
    """

    ╔══════════════════════════════════════════════════════════════╗
    ║                    MOBILE DEBUG LOGS                        ║
    ║  Retrieved: #{DateTime.utc_now() |> DateTime.to_iso8601() |> String.pad_trailing(42)}  ║
    ║  Count: #{count |> Integer.to_string() |> String.pad_trailing(51)}  ║
    ╚══════════════════════════════════════════════════════════════╝
    """
  end

  defp print_log(log) do
    level = (log["level"] || "info") |> String.upcase() |> String.pad_trailing(5)
    timestamp = format_timestamp(log["timestamp"])
    player = log["player_name"] || "unknown"
    device = log["device_id"] || "unknown" |> String.slice(0..20)

    level_color =
      case log["level"] do
        "error" -> IO.ANSI.red()
        "warn" -> IO.ANSI.yellow()
        "debug" -> IO.ANSI.cyan()
        _ -> IO.ANSI.white()
      end

    IO.puts("#{level_color}[#{level}]#{IO.ANSI.reset()} #{timestamp}")
    IO.puts("  Player: #{player} | Device: #{device}")
    IO.puts("  #{format_message(log["message"])}")

    if log["context"] && log["context"] != %{} do
      IO.puts("  Context: #{inspect(log["context"], pretty: true, limit: 200)}")
    end

    IO.puts("  " <> String.duplicate("-", 58))
  end

  defp format_timestamp(nil), do: "unknown time"

  defp format_timestamp(ms) when is_integer(ms) do
    ms
    |> DateTime.from_unix!(:millisecond)
    |> Calendar.strftime("%Y-%m-%d %H:%M:%S")
  end

  defp format_timestamp(other), do: inspect(other)

  defp format_message(msg) when is_binary(msg), do: msg
  defp format_message(msg) when is_list(msg), do: Enum.join(msg, " ")
  defp format_message(msg), do: inspect(msg, pretty: true, limit: 300)
end
