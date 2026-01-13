defmodule LokaWeb.Channels.ChannelValidator do
  @moduledoc """
  Runtime validation for channel events.

  This module provides configurable validation of channel payloads against
  the JSON Schema definitions. In development, invalid payloads are logged
  as warnings. In production, validation can be disabled for performance.

  ## Configuration

  Set in `config/config.exs`:

      config :loka, LokaWeb.Channels.ChannelValidator,
        enabled: true,          # Enable/disable validation
        strict: false,          # If true, reject invalid payloads
        log_level: :warning     # Log level for validation errors

  ## Usage in Channels

  The `validate_and_execute/4` function wraps handler execution:

      def handle_in("navigate", payload, socket) do
        ChannelValidator.validate_and_execute("navigate", payload, socket, fn ->
          # Your actual handler logic
          case do_navigate(payload["direction"], socket) do
            {:ok, socket} -> {:reply, :ok, socket}
            {:error, reason, socket} -> {:reply, {:error, reason}, socket}
          end
        end)
      end

  ## When to Use

  - Always use for new handlers during development
  - Can disable in production if performance-sensitive
  - Strict mode recommended in staging environments
  """

  require Logger

  alias LokaWeb.Channels.ChannelSchema

  @default_config [
    enabled: true,
    strict: false,
    log_level: :warning
  ]

  @doc """
  Returns the current configuration.
  """
  def config do
    Application.get_env(:loka, __MODULE__, @default_config)
    |> Keyword.merge(@default_config, fn _k, v, _default -> v end)
  end

  @doc """
  Returns whether validation is enabled.
  """
  def enabled?, do: config()[:enabled]

  @doc """
  Returns whether strict mode is on (reject invalid payloads).
  """
  def strict?, do: config()[:strict]

  @doc """
  Validates a payload and executes the handler.

  If validation fails:
  - In non-strict mode: logs warning, executes handler anyway
  - In strict mode: returns error, does not execute handler

  ## Examples

      validate_and_execute("navigate", %{"direction" => "north"}, socket, fn ->
        {:reply, :ok, socket}
      end)
  """
  def validate_and_execute(event, payload, socket, handler_fn) do
    if enabled?() do
      case ChannelSchema.validate(event, payload) do
        :ok ->
          handler_fn.()

        {:error, errors} ->
          log_validation_error(event, payload, errors)

          if strict?() do
            {:reply, {:error, %{reason: "validation_failed", errors: format_errors(errors)}},
             socket}
          else
            # Non-strict: log but proceed
            handler_fn.()
          end
      end
    else
      handler_fn.()
    end
  end

  @doc """
  Validates a payload without executing anything.

  Useful for testing and debugging.
  """
  def validate(event, payload) do
    ChannelSchema.validate(event, payload)
  end

  @doc """
  Returns all registered events and their schemas.

  Useful for generating documentation.
  """
  def list_events do
    ChannelSchema.events()
    |> Enum.map(fn event ->
      schema = ChannelSchema.get_event(event)

      %{
        event: event,
        description: schema["description"],
        payload: schema["payload"],
        response: schema["response"]
      }
    end)
  end

  @doc """
  Checks if an event is defined in the schema.
  """
  def event_defined?(event) do
    ChannelSchema.get_event(event) != nil
  end

  # Private helpers

  defp log_validation_error(event, payload, errors) do
    level = config()[:log_level]

    Logger.log(level, fn ->
      """
      Channel payload validation failed
        Event: #{event}
        Payload: #{inspect(payload, limit: 100)}
        Errors: #{inspect(errors)}
      """
    end)
  end

  defp format_errors(errors) when is_list(errors) do
    Enum.map(errors, fn
      %{path: path, message: msg} -> "#{path}: #{msg}"
      {type, value} -> "#{type}: #{inspect(value)}"
      other -> inspect(other)
    end)
  end

  defp format_errors(errors), do: [inspect(errors)]
end
