defmodule LokaWeb.DebugLogController do
  @moduledoc """
  Receives remote debug logs from mobile clients.
  Logs are stored in a rotating file for LLM debugging assistance.
  """
  use LokaWeb, :controller

  require Logger

  @log_dir "priv/debug_logs"
  # 5MB per file
  @max_log_size 5_000_000
  @max_log_files 10

  def create(conn, params) do
    log_entry = %{
      timestamp: params["timestamp"] || System.system_time(:millisecond),
      level: params["level"] || "info",
      message: params["message"],
      context: params["context"] || %{},
      device_id: params["device_id"],
      session_id: params["session_id"],
      player_name: params["player_name"],
      app_version: params["app_version"],
      platform: params["platform"],
      received_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    # Log to Phoenix logger for real-time visibility
    log_to_phoenix(log_entry)

    # Write to file for LLM access
    write_to_file(log_entry)

    conn
    |> put_status(:created)
    |> json(%{status: "ok"})
  end

  def index(conn, params) do
    limit = String.to_integer(params["limit"] || "100")
    level = params["level"]
    since = params["since"]

    logs = read_logs(limit: limit, level: level, since: since)

    conn
    |> json(%{logs: logs, count: length(logs)})
  end

  def latest(conn, params) do
    limit = String.to_integer(params["limit"] || "50")
    logs = read_logs(limit: limit)

    # Format for LLM consumption
    formatted = format_for_llm(logs)

    conn
    |> put_resp_content_type("text/plain")
    |> send_resp(200, formatted)
  end

  def clear(conn, _params) do
    clear_logs()

    conn
    |> json(%{status: "cleared"})
  end

  # Private functions

  defp log_to_phoenix(%{level: level, message: message, context: context}) do
    prefix = "[RemoteLog]"

    case level do
      "error" -> Logger.error("#{prefix} #{inspect(message)}", context)
      "warn" -> Logger.warning("#{prefix} #{inspect(message)}", context)
      "debug" -> Logger.debug("#{prefix} #{inspect(message)}", context)
      _ -> Logger.info("#{prefix} #{inspect(message)}", context)
    end
  end

  defp write_to_file(log_entry) do
    ensure_log_dir()
    rotate_logs_if_needed()

    log_file = current_log_file()
    line = Jason.encode!(log_entry) <> "\n"

    File.write(log_file, line, [:append])
  end

  defp read_logs(opts) do
    limit = Keyword.get(opts, :limit, 100)
    level = Keyword.get(opts, :level)
    since = Keyword.get(opts, :since)

    log_files()
    |> Enum.flat_map(&read_log_file/1)
    |> filter_by_level(level)
    |> filter_by_time(since)
    |> Enum.take(-limit)
  end

  defp read_log_file(file) do
    case File.read(file) do
      {:ok, content} ->
        content
        |> String.split("\n", trim: true)
        |> Enum.map(&Jason.decode!/1)

      _ ->
        []
    end
  end

  defp filter_by_level(logs, nil), do: logs

  defp filter_by_level(logs, level) do
    Enum.filter(logs, &(&1["level"] == level))
  end

  defp filter_by_time(logs, nil), do: logs

  defp filter_by_time(logs, since) do
    since_ms = String.to_integer(since)
    Enum.filter(logs, &(&1["timestamp"] >= since_ms))
  end

  defp format_for_llm(logs) do
    header = """
    # Mobile Debug Logs
    # Retrieved: #{DateTime.utc_now() |> DateTime.to_iso8601()}
    # Count: #{length(logs)}
    # ============================================

    """

    entries =
      logs
      |> Enum.map(fn log ->
        """
        [#{log["level"] |> String.upcase()}] #{format_timestamp(log["timestamp"])}
        Player: #{log["player_name"] || "unknown"} | Device: #{log["device_id"] || "unknown"}
        #{format_message(log["message"])}
        #{format_context(log["context"])}
        ---
        """
      end)
      |> Enum.join("\n")

    header <> entries
  end

  defp format_timestamp(nil), do: "unknown time"

  defp format_timestamp(ms) when is_integer(ms) do
    ms
    |> DateTime.from_unix!(:millisecond)
    |> DateTime.to_iso8601()
  end

  defp format_timestamp(other), do: inspect(other)

  defp format_message(msg) when is_binary(msg), do: msg
  defp format_message(msg) when is_list(msg), do: Enum.join(msg, " ")
  defp format_message(msg), do: inspect(msg, pretty: true, limit: 500)

  defp format_context(nil), do: ""
  defp format_context(ctx) when ctx == %{}, do: ""
  defp format_context(ctx), do: "Context: #{inspect(ctx, pretty: true, limit: 300)}"

  defp ensure_log_dir do
    File.mkdir_p!(@log_dir)
  end

  defp current_log_file do
    Path.join(@log_dir, "mobile_debug.log")
  end

  defp log_files do
    ensure_log_dir()

    Path.join(@log_dir, "*.log")
    |> Path.wildcard()
    |> Enum.sort()
  end

  defp rotate_logs_if_needed do
    log_file = current_log_file()

    case File.stat(log_file) do
      {:ok, %{size: size}} when size > @max_log_size ->
        rotate_log(log_file)

      _ ->
        :ok
    end
  end

  defp rotate_log(log_file) do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    rotated_name = Path.join(@log_dir, "mobile_debug_#{timestamp}.log")
    File.rename(log_file, rotated_name)

    # Clean up old logs
    log_files()
    |> Enum.sort()
    |> Enum.reverse()
    |> Enum.drop(@max_log_files)
    |> Enum.each(&File.rm/1)
  end

  defp clear_logs do
    log_files()
    |> Enum.each(&File.rm/1)
  end
end
