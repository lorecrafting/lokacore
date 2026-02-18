defmodule Mix.Tasks.Loka.Console do
  @shortdoc "Run game commands in a dev console"

  @moduledoc """
  Interactive game console for testing game state from the command line.

  Runs game commands sequentially, preserving state (room, dialogue, etc.)
  between commands. Useful for testing quest flows, dialogue trees, and
  navigation without needing a browser.

  ## Usage

      # Single command
      mix loka.console look

      # Multiple commands (state carries between them)
      mix loka.console "goto awakening_clearing" look "talk thera" "1" north look

      # With specific player
      mix loka.console --email player@example.com look north

      # Interactive REPL (no commands given)
      mix loka.console

  ## Options

  - `--email` / `-e` — Player email (default: admin@loka.local)
  - `--delay` / `-d` — Delay between commands in ms (default: 300)

  ## Notes

  - This starts a separate Elixir instance. The Phoenix HTTP server is NOT
    started, so there's no port conflict if `mix phx.server` is running.
  - Character location changes are written to the shared SQLite database,
    so navigation affects the player's position as seen by the web server.
  - Dialogue state persists between commands in a single console session
    but is NOT shared with an active browser/channel session.
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  @impl Mix.Task
  def run(args) do
    {opts, commands, _invalid} =
      OptionParser.parse(args,
        aliases: [e: :email, d: :delay],
        strict: [email: :string, delay: :integer]
      )

    email = opts[:email] || "admin@loka.local"
    delay_ms = opts[:delay] || 300

    # Prevent Phoenix from binding to port 4000 (would conflict with running server)
    endpoint_config =
      Application.get_env(:loka, LokaWeb.Endpoint, [])
      |> Keyword.put(:server, false)

    Application.put_env(:loka, LokaWeb.Endpoint, endpoint_config)

    # Start the application (DB, PubSub, EntitySeeder, etc.)
    {:ok, _} = Application.ensure_all_started(:loka)

    Mix.shell().info("Connecting as #{email}...")

    case Loka.Dev.GameConsole.start(email) do
      {:ok, session} ->
        room_id = session.room.key || session.room.id
        Mix.shell().info("Connected. Location: #{room_id}")
        Mix.shell().info(String.duplicate("─", 60))

        if Enum.empty?(commands) do
          run_interactive(session, delay_ms)
        else
          run_batch(session, commands, delay_ms)
        end

      {:error, reason} ->
        Mix.shell().error("Failed to start console: #{reason}")
        System.halt(1)
    end
  end

  defp run_batch(session, commands, delay_ms) do
    Enum.reduce(commands, session, fn cmd, acc_session ->
      Mix.shell().info("> #{cmd}")
      {output, new_session} = Loka.Dev.GameConsole.run(acc_session, cmd)
      Mix.shell().info(output)
      Mix.shell().info("")
      Process.sleep(delay_ms)
      new_session
    end)
  end

  defp run_interactive(session, delay_ms) do
    Mix.shell().info("Type commands ('help' for list, Ctrl+D to exit):\n")

    Stream.repeatedly(fn -> IO.gets("> ") end)
    |> Enum.reduce_while(session, fn
      :eof, _session ->
        {:halt, :done}

      {:error, _}, _session ->
        {:halt, :done}

      input, acc_session when is_binary(input) ->
        cmd = String.trim(input)

        if cmd in ["quit", "exit", "q"] do
          {:halt, :done}
        else
          {output, new_session} = Loka.Dev.GameConsole.run(acc_session, cmd)
          Mix.shell().info(output)
          Mix.shell().info("")
          Process.sleep(delay_ms)
          {:cont, new_session}
        end
    end)
  end
end
