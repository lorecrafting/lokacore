defmodule Loka.Session.SupervisorTest do
  use ExUnit.Case, async: false

  alias Loka.Session.{Supervisor, Server}

  # Create a unique player for each test
  defp create_test_player(suffix \\ "") do
    id = "test_supervisor_player_#{System.unique_integer([:positive])}#{suffix}"
    %{id: id, email: "#{id}@test.com"}
  end

  describe "start_session/1" do
    test "starts a session for a player" do
      player = create_test_player()

      {:ok, pid} = Supervisor.start_session(player)
      on_exit(fn -> Supervisor.terminate_session(player.id) end)

      assert is_pid(pid)
      assert Process.alive?(pid)
    end

    test "returns error for already started session" do
      player = create_test_player()

      {:ok, pid1} = Supervisor.start_session(player)
      on_exit(fn -> Supervisor.terminate_session(player.id) end)

      # Try to start again
      result = Supervisor.start_session(player)

      assert {:error, {:already_started, ^pid1}} = result
    end
  end

  describe "get_or_start_session/1" do
    test "starts new session if none exists" do
      player = create_test_player()

      {:ok, pid} = Supervisor.get_or_start_session(player)
      on_exit(fn -> Supervisor.terminate_session(player.id) end)

      assert is_pid(pid)
      assert Process.alive?(pid)
    end

    test "returns existing session if already started" do
      player = create_test_player()

      {:ok, pid1} = Supervisor.get_or_start_session(player)
      on_exit(fn -> Supervisor.terminate_session(player.id) end)

      {:ok, pid2} = Supervisor.get_or_start_session(player)

      assert pid1 == pid2
    end

    test "is idempotent - can be called multiple times" do
      player = create_test_player()
      on_exit(fn -> Supervisor.terminate_session(player.id) end)

      # Call multiple times
      {:ok, pid1} = Supervisor.get_or_start_session(player)
      {:ok, pid2} = Supervisor.get_or_start_session(player)
      {:ok, pid3} = Supervisor.get_or_start_session(player)

      # All should return the same pid
      assert pid1 == pid2
      assert pid2 == pid3
    end
  end

  describe "count_sessions/0" do
    test "returns count of active sessions" do
      player1 = create_test_player("_1")
      player2 = create_test_player("_2")

      initial_count = Supervisor.count_sessions()

      {:ok, _} = Supervisor.start_session(player1)
      {:ok, _} = Supervisor.start_session(player2)

      on_exit(fn ->
        Supervisor.terminate_session(player1.id)
        Supervisor.terminate_session(player2.id)
      end)

      assert Supervisor.count_sessions() == initial_count + 2
    end
  end

  describe "list_sessions/0" do
    test "returns list of session pids" do
      player = create_test_player()

      {:ok, pid} = Supervisor.start_session(player)
      on_exit(fn -> Supervisor.terminate_session(player.id) end)

      sessions = Supervisor.list_sessions()

      assert is_list(sessions)
      assert pid in sessions
    end

    test "only returns alive session pids" do
      sessions = Supervisor.list_sessions()

      Enum.each(sessions, fn pid ->
        assert is_pid(pid)
        assert Process.alive?(pid)
      end)
    end
  end

  describe "terminate_session/1" do
    test "terminates an existing session" do
      player = create_test_player()

      {:ok, pid} = Supervisor.start_session(player)

      # Verify session exists
      assert Server.exists?(player.id)
      assert Process.alive?(pid)

      # Terminate
      assert :ok = Supervisor.terminate_session(player.id)

      # Wait a moment for termination
      Process.sleep(10)

      # Verify terminated
      refute Process.alive?(pid)
      refute Server.exists?(player.id)
    end

    test "returns error for non-existent session" do
      result = Supervisor.terminate_session("nonexistent_player_#{System.unique_integer()}")

      assert {:error, :not_found} = result
    end
  end

  describe "session supervision" do
    test "sessions are not automatically restarted on crash" do
      player = create_test_player()

      {:ok, pid} = Supervisor.start_session(player)

      # Kill the session
      Process.exit(pid, :kill)
      Process.sleep(50)

      # Session should NOT be restarted (temporary strategy)
      refute Process.alive?(pid)
      refute Server.exists?(player.id)
    end
  end
end
