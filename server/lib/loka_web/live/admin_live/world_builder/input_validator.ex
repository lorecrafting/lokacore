defmodule LokaWeb.AdminLive.WorldBuilder.InputValidator do
  @moduledoc """
  Input validation for World Builder user-supplied data.

  Validates keys, names, and other user inputs to prevent:
  - Path traversal attacks
  - Invalid database data
  - Injection attacks
  - DoS via excessive input sizes
  """

  @max_key_length 64
  @max_name_length 255
  @max_description_length 10_000
  @max_tag_length 64
  @max_tags_count 20

  @doc """
  Validates a key for rooms, templates, quests, NPCs, etc.

  Keys must:
  - Be 1-64 characters
  - Contain only lowercase letters, numbers, hyphens, and underscores
  - Not contain path traversal sequences (.., /, \\)
  """
  def validate_key(key) when is_binary(key) do
    cond do
      String.length(key) == 0 ->
        {:error, "Key cannot be empty"}

      String.length(key) > @max_key_length ->
        {:error, "Key must be #{@max_key_length} characters or less"}

      String.contains?(key, "..") ->
        {:error, "Key cannot contain parent directory references"}

      String.contains?(key, "/") or String.contains?(key, "\\") ->
        {:error, "Key cannot contain path separators"}

      not String.match?(key, ~r/^[a-z0-9_-]+$/) ->
        {:error, "Key must contain only lowercase letters, numbers, hyphens, and underscores"}

      true ->
        {:ok, key}
    end
  end

  def validate_key(_), do: {:error, "Key must be a string"}

  @doc """
  Validates a display name for rooms, NPCs, items, etc.

  Names must:
  - Be 1-255 characters
  - Not be empty or only whitespace
  """
  def validate_name(name) when is_binary(name) do
    trimmed = String.trim(name)

    cond do
      String.length(trimmed) == 0 ->
        {:error, "Name cannot be empty"}

      String.length(name) > @max_name_length ->
        {:error, "Name must be #{@max_name_length} characters or less"}

      true ->
        {:ok, name}
    end
  end

  def validate_name(_), do: {:error, "Name must be a string"}

  @doc """
  Validates a description field.

  Descriptions must be less than 10,000 characters.
  """
  def validate_description(desc) when is_binary(desc) do
    if String.length(desc) <= @max_description_length do
      {:ok, desc}
    else
      {:error, "Description must be #{@max_description_length} characters or less"}
    end
  end

  def validate_description(nil), do: {:ok, nil}
  def validate_description(_), do: {:error, "Description must be a string"}

  @doc """
  Validates a list of tags.

  Tags must:
  - Be a list of strings
  - Have maximum 20 tags
  - Each tag must be 1-64 characters
  """
  def validate_tags(tags) when is_list(tags) do
    cond do
      length(tags) > @max_tags_count ->
        {:error, "Maximum #{@max_tags_count} tags allowed"}

      not Enum.all?(tags, &is_binary/1) ->
        {:error, "All tags must be strings"}

      not Enum.all?(tags, &(String.length(&1) <= @max_tag_length)) ->
        {:error, "Each tag must be #{@max_tag_length} characters or less"}

      true ->
        {:ok, tags}
    end
  end

  def validate_tags(nil), do: {:ok, []}
  def validate_tags(_), do: {:error, "Tags must be a list"}

  @doc """
  Validates numeric coordinates (x, y, z).

  Coordinates must be integers between -10,000 and 10,000.
  """
  def validate_coordinate(coord) when is_integer(coord) do
    if coord >= -10_000 and coord <= 10_000 do
      {:ok, coord}
    else
      {:error, "Coordinate must be between -10,000 and 10,000"}
    end
  end

  def validate_coordinate(coord) when is_binary(coord) do
    case Integer.parse(coord) do
      {int, ""} -> validate_coordinate(int)
      _ -> {:error, "Coordinate must be a valid integer"}
    end
  end

  def validate_coordinate(_), do: {:error, "Coordinate must be an integer"}

  @doc """
  Validates all common room attributes.

  Returns {:ok, validated_attrs} or {:error, errors_list}.
  """
  def validate_room_attrs(attrs) when is_map(attrs) do
    errors = []

    errors =
      case validate_key(attrs["key"] || "") do
        {:ok, _} -> errors
        {:error, msg} -> ["key: #{msg}" | errors]
      end

    errors =
      case validate_name(attrs["name"] || "") do
        {:ok, _} -> errors
        {:error, msg} -> ["name: #{msg}" | errors]
      end

    errors =
      if Map.has_key?(attrs, "description") do
        case validate_description(attrs["description"]) do
          {:ok, _} -> errors
          {:error, msg} -> ["description: #{msg}" | errors]
        end
      else
        errors
      end

    errors =
      if Map.has_key?(attrs, "tags") do
        case validate_tags(attrs["tags"]) do
          {:ok, _} -> errors
          {:error, msg} -> ["tags: #{msg}" | errors]
        end
      else
        errors
      end

    # Validate coordinates if present
    errors =
      Enum.reduce(["x", "y", "z"], errors, fn coord_key, acc ->
        if Map.has_key?(attrs, coord_key) do
          case validate_coordinate(attrs[coord_key]) do
            {:ok, _} -> acc
            {:error, msg} -> ["#{coord_key}: #{msg}" | acc]
          end
        else
          acc
        end
      end)

    if Enum.empty?(errors) do
      {:ok, attrs}
    else
      {:error, Enum.reverse(errors)}
    end
  end
end
