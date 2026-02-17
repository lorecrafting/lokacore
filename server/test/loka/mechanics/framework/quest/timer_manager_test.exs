defmodule Loka.Framework.Quest.TimerManagerTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Quest.TimerManager
  alias Loka.Engine.Entity

  defp player_entity(quest_progress \\ %{}) do
    Entity.new(
      type: :character,
      key: "test_player",
      account_id: Ecto.UUID.generate(),
      components: %{"quest_progress" => quest_progress}
    )
  end

  defp entity_with_quest(quest_id, objectives_map) do
    player_entity(%{
      "active" => %{
        quest_id => %{
          "objectives" => objectives_map,
          "status" => "in_progress"
        }
      },
      "completed" => []
    })
  end

  describe "start_objective_timer/5" do
    test "starts a timer and returns expiration time" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      {:ok, updated, expires_at} =
        TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60)

      assert %DateTime{} = expires_at
      expected = DateTime.add(DateTime.utc_now(), 60, :second)
      assert abs(DateTime.diff(expires_at, expected)) <= 2

      # Verify timer data is in the objective
      obj_data =
        get_in(updated.components, [
          "quest_progress",
          "active",
          "test_quest",
          "objectives",
          "obj1"
        ])

      assert is_integer(obj_data["expires_at"])
      assert obj_data["time_limit"] == 60
      assert obj_data["warned"] == []
    end

    test "can specify custom started_at time" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      started_at = DateTime.add(DateTime.utc_now(), -30, :second)

      {:ok, _updated, expires_at} =
        TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60,
          started_at: started_at
        )

      expected = DateTime.add(started_at, 60, :second)
      assert DateTime.diff(expires_at, expected) == 0
    end

    test "returns error for non-existent objective" do
      entity = entity_with_quest("test_quest", %{})

      assert {:error, :objective_not_found} =
               TimerManager.start_objective_timer(entity, "test_quest", "missing", 60)
    end
  end

  describe "get_remaining_time/3" do
    test "returns remaining seconds for an active timer" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60)

      remaining = TimerManager.get_remaining_time(entity, "test_quest", "obj1")
      assert remaining >= 58 && remaining <= 60
    end

    test "returns nil for non-existent timer" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      assert TimerManager.get_remaining_time(entity, "test_quest", "obj1") == nil
    end

    test "returns nil for non-existent objective" do
      entity = entity_with_quest("test_quest", %{})
      assert TimerManager.get_remaining_time(entity, "test_quest", "missing") == nil
    end
  end

  describe "cancel_objective_timer/3" do
    test "removes the timer fields" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60)
      assert TimerManager.get_remaining_time(entity, "test_quest", "obj1") != nil

      {:ok, entity} = TimerManager.cancel_objective_timer(entity, "test_quest", "obj1")
      assert TimerManager.get_remaining_time(entity, "test_quest", "obj1") == nil
    end
  end

  describe "is_expired?/3" do
    test "returns false for active timer with time remaining" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60)
      refute TimerManager.is_expired?(entity, "test_quest", "obj1")
    end

    test "returns true for expired timer" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      past = DateTime.add(DateTime.utc_now(), -120, :second)

      {:ok, entity, _} =
        TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60, started_at: past)

      assert TimerManager.is_expired?(entity, "test_quest", "obj1")
    end

    test "returns false for non-existent timer" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      refute TimerManager.is_expired?(entity, "test_quest", "obj1")
    end
  end

  describe "get_player_timers/1" do
    test "returns all timers for a player" do
      entity =
        entity_with_quest("quest1", %{
          "obj1" => %{"completed" => false, "progress" => 0},
          "obj2" => %{"completed" => false, "progress" => 0}
        })

      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest1", "obj1", 60)
      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest1", "obj2", 120)

      timers = TimerManager.get_player_timers(entity)
      assert length(timers) == 2
      assert Enum.all?(timers, &(&1.quest_id == "quest1"))
    end

    test "returns empty list for player with no timers" do
      entity = player_entity()
      assert TimerManager.get_player_timers(entity) == []
    end
  end

  describe "clear_player_timers/1" do
    test "removes all timers" do
      entity =
        entity_with_quest("quest1", %{
          "obj1" => %{"completed" => false, "progress" => 0},
          "obj2" => %{"completed" => false, "progress" => 0}
        })

      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest1", "obj1", 60)
      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest1", "obj2", 120)
      assert length(TimerManager.get_player_timers(entity)) == 2

      {:ok, entity} = TimerManager.clear_player_timers(entity)
      assert TimerManager.get_player_timers(entity) == []
    end
  end

  describe "clear_quest_timers/2" do
    test "removes all timers for a specific quest" do
      # Build entity with two quests
      entity =
        player_entity(%{
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

      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest1", "obj1", 60)
      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest1", "obj2", 120)
      {:ok, entity, _} = TimerManager.start_objective_timer(entity, "quest2", "obj1", 180)

      {:ok, entity} = TimerManager.clear_quest_timers(entity, "quest1")

      timers = TimerManager.get_player_timers(entity)
      assert length(timers) == 1
      assert hd(timers).quest_id == "quest2"
    end
  end

  describe "get_expires_at/3" do
    test "returns expiration time for active timer" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      {:ok, entity, expected_expires} =
        TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60)

      {:ok, expires_at} = TimerManager.get_expires_at(entity, "test_quest", "obj1")
      assert abs(DateTime.diff(expires_at, expected_expires)) <= 1
    end

    test "returns error for non-existent timer" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      assert {:error, :not_found} = TimerManager.get_expires_at(entity, "test_quest", "obj1")
    end
  end

  describe "check_and_warn/1" do
    test "marks expired objectives" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      past = DateTime.add(DateTime.utc_now(), -120, :second)

      {:ok, entity, _} =
        TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60, started_at: past)

      {:ok, entity} = TimerManager.check_and_warn(entity)

      obj_data =
        get_in(entity.components, ["quest_progress", "active", "test_quest", "objectives", "obj1"])

      assert obj_data["expired"] == true
      # Timer fields removed after expiration
      refute Map.has_key?(obj_data, "expires_at")
    end

    test "records warned intervals" do
      entity =
        entity_with_quest("test_quest", %{"obj1" => %{"completed" => false, "progress" => 0}})

      # Start timer that's 25 seconds from expiry (should trigger 30s warning)
      almost_expired = DateTime.add(DateTime.utc_now(), -35, :second)

      {:ok, entity, _} =
        TimerManager.start_objective_timer(entity, "test_quest", "obj1", 60,
          started_at: almost_expired
        )

      {:ok, entity} = TimerManager.check_and_warn(entity)

      obj_data =
        get_in(entity.components, ["quest_progress", "active", "test_quest", "objectives", "obj1"])

      assert 30 in obj_data["warned"]
    end
  end
end
