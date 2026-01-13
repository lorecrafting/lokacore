defmodule Loka.Behaviors.BaseTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Base
  alias Loka.Engine.Entity

  describe "behavior_key/1" do
    test "extracts key from module name" do
      assert Base.behavior_key(Loka.Behaviors.Guard) == "guard"
      assert Base.behavior_key(Loka.Behaviors.TownCrier) == "town_crier"
      assert Base.behavior_key(Loka.Behaviors.Aggressive) == "aggressive"
    end
  end

  describe "get_config/2" do
    test "returns config from entity attributes" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test_npc",
        attributes: %{
          "behavior_config" => %{
            "guard" => %{
              "attack_tags" => ["criminal"],
              "shout_on_attack" => "Stop!"
            }
          }
        }
      }

      config = Base.get_config(entity, Loka.Behaviors.Guard)

      assert config[:attack_tags] == ["criminal"]
      assert config[:shout_on_attack] == "Stop!"
    end

    test "returns empty map for missing config" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test_npc",
        attributes: %{}
      }

      config = Base.get_config(entity, Loka.Behaviors.Guard)

      assert config == %{}
    end

    test "handles atom keys in attributes" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test_npc",
        attributes: %{
          behavior_config: %{
            guard: %{
              attack_tags: ["hostile"]
            }
          }
        }
      }

      config = Base.get_config(entity, Loka.Behaviors.Guard)

      assert config[:attack_tags] == ["hostile"]
    end
  end

  describe "has_tag?/2" do
    test "returns true when entity has tag" do
      entity = %Entity{id: "test", type: :npc, key: "test", tags: ["hostile", "monster"]}

      assert Base.has_tag?(entity, "hostile")
      assert Base.has_tag?(entity, "monster")
    end

    test "returns false when entity doesn't have tag" do
      entity = %Entity{id: "test", type: :npc, key: "test", tags: ["friendly"]}

      refute Base.has_tag?(entity, "hostile")
    end

    test "returns false for nil tags" do
      entity = %Entity{id: "test", type: :npc, key: "test", tags: nil}

      refute Base.has_tag?(entity, "anything")
    end
  end

  describe "has_any_tag?/2" do
    test "returns true when entity has any of the tags" do
      entity = %Entity{id: "test", type: :npc, key: "test", tags: ["criminal"]}

      assert Base.has_any_tag?(entity, ["criminal", "murderer"])
    end

    test "returns false when entity has none of the tags" do
      entity = %Entity{id: "test", type: :npc, key: "test", tags: ["friendly"]}

      refute Base.has_any_tag?(entity, ["criminal", "murderer"])
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

      assert Base.health_percent(entity) == 50.0
    end

    test "returns 0 for entity without health" do
      entity = %Entity{id: "test", type: :npc, key: "test", components: %{}}

      assert Base.health_percent(entity) == 0
    end
  end
end
