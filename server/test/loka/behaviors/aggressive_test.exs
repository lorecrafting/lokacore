defmodule Loka.Behaviors.AggressiveTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Aggressive
  alias Loka.Engine.Entity

  defp make_npc(config_overrides \\ %{}) do
    config = Map.merge(%{}, config_overrides)

    %Entity{
      id: "npc1",
      type: :npc,
      key: "goblin",
      location_id: "room1",
      components: %{
        "behavior_config" => %{"aggressive" => config}
      }
    }
  end

  describe "on_event/3 with :entity_entered" do
    test "attacks player characters" do
      npc = make_npc()
      player = %Entity{id: "p1", type: :character, key: "player", tags: []}

      assert {:halt, returned} = Aggressive.on_event(npc, :entity_entered, %{entity: player})
      assert returned.id == "npc1"
    end

    test "ignores non-character entities" do
      npc = make_npc()
      other_npc = %Entity{id: "n2", type: :npc, key: "other", tags: []}

      assert {:ok, _} = Aggressive.on_event(npc, :entity_entered, %{entity: other_npc})
    end

    test "ignores entities with ignored tags" do
      npc = make_npc(%{"ignore_tags" => ["sneaking"]})
      sneaky = %Entity{id: "p1", type: :character, key: "player", tags: ["sneaking"]}

      assert {:ok, _} = Aggressive.on_event(npc, :entity_entered, %{entity: sneaky})
    end

    test "respects target_level_range" do
      npc = make_npc(%{"target_level_range" => [5, 10]})

      low_level = %Entity{
        id: "p1",
        type: :character,
        key: "player",
        tags: [],
        components: %{"progression" => %{"level" => 2}}
      }

      assert {:ok, _} = Aggressive.on_event(npc, :entity_entered, %{entity: low_level})

      in_range = %Entity{
        id: "p2",
        type: :character,
        key: "player2",
        tags: [],
        components: %{"progression" => %{"level" => 7}}
      }

      assert {:halt, _} = Aggressive.on_event(npc, :entity_entered, %{entity: in_range})
    end

    test "ignores nil entered entity" do
      npc = make_npc()

      assert {:ok, _} = Aggressive.on_event(npc, :entity_entered, %{entity: nil})
    end
  end

  describe "on_event/3 with :damage_taken" do
    test "flees when health below wimpy threshold" do
      npc = %Entity{
        id: "npc1",
        type: :npc,
        key: "goblin",
        components: %{
          "combatant" => %{"health" => %{"current" => 10, "max" => 100}},
          "behavior_config" => %{"aggressive" => %{"wimpy_threshold" => 20}}
        }
      }

      assert {:halt, _} = Aggressive.on_event(npc, :damage_taken, %{})
    end

    test "does not flee when wimpy_threshold is 0" do
      npc = %Entity{
        id: "npc1",
        type: :npc,
        key: "goblin",
        components: %{
          "combatant" => %{"health" => %{"current" => 5, "max" => 100}},
          "behavior_config" => %{"aggressive" => %{}}
        }
      }

      assert {:ok, _} = Aggressive.on_event(npc, :damage_taken, %{})
    end
  end

  describe "on_event/3 with other events" do
    test "passes through unhandled events" do
      npc = make_npc()

      assert {:ok, _} = Aggressive.on_event(npc, :tick, %{})
    end
  end
end
