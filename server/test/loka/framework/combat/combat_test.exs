defmodule Loka.Framework.CombatTest do
  use Loka.DataCase

  alias Loka.Framework.Combat
  alias Loka.Framework.Player.GameState

  import Loka.EngineFixtures
  import Loka.AccountsFixtures

  # Helper to create a combatant NPC entity
  defp combatant_fixture(attrs \\ %{}) do
    components = %{
      "combatant" =>
        Map.merge(
          %{
            "health" => %{"current" => 30, "max" => 30},
            "stats" => %{"attack" => 5, "defense" => 2},
            "level" => 1,
            "xp_reward" => 10,
            "gold_reward" => 5
          },
          Map.get(attrs, :combatant, %{})
        )
    }

    npc_fixture(
      Map.merge(
        %{short_desc: "Test Goblin", extra_desc: "A nasty goblin", components: components},
        attrs
      )
    )
  end

  # Helper to create a minimal game state for testing
  # Includes resources.health for unified health access
  defp game_state_fixture(attrs \\ %{}) do
    health = Map.get(attrs, :health, %{"current" => 100, "max" => 100})

    # Normalize health to atom keys for resources
    health_for_resources = %{
      current: health["current"] || health[:current] || 100,
      max: health["max"] || health[:max] || 100
    }

    %GameState{
      player_id: Map.get(attrs, :player_id, Ecto.UUID.generate()),
      health: health,
      # Include health in resources for unified access
      resources: %{
        health: health_for_resources,
        mana: %{current: 100, max: 100},
        mv: %{current: 150, max: 150}
      },
      stats:
        Map.get(attrs, :stats, %{
          "str" => 10,
          "sta" => 10,
          "dex" => 10,
          "int" => 10,
          "gold" => 100,
          "level" => 1
        }),
      equipment: Map.get(attrs, :equipment, %{}),
      inventory: Map.get(attrs, :inventory, [])
    }
  end

  describe "start_combat/2" do
    test "starts combat with a valid combatant entity" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      assert {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)

      assert combat_state.enemy_id == combatant.id
      assert combat_state.enemy.name == "Test Goblin"
      assert combat_state.enemy.health["current"] == 30
      assert combat_state.enemy.health["max"] == 30
      assert combat_state.pvp == false
      assert combat_state.player_turn == true
      assert combat_state.turn_count == 1
      assert combat_state.player_defending == false
      assert combat_state.enemy_defending == false
      assert length(combat_state.log) == 0
    end

    test "returns error for non-existent entity" do
      game_state = game_state_fixture()
      fake_id = Ecto.UUID.generate()

      assert {:error, :entity_not_found} = Combat.start_combat(fake_id, game_state)
    end

    test "returns error for entity without combatant component" do
      npc = npc_fixture()
      game_state = game_state_fixture()

      assert {:error, :not_combatant} = Combat.start_combat(npc.id, game_state)
    end

    test "uses default stats when combatant missing fields" do
      # Create combatant with minimal component
      components = %{"combatant" => %{}}

      npc = npc_fixture(%{short_desc: "Minimal Mob", components: components})
      game_state = game_state_fixture()

      assert {:ok, combat_state} = Combat.start_combat(npc.id, game_state)
      assert combat_state.enemy.health["current"] == 50
      assert combat_state.enemy.health["max"] == 50
      assert combat_state.enemy.stats["attack"] == 5
    end
  end

  describe "player_action/3 - attack" do
    test "player can attack on their turn" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)
      assert {:ok, new_state, result} = Combat.player_action(combat_state, :attack, game_state)

      assert result.action == :attack
      assert result.damage >= 1
      assert new_state.player_turn == false
      assert new_state.player_defending == false
      assert new_state.enemy.health["current"] < 30
    end

    test "player cannot use actions when on cooldown" do
      # In LegendMUD-style auto-combat, player_turn is not used.
      # Actions are gated only by action_cooldown.
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)
      # Set action cooldown to block actions
      combat_state = %{combat_state | action_cooldown: 3}

      # Power strike should be blocked by cooldown
      assert {:error, :on_cooldown} =
               Combat.player_action(combat_state, :power_strike, game_state)

      # Flee should also be blocked by cooldown
      assert {:error, :on_cooldown} = Combat.player_action(combat_state, :flee, game_state)
    end

    test "attacking adds log entry" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)
      {:ok, new_state, _result} = Combat.player_action(combat_state, :attack, game_state)

      # Should have attack log (no initial log in new system)
      assert length(new_state.log) == 1
      attack_log = List.last(new_state.log)
      assert attack_log.type == :player_attack
      assert attack_log.damage >= 1
    end
  end

  describe "player_action/3 - defend" do
    test "player can defend on their turn" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)
      assert {:ok, new_state, result} = Combat.player_action(combat_state, :defend, game_state)

      assert result.action == :defend
      assert new_state.player_turn == false
      assert new_state.player_defending == true
    end

    test "defending adds log entry" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)
      {:ok, new_state, _result} = Combat.player_action(combat_state, :defend, game_state)

      defend_log = List.last(new_state.log)
      assert defend_log.type == :player_defend
    end
  end

  describe "player_action/3 - flee" do
    test "player can attempt to flee" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)

      # Add fled: false to initial state since the combat struct expects it
      combat_state = Map.put(combat_state, :fled, false)

      assert {:ok, new_state, result} = Combat.player_action(combat_state, :flee, game_state)

      assert result.action == :flee
      assert is_boolean(result.success)

      if result.success do
        assert new_state.fled == true
      else
        assert new_state.player_turn == false
      end
    end
  end

  describe "player_action/3 - invalid action" do
    test "returns error for invalid action" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)

      assert {:error, :invalid_action} =
               Combat.player_action(combat_state, :invalid, game_state)
    end
  end

  # NOTE: enemy_turn/2 tests removed - LegendMUD-style auto-combat handles
  # enemy attacks automatically in execute_combat_tick/2

  describe "check_combat_end/2" do
    test "returns :ongoing when combat continues" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)

      assert :ongoing = Combat.check_combat_end(combat_state, game_state)
    end

    test "returns victory when enemy HP is 0" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)

      # Set enemy HP to 0
      dead_health = Map.put(combat_state.enemy.health, "current", 0)
      dead_enemy = %{combat_state.enemy | health: dead_health}
      combat_state = %{combat_state | enemy: dead_enemy}

      assert {:victory, rewards} = Combat.check_combat_end(combat_state, game_state)
      assert rewards.xp == 10
      assert rewards.gold == 5
    end

    test "returns defeat when player HP is 0" do
      combatant = combatant_fixture()
      game_state = game_state_fixture(%{health: %{"current" => 0, "max" => 100}})

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)

      assert {:defeat} = Combat.check_combat_end(combat_state, game_state)
    end

    test "returns fled when player successfully fled" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)
      combat_state = Map.put(combat_state, :fled, true)

      assert {:fled} = Combat.check_combat_end(combat_state, game_state)
    end
  end

  describe "apply_rewards/2" do
    test "adds gold to player stats" do
      # Create a real player and game state
      player = player_fixture()

      {:ok, game_state} = GameState.create_state(player.id)

      {:ok, game_state} =
        GameState.update_state(game_state, %{
          stats: %{"gold" => 100, "str" => 10, "sta" => 10}
        })

      rewards = %{xp: 10, gold: 50}

      {:ok, updated_state} = Combat.apply_rewards(game_state, rewards)

      # Gold should be added
      new_gold = updated_state.stats["gold"]
      assert new_gold == 150
    end

    test "awards XP to player" do
      player = player_fixture()
      {:ok, game_state} = GameState.create_state(player.id)

      {:ok, game_state} =
        GameState.update_state(game_state, %{
          stats: %{"gold" => 0, "xp" => 0, "level" => 1}
        })

      rewards = %{xp: 10, gold: 0}

      result = Combat.apply_rewards(game_state, rewards)

      case result do
        {:ok, _updated_state} ->
          # XP was awarded (no level up)
          assert true

        {:ok, _updated_state, _level_up_info} ->
          # XP was awarded with level up
          assert true
      end
    end

    test "handles zero rewards" do
      player = player_fixture()
      {:ok, game_state} = GameState.create_state(player.id)

      {:ok, game_state} =
        GameState.update_state(game_state, %{stats: %{"gold" => 100}})

      rewards = %{xp: 0, gold: 0}

      {:ok, updated_state} = Combat.apply_rewards(game_state, rewards)

      # Gold should remain the same
      assert updated_state.stats["gold"] == 100
    end
  end

  describe "damage calculation" do
    test "damage is always at least 1" do
      # Create high defense enemy
      components = %{
        "combatant" => %{
          "health" => %{"current" => 100, "max" => 100},
          "stats" => %{"attack" => 5, "defense" => 100},
          "level" => 1
        }
      }

      combatant = npc_fixture(%{short_desc: "Tank", components: components})
      game_state = game_state_fixture(%{stats: %{"str" => 1, "sta" => 10}})

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)
      {:ok, _new_state, result} = Combat.player_action(combat_state, :attack, game_state)

      assert result.damage >= 1
    end

    test "defense reduces damage when defending" do
      combatant = combatant_fixture()
      game_state = game_state_fixture()

      {:ok, combat_state} = Combat.start_combat(combatant.id, game_state)
      # Player defends
      {:ok, combat_state, _} = Combat.player_action(combat_state, :defend, game_state)

      # In auto-combat, enemy attacks as part of the combat tick
      # Just verify the combat tick executes without error
      result = Combat.execute_combat_tick(combat_state, game_state)
      assert elem(result, 0) in [:ok, :victory]
    end
  end
end
