defmodule Mix.Tasks.Loka.Dev do
  @moduledoc """
  Starts the Loka development server.

  ## Usage

      mix loka.dev

  This starts the Phoenix server at http://localhost:4000.

  For Godot client development, open the Godot editor separately:

      cd godot-client
      open -a Godot project.godot   # macOS

  Press Ctrl+C twice to stop the server.
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  @shortdoc "Start Phoenix development server"

  @impl Mix.Task
  def run(args) do
    if "--help" in args || "-h" in args do
      Mix.shell().info(@moduledoc)
      System.halt(0)
    end

    Mix.shell().info("")
    Mix.shell().info("╔════════════════════════════════════════════╗")
    Mix.shell().info("║          Loka Development Server           ║")
    Mix.shell().info("╚════════════════════════════════════════════╝")
    Mix.shell().info("")
    Mix.shell().info("  Phoenix: http://localhost:4000")
    Mix.shell().info("")
    Mix.shell().info("  For Godot client:")
    Mix.shell().info("    cd godot-client && open -a Godot project.godot")
    Mix.shell().info("")
    Mix.shell().info("Press Ctrl+C twice to stop.")
    Mix.shell().info("")

    # Delegate to phx.server
    Mix.Tasks.Phx.Server.run([])
  end
end
