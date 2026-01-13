defmodule Loka.Testing.Bot.StrategyTest do
  use ExUnit.Case, async: true

  alias Loka.Testing.Bot.Strategy
  alias Loka.Engine.Entity

  describe "build_context/1" do
    test "builds context with required fields" do
      game_state = %{health: %{current: 100, max: 100}, inventory: []}

      context =
        Strategy.build_context(
          bot: %{id: "bot-1", name: "Test Bot"},
          game_state: game_state,
          room: nil,
          nearby_entities: []
        )

      assert context.bot.id == "bot-1"
      assert context.bot.name == "Test Bot"
      assert context.game_state == game_state
      assert context.room == nil
      assert context.nearby_entities == []
      assert context.in_combat == false
      assert context.combat_state == nil
    end

    test "includes combat state when provided" do
      combat_state = %{enemy: %{name: "Goblin"}, turn: 1}

      context =
        Strategy.build_context(
          bot: %{id: "bot-1", name: "Test Bot"},
          game_state: %{},
          in_combat: true,
          combat_state: combat_state
        )

      assert context.in_combat == true
      assert context.combat_state == combat_state
    end
  end

  describe "get_available_exits/1" do
    test "returns empty list for nil room" do
      assert Strategy.get_available_exits(nil) == []
    end

    test "returns exits from room attributes" do
      room = %Entity{
        id: "room-1",
        type: :room,
        attributes: %{
          "exits" => %{
            "north" => %{"destination_id" => "room-2"},
            "south" => %{"destination_id" => "room-3"}
          }
        }
      }

      exits = Strategy.get_available_exits(room)
      assert "north" in exits
      assert "south" in exits
      assert length(exits) == 2
    end

    test "returns empty list for room without exits" do
      room = %Entity{
        id: "room-1",
        type: :room,
        attributes: %{}
      }

      assert Strategy.get_available_exits(room) == []
    end
  end

  describe "filter_by_type/2" do
    test "filters entities by type" do
      entities = [
        %Entity{id: "1", type: :npc},
        %Entity{id: "2", type: :item},
        %Entity{id: "3", type: :npc},
        %Entity{id: "4", type: :exit}
      ]

      npcs = Strategy.filter_by_type(entities, :npc)
      assert length(npcs) == 2
      assert Enum.all?(npcs, &(&1.type == :npc))
    end
  end

  describe "find_combatants/1" do
    test "finds NPCs with combatant component" do
      entities = [
        %Entity{id: "1", type: :npc, components: %{"combatant" => %{}}},
        %Entity{id: "2", type: :npc, components: %{"dialogue_tree" => %{}}},
        %Entity{id: "3", type: :item, components: %{}},
        %Entity{id: "4", type: :npc, components: %{"combatant" => %{}, "dialogue_tree" => %{}}}
      ]

      combatants = Strategy.find_combatants(entities)
      assert length(combatants) == 2
      assert Enum.all?(combatants, &Map.has_key?(&1.components, "combatant"))
    end

    test "returns empty list when no combatants" do
      entities = [
        %Entity{id: "1", type: :npc, components: %{"dialogue_tree" => %{}}},
        %Entity{id: "2", type: :item, components: %{}}
      ]

      assert Strategy.find_combatants(entities) == []
    end
  end

  describe "find_interactables/1" do
    test "finds NPCs with dialogue_tree and items" do
      entities = [
        %Entity{id: "1", type: :npc, components: %{"dialogue_tree" => %{}}},
        %Entity{id: "2", type: :npc, components: %{"combatant" => %{}}},
        %Entity{id: "3", type: :item, components: %{}},
        %Entity{id: "4", type: :exit, components: %{}}
      ]

      interactables = Strategy.find_interactables(entities)
      assert length(interactables) == 2

      types = Enum.map(interactables, & &1.type)
      assert :npc in types
      assert :item in types
    end
  end

  describe "health_below?/2" do
    test "returns true when health is below threshold" do
      game_state = %{health: %{"current" => 20, "max" => 100}}
      assert Strategy.health_below?(game_state, 30) == true
    end

    test "returns false when health is above threshold" do
      game_state = %{health: %{"current" => 80, "max" => 100}}
      assert Strategy.health_below?(game_state, 30) == false
    end

    test "handles atom keys" do
      game_state = %{health: %{current: 25, max: 100}}
      assert Strategy.health_below?(game_state, 30) == true
    end

    test "handles missing health gracefully" do
      game_state = %{}
      assert Strategy.health_below?(game_state, 30) == false
    end
  end
end
