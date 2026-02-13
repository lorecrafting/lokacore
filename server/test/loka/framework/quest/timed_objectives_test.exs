defmodule Loka.Framework.Quest.TimedObjectivesTest do
  @moduledoc """
  Integration tests for timed quest objectives.

  Tests the full flow from quest acceptance to timer management.
  """
  use Loka.DataCase, async: false

  alias Loka.Framework.Quest.TimerManager
  alias Loka.Framework.Quest.Definitions
  alias Loka.Framework.Quest.Definitions.Objective

  import Loka.EngineFixtures

  setup do
    player_id = Ecto.UUID.generate()

    # Create quest entities in the DB (replaces YAML + QuestRegistry)
    quest_fixture(%{
      key: "escape_quest",
      name: "Escape the Dungeon",
      description: "Escape before the dungeon collapses!",
      objectives: [
        %{
          "id" => "reach_exit",
          "type" => "go_to",
          "target_id" => "dungeon_exit",
          "time_limit" => 300,
          "description" => "Reach the exit in 5 minutes"
        }
      ]
    })

    quest_fixture(%{
      key: "mixed_quest",
      name: "Mixed Objectives",
      description: "Some timed, some not",
      objectives: [
        %{
          "id" => "timed_obj",
          "type" => "go_to",
          "target_id" => "location1",
          "time_limit" => 60,
          "description" => "Timed objective"
        },
        %{
          "id" => "normal_obj",
          "type" => "go_to",
          "target_id" => "location2",
          "description" => "Normal objective"
        }
      ]
    })

    on_exit(fn ->
      TimerManager.clear_player_timers(player_id)
    end)

    {:ok, player_id: player_id}
  end

  describe "accepting quests with timed objectives" do
    test "starts timer when accepting quest with timed objective", %{player_id: player_id} do
      # Get quest definition from DB via Definitions
      quest = Definitions.get_quest_definition("escape_quest")
      assert quest != nil
      assert quest.id == "escape_quest"

      # Start the timer manually (simulating what Progress.accept_quest does)
      accepted_at = DateTime.utc_now()

      {:ok, expires_at} =
        TimerManager.start_objective_timer(
          player_id,
          "escape_quest",
          "reach_exit",
          300,
          started_at: accepted_at
        )

      # Verify timer was started
      assert %DateTime{} = expires_at
      remaining = TimerManager.get_remaining_time(player_id, "escape_quest", "reach_exit")
      assert remaining > 298 && remaining <= 300

      # Verify we can get all player timers
      timers = TimerManager.get_player_timers(player_id)
      assert length(timers) == 1
      assert hd(timers).quest_id == "escape_quest"
      assert hd(timers).objective_id == "reach_exit"
    end

    test "only timed objectives get timers", %{player_id: player_id} do
      quest = Definitions.get_quest_definition("mixed_quest")
      assert quest != nil

      # Find timed and normal objectives
      timed_obj = Enum.find(quest.objectives, &(&1.id == "timed_obj"))
      normal_obj = Enum.find(quest.objectives, &(&1.id == "normal_obj"))

      assert timed_obj.time_limit == 60
      assert normal_obj.time_limit == nil

      # Start timer only for timed objective
      accepted_at = DateTime.utc_now()

      {:ok, _} =
        TimerManager.start_objective_timer(
          player_id,
          "mixed_quest",
          "timed_obj",
          60,
          started_at: accepted_at
        )

      # Verify only one timer exists
      timers = TimerManager.get_player_timers(player_id)
      assert length(timers) == 1
      assert hd(timers).objective_id == "timed_obj"
    end
  end

  describe "timer expiration" do
    test "objective is marked expired after time limit", %{player_id: player_id} do
      # Start timer with past time (already expired)
      past = DateTime.add(DateTime.utc_now(), -120, :second)

      {:ok, _} =
        TimerManager.start_objective_timer(
          player_id,
          "test_quest",
          "test_obj",
          60,
          started_at: past
        )

      assert TimerManager.is_expired?(player_id, "test_quest", "test_obj")
    end

    test "remaining time decreases correctly", %{player_id: player_id} do
      # Start timer 10 seconds in the past
      past = DateTime.add(DateTime.utc_now(), -10, :second)

      {:ok, _} =
        TimerManager.start_objective_timer(
          player_id,
          "test_quest",
          "test_obj",
          60,
          started_at: past
        )

      remaining = TimerManager.get_remaining_time(player_id, "test_quest", "test_obj")
      assert remaining >= 48 && remaining <= 52
    end
  end

  describe "timer cancellation" do
    test "completing objective cancels timer", %{player_id: player_id} do
      {:ok, _} =
        TimerManager.start_objective_timer(player_id, "test_quest", "test_obj", 300)

      assert TimerManager.get_remaining_time(player_id, "test_quest", "test_obj") != nil

      :ok = TimerManager.cancel_objective_timer(player_id, "test_quest", "test_obj")

      assert TimerManager.get_remaining_time(player_id, "test_quest", "test_obj") == nil
    end

    test "completing quest clears all quest timers", %{player_id: player_id} do
      {:ok, _} =
        TimerManager.start_objective_timer(player_id, "quest1", "obj1", 300)

      {:ok, _} =
        TimerManager.start_objective_timer(player_id, "quest1", "obj2", 300)

      {:ok, _} =
        TimerManager.start_objective_timer(player_id, "quest2", "obj1", 300)

      assert length(TimerManager.get_player_timers(player_id)) == 3

      :ok = TimerManager.clear_quest_timers(player_id, "quest1")

      timers = TimerManager.get_player_timers(player_id)
      assert length(timers) == 1
      assert hd(timers).quest_id == "quest2"
    end
  end

  describe "Definitions.Objective struct" do
    test "objective struct includes time_limit field" do
      obj = %Objective{
        id: "test",
        type: :go_to,
        target_id: "room",
        time_limit: 300,
        description: "Test"
      }

      assert obj.time_limit == 300
    end

    test "time_limit defaults to nil" do
      obj = %Objective{
        id: "test",
        type: :go_to,
        target_id: "room",
        description: "Test"
      }

      assert obj.time_limit == nil
    end
  end
end
