defmodule Loka.Framework.Quest.ProgressTest do
  # async: false to avoid SQLite "Database busy" errors
  use Loka.DataCase, async: false

  alias Loka.Framework.Quest.Progress
  alias Loka.Framework.Player.GameState
  alias Loka.Engine.Entities

  import Loka.AccountsFixtures

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

  # Helper to create a quest with objectives
  defp quest_fixture(quest_id, objectives \\ [], rewards \\ %{}) do
    create_quest_entity(%{
      key: quest_id,
      name: "Test Quest",
      description: "A test quest",
      components: %{
        "objectives" => objectives,
        "rewards" => rewards
      }
    })
  end

  describe "accept_quest/2" do
    test "accepts a new quest successfully" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      quest_fixture("find_treasure", [])

      assert {:ok, updated_state} = Progress.accept_quest(state, "find_treasure")

      active = updated_state.quests["active"]
      assert Map.has_key?(active, "find_treasure")

      quest_data = active["find_treasure"]
      assert quest_data["objectives"] == %{}
      assert quest_data["accepted_at"] != nil
    end

    test "initializes objectives correctly" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("multi_objective", [
        %{
          "id" => "talk",
          "type" => "talk",
          "description" => "Talk to NPC",
          "target_id" => "npc1",
          "target_count" => 1
        },
        %{
          "id" => "kill",
          "type" => "kill",
          "description" => "Kill enemies",
          "target_id" => "goblin",
          "target_count" => 5
        }
      ])

      {:ok, updated_state} = Progress.accept_quest(state, "multi_objective")

      objectives = updated_state.quests["active"]["multi_objective"]["objectives"]
      assert Map.has_key?(objectives, "talk")
      assert Map.has_key?(objectives, "kill")

      assert objectives["talk"] == %{"completed" => false, "progress" => 0}
      assert objectives["kill"] == %{"completed" => false, "progress" => 0}
    end

    test "returns error when quest already active" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      quest_fixture("duplicate_quest", [])

      {:ok, state} = Progress.accept_quest(state, "duplicate_quest")
      assert {:error, :already_active} = Progress.accept_quest(state, "duplicate_quest")
    end

    test "returns error when quest already completed" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      quest_fixture("completed_quest", [])

      # Manually mark as completed
      {:ok, state} =
        GameState.update_state(state, %{
          quests: %{"active" => %{}, "completed" => ["completed_quest"]}
        })

      assert {:error, :already_completed} = Progress.accept_quest(state, "completed_quest")
    end

    test "returns error when quest not found" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :quest_not_found} = Progress.accept_quest(state, "nonexistent")
    end
  end

  describe "update_progress/2" do
    test "updates progress for talk objective" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("talk_quest", [
        %{
          "id" => "talk_obj",
          "type" => "talk",
          "description" => "Talk to blacksmith",
          "target_id" => "blacksmith",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "talk_quest")

      event = %{type: :talk, target_id: "blacksmith"}
      assert {:ok, updated_state, completed} = Progress.update_progress(state, event)

      objectives = updated_state.quests["active"]["talk_quest"]["objectives"]
      assert objectives["talk_obj"]["completed"] == true
      assert objectives["talk_obj"]["progress"] == 1

      assert completed == [{"talk_quest", "talk_obj"}]
    end

    test "updates progress for kill objective with multiple kills" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("kill_quest", [
        %{
          "id" => "kill_goblins",
          "type" => "kill",
          "description" => "Kill 5 goblins",
          "target_id" => "goblin",
          "target_count" => 5
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "kill_quest")

      # Kill first goblin
      event = %{type: :kill, target_id: "goblin", count: 1}
      {:ok, state, completed} = Progress.update_progress(state, event)

      objectives = state.quests["active"]["kill_quest"]["objectives"]
      assert objectives["kill_goblins"]["progress"] == 1
      assert objectives["kill_goblins"]["completed"] == false
      assert completed == []

      # Kill 4 more goblins
      event = %{type: :kill, target_id: "goblin", count: 4}
      {:ok, state, completed} = Progress.update_progress(state, event)

      objectives = state.quests["active"]["kill_quest"]["objectives"]
      assert objectives["kill_goblins"]["progress"] == 5
      assert objectives["kill_goblins"]["completed"] == true
      assert completed == [{"kill_quest", "kill_goblins"}]
    end

    test "updates progress for get_item objective" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("item_quest", [
        %{
          "id" => "get_sword",
          "type" => "get_item",
          "description" => "Get the sword",
          "target_id" => "legendary_sword",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "item_quest")

      event = %{type: :get_item, target_id: "legendary_sword"}
      {:ok, state, completed} = Progress.update_progress(state, event)

      objectives = state.quests["active"]["item_quest"]["objectives"]
      assert objectives["get_sword"]["completed"] == true
      assert completed == [{"item_quest", "get_sword"}]
    end

    test "updates progress for go_to objective" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("location_quest", [
        %{
          "id" => "visit_forest",
          "type" => "go_to",
          "description" => "Visit the dark forest",
          "target_id" => "dark_forest",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "location_quest")

      event = %{type: :go_to, target_id: "dark_forest"}
      {:ok, state, completed} = Progress.update_progress(state, event)

      objectives = state.quests["active"]["location_quest"]["objectives"]
      assert objectives["visit_forest"]["completed"] == true
      assert completed == [{"location_quest", "visit_forest"}]
    end

    test "does not update already completed objectives" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("once_only", [
        %{
          "id" => "talk_once",
          "type" => "talk",
          "description" => "Talk to NPC",
          "target_id" => "npc1",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "once_only")

      # Complete the objective
      event = %{type: :talk, target_id: "npc1"}
      {:ok, state, _} = Progress.update_progress(state, event)

      # Try to update again
      {:ok, state, completed} = Progress.update_progress(state, event)

      objectives = state.quests["active"]["once_only"]["objectives"]
      assert objectives["talk_once"]["progress"] == 1
      assert completed == []
    end

    test "updates multiple quests simultaneously" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("quest1", [
        %{
          "id" => "kill1",
          "type" => "kill",
          "description" => "Kill goblin",
          "target_id" => "goblin",
          "target_count" => 1
        }
      ])

      quest_fixture("quest2", [
        %{
          "id" => "kill2",
          "type" => "kill",
          "description" => "Kill goblin",
          "target_id" => "goblin",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "quest1")
      {:ok, state} = Progress.accept_quest(state, "quest2")

      event = %{type: :kill, target_id: "goblin", count: 1}
      {:ok, state, completed} = Progress.update_progress(state, event)

      # Both quests should be updated
      assert state.quests["active"]["quest1"]["objectives"]["kill1"]["completed"] == true
      assert state.quests["active"]["quest2"]["objectives"]["kill2"]["completed"] == true

      assert length(completed) == 2
    end

    test "does not update progress for wrong target" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("specific_target", [
        %{
          "id" => "kill_goblin",
          "type" => "kill",
          "description" => "Kill goblin",
          "target_id" => "goblin",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "specific_target")

      # Kill wrong enemy
      event = %{type: :kill, target_id: "orc", count: 1}
      {:ok, state, completed} = Progress.update_progress(state, event)

      objectives = state.quests["active"]["specific_target"]["objectives"]
      assert objectives["kill_goblin"]["progress"] == 0
      assert objectives["kill_goblin"]["completed"] == false
      assert completed == []
    end
  end

  describe "complete_objective/3" do
    test "manually completes an objective" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("manual_quest", [
        %{
          "id" => "special_obj",
          "type" => "talk",
          "description" => "Special objective",
          "target_id" => "npc1",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "manual_quest")

      assert {:ok, updated_state} =
               Progress.complete_objective(state, "manual_quest", "special_obj")

      objectives = updated_state.quests["active"]["manual_quest"]["objectives"]
      assert objectives["special_obj"]["completed"] == true
      assert objectives["special_obj"]["progress"] == 1
    end

    test "returns error for inactive quest" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :quest_not_active} =
               Progress.complete_objective(state, "nonexistent", "obj1")
    end

    test "returns error for nonexistent objective" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("has_quest", [])
      {:ok, state} = Progress.accept_quest(state, "has_quest")

      assert {:error, :objective_not_found} =
               Progress.complete_objective(state, "has_quest", "nonexistent_obj")
    end
  end

  describe "is_complete?/2" do
    test "returns false when quest has incomplete objectives" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("incomplete", [
        %{
          "id" => "obj1",
          "type" => "talk",
          "description" => "Talk",
          "target_id" => "npc1",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "incomplete")

      assert Progress.is_complete?(state, "incomplete") == false
    end

    test "returns true when all objectives are complete" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("complete", [
        %{
          "id" => "obj1",
          "type" => "talk",
          "description" => "Talk",
          "target_id" => "npc1",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "complete")

      # Complete the objective
      event = %{type: :talk, target_id: "npc1"}
      {:ok, state, _} = Progress.update_progress(state, event)

      assert Progress.is_complete?(state, "complete") == true
    end

    test "returns false for inactive quest" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Progress.is_complete?(state, "nonexistent") == false
    end

    test "returns true for quest with no objectives" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("empty", [])
      {:ok, state} = Progress.accept_quest(state, "empty")

      assert Progress.is_complete?(state, "empty") == true
    end
  end

  describe "turn_in_quest/2" do
    test "turns in a completed quest and applies rewards" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{"xp" => 0},
          flags: %{"gold" => 0},
          inventory: []
        })

      quest_fixture(
        "reward_quest",
        [
          %{
            "id" => "obj1",
            "type" => "talk",
            "description" => "Talk",
            "target_id" => "npc1",
            "target_count" => 1
          }
        ],
        %{
          "xp" => 100,
          "gold" => 50,
          "items" => ["potion"]
        }
      )

      {:ok, state} = Progress.accept_quest(state, "reward_quest")

      # Complete the quest
      event = %{type: :talk, target_id: "npc1"}
      {:ok, state, _} = Progress.update_progress(state, event)

      # Turn in
      assert {:ok, updated_state, rewards} = Progress.turn_in_quest(state, "reward_quest")

      # Check quest moved to completed
      refute Map.has_key?(updated_state.quests["active"], "reward_quest")
      assert "reward_quest" in updated_state.quests["completed"]

      # Check rewards
      assert rewards["xp"] == 100
      assert rewards["gold"] == 50
      assert rewards["items"] == ["potion"]

      # Check rewards applied
      assert updated_state.stats["xp"] == 100
      assert updated_state.flags["gold"] == 50
      assert "potion" in updated_state.inventory
    end

    test "returns error when quest not complete" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("incomplete", [
        %{
          "id" => "obj1",
          "type" => "talk",
          "description" => "Talk",
          "target_id" => "npc1",
          "target_count" => 1
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "incomplete")

      assert {:error, :quest_not_complete} = Progress.turn_in_quest(state, "incomplete")
    end

    test "returns error for quest not found" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      # Manually add fake quest to active
      {:ok, state} =
        GameState.update_state(state, %{
          quests: %{"active" => %{"fake_quest" => %{"objectives" => %{}}}, "completed" => []}
        })

      assert {:error, :quest_not_found} = Progress.turn_in_quest(state, "fake_quest")
    end

    test "handles empty rewards" do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{"xp" => 50}})

      quest_fixture("no_rewards", [], %{})
      {:ok, state} = Progress.accept_quest(state, "no_rewards")

      assert {:ok, updated_state, rewards} = Progress.turn_in_quest(state, "no_rewards")

      assert rewards == %{}
      # XP unchanged
      assert updated_state.stats["xp"] == 50
    end

    test "handles partial rewards" do
      player = player_fixture()
      state = game_state_fixture(player.id, %{stats: %{"xp" => 0}})

      quest_fixture("partial_rewards", [], %{"xp" => 25})
      {:ok, state} = Progress.accept_quest(state, "partial_rewards")

      assert {:ok, updated_state, _} = Progress.turn_in_quest(state, "partial_rewards")

      assert updated_state.stats["xp"] == 25
    end
  end

  describe "get_active_quests/1" do
    test "returns list of active quests with progress" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture(
        "quest1",
        [
          %{
            "id" => "obj1",
            "type" => "talk",
            "description" => "Talk to NPC",
            "target_id" => "npc1",
            "target_count" => 1
          }
        ],
        %{}
      )

      {:ok, state} = Progress.accept_quest(state, "quest1")

      quests = Progress.get_active_quests(state)

      assert length(quests) == 1
      [quest] = quests

      assert quest.id == "quest1"
      assert quest.name == "Test Quest"
      assert quest.description == "A test quest"
      assert quest.is_complete == false
      assert quest.accepted_at != nil

      assert length(quest.objectives) == 1
      [obj] = quest.objectives
      assert obj.id == "obj1"
      assert obj.type == :talk
      assert obj.progress == 0
      assert obj.completed == false
    end

    test "returns empty list when no active quests" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Progress.get_active_quests(state) == []
    end

    test "shows updated progress in active quests" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("progress_quest", [
        %{
          "id" => "kill_obj",
          "type" => "kill",
          "description" => "Kill 5 goblins",
          "target_id" => "goblin",
          "target_count" => 5
        }
      ])

      {:ok, state} = Progress.accept_quest(state, "progress_quest")

      # Make some progress
      event = %{type: :kill, target_id: "goblin", count: 3}
      {:ok, state, _} = Progress.update_progress(state, event)

      quests = Progress.get_active_quests(state)
      [quest] = quests

      [obj] = quest.objectives
      assert obj.progress == 3
      assert obj.completed == false
      assert quest.is_complete == false
    end
  end

  describe "get_completed_quests/1" do
    test "returns list of completed quest IDs" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          quests: %{"active" => %{}, "completed" => ["quest1", "quest2", "quest3"]}
        })

      completed = Progress.get_completed_quests(state)

      assert completed == ["quest1", "quest2", "quest3"]
    end

    test "returns empty list when no completed quests" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Progress.get_completed_quests(state) == []
    end
  end

  describe "get_quest_progress/2" do
    test "returns progress for active quest" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      quest_fixture("tracked_quest", [])
      {:ok, state} = Progress.accept_quest(state, "tracked_quest")

      progress = Progress.get_quest_progress(state, "tracked_quest")

      assert progress != nil
      assert progress["objectives"] == %{}
      assert progress["accepted_at"] != nil
    end

    test "returns nil for inactive quest" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Progress.get_quest_progress(state, "nonexistent") == nil
    end
  end
end
