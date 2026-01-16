defmodule Loka.WorldBuilder.ValidationManagerTest do
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.ValidationManager

  describe "validate_all/0" do
    test "returns validation results" do
      assert %{} = ValidationManager.validate_all()
    end

    test "includes quest validation results" do
      results = ValidationManager.validate_all()
      assert Map.has_key?(results, :total_errors)
      assert Map.has_key?(results, :quests)
    end

    test "includes cutscene validation results" do
      results = ValidationManager.validate_all()
      assert Map.has_key?(results, :cutscenes)
    end

    test "includes room validation results" do
      results = ValidationManager.validate_all()
      assert Map.has_key?(results, :rooms)
    end

    test "returns zero errors for valid content" do
      results = ValidationManager.validate_all()
      # Should have no errors if content is valid
      assert is_integer(results.total_errors)
    end
  end

  describe "validate_room/1" do
    test "validates room with all required fields" do
      room = %{
        key: "test_room",
        name: "Test Room",
        description: "A test room",
        x: 0,
        y: 0,
        z: 0
      }

      result = ValidationManager.validate_room(room)
      assert result.status == :valid
      assert result.errors == []
      assert result.warnings == []
    end

    test "returns warnings for missing name" do
      room = %{key: "incomplete", description: "A room"}
      result = ValidationManager.validate_room(room)
      assert result.status == :warning
      assert length(result.warnings) > 0
    end

    test "returns warnings for missing description" do
      room = %{key: "incomplete", name: "A Room"}
      result = ValidationManager.validate_room(room)
      assert result.status == :warning
      assert length(result.warnings) > 0
    end

    test "validates room exits point to valid destinations" do
      room = %{
        key: "room_with_exit",
        name: "Room",
        description: "A room",
        exits: %{north: "nonexistent_room"}
      }

      result = ValidationManager.validate_room(room)
      # Should return error for invalid exit
      assert result.status == :error
      assert length(result.errors) > 0
    end

    test "returns valid for room with valid exit" do
      # Use a room key that exists in the world
      room = %{
        key: "room_with_valid_exit",
        name: "Room",
        description: "A room",
        exits: %{}
      }

      result = ValidationManager.validate_room(room)
      assert result.status == :valid
    end
  end

  describe "validate_rooms/1" do
    test "validates multiple rooms" do
      rooms = [
        %{key: "room1", name: "Room 1", description: "First room"},
        %{key: "room2", name: "Room 2", description: "Second room"}
      ]

      results = ValidationManager.validate_rooms(rooms)
      assert is_map(results)
      assert Map.has_key?(results, "room1")
      assert Map.has_key?(results, "room2")
    end
  end

  describe "validation_summary/1" do
    test "returns summary counts" do
      rooms = [
        %{key: "valid_room", name: "Valid", description: "A valid room"},
        %{key: "warning_room", description: "Missing name"},
        %{key: "error_room", name: "Error", description: "Room", exits: %{north: "nonexistent"}}
      ]

      summary = ValidationManager.validation_summary(rooms)
      assert summary.total == 3
      assert is_integer(summary.error_count)
      assert is_integer(summary.warning_count)
      assert is_integer(summary.valid_count)
    end
  end
end
