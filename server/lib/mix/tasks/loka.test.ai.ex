defmodule Mix.Tasks.Loka.Test.Ai do
  @moduledoc """
  AI Builder test runner and eval harness.

  Runs ToolExecutor unit tests, Conversation engine tests,
  and LLM eval scenarios for measuring AI builder quality.

  ## Usage

      # Run unit tests only (no API key needed)
      mix loka.test.ai --unit

      # Run all eval scenarios (requires ANTHROPIC_API_KEY)
      mix loka.test.ai --eval

      # Run a specific scenario
      mix loka.test.ai --eval --scenario tavern_zone

      # Use a specific prompt version
      mix loka.test.ai --eval --prompt v2

      # Include LLM-judged narrative scoring
      mix loka.test.ai --eval --narrative

      # Show eval report
      mix loka.test.ai --report

      # Clean eval directory
      mix loka.test.ai --clean

      # Target a specific world
      mix loka.test.ai --eval --world eval

  ## Modes

  - `--unit` — Runs ExUnit tests for ToolExecutor, Conversation, and tool definitions
  - `--eval` — Runs AI eval scenarios (creates content, scores results)
  - `--report` — Shows formatted eval results
  - `--clean` — Wipes eval directory and database
  - `--playthrough` — Bot plays through last eval's content
  - `--verify` — Validates existing content (read-only, no API)
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  @shortdoc "Run AI builder tests and evaluations"

  @switches [
    unit: :boolean,
    eval: :boolean,
    report: :boolean,
    clean: :boolean,
    playthrough: :boolean,
    verify: :boolean,
    scenario: :string,
    prompt: :string,
    narrative: :boolean,
    world: :string,
    help: :boolean
  ]

  @scenarios %{
    "tavern_zone" => Loka.Testing.AIEval.Scenarios.TavernZone,
    "village" => Loka.Testing.AIEval.Scenarios.Village,
    "quest_chain" => Loka.Testing.AIEval.Scenarios.QuestChain,
    "dialogue_tree" => Loka.Testing.AIEval.Scenarios.DialogueTree,
    "script_creation" => Loka.Testing.AIEval.Scenarios.ScriptCreation
  }

  @impl Mix.Task
  @spec run(list()) :: :ok | no_return()
  def run(args) do
    {opts, _, _} = OptionParser.parse(args, switches: @switches)

    if opts[:help] do
      Mix.shell().info(@moduledoc)
      return_ok()
    end

    cond do
      opts[:clean] ->
        run_clean()

      opts[:report] ->
        ensure_app_started()
        run_report(opts)

      opts[:unit] ->
        run_unit_tests()

      opts[:eval] ->
        ensure_app_started()
        run_eval(opts)

      opts[:playthrough] ->
        ensure_app_started()
        run_playthrough(opts)

      opts[:verify] ->
        ensure_app_started()
        run_verify(opts)

      true ->
        # Default: run unit tests
        run_unit_tests()
    end
  end

  # ---------------------------------------------------------------------------
  # Mode: Unit Tests
  # ---------------------------------------------------------------------------

  defp run_unit_tests do
    Mix.shell().info("")
    Mix.shell().info("=" |> String.duplicate(50))
    Mix.shell().info("  AI Builder Unit Tests")
    Mix.shell().info("=" |> String.duplicate(50))
    Mix.shell().info("")

    test_paths = [
      "test/loka/world_builder/tool_executor",
      "test/loka/ai/conversation_test.exs",
      "test/loka/world_builder/tool_definitions_test.exs"
    ]

    # Filter to paths that exist
    existing =
      test_paths
      |> Enum.map(&Path.join("server", &1))
      |> Enum.filter(&File.exists?/1)
      |> Enum.map(&String.replace_prefix(&1, "server/", ""))

    if existing == [] do
      Mix.shell().info("No AI test files found yet.")
      return_ok()
    end

    args = Enum.flat_map(existing, fn path -> ["--include", "ai_test", path] end)
    args = ["test" | args]

    case System.cmd("mix", args, cd: File.cwd!(), into: IO.stream(:stdio, :line)) do
      {_, 0} ->
        Mix.shell().info("")
        Mix.shell().info("All AI unit tests passed!")
        return_ok()

      {_, _} ->
        Mix.shell().error("Some AI unit tests failed.")
        exit_code(1)
    end
  end

  # ---------------------------------------------------------------------------
  # Mode: Eval
  # ---------------------------------------------------------------------------

  defp run_eval(opts) do
    # Check for API key
    unless System.get_env("ANTHROPIC_API_KEY") do
      Mix.shell().error("ANTHROPIC_API_KEY not set. Required for eval mode.")
      exit_code(1)
    end

    alias Loka.Testing.AIEval.{Runner, WorldTarget}

    world = String.to_atom(opts[:world] || "eval")
    WorldTarget.ensure_dirs!(world)

    scenarios_to_run =
      case opts[:scenario] do
        nil ->
          Map.values(@scenarios)

        name ->
          case Map.get(@scenarios, name) do
            nil ->
              Mix.shell().error("Unknown scenario: #{name}")
              Mix.shell().info("Available: #{Map.keys(@scenarios) |> Enum.join(", ")}")
              exit_code(1)

            mod ->
              [mod]
          end
      end

    Mix.shell().info("")
    Mix.shell().info("=" |> String.duplicate(50))
    Mix.shell().info("  AI Builder Eval (#{length(scenarios_to_run)} scenarios)")
    Mix.shell().info("=" |> String.duplicate(50))
    Mix.shell().info("")

    eval_opts = [
      prompt_version: opts[:prompt] || "v1",
      narrative: opts[:narrative] || false
    ]

    results =
      Enum.map(scenarios_to_run, fn scenario_mod ->
        scenario = scenario_mod.scenario()
        Runner.run_scenario(scenario, eval_opts)
      end)

    # Print summary
    Mix.shell().info("")

    total = Enum.sum(Enum.map(results, & &1.total_score))
    max = Enum.sum(Enum.map(results, & &1.max_score))
    pct = if max > 0, do: round(total / max * 100), else: 0

    Mix.shell().info("  Overall: #{total}/#{max} (#{pct}%)")
    Mix.shell().info("")

    return_ok()
  end

  # ---------------------------------------------------------------------------
  # Mode: Report
  # ---------------------------------------------------------------------------

  defp run_report(opts) do
    alias Loka.Testing.AIEval.Report

    Report.print_report(
      prompt: opts[:prompt],
      scenario: opts[:scenario]
    )
  end

  # ---------------------------------------------------------------------------
  # Mode: Clean
  # ---------------------------------------------------------------------------

  defp run_clean do
    alias Loka.Testing.AIEval.WorldTarget

    Mix.shell().info("Cleaning eval directory...")
    WorldTarget.clean!(:eval)
    Mix.shell().info("Eval directory cleaned.")
    return_ok()
  end

  # ---------------------------------------------------------------------------
  # Mode: Playthrough
  # ---------------------------------------------------------------------------

  defp run_playthrough(_opts) do
    Mix.shell().info("Playthrough mode not yet implemented.")
    Mix.shell().info("Will use ContentVerifier bot strategy to play through eval content.")
    return_ok()
  end

  # ---------------------------------------------------------------------------
  # Mode: Verify
  # ---------------------------------------------------------------------------

  defp run_verify(_opts) do
    Mix.shell().info("Verify mode not yet implemented.")
    Mix.shell().info("Will validate existing content structure and connectivity.")
    return_ok()
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp ensure_app_started do
    unless Application.started_applications() |> Enum.any?(fn {app, _, _} -> app == :loka end) do
      Mix.Task.run("app.start")
    end
  end

  defp return_ok, do: :ok

  defp exit_code(code) do
    unless Mix.env() == :test do
      System.halt(code)
    end

    code
  end
end
