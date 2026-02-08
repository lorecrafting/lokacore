defmodule Mix.Tasks.Loka.Test.Bot do
  @moduledoc """
  Runs bot integration tests.

  This task runs end-to-end bot tests that simulate real gameplay:
  - Bot completes entire storylines autonomously
  - Tests quest progression, dialogue navigation, combat, etc.
  - Validates that all game systems work together correctly

  These tests are slower (~20-30 seconds each) but provide high confidence
  that the game is playable.

  ## Usage

      # Run all bot tests
      mix loka.test.bot

      # Run specific bot test file
      mix loka.test.bot test/loka/testing/quest_bot_integration_test.exs

  ## Exit Codes

  - 0: All bot tests passed
  - 1: One or more bot tests failed
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  @shortdoc "Run bot integration tests"

  @impl Mix.Task
  def run(args) do
    # If no args provided, run all tests tagged with :full_storyline
    # Otherwise, pass args to mix test (allows running specific files)
    test_args =
      if Enum.empty?(args) do
        ["--only", "full_storyline"]
      else
        args ++ ["--only", "full_storyline"]
      end

    Mix.Task.run("test", test_args)
  end
end
