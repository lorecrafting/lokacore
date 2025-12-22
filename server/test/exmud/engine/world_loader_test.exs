defmodule Exmud.Engine.WorldLoaderTest do
  use Exmud.DataCase, async: false

  alias Exmud.Engine.{WorldLoader, PrototypeLoader, Entities}

  setup do
    # Clear any existing entities
    Entities.delete_all()

    # Reload prototypes (using default path which has our prototypes)
    PrototypeLoader.reload()

    :ok
  end

  describe "spawn_world/1" do
    test "spawns world from prototypes" do
      assert {:ok, stats} = WorldLoader.spawn_world(starting_room: "forest_clearing")

      # Should have spawned at least the starting room
      assert stats.rooms >= 1
    end

    test "returns empty stats for unknown starting room" do
      # Unknown rooms result in empty world, not an error
      # This is consistent with spawn_room_chain behavior
      assert {:ok, stats} = WorldLoader.spawn_world(starting_room: "nonexistent_room")
      assert stats.rooms == 0
    end
  end

  describe "spawn_room_chain/2" do
    test "spawns a single room" do
      assert {:ok, results} = WorldLoader.spawn_room_chain("forest_clearing")

      assert length(results) >= 1
      room_result = List.first(results)
      assert room_result.room.type == :room
    end

    test "respects max_rooms option" do
      assert {:ok, results} = WorldLoader.spawn_room_chain("forest_clearing", max_rooms: 1)

      assert length(results) == 1
    end

    test "returns empty list for unknown prototype" do
      # Unknown prototypes are logged as warnings but don't fail the chain
      # This allows partial spawning even if some exits reference missing rooms
      assert {:ok, []} = WorldLoader.spawn_room_chain("unknown")
    end
  end

  describe "validate/0" do
    test "returns ok with empty issues for valid prototypes" do
      {:ok, issues} = WorldLoader.validate()

      # Our test prototypes should be valid
      # Filter out issues for prototypes we control
      our_issues =
        Enum.filter(issues, fn
          {:broken_exit, key, _, _} -> String.starts_with?(key, "forest_")
          {:broken_spawn, key, _} -> String.starts_with?(key, "forest_")
          _ -> false
        end)

      assert our_issues == []
    end
  end

  describe "reset_world/1" do
    test "clears existing entities and respawns" do
      # First spawn
      {:ok, _stats1} = WorldLoader.spawn_world(starting_room: "forest_clearing")
      count_before = Entities.count_all()
      assert count_before > 0

      # Reset
      {:ok, stats2} = WorldLoader.reset_world(starting_room: "forest_clearing")

      assert stats2.rooms >= 1
    end
  end

  describe "get_starting_room/0 and get_starting_room_id/0" do
    test "returns nil when no starting room spawned" do
      assert {:error, :not_found} = WorldLoader.get_starting_room()
      assert nil == WorldLoader.get_starting_room_id()
    end
  end
end
