defmodule Mix.Tasks.Loka.Admin.GrantAll do
  @moduledoc """
  Grants admin status to all players in the database.

  ## Usage

      mix loka.admin.grant_all

  This will update all existing players to have `is_admin: true`.
  """

  use Mix.Task
  use Boundary, classify_to: Loka
  alias Loka.Accounts

  @shortdoc "Grant admin status to all players"

  @impl Mix.Task
  def run(_args) do
    # Start the application
    Mix.Task.run("app.start")

    Mix.shell().info("Granting admin status to all players...")

    players = Accounts.list_players()
    total_count = length(players)

    Mix.shell().info("Found #{total_count} player(s)")

    results =
      Enum.map(players, fn player ->
        case Accounts.set_admin(player, true) do
          {:ok, updated_player} ->
            Mix.shell().info("✓ #{updated_player.email} is now an admin")
            :ok

          {:error, changeset} ->
            Mix.shell().error("✗ Failed to update #{player.email}: #{inspect(changeset.errors)}")
            :error
        end
      end)

    success_count = Enum.count(results, &(&1 == :ok))
    error_count = Enum.count(results, &(&1 == :error))

    Mix.shell().info("")
    Mix.shell().info("Summary:")
    Mix.shell().info("  Total players: #{total_count}")
    Mix.shell().info("  Successfully granted admin: #{success_count}")

    if error_count > 0 do
      Mix.shell().error("  Errors: #{error_count}")
    end

    Mix.shell().info("")
    Mix.shell().info("Done!")
  end
end
