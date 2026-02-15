defmodule Loka.Framework.QuestTest do
  use Loka.DataCase

  alias Loka.Framework.Quest
  alias Loka.Engine.Entity
  alias Loka.Engine.Entities

  import Loka.EngineFixtures

  # Helper to create a quest entity in the database
  defp create_quest_entity(attrs \\ %{}) do
    {:ok, entity} =
      Entities.create_entity(%{
        key: attrs[:key] || "test_quest_#{System.unique_integer([:positive])}",
        short_desc: attrs[:name] || "Test Quest",
        extra_desc: attrs[:description] || "A test quest",
        type: "item",
        components:
          attrs[:components] ||
            %{
              "objectives" => [],
              "rewards" => %{}
            },
        tags: ["quest"]
      })

    entity
  end

  describe "delegation to Definitions" do
    test "objective_types/0 is delegated" do
      types = Quest.objective_types()

      assert is_list(types)
      assert :talk in types
      assert :kill in types
      assert :get_item in types
      assert :go_to in types
    end

    test "get_quest_definition/1 is delegated" do
      create_quest_entity(%{
        key: "test_quest",
        name: "Delegated Quest",
        description: "Testing delegation"
      })

      quest = Quest.get_quest_definition("test_quest")

      assert quest != nil
      assert quest.id == "test_quest"
      assert quest.name == "Delegated Quest"
    end
  end

  describe "delegation to Progress" do
    test "accept_quest/2 is delegated" do
      entity = character_fixture()

      create_quest_entity(%{
        key: "delegated_quest",
        components: %{
          "objectives" => [],
          "rewards" => %{}
        }
      })

      assert {:ok, updated_entity} = Quest.accept_quest(entity, "delegated_quest")
      quests = Entity.get_component(updated_entity, "quest_progress")
      assert Map.has_key?(quests["active"], "delegated_quest")
    end

    test "update_progress/2 is delegated" do
      entity = character_fixture()

      create_quest_entity(%{
        key: "progress_quest",
        components: %{
          "objectives" => [
            %{
              "id" => "talk_obj",
              "type" => "talk",
              "description" => "Talk to NPC",
              "target_id" => "npc1",
              "target_count" => 1
            }
          ],
          "rewards" => %{}
        }
      })

      {:ok, entity} = Quest.accept_quest(entity, "progress_quest")

      event = %{type: :talk, target_id: "npc1"}
      assert {:ok, updated_entity, completed} = Quest.update_progress(entity, event)

      assert is_list(completed)
      assert {_quest_id, _obj_id} = hd(completed)

      quests = Entity.get_component(updated_entity, "quest_progress")
      objectives = quests["active"]["progress_quest"]["objectives"]
      assert objectives["talk_obj"]["completed"] == true
    end

    test "complete_objective/3 is delegated" do
      entity = character_fixture()

      create_quest_entity(%{
        key: "manual_quest",
        components: %{
          "objectives" => [
            %{
              "id" => "manual_obj",
              "type" => "talk",
              "description" => "Manual completion",
              "target_id" => "npc1",
              "target_count" => 1
            }
          ],
          "rewards" => %{}
        }
      })

      {:ok, entity} = Quest.accept_quest(entity, "manual_quest")

      assert {:ok, updated_entity} =
               Quest.complete_objective(entity, "manual_quest", "manual_obj")

      quests = Entity.get_component(updated_entity, "quest_progress")
      objectives = quests["active"]["manual_quest"]["objectives"]
      assert objectives["manual_obj"]["completed"] == true
    end

    test "is_complete?/2 is delegated" do
      entity = character_fixture()

      create_quest_entity(%{
        key: "complete_check",
        components: %{"objectives" => [], "rewards" => %{}}
      })

      {:ok, entity} = Quest.accept_quest(entity, "complete_check")

      assert Quest.is_complete?(entity, "complete_check") == true
    end

    test "turn_in_quest/2 is delegated" do
      entity =
        character_fixture(%{
          stats: %{"xp" => 0},
          flags: %{"gold" => 0},
          inventory: []
        })

      create_quest_entity(%{
        key: "turn_in_quest",
        components: %{
          "objectives" => [],
          "rewards" => %{"xp" => 50}
        }
      })

      {:ok, entity} = Quest.accept_quest(entity, "turn_in_quest")

      assert {:ok, updated_entity, rewards} = Quest.turn_in_quest(entity, "turn_in_quest")

      assert rewards["xp"] == 50
      stats = Entity.get_component(updated_entity, "stats")
      assert stats["xp"] == 50
      quests = Entity.get_component(updated_entity, "quest_progress")
      assert "turn_in_quest" in quests["completed"]
    end

    test "get_active_quests/1 is delegated" do
      entity = character_fixture()

      create_quest_entity(%{
        key: "active_quest",
        name: "Active Quest Name",
        components: %{"objectives" => [], "rewards" => %{}}
      })

      {:ok, entity} = Quest.accept_quest(entity, "active_quest")

      quests = Quest.get_active_quests(entity)

      assert length(quests) == 1
      [quest] = quests
      assert quest.id == "active_quest"
      assert quest.name == "Active Quest Name"
    end

    test "get_completed_quests/1 is delegated" do
      entity =
        character_fixture(%{
          quests: %{"active" => %{}, "completed" => ["quest1", "quest2"]}
        })

      completed = Quest.get_completed_quests(entity)

      assert completed == ["quest1", "quest2"]
    end

    test "get_quest_progress/2 is delegated" do
      entity = character_fixture()

      create_quest_entity(%{
        key: "progress_track",
        components: %{"objectives" => [], "rewards" => %{}}
      })

      {:ok, entity} = Quest.accept_quest(entity, "progress_track")

      progress = Quest.get_quest_progress(entity, "progress_track")

      assert progress != nil
      assert is_map(progress)
      assert Map.has_key?(progress, "objectives")
    end
  end

  describe "backwards compatibility structs" do
    test "Quest struct exists with correct fields" do
      quest = %Quest.Quest{
        id: "test",
        name: "Test",
        description: "Test quest"
      }

      assert quest.id == "test"
      assert quest.name == "Test"
      assert quest.description == "Test quest"
      assert quest.objectives == []
      assert quest.rewards == %{}
      assert quest.status == :available
    end

    test "Objective struct exists with correct fields" do
      objective = %Quest.Objective{
        id: "obj1",
        type: :talk,
        description: "Talk to NPC",
        target_id: "npc1"
      }

      assert objective.id == "obj1"
      assert objective.type == :talk
      assert objective.description == "Talk to NPC"
      assert objective.target_id == "npc1"
      assert objective.target_count == 1
      assert objective.completed == false
      assert objective.progress == 0
    end
  end

  describe "integration test: full quest workflow" do
    test "complete workflow from accept to turn in" do
      entity =
        character_fixture(%{
          stats: %{"xp" => 0},
          flags: %{"gold" => 100},
          inventory: []
        })

      # Create a quest with multiple objectives
      create_quest_entity(%{
        key: "epic_quest",
        name: "The Epic Quest",
        description: "Complete this epic quest",
        components: %{
          "objectives" => [
            %{
              "id" => "talk_to_elder",
              "type" => "talk",
              "description" => "Talk to the village elder",
              "target_id" => "elder",
              "target_count" => 1
            },
            %{
              "id" => "kill_monsters",
              "type" => "kill",
              "description" => "Defeat 3 monsters",
              "target_id" => "monster",
              "target_count" => 3
            },
            %{
              "id" => "find_artifact",
              "type" => "get_item",
              "description" => "Find the ancient artifact",
              "target_id" => "artifact",
              "target_count" => 1
            }
          ],
          "rewards" => %{
            "xp" => 500,
            "gold" => 250,
            "items" => ["legendary_sword"]
          }
        }
      })

      # Step 1: Accept the quest
      {:ok, entity} = Quest.accept_quest(entity, "epic_quest")
      active_quests = Quest.get_active_quests(entity)
      assert length(active_quests) == 1
      assert hd(active_quests).is_complete == false

      # Step 2: Complete first objective - talk to elder
      event = %{type: :talk, target_id: "elder"}
      {:ok, entity, completed} = Quest.update_progress(entity, event)
      assert length(completed) == 1
      assert Quest.is_complete?(entity, "epic_quest") == false

      # Step 3: Complete second objective - kill monsters (one by one)
      event = %{type: :kill, target_id: "monster", count: 1}
      {:ok, entity, _} = Quest.update_progress(entity, event)
      {:ok, entity, _} = Quest.update_progress(entity, event)
      {:ok, entity, completed} = Quest.update_progress(entity, event)
      assert length(completed) == 1
      assert Quest.is_complete?(entity, "epic_quest") == false

      # Step 4: Complete third objective - find artifact
      event = %{type: :get_item, target_id: "artifact"}
      {:ok, entity, completed} = Quest.update_progress(entity, event)
      assert length(completed) == 1

      # Check quest is now complete
      assert Quest.is_complete?(entity, "epic_quest") == true

      # Step 5: Turn in the quest
      {:ok, entity, rewards} = Quest.turn_in_quest(entity, "epic_quest")

      # Verify rewards
      assert rewards["xp"] == 500
      assert rewards["gold"] == 250
      assert rewards["items"] == ["legendary_sword"]

      # Verify rewards applied
      stats = Entity.get_component(entity, "stats")
      assert stats["xp"] == 500
      flags = Entity.get_component(entity, "flags")
      assert flags["gold"] == 350
      inventory = Entity.get_component(entity, "inventory")
      assert "legendary_sword" in inventory

      # Verify quest moved to completed
      assert "epic_quest" in Quest.get_completed_quests(entity)
      assert Quest.get_active_quests(entity) == []

      # Verify cannot accept again
      assert {:error, :already_completed} = Quest.accept_quest(entity, "epic_quest")
    end
  end
end
