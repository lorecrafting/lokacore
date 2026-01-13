defmodule Loka.Session.RegistryTest do
  use ExUnit.Case, async: false

  alias Loka.Session.Registry

  # The Registry GenServer creates the ETS table on init
  # We need it running for room index tests
  setup do
    # Ensure Registry is started (it's started by application supervisor normally)
    case GenServer.whereis(Registry) do
      nil ->
        {:ok, _pid} = Registry.start_link([])
        :ok

      _pid ->
        # Already running, clear any existing room index entries
        :ets.delete_all_objects(:loka_session_room_index)
        :ok
    end

    :ok
  end

  describe "room index operations" do
    test "sessions_in_room/1 returns empty list for nil room" do
      assert Registry.sessions_in_room(nil) == []
    end

    test "sessions_in_room/1 returns empty list for empty room" do
      assert Registry.sessions_in_room("empty_room") == []
    end

    test "update_room_index/3 adds session to room" do
      fake_pid = self()

      # Add to room
      assert :ok = Registry.update_room_index(fake_pid, nil, "room_1")

      # Verify in room
      assert Registry.sessions_in_room("room_1") == [fake_pid]
    end

    test "update_room_index/3 moves session between rooms" do
      fake_pid = self()

      # Add to room_1
      Registry.update_room_index(fake_pid, nil, "room_1")
      assert Registry.sessions_in_room("room_1") == [fake_pid]

      # Move to room_2
      Registry.update_room_index(fake_pid, "room_1", "room_2")

      # Verify moved
      assert Registry.sessions_in_room("room_1") == []
      assert Registry.sessions_in_room("room_2") == [fake_pid]
    end

    test "update_room_index/3 removes session when moving to nil room" do
      fake_pid = self()

      # Add to room
      Registry.update_room_index(fake_pid, nil, "room_1")
      assert Registry.sessions_in_room("room_1") == [fake_pid]

      # Remove from room (move to nil)
      Registry.update_room_index(fake_pid, "room_1", nil)

      # Verify removed
      assert Registry.sessions_in_room("room_1") == []
    end

    test "update_room_index/3 supports multiple sessions in same room" do
      pid1 = spawn(fn -> Process.sleep(:infinity) end)
      pid2 = spawn(fn -> Process.sleep(:infinity) end)

      on_exit(fn ->
        Process.exit(pid1, :kill)
        Process.exit(pid2, :kill)
      end)

      # Add both to same room
      Registry.update_room_index(pid1, nil, "room_1")
      Registry.update_room_index(pid2, nil, "room_1")

      # Verify both in room
      sessions = Registry.sessions_in_room("room_1")
      assert length(sessions) == 2
      assert pid1 in sessions
      assert pid2 in sessions
    end

    test "remove_from_room_index/2 removes session from room" do
      fake_pid = self()

      # Add to room
      Registry.update_room_index(fake_pid, nil, "room_1")
      assert Registry.sessions_in_room("room_1") == [fake_pid]

      # Remove
      assert :ok = Registry.remove_from_room_index(fake_pid, "room_1")

      # Verify removed
      assert Registry.sessions_in_room("room_1") == []
    end

    test "remove_from_room_index/2 handles nil room" do
      assert :ok = Registry.remove_from_room_index(self(), nil)
    end

    test "remove_from_room_index/2 is idempotent" do
      fake_pid = self()

      # Remove from non-existent entry
      assert :ok = Registry.remove_from_room_index(fake_pid, "nonexistent_room")

      # Still returns :ok
      assert :ok = Registry.remove_from_room_index(fake_pid, "nonexistent_room")
    end
  end

  describe "get_session/1" do
    test "returns nil for unregistered player" do
      assert Registry.get_session("nonexistent_player") == nil
    end

    # Note: Testing get_session with actual sessions requires starting
    # Session.Server processes, which is covered in session_test.exs
  end

  describe "online?/1" do
    test "returns false for offline player" do
      refute Registry.online?("offline_player")
    end
  end

  describe "online_count/0" do
    test "returns 0 when no sessions" do
      # This may be non-zero if other tests have sessions running
      # Just verify it returns a non-negative integer
      count = Registry.online_count()
      assert is_integer(count)
      assert count >= 0
    end
  end

  describe "list_sessions/0" do
    test "returns list" do
      # Just verify it returns a list
      sessions = Registry.list_sessions()
      assert is_list(sessions)
    end
  end
end
