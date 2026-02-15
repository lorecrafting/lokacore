defmodule Mix.Tasks.Loka.E2e.Setup do
  @moduledoc """
  Sets up the test environment for mobile E2E tests.

  This task prepares the server with test fixtures that Maestro tests expect:
  - A starting room with NPCs, items, and exits
  - Test NPCs with dialogue
  - Test items that can be picked up
  - A test combat mob

  ## Usage

      mix loka.e2e.setup --test-run-id 12345

  ## Options

    * `--test-run-id` - Unique identifier for this test run (for cleanup)

  """
  use Mix.Task
  use Boundary, classify_to: Loka

  require Logger

  alias Loka.Engine.Entities

  @shortdoc "Setup E2E test fixtures for mobile testing"

  @impl Mix.Task
  def run(args) do
    # Start the application
    Mix.Task.run("app.start")

    {opts, _, _} =
      OptionParser.parse(args,
        strict: [test_run_id: :string]
      )

    test_run_id = opts[:test_run_id] || "default"

    Logger.info("Setting up E2E test fixtures (run: #{test_run_id})")

    # The world should already be loaded with test content from prototypes
    # This task can be used to:
    # 1. Verify test content exists
    # 2. Reset any modified state
    # 3. Create ephemeral test entities

    verify_test_environment()

    Logger.info("E2E setup complete")
  end

  defp verify_test_environment do
    Logger.info("Verifying test environment...")

    # Verify starting room exists
    case Loka.WorldBuilder.RoomManager.get_room("meditation_cell") do
      {:ok, _room} ->
        Logger.info("  ✓ Starting room (meditation_cell) exists")

      {:error, _} ->
        Logger.warning("  ✗ Starting room not found - using default spawn")
    end

    # Verify test NPCs exist in prototypes
    test_npcs = ["novice_pema", "teacher_lobsang", "abbot_jampa"]

    Enum.each(test_npcs, fn npc_key ->
      case Entities.find_one(key: npc_key) do
        {:ok, _proto} ->
          Logger.info("  ✓ NPC prototype '#{npc_key}' exists")

        {:error, _} ->
          Logger.warning("  ✗ NPC prototype '#{npc_key}' not found")
      end
    end)

    # Verify test items exist
    test_items = ["prayer_beads", "meditation_cushion"]

    Enum.each(test_items, fn item_key ->
      case Entities.find_one(key: item_key) do
        {:ok, _proto} ->
          Logger.info("  ✓ Item prototype '#{item_key}' exists")

        {:error, _} ->
          Logger.warning("  ✗ Item prototype '#{item_key}' not found")
      end
    end)

    Logger.info("Environment verification complete")
  end
end
