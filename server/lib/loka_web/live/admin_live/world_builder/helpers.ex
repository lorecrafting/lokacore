defmodule LokaWeb.AdminLive.WorldBuilder.Helpers do
  @moduledoc """
  Shared helper functions for World Builder event handlers.

  Contains utility functions used across WorldBuilderLive and its extracted
  event handler modules (DialogueEventHandler, EntityEventHandler).
  """

  require Logger

  @doc """
  Safely parse integer from string, preventing application crashes on invalid input.
  """
  def parse_integer(value, default \\ 0) do
    case Integer.parse(value || "#{default}") do
      {int, _} -> int
      :error -> default
    end
  end

  @doc """
  Generate a URL-safe key from a name.
  """
  def slugify(nil), do: "entity_#{:erlang.unique_integer([:positive])}"
  def slugify(""), do: "entity_#{:erlang.unique_integer([:positive])}"

  def slugify(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9_]/, "_")
    |> String.replace(~r/_+/, "_")
    |> String.trim("_")
    |> case do
      "" -> "entity_#{:erlang.unique_integer([:positive])}"
      slug -> slug
    end
  end

  @doc """
  Sanitize error messages to prevent information disclosure.
  Logs full error details but returns generic messages to user.
  """
  def sanitize_error(reason, context) do
    # Log full error details for debugging (server-side only)
    if context != "" do
      Logger.error("[WorldBuilder] #{context} error: #{inspect(reason)}")
    end

    # Return generic message to user based on error type
    case reason do
      :not_found -> "Resource not found"
      :invalid_data -> "Invalid data provided"
      :invalid_template -> "Invalid template"
      :permission_denied -> "Permission denied"
      :api_key_not_configured -> "Service not configured"
      msg when is_binary(msg) and byte_size(msg) < 100 -> msg
      _ -> "Operation failed"
    end
  end

  @doc """
  Add a message to the console log in socket assigns.
  """
  def log_console(socket, level, message) do
    import Phoenix.Component, only: [assign: 3]

    entry = %{
      level: level,
      message: message,
      timestamp: DateTime.utc_now()
    }

    messages = [entry | socket.assigns.console_messages] |> Enum.take(100)
    assign(socket, :console_messages, messages)
  end
end
