defmodule Loka.Admin.GameLogTest do
  use ExUnit.Case, async: false

  alias Loka.Admin.GameLog
  alias Loka.Admin.GameLog.Event

  @test_player "test_player_#{:rand.uniform(100_000)}"

  setup do
    # Ensure GameLog is running
    unless Process.whereis(GameLog) do
      start_supervised!(GameLog)
    end

    GameLog.clear(@test_player)
    :ok
  end

  describe "log/4" do
    test "logs events with correct category and type" do
      :ok = GameLog.log(:combat, :damage_dealt, %{amount: 15}, player_id: @test_player)
      Process.sleep(50)

      events = GameLog.get_events(player_id: @test_player)
      assert length(events) == 1

      event = hd(events)
      assert event.category == :combat
      assert event.event_type == :damage_dealt
      assert event.details.amount == 15
      assert event.player_id == @test_player
    end

    test "gracefully handles server not running" do
      # This should not crash
      result = GameLog.log(:test, :test_event, %{}, server: :nonexistent_server)
      assert result == :ok
    end
  end

  describe "get_events/1" do
    test "filters by player_id" do
      other_player = "other_player_#{:rand.uniform(100_000)}"

      GameLog.log(:quest, :quest_accepted, %{}, player_id: @test_player)
      GameLog.log(:quest, :quest_accepted, %{}, player_id: other_player)
      Process.sleep(50)

      events = GameLog.get_events(player_id: @test_player)
      assert length(events) == 1
      assert hd(events).player_id == @test_player

      GameLog.clear(other_player)
    end

    test "filters by category" do
      GameLog.log(:combat, :damage_dealt, %{}, player_id: @test_player)
      GameLog.log(:quest, :quest_accepted, %{}, player_id: @test_player)
      Process.sleep(50)

      combat_events = GameLog.get_events(player_id: @test_player, category: :combat)
      assert length(combat_events) == 1
      assert hd(combat_events).category == :combat
    end

    test "filters by event_type" do
      GameLog.log(:quest, :quest_accepted, %{}, player_id: @test_player)
      GameLog.log(:quest, :quest_completed, %{}, player_id: @test_player)
      Process.sleep(50)

      accepted_events =
        GameLog.get_events(player_id: @test_player, event_type: :quest_accepted)

      assert length(accepted_events) == 1
      assert hd(accepted_events).event_type == :quest_accepted
    end

    test "respects limit option" do
      for i <- 1..10 do
        GameLog.log(:quest, :objective_progress, %{step: i}, player_id: @test_player)
      end

      Process.sleep(100)

      events = GameLog.get_events(player_id: @test_player, limit: 5)
      assert length(events) == 5
    end
  end

  describe "recent/1" do
    test "returns recent events with default limit" do
      for i <- 1..100 do
        GameLog.log(:quest, :objective_progress, %{step: i}, player_id: @test_player)
      end

      Process.sleep(150)

      events = GameLog.recent(player_id: @test_player)
      # Default limit is 50
      assert length(events) == 50
    end
  end

  describe "Quest convenience functions" do
    test "log_accepted/2 logs quest_accepted event" do
      GameLog.Quest.log_accepted(@test_player, "test_quest")
      Process.sleep(50)

      events = GameLog.get_events(player_id: @test_player, event_type: :quest_accepted)
      assert length(events) == 1

      event = hd(events)
      assert event.category == :quest
      assert event.details.quest_id == "test_quest"
      assert event.metadata.quest_id == "test_quest"
    end

    test "log_objective_progress/7 logs progress event" do
      GameLog.Quest.log_objective_progress(
        @test_player,
        "quest_1",
        "obj_1",
        0,
        1,
        %{type: :kill, target_id: "goblin"}
      )

      Process.sleep(50)

      events = GameLog.get_events(player_id: @test_player, event_type: :objective_progress)
      assert length(events) == 1

      event = hd(events)
      assert event.details.old_progress == 0
      assert event.details.new_progress == 1
      assert event.metadata.quest_id == "quest_1"
      assert event.metadata.objective_id == "obj_1"
    end

    test "log_completed/3 logs quest_completed event" do
      rewards = %{xp: 100, gold: 50}
      GameLog.Quest.log_completed(@test_player, "test_quest", rewards)
      Process.sleep(50)

      events = GameLog.get_events(player_id: @test_player, event_type: :quest_completed)
      assert length(events) == 1

      event = hd(events)
      assert event.details.rewards == rewards
    end
  end

  describe "diagnose_objective/4" do
    test "returns diagnosis for objective with events" do
      GameLog.Quest.log_objective_progress(@test_player, "q1", "o1", 0, 1, %{type: :kill})
      GameLog.Quest.log_objective_progress(@test_player, "q1", "o1", 1, 2, %{type: :kill})
      Process.sleep(50)

      diagnosis = GameLog.diagnose_objective(@test_player, "q1", "o1")

      assert diagnosis.quest_id == "q1"
      assert diagnosis.objective_id == "o1"
      assert diagnosis.current_progress == 2
      assert diagnosis.completed == false
      assert diagnosis.event_count == 2
    end

    test "returns diagnosis for completed objective" do
      GameLog.Quest.log_objective_progress(@test_player, "q1", "o1", 0, 1, %{type: :kill})
      GameLog.Quest.log_objective_completed(@test_player, "q1", "o1")
      Process.sleep(50)

      diagnosis = GameLog.diagnose_objective(@test_player, "q1", "o1")

      assert diagnosis.completed == true
      assert "Objective was completed successfully" in diagnosis.possible_issues
    end

    test "returns diagnosis for objective with no events" do
      diagnosis = GameLog.diagnose_objective(@test_player, "q1", "nonexistent")

      assert diagnosis.event_count == 0
      assert "No events recorded for this objective" in diagnosis.possible_issues
    end
  end

  describe "clear/1" do
    test "clears events for a player" do
      GameLog.log(:quest, :quest_accepted, %{}, player_id: @test_player)
      Process.sleep(50)

      assert length(GameLog.get_events(player_id: @test_player)) == 1

      GameLog.clear(@test_player)
      Process.sleep(50)

      assert GameLog.get_events(player_id: @test_player) == []
    end
  end

  describe "stats/0" do
    test "returns event statistics" do
      GameLog.log(:quest, :quest_accepted, %{}, player_id: @test_player)
      GameLog.log(:combat, :damage_dealt, %{}, player_id: @test_player)
      Process.sleep(50)

      stats = GameLog.stats()

      assert stats.total_events >= 2
      assert stats.players >= 1
      assert is_map(stats.by_category)
    end
  end

  describe "export/2" do
    test "exports events as JSON-friendly maps" do
      GameLog.log(:quest, :quest_accepted, %{quest_id: "q1"}, player_id: @test_player)
      Process.sleep(50)

      exported = GameLog.export(@test_player)

      assert length(exported) == 1
      event = hd(exported)

      # Should be a map with string timestamp
      assert is_map(event)
      assert is_binary(event.timestamp)
      assert event.category == :quest
    end
  end

  describe "Event struct" do
    test "new/4 creates event with ID and timestamp" do
      event = Event.new(:combat, :damage_dealt, %{amount: 10}, player_id: "p1")

      assert is_binary(event.id)
      assert %DateTime{} = event.timestamp
      assert event.category == :combat
      assert event.event_type == :damage_dealt
      assert event.player_id == "p1"
    end

    test "to_map/1 converts to JSON-friendly format" do
      event = Event.new(:quest, :quest_accepted, %{quest_id: "q1"})
      map = Event.to_map(event)

      assert is_binary(map.timestamp)
      assert String.contains?(map.timestamp, "T")
    end
  end
end
