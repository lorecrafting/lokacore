defmodule Exmud.Tui.ServerTest do
  use ExUnit.Case, async: false
  import Bitwise

  alias Exmud.Tui.Server

  @socket_path "/tmp/exmud-tui-test-#{:rand.uniform(999_999)}.sock"

  setup do
    # Set up Ecto sandbox in shared mode so spawned processes can access DB
    # This is needed because ClientHandler spawns new processes that query the DB
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Exmud.Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Exmud.Repo, {:shared, self()})

    # Start a fresh server for each test
    {:ok, pid} = Server.start_link(socket_path: @socket_path, enabled: true)

    on_exit(fn ->
      if Process.alive?(pid), do: GenServer.stop(pid)
      File.rm(@socket_path)
    end)

    %{server: pid}
  end

  describe "start_link/1" do
    test "starts the server and creates socket file", %{server: pid} do
      assert Process.alive?(pid)
      assert File.exists?(@socket_path)
    end

    test "socket has correct permissions" do
      %{mode: mode} = File.stat!(@socket_path)
      # Check owner-only permissions (0600 = 384 in decimal, but mode includes file type)
      assert (mode &&& 0o777) == 0o600
    end

    test "returns :ignore when disabled" do
      # Stop the running server first
      GenServer.stop(Server)

      assert :ignore = Server.start_link(socket_path: @socket_path, enabled: false)
    end
  end

  describe "client registration" do
    test "tracks registered clients" do
      assert Server.client_count() == 0

      # Simulate client registration
      Server.register_client(self())
      # Give it a moment to process
      :timer.sleep(10)

      assert Server.client_count() == 1

      Server.unregister_client(self())
      :timer.sleep(10)

      assert Server.client_count() == 0
    end

    test "automatically unregisters clients when they die" do
      # Spawn a process and register it
      pid =
        spawn(fn ->
          receive do
            :stop -> :ok
          end
        end)

      Server.register_client(pid)
      :timer.sleep(10)
      assert Server.client_count() == 1

      # Kill the process
      send(pid, :stop)
      :timer.sleep(50)

      assert Server.client_count() == 0
    end
  end

  describe "broadcast/1" do
    test "sends message to registered client" do
      # Use a wrapper GenServer to receive the broadcast
      test_pid = self()

      # Spawn a process that acts like a client and forwards messages
      client_pid =
        spawn(fn ->
          receive do
            {:"$gen_cast", {:broadcast, message}} ->
              send(test_pid, {:got_broadcast, message})
          end
        end)

      Server.register_client(client_pid)
      :timer.sleep(10)

      message = %{method: "entity.changed", params: %{id: "test"}}
      Server.broadcast(message)

      assert_receive {:got_broadcast, ^message}, 100
    end
  end

  describe "socket connection" do
    test "accepts client connections" do
      # Connect to the socket
      {:ok, socket} =
        :gen_tcp.connect({:local, String.to_charlist(@socket_path)}, 0, [
          :binary,
          packet: :line,
          active: false
        ])

      # Send a ping request
      request = ~s({"jsonrpc": "2.0", "id": 1, "method": "system.ping"})
      :ok = :gen_tcp.send(socket, request <> "\n")

      # Receive response
      {:ok, response} = :gen_tcp.recv(socket, 0, 5000)
      {:ok, decoded} = Jason.decode(response)

      assert decoded["jsonrpc"] == "2.0"
      assert decoded["id"] == 1
      assert decoded["result"]["pong"] == true

      :gen_tcp.close(socket)
    end

    test "handles system.info request" do
      {:ok, socket} =
        :gen_tcp.connect({:local, String.to_charlist(@socket_path)}, 0, [
          :binary,
          packet: :line,
          active: false
        ])

      request = ~s({"jsonrpc": "2.0", "id": 2, "method": "system.info"})
      :ok = :gen_tcp.send(socket, request <> "\n")

      {:ok, response} = :gen_tcp.recv(socket, 0, 5000)
      {:ok, decoded} = Jason.decode(response)

      assert decoded["id"] == 2
      assert is_binary(decoded["result"]["version"])
      assert is_integer(decoded["result"]["uptime_ms"])

      :gen_tcp.close(socket)
    end

    test "returns error for unknown method" do
      {:ok, socket} =
        :gen_tcp.connect({:local, String.to_charlist(@socket_path)}, 0, [
          :binary,
          packet: :line,
          active: false
        ])

      request = ~s({"jsonrpc": "2.0", "id": 3, "method": "unknown.method"})
      :ok = :gen_tcp.send(socket, request <> "\n")

      {:ok, response} = :gen_tcp.recv(socket, 0, 5000)
      {:ok, decoded} = Jason.decode(response)

      assert decoded["id"] == 3
      assert decoded["error"]["code"] == -32601
      assert decoded["error"]["message"] =~ "not found"

      :gen_tcp.close(socket)
    end

    test "returns error for invalid JSON" do
      {:ok, socket} =
        :gen_tcp.connect({:local, String.to_charlist(@socket_path)}, 0, [
          :binary,
          packet: :line,
          active: false
        ])

      :ok = :gen_tcp.send(socket, "not valid json\n")

      {:ok, response} = :gen_tcp.recv(socket, 0, 5000)
      {:ok, decoded} = Jason.decode(response)

      assert decoded["error"]["code"] == -32700

      :gen_tcp.close(socket)
    end
  end
end
