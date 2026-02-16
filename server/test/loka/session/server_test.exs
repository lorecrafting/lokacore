defmodule Loka.Session.ServerTest do
  use ExUnit.Case, async: false

  alias Loka.Session.{Server, Registry}

  # Create a unique player for each test
  defp create_test_player(suffix \\ "") do
    id = "test_player_#{System.unique_integer([:positive])}#{suffix}"
    %{id: id, email: "#{id}@test.com"}
  end

  # Helper to start a session server for testing
  defp start_session(player) do
    # Start via the supervisor to ensure proper registry
    case Loka.Session.Supervisor.start_session(player) do
      {:ok, pid} -> {:ok, pid}
      {:error, {:already_started, pid}} -> {:ok, pid}
    end
  end

  # Helper to clean up a session after test
  defp stop_session(player_id) do
    Loka.Session.Supervisor.terminate_session(player_id)
  end

  describe "start_link/1" do
    test "starts a session server for a player" do
      player = create_test_player()

      {:ok, pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      assert Process.alive?(pid)
    end

    test "registers session in player registry" do
      player = create_test_player()

      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      assert Server.exists?(player.id)
    end
  end

  describe "register_client/4" do
    test "registers a client with the session" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      assert {:ok, _session_id} = Server.register_client(player.id, :liveview, self())
    end

    test "client receives messages after registration" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      Server.register_client(player.id, :liveview, self())
      Server.send_message(player.id, {:test_message, "hello"})

      assert_receive {:session_message, {:test_message, "hello"}}, 100
    end

    test "supports multiple client types" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Register self as liveview
      Server.register_client(player.id, :liveview, self())

      # Check state shows client count
      state = Server.get_state(player.id)
      assert state.client_count == 1
      assert :liveview in state.client_types
    end
  end

  describe "send_message/2" do
    test "sends message to all registered clients" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Register this process as a client
      Server.register_client(player.id, :liveview, self())

      # Send message
      Server.send_message(player.id, {:room_event, "A door creaks open."})

      # Should receive the message
      assert_receive {:session_message, {:room_event, "A door creaks open."}}, 100
    end

    test "handles session with no clients gracefully" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Send message without registering any clients
      # Should not crash
      Server.send_message(player.id, {:test_message, "nobody listening"})

      # Give it time to process
      Process.sleep(10)

      # Session should still be alive
      assert Server.exists?(player.id)
    end
  end

  describe "update_state/2" do
    test "updates room_id" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      Server.update_state(player.id, [{:room_id, "room_123"}])

      state = Server.get_state(player.id)
      assert state.current_room_id == "room_123"
    end

    test "updates combat_state" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      Server.update_state(player.id, [{:combat_state, %{enemy: "goblin"}}])

      state = Server.get_state(player.id)
      assert state.in_combat == true
    end

    test "updates dialogue_state" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      Server.update_state(player.id, [{:dialogue_state, %{npc: "merchant"}}])

      state = Server.get_state(player.id)
      assert state.in_dialogue == true
    end

    test "can clear combat and dialogue state" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Set states
      Server.update_state(player.id, [
        {:combat_state, %{enemy: "goblin"}},
        {:dialogue_state, %{npc: "merchant"}}
      ])

      state = Server.get_state(player.id)
      assert state.in_combat == true
      assert state.in_dialogue == true

      # Clear states
      Server.update_state(player.id, [
        {:combat_state, nil},
        {:dialogue_state, nil}
      ])

      state = Server.get_state(player.id)
      assert state.in_combat == false
      assert state.in_dialogue == false
    end

    test "updates room index when room changes" do
      player = create_test_player()
      {:ok, session_pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Enter first room
      Server.update_state(player.id, [{:room_id, "room_1"}])
      # Sync point to ensure cast is processed
      _ = Server.get_state(player.id)

      assert session_pid in Registry.sessions_in_room("room_1")

      # Move to second room
      Server.update_state(player.id, [{:room_id, "room_2"}])
      # Sync point to ensure cast is processed
      _ = Server.get_state(player.id)

      refute session_pid in Registry.sessions_in_room("room_1")
      assert session_pid in Registry.sessions_in_room("room_2")
    end
  end

  describe "get_state/1" do
    test "returns session info map" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      state = Server.get_state(player.id)

      assert state.player_id == player.id
      assert state.player_email == player.email
      assert state.current_room_id == nil
      assert state.in_combat == false
      assert state.in_dialogue == false
      assert state.client_count == 0
      assert state.client_types == []
      assert %DateTime{} = state.created_at
    end

    test "includes session_state field" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      state = Server.get_state(player.id)
      assert state.session_state == "authenticated"
    end
  end

  describe "session_state transitions" do
    test "starts as authenticated after init" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      assert Server.get_state(player.id).session_state == "authenticated"
    end

    test "transitions to in_game when first client registers" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      Server.register_client(player.id, :liveview, self())
      assert Server.get_state(player.id).session_state == "in_game"
    end

    test "transitions to ghost when last client disconnects" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      client = spawn(fn -> Process.sleep(:infinity) end)
      Server.register_client(player.id, :liveview, client)

      assert Server.get_state(player.id).session_state == "in_game"

      Process.exit(client, :kill)
      Process.sleep(20)

      assert Server.get_state(player.id).session_state == "ghost"
    end

    test "transitions back to in_game on reconnect from ghost" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      client = spawn(fn -> Process.sleep(:infinity) end)
      Server.register_client(player.id, :liveview, client)

      Process.exit(client, :kill)
      Process.sleep(20)

      assert Server.get_state(player.id).session_state == "ghost"

      Server.register_client(player.id, :liveview, self())
      assert Server.get_state(player.id).session_state == "in_game"
    end

    test "session_machine/0 returns valid StateMachine" do
      machine = Server.session_machine()
      assert %Loka.Engine.StateMachine{} = machine
      assert machine.initial == "connecting"
    end
  end

  describe "exists?/1" do
    test "returns true for existing session" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      assert Server.exists?(player.id)
    end

    test "returns false for non-existent session" do
      refute Server.exists?("nonexistent_player_#{System.unique_integer()}")
    end
  end

  describe "client disconnect handling" do
    test "removes client from session when process dies" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Spawn a client process
      client = spawn(fn -> Process.sleep(:infinity) end)

      # Register client
      Server.register_client(player.id, :liveview, client)

      state = Server.get_state(player.id)
      assert state.client_count == 1

      # Kill the client
      Process.exit(client, :kill)
      Process.sleep(10)

      state = Server.get_state(player.id)
      assert state.client_count == 0
    end

    test "session stays alive during disconnect grace period" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Spawn and register a client
      client = spawn(fn -> Process.sleep(:infinity) end)
      Server.register_client(player.id, :liveview, client)

      # Kill the client
      Process.exit(client, :kill)
      Process.sleep(10)

      # Session should still exist (in grace period)
      assert Server.exists?(player.id)
    end

    test "reconnecting client cancels disconnect timer" do
      player = create_test_player()
      {:ok, _pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Spawn and register first client
      client1 = spawn(fn -> Process.sleep(:infinity) end)
      Server.register_client(player.id, :liveview, client1)

      # Kill first client (starts disconnect timer)
      Process.exit(client1, :kill)
      Process.sleep(10)

      # Register new client (cancels timer)
      Server.register_client(player.id, :liveview, self())

      state = Server.get_state(player.id)
      assert state.client_count == 1

      # Session should stay alive
      assert Server.exists?(player.id)
    end
  end

  describe "broadcast handling" do
    test "handles broadcast messages" do
      player = create_test_player()
      {:ok, session_pid} = start_session(player)
      on_exit(fn -> stop_session(player.id) end)

      # Register as client
      Server.register_client(player.id, :liveview, self())

      # Send broadcast message directly to session
      send(session_pid, {:broadcast, {:system_message, "Server restarting"}})

      assert_receive {:session_message, {:system_message, "Server restarting"}}, 100
    end
  end
end
