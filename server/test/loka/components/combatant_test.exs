defmodule Loka.Components.CombatantTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Combatant
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :npc, key: "test", components: components)
  end

  describe "base accessors" do
    test "get/1 returns component data" do
      e = entity(%{"combatant" => %{"health" => 50}})
      assert Combatant.get(e) == %{"health" => 50}
    end

    test "get/1 returns nil when missing" do
      assert Combatant.get(entity()) == nil
    end

    test "has?/1" do
      assert Combatant.has?(entity(%{"combatant" => %{}}))
      refute Combatant.has?(entity())
    end

    test "put/2 sets component" do
      e = Combatant.put(entity(), %{"health" => 100})
      assert Combatant.get(e) == %{"health" => 100}
    end

    test "component_key/0" do
      assert Combatant.component_key() == "combatant"
    end
  end

  describe "domain accessors" do
    test "health/1 and max_health/1" do
      e = entity(%{"combatant" => %{"health" => 80, "max_health" => 100}})
      assert Combatant.health(e) == 80
      assert Combatant.max_health(e) == 100
    end

    test "health defaults to 0 when missing" do
      assert Combatant.health(entity()) == 0
    end

    test "attack/1 and defense/1" do
      e = entity(%{"combatant" => %{"attack" => 10, "defense" => 5}})
      assert Combatant.attack(e) == 10
      assert Combatant.defense(e) == 5
    end

    test "level/1 defaults to 1" do
      assert Combatant.level(entity()) == 1
    end
  end

  describe "mutations" do
    test "set_health/2" do
      e = entity(%{"combatant" => %{"health" => 50}})
      updated = Combatant.set_health(e, 30)
      assert Combatant.health(updated) == 30
    end

    test "set_health/2 on entity without combatant component" do
      updated = Combatant.set_health(entity(), 50)
      assert Combatant.health(updated) == 50
    end

    test "alive?/1" do
      assert Combatant.alive?(entity(%{"combatant" => %{"health" => 1}}))
      refute Combatant.alive?(entity(%{"combatant" => %{"health" => 0}}))
      refute Combatant.alive?(entity())
    end

    test "heal/2 clamps to max_health" do
      e = entity(%{"combatant" => %{"health" => 80, "max_health" => 100}})
      assert Combatant.health(Combatant.heal(e, 10)) == 90
      assert Combatant.health(Combatant.heal(e, 50)) == 100
    end

    test "damage/2 clamps to 0" do
      e = entity(%{"combatant" => %{"health" => 30}})
      assert Combatant.health(Combatant.damage(e, 10)) == 20
      assert Combatant.health(Combatant.damage(e, 50)) == 0
    end
  end

  describe "state machine" do
    alias Loka.Engine.StateMachine

    test "machine/0 returns a StateMachine struct" do
      machine = Combatant.machine()
      assert %StateMachine{} = machine
      assert machine.initial == "idle"
    end

    test "valid combat transitions" do
      machine = Combatant.machine()
      assert {:ok, "engaged"} = StateMachine.transition(machine, "idle", "engaged")
      assert {:ok, "dead"} = StateMachine.transition(machine, "engaged", "dead")
      assert {:ok, "respawning"} = StateMachine.transition(machine, "dead", "respawning")
      assert {:ok, "idle"} = StateMachine.transition(machine, "respawning", "idle")
    end

    test "invalid combat transitions rejected" do
      machine = Combatant.machine()
      assert {:error, _} = StateMachine.transition(machine, "idle", "dead")
      assert {:error, _} = StateMachine.transition(machine, "dead", "engaged")
    end
  end
end
