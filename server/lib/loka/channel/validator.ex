defmodule Loka.Channel.Validator do
  @moduledoc """
  Validates channel event payloads against schemas defined in `Loka.Channel.Events`.

  ## Usage

      # Validate a server event before pushing
      case Validator.validate_server_event("combat_start", payload) do
        :ok -> Phoenix.Channel.push(socket, "combat_start", payload)
        {:error, reason} -> Logger.error("Invalid payload: \#{reason}")
      end

      # Validate with context for better logging
      Validator.validate_and_log(:server, "combat_start", payload, %{player_id: "123"})

  ## Validation Rules

  - Required fields must be present and non-nil
  - Optional fields (`{:optional, type}`) can be nil or missing
  - Enum fields must match one of the allowed values
  - Nested objects are validated recursively
  """

  require Logger
  alias Loka.Channel.Events

  @type direction :: :server | :client
  @type validation_result :: :ok | {:error, String.t()}

  # ===========================================================================
  # Public API
  # ===========================================================================

  @doc """
  Validate an event and log errors with context.
  Stores validation errors for later analysis.
  """
  @spec validate_and_log(direction(), String.t(), map(), map()) :: validation_result()
  def validate_and_log(direction, event_name, payload, context \\ %{}) do
    case validate_event(direction, event_name, payload) do
      :ok ->
        :ok

      {:error, reason} = error ->
        log_validation_error(direction, event_name, reason, payload, context)
        error
    end
  end

  # ===========================================================================
  # Private - Core Validation
  # ===========================================================================

  defp validate_event(direction, event_name, payload) do
    case Events.get_event(direction, event_name) do
      nil ->
        {:error, "Unknown #{direction} event: #{event_name}"}

      schema ->
        validate_payload(payload, schema, [])
    end
  end

  defp validate_payload(payload, schema, path) when is_map(schema) and is_map(payload) do
    Enum.reduce_while(schema, :ok, fn {key, type}, :ok ->
      key_str = to_string(key)
      value = Map.get(payload, key) || Map.get(payload, key_str)
      field_path = path ++ [key]

      case validate_value(value, type, field_path) do
        :ok -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp validate_payload(payload, schema, path) when is_map(schema) do
    {:error, format_error(path, "expected object, got #{inspect(payload)}")}
  end

  defp validate_payload(_payload, _schema, _path), do: :ok

  # ===========================================================================
  # Private - Value Validation
  # ===========================================================================

  # Optional fields can be nil or missing
  defp validate_value(nil, {:optional, _type}, _path), do: :ok
  defp validate_value(value, {:optional, type}, path), do: validate_value(value, type, path)

  # Basic types
  defp validate_value(value, :string, _path) when is_binary(value), do: :ok

  defp validate_value(value, :string, path),
    do: {:error, format_error(path, "expected string, got #{type_of(value)}")}

  defp validate_value(value, :integer, _path) when is_integer(value), do: :ok

  defp validate_value(value, :integer, path),
    do: {:error, format_error(path, "expected integer, got #{type_of(value)}")}

  defp validate_value(value, :boolean, _path) when is_boolean(value), do: :ok

  defp validate_value(value, :boolean, path),
    do: {:error, format_error(path, "expected boolean, got #{type_of(value)}")}

  defp validate_value(value, :map, _path) when is_map(value), do: :ok

  defp validate_value(value, :map, path),
    do: {:error, format_error(path, "expected map, got #{type_of(value)}")}

  defp validate_value(value, :list, _path) when is_list(value), do: :ok

  defp validate_value(value, :list, path),
    do: {:error, format_error(path, "expected list, got #{type_of(value)}")}

  # Enum type
  defp validate_value(value, {:enum, allowed}, path) when is_binary(value) do
    if value in allowed do
      :ok
    else
      {:error, format_error(path, "#{inspect(value)} not in allowed values #{inspect(allowed)}")}
    end
  end

  defp validate_value(value, {:enum, allowed}, path) do
    {:error, format_error(path, "expected one of #{inspect(allowed)}, got #{type_of(value)}")}
  end

  # Nested object
  defp validate_value(value, %{} = nested_schema, path) when is_map(value) do
    validate_payload(value, nested_schema, path)
  end

  defp validate_value(value, %{} = _nested_schema, path) do
    {:error, format_error(path, "expected nested object, got #{type_of(value)}")}
  end

  # Required field is nil
  defp validate_value(nil, expected_type, path) do
    {:error, format_error(path, "required field is missing (expected #{inspect(expected_type)})")}
  end

  # Catch-all
  defp validate_value(value, expected_type, path) do
    {:error,
     format_error(
       path,
       "expected #{inspect(expected_type)}, got #{type_of(value)}: #{inspect(value)}"
     )}
  end

  # ===========================================================================
  # Private - Error Handling & Logging
  # ===========================================================================

  defp format_error([], message), do: message

  defp format_error(path, message) do
    field_path = Enum.map_join(path, ".", &to_string/1)
    "#{field_path}: #{message}"
  end

  defp type_of(value) when is_binary(value), do: "string"
  defp type_of(value) when is_integer(value), do: "integer"
  defp type_of(value) when is_float(value), do: "float"
  defp type_of(value) when is_boolean(value), do: "boolean"
  defp type_of(value) when is_map(value), do: "map"
  defp type_of(value) when is_list(value), do: "list"
  defp type_of(nil), do: "nil"
  defp type_of(_), do: "unknown"

  defp log_validation_error(direction, event_name, reason, payload, context) do
    error_data = %{
      direction: direction,
      event: event_name,
      error: reason,
      payload: sanitize_payload(payload),
      player_id: context[:player_id],
      occurred_at: DateTime.utc_now()
    }

    # Log for immediate visibility
    Logger.warning("[Channel.Validator] #{direction} event '#{event_name}' failed validation",
      error: reason,
      player_id: context[:player_id]
    )

    # Store for later analysis
    store_error(error_data)
  end

  defp store_error(error_data) do
    ensure_ets_table()
    timestamp = System.monotonic_time()
    :ets.insert(:channel_validation_errors, {timestamp, error_data})

    # Keep table size bounded (last 1000 errors)
    prune_old_errors(1000)
  end

  defp ensure_ets_table do
    case :ets.whereis(:channel_validation_errors) do
      :undefined ->
        :ets.new(:channel_validation_errors, [:named_table, :ordered_set, :public])

      _ref ->
        :ok
    end
  end

  defp prune_old_errors(max_size) do
    size = :ets.info(:channel_validation_errors, :size)

    if size > max_size do
      # Delete oldest entries
      to_delete = size - max_size

      :ets.tab2list(:channel_validation_errors)
      |> Enum.sort_by(fn {timestamp, _} -> timestamp end)
      |> Enum.take(to_delete)
      |> Enum.each(fn {timestamp, _} ->
        :ets.delete(:channel_validation_errors, timestamp)
      end)
    end
  end

  defp sanitize_payload(payload) when is_map(payload) do
    sensitive_keys = ["password", "token", "secret", "api_key", "auth"]

    payload
    |> Map.drop(sensitive_keys)
    |> Map.new(fn
      {k, v} when is_map(v) -> {k, sanitize_payload(v)}
      {k, v} -> {k, v}
    end)
  end

  defp sanitize_payload(payload), do: payload
end
