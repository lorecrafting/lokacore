defmodule LokaWeb.Channels.ChannelRateLimiter do
  @moduledoc """
  Rate limiting for Phoenix Channels to prevent message spam/DoS.

  Uses a sliding window algorithm with ETS storage (per-process, cleared on disconnect).
  Tracks message counts per player per time window.

  ## Configuration

  Configure via application config:

      config :loka, LokaWeb.Channels.ChannelRateLimiter,
        enabled: true,
        max_messages: 30,      # Max messages per window
        window_ms: 1000,       # Window size in milliseconds
        burst_allowance: 10    # Extra burst capacity

  ## Usage

  In your channel:

      def handle_in("some_event", params, socket) do
        case ChannelRateLimiter.check(socket) do
          :ok ->
            # Process normally
            {:reply, :ok, ChannelRateLimiter.track(socket)}

          {:error, :rate_limited} ->
            {:reply, {:error, %{reason: "rate_limited"}}, socket}
        end
      end
  """

  require Logger

  # Default configuration
  @default_max_messages 30
  @default_window_ms 1000
  @default_burst_allowance 10

  @doc """
  Check if the current request should be rate limited.

  Returns `:ok` if allowed, `{:error, :rate_limited}` if blocked.
  """
  @spec check(Phoenix.Socket.t()) :: :ok | {:error, :rate_limited}
  def check(socket) do
    if enabled?() do
      player_id = get_player_id(socket)
      now = System.monotonic_time(:millisecond)
      window_ms = config(:window_ms, @default_window_ms)
      max_messages = config(:max_messages, @default_max_messages)
      burst_allowance = config(:burst_allowance, @default_burst_allowance)

      # Get timestamps from socket assigns
      timestamps = Map.get(socket.assigns, :rate_limit_timestamps, [])

      # Filter to current window
      window_start = now - window_ms
      recent_timestamps = Enum.filter(timestamps, fn ts -> ts > window_start end)

      # Check against limit (max + burst for first second)
      effective_limit = max_messages + burst_allowance
      count = length(recent_timestamps)

      if count >= effective_limit do
        Logger.warning(
          "Rate limit exceeded for player #{player_id}: #{count}/#{effective_limit} messages in #{window_ms}ms"
        )

        {:error, :rate_limited}
      else
        :ok
      end
    else
      :ok
    end
  end

  @doc """
  Track a message for rate limiting. Call after successfully processing a message.

  Returns the updated socket with the new timestamp tracked.
  """
  @spec track(Phoenix.Socket.t()) :: Phoenix.Socket.t()
  def track(socket) do
    if enabled?() do
      now = System.monotonic_time(:millisecond)
      window_ms = config(:window_ms, @default_window_ms)

      # Get current timestamps and add new one
      timestamps = Map.get(socket.assigns, :rate_limit_timestamps, [])

      # Filter to current window + add new timestamp (cleanup old ones)
      window_start = now - window_ms
      updated_timestamps = [now | Enum.filter(timestamps, fn ts -> ts > window_start end)]

      Phoenix.Socket.assign(socket, :rate_limit_timestamps, updated_timestamps)
    else
      socket
    end
  end

  @doc """
  Wrap a handler function with rate limiting.

  Returns `{:reply, {:error, %{reason: "rate_limited"}}, socket}` if rate limited,
  otherwise calls the handler function.
  """
  @spec with_rate_limit(Phoenix.Socket.t(), (Phoenix.Socket.t() -> term())) :: term()
  def with_rate_limit(socket, handler_fn) do
    case check(socket) do
      :ok ->
        result = handler_fn.(socket)
        # Update socket in result if present
        update_result_socket(result)

      {:error, :rate_limited} ->
        {:reply, {:error, %{reason: "rate_limited", message: "Too many requests"}}, socket}
    end
  end

  # Update the socket in the result tuple to track the message
  defp update_result_socket({:reply, reply, socket}) do
    {:reply, reply, track(socket)}
  end

  defp update_result_socket({:noreply, socket}) do
    {:noreply, track(socket)}
  end

  defp update_result_socket(other), do: other

  defp get_player_id(socket) do
    case socket.assigns do
      %{player: %{id: id}} -> id
      %{player_id: id} -> id
      _ -> "unknown"
    end
  end

  defp enabled? do
    config(:enabled, true)
  end

  defp config(key, default) do
    Application.get_env(:loka, __MODULE__, [])
    |> Keyword.get(key, default)
  end
end
