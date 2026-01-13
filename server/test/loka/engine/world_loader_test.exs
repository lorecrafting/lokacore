defmodule Loka.Engine.WorldLoaderTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.{WorldLoader, PrototypeLoader, Entities}

  @default_prototypes_path "priv/world/prototypes"

  setup do
    # Clear any existing entities
    Entities.delete_all()

    # Explicitly load from default path to avoid test contamination
    # (other tests may have called load_from with test fixture paths)
    PrototypeLoader.load_from(@default_prototypes_path)

    :ok
  end

  describe "spawn_world/1" do
    test "spawns world from prototypes" do
      # Use the actual production starting room
      assert {:ok, stats} = WorldLoader.spawn_world(starting_room: "monastery_gate")

      # Should have spawned at least the starting room
      assert stats.rooms >= 1
    end

    test "returns error for unknown starting room" do
      # Unknown starting room returns an error
      assert {:error, {:prototype_not_found, "nonexistent_room"}} =
               WorldLoader.spawn_world(starting_room: "nonexistent_room")
    end
  end

  describe "spawn_room_chain/2" do
    test "spawns a single room" do
      # Use the actual production starting room
      assert {:ok, results} = WorldLoader.spawn_room_chain("monastery_gate")

      assert length(results) >= 1
      room_result = List.first(results)
      assert room_result.room.type == :room
    end

    test "respects max_rooms option" do
      assert {:ok, results} = WorldLoader.spawn_room_chain("monastery_gate", max_rooms: 1)

      assert length(results) == 1
    end

    test "returns error for unknown prototype" do
      # Unknown starting prototype returns an error
      assert {:error, {:prototype_not_found, "unknown"}} =
               WorldLoader.spawn_room_chain("unknown")
    end
  end

  describe "validate/0" do
    test "returns ok with issues list for prototypes" do
      {:ok, issues} = WorldLoader.validate()

      # validate/0 returns {:ok, issues} where issues is a list
      # (may be empty or contain broken refs from prototypes)
      assert is_list(issues)
    end
  end

  describe "reset_world/1" do
    test "clears existing entities and respawns" do
      # First spawn using actual production starting room
      {:ok, _stats1} = WorldLoader.spawn_world(starting_room: "monastery_gate")
      count_before = Entities.count_all()
      assert count_before > 0

      # Reset
      {:ok, stats2} = WorldLoader.reset_world(starting_room: "monastery_gate")

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
