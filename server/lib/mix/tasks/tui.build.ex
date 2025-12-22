defmodule Mix.Tasks.Tui.Build do
  @moduledoc """
  Build Go TUI binaries for all platforms.

  ## Usage

      # Build for all 4 platforms
      mix tui.build

      # Build only for current platform (faster for development)
      mix tui.build --current

  ## Output

  Binaries are placed in `priv/tui/` with names like:
  - `exmud-tui-darwin-arm64`
  - `exmud-tui-darwin-amd64`
  - `exmud-tui-linux-amd64`
  - `exmud-tui-linux-arm64`
  """

  @shortdoc "Build Go TUI binaries"

  use Mix.Task

  @platforms [
    {"darwin", "arm64"},
    {"darwin", "amd64"},
    {"linux", "amd64"},
    {"linux", "arm64"}
  ]

  @impl Mix.Task
  def run(args) do
    # Ensure Go is installed
    check_go_installed!()

    # Get paths
    tui_dir = get_tui_dir()
    output_dir = get_output_dir()

    unless File.dir?(tui_dir) do
      Mix.raise("TUI source directory not found at #{tui_dir}")
    end

    File.mkdir_p!(output_dir)

    # Determine which platforms to build
    platforms =
      if "--current" in args do
        [get_current_platform()]
      else
        @platforms
      end

    Mix.shell().info("Building Go TUI binaries...")
    Mix.shell().info("Source: #{tui_dir}")
    Mix.shell().info("Output: #{output_dir}")
    Mix.shell().info("")

    # Ensure dependencies are downloaded
    Mix.shell().info("Fetching Go dependencies...")

    case System.cmd("go", ["mod", "tidy"],
           cd: tui_dir,
           stderr_to_stdout: true
         ) do
      {_, 0} ->
        :ok

      {error, code} ->
        Mix.raise("Failed to fetch Go dependencies (exit #{code}): #{error}")
    end

    # Build for each platform
    results =
      for {os, arch} <- platforms do
        binary_name = "exmud-tui-#{os}-#{arch}"
        output = Path.join(output_dir, binary_name)
        Mix.shell().info("Building for #{os}/#{arch}...")

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
            # Make executable
            File.chmod!(output, 0o755)
            size = File.stat!(output).size
            Mix.shell().info("  -> #{binary_name} (#{format_size(size)})")
            {:ok, binary_name}

          {error, code} ->
            Mix.shell().error("  -> Failed to build #{binary_name}: #{error}")
            {:error, binary_name, code, error}
        end
      end

    # Summary
    Mix.shell().info("")

    successes = Enum.filter(results, &match?({:ok, _}, &1))
    failures = Enum.filter(results, &match?({:error, _, _, _}, &1))

    if length(failures) > 0 do
      Mix.shell().error("Build completed with #{length(failures)} failure(s)")

      for {:error, name, code, _} <- failures do
        Mix.shell().error("  - #{name} (exit #{code})")
      end

      Mix.raise("Build failed")
    else
      Mix.shell().info("Successfully built #{length(successes)} binaries in #{output_dir}")
    end
  end

  defp check_go_installed! do
    case System.cmd("go", ["version"], stderr_to_stdout: true) do
      {version, 0} ->
        Mix.shell().info("Using #{String.trim(version)}")

      {_, _} ->
        Mix.raise("""
        Go is not installed or not in PATH.

        Install Go from https://go.dev/dl/ and ensure 'go' is available in your PATH.
        """)
    end
  end

  defp get_tui_dir do
    # TUI directory is at repo root, sibling to server/
    Path.join([File.cwd!(), "..", "tui"]) |> Path.expand()
  end

  defp get_output_dir do
    Path.join([:code.priv_dir(:exmud), "tui"])
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
end
