defmodule Mix.Tasks.Loka.Test.Balance do
  @moduledoc """
  Runs balance analysis simulations and generates a report.

  This task runs Monte Carlo simulations for combat balance and
  XP progression analysis, then outputs a human-readable report.

  ## Usage

      # Run with defaults (1000 iterations, output to console)
      mix loka.test.balance

      # Specify iteration count
      mix loka.test.balance --iterations 5000

      # Output to file
      mix loka.test.balance --output balance_report.md

      # JSON format for dashboard
      mix loka.test.balance --format json --output balance_data.json

      # Quick run with fewer iterations
      mix loka.test.balance --quick

  ## Options

  - `--iterations` or `-n` - Number of combat simulations (default: 1000)
  - `--output` or `-o` - Output file path (default: console)
  - `--format` or `-f` - Output format: markdown, json (default: markdown)
  - `--quick` - Quick run with 100 iterations
  - `--combat-only` - Only run combat analysis
  - `--progression-only` - Only run progression analysis
  - `--quiet` or `-q` - Suppress progress output
  """

  use Mix.Task

  alias Loka.Testing.Balance.{CombatSimulator, ProgressionSimulator, ReportGenerator}

  @shortdoc "Run balance analysis simulations"

  @switches [
    iterations: :integer,
    output: :string,
    format: :string,
    quick: :boolean,
    combat_only: :boolean,
    progression_only: :boolean,
    quiet: :boolean
  ]

  @aliases [
    n: :iterations,
    o: :output,
    f: :format,
    q: :quiet
  ]

  @impl Mix.Task
  def run(args) do
    {opts, _, _} = OptionParser.parse(args, switches: @switches, aliases: @aliases)

    # Start the application for prototype access
    Mix.Task.run("app.start")

    iterations = get_iterations(opts)
    format = get_format(opts)
    quiet = opts[:quiet] || false

    unless quiet do
      Mix.shell().info("")
      Mix.shell().info("╔════════════════════════════════════════════╗")
      Mix.shell().info("║        Loka Balance Analysis              ║")
      Mix.shell().info("╚════════════════════════════════════════════╝")
      Mix.shell().info("")
    end

    # Run analyses
    combat_data =
      if opts[:progression_only] do
        nil
      else
        run_combat_analysis(iterations, quiet)
      end

    progression_data =
      if opts[:combat_only] do
        nil
      else
        run_progression_analysis(quiet)
      end

    # Generate report
    report = generate_report(combat_data, progression_data, format)

    # Output report
    case opts[:output] do
      nil ->
        Mix.shell().info(report)

      output_path ->
        File.write!(output_path, report)
        unless quiet, do: Mix.shell().info("Report written to: #{output_path}")
    end

    # Return summary for programmatic use
    if combat_data && progression_data do
      summary = ReportGenerator.balance_summary(combat_data, progression_data)
      print_summary(summary, quiet)
    end
  end

  # =============================================================================
  # Private - Analysis Runners
  # =============================================================================

  defp run_combat_analysis(iterations, quiet) do
    unless quiet,
      do: Mix.shell().info("▶ Running combat simulations (#{iterations} iterations)...")

    # Default player and enemy for baseline analysis
    player_stats = %{
      health: 100,
      attack: 12,
      defense: 5,
      level: 3
    }

    enemy_stats = %{
      health: 50,
      attack: 8,
      defense: 3,
      level: 2
    }

    results = CombatSimulator.simulate(player_stats, enemy_stats, iterations: iterations)

    unless quiet do
      Mix.shell().info("  ✓ Win rate: #{Float.round(results.win_rate * 100, 1)}%")
      Mix.shell().info("  ✓ Avg turns: #{Float.round(results.avg_turns, 1)}")
    end

    results
  end

  defp run_progression_analysis(quiet) do
    unless quiet, do: Mix.shell().info("▶ Running progression simulation...")

    results = ProgressionSimulator.simulate(target_level: 10, sessions: 100)

    unless quiet do
      Mix.shell().info("  ✓ Avg sessions to level 10: #{results.avg_sessions_to_target}")
      Mix.shell().info("  ✓ Bottlenecks: #{length(results.bottlenecks)}")
    end

    results
  end

  # =============================================================================
  # Private - Report Generation
  # =============================================================================

  defp generate_report(nil, progression_data, format) do
    ReportGenerator.progression_report(progression_data, format)
  end

  defp generate_report(combat_data, nil, format) do
    ReportGenerator.combat_report(combat_data, format)
  end

  defp generate_report(combat_data, progression_data, format) do
    ReportGenerator.full_report(combat_data, progression_data, format)
  end

  # =============================================================================
  # Private - Output
  # =============================================================================

  defp print_summary(summary, quiet) do
    unless quiet do
      Mix.shell().info("")
      Mix.shell().info("────────────────────────────────────────────")

      status_emoji =
        case summary.overall_status do
          :healthy -> "✅"
          :needs_attention -> "⚠️ "
          :critical -> "❌"
          _ -> "❓"
        end

      Mix.shell().info("#{status_emoji} Overall Balance Status: #{summary.overall_status}")
      Mix.shell().info("")
    end
  end

  # =============================================================================
  # Private - Option Parsing
  # =============================================================================

  defp get_iterations(opts) do
    cond do
      opts[:quick] -> 100
      opts[:iterations] -> opts[:iterations]
      true -> 1000
    end
  end

  defp get_format(opts) do
    case opts[:format] do
      "json" -> :json
      "markdown" -> :markdown
      "md" -> :markdown
      _ -> :markdown
    end
  end
end
