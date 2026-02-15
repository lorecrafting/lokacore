defmodule Mix.Tasks.Loka.Test.Quest do
  @moduledoc """
  Tests quest completability using the QuestTester framework.

  ## Usage

      # Test all quests
      mix loka.test.quest

      # Test a specific quest
      mix loka.test.quest find_treasure

      # Test a storyline
      mix loka.test.quest --storyline monastery_arc

      # Validate quests without running (static analysis)
      mix loka.test.quest --validate

      # Generate walkthroughs
      mix loka.test.quest --walkthrough find_treasure

      # List all available quests
      mix loka.test.quest --list

  ## Options

  - `--storyline <id>` - Test all quests in a storyline
  - `--validate` - Only validate, don't run tests
  - `--walkthrough <id>` - Generate walkthrough for a quest
  - `--list` - List all available quests
  - `--verbose` - Show detailed output
  - `--quiet` - Minimal output
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  alias Loka.Testing.Quest.QuestTester
  alias Loka.Content

  @shortdoc "Test quest completability"

  @switches [
    storyline: :string,
    validate: :boolean,
    walkthrough: :string,
    list: :boolean,
    verbose: :boolean,
    quiet: :boolean
  ]

  @impl Mix.Task
  def run(args) do
    {opts, quest_ids, _} = OptionParser.parse(args, switches: @switches)

    # Start the application
    Mix.Task.run("app.start")

    cond do
      opts[:list] ->
        list_quests(opts)

      opts[:walkthrough] ->
        generate_walkthrough(opts[:walkthrough], opts)

      opts[:validate] && Enum.any?(quest_ids) ->
        validate_quests(quest_ids, opts)

      opts[:validate] ->
        validate_all_quests(opts)

      opts[:storyline] ->
        test_storyline(opts[:storyline], opts)

      Enum.any?(quest_ids) ->
        test_quests(quest_ids, opts)

      true ->
        test_all_quests(opts)
    end
  end

  defp list_quests(opts) do
    quests = Content.Quest.all_definitions()

    unless opts[:quiet] do
      Mix.shell().info("")
      Mix.shell().info("Available Quests (#{length(quests)})")
      Mix.shell().info("═══════════════════════════════════")
      Mix.shell().info("")

      Enum.each(quests, fn quest ->
        type_badge = if quest.type == :main, do: "[MAIN]", else: "[SIDE]"
        obj_count = length(quest.objectives || [])
        Mix.shell().info("  #{quest.id} #{type_badge} - #{quest.name} (#{obj_count} objectives)")
      end)

      Mix.shell().info("")
    end
  end

  defp generate_walkthrough(quest_id, opts) do
    case QuestTester.generate_walkthrough(quest_id) do
      {:ok, steps} ->
        unless opts[:quiet] do
          Mix.shell().info("")
          Mix.shell().info("Walkthrough: #{quest_id}")
          Mix.shell().info("═══════════════════════════════════")
          Mix.shell().info("")

          Enum.each(steps, fn step ->
            Mix.shell().info("Step #{step.step}: #{step.description}")
            Mix.shell().info("   Expected: #{step.expected}")
            Mix.shell().info("")
          end)
        end

      {:error, {:quest_not_found, _}} ->
        Mix.shell().error("Quest not found: #{quest_id}")
        exit_code(1)
    end
  end

  defp validate_quests(quest_ids, opts) do
    results =
      Enum.map(quest_ids, fn quest_id ->
        case QuestTester.validate_quest(quest_id) do
          {:ok, :valid} -> {quest_id, :valid, nil}
          {:error, reason} -> {quest_id, :invalid, reason}
        end
      end)

    print_validation_results(results, opts)
  end

  defp validate_all_quests(opts) do
    quests = Content.Quest.all_definitions()
    quest_ids = Enum.map(quests, & &1.id)
    validate_quests(quest_ids, opts)
  end

  defp print_validation_results(results, opts) do
    valid = Enum.filter(results, fn {_, status, _} -> status == :valid end)
    invalid = Enum.filter(results, fn {_, status, _} -> status == :invalid end)

    unless opts[:quiet] do
      Mix.shell().info("")
      Mix.shell().info("Quest Validation Results")
      Mix.shell().info("═══════════════════════════════════")
      Mix.shell().info("")
      Mix.shell().info("✅ Valid: #{length(valid)}")
      Mix.shell().info("❌ Invalid: #{length(invalid)}")
      Mix.shell().info("")

      if Enum.any?(invalid) do
        Mix.shell().info("Invalid Quests:")

        Enum.each(invalid, fn {quest_id, _, reason} ->
          Mix.shell().error("  #{quest_id}: #{inspect(reason)}")
        end)

        Mix.shell().info("")
      end
    end

    if Enum.any?(invalid) do
      exit_code(1)
    else
      exit_code(0)
    end
  end

  defp test_storyline(storyline_id, opts) do
    unless opts[:quiet] do
      Mix.shell().info("")
      Mix.shell().info("Testing Storyline: #{storyline_id}")
      Mix.shell().info("═══════════════════════════════════")
      Mix.shell().info("")
    end

    case QuestTester.test_storyline(storyline_id) do
      {:ok, results} ->
        unless opts[:quiet] do
          Mix.shell().info("Total quests: #{results.total_quests}")
          Mix.shell().info("✅ Passed: #{results.passed}")
          Mix.shell().info("❌ Failed: #{results.failed}")
          Mix.shell().info("")

          if Enum.any?(results.results.failed) do
            Mix.shell().info("Failed Quests:")

            Enum.each(results.results.failed, fn {quest_id, result} ->
              Mix.shell().error("  #{quest_id}: #{inspect(result.errors)}")
            end)
          end
        end

        if results.success do
          exit_code(0)
        else
          exit_code(1)
        end

      {:error, {:storyline_not_found, _}} ->
        Mix.shell().error("Storyline not found: #{storyline_id}")
        exit_code(1)
    end
  end

  defp test_quests(quest_ids, opts) do
    results =
      Enum.map(quest_ids, fn quest_id ->
        unless opts[:quiet] do
          Mix.shell().info("Testing: #{quest_id}...")
        end

        {:ok, result} = QuestTester.test_quest(quest_id)
        {quest_id, result}
      end)

    print_test_results(results, opts)
  end

  defp test_all_quests(opts) do
    quests = Content.Quest.all_definitions()
    quest_ids = Enum.map(quests, & &1.id)

    unless opts[:quiet] do
      Mix.shell().info("")
      Mix.shell().info("Testing All Quests (#{length(quest_ids)})")
      Mix.shell().info("═══════════════════════════════════")
      Mix.shell().info("")
    end

    test_quests(quest_ids, opts)
  end

  defp print_test_results(results, opts) do
    passed = Enum.filter(results, fn {_, r} -> r.success end)
    failed = Enum.filter(results, fn {_, r} -> not r.success end)

    unless opts[:quiet] do
      Mix.shell().info("")
      Mix.shell().info("Quest Test Results")
      Mix.shell().info("═══════════════════════════════════")
      Mix.shell().info("✅ Passed: #{length(passed)}")
      Mix.shell().info("❌ Failed: #{length(failed)}")
      Mix.shell().info("")

      if opts[:verbose] do
        Enum.each(passed, fn {quest_id, result} ->
          Mix.shell().info(
            "  ✅ #{quest_id} (#{result.objectives_completed}/#{result.total_objectives} objectives, #{result.time_elapsed_ms}ms)"
          )
        end)
      end

      if Enum.any?(failed) do
        Mix.shell().info("")
        Mix.shell().info("Failed Tests:")

        Enum.each(failed, fn {quest_id, result} ->
          Mix.shell().error("  ❌ #{quest_id}: #{inspect(result.errors)}")
        end)
      end

      Mix.shell().info("")
    end

    if Enum.any?(failed) do
      exit_code(1)
    else
      exit_code(0)
    end
  end

  defp exit_code(code) do
    unless Mix.env() == :test do
      System.halt(code)
    end

    code
  end
end
