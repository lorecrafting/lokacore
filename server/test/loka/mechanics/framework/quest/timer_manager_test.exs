defmodule Loka.Framework.Quest.TimerManagerTest do
  use Loka.DataCase, async: false

  alias Loka.Framework.Quest.TimerManager

  describe "start_objective_timer/5" do
    test "starts a timer and returns expiration time" do
      player_id = Ecto.UUID.generate()
      quest_id = "test_quest"
      objective_id = "timed_objective"
      time_limit = 60

      {:ok, expires_at} =
        TimerManager.start_objective_timer(player_id, quest_id, objective_id, time_limit)

      assert %DateTime{} = expires_at
      expected_expires = DateTime.add(DateTime.utc_now(), time_limit, :second)
      assert DateTime.diff(expires_at, expected_expires) <= 1
    end

    test "can specify custom started_at time" do
      player_id = Ecto.UUID.generate()
      quest_id = "test_quest"
      objective_id = "timed_objective"
      time_limit = 60
      started_at = DateTime.add(DateTime.utc_now(), -30, :second)

      {:ok, expires_at} =
        TimerManager.start_objective_timer(
          player_id,
          quest_id,
          objective_id,
          time_limit,
          started_at: started_at
        )

      # Should expire 30 seconds from now (60 - 30 already elapsed)
      expected = DateTime.add(started_at, time_limit, :second)
      assert DateTime.diff(expires_at, expected) == 0
    end
  end

  describe "get_remaining_time/3" do
    test "returns remaining seconds for an active timer" do
      player_id = Ecto.UUID.generate()
      quest_id = "test_quest"
      objective_id = "timed_objective"
      time_limit = 60

      TimerManager.start_objective_timer(player_id, quest_id, objective_id, time_limit)
      remaining = TimerManager.get_remaining_time(player_id, quest_id, objective_id)

      # Should be close to 60 seconds
      assert remaining >= 58 && remaining <= 60
    end

    test "returns nil for non-existent timer" do
      player_id = Ecto.UUID.generate()
      quest_id = "nonexistent"
      objective_id = "nonexistent"

      assert TimerManager.get_remaining_time(player_id, quest_id, objective_id) == nil
    end
  end

  describe "cancel_objective_timer/3" do
    test "removes the timer" do
      player_id = Ecto.UUID.generate()
      quest_id = "test_quest"
      objective_id = "timed_objective"

      TimerManager.start_objective_timer(player_id, quest_id, objective_id, 60)
      assert TimerManager.get_remaining_time(player_id, quest_id, objective_id) != nil

      :ok = TimerManager.cancel_objective_timer(player_id, quest_id, objective_id)
      assert TimerManager.get_remaining_time(player_id, quest_id, objective_id) == nil
    end
  end

  describe "is_expired?/3" do
    test "returns false for active timer with time remaining" do
      player_id = Ecto.UUID.generate()
      quest_id = "test_quest"
      objective_id = "timed_objective"

      TimerManager.start_objective_timer(player_id, quest_id, objective_id, 60)
      refute TimerManager.is_expired?(player_id, quest_id, objective_id)
    end

    test "returns true for expired timer" do
      player_id = Ecto.UUID.generate()
      quest_id = "test_quest"
      objective_id = "timed_objective"

      # Start timer with a time in the past (already expired)
      past = DateTime.add(DateTime.utc_now(), -120, :second)

      TimerManager.start_objective_timer(
        player_id,
        quest_id,
        objective_id,
        60,
        started_at: past
      )

      assert TimerManager.is_expired?(player_id, quest_id, objective_id)
    end

    test "returns false for non-existent timer" do
      refute TimerManager.is_expired?(Ecto.UUID.generate(), "quest", "obj")
    end
  end

  describe "get_player_timers/1" do
    test "returns all timers for a player" do
      player_id = Ecto.UUID.generate()

      TimerManager.start_objective_timer(player_id, "quest1", "obj1", 60)
      TimerManager.start_objective_timer(player_id, "quest1", "obj2", 120)
      TimerManager.start_objective_timer(player_id, "quest2", "obj1", 180)

      timers = TimerManager.get_player_timers(player_id)

      assert length(timers) == 3
      assert Enum.all?(timers, &(&1.player_id == player_id))
    end

    test "returns empty list for player with no timers" do
      player_id = Ecto.UUID.generate()
      assert TimerManager.get_player_timers(player_id) == []
    end
  end

  describe "clear_player_timers/1" do
    test "removes all timers for a player" do
      player_id = Ecto.UUID.generate()

      TimerManager.start_objective_timer(player_id, "quest1", "obj1", 60)
      TimerManager.start_objective_timer(player_id, "quest1", "obj2", 120)

      assert length(TimerManager.get_player_timers(player_id)) == 2

      :ok = TimerManager.clear_player_timers(player_id)

      assert TimerManager.get_player_timers(player_id) == []
    end
  end

  describe "clear_quest_timers/2" do
    test "removes all timers for a specific quest" do
      player_id = Ecto.UUID.generate()

      TimerManager.start_objective_timer(player_id, "quest1", "obj1", 60)
      TimerManager.start_objective_timer(player_id, "quest1", "obj2", 120)
      TimerManager.start_objective_timer(player_id, "quest2", "obj1", 180)

      :ok = TimerManager.clear_quest_timers(player_id, "quest1")

      timers = TimerManager.get_player_timers(player_id)
      assert length(timers) == 1
      assert hd(timers).quest_id == "quest2"
    end
  end

  describe "get_expires_at/3" do
    test "returns expiration time for active timer" do
      player_id = Ecto.UUID.generate()
      quest_id = "test_quest"
      objective_id = "timed_objective"

      {:ok, expected_expires} =
        TimerManager.start_objective_timer(player_id, quest_id, objective_id, 60)

      {:ok, expires_at} = TimerManager.get_expires_at(player_id, quest_id, objective_id)
      assert expires_at == expected_expires
    end

    test "returns error for non-existent timer" do
      assert {:error, :not_found} =
               TimerManager.get_expires_at(Ecto.UUID.generate(), "quest", "obj")
    end
  end
end
