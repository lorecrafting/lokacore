defmodule Mix.Tasks.Tui do
  @moduledoc """
  Launch the TUI game editor.

  This task starts the Elixir application and then launches the Go TUI binary,
  connecting it to the TUI server via Unix socket.

  ## Usage

      mix tui

  ## Prerequisites

  - Build the TUI binary first with `mix tui.build` or `mix tui.build --current`
  - The TUI server must be enabled in config (default: enabled)

  ## How it works

  1. Starts the Elixir application (which starts the TUI server)
  2. Locates the TUI binary for the current platform
  3. Launches the binary with the socket path
  4. Waits for the TUI to exit

  The TUI binary takes over the terminal for full interactive use.
  """

  @shortdoc "Launch the TUI game editor"

  use Mix.Task

  @impl Mix.Task
  def run(_args) do
    # Ensure application is started
    Mix.Task.run("app.start")

    # Get binary for current platform
    binary = get_platform_binary()
    socket = Exmud.Tui.Server.socket_path()

    unless File.exists?(binary) do
      Mix.raise("""
      TUI binary not found at #{binary}

      Please build it first:

          mix tui.build --current    # Build for current platform only (fast)
          mix tui.build              # Build for all platforms

      """)
    end

    Mix.shell().info("Launching TUI editor...")
    Mix.shell().info("Binary: #{binary}")
    Mix.shell().info("Socket: #{socket}")
    Mix.shell().info("")

    # Launch TUI, inherit terminal for full interaction
    # :nouse_stdio lets the Go binary directly control the terminal
    port =
      Port.open({:spawn_executable, binary}, [
        :binary,
        :exit_status,
        :nouse_stdio,
        args: ["--socket", socket]
      ])

    # Wait for exit
    receive do
      {^port, {:exit_status, 0}} ->
        Mix.shell().info("\nTUI exited successfully")

      {^port, {:exit_status, status}} ->
        Mix.raise("TUI exited with status #{status}")
    end
  end

  defp get_platform_binary do
    {os, arch} = get_platform()

    Path.join([
      :code.priv_dir(:exmud) |> to_string(),
      "tui",
      "exmud-tui-#{os}-#{arch}"
    ])
  end

  defp get_platform do
    os =
      case :os.type() do
        {:unix, :darwin} -> "darwin"
        {:unix, :linux} -> "linux"
        {:win32, _} -> Mix.raise("Windows is not supported for TUI")
        other -> Mix.raise("Unsupported OS: #{inspect(other)}")
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
end
