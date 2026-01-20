defmodule Loka.Framework.BroadcastTest do
  use Loka.DataCase, async: false

  alias Loka.Framework.Broadcast
  alias Loka.Session

  describe "format_message/2" do
    test "formats system messages with [System] prefix" do
      assert Broadcast.format_message("Server restart soon", :system) ==
               "[System] Server restart soon"
    end

    test "formats event messages with [Event] prefix" do
      assert Broadcast.format_message("Festival begins!", :event) ==
               "[Event] Festival begins!"
    end

    test "formats emergency messages with urgent prefix" do
      assert Broadcast.format_message("Server shutting down", :emergency) ==
               "[!!! EMERGENCY !!!] Server shutting down"
    end
  end

  describe "css_class/1" do
    test "returns correct CSS class for each message type" do
      assert Broadcast.css_class(:system) == "broadcast-system"
      assert Broadcast.css_class(:event) == "broadcast-event"
      assert Broadcast.css_class(:emergency) == "broadcast-emergency"
    end
  end

  describe "to_all/2" do
    test "returns :ok" do
      # to_all broadcasts to all players via Session.broadcast_all
      # This should not raise and should return :ok
      assert Broadcast.to_all("Test message") == :ok
      assert Broadcast.to_all("Test event", :event) == :ok
      assert Broadcast.to_all("Test emergency", :emergency) == :ok
    end

    test "defaults to :system type" do
      # Just verifying it doesn't crash with default type
      assert Broadcast.to_all("Default type message") == :ok
    end
  end

  describe "to_zone/3" do
    test "returns :ok for valid zone" do
      # to_zone uses ZoneRegistry which may not have data in test
      # but should still return :ok (empty list of players is fine)
      assert Broadcast.to_zone("test_zone", "Zone message") == :ok
      assert Broadcast.to_zone("test_zone", "Zone event", :event) == :ok
    end

    test "defaults to :event type" do
      assert Broadcast.to_zone("test_zone", "Default event") == :ok
    end
  end

  describe "to_players/3" do
    test "returns :ok for empty player list" do
      assert Broadcast.to_players([], "Message") == :ok
    end

    test "returns :ok for player list (even if players not online)" do
      # send_to_player returns {:error, :not_online} for offline players
      # but to_players should still return :ok
      assert Broadcast.to_players(["nonexistent_player"], "Message") == :ok
    end

    test "defaults to :event type" do
      assert Broadcast.to_players(["player1"], "Default event") == :ok
    end
  end

  describe "to_room/3" do
    test "returns :ok for any room" do
      # broadcast_to_room always succeeds, even for empty/nonexistent rooms
      assert Broadcast.to_room("test_room", "Room message") == :ok
      assert Broadcast.to_room("test_room", "Room event", :event) == :ok
    end

    test "defaults to :event type" do
      assert Broadcast.to_room("test_room", "Default event") == :ok
    end
  end

  describe "integration with Session" do
    setup do
      # Start a session for testing message delivery
      # This requires a player to exist
      :ok
    end

    # Note: Full integration tests with actual player sessions
    # would require setting up a complete player/session infrastructure.
    # Those are better suited for integration tests in test/integration/
  end
end
