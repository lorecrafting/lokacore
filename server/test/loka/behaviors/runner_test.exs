defmodule Loka.Behaviors.RunnerTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Runner
  alias Loka.Engine.Entity

  describe "behavior_key/1" do
    test "extracts key from module name" do
      assert Runner.behavior_key(Loka.Behaviors.Guard) == "guard"
      assert Runner.behavior_key(Loka.Behaviors.TownCrier) == "town_crier"
      assert Runner.behavior_key(Loka.Behaviors.Aggressive) == "aggressive"
    end
  end

  describe "get_config/2" do
    test "returns config from entity components" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test_npc",
        components: %{
          "behavior_config" => %{
            "guard" => %{
              "attack_tags" => ["criminal"],
              "shout_on_attack" => "Stop!"
            }
          }
        }
      }

      config = Runner.get_config(entity, Loka.Behaviors.Guard)

      assert config[:attack_tags] == ["criminal"]
      assert config[:shout_on_attack] == "Stop!"
    end

    test "returns empty map for missing config" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test_npc",
        components: %{}
      }

      assert Runner.get_config(entity, Loka.Behaviors.Guard) == %{}
    end

    test "returns empty map for nil components" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test_npc",
        components: nil
      }

      assert Runner.get_config(entity, Loka.Behaviors.Guard) == %{}
    end
  end

  describe "get_config/4" do
    test "returns specific key with default" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test_npc",
        components: %{
          "behavior_config" => %{
            "guard" => %{"wimpy_threshold" => 20}
          }
        }
      }

      assert Runner.get_config(entity, Loka.Behaviors.Guard, :wimpy_threshold) == 20
      assert Runner.get_config(entity, Loka.Behaviors.Guard, :missing, 42) == 42
    end
  end

  describe "has_any_tag?/2" do
    test "returns true when entity has any of the tags" do
      entity = %Entity{id: "test", type: :npc, key: "test", tags: ["criminal"]}

      assert Runner.has_any_tag?(entity, ["criminal", "murderer"])
    end

    test "returns false when entity has none of the tags" do
      entity = %Entity{id: "test", type: :npc, key: "test", tags: ["friendly"]}

      refute Runner.has_any_tag?(entity, ["criminal", "murderer"])
    end

    test "returns false for nil tags" do
      entity = %Entity{id: "test", type: :npc, key: "test", tags: nil}

      refute Runner.has_any_tag?(entity, ["anything"])
    end
  end

  describe "health_percent/1" do
    test "calculates health percentage" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        components: %{
          "combatant" => %{
            "health" => %{"current" => 50, "max" => 100}
          }
        }
      }

      assert Runner.health_percent(entity) == 50.0
    end

    test "returns 0 for entity without health" do
      entity = %Entity{id: "test", type: :npc, key: "test", components: %{}}

      assert Runner.health_percent(entity) == 0
    end

    test "handles zero max health" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        components: %{
          "combatant" => %{"health" => %{"current" => 0, "max" => 0}}
        }
      }

      assert Runner.health_percent(entity) == 0
    end
  end

  describe "get_behavior_state/2" do
    test "returns empty map for missing state" do
      entity = %Entity{id: "test", type: :npc, key: "test", components: %{}}

      assert Runner.get_behavior_state(entity, Loka.Behaviors.Guard) == %{}
    end

    test "returns stored state from components" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        components: %{
          "behavior_state:guard" => %{"counter" => 5}
        }
      }

      state = Runner.get_behavior_state(entity, Loka.Behaviors.Guard)
      assert state["counter"] == 5
    end
  end

  describe "save_behavior_state/3" do
    test "saves state to entity components" do
      entity = %Entity{id: "test", type: :npc, key: "test", components: %{}}

      updated = Runner.save_behavior_state(entity, Loka.Behaviors.Guard, %{counter: 10})

      assert updated.components["behavior_state:guard"] == %{counter: 10}
    end

    test "preserves other components" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        components: %{"other" => "data"}
      }

      updated = Runner.save_behavior_state(entity, Loka.Behaviors.Guard, %{x: 1})

      assert updated.components["other"] == "data"
      assert updated.components["behavior_state:guard"] == %{x: 1}
    end
  end
end
