defmodule Loka.Game.Actions.CombatTest do
  use Loka.DataCase

  alias Loka.Game.Actions.Combat, as: CombatActions
  alias Loka.Game.Actions.Context

  import Loka.AccountsFixtures
  import Loka.EngineFixtures

  describe "attack/3" do
    setup do
      player = player_fixture()
      character = character_fixture(%{player: player, character_name: "TestPlayer"})

      ctx = %Context{
        player_id: player.id,
        player_name: "TestPlayer",
        character: character,
        room: %{id: "test_room", entities: []},
        combat: nil
      }

      %{ctx: ctx}
    end

    test "returns error for non-combatant entity", %{ctx: ctx} do
      # Mock entity without combat component
      entity = %{id: "npc_1", name: "Friendly Monk", short_desc: "Friendly Monk"}

      result = CombatActions.attack(ctx, "npc_1", entity)
      assert {:error, message} = result
      assert is_binary(message)
    end

    test "returns appropriate error message for non-combatant", %{ctx: ctx} do
      entity = %{id: "npc_1", name: "Village Elder", short_desc: "Village Elder"}

      {:error, message} = CombatActions.attack(ctx, "npc_1", entity)
      # Either "doesn't want to fight" or "can't attack that"
      assert String.contains?(message, "fight") or String.contains?(message, "attack")
    end
  end

  describe "flee/1" do
    setup do
      player = player_fixture()
      character = character_fixture(%{player: player, character_name: "TestPlayer"})

      ctx = %Context{
        player_id: player.id,
        player_name: "TestPlayer",
        character: character,
        room: %{id: "test_room", entities: []},
        combat: nil
      }

      %{ctx: ctx}
    end

    test "returns error when not in combat", %{ctx: ctx} do
      assert {:error, "You're not in combat."} = CombatActions.flee(ctx)
    end
  end

  describe "process_tick/1" do
    setup do
      player = player_fixture()
      character = character_fixture(%{player: player, character_name: "TestPlayer"})

      ctx = %Context{
        player_id: player.id,
        player_name: "TestPlayer",
        character: character,
        room: %{id: "test_room", entities: []},
        combat: nil
      }

      %{ctx: ctx}
    end

    test "returns error when not in combat", %{ctx: ctx} do
      {:error, message} = CombatActions.process_tick(ctx)
      assert message == "Not in combat."
    end
  end
end
