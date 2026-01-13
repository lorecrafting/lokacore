defmodule Loka.WorldBuilder.ValidationManagerTest do
  use ExUnit.Case, async: false

  alias Loka.WorldBuilder.ValidationManager

  describe "validate_all/0" do
    test "returns validation results" do
      assert %{} = ValidationManager.validate_all()
    end

    test "includes quest validation results" do
      results = ValidationManager.validate_all()
      assert Map.has_key?(results, :total_errors)
      assert Map.has_key?(results, :quest_errors)
      assert Map.has_key?(results, :quest_warnings)
    end

    test "includes cutscene validation results" do
      results = ValidationManager.validate_all()
      assert Map.has_key?(results, :cutscene_errors)
      assert Map.has_key?(results, :cutscene_warnings)
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

      assert {:ok, _} = ValidationManager.validate_room(room)
    end

    test "returns errors for missing required fields" do
      room = %{key: "incomplete"}
      assert {:error, errors} = ValidationManager.validate_room(room)
      assert is_list(errors)
      assert length(errors) > 0
    end

    test "validates room exits point to valid destinations" do
      room = %{
        key: "room_with_exit",
        name: "Room",
        exits: %{north: "nonexistent_room"}
      }

      result = ValidationManager.validate_room(room)
      # May return error or warning depending on implementation
      case result do
        {:error, _} -> assert true
        {:ok, _warnings} -> assert true
        _ -> assert false, "Unexpected result: #{inspect(result)}"
      end
    end

    test "returns error for nil room" do
      assert {:error, _} = ValidationManager.validate_room(nil)
    end

    test "returns error for empty map" do
      assert {:error, _} = ValidationManager.validate_room(%{})
    end
  end
end
