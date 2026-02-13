defmodule Loka.Integration.StorylineChannelTest do
  @moduledoc """
  Integration test for storyline playthrough using ChannelBot.

  This test validates that a storyline is completable by running a bot through
  the entire quest chain via Phoenix channels, testing the full code path that
  real clients use.

  Unlike the mix task (which uses legacy Bot), this test uses ChannelBot for
  more realistic testing.
  """

  use Loka.ChannelCase, async: false

  alias Loka.Testing.Bot.ChannelBot
  alias Loka.Testing.Bot.Strategies.StorylineRunner
  alias Loka.Content.Storyline, as: StorylineContent
  alias Loka.Engine.WorldLoader

  @moduletag :integration
  @moduletag timeout: 180_000

  describe "monastery_arc storyline playthrough" do
    setup do
      # Clean up any existing entities from previous runs
      {deleted, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)

      if deleted > 0 do
        IO.puts("  Cleaned #{deleted} entities from previous runs")
      end

      # Load storyline to get starting room
      {:ok, storyline} = StorylineContent.get_struct("monastery_arc")

      # Spawn world
      IO.puts("▶ Spawning world from #{storyline.starting_room}...")

      case WorldLoader.spawn_world(starting_room: storyline.starting_room) do
        {:ok, stats} ->
          IO.puts("  Spawned #{stats.rooms} rooms, #{stats.npcs} NPCs, #{stats.items} items")

        {:error, reason} ->
          flunk("Failed to spawn world: #{inspect(reason)}")
      end

      # Create test player
      player = create_test_player(name: "StorylineTestBot")

      # Return context - cleanup will be handled by on_exit
      on_exit(fn ->
        IO.puts("")
        IO.puts("▶ Cleaning up test world...")
        {cleaned, _} = Loka.Repo.delete_all(Loka.Engine.Schema.EntitySchema)
        IO.puts("  Removed #{cleaned} test entities")
      end)

      %{player: player, storyline: storyline}
    end

    test "bot completes full storyline", %{player: player, storyline: storyline} do
      IO.puts("")
      IO.puts("╔════════════════════════════════════════════╗")
      IO.puts("║       Storyline Playthrough Test          ║")
      IO.puts("╚════════════════════════════════════════════╝")
      IO.puts("")
      IO.puts("🎬 Starting storyline: #{storyline.name}")
      IO.puts("")
      IO.puts("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      IO.puts("              BOT PLAYTHROUGH LOG")
      IO.puts("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      IO.puts("")

      # Start ChannelBot with StorylineRunner strategy
      {:ok, bot} =
        ChannelBot.start(player,
          strategy: StorylineRunner,
          strategy_opts: [
            storyline_id: storyline.key,
            log_actions: true,
            head_mode: true,
            max_steps: 2000,
            fail_on_stuck: 20,
            include_side_quests: true,
            side_quest_filter: ["side_alchemist_lesson"]
          ]
        )

      # Run bot until complete or timeout
      # Use a custom timeout of 3 minutes (180_000ms)
      timeout_ms = 180_000
      start_time = System.monotonic_time(:millisecond)

      bot =
        run_until_complete_or_timeout(bot, start_time, timeout_ms)

      IO.puts("")
      IO.puts("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      IO.puts("")

      # Get results from strategy
      results = bot.strategy_state.results

      # Print results
      IO.puts("")
      IO.puts("Playthrough Results:")
      IO.puts("  Quests completed: #{length(results.quests_completed)}")
      IO.puts("  Objectives achieved: #{length(results.objectives_achieved)}")
      IO.puts("  Rooms visited: #{length(results.rooms_visited)}")
      IO.puts("  Errors: #{length(results.errors)}")

      if Enum.any?(results.errors) do
        IO.puts("")
        IO.puts("❌ Playthrough FAILED with errors:")

        Enum.each(results.errors, fn err ->
          IO.puts("  • #{inspect(err)}")
        end)

        flunk("Playthrough failed with #{length(results.errors)} errors")
      else
        # Check if we completed successfully
        if bot.strategy_state.phase == :complete do
          IO.puts("")
          IO.puts("✅ PLAYTHROUGH PASSED")
        else
          IO.puts("")
          IO.puts("⚠️  Playthrough incomplete (phase: #{bot.strategy_state.phase})")
          flunk("Playthrough did not complete")
        end
      end

      # Clean up
      ChannelBot.stop(bot)
    end
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp run_until_complete_or_timeout(bot, start_time, timeout_ms) do
    elapsed = System.monotonic_time(:millisecond) - start_time

    if elapsed >= timeout_ms do
      IO.puts("")
      IO.puts("⚠️  Test timed out after #{timeout_ms}ms")
      bot
    else
      # Check if strategy is complete
      phase = bot.strategy_state.phase

      case phase do
        :complete ->
          bot

        :failed ->
          bot

        _ ->
          # Normalize quests before ticking (ChannelBot receives list, BotHelpers expects map)
          bot = normalize_quest_structure(bot)

          # Tick the bot
          {:ok, bot} = ChannelBot.tick(bot)

          # Small delay to avoid hammering the system
          Process.sleep(50)

          # Continue
          run_until_complete_or_timeout(bot, start_time, timeout_ms)
      end
    end
  end

  # Normalize quest structure from channel list format to map format expected by BotHelpers
  defp normalize_quest_structure(bot) do
    case bot.quests do
      # Already a map with active/completed keys and active is a map
      %{active: active, completed: _} when is_map(active) ->
        bot

      # Map with active as list (bug in ChannelBot initialization)
      %{active: active, completed: completed} when is_list(active) ->
        %{bot | quests: %{active: %{}, completed: completed || []}}

      # List of quest objects from channel
      quests when is_list(quests) ->
        active_quests_map =
          quests
          |> Enum.reduce(%{}, fn quest, acc ->
            quest_id = quest["id"] || quest[:id]

            if quest_id do
              # Normalize objectives from list to map (keyed by objective ID)
              objectives = quest["objectives"] || quest[:objectives] || []

              objectives_map =
                objectives
                |> Enum.reduce(%{}, fn obj, obj_acc ->
                  obj_id = obj["id"] || obj[:id]
                  if obj_id, do: Map.put(obj_acc, obj_id, obj), else: obj_acc
                end)

              # Update quest with normalized objectives
              normalized_quest = Map.put(quest, "objectives", objectives_map)
              Map.put(acc, quest_id, normalized_quest)
            else
              acc
            end
          end)

        %{bot | quests: %{active: active_quests_map, completed: []}}

      # Nil or unexpected format
      _ ->
        %{bot | quests: %{active: %{}, completed: []}}
    end
  end
end
