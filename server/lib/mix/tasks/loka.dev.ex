defmodule Mix.Tasks.Loka.Dev do
  @moduledoc """
  Starts all development servers for Loka.

  This task runs the Phoenix server and the React Native/Expo dev server
  concurrently, with automatic mobile debug log streaming.

  ## Usage

      # Start both servers (recommended)
      mix loka.dev

      # Start only the Phoenix server
      mix loka.dev --server

      # Start only the mobile Expo server (interactive mode)
      mix loka.dev --mobile

      # Disable debug log streaming
      mix loka.dev --mobile --no-logs

  ## Servers

  - Phoenix: http://localhost:4000
  - Expo: http://localhost:8081 (when running both)

  ## Debug Logs

  When running with --mobile, mobile debug logs are automatically streamed
  to the console. These include:
  - console.log/error/warn from React Native
  - Crash reports with stack traces
  - Player context (name, device ID)

  Logs are also saved to priv/debug_logs/ for LLM debugging.

  ## Requirements

  - Node.js and npm must be installed
  - Run `npm install` in the mobile/ directory first

  When running both servers together, Expo displays a QR code for Expo Go.
  Scan with your phone to connect. Use `mix loka.dev --mobile` for Expo's
  full interactive terminal features (press 'a' for Android, etc).

  Press Ctrl+C twice to stop all servers.
  """

  use Mix.Task

  require Logger

  @shortdoc "Start Phoenix and React Native dev servers"

  @log_dir "priv/debug_logs"

  @switches [
    server: :boolean,
    mobile: :boolean,
    logs: :boolean,
    help: :boolean
  ]

  @impl Mix.Task
  def run(args) do
    {opts, _, _} = OptionParser.parse(args, switches: @switches)

    if opts[:help] do
      Mix.shell().info(@moduledoc)
      System.halt(0)
    end

    # Determine which servers to start
    server_only = opts[:server] && !opts[:mobile]
    mobile_only = opts[:mobile] && !opts[:server]
    start_both = !server_only && !mobile_only

    # Debug logs enabled by default for mobile modes, disable with --no-logs
    enable_logs = opts[:logs] != false && (mobile_only || start_both)

    project_root = Path.join(File.cwd!(), "..")
    mobile_dir = Path.join(project_root, "mobile")

    Mix.shell().info("")
    Mix.shell().info("╔════════════════════════════════════════════╗")
    Mix.shell().info("║          Loka Development Server           ║")
    Mix.shell().info("╚════════════════════════════════════════════╝")
    Mix.shell().info("")

    # Start debug log watcher if enabled
    log_watcher_pid = if enable_logs, do: start_debug_log_watcher(), else: nil

    try do
      cond do
        server_only ->
          Mix.shell().info("Starting Phoenix server only...")
          Mix.shell().info("")
          start_phoenix()

        mobile_only ->
          Mix.shell().info("Starting Expo/React Native server (interactive)...")

          if enable_logs do
            Mix.shell().info("📱 Mobile debug logs streaming below...")
          end

          Mix.shell().info("")
          start_mobile_interactive(mobile_dir)

        start_both ->
          # Get LAN IP for Expo Go URL
          lan_ip = get_lan_ip()

          Mix.shell().info("Starting Phoenix + Expo servers...")
          Mix.shell().info("")
          Mix.shell().info("  Phoenix:  http://localhost:4000")
          Mix.shell().info("  Expo Web: http://localhost:8081")

          if lan_ip do
            Mix.shell().info("")
            Mix.shell().info("  📱 Expo Go: Open Expo Go app → Enter URL manually:")
            Mix.shell().info("     exp://#{lan_ip}:8081")
          end

          if enable_logs do
            Mix.shell().info("")
            Mix.shell().info("  📝 Mobile debug logs streaming to terminal")
          end

          Mix.shell().info("")
          Mix.shell().info("Press Ctrl+C twice to stop all servers.")
          Mix.shell().info("")

          # Start both servers concurrently (logs stream via remoteLogger → Phoenix → terminal)
          start_both_servers(mobile_dir, enable_logs)
      end
    after
      # Clean up log watcher
      if log_watcher_pid, do: Process.exit(log_watcher_pid, :shutdown)
    end
  end

  defp start_phoenix do
    # Delegate to phx.server which handles everything properly
    Mix.Tasks.Phx.Server.run([])
  end

  defp start_mobile_interactive(mobile_dir) do
    validate_mobile_dir!(mobile_dir)

    # Use System.cmd with IO streaming for interactive mode
    # This preserves TTY features for Expo's interactive menu
    System.cmd("npm", ["start"], cd: mobile_dir, into: IO.stream(:stdio, :line))
  end

  defp start_both_servers(mobile_dir, _enable_logs) do
    validate_mobile_dir!(mobile_dir)

    # Kill any existing process on port 8081 to ensure clean start
    case System.cmd("lsof", ["-ti:8081"], stderr_to_stdout: true) do
      {pids, 0} when pids != "" ->
        pids
        |> String.trim()
        |> String.split("\n")
        |> Enum.each(fn pid ->
          System.cmd("kill", ["-9", String.trim(pid)])
        end)

        Process.sleep(1000)

      _ ->
        :ok
    end

    # Start Expo in a spawned (not linked) process
    expo_pid =
      spawn(fn ->
        System.cmd(
          "npx",
          ["expo", "start", "--lan", "--clear"],
          cd: mobile_dir,
          into: IO.stream(:stdio, :line),
          stderr_to_stdout: true
        )
      end)

    # Monitor the expo process so we know if it dies
    Process.monitor(expo_pid)

    # Give Expo a moment to start
    Process.sleep(3000)

    # Start Phoenix server properly
    # Configure the endpoint to start
    Application.put_env(
      :loka,
      LokaWeb.Endpoint,
      Keyword.put(Application.get_env(:loka, LokaWeb.Endpoint, []), :server, true)
    )

    # Start the application (which starts the endpoint)
    Mix.Task.run("app.start")

    # Block forever - Phoenix runs in background supervision tree
    try do
      :timer.sleep(:infinity)
    after
      # Clean up Expo when task exits
      Process.exit(expo_pid, :kill)
    end
  end

  defp get_lan_ip do
    case System.cmd("ipconfig", ["getifaddr", "en0"], stderr_to_stdout: true) do
      {ip, 0} ->
        String.trim(ip)

      _ ->
        # Fallback to en1 (some Macs use this for WiFi)
        case System.cmd("ipconfig", ["getifaddr", "en1"], stderr_to_stdout: true) do
          {ip, 0} -> String.trim(ip)
          _ -> nil
        end
    end
  end

  defp validate_mobile_dir!(mobile_dir) do
    unless File.exists?(mobile_dir) do
      Mix.shell().error("Mobile directory not found: #{mobile_dir}")
      Mix.shell().error("Expected to find mobile/ directory at project root.")
      System.halt(1)
    end

    unless File.exists?(Path.join(mobile_dir, "node_modules")) do
      Mix.shell().error("node_modules not found in mobile/")
      Mix.shell().error("Please run: cd mobile && npm install")
      System.halt(1)
    end
  end

  # Debug log watcher - streams mobile logs to console
  defp start_debug_log_watcher do
    File.mkdir_p!(@log_dir)

    pid =
      spawn(fn ->
        # Clear existing logs for fresh session
        clear_old_logs()

        Mix.shell().info("")
        Mix.shell().info("┌─────────────────────────────────────────────┐")
        Mix.shell().info("│  📱 Mobile Debug Logs (waiting for app...)  │")
        Mix.shell().info("└─────────────────────────────────────────────┘")
        Mix.shell().info("")

        watch_logs(0)
      end)

    pid
  end

  defp clear_old_logs do
    Path.join(@log_dir, "*.log")
    |> Path.wildcard()
    |> Enum.each(&File.rm/1)
  end

  defp watch_logs(last_count) do
    Process.sleep(1000)

    logs = read_all_logs()
    current_count = length(logs)

    if current_count > last_count do
      new_logs = Enum.drop(logs, last_count)
      Enum.each(new_logs, &print_log_entry/1)
    end

    watch_logs(current_count)
  end

  defp read_all_logs do
    File.mkdir_p!(@log_dir)

    Path.join(@log_dir, "*.log")
    |> Path.wildcard()
    |> Enum.sort()
    |> Enum.flat_map(&read_log_file/1)
  end

  defp read_log_file(file) do
    case File.read(file) do
      {:ok, content} ->
        content
        |> String.split("\n", trim: true)
        |> Enum.map(fn line ->
          case Jason.decode(line) do
            {:ok, log} -> log
            _ -> nil
          end
        end)
        |> Enum.reject(&is_nil/1)

      _ ->
        []
    end
  end

  defp print_log_entry(log) do
    level = (log["level"] || "info") |> String.upcase() |> String.pad_trailing(5)
    timestamp = format_timestamp(log["timestamp"])
    player = log["player_name"] || "unknown"

    # Color based on level
    {level_color, reset} =
      case log["level"] do
        "error" -> {IO.ANSI.red(), IO.ANSI.reset()}
        "warn" -> {IO.ANSI.yellow(), IO.ANSI.reset()}
        "debug" -> {IO.ANSI.cyan(), IO.ANSI.reset()}
        _ -> {IO.ANSI.green(), IO.ANSI.reset()}
      end

    IO.puts("#{level_color}[#{level}]#{reset} #{timestamp} │ #{player}")
    IO.puts("  #{format_message(log["message"])}")

    if log["context"] && log["context"] != %{} && map_size(log["context"]) > 0 do
      # Only show context for errors/warnings or if it has meaningful content
      context = log["context"]

      if log["level"] in ["error", "warn"] || Map.has_key?(context, "stack") do
        IO.puts(
          "  #{IO.ANSI.faint()}#{inspect(context, pretty: true, limit: 300)}#{IO.ANSI.reset()}"
        )
      end
    end

    IO.puts("")
  end

  defp format_timestamp(nil), do: "??:??:??"

  defp format_timestamp(ms) when is_integer(ms) do
    ms
    |> DateTime.from_unix!(:millisecond)
    |> Calendar.strftime("%H:%M:%S")
  end

  defp format_timestamp(_), do: "??:??:??"

  defp format_message(msg) when is_binary(msg), do: String.slice(msg, 0, 200)

  defp format_message(msg) when is_list(msg) do
    msg
    |> Enum.map(&to_string/1)
    |> Enum.join(" ")
    |> String.slice(0, 200)
  end

  defp format_message(msg), do: inspect(msg, limit: 50)
end
