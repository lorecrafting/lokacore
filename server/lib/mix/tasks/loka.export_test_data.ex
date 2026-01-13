defmodule Mix.Tasks.Loka.ExportTestData do
  @moduledoc """
  Exports test data to JSON for E2E (Playwright) tests.

  ## Usage

      mix loka.export_test_data

  This creates JSON files in `test/e2e/data/`:

  - `world-graph.json` - Room connections for pathfinding
  - `quests.json` - Quest definitions with objectives
  - `npcs.json` - NPC keys and spawn locations
  - `items.json` - Item keys and spawn locations

  These files are used by Playwright tests to navigate the world
  and complete quests programmatically.
  """

  use Mix.Task

  @shortdoc "Export test data (world graph, quests) to JSON for E2E tests"

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("app.start")

    IO.puts("Exporting test data for E2E tests...")

    results = Loka.Testing.TestData.export_all()

    Enum.each(results, fn {:ok, path} ->
      IO.puts("  Created: #{path}")
    end)

    IO.puts("\nDone! Test data exported to test/e2e/data/")
  end
end
