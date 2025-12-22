defmodule Exmud.Tui.Server do
  @moduledoc """
  TUI Server that listens on a Unix domain socket for Go TUI client connections.

  Manages client connections and provides broadcasting for real-time updates.
  Uses JSON-RPC 2.0 protocol over Unix socket.

  ## Configuration

      config :exmud, Exmud.Tui.Server,
        socket_path: "/tmp/exmud-tui-dev.sock",
        enabled: true

  ## Architecture

  - One GenServer manages the listening socket and client registry
  - Each client connection spawns a ClientHandler process
  - Broadcasts go to all registered clients for real-time sync
  """

  use GenServer
  require Logger

  @default_socket_path "/tmp/exmud-tui-#{Mix.env()}.sock"

  # Client API

  @doc """
  Starts the TUI server.

  ## Options

    * `:socket_path` - Path for the Unix socket (default: /tmp/exmud-tui-{env}.sock)
    * `:enabled` - Whether to start the server (default: true)
  """
  def start_link(opts \\ []) do
    if Keyword.get(opts, :enabled, enabled?()) do
      GenServer.start_link(__MODULE__, opts, name: __MODULE__)
    else
      :ignore
    end
  end

  @doc """
  Returns the socket path from configuration.
  """
  @spec socket_path() :: String.t()
  def socket_path do
    Application.get_env(:exmud, __MODULE__, [])
    |> Keyword.get(:socket_path, @default_socket_path)
  end

  @doc """
  Returns whether the TUI server is enabled.
  """
  @spec enabled?() :: boolean()
  def enabled? do
    Application.get_env(:exmud, __MODULE__, [])
    |> Keyword.get(:enabled, true)
  end

  @doc """
  Registers a client handler process for broadcasts.
  """
  @spec register_client(pid()) :: :ok
  def register_client(pid) when is_pid(pid) do
    GenServer.cast(__MODULE__, {:register_client, pid})
  end

  @doc """
  Unregisters a client handler process.
  """
  @spec unregister_client(pid()) :: :ok
  def unregister_client(pid) when is_pid(pid) do
    GenServer.cast(__MODULE__, {:unregister_client, pid})
  end

  @doc """
  Broadcasts a message to all connected clients.

  ## Example

      Exmud.Tui.Server.broadcast(%{
        method: "entity.changed",
        params: %{action: "updated", type: "room", id: "abc123"}
      })
  """
  @spec broadcast(map()) :: :ok
  def broadcast(message) when is_map(message) do
    GenServer.cast(__MODULE__, {:broadcast, message})
  end

  @doc """
  Returns the number of connected clients.
  """
  @spec client_count() :: non_neg_integer()
  def client_count do
    GenServer.call(__MODULE__, :client_count)
  end

  # Server Callbacks

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :socket_path, socket_path())

    # Clean up old socket file if it exists
    File.rm(path)

    # Create Unix domain socket
    case :gen_tcp.listen(0, socket_opts(path)) do
      {:ok, listen_socket} ->
        # Set socket permissions to owner only (600)
        File.chmod!(path, 0o600)

        # Start the acceptor loop in a linked process
        acceptor_pid = spawn_link(fn -> accept_loop(listen_socket) end)

        Logger.info("[TuiServer] Listening on #{path}")

        {:ok,
         %{
           socket: listen_socket,
           path: path,
           clients: MapSet.new(),
           acceptor: acceptor_pid
         }}

      {:error, reason} ->
        Logger.error("[TuiServer] Failed to start: #{inspect(reason)}")
        {:stop, reason}
    end
  end

  @impl true
  def handle_call(:client_count, _from, state) do
    {:reply, MapSet.size(state.clients), state}
  end

  @impl true
  def handle_cast({:register_client, pid}, state) do
    Process.monitor(pid)
    Logger.debug("[TuiServer] Client registered: #{inspect(pid)}")
    {:noreply, %{state | clients: MapSet.put(state.clients, pid)}}
  end

  @impl true
  def handle_cast({:unregister_client, pid}, state) do
    Logger.debug("[TuiServer] Client unregistered: #{inspect(pid)}")
    {:noreply, %{state | clients: MapSet.delete(state.clients, pid)}}
  end

  @impl true
  def handle_cast({:broadcast, message}, state) do
    Enum.each(state.clients, fn client_pid ->
      GenServer.cast(client_pid, {:broadcast, message})
    end)

    {:noreply, state}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    {:noreply, %{state | clients: MapSet.delete(state.clients, pid)}}
  end

  @impl true
  def handle_info({:new_client, client_socket}, state) do
    # Start a client handler for this connection
    case Exmud.Tui.ClientHandler.start_link(client_socket) do
      {:ok, handler_pid} ->
        # Transfer socket ownership to the handler
        :gen_tcp.controlling_process(client_socket, handler_pid)
        # Tell the handler it can now activate the socket
        send(handler_pid, :socket_ready)

      {:error, reason} ->
        Logger.warning("[TuiServer] Failed to start client handler: #{inspect(reason)}")
        :gen_tcp.close(client_socket)
    end

    {:noreply, state}
  end

  @impl true
  def terminate(_reason, state) do
    :gen_tcp.close(state.socket)
    File.rm(state.path)
    Logger.info("[TuiServer] Stopped, socket cleaned up")
    :ok
  end

  # Private Functions

  defp socket_opts(path) do
    [
      :binary,
      packet: :line,
      active: false,
      reuseaddr: true,
      ip: {:local, String.to_charlist(path)}
    ]
  end

  defp accept_loop(listen_socket) do
    case :gen_tcp.accept(listen_socket) do
      {:ok, client_socket} ->
        # Transfer socket ownership to the server GenServer before notifying
        server_pid = Process.whereis(__MODULE__)

        if server_pid do
          :gen_tcp.controlling_process(client_socket, server_pid)
          send(server_pid, {:new_client, client_socket})
        else
          :gen_tcp.close(client_socket)
        end

        accept_loop(listen_socket)

      {:error, :closed} ->
        # Socket was closed, exit gracefully
        :ok

      {:error, reason} ->
        Logger.warning("[TuiServer] Accept error: #{inspect(reason)}")
        accept_loop(listen_socket)
    end
  end
end
