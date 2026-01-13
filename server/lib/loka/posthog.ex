defmodule Loka.Posthog do
  @moduledoc """
  Posthog analytics integration for Loka.

  Provides functions to capture events and identify users in Posthog.
  Only sends events if POSTHOG_API_KEY is configured.

  ## Setup

  1. Create a Posthog account at https://posthog.com
  2. Get your API key from Project Settings
  3. Set `POSTHOG_API_KEY` environment variable

  ## Usage

      # Track a game event
      Loka.Posthog.capture("player_123", "combat_started", %{npc: "goblin"})

      # Identify a player
      Loka.Posthog.identify("player_123", %{email: "player@example.com"})

  ## Circuit Breaker

  Uses :fuse to prevent cascading failures. The circuit opens after 5 failures
  in 60 seconds, and stays open for 30 seconds before allowing retry.
  """

  require Logger

  @fuse_name :posthog_fuse
  # 5 failures in 60 seconds
  @fuse_opts {{:standard, 5, 60_000}, {:reset, 30_000}}

  @doc """
  Initializes the circuit breaker for Posthog.
  Called automatically on first use.
  """
  def init_fuse do
    :fuse.install(@fuse_name, @fuse_opts)
  end

  @doc """
  Capture an event for a user.

  Events are sent asynchronously. If Posthog is not configured,
  or the circuit breaker is open, this is a no-op.
  """
  def capture(distinct_id, event, properties \\ %{}) do
    if configured?() do
      Task.start(fn ->
        with_circuit_breaker(fn ->
          Posthog.capture(distinct_id, event, properties)
        end)
      end)
    end

    :ok
  end

  @doc """
  Identify a user with properties.

  Used to set user properties like email, name, etc.
  Sends a `$identify` event to Posthog.
  """
  def identify(distinct_id, properties) do
    if configured?() do
      Task.start(fn ->
        with_circuit_breaker(fn ->
          # Posthog uses $set for person properties in capture
          Posthog.capture("$identify", distinct_id: distinct_id, "$set": properties)
        end)
      end)
    end

    :ok
  end

  @doc """
  Check if Posthog is configured.
  """
  def configured? do
    case Application.get_env(:posthog, :api_key) do
      nil -> false
      "" -> false
      _ -> true
    end
  end

  # Game-specific event helpers

  @doc "Track player login event"
  def track_login(player_id, metadata \\ %{}) do
    capture(player_id, "player_login", metadata)
  end

  @doc "Track player logout event"
  def track_logout(player_id, session_duration_seconds \\ nil) do
    props =
      if session_duration_seconds, do: %{session_duration: session_duration_seconds}, else: %{}

    capture(player_id, "player_logout", props)
  end

  @doc "Track command execution"
  def track_command(player_id, command, metadata \\ %{}) do
    capture(player_id, "command_executed", Map.put(metadata, :command, command))
  end

  @doc "Track combat event"
  def track_combat(player_id, event_type, metadata \\ %{}) do
    capture(player_id, "combat_#{event_type}", metadata)
  end

  @doc "Track room navigation"
  def track_navigation(player_id, from_room, to_room) do
    capture(player_id, "room_navigation", %{from: from_room, to: to_room})
  end

  # =============================================================================
  # Error Tracking
  # =============================================================================

  @doc """
  Capture an exception for error tracking.

  This sends the exception to PostHog with context for debugging.
  Use this for unexpected errors that should be tracked.

  ## Options

  - `:user_id` - Optional user ID for attribution
  - `:context` - Additional context map (e.g., request info, state)
  - `:tags` - List of string tags for categorization

  ## Examples

      Loka.Posthog.capture_exception(error, stacktrace, user_id: "player_123")
      Loka.Posthog.capture_exception(error, stacktrace, context: %{action: "combat"})
  """
  def capture_exception(exception, stacktrace \\ nil, opts \\ []) do
    if configured?() do
      Task.start(fn ->
        user_id = Keyword.get(opts, :user_id, "system")
        context = Keyword.get(opts, :context, %{})
        tags = Keyword.get(opts, :tags, [])

        properties =
          %{
            "$exception_type" => exception_type(exception),
            "$exception_message" => Exception.message(exception),
            "$exception_stacktrace" => format_stacktrace(stacktrace),
            "tags" => tags,
            "context" => context
          }
          |> Map.reject(fn {_k, v} -> is_nil(v) end)

        with_circuit_breaker(fn ->
          Posthog.capture(user_id, "$exception", properties)
        end)
      end)
    end

    :ok
  end

  @doc """
  Capture an error message for alerting.

  This is for expected errors or warnings that should trigger alerts.
  """
  def capture_error(message, opts \\ []) do
    if configured?() do
      Task.start(fn ->
        user_id = Keyword.get(opts, :user_id, "system")
        severity = Keyword.get(opts, :severity, "error")
        context = Keyword.get(opts, :context, %{})

        properties = %{
          "error_message" => message,
          "severity" => severity,
          "context" => context
        }

        with_circuit_breaker(fn ->
          Posthog.capture(user_id, "error_occurred", properties)
        end)
      end)
    end

    :ok
  end

  @doc """
  Create a Telemetry handler for capturing errors via Posthog.

  Attach this to telemetry events for automatic error tracking:

      :telemetry.attach(
        "posthog-error-handler",
        [:loka, :error],
        &Loka.Posthog.telemetry_error_handler/4,
        nil
      )
  """
  def telemetry_error_handler(_event_name, measurements, metadata, _config) do
    exception = Map.get(metadata, :exception)
    stacktrace = Map.get(metadata, :stacktrace)
    context = Map.get(metadata, :context, %{})
    user_id = Map.get(metadata, :user_id, "system")

    if exception do
      capture_exception(exception, stacktrace, user_id: user_id, context: context)
    else
      message = Map.get(metadata, :message, "Unknown error")
      duration = Map.get(measurements, :duration)
      capture_error(message, user_id: user_id, context: Map.put(context, :duration, duration))
    end
  end

  defp exception_type(exception) when is_exception(exception) do
    exception.__struct__ |> to_string() |> String.replace_prefix("Elixir.", "")
  end

  defp exception_type(_), do: "Unknown"

  defp format_stacktrace(nil), do: nil

  defp format_stacktrace(stacktrace) when is_list(stacktrace) do
    Exception.format_stacktrace(stacktrace)
  end

  defp format_stacktrace(_), do: nil

  # Circuit breaker wrapper for Posthog calls
  defp with_circuit_breaker(fun) do
    # Ensure fuse is installed (lazy init)
    ensure_fuse_installed()

    case :fuse.ask(@fuse_name, :sync) do
      :ok ->
        try do
          fun.()
        rescue
          error ->
            :fuse.melt(@fuse_name)
            Logger.warning("[Posthog] Request failed, melting fuse: #{inspect(error)}")
        end

      :blown ->
        Logger.debug("[Posthog] Circuit breaker open, skipping request")
        :ok
    end
  end

  defp ensure_fuse_installed do
    case :fuse.ask(@fuse_name, :sync) do
      {:error, :not_found} ->
        init_fuse()

      _ ->
        :ok
    end
  end
end
