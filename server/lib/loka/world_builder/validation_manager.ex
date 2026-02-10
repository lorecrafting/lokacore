defmodule Loka.WorldBuilder.ValidationManager do
  @moduledoc """
  Coordinates real-time validation for World Builder.

  Integrates existing validators and provides live feedback.
  Validation runs automatically on entity changes and provides
  visual feedback (glow colors) in the 3D viewport.
  """

  alias Loka.Testing.Content.{QuestValidator, CutsceneValidator}
  alias Loka.WorldBuilder.RoomManager

  @doc """
  Validate all entities in the world.
  Returns aggregated validation results.
  """
  def validate_all do
    {:ok, quest_results} = QuestValidator.validate()
    {:ok, cutscene_results} = CutsceneValidator.validate()

    # Validate all rooms
    rooms = RoomManager.list_rooms()
    room_results = Enum.map(rooms, &validate_room/1)

    room_errors = Enum.filter(room_results, &(&1.status == :error))
    room_warnings = Enum.filter(room_results, &(&1.status == :warning))

    %{
      quests: quest_results,
      cutscenes: cutscene_results,
      rooms: %{
        errors: room_errors,
        warnings: room_warnings,
        valid: length(rooms) - length(room_errors) - length(room_warnings)
      },
      total_errors:
        length(quest_results.errors) + length(cutscene_results.errors) + length(room_errors),
      total_warnings:
        length(quest_results.warnings) + length(cutscene_results.warnings) + length(room_warnings)
    }
  end

  @doc """
  Validate a single room and return validation status with errors/warnings.

  Returns:
  - status: :valid | :warning | :error
  - errors: list of error messages
  - warnings: list of warning messages
  - room_key: the room key for reference
  """
  def validate_room(room) when is_map(room) do
    errors = []
    warnings = []

    # Check for missing name
    warnings =
      if is_nil(room[:name]) || room[:name] == "",
        do: ["Room '#{room[:key]}' is missing a name" | warnings],
        else: warnings

    # Check for missing description
    warnings =
      if is_nil(room[:description]) || room[:description] == "",
        do: ["Room '#{room[:key]}' is missing a description" | warnings],
        else: warnings

    # Validate exits - check if destination rooms exist
    errors =
      if is_map(room[:exits]) and map_size(room[:exits]) > 0 do
        invalid_exits =
          room[:exits]
          |> Enum.filter(fn {_direction, dest_key} ->
            case RoomManager.get_room(dest_key) do
              {:error, :not_found} -> true
              _ -> false
            end
          end)
          |> Enum.map(fn {direction, dest_key} -> {direction, dest_key} end)

        if invalid_exits != [] do
          exit_messages =
            Enum.map(invalid_exits, fn {dir, dest} ->
              "Exit '#{dir}' points to non-existent room '#{dest}'"
            end)

          errors ++ exit_messages
        else
          errors
        end
      else
        errors
      end

    # Determine overall status
    status =
      cond do
        errors != [] -> :error
        warnings != [] -> :warning
        true -> :valid
      end

    %{
      status: status,
      errors: errors,
      warnings: warnings,
      room_key: room[:key]
    }
  end

  @doc """
  Validate a batch of rooms and return a map of room_key => validation_result.
  """
  def validate_rooms(rooms) when is_list(rooms) do
    rooms
    |> Enum.map(fn room ->
      result = validate_room(room)
      {room[:key] || room[:id], result}
    end)
    |> Map.new()
  end

  @doc """
  Get validation summary for a list of rooms.
  Returns counts of errors, warnings, and valid rooms.
  """
  def validation_summary(rooms) when is_list(rooms) do
    results = validate_rooms(rooms)

    error_count =
      results |> Map.values() |> Enum.count(&(&1.status == :error))

    warning_count =
      results |> Map.values() |> Enum.count(&(&1.status == :warning))

    valid_count =
      results |> Map.values() |> Enum.count(&(&1.status == :valid))

    # Collect all error and warning messages
    all_errors =
      results
      |> Map.values()
      |> Enum.flat_map(& &1.errors)

    all_warnings =
      results
      |> Map.values()
      |> Enum.flat_map(& &1.warnings)

    %{
      error_count: error_count,
      warning_count: warning_count,
      valid_count: valid_count,
      total: length(rooms),
      errors: all_errors,
      warnings: all_warnings,
      results: results
    }
  end
end
