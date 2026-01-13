defmodule Mix.Tasks.Loka.E2e.Cleanup do
  @moduledoc """
  Cleans up after mobile E2E tests.

  Removes any ephemeral test data created during a test run.

  ## Usage

      # Clean up the standard SmokePlayer character (recommended before Maestro tests)
      mix loka.e2e.cleanup

      # Clean up with a specific test run ID pattern
      mix loka.e2e.cleanup --test-run-id 12345

  """
  use Mix.Task

  require Logger

  @shortdoc "Cleanup E2E test fixtures"

  # Standard test character names used by Maestro tests
  @smoke_test_names ["SmokePlayer"]

  @impl Mix.Task
  def run(args) do
    # Start the application
    Mix.Task.run("app.start")

    {opts, _, _} =
      OptionParser.parse(args,
        strict: [test_run_id: :string]
      )

    test_run_id = opts[:test_run_id]

    Logger.info("Cleaning up E2E test fixtures")

    # Always clean up standard smoke test characters
    cleanup_smoke_test_characters()

    # Optionally clean up test-run-specific players
    if test_run_id do
      cleanup_test_players(test_run_id)
    end

    Logger.info("E2E cleanup complete")
  end

  # Clean up the fixed smoke test character names used by Maestro
  defp cleanup_smoke_test_characters do
    import Ecto.Query
    alias Loka.Framework.Player.GameState

    Enum.each(@smoke_test_names, fn name ->
      # Delete GameState records with this character name
      gs_query = from(gs in GameState, where: gs.character_name == ^name)

      case Loka.Repo.delete_all(gs_query) do
        {count, _} when count > 0 ->
          Logger.info("  Removed #{count} game state(s) for character '#{name}'")

        _ ->
          :ok
      end

      # Delete Player records with this name
      player_query = from(p in Loka.Accounts.Player, where: p.name == ^name)

      case Loka.Repo.delete_all(player_query) do
        {count, _} when count > 0 ->
          Logger.info("  Removed #{count} player(s) named '#{name}'")

        _ ->
          :ok
      end
    end)
  end

  defp cleanup_test_players(test_run_id) do
    # Test players are created with names like "TestPlayer_12345" or "SmokeTest_12345"
    # We can query the database to find and clean these up

    import Ecto.Query

    test_patterns = [
      "TestPlayer_#{test_run_id}%",
      "SmokeTest_#{test_run_id}%"
    ]

    Enum.each(test_patterns, fn pattern ->
      query =
        from(p in Loka.Accounts.Player,
          where: like(p.name, ^pattern)
        )

      case Loka.Repo.delete_all(query) do
        {count, _} when count > 0 ->
          Logger.info("  Removed #{count} test player(s) matching '#{pattern}'")

        _ ->
          :ok
      end
    end)
  end
end
