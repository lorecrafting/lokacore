defmodule ExmudWeb.Plugs.RateLimiter do
  @moduledoc """
  Rate limiting plug using ETS for storage.

  Limits requests per IP address within a time window to prevent
  brute force attacks on authentication endpoints.

  ## Configuration

  The plug accepts these options:
  - `:max_requests` - Maximum requests allowed in the window (default: 10)
  - `:window_ms` - Time window in milliseconds (default: 60_000 = 1 minute)
  - `:error_message` - Message returned when rate limited (default: "Too many requests")

  ## Usage

      plug ExmudWeb.Plugs.RateLimiter, max_requests: 5, window_ms: 60_000

  """

  import Plug.Conn
  require Logger

  @behaviour Plug

  @default_max_requests 10
  @default_window_ms 60_000
  @table_name :exmud_rate_limiter
  @cleanup_interval_ms 300_000  # 5 minutes

  @impl true
  def init(opts) do
    # Ensure ETS table exists
    ensure_table_exists()

    # Start cleanup process if not already running
    start_cleanup_process()

    %{
      max_requests: Keyword.get(opts, :max_requests, @default_max_requests),
      window_ms: Keyword.get(opts, :window_ms, @default_window_ms),
      error_message: Keyword.get(opts, :error_message, "Too many requests. Please try again later.")
    }
  end

  @impl true
  def call(conn, opts) do
    ip = get_client_ip(conn)
    path = conn.request_path
    key = {ip, path}
    now = System.system_time(:millisecond)

    case check_rate_limit(key, now, opts) do
      :ok ->
        conn

      {:error, retry_after_ms} ->
        Logger.warning("[RateLimiter] Rate limit exceeded for #{ip} on #{path}")

        conn
        |> put_resp_header("retry-after", Integer.to_string(div(retry_after_ms, 1000)))
        |> put_resp_header("x-ratelimit-limit", Integer.to_string(opts.max_requests))
        |> put_resp_header("x-ratelimit-remaining", "0")
        |> send_resp(429, Jason.encode!(%{error: opts.error_message}))
        |> halt()
    end
  end

  defp check_rate_limit(key, now, opts) do
    window_start = now - opts.window_ms

    # Get or insert entry
    case :ets.lookup(@table_name, key) do
      [] ->
        # First request
        :ets.insert(@table_name, {key, [{now}]})
        :ok

      [{^key, timestamps}] ->
        # Filter timestamps within window
        valid_timestamps = Enum.filter(timestamps, fn {ts} -> ts > window_start end)
        count = length(valid_timestamps)

        if count < opts.max_requests do
          # Allow request
          :ets.insert(@table_name, {key, [{now} | valid_timestamps]})
          :ok
        else
          # Rate limited - calculate retry after
          oldest_valid = valid_timestamps |> List.last() |> elem(0)
          retry_after = oldest_valid + opts.window_ms - now
          {:error, max(retry_after, 1000)}
        end
    end
  end

  defp get_client_ip(conn) do
    # Check for forwarded IP (from proxy)
    forwarded =
      get_req_header(conn, "x-forwarded-for")
      |> List.first()

    case forwarded do
      nil ->
        conn.remote_ip |> Tuple.to_list() |> Enum.join(".")

      ip_string ->
        # Take first IP from X-Forwarded-For header
        ip_string
        |> String.split(",")
        |> List.first()
        |> String.trim()
    end
  end

  defp ensure_table_exists do
    case :ets.whereis(@table_name) do
      :undefined ->
        :ets.new(@table_name, [:set, :public, :named_table, read_concurrency: true, write_concurrency: true])

      _ ->
        :ok
    end
  end

  defp start_cleanup_process do
    # Check if cleanup process is already running
    case Process.whereis(:rate_limiter_cleanup) do
      nil ->
        # Start a simple cleanup task
        Task.start(fn -> cleanup_loop() end)

      _ ->
        :ok
    end
  end

  defp cleanup_loop do
    Process.register(self(), :rate_limiter_cleanup)

    loop_fn = fn loop ->
      Process.sleep(@cleanup_interval_ms)
      cleanup_old_entries()
      loop.(loop)
    end

    loop_fn.(loop_fn)
  rescue
    _ -> :ok
  end

  defp cleanup_old_entries do
    now = System.system_time(:millisecond)
    cutoff = now - 600_000  # 10 minutes

    # Delete entries older than cutoff
    :ets.foldl(
      fn {key, timestamps}, acc ->
        valid = Enum.filter(timestamps, fn {ts} -> ts > cutoff end)

        if valid == [] do
          :ets.delete(@table_name, key)
        else
          :ets.insert(@table_name, {key, valid})
        end

        acc
      end,
      :ok,
      @table_name
    )
  rescue
    _ -> :ok
  end
end
