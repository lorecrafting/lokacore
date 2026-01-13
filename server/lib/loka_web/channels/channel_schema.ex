defmodule LokaWeb.Channels.ChannelSchema do
  @moduledoc """
  Loads and provides access to channel event schemas.

  This module is the Elixir interface to the JSON Schema definitions in
  `priv/schemas/channel_events.json`. It provides:

  - Schema loading at compile time for performance
  - Payload validation against event schemas
  - Event listing for documentation/testing

  ## Single Source of Truth

  The JSON Schema file is the authoritative definition for all channel events.
  Both the server (this module) and mobile app (generated TypeScript) use it.

  ## Usage

      # Validate a payload
      case ChannelSchema.validate("navigate", %{"direction" => "north"}) do
        :ok -> # proceed
        {:error, errors} -> # handle validation errors
      end

      # List all events
      ChannelSchema.events() # => ["navigate", "click_entity", ...]

      # Get event schema
      ChannelSchema.get_event("navigate") # => %{payload: ..., response: ...}

  ## Adding New Events

  1. Add the event to `priv/schemas/channel_events.json`
  2. Run `mix loka.test.validate` to verify schema is valid
  3. Run `mix loka.generate.channel_types` to update TypeScript types
  4. Implement handler in `GameChannel`
  """

  require Logger

  @schema_path "priv/schemas/channel_events.json"

  # Load schema at compile time
  @external_resource @schema_path

  @schema (case File.read(@schema_path) do
             {:ok, content} ->
               case Jason.decode(content) do
                 {:ok, parsed} ->
                   parsed

                 {:error, reason} ->
                   raise "Failed to parse channel schema: #{inspect(reason)}"
               end

             {:error, reason} ->
               raise "Failed to load channel schema from #{@schema_path}: #{inspect(reason)}"
           end)

  @doc """
  Returns the full schema as a map.
  """
  def schema, do: @schema

  @doc """
  Returns the schema version.
  """
  def version, do: @schema["version"]

  @doc """
  Returns all event names.
  """
  def events do
    @schema["events"]
    |> Map.keys()
    |> Enum.sort()
  end

  @doc """
  Returns the schema for a specific event.
  """
  def get_event(event_name) when is_binary(event_name) do
    Map.get(@schema["events"], event_name)
  end

  def get_event(event_name) when is_atom(event_name) do
    get_event(Atom.to_string(event_name))
  end

  @doc """
  Returns the shared definitions (uuid, entity_type, etc.)
  """
  def definitions, do: @schema["definitions"]

  @doc """
  Validates a payload against an event schema.

  Returns `:ok` if valid, or `{:error, errors}` with a list of validation errors.

  ## Examples

      iex> ChannelSchema.validate("navigate", %{"direction" => "north"})
      :ok

      iex> ChannelSchema.validate("navigate", %{"direction" => "invalid"})
      {:error, [%{path: "/direction", message: "value not in enum"}]}

      iex> ChannelSchema.validate("navigate", %{})
      {:error, [%{path: "/direction", message: "required property missing"}]}
  """
  def validate(event_name, payload) do
    case get_event(event_name) do
      nil ->
        {:error, [{:unknown_event, event_name}]}

      event_schema ->
        validate_payload(payload, event_schema["payload"])
    end
  end

  # Simple validation without external dependencies
  # For production, consider using ExJsonSchema
  defp validate_payload(payload, schema) when is_map(schema) do
    errors = []

    # Check oneOf schemas
    errors =
      if Map.has_key?(schema, "oneOf") do
        validate_oneof(payload, schema["oneOf"], errors)
      else
        validate_object(payload, schema, errors)
      end

    case errors do
      [] -> :ok
      _ -> {:error, errors}
    end
  end

  defp validate_oneof(payload, schemas, _errors) do
    # Try each schema, return ok if any match
    results =
      Enum.map(schemas, fn schema ->
        validate_object(payload, schema, [])
      end)

    if Enum.any?(results, &Enum.empty?/1) do
      []
    else
      # Return the errors from the schema with fewest errors
      results
      |> Enum.min_by(&length/1)
    end
  end

  defp validate_object(payload, schema, errors) when is_map(payload) and is_map(schema) do
    errors = validate_required(payload, schema, errors)
    errors = validate_properties(payload, schema, errors)
    errors = validate_additional_properties(payload, schema, errors)
    errors
  end

  defp validate_object(_payload, _schema, errors), do: errors

  defp validate_required(payload, schema, errors) do
    required = Map.get(schema, "required", [])

    missing =
      required
      |> Enum.reject(&Map.has_key?(payload, &1))
      |> Enum.map(fn key -> %{path: "/#{key}", message: "required property missing"} end)

    errors ++ missing
  end

  defp validate_properties(payload, schema, errors) do
    properties = Map.get(schema, "properties", %{})

    property_errors =
      Enum.flat_map(properties, fn {key, prop_schema} ->
        case Map.get(payload, key) do
          nil -> []
          value -> validate_property(key, value, prop_schema)
        end
      end)

    errors ++ property_errors
  end

  defp validate_property(key, value, %{"const" => expected}) do
    if value == expected do
      []
    else
      [%{path: "/#{key}", message: "expected #{inspect(expected)}, got #{inspect(value)}"}]
    end
  end

  defp validate_property(key, value, %{"type" => "string"} = schema) do
    cond do
      not is_binary(value) ->
        [%{path: "/#{key}", message: "expected string, got #{typeof(value)}"}]

      Map.has_key?(schema, "enum") and value not in schema["enum"] ->
        [%{path: "/#{key}", message: "value not in enum: #{inspect(schema["enum"])}"}]

      Map.has_key?(schema, "pattern") and not Regex.match?(~r/#{schema["pattern"]}/, value) ->
        [%{path: "/#{key}", message: "does not match pattern: #{schema["pattern"]}"}]

      Map.has_key?(schema, "minLength") and String.length(value) < schema["minLength"] ->
        [%{path: "/#{key}", message: "too short, minimum #{schema["minLength"]} characters"}]

      Map.has_key?(schema, "maxLength") and String.length(value) > schema["maxLength"] ->
        [%{path: "/#{key}", message: "too long, maximum #{schema["maxLength"]} characters"}]

      true ->
        []
    end
  end

  defp validate_property(key, value, %{"type" => "integer"} = schema) do
    cond do
      not is_integer(value) ->
        [%{path: "/#{key}", message: "expected integer, got #{typeof(value)}"}]

      Map.has_key?(schema, "minimum") and value < schema["minimum"] ->
        [%{path: "/#{key}", message: "below minimum value of #{schema["minimum"]}"}]

      Map.has_key?(schema, "maximum") and value > schema["maximum"] ->
        [%{path: "/#{key}", message: "above maximum value of #{schema["maximum"]}"}]

      true ->
        []
    end
  end

  defp validate_property(key, value, %{"$ref" => ref}) do
    # Resolve reference and validate
    definition_name = String.replace_prefix(ref, "#/definitions/", "")

    case Map.get(definitions(), definition_name) do
      nil ->
        [%{path: "/#{key}", message: "unknown reference: #{ref}"}]

      definition ->
        validate_property(key, value, definition)
    end
  end

  defp validate_property(_key, _value, _schema), do: []

  defp validate_additional_properties(
         payload,
         %{"additionalProperties" => false} = schema,
         errors
       ) do
    known_keys =
      schema
      |> Map.get("properties", %{})
      |> Map.keys()
      |> MapSet.new()

    extra_keys =
      payload
      |> Map.keys()
      |> Enum.reject(&MapSet.member?(known_keys, &1))
      |> Enum.map(fn key -> %{path: "/#{key}", message: "unknown property"} end)

    errors ++ extra_keys
  end

  defp validate_additional_properties(_payload, _schema, errors), do: errors

  defp typeof(value) when is_binary(value), do: "string"
  defp typeof(value) when is_integer(value), do: "integer"
  defp typeof(value) when is_float(value), do: "number"
  defp typeof(value) when is_boolean(value), do: "boolean"
  defp typeof(value) when is_list(value), do: "array"
  defp typeof(value) when is_map(value), do: "object"
  defp typeof(nil), do: "null"
  defp typeof(_), do: "unknown"
end
