defmodule Exmud.Framework.Combat.TacticalTest do
  use ExUnit.Case, async: false

  alias Exmud.Framework.Combat.Tactical
  alias Exmud.Framework.Combat.Tactical.CombatState

  # Start a fresh GenServer for each test with unique name
  setup do
    name = :"tactical_test_#{System.unique_integer([:positive])}"
    {:ok, pid} = Tactical.start_link(name: name)
    on_exit(fn -> Process.exit(pid, :normal) end)
    {:ok, server: name}
  end

  describe "CombatState struct" do
    test "has expected default values" do
      state = %CombatState{}
      assert state.id == nil
      assert state.combatants == []
      assert state.turn_order == []
      assert state.current_turn == nil
      assert state.round == 1
      assert state.combo_chain == []
      assert state.log == []
    end
  end

  describe "get_config/1" do
    test "returns default configuration", %{server: server} do
      config = Tactical.get_config(server)
      assert config.initiative == true
      assert config.action_points == 3
      assert config.combo_system == true
      assert config.elemental_system == true
      assert config.action_costs.attack == 1
      assert config.action_costs.ability == 2
      assert config.action_costs.defend == 1
      assert config.action_costs.flee == 2
    end
  end

  describe "calculate_initiative/1" do
    test "sorts combatants by dexterity" do
      combatants = [
        %{entity_id: "low_dex", stats: %{dex: 5}},
        %{entity_id: "high_dex", stats: %{dex: 20}},
        %{entity_id: "mid_dex", stats: %{dex: 12}}
      ]

      order = Tactical.calculate_initiative(combatants)
      # Due to random tiebreakers, we can only verify high_dex is first
      assert hd(order) == "high_dex"
      # And low_dex is last
      assert List.last(order) == "low_dex"
    end

    test "returns entity_ids in order" do
      combatants = [
        %{entity_id: "a", stats: %{dex: 10}},
        %{entity_id: "b", stats: %{dex: 15}}
      ]

      order = Tactical.calculate_initiative(combatants)
      assert is_list(order)
      assert length(order) == 2
      assert "a" in order
      assert "b" in order
    end

    test "handles missing dex with default of 10" do
      combatants = [
        %{entity_id: "no_dex", stats: %{}},
        %{entity_id: "high_dex", stats: %{dex: 20}}
      ]

      order = Tactical.calculate_initiative(combatants)
      assert hd(order) == "high_dex"
    end
  end

  describe "get_action_cost/2" do
    test "returns correct cost for attack", %{server: server} do
      assert Tactical.get_action_cost(:attack, server) == 1
    end

    test "returns correct cost for ability", %{server: server} do
      assert Tactical.get_action_cost(:ability, server) == 2
    end

    test "returns correct cost for defend", %{server: server} do
      assert Tactical.get_action_cost(:defend, server) == 1
    end

    test "returns correct cost for flee", %{server: server} do
      assert Tactical.get_action_cost(:flee, server) == 2
    end

    test "returns correct cost for item", %{server: server} do
      assert Tactical.get_action_cost(:item, server) == 1
    end

    test "returns default 1 for unknown action", %{server: server} do
      assert Tactical.get_action_cost(:unknown_action, server) == 1
    end
  end

  describe "can_act?/3" do
    test "returns true when enough AP", %{server: server} do
      combatant = %{ap: 3}
      assert Tactical.can_act?(combatant, :attack, server) == true
      assert Tactical.can_act?(combatant, :ability, server) == true
    end

    test "returns false when not enough AP", %{server: server} do
      combatant = %{ap: 1}
      assert Tactical.can_act?(combatant, :ability, server) == false
      assert Tactical.can_act?(combatant, :flee, server) == false
    end

    test "returns true at exact AP threshold", %{server: server} do
      combatant = %{ap: 2}
      assert Tactical.can_act?(combatant, :ability, server) == true
      assert Tactical.can_act?(combatant, :flee, server) == true
    end
  end

  describe "consume_ap/3" do
    test "reduces AP by action cost", %{server: server} do
      combatant = %{ap: 3}
      updated = Tactical.consume_ap(combatant, :attack, server)
      assert updated.ap == 2
    end

    test "reduces AP by ability cost", %{server: server} do
      combatant = %{ap: 3}
      updated = Tactical.consume_ap(combatant, :ability, server)
      assert updated.ap == 1
    end

    test "does not go below zero", %{server: server} do
      combatant = %{ap: 1}
      updated = Tactical.consume_ap(combatant, :ability, server)
      assert updated.ap == 0
    end
  end

  describe "reset_ap/2" do
    test "resets AP to max", %{server: server} do
      combatant = %{ap: 0, max_ap: 3}
      updated = Tactical.reset_ap(combatant, server)
      assert updated.ap == 3
    end

    test "uses default from config if max_ap not set", %{server: server} do
      combatant = %{ap: 0}
      updated = Tactical.reset_ap(combatant, server)
      assert updated.ap == 3
    end
  end

  describe "default_max_ap/1" do
    test "returns default max AP from config", %{server: server} do
      assert Tactical.default_max_ap(server) == 3
    end
  end

  describe "combo chain functions" do
    test "add_to_combo_chain adds ability" do
      chain = Tactical.add_to_combo_chain([], "fireball")
      assert chain == ["fireball"]
    end

    test "add_to_combo_chain maintains order" do
      chain =
        []
        |> Tactical.add_to_combo_chain("fireball")
        |> Tactical.add_to_combo_chain("ice_shard")
        |> Tactical.add_to_combo_chain("lightning")

      assert chain == ["fireball", "ice_shard", "lightning"]
    end

    test "add_to_combo_chain respects max length" do
      chain =
        []
        |> Tactical.add_to_combo_chain("a")
        |> Tactical.add_to_combo_chain("b")
        |> Tactical.add_to_combo_chain("c")
        |> Tactical.add_to_combo_chain("d")
        |> Tactical.add_to_combo_chain("e")
        |> Tactical.add_to_combo_chain("f")

      # Default max length is 5, so "a" should be dropped
      assert length(chain) == 5
      assert chain == ["b", "c", "d", "e", "f"]
    end

    test "check_combo returns true when sequence matches" do
      chain = ["fireball", "ice_shard", "lightning"]
      assert Tactical.check_combo(chain, ["fireball", "ice_shard"]) == true
      assert Tactical.check_combo(chain, ["ice_shard", "lightning"]) == true
    end

    test "check_combo returns false when sequence not found" do
      chain = ["fireball", "ice_shard", "lightning"]
      assert Tactical.check_combo(chain, ["lightning", "fireball"]) == false
    end

    test "check_combo returns false when sequence longer than chain" do
      chain = ["fireball"]
      assert Tactical.check_combo(chain, ["fireball", "ice_shard"]) == false
    end

    test "clear_combo_chain returns empty list" do
      chain = Tactical.clear_combo_chain(%{combo_chain: ["a", "b"]})
      assert chain == []
    end
  end

  describe "new_combat/2" do
    test "creates new combat state with combatants", %{server: server} do
      combatants = [
        %{entity_id: "player1", name: "Hero", stats: %{dex: 15}},
        %{entity_id: "enemy1", name: "Goblin", stats: %{dex: 10}}
      ]

      state = Tactical.new_combat(combatants, server)

      assert state.id != nil
      assert String.starts_with?(state.id, "combat_")
      assert length(state.combatants) == 2
      assert state.round == 1
      assert state.combo_chain == []
      assert length(state.log) == 1
    end

    test "initializes combatants with AP", %{server: server} do
      combatants = [%{entity_id: "player1", name: "Hero", stats: %{dex: 10}}]
      state = Tactical.new_combat(combatants, server)

      [c1] = state.combatants
      assert c1.ap == 3
      assert c1.max_ap == 3
    end

    test "sets turn order by initiative", %{server: server} do
      combatants = [
        %{entity_id: "slow", name: "Slow", stats: %{dex: 5}},
        %{entity_id: "fast", name: "Fast", stats: %{dex: 20}}
      ]

      state = Tactical.new_combat(combatants, server)

      # Fast should be first in turn order
      assert hd(state.turn_order) == "fast"
      assert state.current_turn == "fast"
    end
  end

  describe "next_turn/2" do
    test "advances to next combatant", %{server: server} do
      combatants = [
        %{entity_id: "a", name: "A", stats: %{dex: 20}},
        %{entity_id: "b", name: "B", stats: %{dex: 10}}
      ]

      state = Tactical.new_combat(combatants, server)
      # Initial current turn is "a" (higher dex)
      assert state.current_turn == "a"

      # Advance turn
      state = Tactical.next_turn(state, server)
      assert state.current_turn == "b"
      assert state.round == 1
    end

    test "increments round when cycling back to first combatant", %{server: server} do
      combatants = [
        %{entity_id: "a", name: "A", stats: %{dex: 20}},
        %{entity_id: "b", name: "B", stats: %{dex: 10}}
      ]

      state = Tactical.new_combat(combatants, server)
      state = Tactical.next_turn(state, server)
      state = Tactical.next_turn(state, server)

      assert state.current_turn == "a"
      assert state.round == 2
    end

    test "resets AP for next combatant", %{server: server} do
      combatants = [
        %{entity_id: "a", name: "A", stats: %{dex: 20}},
        %{entity_id: "b", name: "B", stats: %{dex: 10}}
      ]

      state = Tactical.new_combat(combatants, server)

      # Consume AP from combatant "b"
      b_combatant = Tactical.get_combatant(state, "b")
      updated_b = %{b_combatant | ap: 0}
      state = Tactical.update_combatant(state, "b", %{ap: updated_b.ap})

      # Advance to "b"
      state = Tactical.next_turn(state, server)

      # Check "b" has full AP again
      b_combatant = Tactical.get_combatant(state, "b")
      assert b_combatant.ap == 3
    end
  end

  describe "get_combatant/2" do
    test "returns combatant by entity_id", %{server: server} do
      combatants = [%{entity_id: "player1", name: "Hero", stats: %{dex: 10}}]
      state = Tactical.new_combat(combatants, server)

      c = Tactical.get_combatant(state, "player1")
      assert c.entity_id == "player1"
      assert c.name == "Hero"
    end

    test "returns nil for unknown entity_id", %{server: server} do
      combatants = [%{entity_id: "player1", name: "Hero", stats: %{dex: 10}}]
      state = Tactical.new_combat(combatants, server)

      assert Tactical.get_combatant(state, "unknown") == nil
    end
  end

  describe "update_combatant/3" do
    test "updates combatant properties", %{server: server} do
      combatants = [%{entity_id: "player1", name: "Hero", stats: %{dex: 10}}]
      state = Tactical.new_combat(combatants, server)

      state = Tactical.update_combatant(state, "player1", %{ap: 0, name: "Updated Hero"})

      c = Tactical.get_combatant(state, "player1")
      assert c.ap == 0
      assert c.name == "Updated Hero"
    end

    test "does not affect other combatants", %{server: server} do
      combatants = [
        %{entity_id: "a", name: "A", stats: %{dex: 10}},
        %{entity_id: "b", name: "B", stats: %{dex: 10}}
      ]

      state = Tactical.new_combat(combatants, server)
      state = Tactical.update_combatant(state, "a", %{ap: 0})

      a = Tactical.get_combatant(state, "a")
      b = Tactical.get_combatant(state, "b")
      assert a.ap == 0
      assert b.ap == 3
    end
  end

  describe "add_log/3" do
    test "adds log entry to combat state", %{server: server} do
      combatants = [%{entity_id: "player1", name: "Hero", stats: %{dex: 10}}]
      state = Tactical.new_combat(combatants, server)

      state = Tactical.add_log(state, "Player attacks!", :player_attack)

      last_log = List.last(state.log)
      assert last_log.text == "Player attacks!"
      assert last_log.type == :player_attack
      assert last_log.round == 1
    end

    test "defaults to :info type", %{server: server} do
      combatants = [%{entity_id: "player1", name: "Hero", stats: %{dex: 10}}]
      state = Tactical.new_combat(combatants, server)

      state = Tactical.add_log(state, "Something happened")

      last_log = List.last(state.log)
      assert last_log.type == :info
    end
  end
end
