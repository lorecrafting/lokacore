defmodule Loka.Dev.TelnetServer do
  @moduledoc """
  Dev-only TCP server that lets Claude Code (or any terminal) connect to the
  game as the admin player.

  ## Usage

      nc localhost 4023

  ## Features

  - Persistent connection — state carries between commands
  - Dialogue state preserved (can navigate multi-step quest acceptance)
  - Ambient events shown inline (NPC emotes, player speech, weather)
  - ANSI colors for ambient vs. command output
  - Auto-authenticates as admin@loka.local in dev mode

  ## Claude Code Usage

      # Single command (nc closes when stdin closes)
      echo "look" | nc localhost 4023

      # Multi-step sequence
      printf "goto awakening_clearing\\nlook\\ntalk thera\\n1\\n" | nc localhost 4023

      # Interactive (keep connection open)
      # Run in background, Claude reads output file
  """

  use Supervisor

  require Logger

  @port 4023

  @doc "Port the telnet server listens on."
  def port, do: @port

  @spec start_link(keyword()) :: Supervisor.on_start()
  def start_link(opts \\ []) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    children = [
      {Task.Supervisor, name: Loka.Dev.TelnetServer.SessionSupervisor},
      {Task, fn -> accept_loop() end}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  defp accept_loop do
    case :gen_tcp.listen(@port, [:binary, packet: :line, active: false, reuseaddr: true]) do
      {:ok, listen_socket} ->
        Logger.info("[Dev] Game console on port #{@port}. Connect: nc localhost #{@port}")
        do_accept(listen_socket)

      {:error, :eaddrinuse} ->
        Logger.warning("[Dev] Port #{@port} in use — telnet server not started")

      {:error, reason} ->
        Logger.warning("[Dev] Telnet server failed: #{inspect(reason)}")
    end
  end

  defp do_accept(listen_socket) do
    case :gen_tcp.accept(listen_socket) do
      {:ok, client_socket} ->
        {:ok, pid} =
          Task.Supervisor.start_child(
            Loka.Dev.TelnetServer.SessionSupervisor,
            Loka.Dev.TelnetSession,
            :start,
            [client_socket]
          )

        :gen_tcp.controlling_process(client_socket, pid)

        # Signal the session it's now the controlling process
        send(pid, :socket_ready)

        do_accept(listen_socket)

      {:error, :closed} ->
        Logger.info("[Dev] Telnet server stopped")

      {:error, reason} ->
        Logger.warning("[Dev] Accept error: #{inspect(reason)}")
        do_accept(listen_socket)
    end
  end
end
