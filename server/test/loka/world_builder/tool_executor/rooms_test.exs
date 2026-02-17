defmodule Loka.WorldBuilder.ToolExecutor.RoomsTest do
  @moduledoc "Tests for ToolExecutor.Rooms domain module."
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.ToolExecutor.Rooms
  alias Loka.WorldBuilder.RoomManager
  alias Loka.TestCleanup

  setup_all do
    on_exit(fn -> TestCleanup.cleanup_room_test_files() end)
    :ok
  end

  describe "execute_create_room/1" do
    test "creates room with all fields" do
      input = %{
        "key" => "rooms_test_full_#{System.unique_integer([:positive])}",
        "name" => "Full Room",
        "description" => "A fully described room",
        "x" => 10,
        "y" => 20,
        "z" => 1,
        "tags" => ["test", "indoor"]
      }

      assert {:ok, result} = Rooms.execute_create_room(input)
      assert result.success == true
      assert result.room.key == input["key"]
      assert result.room.name == "Full Room"
      assert result.room.x == 10
      assert result.room.y == 20
      assert result.room.z == 1
    end

    test "creates room with defaults for optional fields" do
      input = %{
        "key" => "rooms_test_minimal_#{System.unique_integer([:positive])}",
        "name" => "Minimal Room"
      }

      assert {:ok, result} = Rooms.execute_create_room(input)
      assert result.room.x == 0
      assert result.room.y == 0
      assert result.room.z == 0
    end

    test "returns error for duplicate key" do
      key = "rooms_test_dup_#{System.unique_integer([:positive])}"
      input = %{"key" => key, "name" => "First"}

      assert {:ok, _} = Rooms.execute_create_room(input)
      assert {:error, reason} = Rooms.execute_create_room(input)
      assert is_binary(reason)
    end
  end

  describe "execute_update_room/1" do
    setup do
      {:ok, room} =
        RoomManager.create_room(%{
          key: "rooms_test_update_#{System.unique_integer([:positive])}",
          name: "Original",
          description: "Original desc"
        })

      %{room: room}
    end

    test "updates name", %{room: room} do
      assert {:ok, result} =
               Rooms.execute_update_room(%{"room_key" => room.key, "name" => "New Name"})

      assert result.room.name == "New Name"
    end

    test "updates description", %{room: room} do
      assert {:ok, result} =
               Rooms.execute_update_room(%{"room_key" => room.key, "description" => "Updated"})

      assert result.room.description == "Updated"
    end

    test "updates coordinates", %{room: room} do
      assert {:ok, result} =
               Rooms.execute_update_room(%{
                 "room_key" => room.key,
                 "x" => 99,
                 "y" => 88,
                 "z" => 77
               })

      assert result.room.x == 99
      assert result.room.y == 88
      assert result.room.z == 77
    end

    test "ignores nil values", %{room: room} do
      assert {:ok, result} =
               Rooms.execute_update_room(%{
                 "room_key" => room.key,
                 "name" => "Updated",
                 "description" => nil
               })

      assert result.room.name == "Updated"
    end

    test "returns error for non-existent room" do
      assert {:error, _} = Rooms.execute_update_room(%{"room_key" => "nonexistent_xyz"})
    end
  end

  describe "execute_delete_room/1" do
    test "deletes an existing room" do
      {:ok, room} =
        RoomManager.create_room(%{
          key: "rooms_test_del_#{System.unique_integer([:positive])}",
          name: "To Delete"
        })

      assert {:ok, result} = Rooms.execute_delete_room(%{"room_key" => room.key})
      assert result.success == true
    end

    test "returns error for non-existent room" do
      assert {:error, _} = Rooms.execute_delete_room(%{"room_key" => "nonexistent_del"})
    end
  end

  describe "execute_create_exit/1" do
    setup do
      {:ok, from} =
        RoomManager.create_room(%{
          key: "rooms_test_exit_from_#{System.unique_integer([:positive])}",
          name: "From"
        })

      {:ok, to} =
        RoomManager.create_room(%{
          key: "rooms_test_exit_to_#{System.unique_integer([:positive])}",
          name: "To"
        })

      %{from: from, to: to}
    end

    test "creates exit between rooms", %{from: from, to: to} do
      input = %{"from_room" => from.key, "direction" => "north", "to_room" => to.key}

      assert {:ok, result} = Rooms.execute_create_exit(input)
      assert result.success == true
      assert result.message =~ "Created exit"
    end

    test "returns error for invalid from room", %{to: to} do
      input = %{"from_room" => "nonexistent", "direction" => "north", "to_room" => to.key}
      assert {:error, _} = Rooms.execute_create_exit(input)
    end
  end

  describe "execute_remove_exit/1" do
    setup do
      {:ok, from} =
        RoomManager.create_room(%{
          key: "rooms_test_rmex_from_#{System.unique_integer([:positive])}",
          name: "From"
        })

      {:ok, to} =
        RoomManager.create_room(%{
          key: "rooms_test_rmex_to_#{System.unique_integer([:positive])}",
          name: "To"
        })

      {:ok, _} = RoomManager.add_exit(from.key, "east", to.key)

      %{from: from}
    end

    test "removes exit", %{from: from} do
      assert {:ok, result} =
               Rooms.execute_remove_exit(%{"from_room" => from.key, "direction" => "east"})

      assert result.success == true
    end

    test "returns error for non-existent room" do
      assert {:error, _} =
               Rooms.execute_remove_exit(%{"from_room" => "nonexistent", "direction" => "east"})
    end
  end

  describe "execute_get_room_info/1" do
    test "returns room info" do
      {:ok, room} =
        RoomManager.create_room(%{
          key: "rooms_test_info_#{System.unique_integer([:positive])}",
          name: "Info Room",
          description: "Test room",
          x: 5,
          y: 10
        })

      assert {:ok, result} = Rooms.execute_get_room_info(%{"room_key" => room.key})
      assert result.room.key == room.key
      assert result.room.name == "Info Room"
      assert result.room.x == 5
      assert result.room.y == 10
    end

    test "returns error for non-existent room" do
      assert {:error, _} = Rooms.execute_get_room_info(%{"room_key" => "nonexistent_info"})
    end
  end

  describe "execute_list_rooms/1" do
    test "lists all rooms" do
      assert {:ok, result} = Rooms.execute_list_rooms(%{})
      assert result.success == true
      assert is_list(result.rooms)
    end

    test "filters by tag" do
      {:ok, _} =
        RoomManager.create_room(%{
          key: "rooms_test_tag_#{System.unique_integer([:positive])}",
          name: "Tagged",
          tags: ["rooms_test_special_tag"]
        })

      assert {:ok, result} = Rooms.execute_list_rooms(%{"filter_tag" => "rooms_test_special_tag"})
      assert result.success == true
      assert length(result.rooms) >= 1
    end
  end

  describe "execute_batch_create_rooms/1" do
    test "creates multiple rooms" do
      input = %{
        "rooms" => [
          %{
            "key" => "rooms_test_batch_a_#{System.unique_integer([:positive])}",
            "name" => "Batch A"
          },
          %{
            "key" => "rooms_test_batch_b_#{System.unique_integer([:positive])}",
            "name" => "Batch B"
          }
        ]
      }

      assert {:ok, result} = Rooms.execute_batch_create_rooms(input)
      assert result.success == true
      assert result.message =~ "Created 2 rooms"
    end

    test "handles empty list" do
      assert {:ok, result} = Rooms.execute_batch_create_rooms(%{"rooms" => []})
      assert result.message =~ "Created 0 rooms"
    end
  end
end
