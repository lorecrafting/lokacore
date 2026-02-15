defmodule Loka.Game.Actions.ContextTest do
  use ExUnit.Case, async: true

  alias Loka.Game.Actions.Context
  alias Loka.Engine.Entity

  describe "struct creation" do
    test "creates context with required fields" do
      character = %Entity{
        id: "char_1",
        type: "character",
        key: "player_123",
        short_desc: "Test Player",
        components: %{}
      }

      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        character: character,
        room: %{id: "room_1", name: "Test Room"}
      }

      assert ctx.player_id == "player_123"
      assert ctx.player_name == "Test Player"
      assert ctx.character.key == "player_123"
      assert ctx.room.id == "room_1"
    end

    test "creates context with optional fields" do
      character = %Entity{id: "char_1", type: "character", key: "player_123", components: %{}}

      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        character: character,
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
      character = %Entity{id: "char_1", type: "character", key: "player_123", components: %{}}

      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        character: character,
        room: %{id: "room_1"}
      }

      assert ctx.combat == nil
      assert ctx.dialogue == nil
      assert ctx.container == nil
    end
  end

  describe "apply_state/2" do
    test "updates character" do
      character = %Entity{
        id: "char_1",
        type: "character",
        key: "player_123",
        components: %{"stats" => %{"gold" => 100}}
      }

      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        character: character,
        room: %{id: "room_1"}
      }

      new_character = Entity.add_component(character, "stats", %{"gold" => 200})
      updated = Context.apply_state(ctx, %{character: new_character})

      assert Entity.get_component(updated.character, "stats") == %{"gold" => 200}
      assert updated.room.id == "room_1"
    end

    test "updates room" do
      character = %Entity{
        id: "char_1",
        type: "character",
        key: "player_123",
        components: %{"stats" => %{"gold" => 100}}
      }

      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        character: character,
        room: %{id: "room_1"}
      }

      updated = Context.apply_state(ctx, %{room: %{id: "room_2"}})

      assert updated.room.id == "room_2"
      assert Entity.get_component(updated.character, "stats") == %{"gold" => 100}
    end

    test "updates combat state" do
      character = %Entity{id: "char_1", type: "character", key: "player_123", components: %{}}

      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        character: character,
        room: %{id: "room_1"},
        combat: nil
      }

      updated = Context.apply_state(ctx, %{combat: %{active: true}})

      assert updated.combat.active == true
    end

    test "ignores nil values" do
      character = %Entity{
        id: "char_1",
        type: "character",
        key: "player_123",
        components: %{"stats" => %{"gold" => 100}}
      }

      ctx = %Context{
        player_id: "player_123",
        player_name: "Test Player",
        character: character,
        room: %{id: "room_1"}
      }

      updated = Context.apply_state(ctx, %{character: nil, dialogue: nil})

      assert Entity.get_component(updated.character, "stats") == %{"gold" => 100}
      assert updated.dialogue == nil
    end
  end
end
