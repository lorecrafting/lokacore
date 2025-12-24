defmodule Exmud.Framework.QuestTest do
  use Exmud.DataCase

  alias Exmud.Framework.Quest
  alias Exmud.Framework.Player.GameState
  alias Exmud.Engine.Entities

  import Exmud.AccountsFixtures

  # Helper to create a quest entity in the database
  defp create_quest_entity(attrs \\ %{}) do
    {:ok, entity} =
      Entities.create_entity(%{
        key: attrs[:key] || "test_quest_#{System.unique_integer([:positive])}",
        name: attrs[:name] || "Test Quest",
        description: attrs[:description] || "A test quest",
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

  # Helper to create a game state for testing
  defp game_state_fixture(player_id, attrs \\ %{}) do
    {:ok, state} = GameState.create_state(player_id)

    if map_size(attrs) > 0 do
      {:ok, state} = GameState.update_state(state, attrs)
      state
    else
      state
    end
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
      player = player_fixture()
      state = game_state_fixture(player.id)

      create_quest_entity(%{
        key: "delegated_quest",
        components: %{
          "objectives" => [],
          "rewards" => %{}
        }
      })

      assert {:ok, updated_state} = Quest.accept_quest(state, "delegated_quest")
      assert Map.has_key?(updated_state.quests["active"], "delegated_quest")
    end

    test "update_progress/2 is delegated" do
      player = player_fixture()
      state = game_state_fixture(player.id)

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

      {:ok, state} = Quest.accept_quest(state, "progress_quest")

      event = %{type: :talk, target_id: "npc1"}
      assert {:ok, updated_state, completed} = Quest.update_progress(state, event)

      assert is_list(completed)
      assert {_quest_id, _obj_id} = hd(completed)

      objectives = updated_state.quests["active"]["progress_quest"]["objectives"]
      assert objectives["talk_obj"]["completed"] == true
    end

    @tag :skip
    test "complete_objective/3 is delegated" do
      player = player_fixture()
      state = game_state_fixture(player.id)

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

      {:ok, state} = Quest.accept_quest(state, "manual_quest")

      assert {:ok, updated_state} = Quest.complete_objective(state, "manual_quest", "manual_obj")

      objectives = updated_state.quests["active"]["manual_quest"]["objectives"]
      assert objectives["manual_obj"]["completed"] == true
    end

    test "is_complete?/2 is delegated" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      create_quest_entity(%{
        key: "complete_check",
        components: %{"objectives" => [], "rewards" => %{}}
      })

      {:ok, state} = Quest.accept_quest(state, "complete_check")

      assert Quest.is_complete?(state, "complete_check") == true
    end

    @tag :skip
    test "turn_in_quest/2 is delegated" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
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

      {:ok, state} = Quest.accept_quest(state, "turn_in_quest")

      assert {:ok, updated_state, rewards} = Quest.turn_in_quest(state, "turn_in_quest")

      assert rewards["xp"] == 50
      assert updated_state.stats["xp"] == 50
      assert "turn_in_quest" in updated_state.quests["completed"]
    end

    test "get_active_quests/1 is delegated" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      create_quest_entity(%{
        key: "active_quest",
        name: "Active Quest Name",
        components: %{"objectives" => [], "rewards" => %{}}
      })

      {:ok, state} = Quest.accept_quest(state, "active_quest")

      quests = Quest.get_active_quests(state)

      assert length(quests) == 1
      [quest] = quests
      assert quest.id == "active_quest"
      assert quest.name == "Active Quest Name"
    end

    test "get_completed_quests/1 is delegated" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          quests: %{"active" => %{}, "completed" => ["quest1", "quest2"]}
        })

      completed = Quest.get_completed_quests(state)

      assert completed == ["quest1", "quest2"]
    end

    test "get_quest_progress/2 is delegated" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      create_quest_entity(%{
        key: "progress_track",
        components: %{"objectives" => [], "rewards" => %{}}
      })

      {:ok, state} = Quest.accept_quest(state, "progress_track")

      progress = Quest.get_quest_progress(state, "progress_track")

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
    @tag :skip
    test "complete workflow from accept to turn in" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
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
      {:ok, state} = Quest.accept_quest(state, "epic_quest")
      active_quests = Quest.get_active_quests(state)
      assert length(active_quests) == 1
      assert hd(active_quests).is_complete == false

      # Step 2: Complete first objective - talk to elder
      event = %{type: :talk, target_id: "elder"}
      {:ok, state, completed} = Quest.update_progress(state, event)
      assert length(completed) == 1
      assert Quest.is_complete?(state, "epic_quest") == false

      # Step 3: Complete second objective - kill monsters (one by one)
      event = %{type: :kill, target_id: "monster", count: 1}
      {:ok, state, _} = Quest.update_progress(state, event)
      {:ok, state, _} = Quest.update_progress(state, event)
      {:ok, state, completed} = Quest.update_progress(state, event)
      assert length(completed) == 1
      assert Quest.is_complete?(state, "epic_quest") == false

      # Step 4: Complete third objective - find artifact
      event = %{type: :get_item, target_id: "artifact"}
      {:ok, state, completed} = Quest.update_progress(state, event)
      assert length(completed) == 1

      # Check quest is now complete
      assert Quest.is_complete?(state, "epic_quest") == true

      # Step 5: Turn in the quest
      {:ok, state, rewards} = Quest.turn_in_quest(state, "epic_quest")

      # Verify rewards
      assert rewards["xp"] == 500
      assert rewards["gold"] == 250
      assert rewards["items"] == ["legendary_sword"]

      # Verify rewards applied
      assert state.stats["xp"] == 500
      assert state.flags["gold"] == 350
      assert "legendary_sword" in state.inventory

      # Verify quest moved to completed
      assert "epic_quest" in Quest.get_completed_quests(state)
      assert Quest.get_active_quests(state) == []

      # Verify cannot accept again
      assert {:error, :already_completed} = Quest.accept_quest(state, "epic_quest")
    end
  end
end
