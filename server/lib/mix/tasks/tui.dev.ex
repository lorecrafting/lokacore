defmodule Mix.Tasks.Tui.Dev do
  @moduledoc """
  Development mode for the TUI with auto-rebuild on file changes.

  Watches the `tui/` directory for Go file changes and automatically
  rebuilds and restarts the TUI.

  ## Usage

      mix tui.dev

  ## How it works

  1. Starts the Elixir application (TUI server)
  2. Builds the TUI binary for the current platform
  3. Launches the TUI
  4. Watches for .go file changes
  5. On change: kills TUI, rebuilds, restarts

  Press Ctrl+C twice to exit.
  """

  @shortdoc "Run TUI in development mode with auto-reload"

  use Mix.Task

  @poll_interval 1000

  @impl Mix.Task
  def run(_args) do
    # Ensure application is started
    Mix.Task.run("app.start")

    tui_dir = get_tui_dir()
    socket = Exmud.Tui.Server.socket_path()

    Mix.shell().info("""

    ========================================
      TUI Development Mode
    ========================================
    Source:  #{tui_dir}
    Socket:  #{socket}
    ----------------------------------------
    Watching for .go file changes...
    Press Ctrl+C twice to exit.
    ========================================
    """)

    # Initial build
    case build_tui() do
      :ok ->
        # Start watch loop
        watch_loop(nil, get_go_files_mtime(tui_dir), tui_dir, socket)

      {:error, reason} ->
        Mix.shell().error("Initial build failed: #{reason}")
        Mix.shell().info("Watching for changes to retry...")
        watch_loop(nil, get_go_files_mtime(tui_dir), tui_dir, socket)
    end
  end

  defp watch_loop(port, last_mtime, tui_dir, socket) do
    # Check for file changes
    current_mtime = get_go_files_mtime(tui_dir)

    {port, last_mtime} =
      if current_mtime != last_mtime and last_mtime != nil do
        Mix.shell().info("\n[#{timestamp()}] Change detected, rebuilding...")

        # Kill existing TUI if running
        _stopped = stop_tui(port)

        # Small delay to let terminal reset
        Process.sleep(100)

        # Rebuild
        case build_tui() do
          :ok ->
            Mix.shell().info("[#{timestamp()}] Restarting TUI...\n")
            new_port = start_tui(socket)
            {new_port, current_mtime}

          {:error, reason} ->
            Mix.shell().error("[#{timestamp()}] Build failed: #{reason}")
            Mix.shell().info("Watching for changes to retry...")
            {nil, current_mtime}
        end
      else
        # Start TUI if not running and we haven't tried yet
        port =
          if port == nil do
            binary = get_platform_binary()

            if File.exists?(binary) do
              Mix.shell().info("[#{timestamp()}] Starting TUI...\n")
              start_tui(socket)
            else
              port
            end
          else
            port
          end

        {port, last_mtime || current_mtime}
      end

    # Check if TUI exited
    port =
      receive do
        {^port, {:exit_status, 0}} ->
          Mix.shell().info("\n[#{timestamp()}] TUI exited normally")
          nil

        {^port, {:exit_status, status}} ->
          Mix.shell().info("\n[#{timestamp()}] TUI exited with status #{status}")
          nil
      after
        @poll_interval ->
          port
      end

    watch_loop(port, last_mtime, tui_dir, socket)
  end

  defp build_tui do
    tui_dir = get_tui_dir()
    output_dir = get_output_dir()
    {os, arch} = get_current_platform()
    binary_name = "exmud-tui-#{os}-#{arch}"
    output = Path.join(output_dir, binary_name)

    File.mkdir_p!(output_dir)

    # Run go build
    env = [
      {"GOOS", os},
      {"GOARCH", arch},
      {"CGO_ENABLED", "0"}
    ]

    case System.cmd("go", ["build", "-o", output, "."],
           cd: tui_dir,
           env: env,
           stderr_to_stdout: true
         ) do
      {_, 0} ->
        File.chmod!(output, 0o755)
        size = File.stat!(output).size
        Mix.shell().info("[#{timestamp()}] Built #{binary_name} (#{format_size(size)})")
        :ok

      {error, _code} ->
        {:error, error}
    end
  end

  defp start_tui(socket) do
    binary = get_platform_binary()

    Port.open({:spawn_executable, binary}, [
      :binary,
      :exit_status,
      :nouse_stdio,
      args: ["--socket", socket]
    ])
  end

  defp stop_tui(nil), do: nil

  defp stop_tui(port) do
    try do
      Port.close(port)
    catch
      _, _ -> :ok
    end

    # Also try to kill any orphaned processes
    binary = get_platform_binary() |> Path.basename()

    System.cmd("pkill", ["-f", binary], stderr_to_stdout: true)
    Process.sleep(100)
    nil
  end

  defp get_go_files_mtime(tui_dir) do
    Path.wildcard(Path.join([tui_dir, "**", "*.go"]))
    |> Enum.map(fn file ->
      case File.stat(file) do
        {:ok, %{mtime: mtime}} -> {file, mtime}
        _ -> {file, nil}
      end
    end)
    |> Enum.sort()
  end

  defp get_tui_dir do
    Path.join([File.cwd!(), "..", "tui"]) |> Path.expand()
  end

  defp get_output_dir do
    Path.join([:code.priv_dir(:exmud), "tui"])
  end

  defp get_platform_binary do
    {os, arch} = get_current_platform()

    Path.join([
      :code.priv_dir(:exmud) |> to_string(),
      "tui",
      "exmud-tui-#{os}-#{arch}"
    ])
  end

  defp get_current_platform do
    os =
      case :os.type() do
        {:unix, :darwin} -> "darwin"
        {:unix, :linux} -> "linux"
        {:win32, _} -> Mix.raise("Windows is not supported")
      end

    arch =
      case :erlang.system_info(:system_architecture) |> to_string() do
        "aarch64" <> _ -> "arm64"
        "arm64" <> _ -> "arm64"
        "x86_64" <> _ -> "amd64"
        "x86-64" <> _ -> "amd64"
        other -> Mix.raise("Unknown architecture: #{other}")
      end

    {os, arch}
  end

  defp format_size(bytes) when bytes < 1024, do: "#{bytes} B"
  defp format_size(bytes) when bytes < 1024 * 1024, do: "#{Float.round(bytes / 1024, 1)} KB"
  defp format_size(bytes), do: "#{Float.round(bytes / (1024 * 1024), 1)} MB"

  defp timestamp do
    Time.utc_now() |> Time.truncate(:second) |> Time.to_string()
  end
end
