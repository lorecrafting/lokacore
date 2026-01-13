defmodule Loka.Game.Actions.ResultTest do
  use ExUnit.Case, async: true

  alias Loka.Game.Actions.Result

  describe "new/1" do
    test "creates result with state changes" do
      result = Result.new(state: %{game_state: %{gold: 100}})

      assert result.state.game_state.gold == 100
      assert result.events == []
    end

    test "creates result with events" do
      result = Result.new(events: [{:event, "Something happened"}])

      assert result.state == %{}
      assert result.events == [{:event, "Something happened"}]
    end

    test "creates result with both state and events" do
      result =
        Result.new(
          state: %{room: %{id: "new_room"}},
          events: [
            {:event, "You moved"},
            {:room_changed, %{room: %{id: "new_room"}}}
          ]
        )

      assert result.state.room.id == "new_room"
      assert length(result.events) == 2
    end

    test "defaults to empty state and events" do
      result = Result.new()

      assert result.state == %{}
      assert result.events == []
    end
  end

  describe "merge_state/2" do
    test "merges state changes into result" do
      result = Result.new(state: %{gold: 100})
      merged = Result.merge_state(result, %{health: 50})

      assert merged.state.gold == 100
      assert merged.state.health == 50
    end

    test "second state overrides first on conflict" do
      result = Result.new(state: %{gold: 100})
      merged = Result.merge_state(result, %{gold: 200})

      assert merged.state.gold == 200
    end

    test "preserves events" do
      result =
        Result.new(
          state: %{gold: 100},
          events: [{:event, "First"}]
        )

      merged = Result.merge_state(result, %{health: 50})

      assert merged.events == [{:event, "First"}]
    end
  end

  describe "put_state/3" do
    test "puts a single state key" do
      result = Result.new()
      updated = Result.put_state(result, :game_state, %{gold: 100})

      assert updated.state.game_state.gold == 100
    end

    test "overwrites existing key" do
      result = Result.new(state: %{game_state: %{gold: 100}})
      updated = Result.put_state(result, :game_state, %{gold: 200})

      assert updated.state.game_state.gold == 200
    end
  end

  describe "add_event/2" do
    test "adds event to result" do
      result = Result.new(events: [{:event, "First"}])
      updated = Result.add_event(result, {:event, "Second"})

      assert updated.events == [{:event, "First"}, {:event, "Second"}]
    end

    test "adds event to empty result" do
      result = Result.new()
      updated = Result.add_event(result, {:quest_completed, %{quest_id: "q1"}})

      assert updated.events == [{:quest_completed, %{quest_id: "q1"}}]
    end
  end

  describe "add_events/2" do
    test "adds multiple events to result" do
      result = Result.new(events: [{:event, "First"}])

      updated =
        Result.add_events(result, [
          {:event, "Second"},
          {:event, "Third"}
        ])

      assert length(updated.events) == 3
      assert {:event, "Third"} in updated.events
    end
  end
end
