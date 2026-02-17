defmodule Loka.Framework.Quest.TimedObjectivesTest do
  @moduledoc """
  Integration tests for timed quest objectives.

  Tests the full flow from quest acceptance to timer management.
  V2: Timer data is stored in entity components, no GenServer needed.
  """
  use Loka.DataCase, async: false

  alias Loka.Framework.Quest.TimerManager
  alias Loka.Engine.Entity
  alias Loka.Content

  import Loka.EngineFixtures

  setup do
    player_entity =
      Entity.new(
        type: :character,
        key: "test_player",
        account_id: Ecto.UUID.generate(),
        components: %{
          "quest_progress" => %{"active" => %{}, "completed" => []}
        }
      )

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

    {:ok, player_entity: player_entity}
  end

  describe "accepting quests with timed objectives" do
    test "starts timer when accepting quest with timed objective", %{player_entity: entity} do
      quest = Content.Quest.definition("escape_quest")
      assert quest != nil

      # Set up objective in quest_progress
      entity =
        Entity.add_component(entity, "quest_progress", %{
          "active" => %{
            "escape_quest" => %{
              "objectives" => %{
                "reach_exit" => %{"completed" => false, "progress" => 0}
              },
              "status" => "accepted"
            }
          },
          "completed" => []
        })

      accepted_at = DateTime.utc_now()

      {:ok, entity, expires_at} =
        TimerManager.start_objective_timer(entity, "escape_quest", "reach_exit", 300,
          started_at: accepted_at
        )

      assert %DateTime{} = expires_at
      remaining = TimerManager.get_remaining_time(entity, "escape_quest", "reach_exit")
      assert remaining > 298 && remaining <= 300

      timers = TimerManager.get_player_timers(entity)
      assert length(timers) == 1
      assert hd(timers).quest_id == "escape_quest"
      assert hd(timers).objective_id == "reach_exit"
    end

    test "only timed objectives get timers", %{player_entity: entity} do
      quest = Content.Quest.definition("mixed_quest")
      assert quest != nil

      timed_obj = Enum.find(quest.objectives, &(&1.id == "timed_obj"))
      normal_obj = Enum.find(quest.objectives, &(&1.id == "normal_obj"))
      assert timed_obj.time_limit == 60
      assert normal_obj.time_limit == nil

      # Set up objectives in quest_progress
      entity =
        Entity.add_component(entity, "quest_progress", %{
          "active" => %{
            "mixed_quest" => %{
              "objectives" => %{
                "timed_obj" => %{"completed" => false, "progress" => 0},
                "normal_obj" => %{"completed" => false, "progress" => 0}
              },
              "status" => "accepted"
            }
          },
          "completed" => []
        })

      {:ok, entity, _} =
        TimerManager.start_objective_timer(entity, "mixed_quest", "timed_obj", 60)

      timers = TimerManager.get_player_timers(entity)
      assert length(timers) == 1
      assert hd(timers).objective_id == "timed_obj"
    end
  end

  describe "timer expiration" do
    test "objective is marked expired after time limit", %{player_entity: entity} do
      entity =
        Entity.add_component(entity, "quest_progress", %{
          "active" => %{
            "test_quest" => %{
              "objectives" => %{
                "test_obj" => %{"completed" => false, "progress" => 0}
              },
              "status" => "in_progress"
            }
          },
          "completed" => []
        })

      past = DateTime.add(DateTime.utc_now(), -120, :second)

      {:ok, entity, _} =
        TimerManager.start_objective_timer(entity, "test_quest", "test_obj", 60, started_at: past)

      assert TimerManager.is_expired?(entity, "test_quest", "test_obj")
    end

    test "remaining time decreases correctly", %{player_entity: entity} do
      entity =
        Entity.add_component(entity, "quest_progress", %{
          "active" => %{
            "test_quest" => %{
              "objectives" => %{
                "test_obj" => %{"completed" => false, "progress" => 0}
              },
              "status" => "in_progress"
            }
          },
          "completed" => []
        })

      past = DateTime.add(DateTime.utc_now(), -10, :second)

      {:ok, entity, _} =
        TimerManager.start_objective_timer(entity, "test_quest", "test_obj", 60, started_at: past)

      remaining = TimerManager.get_remaining_time(entity, "test_quest", "test_obj")
      assert remaining >= 48 && remaining <= 52
    end
  end

  describe "timer cancellation" do
    test "cancelling removes timer fields", %{player_entity: entity} do
      entity =
        Entity.add_component(entity, "quest_progress", %{
          "active" => %{
            "test_quest" => %{
              "objectives" => %{
                "test_obj" => %{"completed" => false, "progress" => 0}
              },
              "status" => "in_progress"
            }
          },
          "completed" => []
        })

      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "test_quest", "test_obj", 300)
      assert TimerManager.get_remaining_time(entity, "test_quest", "test_obj") != nil

      {:ok, entity} = TimerManager.cancel_objective_timer(entity, "test_quest", "test_obj")
      assert TimerManager.get_remaining_time(entity, "test_quest", "test_obj") == nil
    end

    test "clearing quest clears all quest timers", %{player_entity: entity} do
      entity =
        Entity.add_component(entity, "quest_progress", %{
          "active" => %{
            "quest1" => %{
              "objectives" => %{
                "obj1" => %{"completed" => false, "progress" => 0},
                "obj2" => %{"completed" => false, "progress" => 0}
              },
              "status" => "in_progress"
            },
            "quest2" => %{
              "objectives" => %{
                "obj1" => %{"completed" => false, "progress" => 0}
              },
              "status" => "in_progress"
            }
          },
          "completed" => []
        })

      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest1", "obj1", 300)
      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest1", "obj2", 300)
      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest2", "obj1", 300)

      assert length(TimerManager.get_player_timers(entity)) == 3

      {:ok, entity} = TimerManager.clear_quest_timers(entity, "quest1")

      timers = TimerManager.get_player_timers(entity)
      assert length(timers) == 1
      assert hd(timers).quest_id == "quest2"
    end
  end

  describe "objective map structure" do
    test "objective map includes time_limit field" do
      obj = %{
        id: "test",
        type: :go_to,
        target_id: "room",
        time_limit: 300,
        description: "Test"
      }

      assert obj.time_limit == 300
    end

    test "time_limit defaults to nil" do
      obj = %{
        id: "test",
        type: :go_to,
        target_id: "room",
        time_limit: nil,
        description: "Test"
      }

      assert obj.time_limit == nil
    end
  end
end
