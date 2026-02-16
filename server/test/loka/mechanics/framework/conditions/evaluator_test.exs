defmodule Loka.Framework.Conditions.EvaluatorTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Conditions.Evaluator
  alias Loka.Engine.Entity

  # =============================================================================
  # Test Fixtures
  # =============================================================================

  defp entity_with(overrides \\ %{}) do
    base_components = %{
      "flags" => %{},
      "quest_progress" => %{"active" => %{}, "completed" => []},
      "stats" => %{"level" => 1, "str" => 10, "dex" => 10, "sta" => 10},
      "inventory" => [],
      "equipment" => %{}
    }

    components =
      Enum.reduce(overrides, base_components, fn
        {:flags, val}, acc -> Map.put(acc, "flags", val)
        {:quests, val}, acc -> Map.put(acc, "quest_progress", val)
        {:stats, val}, acc -> Map.put(acc, "stats", val)
        {:inventory, val}, acc -> Map.put(acc, "inventory", val)
        {:equipment, val}, acc -> Map.put(acc, "equipment", val)
        _, acc -> acc
      end)

    %Entity{
      id: "test-entity-id",
      type: "character",
      key: "test_char",
      short_desc: "Test Character",
      components: components,
      account_id: 1,
      tags: [],
      scripts: %{},
      metadata: %{}
    }
  end

  # =============================================================================
  # Flag Conditions
  # =============================================================================

  describe "flag conditions" do
    test "returns true when flag is set to true" do
      state = entity_with(flags: %{"spoke_to_elder" => true})
      assert Evaluator.evaluate({:flag, "spoke_to_elder"}, state) == true
    end

    test "returns true when flag is set to any truthy value" do
      state = entity_with(flags: %{"visited_count" => 5})
      assert Evaluator.evaluate({:flag, "visited_count"}, state) == true
    end

    test "returns false when flag is not set" do
      state = entity_with(flags: %{})
      assert Evaluator.evaluate({:flag, "spoke_to_elder"}, state) == false
    end

    test "returns false when flag is set to false" do
      state = entity_with(flags: %{"spoke_to_elder" => false})
      assert Evaluator.evaluate({:flag, "spoke_to_elder"}, state) == false
    end

    test "returns false when flag is nil" do
      state = entity_with(flags: %{"spoke_to_elder" => nil})
      assert Evaluator.evaluate({:flag, "spoke_to_elder"}, state) == false
    end

    test "handles atom keys in flags map" do
      state = entity_with(flags: %{spoke_to_elder: true})
      assert Evaluator.evaluate({:flag, "spoke_to_elder"}, state) == true
    end

    test "handles nil flags map" do
      state = entity_with(flags: nil)
      assert Evaluator.evaluate({:flag, "spoke_to_elder"}, state) == false
    end
  end

  # =============================================================================
  # Quest Completion Conditions
  # =============================================================================

  describe "quest_completed condition" do
    test "returns true when quest is in completed list" do
      state = entity_with(quests: %{"completed" => ["monastery_arc", "intro_quest"]})
      assert Evaluator.evaluate({:quest_completed, "monastery_arc"}, state) == true
    end

    test "returns false when quest is not in completed list" do
      state = entity_with(quests: %{"completed" => ["intro_quest"]})
      assert Evaluator.evaluate({:quest_completed, "monastery_arc"}, state) == false
    end

    test "returns false when completed list is empty" do
      state = entity_with(quests: %{"completed" => []})
      assert Evaluator.evaluate({:quest_completed, "monastery_arc"}, state) == false
    end

    test "returns false when quests map has no completed key" do
      state = entity_with(quests: %{})
      assert Evaluator.evaluate({:quest_completed, "monastery_arc"}, state) == false
    end
  end

  describe "quest_not_completed condition" do
    test "returns true when quest is not in completed list" do
      state = entity_with(quests: %{"completed" => ["intro_quest"]})
      assert Evaluator.evaluate({:quest_not_completed, "monastery_arc"}, state) == true
    end

    test "returns false when quest is in completed list" do
      state = entity_with(quests: %{"completed" => ["monastery_arc"]})
      assert Evaluator.evaluate({:quest_not_completed, "monastery_arc"}, state) == false
    end

    test "returns true when completed list is empty" do
      state = entity_with(quests: %{"completed" => []})
      assert Evaluator.evaluate({:quest_not_completed, "monastery_arc"}, state) == true
    end
  end

  # =============================================================================
  # Quest Active Conditions
  # =============================================================================

  describe "quest_active condition" do
    test "returns true when quest is in active map" do
      state =
        entity_with(
          quests: %{
            "active" => %{"main_quest" => %{"objectives" => %{}}}
          }
        )

      assert Evaluator.evaluate({:quest_active, "main_quest"}, state) == true
    end

    test "returns false when quest is not in active map" do
      state = entity_with(quests: %{"active" => %{}})
      assert Evaluator.evaluate({:quest_active, "main_quest"}, state) == false
    end

    test "returns false when active map is empty" do
      state = entity_with(quests: %{"active" => %{}})
      assert Evaluator.evaluate({:quest_active, "main_quest"}, state) == false
    end
  end

  describe "quest_not_active condition" do
    test "returns true when quest is not in active map" do
      state = entity_with(quests: %{"active" => %{}})
      assert Evaluator.evaluate({:quest_not_active, "main_quest"}, state) == true
    end

    test "returns false when quest is in active map" do
      state =
        entity_with(
          quests: %{
            "active" => %{"main_quest" => %{"objectives" => %{}}}
          }
        )

      assert Evaluator.evaluate({:quest_not_active, "main_quest"}, state) == false
    end
  end

  # =============================================================================
  # Level Conditions
  # =============================================================================

  describe "level_gte condition" do
    test "returns true when player level >= threshold" do
      state = entity_with(stats: %{"level" => 5})
      assert Evaluator.evaluate({:level_gte, 5}, state) == true
    end

    test "returns true when player level > threshold" do
      state = entity_with(stats: %{"level" => 10})
      assert Evaluator.evaluate({:level_gte, 5}, state) == true
    end

    test "returns false when player level < threshold" do
      state = entity_with(stats: %{"level" => 3})
      assert Evaluator.evaluate({:level_gte, 5}, state) == false
    end

    test "defaults to level 1 when stats is nil" do
      state = entity_with(stats: nil)
      assert Evaluator.evaluate({:level_gte, 1}, state) == true
      assert Evaluator.evaluate({:level_gte, 2}, state) == false
    end

    test "handles atom key for level" do
      state = entity_with(stats: %{level: 5})
      assert Evaluator.evaluate({:level_gte, 5}, state) == true
    end
  end

  # =============================================================================
  # Item Conditions
  # =============================================================================

  describe "has_item / item_has conditions" do
    test "returns true when item string is in inventory list" do
      state = entity_with(inventory: ["sword_01", "potion_02"])
      assert Evaluator.evaluate({:has_item, "sword_01"}, state) == true
      assert Evaluator.evaluate({:item_has, "sword_01"}, state) == true
    end

    test "returns false when item is not in inventory" do
      state = entity_with(inventory: ["potion_02"])
      assert Evaluator.evaluate({:has_item, "sword_01"}, state) == false
    end

    test "returns false when inventory is empty" do
      state = entity_with(inventory: [])
      assert Evaluator.evaluate({:has_item, "sword_01"}, state) == false
    end

    test "returns false when inventory is nil" do
      state = entity_with(inventory: nil)
      assert Evaluator.evaluate({:has_item, "sword_01"}, state) == false
    end

    test "handles inventory items as maps with key field" do
      state =
        entity_with(
          inventory: [
            %{"key" => "sword_01", "quantity" => 1},
            %{"key" => "potion_02", "quantity" => 5}
          ]
        )

      assert Evaluator.evaluate({:has_item, "sword_01"}, state) == true
    end

    test "handles inventory items as maps with id field" do
      state =
        entity_with(
          inventory: [
            %{"id" => "sword_01", "name" => "Iron Sword"}
          ]
        )

      assert Evaluator.evaluate({:has_item, "sword_01"}, state) == true
    end

    test "handles inventory items as maps with atom keys" do
      state =
        entity_with(
          inventory: [
            %{key: "sword_01", quantity: 1}
          ]
        )

      assert Evaluator.evaluate({:has_item, "sword_01"}, state) == true
    end
  end

  describe "not_has_item condition" do
    test "returns true when item is not in inventory" do
      state = entity_with(inventory: ["potion_02"])
      assert Evaluator.evaluate({:not_has_item, "sword_01"}, state) == true
    end

    test "returns false when item is in inventory" do
      state = entity_with(inventory: ["sword_01"])
      assert Evaluator.evaluate({:not_has_item, "sword_01"}, state) == false
    end

    test "returns true when inventory is empty" do
      state = entity_with(inventory: [])
      assert Evaluator.evaluate({:not_has_item, "sword_01"}, state) == true
    end
  end

  # =============================================================================
  # Stat Conditions
  # =============================================================================

  describe "stat_gte condition" do
    test "returns true when stat >= threshold" do
      state = entity_with(stats: %{"str" => 15})
      assert Evaluator.evaluate({:stat_gte, "str", 10}, state) == true
    end

    test "returns true when stat == threshold" do
      state = entity_with(stats: %{"str" => 10})
      assert Evaluator.evaluate({:stat_gte, "str", 10}, state) == true
    end

    test "returns false when stat < threshold" do
      state = entity_with(stats: %{"str" => 5})
      assert Evaluator.evaluate({:stat_gte, "str", 10}, state) == false
    end

    test "defaults to 0 when stat is not present" do
      state = entity_with(stats: %{})
      assert Evaluator.evaluate({:stat_gte, "str", 0}, state) == true
      assert Evaluator.evaluate({:stat_gte, "str", 1}, state) == false
    end

    test "handles atom keys in stats" do
      state = entity_with(stats: %{str: 15})
      assert Evaluator.evaluate({:stat_gte, "str", 10}, state) == true
    end
  end

  # =============================================================================
  # Faction Conditions
  # =============================================================================

  describe "faction_gte condition" do
    test "returns true when faction reputation >= threshold" do
      state = entity_with(flags: %{"faction_monastery" => 50})
      assert Evaluator.evaluate({:faction_gte, "monastery", 50}, state) == true
    end

    test "returns true when faction reputation > threshold" do
      state = entity_with(flags: %{"faction_monastery" => 100})
      assert Evaluator.evaluate({:faction_gte, "monastery", 50}, state) == true
    end

    test "returns false when faction reputation < threshold" do
      state = entity_with(flags: %{"faction_monastery" => 25})
      assert Evaluator.evaluate({:faction_gte, "monastery", 50}, state) == false
    end

    test "defaults to 0 when faction not present" do
      state = entity_with(flags: %{})
      assert Evaluator.evaluate({:faction_gte, "monastery", 0}, state) == true
      assert Evaluator.evaluate({:faction_gte, "monastery", 1}, state) == false
    end
  end

  # =============================================================================
  # Input Format Normalization
  # =============================================================================

  describe "string map format (from YAML)" do
    test "normalizes flag condition" do
      state = entity_with(flags: %{"test_flag" => true})
      assert Evaluator.evaluate(%{"flag" => "test_flag"}, state) == true
    end

    test "normalizes quest_completed condition" do
      state = entity_with(quests: %{"completed" => ["main_quest"]})
      assert Evaluator.evaluate(%{"quest_completed" => "main_quest"}, state) == true
    end

    test "normalizes quest_active condition" do
      state = entity_with(quests: %{"active" => %{"main_quest" => %{}}})
      assert Evaluator.evaluate(%{"quest_active" => "main_quest"}, state) == true
    end

    test "normalizes level_gte condition" do
      state = entity_with(stats: %{"level" => 5})
      assert Evaluator.evaluate(%{"level_gte" => 5}, state) == true
    end

    test "normalizes has_item condition" do
      state = entity_with(inventory: ["sword"])
      assert Evaluator.evaluate(%{"has_item" => "sword"}, state) == true
    end

    test "normalizes stat_gte condition with nested map" do
      state = entity_with(stats: %{"str" => 15})
      condition = %{"stat_gte" => %{"stat" => "str", "value" => 10}}
      assert Evaluator.evaluate(condition, state) == true
    end

    test "normalizes faction_gte condition with nested map" do
      state = entity_with(flags: %{"faction_monastery" => 50})
      condition = %{"faction_gte" => %{"faction" => "monastery", "value" => 50}}
      assert Evaluator.evaluate(condition, state) == true
    end
  end

  describe "atom map format" do
    test "normalizes flag condition" do
      state = entity_with(flags: %{"test_flag" => true})
      assert Evaluator.evaluate(%{flag: "test_flag"}, state) == true
    end

    test "normalizes quest_completed condition" do
      state = entity_with(quests: %{"completed" => ["main_quest"]})
      assert Evaluator.evaluate(%{quest_completed: "main_quest"}, state) == true
    end

    test "normalizes level_gte condition" do
      state = entity_with(stats: %{"level" => 5})
      assert Evaluator.evaluate(%{level_gte: 5}, state) == true
    end
  end

  describe "type-based format" do
    test "normalizes default type" do
      state = entity_with()
      assert Evaluator.evaluate(%{"type" => "default"}, state) == true
    end

    test "normalizes flag type" do
      state = entity_with(flags: %{"test" => true})
      assert Evaluator.evaluate(%{"type" => "flag", "flag" => "test"}, state) == true
    end

    test "normalizes quest_completed type" do
      state = entity_with(quests: %{"completed" => ["main"]})
      condition = %{"type" => "quest_completed", "quest_id" => "main"}
      assert Evaluator.evaluate(condition, state) == true
    end

    test "normalizes quest_active type" do
      state = entity_with(quests: %{"active" => %{"main" => %{}}})
      condition = %{"type" => "quest_active", "quest_id" => "main"}
      assert Evaluator.evaluate(condition, state) == true
    end

    test "normalizes level_gte type" do
      state = entity_with(stats: %{"level" => 5})
      condition = %{"type" => "level_gte", "level" => 5}
      assert Evaluator.evaluate(condition, state) == true
    end

    test "normalizes item_has type" do
      state = entity_with(inventory: ["sword"])
      condition = %{"type" => "item_has", "item_id" => "sword"}
      assert Evaluator.evaluate(condition, state) == true
    end
  end

  describe "string tuple format (from map iteration)" do
    test "normalizes string key tuple" do
      state = entity_with(flags: %{"test" => true})
      assert Evaluator.evaluate({"flag", "test"}, state) == true
    end

    test "normalizes stat_gte with list value" do
      state = entity_with(stats: %{"str" => 15})
      assert Evaluator.evaluate({"stat_gte", ["str", 10]}, state) == true
    end

    test "normalizes faction_gte with list value" do
      state = entity_with(flags: %{"faction_monastery" => 50})
      assert Evaluator.evaluate({"faction_gte", ["monastery", 50]}, state) == true
    end
  end

  # =============================================================================
  # Evaluate All (AND logic)
  # =============================================================================

  describe "evaluate_all/2" do
    test "returns true when all conditions pass" do
      state =
        entity_with(
          flags: %{"flag1" => true, "flag2" => true},
          stats: %{"level" => 5}
        )

      conditions = [
        {:flag, "flag1"},
        {:flag, "flag2"},
        {:level_gte, 5}
      ]

      assert Evaluator.evaluate_all(conditions, state) == true
    end

    test "returns false when any condition fails" do
      state =
        entity_with(
          flags: %{"flag1" => true},
          stats: %{"level" => 3}
        )

      conditions = [
        {:flag, "flag1"},
        {:level_gte, 5}
      ]

      assert Evaluator.evaluate_all(conditions, state) == false
    end

    test "returns true for empty list" do
      state = entity_with()
      assert Evaluator.evaluate_all([], state) == true
    end

    test "returns true for nil" do
      state = entity_with()
      assert Evaluator.evaluate_all(nil, state) == true
    end
  end

  # =============================================================================
  # Evaluate Any (OR logic)
  # =============================================================================

  describe "evaluate_any/2" do
    test "returns true when any condition passes" do
      state =
        entity_with(
          flags: %{"flag1" => false},
          stats: %{"level" => 5}
        )

      conditions = [
        {:flag, "flag1"},
        {:level_gte, 5}
      ]

      assert Evaluator.evaluate_any(conditions, state) == true
    end

    test "returns false when all conditions fail" do
      state =
        entity_with(
          flags: %{"flag1" => false},
          stats: %{"level" => 3}
        )

      conditions = [
        {:flag, "flag1"},
        {:level_gte, 5}
      ]

      assert Evaluator.evaluate_any(conditions, state) == false
    end

    test "returns false for empty list" do
      state = entity_with()
      assert Evaluator.evaluate_any([], state) == false
    end

    test "returns false for nil" do
      state = entity_with()
      assert Evaluator.evaluate_any(nil, state) == false
    end
  end

  # =============================================================================
  # Evaluate Show If (map-based AND)
  # =============================================================================

  describe "evaluate_show_if/2" do
    test "returns true for nil condition" do
      state = entity_with()
      assert Evaluator.evaluate_show_if(nil, state) == true
    end

    test "returns true when all map conditions pass" do
      state =
        entity_with(
          flags: %{"flag1" => true},
          quests: %{"completed" => ["quest1"]}
        )

      condition = %{
        "flag" => "flag1",
        "quest_completed" => "quest1"
      }

      assert Evaluator.evaluate_show_if(condition, state) == true
    end

    test "returns false when any map condition fails" do
      state =
        entity_with(
          flags: %{"flag1" => true},
          quests: %{"completed" => []}
        )

      condition = %{
        "flag" => "flag1",
        "quest_completed" => "quest1"
      }

      assert Evaluator.evaluate_show_if(condition, state) == false
    end

    test "handles single key map" do
      state = entity_with(quests: %{"active" => %{"main" => %{}}})
      condition = %{"quest_active" => "main"}
      assert Evaluator.evaluate_show_if(condition, state) == true
    end
  end

  # =============================================================================
  # Edge Cases and Defaults
  # =============================================================================

  describe "default and edge cases" do
    test ":default atom returns true" do
      state = entity_with()
      assert Evaluator.evaluate(:default, state) == true
    end

    test "nil returns true (permissive default)" do
      state = entity_with()
      assert Evaluator.evaluate(nil, state) == true
    end

    test "unknown condition format logs warning and returns true" do
      state = entity_with()
      assert Evaluator.evaluate(%{"unknown_type" => "value"}, state) == true
    end

    test "handles empty Entity fields gracefully" do
      state = entity_with(flags: nil, quests: nil, stats: nil, inventory: nil)

      assert Evaluator.evaluate({:flag, "test"}, state) == false
      assert Evaluator.evaluate({:quest_completed, "test"}, state) == false
      assert Evaluator.evaluate({:quest_active, "test"}, state) == false
      assert Evaluator.evaluate({:level_gte, 1}, state) == true
      assert Evaluator.evaluate({:has_item, "test"}, state) == false
    end
  end

  # =============================================================================
  # Real-World Dialogue Conditions (Integration-Style)
  # =============================================================================

  describe "real-world dialogue show_if patterns" do
    test "shows dialogue when quest is active" do
      state =
        entity_with(
          quests: %{
            "active" => %{"intro_find_temple" => %{"objectives" => %{}}}
          }
        )

      condition = %{"quest_active" => "intro_find_temple"}
      assert Evaluator.evaluate_show_if(condition, state) == true
    end

    test "shows dialogue after quest completion" do
      state =
        entity_with(
          quests: %{
            "completed" => ["intro_find_temple"]
          }
        )

      condition = %{"quest_completed" => "intro_find_temple"}
      assert Evaluator.evaluate_show_if(condition, state) == true
    end

    test "hides dialogue when quest not started" do
      state =
        entity_with(
          quests: %{
            "active" => %{},
            "completed" => []
          }
        )

      condition = %{"quest_active" => "intro_find_temple"}
      assert Evaluator.evaluate_show_if(condition, state) == false
    end

    test "combined conditions for quest turn-in dialogue" do
      state =
        entity_with(
          quests: %{
            "active" => %{
              "main_sleeping_master" => %{
                "objectives" => %{
                  "obj1" => %{"completed" => true},
                  "obj2" => %{"completed" => true}
                }
              }
            },
            "completed" => []
          },
          flags: %{"objectives_complete_main_sleeping_master" => true}
        )

      condition = %{
        "quest_active" => "main_sleeping_master",
        "flag" => "objectives_complete_main_sleeping_master"
      }

      assert Evaluator.evaluate_show_if(condition, state) == true
    end
  end
end
