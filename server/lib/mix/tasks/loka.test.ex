defmodule Mix.Tasks.Loka.Test do
  @moduledoc """
  Master test runner that executes all Loka test suites.

  This task runs all testing and validation suites in sequence:
  1. Unit tests (mix test)
  2. Content validation (prototypes, quests, world connectivity)
  3. Storyline validation (quest chains, objectives)
  4. Balance analysis (combat simulations, progression)

  ## Usage

      # Run all tests (full suite)
      mix loka.test

      # Run only fast tests (skip balance simulations)
      mix loka.test --quick

      # Run specific suites
      mix loka.test --only unit,validate
      mix loka.test --only storyline

      # Skip specific suites
      mix loka.test --skip balance

      # Strict mode (fail on warnings)
      mix loka.test --strict

      # Quiet mode (minimal output)
      mix loka.test --quiet

  ## Test Suites

  - `unit` - ExUnit tests (mix test)
  - `validate` - Content validators (prototypes, quests, world)
  - `storyline` - Storyline completability checks
  - `balance` - Combat and progression balance analysis

  ## Exit Codes

  - 0: All tests passed
  - 1: One or more tests failed
  """

  use Mix.Task
  use Boundary, classify_to: Loka

  @shortdoc "Run all Loka tests and validations"

  @switches [
    only: :string,
    skip: :string,
    quick: :boolean,
    strict: :boolean,
    quiet: :boolean,
    help: :boolean
  ]

  @suites [:unit, :validate, :storyline, :balance]

  @impl Mix.Task
  def run(args) do
    {opts, _, _} = OptionParser.parse(args, switches: @switches)

    if opts[:help] do
      print_help()
      exit_code(0)
    end

    only = parse_list(opts[:only])
    skip = parse_list(opts[:skip])
    quick = opts[:quick] || false
    strict = opts[:strict] || false
    quiet = opts[:quiet] || false

    suites_to_run =
      @suites
      |> Enum.filter(fn suite ->
        (Enum.empty?(only) or suite in only) and suite not in skip
      end)

    if Enum.empty?(suites_to_run) do
      Mix.shell().info("No test suites to run.")
      exit_code(0)
    end

    unless quiet do
      Mix.shell().info("")
      Mix.shell().info("╔════════════════════════════════════════════╗")
      Mix.shell().info("║         Loka Master Test Runner           ║")
      Mix.shell().info("╚════════════════════════════════════════════╝")
      Mix.shell().info("")
      Mix.shell().info("Running suites: #{Enum.join(suites_to_run, ", ")}")
      Mix.shell().info("")
    end

    results =
      Enum.map(suites_to_run, fn suite ->
        unless quiet do
          Mix.shell().info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          Mix.shell().info("  #{suite_name(suite)}")
          Mix.shell().info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          Mix.shell().info("")
        end

        result = run_suite(suite, quick: quick, strict: strict, quiet: quiet)
        {suite, result}
      end)

    # Print summary
    unless quiet do
      Mix.shell().info("")
      Mix.shell().info("╔════════════════════════════════════════════╗")
      Mix.shell().info("║              TEST SUMMARY                  ║")
      Mix.shell().info("╚════════════════════════════════════════════╝")
      Mix.shell().info("")

      Enum.each(results, fn {suite, result} ->
        status =
          case result do
            :ok -> "✅ PASSED"
            :skipped -> "⏭️  SKIPPED"
            {:error, _} -> "❌ FAILED"
          end

        Mix.shell().info("  #{String.pad_trailing(suite_name(suite), 25)} #{status}")
      end)

      Mix.shell().info("")
    end

    # Check for failures
    failures =
      Enum.filter(results, fn {_, result} ->
        match?({:error, _}, result)
      end)

    if Enum.empty?(failures) do
      unless quiet do
        Mix.shell().info("════════════════════════════════════════════")
        Mix.shell().info("✅ ALL TESTS PASSED")
        Mix.shell().info("════════════════════════════════════════════")
        Mix.shell().info("")
      end

      exit_code(0)
    else
      unless quiet do
        Mix.shell().info("════════════════════════════════════════════")
        Mix.shell().error("❌ #{length(failures)} TEST SUITE(S) FAILED")
        Mix.shell().info("════════════════════════════════════════════")
        Mix.shell().info("")

        Enum.each(failures, fn {suite, {:error, reason}} ->
          Mix.shell().error("  #{suite_name(suite)}: #{reason}")
        end)

        Mix.shell().info("")
      end

      exit_code(1)
    end
  end

  # ===========================================================================
  # Suite Runners
  # ===========================================================================

  defp run_suite(:unit, opts) do
    quiet = opts[:quiet]

    unless quiet, do: Mix.shell().info("Running ExUnit tests...")

    # Run mix test and capture exit code
    case System.cmd("mix", ["test"], cd: File.cwd!(), into: IO.stream(:stdio, :line)) do
      {_, 0} -> :ok
      {_, _} -> {:error, "Unit tests failed"}
    end
  end

  defp run_suite(:validate, opts) do
    quiet = opts[:quiet]
    strict = opts[:strict]

    unless quiet, do: Mix.shell().info("Running content validators...")

    args = if strict, do: ["--strict"], else: []
    args = if quiet, do: args ++ ["--quiet"], else: args

    # Start app if not started
    ensure_app_started()

    try do
      Mix.Tasks.Loka.Test.Validate.run(args)
      :ok
    rescue
      _ -> {:error, "Content validation failed"}
    catch
      :exit, {:shutdown, 1} -> {:error, "Content validation failed"}
      :exit, {:shutdown, 0} -> :ok
    end
  end

  defp run_suite(:storyline, opts) do
    quiet = opts[:quiet]

    unless quiet, do: Mix.shell().info("Running storyline validators...")

    # Start app if not started
    ensure_app_started()

    # Get all storylines and validate each
    alias Loka.Framework.Storyline.StorylineRegistry

    storylines = StorylineRegistry.all()

    if Enum.empty?(storylines) do
      unless quiet, do: Mix.shell().info("  No storylines found, skipping...")
      :skipped
    else
      failed =
        Enum.filter(storylines, fn storyline ->
          args = if quiet, do: [storyline.key], else: [storyline.key, "--verbose"]

          try do
            Mix.Tasks.Loka.Test.Storyline.run(args)
            false
          rescue
            _ -> true
          catch
            :exit, {:shutdown, 1} -> true
            :exit, {:shutdown, 0} -> false
          end
        end)

      if Enum.empty?(failed) do
        :ok
      else
        {:error, "#{length(failed)} storyline(s) failed validation"}
      end
    end
  end

  defp run_suite(:balance, opts) do
    quiet = opts[:quiet]
    quick = opts[:quick]

    unless quiet, do: Mix.shell().info("Running balance analysis...")

    # Start app if not started
    ensure_app_started()

    args = if quick, do: ["--quick"], else: []
    args = if quiet, do: args ++ ["--quiet"], else: args

    try do
      Mix.Tasks.Loka.Test.Balance.run(args)
      :ok
    rescue
      _ -> {:error, "Balance analysis failed"}
    catch
      :exit, {:shutdown, 1} -> {:error, "Balance analysis failed"}
      :exit, {:shutdown, 0} -> :ok
    end
  end

  # ===========================================================================
  # Helpers
  # ===========================================================================

  defp suite_name(:unit), do: "Unit Tests"
  defp suite_name(:validate), do: "Content Validation"
  defp suite_name(:storyline), do: "Storyline Validation"
  defp suite_name(:balance), do: "Balance Analysis"

  defp parse_list(nil), do: []

  defp parse_list(str) do
    str
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.map(&String.to_atom/1)
  end

  defp ensure_app_started do
    unless Application.started_applications() |> Enum.any?(fn {app, _, _} -> app == :loka end) do
      Mix.Task.run("app.start")
    end
  end

  defp print_help do
    Mix.shell().info(@moduledoc)
  end

  defp exit_code(code) do
    unless Mix.env() == :test do
      System.halt(code)
    end

    code
  end
end
