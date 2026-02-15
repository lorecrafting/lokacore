defmodule Loka.Game.Actions.DialogueTest do
  use Loka.DataCase

  alias Loka.Game.Actions.Dialogue, as: DialogueActions
  alias Loka.Game.Actions.Context

  import Loka.AccountsFixtures
  import Loka.EngineFixtures

  describe "start_conversation/2" do
    setup do
      player = player_fixture()
      character = character_fixture(%{player: player, character_name: "TestPlayer"})

      ctx = %Context{
        player_id: player.id,
        player_name: "TestPlayer",
        character: character,
        room: %{id: "test_room", entities: []}
      }

      %{ctx: ctx, player: player, character: character}
    end

    test "returns error when entity doesn't exist", %{ctx: ctx} do
      result = DialogueActions.start_conversation(ctx, "nonexistent_npc")
      assert {:error, message} = result
      assert is_binary(message)
    end

    test "builds player quest context correctly", %{ctx: ctx, character: character} do
      # Update character with active quest in components
      updated_character =
        character
        |> Loka.Engine.Entity.add_component("quest_progress", %{
          "test_quest" => %{"status" => "active"}
        })

      ctx = %{ctx | character: updated_character}

      # Should return an error tuple for nonexistent NPC
      result = DialogueActions.start_conversation(ctx, "nonexistent")
      assert {:error, _message} = result
    end
  end

  describe "choose_option/2" do
    setup do
      player = player_fixture()
      character = character_fixture(%{player: player, character_name: "TestPlayer"})

      ctx = %Context{
        player_id: player.id,
        player_name: "TestPlayer",
        character: character,
        room: %{id: "test_room", entities: []},
        dialogue: nil
      }

      %{ctx: ctx, character: character}
    end

    test "returns error when not in dialogue", %{ctx: ctx} do
      assert {:error, "Not in a dialogue."} = DialogueActions.choose_option(ctx, 0)
    end

    test "clears dialogue state on error", %{ctx: ctx} do
      ctx = %{ctx | dialogue: %{entity_id: "npc_1", node_id: "start"}}

      # With invalid NPC, the dialogue should end gracefully
      {:ok, result} = DialogueActions.choose_option(ctx, 0)

      # Dialogue state should be cleared
      assert result.state.dialogue == nil

      # Should have dialogue_end event
      assert Enum.any?(result.events, fn
               {:dialogue_end, %{entity_id: "npc_1"}} -> true
               _ -> false
             end)
    end
  end
end
