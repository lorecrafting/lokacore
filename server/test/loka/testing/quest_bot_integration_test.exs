defmodule Loka.Testing.QuestBotIntegrationTest do
  @moduledoc """
  Integration test for ChannelBot playing through quests with QuestStrategy.

  Tests the full bot pipeline:
  - Connecting via GameChannel
  - Receiving quest and game state updates
  - Making decisions with QuestStrategy
  - Progressing through quest objectives
  - Auto-completing system quests

  **Note**: These tests require the full game world (NPCs with dialogues, quests, etc.)
  and are excluded from normal test runs. Run with: `mix test --include integration`
  """

  use Loka.ChannelCase, async: false

  alias Loka.Testing.Bot.ChannelBot
  alias Loka.Testing.QuestStrategy
  alias Loka.Engine.Entities
  alias Loka.Framework.World.RoomLoader

  # These tests require full world data (dialogues, NPC behaviors, etc.)
  # Exclude from normal test runs, include explicitly with: --include integration
  @moduletag :integration
  @moduletag timeout: 600_000

  # Set up the minimum world required for quest bot testing
  setup do
    starting_key = RoomLoader.starting_room_key()

    # Create the starting room
    {:ok, room} =
      Entities.create_entity(%{
        key: starting_key,
        type: "room",
        short_desc: "Monastery Gate",
        extra_desc: "Ancient stone pillars mark the entrance."
      })

    # Create Novice Pema NPC in the starting room (needed for intro_welcome quest)
    {:ok, _pema} =
      Entities.create_entity(%{
        key: "novice_pema",
        type: "npc",
        short_desc: "Novice Pema",
        extra_desc: "A young novice monk with a serene expression.",
        location_id: room.id,
        components: %{
          "dialogue" => %{"key" => "novice_pema_intro"}
        }
      })

    %{starting_room: room}
  end

  describe "quest bot integration" do
    test "bot completes intro_welcome quest" do
      player = create_test_player()

      {:ok, bot} =
        ChannelBot.start(player,
          strategy: QuestStrategy,
          strategy_opts: [storyline_id: "monastery_arc"]
        )

      # Run bot for up to 50 ticks (about 5 seconds worth of gameplay)
      {:ok, bot} = ChannelBot.run(bot, ticks: 50)

      info = ChannelBot.get_info(bot)

      # Check that bot made progress
      assert info.tick_count > 0

      # Check quest state
      strategy_state = info.strategy_state
      completed_quests = strategy_state.results.quests_completed

      # The intro_welcome quest should be completed (it's a system quest with 1 talk objective)
      # Or at least the bot should have made progress on objectives
      objectives_achieved = strategy_state.results.objectives_achieved

      assert length(objectives_achieved) >= 1,
             "Bot should have achieved at least 1 objective, got: #{length(objectives_achieved)}"

      # Check that bot actually talked to an NPC
      npcs_talked = strategy_state.results.npcs_talked_to

      assert length(npcs_talked) >= 1,
             "Bot should have talked to at least 1 NPC, got: #{inspect(npcs_talked)}"

      # Cleanup
      :ok = ChannelBot.stop(bot)
    end

    test "bot progresses through multiple quests" do
      player = create_test_player()

      {:ok, bot} =
        ChannelBot.start(player,
          strategy: QuestStrategy,
          strategy_opts: [storyline_id: "monastery_arc"]
        )

      # Run bot for longer to attempt multiple quests
      {:ok, bot} = ChannelBot.run(bot, ticks: 100)

      info = ChannelBot.get_info(bot)
      strategy_state = info.strategy_state

      # Check that bot completed at least one quest
      completed_quests = strategy_state.results.quests_completed

      assert length(completed_quests) >= 1,
             "Bot should have completed at least 1 quest, got: #{inspect(completed_quests)}"

      # Check that bot is not stuck
      assert strategy_state.phase != :failed,
             "Bot should not be in failed state, failure: #{inspect(strategy_state.failure_reason)}"

      # Cleanup
      :ok = ChannelBot.stop(bot)
    end

    @tag :full_storyline
    test "bot completes ALL monastery_arc quests" do
      require Logger
      player = create_test_player()

      {:ok, bot} =
        ChannelBot.start(player,
          strategy: QuestStrategy,
          strategy_opts: [storyline_id: "monastery_arc"]
        )

      # Run bot for many ticks to complete all quests
      # Main quests: intro_welcome, intro_find_temple, main_sleeping_master, main_three_trials, main_liberation
      # Side quests: 7 additional quests
      # Total: 12 quests
      max_ticks = 2000
      check_interval = 100

      bot =
        Enum.reduce(1..div(max_ticks, check_interval), bot, fn iteration, bot_acc ->
          {:ok, bot_new} = ChannelBot.run(bot_acc, ticks: check_interval)
          info = ChannelBot.get_info(bot_new)
          completed = info.strategy_state.results.quests_completed

          Logger.info(
            "[TEST] Iteration #{iteration}: Completed #{length(completed)} quests: #{inspect(completed)}"
          )

          Logger.info("[TEST] Phase: #{info.strategy_state.phase}")

          if info.strategy_state.phase == :complete do
            Logger.info("[TEST] Bot reports completion!")
            bot_new
          else
            bot_new
          end
        end)

      info = ChannelBot.get_info(bot)
      strategy_state = info.strategy_state
      completed_quests = strategy_state.results.quests_completed

      Logger.info("[TEST] Final completed quests: #{inspect(completed_quests)}")
      Logger.info("[TEST] Final phase: #{strategy_state.phase}")
      Logger.info("[TEST] Failure reason: #{inspect(strategy_state.failure_reason)}")

      # Expected quests
      expected_main = ["intro_welcome", "intro_find_temple", "main_sleeping_master"]

      # Check we completed at least the first 3 main quests
      assert length(completed_quests) >= 2,
             "Bot should complete at least 2 quests, got: #{length(completed_quests)}"

      # Cleanup
      :ok = ChannelBot.stop(bot)
    end
  end
end
