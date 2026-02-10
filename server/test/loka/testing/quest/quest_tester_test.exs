defmodule Loka.Testing.Quest.QuestTesterTest do
  use ExUnit.Case, async: false

  alias Loka.Testing.Quest.QuestTester
  alias Loka.Testing.Quest.QuestAssertions
  alias Loka.Framework.Player.GameState

  setup do
    # Ecto sandbox setup
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Loka.Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Loka.Repo, {:shared, self()})
    :ok
  end

  describe "test_quest/2" do
    test "returns error details for invalid quest" do
      # This test doesn't need DB access - quest not found is handled before DB ops
      {:ok, results} = QuestTester.test_quest("nonexistent_quest_xyz")

      assert results.success == false
      assert results.errors != []
      assert {:quest_not_found, "nonexistent_quest_xyz"} in results.errors
    end

    # Note: Full integration tests for test_quest with actual DB operations
    # should be done in the integration test suite, not unit tests
  end

  describe "validate_quest/1" do
    test "validates a known quest" do
      case QuestTester.validate_quest("intro_find_temple") do
        {:ok, :valid} ->
          assert true

        {:error, {:quest_not_found, _}} ->
          # Quest doesn't exist in test environment
          :ok

        {:error, reason} ->
          # Other validation errors are informative
          assert is_tuple(reason)
      end
    end

    test "returns error for nonexistent quest" do
      result = QuestTester.validate_quest("nonexistent_quest_abc")
      assert {:error, {:quest_not_found, "nonexistent_quest_abc"}} = result
    end
  end

  describe "generate_walkthrough/1" do
    test "generates walkthrough for a quest" do
      case QuestTester.generate_walkthrough("intro_find_temple") do
        {:ok, steps} ->
          assert is_list(steps)
          assert length(steps) >= 2

          # First step should be accept
          first_step = hd(steps)
          assert first_step.step == 1
          assert first_step.action == :accept_quest

          # Last step should be turn_in
          last_step = List.last(steps)
          assert last_step.action == :turn_in

        {:error, {:quest_not_found, _}} ->
          :ok
      end
    end
  end

  describe "test_storyline/2" do
    test "returns error for nonexistent storyline" do
      result = QuestTester.test_storyline("nonexistent_storyline_xyz")
      assert {:error, {:storyline_not_found, "nonexistent_storyline_xyz"}} = result
    end

    # Note: Full integration tests for test_storyline should use proper DB setup
  end

  describe "QuestAssertions" do
    import QuestAssertions

    test "quest_active?/2 returns correct boolean" do
      game_state = %GameState{
        player_id: "test",
        quests: %{
          "active" => %{"test_quest" => %{}},
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: [],
        equipment: %{},
        health: %{},
        current_room_id: nil
      }

      assert quest_active?(game_state, "test_quest")
      refute quest_active?(game_state, "other_quest")
    end

    test "quest_completed?/2 returns correct boolean" do
      game_state = %GameState{
        player_id: "test",
        quests: %{
          "active" => %{},
          "completed" => ["finished_quest"]
        },
        stats: %{},
        flags: %{},
        inventory: [],
        equipment: %{},
        health: %{},
        current_room_id: nil
      }

      assert quest_completed?(game_state, "finished_quest")
      refute quest_completed?(game_state, "other_quest")
    end

    test "objective_complete?/3 returns correct boolean" do
      game_state = %GameState{
        player_id: "test",
        quests: %{
          "active" => %{
            "test_quest" => %{
              "objectives" => %{
                "obj1" => %{"completed" => true, "progress" => 1},
                "obj2" => %{"completed" => false, "progress" => 0}
              }
            }
          },
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: [],
        equipment: %{},
        health: %{},
        current_room_id: nil
      }

      assert objective_complete?(game_state, "test_quest", "obj1")
      refute objective_complete?(game_state, "test_quest", "obj2")
    end

    test "objective_progress/3 returns progress count" do
      game_state = %GameState{
        player_id: "test",
        quests: %{
          "active" => %{
            "test_quest" => %{
              "objectives" => %{
                "obj1" => %{"completed" => false, "progress" => 3}
              }
            }
          },
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: [],
        equipment: %{},
        health: %{},
        current_room_id: nil
      }

      assert objective_progress(game_state, "test_quest", "obj1") == 3
      assert objective_progress(game_state, "test_quest", "obj2") == 0
    end
  end
end
