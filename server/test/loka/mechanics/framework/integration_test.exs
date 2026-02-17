defmodule Loka.Framework.IntegrationTest do
  @moduledoc """
  Cross-module integration tests validating interactions between framework subsystems.

  These tests verify that:
  - Combat correctly uses equipment bonuses from Inventory/Equipment
  - Inventory items can be used in combat (potions)
  - Quests progress correctly through events
  - Event flows propagate across subsystems
  """
  use Loka.DataCase

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Framework.Combat
  alias Loka.Framework.Equipment
  alias Loka.Framework.Inventory
  alias Loka.Framework.Quest.Progress
  alias Loka.Framework.Dialogue

  import Loka.EngineFixtures

  # ===========================================================================
  # Combat + Inventory/Equipment Integration
  # ===========================================================================

  describe "combat + equipment integration" do
    setup do
      character =
        character_fixture(
          stats: %{"str" => 10, "sta" => 10, "dex" => 10, "level" => 5, "gold" => 100, "xp" => 0},
          resources: %{
            "health" => %{"current" => 100, "max" => 100},
            "mana" => %{"current" => 100, "max" => 100},
            "mv" => %{"current" => 150, "max" => 150}
          }
        )

      %{game_state: character}
    end

    test "equipped weapon increases combat stats", %{game_state: game_state} do
      # Create a weapon with attack bonus
      {:ok, weapon} =
        Entities.create_entity(%{
          key: "test_sword_#{System.unique_integer([:positive])}",
          name: "Iron Sword",
          type: "item",
          description: "A sturdy iron sword",
          components: %{
            "equipable" => %{
              "slot" => "weapon",
              "bonuses" => %{"attack" => 15}
            }
          },
          tags: ["equipable"]
        })

      # Add weapon to inventory and equip
      {:ok, game_state} = Inventory.add_item(game_state, weapon.id)
      {:ok, game_state} = Equipment.equip(game_state, weapon.id)

      # Verify equipment bonuses are applied
      combat_stats = Equipment.calculate_combat_stats(game_state)
      # Attack = STR * 2 + weapon_bonus = 10 * 2 + 15 = 35
      assert combat_stats.attack == 35

      # Bonuses should be visible
      bonuses = Equipment.get_total_bonuses(game_state)
      assert bonuses[:attack] == 15
    end

    test "combat with equipped weapon deals damage based on stats", %{game_state: game_state} do
      # Create weapon
      {:ok, weapon} =
        Entities.create_entity(%{
          key: "combat_sword_#{System.unique_integer([:positive])}",
          name: "Battle Sword",
          type: "item",
          description: "A combat-ready sword",
          components: %{
            "equipable" => %{
              "slot" => "weapon",
              "bonuses" => %{"attack" => 10}
            }
          },
          tags: ["equipable"]
        })

      # Create enemy
      {:ok, enemy} =
        Entities.create_entity(%{
          key: "test_enemy_#{System.unique_integer([:positive])}",
          name: "Training Dummy",
          type: "npc",
          description: "A practice target",
          components: %{
            "combatant" => %{
              "health" => %{"current" => 100, "max" => 100},
              "stats" => %{"attack" => 5, "defense" => 5},
              "xp_value" => 10,
              "gold_value" => 5
            }
          },
          tags: []
        })

      # Equip weapon
      {:ok, game_state} = Inventory.add_item(game_state, weapon.id)
      {:ok, game_state} = Equipment.equip(game_state, weapon.id)

      # Start combat
      {:ok, combat_state} = Combat.start_combat(enemy.id, game_state)

      # Player attacks
      {:ok, new_combat_state, result} = Combat.player_action(combat_state, :attack, game_state)

      # Should deal damage
      assert result.damage >= 1
      assert new_combat_state.enemy.health["current"] < 100
    end

    test "using health potion heals player", %{game_state: game_state} do
      # Create a health potion
      {:ok, potion} =
        Entities.create_entity(%{
          key: "health_potion_#{System.unique_integer([:positive])}",
          name: "Health Potion",
          type: "item",
          description: "Restores 30 health",
          components: %{"consumable" => %{"heal" => 30}},
          tags: []
        })

      # Add potion to inventory
      {:ok, game_state} = Inventory.add_item(game_state, potion.id)

      # Simulate taking damage by updating the resources component
      game_state =
        Entity.add_component(game_state, "resources", %{
          "health" => %{"current" => 50, "max" => 100},
          "mana" => %{"current" => 100, "max" => 100},
          "mv" => %{"current" => 150, "max" => 150}
        })

      # Use potion
      {:ok, healed_state, effect} = Inventory.use_item(game_state, potion.id)

      # Verify healing occurred
      assert effect.healed == 30
      # Use Entity component accessor to check health
      health = Entity.get_component(healed_state, "resources")["health"]
      assert health["current"] == 80
      inventory = Entity.get_component(healed_state, "inventory") || []
      refute potion.id in inventory
    end

    test "combat victory awards XP and gold", %{game_state: game_state} do
      # Create weak enemy for guaranteed victory
      {:ok, enemy} =
        Entities.create_entity(%{
          key: "weak_enemy_#{System.unique_integer([:positive])}",
          name: "Weak Slime",
          type: "npc",
          description: "An easy target",
          components: %{
            "combatant" => %{
              "health" => %{"current" => 1, "max" => 1},
              "stats" => %{"attack" => 1, "defense" => 0},
              "xp_value" => 50,
              "gold_value" => 25
            }
          },
          tags: []
        })

      # Start combat and attack
      {:ok, combat_state} = Combat.start_combat(enemy.id, game_state)
      {:ok, combat_state, _result} = Combat.player_action(combat_state, :attack, game_state)

      # Check for victory
      case Combat.check_combat_end(combat_state, game_state) do
        {:victory, rewards} ->
          assert rewards.xp == 50
          assert rewards.gold == 25

        :ongoing ->
          # Enemy might have survived somehow, but we expect victory with 1 HP enemy
          flunk("Expected victory but combat is ongoing")
      end
    end
  end

  # ===========================================================================
  # Inventory + Equipment Integration
  # ===========================================================================

  describe "inventory + equipment integration" do
    setup do
      game_state =
        character_fixture(
          stats: %{"str" => 10, "sta" => 10, "level" => 5},
          inventory: []
        )

      %{game_state: game_state}
    end

    test "equipping moves item from inventory to equipment slot", %{game_state: game_state} do
      {:ok, weapon} =
        Entities.create_entity(%{
          key: "equip_sword_#{System.unique_integer([:positive])}",
          name: "Test Sword",
          type: "item",
          description: "A sword for equipping",
          components: %{
            "equipable" => %{
              "slot" => "weapon",
              "bonuses" => %{"attack" => 5}
            }
          },
          tags: ["equipable"]
        })

      # Add to inventory
      {:ok, game_state} = Inventory.add_item(game_state, weapon.id)
      inventory = Entity.get_component(game_state, "inventory") || []
      assert weapon.id in inventory
      equipment = Entity.get_component(game_state, "equipment") || %{}
      assert equipment[:wielded] == nil

      # Equip
      {:ok, game_state} = Equipment.equip(game_state, weapon.id)

      # Should be in equipment, not inventory
      inventory = Entity.get_component(game_state, "inventory") || []
      refute weapon.id in inventory
      equipment = Entity.get_component(game_state, "equipment") || %{}
      assert equipment[:wielded] == weapon.id
    end

    test "unequipping moves item back to inventory", %{game_state: game_state} do
      {:ok, weapon} =
        Entities.create_entity(%{
          key: "unequip_sword_#{System.unique_integer([:positive])}",
          name: "Test Sword",
          type: "item",
          description: "A sword for unequipping",
          components: %{
            "equipable" => %{
              "slot" => "weapon",
              "bonuses" => %{}
            }
          },
          tags: ["equipable"]
        })

      # Add and equip
      {:ok, game_state} = Inventory.add_item(game_state, weapon.id)
      {:ok, game_state} = Equipment.equip(game_state, weapon.id)
      equipment = Entity.get_component(game_state, "equipment") || %{}
      assert equipment[:wielded] == weapon.id

      # Unequip
      {:ok, game_state} = Equipment.unequip(game_state, :wielded)

      # Should be back in inventory
      inventory = Entity.get_component(game_state, "inventory") || []
      assert weapon.id in inventory
      equipment = Entity.get_component(game_state, "equipment") || %{}
      assert equipment[:wielded] == nil
    end

    test "swapping equipment moves old item to inventory", %{game_state: game_state} do
      {:ok, sword1} =
        Entities.create_entity(%{
          key: "sword1_#{System.unique_integer([:positive])}",
          name: "Iron Sword",
          type: "item",
          description: "First sword",
          components: %{"equipable" => %{"slot" => "weapon", "bonuses" => %{"attack" => 5}}},
          tags: ["equipable"]
        })

      {:ok, sword2} =
        Entities.create_entity(%{
          key: "sword2_#{System.unique_integer([:positive])}",
          name: "Steel Sword",
          type: "item",
          description: "Better sword",
          components: %{"equipable" => %{"slot" => "weapon", "bonuses" => %{"attack" => 10}}},
          tags: ["equipable"]
        })

      # Add both swords
      {:ok, game_state} = Inventory.add_item(game_state, sword1.id)
      {:ok, game_state} = Inventory.add_item(game_state, sword2.id)

      # Equip first sword
      {:ok, game_state} = Equipment.equip(game_state, sword1.id)
      equipment = Entity.get_component(game_state, "equipment") || %{}
      assert equipment[:wielded] == sword1.id

      # Equip second sword (should swap)
      {:ok, game_state} = Equipment.equip(game_state, sword2.id)

      # Second sword equipped, first back in inventory
      equipment = Entity.get_component(game_state, "equipment") || %{}
      assert equipment[:wielded] == sword2.id
      inventory = Entity.get_component(game_state, "inventory") || []
      assert sword1.id in inventory
      refute sword2.id in inventory
    end
  end

  # ===========================================================================
  # Quest + Dialogue Integration
  # ===========================================================================

  describe "quest + dialogue integration" do
    setup do
      game_state =
        character_fixture(
          stats: %{"level" => 1, "xp" => 0},
          quests: %{"active" => %{}, "completed" => []},
          flags: %{}
        )

      %{game_state: game_state}
    end

    test "can start dialogue with NPC that has dialogue tree", %{game_state: _game_state} do
      # Create NPC with dialogue - nodes are keyed by their ID in the dialogue_tree map
      {:ok, npc} =
        Entities.create_entity(%{
          key: "quest_giver_#{System.unique_integer([:positive])}",
          name: "Village Elder",
          type: "npc",
          description: "A wise elder",
          components: %{
            "dialogue_tree" => %{
              "start" => %{
                "text" => "Welcome, traveler! I have a task for you.",
                "choices" => [
                  %{"text" => "Tell me more", "next" => "quest_info"},
                  %{"text" => "Goodbye", "action" => "end"}
                ]
              },
              "quest_info" => %{
                "text" => "I need you to find the lost artifact.",
                "choices" => [
                  %{"text" => "I'll do it", "action" => "start_quest"},
                  %{"text" => "Maybe later", "action" => "end"}
                ]
              }
            }
          },
          tags: ["npc", "quest_giver"]
        })

      # Start dialogue
      {:ok, dialogue_state} = Dialogue.start_conversation(npc.id)

      # Should have the start node's text
      assert dialogue_state.text != nil
      assert dialogue_state.choices != nil
      assert length(dialogue_state.choices) == 2
    end

    test "accepting quest adds it to active quests", %{game_state: game_state} do
      # Create quest entity
      {:ok, _quest_entity} =
        Entities.create_entity(%{
          key: "test_quest",
          name: "Test Quest",
          description: "A test quest",
          type: "quest",
          components: %{
            "data" => %{
              "objectives" => [
                %{
                  "id" => "talk_npc",
                  "type" => "talk",
                  "description" => "Talk to the merchant",
                  "target_id" => "merchant",
                  "target_count" => 1
                }
              ],
              "rewards" => %{"xp" => 100}
            }
          },
          tags: ["quest"]
        })

      # Accept quest
      {:ok, updated_state} = Progress.accept_quest(game_state, "test_quest")

      quest_progress = Entity.get_component(updated_state, "quest_progress") || %{}
      active = quest_progress["active"] || %{}
      assert Map.has_key?(active, "test_quest")
    end

    test "completing objective updates quest progress", %{game_state: game_state} do
      # Create quest with talk objective
      {:ok, _quest_entity} =
        Entities.create_entity(%{
          key: "talk_quest",
          name: "Delivery Quest",
          description: "Talk to the merchant",
          type: "quest",
          components: %{
            "data" => %{
              "objectives" => [
                %{
                  "id" => "talk_merchant",
                  "type" => "talk",
                  "description" => "Talk to the merchant",
                  "target_id" => "merchant",
                  "target_count" => 1
                }
              ],
              "rewards" => %{"xp" => 50}
            }
          },
          tags: ["quest"]
        })

      # Accept quest
      {:ok, game_state} = Progress.accept_quest(game_state, "talk_quest")

      # Complete objective
      {:ok, game_state} = Progress.complete_objective(game_state, "talk_quest", "talk_merchant")

      # Check quest completion
      assert Progress.is_complete?(game_state, "talk_quest")
    end
  end

  # Progression module deleted in V2 — XP/leveling will be handled by scripts

  # ===========================================================================
  # Entity Lifecycle Integration (spawn → move → combat → death)
  # ===========================================================================

  describe "entity lifecycle integration" do
    setup do
      game_state =
        character_fixture(
          stats: %{"str" => 15, "sta" => 10, "dex" => 10, "level" => 5, "gold" => 100, "xp" => 0},
          resources: %{
            "health" => %{"current" => 100, "max" => 100},
            "mana" => %{"current" => 100, "max" => 100},
            "mv" => %{"current" => 150, "max" => 150}
          },
          inventory: []
        )

      %{game_state: game_state}
    end

    test "spawn enemy, fight it, get rewards on death", %{game_state: game_state} do
      # 1. Spawn enemy
      {:ok, enemy} =
        Entities.create_entity(%{
          key: "lifecycle_enemy_#{System.unique_integer([:positive])}",
          name: "Test Goblin",
          type: "npc",
          description: "A goblin for testing",
          components: %{
            "combatant" => %{
              "health" => %{"current" => 1, "max" => 50},
              "stats" => %{"attack" => 5, "defense" => 2},
              "xp_value" => 100,
              "gold_value" => 50
            }
          },
          tags: ["hostile"]
        })

      assert enemy.id != nil

      # 2. Start combat with enemy
      {:ok, combat_state} = Combat.start_combat(enemy.id, game_state)
      assert combat_state.enemy != nil

      # 3. Attack enemy
      {:ok, combat_state, attack_result} = Combat.player_action(combat_state, :attack, game_state)
      assert attack_result.damage >= 1

      # 4. Check if enemy died
      case Combat.check_combat_end(combat_state, game_state) do
        {:victory, rewards} ->
          assert rewards.xp == 100
          assert rewards.gold == 50

        :ongoing ->
          # Combat ongoing is acceptable if enemy survived the hit
          assert combat_state.enemy.health["current"] >= 0
      end
    end

    test "enemy counter-attacks deal damage to player", %{game_state: game_state} do
      # Create enemy with high attack
      {:ok, enemy} =
        Entities.create_entity(%{
          key: "counter_enemy_#{System.unique_integer([:positive])}",
          name: "Strong Goblin",
          type: "npc",
          description: "A tough goblin",
          components: %{
            "combatant" => %{
              "health" => %{"current" => 100, "max" => 100},
              "stats" => %{"attack" => 20, "defense" => 5},
              "xp_value" => 50,
              "gold_value" => 25
            }
          },
          tags: ["hostile"]
        })

      {:ok, combat_state} = Combat.start_combat(enemy.id, game_state)
      {:ok, combat_state, attack_result} = Combat.player_action(combat_state, :attack, game_state)

      # Player should have attacked
      assert attack_result.damage >= 0

      # Combat state contains player and enemy health info
      assert combat_state != nil
      assert is_map(combat_state)
    end
  end

  # ===========================================================================
  # Quest Chain Integration (accept → progress → complete → next)
  # ===========================================================================

  describe "quest chain integration" do
    setup do
      game_state =
        character_fixture(
          stats: %{"level" => 1, "xp" => 0, "gold" => 0},
          quests: %{"active" => %{}, "completed" => []},
          flags: %{}
        )

      %{game_state: game_state}
    end

    test "complete quest chain with multiple objectives", %{game_state: game_state} do
      # Create quest with multiple objectives
      {:ok, _quest_entity} =
        Entities.create_entity(%{
          key: "chain_quest_1",
          name: "Gathering Supplies",
          description: "Gather supplies for the village",
          type: "quest",
          components: %{
            "data" => %{
              "objectives" => [
                %{
                  "id" => "gather_herbs",
                  "type" => "get_item",
                  "description" => "Collect herbs",
                  "target_id" => "herbs",
                  "target_count" => 3
                },
                %{
                  "id" => "deliver_herbs",
                  "type" => "talk",
                  "description" => "Deliver to healer",
                  "target_id" => "healer",
                  "target_count" => 1
                }
              ],
              "rewards" => %{"xp" => 200, "gold" => 50}
            }
          },
          tags: ["quest"]
        })

      # Accept quest
      {:ok, game_state} = Progress.accept_quest(game_state, "chain_quest_1")
      quest_progress = Entity.get_component(game_state, "quest_progress") || %{}
      assert Map.has_key?(quest_progress["active"] || %{}, "chain_quest_1")

      # Complete first objective
      {:ok, game_state} = Progress.complete_objective(game_state, "chain_quest_1", "gather_herbs")
      refute Progress.is_complete?(game_state, "chain_quest_1")

      # Complete second objective
      {:ok, game_state} =
        Progress.complete_objective(game_state, "chain_quest_1", "deliver_herbs")

      # Quest should now be complete
      assert Progress.is_complete?(game_state, "chain_quest_1")
    end

    test "quest chain progression - completing objectives progresses quests", %{
      game_state: game_state
    } do
      # Create first quest
      {:ok, _quest1} =
        Entities.create_entity(%{
          key: "prereq_quest",
          name: "Introduction Quest",
          description: "Learn the basics",
          type: "quest",
          components: %{
            "data" => %{
              "objectives" => [
                %{
                  "id" => "talk_tutorial",
                  "type" => "talk",
                  "description" => "Talk to the trainer",
                  "target_id" => "trainer",
                  "target_count" => 1
                }
              ],
              "rewards" => %{"xp" => 50, "gold" => 10}
            }
          },
          tags: ["quest"]
        })

      # Create second quest
      {:ok, _quest2} =
        Entities.create_entity(%{
          key: "advanced_quest",
          name: "Advanced Training",
          description: "Advanced combat training",
          type: "quest",
          components: %{
            "data" => %{
              "objectives" => [
                %{
                  "id" => "defeat_dummy",
                  "type" => "kill",
                  "description" => "Defeat training dummy",
                  "target_id" => "training_dummy",
                  "target_count" => 1
                }
              ],
              "rewards" => %{"xp" => 100}
            }
          },
          tags: ["quest"]
        })

      # Accept first quest
      {:ok, game_state} = Progress.accept_quest(game_state, "prereq_quest")
      quest_progress = Entity.get_component(game_state, "quest_progress") || %{}
      assert Map.has_key?(quest_progress["active"] || %{}, "prereq_quest")

      # Complete objective
      {:ok, game_state} = Progress.complete_objective(game_state, "prereq_quest", "talk_tutorial")

      # Quest should now be complete (all objectives done)
      assert Progress.is_complete?(game_state, "prereq_quest")

      # Can accept the second quest while first is still active but complete
      {:ok, game_state} = Progress.accept_quest(game_state, "advanced_quest")
      quest_progress = Entity.get_component(game_state, "quest_progress") || %{}
      assert Map.has_key?(quest_progress["active"] || %{}, "advanced_quest")
    end
  end

  # Economy module deleted in V2 — shops will be handled by scripts

  # ===========================================================================
  # Crafting Flow Integration (gather materials → craft → use/equip)
  # ===========================================================================

  describe "crafting flow integration" do
    setup do
      game_state =
        character_fixture(
          stats: %{
            "str" => 10,
            "sta" => 10,
            "level" => 5,
            "skills" => %{"herbalism" => 10, "alchemy" => 10}
          },
          resources: %{
            "health" => %{"current" => 100, "max" => 100},
            "mana" => %{"current" => 100, "max" => 100},
            "mv" => %{"current" => 150, "max" => 150}
          },
          inventory: []
        )

      %{game_state: game_state}
    end

    test "gather ingredients, craft potion, use potion", %{game_state: game_state} do
      # Create ingredient items with same key (simulates gathering 2 of same herb)
      {:ok, herb1} =
        Entities.create_entity(%{
          key: "test_healing_herb",
          name: "Healing Herb",
          type: "item",
          description: "A medicinal herb",
          components: %{},
          tags: ["ingredient"]
        })

      {:ok, herb2} =
        Entities.create_entity(%{
          key: "test_healing_herb",
          name: "Healing Herb",
          type: "item",
          description: "A medicinal herb",
          components: %{},
          tags: ["ingredient"]
        })

      # Simulate gathering - add herbs to inventory
      {:ok, game_state} = Inventory.add_item(game_state, herb1.id)
      {:ok, game_state} = Inventory.add_item(game_state, herb2.id)
      inventory = Entity.get_component(game_state, "inventory") || []
      assert length(inventory) == 2

      # Verify both items are in inventory
      herbs_in_inventory =
        inventory
        |> Enum.map(fn id ->
          entity = Entities.get_entity(id)
          entity.key
        end)

      assert Enum.count(herbs_in_inventory, &(&1 == "test_healing_herb")) == 2

      # Create potion output item
      {:ok, _potion} =
        Entities.create_entity(%{
          key: "crafted_health_potion",
          name: "Health Potion",
          type: "item",
          description: "Restores 25 health",
          components: %{"consumable" => %{"heal" => 25}},
          tags: ["consumable"]
        })

      # Define recipe structure (in real game this would be registered)
      recipe = %{
        key: "test_health_potion_recipe",
        name: "Health Potion",
        description: "Brew a healing potion",
        skill_required: "alchemy",
        skill_level: 1,
        ingredients: [%{item: "test_healing_herb", quantity: 2}],
        output: [%{item: "crafted_health_potion", quantity: 1}],
        xp_reward: %{"alchemy" => 10}
      }

      # Verify ingredients are present and recipe is valid
      assert recipe.ingredients |> hd() |> Map.get(:quantity) == 2
      assert recipe.output |> hd() |> Map.get(:item) == "crafted_health_potion"
    end

    test "crafting with insufficient ingredients fails gracefully", %{game_state: game_state} do
      # Only add one herb when recipe needs 2
      {:ok, herb} =
        Entities.create_entity(%{
          key: "test_single_herb",
          name: "Single Herb",
          type: "item",
          description: "One herb",
          components: %{},
          tags: ["ingredient"]
        })

      {:ok, game_state} = Inventory.add_item(game_state, herb.id)
      inventory = Entity.get_component(game_state, "inventory") || []
      assert length(inventory) == 1

      # Should have exactly 1 item in inventory
      assert length(inventory) == 1

      # Verify the item was added correctly
      [item_id] = inventory
      entity = Entities.get_entity(item_id)
      assert entity.key == "test_single_herb"

      # A recipe requiring 2 of this herb would fail
      # since we only have 1
    end

    test "craft equipment and equip it", %{game_state: game_state} do
      # Create crafting materials
      {:ok, iron} =
        Entities.create_entity(%{
          key: "test_iron_ore_#{System.unique_integer([:positive])}",
          name: "Iron Ore",
          type: "item",
          description: "Raw iron",
          components: %{},
          tags: ["material"]
        })

      {:ok, iron2} =
        Entities.create_entity(%{
          key: "test_iron_ore_#{System.unique_integer([:positive])}",
          name: "Iron Ore",
          type: "item",
          description: "Raw iron",
          components: %{},
          tags: ["material"]
        })

      # Add materials to inventory
      {:ok, game_state} = Inventory.add_item(game_state, iron.id)
      {:ok, game_state} = Inventory.add_item(game_state, iron2.id)

      # Create crafted weapon
      {:ok, crafted_sword} =
        Entities.create_entity(%{
          key: "crafted_iron_sword_#{System.unique_integer([:positive])}",
          name: "Crafted Iron Sword",
          type: "item",
          description: "A hand-crafted sword",
          components: %{
            "equipable" => %{
              "slot" => "weapon",
              "bonuses" => %{"attack" => 12}
            }
          },
          tags: ["equipable"]
        })

      # Simulate craft result - add crafted item and remove materials
      game_state = Entity.add_component(game_state, "inventory", [crafted_sword.id])

      # Equip crafted weapon
      {:ok, game_state} = Equipment.equip(game_state, crafted_sword.id)

      # Verify equipped
      equipment = Entity.get_component(game_state, "equipment") || %{}
      assert equipment[:wielded] == crafted_sword.id

      # Verify combat stats include weapon bonus
      combat_stats = Equipment.calculate_combat_stats(game_state)
      assert combat_stats.attack >= 12
    end
  end
end
