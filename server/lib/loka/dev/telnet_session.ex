defmodule Loka.Dev.TelnetSession do
  @moduledoc """
  Handles a single telnet connection to the dev game console.

  Receives TCP input as commands, runs them through GameConsole, and streams
  output back. Also subscribes to the player's current room PubSub topic so
  ambient events (NPC emotes, weather, player speech) appear inline.

  ## Protocol

  - Each line of input is treated as a game command
  - Commands are processed synchronously (response before next prompt)
  - Ambient events arrive between command outputs (non-blocking)
  - Typing "quit" or "exit" closes the connection

  ## Colors

  - Command output: normal text
  - Ambient events: dim (ANSI \e[2m)
  - Prompts: no formatting
  """

  require Logger

  @prompt "> "
  @idle_timeout_ms 600_000

  @crlf "\r\n"
  @dim "\e[2m"
  @reset "\e[0m"

  @default_email "admin@loka.local"

  @doc """
  Entry point called by TelnetServer after spawning this as a Task.
  Waits for :socket_ready before touching the socket.
  """
  @spec start(port()) :: :ok
  def start(socket) do
    receive do
      :socket_ready -> :ok
    after
      5_000 -> exit(:socket_ready_timeout)
    end

    # Now we're the controlling process — safe to set active mode
    :inet.setopts(socket, active: true)

    send_raw(socket, banner())

    email = @default_email

    case Loka.Dev.GameConsole.start(email) do
      {:ok, session} ->
        send_raw(socket, "Connected as #{email}\r\n")
        {look, session} = Loka.Dev.GameConsole.run(session, "look")
        send_output(socket, look)
        send_raw(socket, @prompt)
        loop(socket, session, session.room && session.room.id)

      {:error, reason} ->
        send_raw(socket, "Error: #{reason}\r\n")
        :gen_tcp.close(socket)
    end
  end

  # ===========================================================================
  # Main Loop
  # ===========================================================================

  defp loop(socket, session, room_id) do
    receive do
      # ── TCP input ──────────────────────────────────────────────────────────
      {:tcp, ^socket, data} ->
        cmd = String.trim(data)

        if cmd in ["quit", "exit", "q"] do
          send_raw(socket, "Goodbye!\r\n")
          unsubscribe(room_id)
          :gen_tcp.close(socket)
        else
          {output, new_session} = Loka.Dev.GameConsole.run(session, cmd)
          send_output(socket, output)

          # Resubscribe if room changed
          new_room_id = new_session.room && new_session.room.id

          if new_room_id != room_id do
            unsubscribe(room_id)
            subscribe(new_room_id)
          end

          send_raw(socket, @prompt)
          loop(socket, new_session, new_room_id)
        end

      # ── Connection closed ──────────────────────────────────────────────────
      {:tcp_closed, ^socket} ->
        unsubscribe(room_id)

      {:tcp_error, ^socket, reason} ->
        Logger.debug("[TelnetSession] TCP error: #{inspect(reason)}")
        unsubscribe(room_id)

      # ── PubSub ambient events ──────────────────────────────────────────────
      {:ambient_message, text} ->
        send_ambient(socket, text)
        loop(socket, session, room_id)

      {:player_says, _player_id, player_name, message} ->
        send_ambient(socket, "#{player_name} says, \"#{message}\"")
        loop(socket, session, room_id)

      {:player_shouts, _player_id, player_name, message} ->
        send_ambient(socket, "#{player_name} shouts, \"#{message}\"")
        loop(socket, session, room_id)

      {:player_emotes, _player_id, _player_name, text} ->
        send_ambient(socket, text)
        loop(socket, session, room_id)

      {:player_entered, _player_id, player_name} ->
        send_ambient(socket, "#{player_name} arrives.")
        loop(socket, session, room_id)

      {:player_left, _player_id, player_name, direction} ->
        send_ambient(socket, "#{player_name} leaves #{direction}.")
        loop(socket, session, room_id)

      {:atmosphere_changed, msg} ->
        send_ambient(socket, msg)
        loop(socket, session, room_id)

      # Ignore other PubSub messages
      _other ->
        loop(socket, session, room_id)
    after
      @idle_timeout_ms ->
        send_raw(socket, "\r\nIdle timeout.\r\n")
        unsubscribe(room_id)
        :gen_tcp.close(socket)
    end
  end

  # ===========================================================================
  # PubSub
  # ===========================================================================

  defp subscribe(nil), do: :ok

  defp subscribe(room_id) do
    Phoenix.PubSub.subscribe(Loka.PubSub, "location:#{room_id}")
  end

  defp unsubscribe(nil), do: :ok

  defp unsubscribe(room_id) do
    Phoenix.PubSub.unsubscribe(Loka.PubSub, "location:#{room_id}")
  end

  # ===========================================================================
  # Output helpers
  # ===========================================================================

  # Command output — normalize newlines for telnet
  defp send_output(socket, text) do
    formatted = text |> String.replace("\n", @crlf)
    send_raw(socket, @crlf <> formatted <> @crlf)
  end

  # Ambient events — dim style, inserted on a fresh line
  defp send_ambient(socket, text) do
    send_raw(socket, @crlf <> @dim <> text <> @reset <> @crlf)
  end

  defp send_raw(socket, data) do
    :gen_tcp.send(socket, data)
  end

  defp banner do
    """
    \r
    ╔══════════════════════════════════════════════╗\r
    ║        Loka Dev Console  (port 4023)         ║\r
    ║  Type 'help' for commands, 'quit' to exit    ║\r
    ╚══════════════════════════════════════════════╝\r
    \r
    """
  end
end
