defmodule Mix.Tasks.Loka.Test.Storyline do
  @moduledoc """
  **DEPRECATED**: Use `mix test test/integration/storyline_channel_test.exs` instead.

  This task uses the legacy bot implementation (40% production parity). The new
  ChannelBot-based test provides 95% production parity by testing the actual
  GameChannel code path.

  ## Migration

  ```bash
  # OLD (this task)
  mix loka.test.storyline monastery_arc --run

  # NEW (ChannelBot test - 95% production parity)
  mix test test/integration/storyline_channel_test.exs
  ```

  The new test provides:
  - Real channel testing (GameChannel code path)
  - Serialization validation (what clients receive)
  - Better error messages
  - Integration with ExUnit test suite

  ---

  Runs a storyline playthrough test using an automated bot.

  This task validates that a storyline is completable by:
  - Loading the storyline definition
  - Verifying all quests exist and have valid objectives
  - Spawning the world and checking connectivity
  - Running a bot through the storyline (optional)

  ## Usage

      # Validate storyline structure (fast, no bot run)
      mix loka.test.storyline monastery_arc

      # Run a full playthrough simulation
      mix loka.test.storyline monastery_arc --run

      # List all available storylines
      mix loka.test.storyline --list

      # Verbose output
      mix loka.test.storyline monastery_arc --verbose

  ## Exit Codes

  - 0: Validation passed
  - 1: Validation failed (errors found)
  """

  use Mix.Task

  alias Loka.Framework.Storyline.{Storyline, StorylineRegistry}
  alias Loka.Framework.Quest
  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader
  alias Loka.Engine.WorldLoader
  alias Loka.Testing.Bot.BotSupervisor
  alias Loka.Testing.Bot.Strategies.StorylineRunner

  @shortdoc "Test a storyline for completability"

  @switches [
    list: :boolean,
    run: :boolean,
    verbose: :boolean,
    headless: :boolean,
    timeout: :integer
  ]

  @impl Mix.Task
  def run(args) do
    {opts, args, _} = OptionParser.parse(args, switches: @switches)

    # Start the application
    Mix.Task.run("app.start")

    cond do
      opts[:list] ->
        list_storylines()

      Enum.empty?(args) ->
        Mix.shell().error("Usage: mix loka.test.storyline <storyline_id> [--run] [--verbose]")
        Mix.shell().info("Use --list to see available storylines")
        exit_code(1)

      true ->
        storyline_id = hd(args)
        validate_storyline(storyline_id, opts)
    end
  end

  defp list_storylines do
    storylines = StorylineRegistry.all()

    if Enum.empty?(storylines) do
      Mix.shell().info("No storylines found in priv/world/storylines/")
    else
      Mix.shell().info("")
      Mix.shell().info("╔════════════════════════════════════════════╗")
      Mix.shell().info("║          Available Storylines              ║")
      Mix.shell().info("╚════════════════════════════════════════════╝")
      Mix.shell().info("")

      Enum.each(storylines, fn storyline ->
        quest_count = length(Storyline.all_quests(storyline))
        act_count = length(storyline.acts)

        Mix.shell().info("• #{storyline.key}")
        Mix.shell().info("  Name: #{storyline.name}")
        Mix.shell().info("  Acts: #{act_count}, Quests: #{quest_count}")
        Mix.shell().info("")
      end)
    end

    exit_code(0)
  end

  defp validate_storyline(storyline_id, opts) do
    verbose = opts[:verbose] || false

    Mix.shell().info("")
    Mix.shell().info("╔════════════════════════════════════════════╗")
    Mix.shell().info("║       Storyline Validation: #{String.pad_trailing(storyline_id, 12)} ║")
    Mix.shell().info("╚════════════════════════════════════════════╝")
    Mix.shell().info("")

    case StorylineRegistry.get(storyline_id) do
      {:error, :not_found} ->
        Mix.shell().error("Storyline '#{storyline_id}' not found")
        Mix.shell().info("Use --list to see available storylines")
        exit_code(1)

      {:ok, storyline} ->
        results = run_validation(storyline, verbose)
        print_results(results, verbose)

        if opts[:run] do
          run_playthrough(storyline, opts)
        end

        if results.error_count > 0 do
          exit_code(1)
        else
          exit_code(0)
        end
    end
  end

  defp run_validation(storyline, verbose) do
    results = %{
      storyline: storyline,
      acts: [],
      quests: [],
      errors: [],
      warnings: [],
      error_count: 0,
      warning_count: 0
    }

    # Validate acts
    results = validate_acts(storyline, results, verbose)

    # Validate quests
    results = validate_quests(storyline, results, verbose)

    # Validate quest chain (prerequisites)
    results = validate_quest_chain(storyline, results, verbose)

    # Validate starting room exists
    results = validate_starting_room(storyline, results, verbose)

    # Update counts
    %{
      results
      | error_count: length(results.errors),
        warning_count: length(results.warnings)
    }
  end

  defp validate_acts(storyline, results, verbose) do
    if verbose, do: Mix.shell().info("▶ Validating acts...")

    act_results =
      Enum.map(storyline.acts, fn act ->
        issues = []

        # Check act has quests
        issues =
          if Enum.empty?(act.quests) do
            [{:error, "Act '#{act.id}' has no quests"}] ++ issues
          else
            issues
          end

        # Check required acts exist
        missing_requires =
          Enum.filter(act.requires, fn req_id ->
            not Enum.any?(storyline.acts, &(&1.id == req_id))
          end)

        issues =
          if Enum.any?(missing_requires) do
            [
              {:error, "Act '#{act.id}' requires non-existent acts: #{inspect(missing_requires)}"}
              | issues
            ]
          else
            issues
          end

        %{act: act, issues: issues}
      end)

    errors =
      act_results
      |> Enum.flat_map(& &1.issues)
      |> Enum.filter(fn {type, _} -> type == :error end)
      |> Enum.map(fn {_, msg} -> msg end)

    %{results | acts: act_results, errors: results.errors ++ errors}
  end

  defp validate_quests(storyline, results, verbose) do
    if verbose, do: Mix.shell().info("▶ Validating quests...")

    all_quests = Storyline.all_quests(storyline)

    quest_results =
      Enum.map(all_quests, fn quest_id ->
        case Quest.get_quest_definition(quest_id) do
          nil ->
            %{
              quest_id: quest_id,
              found: false,
              issues: [{:error, "Quest '#{quest_id}' not found in database"}]
            }

          quest_def ->
            issues = validate_quest_objectives(quest_id, quest_def)
            %{quest_id: quest_id, found: true, quest: quest_def, issues: issues}
        end
      end)

    errors =
      quest_results
      |> Enum.flat_map(& &1.issues)
      |> Enum.filter(fn {type, _} -> type == :error end)
      |> Enum.map(fn {_, msg} -> msg end)

    warnings =
      quest_results
      |> Enum.flat_map(& &1.issues)
      |> Enum.filter(fn {type, _} -> type == :warning end)
      |> Enum.map(fn {_, msg} -> msg end)

    %{
      results
      | quests: quest_results,
        errors: results.errors ++ errors,
        warnings: results.warnings ++ warnings
    }
  end

  defp validate_quest_objectives(quest_id, quest_def) do
    Enum.flat_map(quest_def.objectives, fn obj ->
      issues = []

      # Check objective has required fields
      issues =
        if is_nil(obj.target_id) or obj.target_id == "" do
          [{:warning, "Quest '#{quest_id}' objective '#{obj.id}' has no target_id"} | issues]
        else
          issues
        end

      issues
    end)
  end

  defp validate_quest_chain(storyline, results, verbose) do
    if verbose, do: Mix.shell().info("▶ Validating quest chain...")

    # Check that quest order is valid (no circular dependencies)
    quest_order = Storyline.quest_order(storyline)

    if verbose do
      Mix.shell().info("  Quest order: #{inspect(quest_order)}")
    end

    # For now, just ensure there are quests
    if Enum.empty?(quest_order) do
      %{results | errors: ["Storyline has no quests" | results.errors]}
    else
      results
    end
  end

  defp validate_starting_room(storyline, results, verbose) do
    if verbose, do: Mix.shell().info("▶ Validating starting room...")

    if storyline.starting_room do
      # Check if prototype exists
      case TypedObjectLoader.get(storyline.starting_room) do
        {:error, :not_found} ->
          %{
            results
            | warnings: [
                "Starting room '#{storyline.starting_room}' prototype not found"
                | results.warnings
              ]
          }

        {:ok, _proto} ->
          if verbose, do: Mix.shell().info("  Starting room: #{storyline.starting_room} ✓")
          results
      end
    else
      %{results | warnings: ["Storyline has no starting_room defined" | results.warnings]}
    end
  end

  defp print_results(results, _verbose) do
    Mix.shell().info("")
    Mix.shell().info("════════════════════════════════════════════")
    Mix.shell().info("                  RESULTS")
    Mix.shell().info("════════════════════════════════════════════")
    Mix.shell().info("")

    # Print summary
    quest_count = length(Storyline.all_quests(results.storyline))
    act_count = length(results.storyline.acts)
    found_quests = Enum.count(results.quests, & &1.found)

    Mix.shell().info("Storyline: #{results.storyline.name}")
    Mix.shell().info("Acts: #{act_count}")
    Mix.shell().info("Quests: #{found_quests}/#{quest_count} found")
    Mix.shell().info("")

    # Print errors
    if results.error_count > 0 do
      Mix.shell().error("❌ ERRORS (#{results.error_count}):")

      Enum.each(results.errors, fn err ->
        Mix.shell().error("  • #{err}")
      end)

      Mix.shell().info("")
    end

    # Print warnings
    if results.warning_count > 0 do
      Mix.shell().info("⚠️  WARNINGS (#{results.warning_count}):")

      Enum.each(results.warnings, fn warn ->
        Mix.shell().info("  • #{warn}")
      end)

      Mix.shell().info("")
    end

    # Final status
    if results.error_count == 0 do
      Mix.shell().info("✅ VALIDATION PASSED")
    else
      Mix.shell().error("❌ VALIDATION FAILED")
    end

    Mix.shell().info("")
  end

  defp run_playthrough(storyline, opts) do
    timeout = opts[:timeout] || 120_000
    headless = opts[:headless] || false
    head_mode = not headless

    Mix.shell().info("════════════════════════════════════════════")
    Mix.shell().info("          RUNNING PLAYTHROUGH")
    Mix.shell().info("════════════════════════════════════════════")
    Mix.shell().info("")

    if head_mode do
      Mix.shell().info("🎭 HEAD MODE: Watch the bot play through the storyline!")
      Mix.shell().info("")
    end

    # Clean up any existing entities from previous runs
    Mix.shell().info("▶ Preparing isolated test world...")
    {deleted, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)

    if deleted > 0 do
      Mix.shell().info("  Cleaned #{deleted} entities from previous runs")
    end

    try do
      run_isolated_playthrough(storyline, timeout, head_mode)
    after
      # Clean up test entities
      Mix.shell().info("")
      Mix.shell().info("▶ Cleaning up test world...")
      {cleaned, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)
      Mix.shell().info("  Removed #{cleaned} test entities")
    end
  end

  defp run_isolated_playthrough(storyline, timeout, head_mode) do
    # Spawn world
    Mix.shell().info("▶ Spawning world from #{storyline.starting_room}...")

    case WorldLoader.spawn_world(starting_room: storyline.starting_room) do
      {:ok, stats} ->
        Mix.shell().info(
          "  Spawned #{stats.rooms} rooms, #{stats.npcs} NPCs, #{stats.items} items"
        )

      {:error, reason} ->
        Mix.shell().error("  Failed to spawn world: #{inspect(reason)}")
        exit_code(1)
    end

    # Start bot supervisor if not running
    unless Process.whereis(BotSupervisor) do
      {:ok, _} = BotSupervisor.start_link([])
    end

    # Spawn storyline runner bot
    Mix.shell().info("▶ Starting storyline runner bot...")
    Mix.shell().info("")

    if head_mode do
      Mix.shell().info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      Mix.shell().info("              BOT PLAYTHROUGH LOG")
      Mix.shell().info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      Mix.shell().info("")
    end

    # Use slower tick rate in head mode so user can follow along
    tick_interval = if head_mode, do: 500, else: 100

    {:ok, bot_pid} =
      BotSupervisor.spawn_bot(
        strategy: StorylineRunner,
        strategy_opts: [
          storyline_id: storyline.key,
          log_actions: true,
          head_mode: head_mode
        ],
        name: "Storyline Test Bot",
        tick_interval_ms: tick_interval
      )

    # Wait for completion or timeout
    if not head_mode do
      Mix.shell().info("▶ Running playthrough (timeout: #{timeout}ms)...")
    end

    result = wait_for_completion(bot_pid, timeout, head_mode)

    if head_mode do
      Mix.shell().info("")
      Mix.shell().info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      Mix.shell().info("")
    end

    case result do
      {:ok, results} ->
        Mix.shell().info("")
        Mix.shell().info("Playthrough Results:")
        Mix.shell().info("  Quests completed: #{length(results.quests_completed)}")
        Mix.shell().info("  Objectives achieved: #{length(results.objectives_achieved)}")
        Mix.shell().info("  Rooms visited: #{length(results.rooms_visited)}")
        Mix.shell().info("  Errors: #{length(results.errors)}")

        if Enum.any?(results.errors) do
          Mix.shell().error("Playthrough FAILED with errors:")

          Enum.each(results.errors, fn err ->
            Mix.shell().error("  • #{inspect(err)}")
          end)
        else
          Mix.shell().info("✅ PLAYTHROUGH PASSED")
        end

      {:error, :timeout} ->
        Mix.shell().error("Playthrough timed out after #{timeout}ms")

      {:error, reason} ->
        Mix.shell().error("Playthrough failed: #{inspect(reason)}")
    end

    # Stop bot
    GenServer.stop(bot_pid)
  end

  defp wait_for_completion(bot_pid, timeout, head_mode) do
    start_time = System.monotonic_time(:millisecond)

    wait_loop(bot_pid, start_time, timeout, head_mode, nil)
  end

  defp wait_loop(bot_pid, start_time, timeout, head_mode, last_room) do
    elapsed = System.monotonic_time(:millisecond) - start_time

    if elapsed >= timeout do
      {:error, :timeout}
    else
      # Check bot state
      state = Loka.Testing.Bot.get_state(bot_pid)
      strategy_state = state.strategy_state

      # In head mode, show room changes and current activity
      last_room =
        if head_mode and state.room do
          current_room = state.room.id

          if current_room != last_room do
            room_title = state.room.title || state.room.key || "Unknown"
            IO.puts("📍 Entered: #{room_title}")
          end

          current_room
        else
          last_room
        end

      case strategy_state.phase do
        :complete ->
          {:ok, strategy_state.results}

        :failed ->
          {:ok, strategy_state.results}

        _ ->
          Process.sleep(if head_mode, do: 300, else: 500)
          wait_loop(bot_pid, start_time, timeout, head_mode, last_room)
      end
    end
  end

  defp exit_code(code) do
    unless Mix.env() == :test do
      System.halt(code)
    end

    code
  end
end
