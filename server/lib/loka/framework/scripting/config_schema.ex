defmodule Loka.Framework.Scripting.ConfigSchema do
  @moduledoc """
  Validates behavior config against schema definitions.

  Behaviors can declare a config_schema in their script YAML that specifies:
  - Required fields
  - Types (string, integer, float, boolean, list, map, atom)
  - Default values
  - Min/max constraints for numbers

  ## Schema Format

  ```yaml
  config_schema:
    route:
      type: list
      required: true
      description: "List of room keys to patrol"
    interval:
      type: integer
      default: 300
      min: 60
      max: 3600
      description: "Seconds between patrol moves"
    enabled:
      type: boolean
      default: true
  ```

  ## Usage

      # Validate config against schema
      {:ok, validated_config} = ConfigSchema.validate(config, schema)

      # Errors if validation fails
      {:error, ["route is required", "interval must be >= 60"]} = ConfigSchema.validate(%{}, schema)
  """

  require Logger

  @type field_schema :: %{
          optional(:type) => String.t() | atom(),
          optional(:required) => boolean(),
          optional(:default) => any(),
          optional(:min) => number(),
          optional(:max) => number(),
          optional(:description) => String.t()
        }

  @type schema :: %{(String.t() | atom()) => field_schema()}

  @doc """
  Validates a config map against a schema, applying defaults.

  Returns {:ok, validated_config} with defaults applied, or {:error, errors}.
  """
  @spec validate(map(), schema()) :: {:ok, map()} | {:error, [String.t()]}
  def validate(config, schema) when is_map(config) and is_map(schema) do
    # Normalize keys
    config = normalize_keys(config)
    schema = normalize_schema(schema)

    # Collect errors and build validated config
    {validated, errors} =
      schema
      |> Enum.reduce({config, []}, fn {field_name, field_schema}, {acc_config, acc_errors} ->
        field_str = to_string(field_name)
        value = Map.get(acc_config, field_name) || Map.get(acc_config, field_str)

        case validate_field(field_name, value, field_schema) do
          {:ok, validated_value} ->
            # Update config with validated/defaulted value
            updated_config = Map.put(acc_config, field_name, validated_value)
            {updated_config, acc_errors}

          {:error, field_errors} ->
            {acc_config, field_errors ++ acc_errors}
        end
      end)

    if Enum.empty?(errors) do
      {:ok, validated}
    else
      {:error, Enum.reverse(errors)}
    end
  end

  def validate(config, nil), do: {:ok, config}
  def validate(config, schema) when map_size(schema) == 0, do: {:ok, config}

  @doc """
  Validates config and raises on error.
  """
  @spec validate!(map(), schema()) :: map()
  def validate!(config, schema) do
    case validate(config, schema) do
      {:ok, validated} -> validated
      {:error, errors} -> raise "Config validation failed: #{Enum.join(errors, ", ")}"
    end
  end

  @doc """
  Applies defaults from schema to config without full validation.
  """
  @spec apply_defaults(map(), schema()) :: map()
  def apply_defaults(config, schema) when is_map(config) and is_map(schema) do
    config = normalize_keys(config)
    schema = normalize_schema(schema)

    Enum.reduce(schema, config, fn {field_name, field_schema}, acc ->
      field_str = to_string(field_name)
      existing = Map.get(acc, field_name) || Map.get(acc, field_str)

      if is_nil(existing) do
        default = Map.get(field_schema, :default) || Map.get(field_schema, "default")

        if default != nil do
          Map.put(acc, field_name, default)
        else
          acc
        end
      else
        acc
      end
    end)
  end

  def apply_defaults(config, _), do: config

  # =============================================================================
  # Private Implementation
  # =============================================================================

  # Validate a single field against its schema
  defp validate_field(field_name, nil, field_schema) do
    required = Map.get(field_schema, :required, false) || Map.get(field_schema, "required", false)
    default = Map.get(field_schema, :default) || Map.get(field_schema, "default")

    cond do
      required && is_nil(default) ->
        {:error, ["#{field_name} is required"]}

      not is_nil(default) ->
        {:ok, default}

      true ->
        {:ok, nil}
    end
  end

  defp validate_field(field_name, value, field_schema) do
    type = Map.get(field_schema, :type) || Map.get(field_schema, "type")

    with :ok <- validate_type(field_name, value, type),
         :ok <- validate_min(field_name, value, field_schema),
         :ok <- validate_max(field_name, value, field_schema) do
      {:ok, value}
    end
  end

  # Type validation
  defp validate_type(_field, _value, nil), do: :ok

  defp validate_type(field, value, type) when is_binary(type) do
    validate_type(field, value, String.to_atom(type))
  end

  defp validate_type(_field, value, :string) when is_binary(value), do: :ok
  defp validate_type(_field, value, :integer) when is_integer(value), do: :ok
  defp validate_type(_field, value, :float) when is_float(value), do: :ok
  defp validate_type(_field, value, :number) when is_number(value), do: :ok
  defp validate_type(_field, value, :boolean) when is_boolean(value), do: :ok
  defp validate_type(_field, value, :list) when is_list(value), do: :ok
  defp validate_type(_field, value, :map) when is_map(value), do: :ok
  defp validate_type(_field, value, :atom) when is_atom(value), do: :ok
  defp validate_type(_field, _value, :any), do: :ok

  defp validate_type(field, value, expected_type) do
    actual_type = get_type_name(value)
    {:error, ["#{field} must be #{expected_type}, got #{actual_type}"]}
  end

  defp get_type_name(value) when is_binary(value), do: "string"
  defp get_type_name(value) when is_integer(value), do: "integer"
  defp get_type_name(value) when is_float(value), do: "float"
  defp get_type_name(value) when is_boolean(value), do: "boolean"
  defp get_type_name(value) when is_list(value), do: "list"
  defp get_type_name(value) when is_map(value), do: "map"
  defp get_type_name(value) when is_atom(value), do: "atom"
  defp get_type_name(_), do: "unknown"

  # Min validation
  defp validate_min(_field, _value, field_schema) when not is_map(field_schema), do: :ok

  defp validate_min(field, value, field_schema) when is_number(value) do
    min = Map.get(field_schema, :min) || Map.get(field_schema, "min")

    if min && value < min do
      {:error, ["#{field} must be >= #{min}"]}
    else
      :ok
    end
  end

  defp validate_min(_field, _value, _field_schema), do: :ok

  # Max validation
  defp validate_max(_field, _value, field_schema) when not is_map(field_schema), do: :ok

  defp validate_max(field, value, field_schema) when is_number(value) do
    max = Map.get(field_schema, :max) || Map.get(field_schema, "max")

    if max && value > max do
      {:error, ["#{field} must be <= #{max}"]}
    else
      :ok
    end
  end

  defp validate_max(_field, _value, _field_schema), do: :ok

  # Normalize keys to atoms where possible
  defp normalize_keys(config) when is_map(config) do
    Map.new(config, fn
      {k, v} when is_binary(k) ->
        atom_key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> k
          end

        {atom_key, v}

      {k, v} ->
        {k, v}
    end)
  end

  # Normalize schema field names to atoms
  defp normalize_schema(schema) when is_map(schema) do
    Map.new(schema, fn
      {k, v} when is_binary(k) ->
        {String.to_atom(k), normalize_field_schema(v)}

      {k, v} when is_atom(k) ->
        {k, normalize_field_schema(v)}
    end)
  end

  defp normalize_field_schema(field_schema) when is_map(field_schema) do
    Map.new(field_schema, fn
      {k, v} when is_binary(k) ->
        atom_key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> String.to_atom(k)
          end

        {atom_key, v}

      {k, v} ->
        {k, v}
    end)
  end

  defp normalize_field_schema(other), do: other
end
