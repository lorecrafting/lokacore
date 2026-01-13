defmodule Loka.Game.Actions.ContextTest do
  use ExUnit.Case, async: true

  alias Loka.Game.Actions.Context
  alias Loka.Framework.Player.GameState

  describe "struct creation" do
    test "creates context with required fields" do
      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        game_state: %GameState{player_id: "player_123"},
        room: %{id: "room_1", name: "Test Room"}
      }

      assert ctx.player_id == "player_123"
      assert ctx.player_name == "Test Player"
      assert ctx.game_state.player_id == "player_123"
      assert ctx.room.id == "room_1"
    end

    test "creates context with optional fields" do
      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        game_state: %GameState{player_id: "player_123"},
        room: %{id: "room_1"},
        combat: %{active: true, enemy: %{name: "Goblin"}},
        dialogue: %{entity_id: "npc_1", node_id: "start"},
        container: %{id: "chest_1"}
      }

      assert ctx.combat.active == true
      assert ctx.dialogue.entity_id == "npc_1"
      assert ctx.container.id == "chest_1"
    end

    test "defaults optional fields to nil" do
      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        game_state: %GameState{player_id: "player_123"},
        room: %{id: "room_1"}
      }

      assert ctx.combat == nil
      assert ctx.dialogue == nil
      assert ctx.container == nil
    end
  end

  describe "apply_state/2" do
    test "updates game_state" do
      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        game_state: %{gold: 100},
        room: %{id: "room_1"}
      }

      updated = Context.apply_state(ctx, %{game_state: %{gold: 200}})

      assert updated.game_state.gold == 200
      assert updated.room.id == "room_1"
    end

    test "updates room" do
      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        game_state: %{gold: 100},
        room: %{id: "room_1"}
      }

      updated = Context.apply_state(ctx, %{room: %{id: "room_2"}})

      assert updated.room.id == "room_2"
      assert updated.game_state.gold == 100
    end

    test "updates combat state" do
      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        game_state: %{},
        room: %{id: "room_1"},
        combat: nil
      }

      updated = Context.apply_state(ctx, %{combat: %{active: true}})

      assert updated.combat.active == true
    end

    test "ignores nil values" do
      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        game_state: %{gold: 100},
        room: %{id: "room_1"}
      }

      updated = Context.apply_state(ctx, %{game_state: nil, dialogue: nil})

      assert updated.game_state.gold == 100
      assert updated.dialogue == nil
    end
  end
end
