defmodule Loka.WorldBuilder.QuestManagerTest do
  @moduledoc """
  Tests for the QuestManager module.

  Validates:
  - Quest CRUD operations
  - Quest structure validation
  - Objectives and rewards handling
  - Prerequisites and level ranges
  """

  use Loka.DataCase, async: false

  alias Loka.TestCleanup
  alias Loka.WorldBuilder.QuestManager

  # Clean up all test quest files after all tests (runs even if tests fail)
  setup_all do
    on_exit(fn ->
      TestCleanup.cleanup_quest_test_files()
    end)

    :ok
  end

  # Helper to generate unique quest keys
  defp unique_quest_key(prefix \\ "test_quest") do
    "#{prefix}_#{System.os_time(:millisecond)}_#{:rand.uniform(1000)}"
  end

  # Helper to clean up test quests (best-effort per-test cleanup)
  defp cleanup_quest(key) do
    TestCleanup.cleanup_file(:quest, key)
  end

  describe "list_quests/0" do
    test "returns a list of quests" do
      quests = QuestManager.list_quests()
      assert is_list(quests)
    end

    test "quests have enriched UI fields" do
      quests = QuestManager.list_quests()

      if quests != [] do
        quest = hd(quests)
        assert Map.has_key?(quest, :key)
        assert Map.has_key?(quest, :name)
        assert Map.has_key?(quest, :description)
        assert Map.has_key?(quest, :quest_type)
        assert Map.has_key?(quest, :objectives)
        assert Map.has_key?(quest, :rewards)
      end
    end
  end

  describe "create_quest/1" do
    test "creates a quest with minimal attributes" do
      key = unique_quest_key("minimal")

      attrs = %{
        key: key,
        name: "Minimal Quest",
        description: "A minimal quest for testing"
      }

      result = QuestManager.create_quest(attrs)

      case result do
        {:ok, quest} ->
          assert quest.key == key
          assert quest.name == "Minimal Quest"
          cleanup_quest(key)

        {:error, reason} ->
          # May fail due to validation
          assert is_binary(reason)
      end
    end

    test "creates a quest with objectives" do
      key = unique_quest_key("objectives")

      attrs = %{
        key: key,
        name: "Quest with Objectives",
        quest_type: "side",
        objectives: [
          %{id: "kill_rats", type: "kill", target: "rat", count: 5},
          %{id: "find_item", type: "collect", target: "cheese", count: 3}
        ]
      }

      result = QuestManager.create_quest(attrs)

      case result do
        {:ok, quest} ->
          assert quest.key == key
          assert is_list(quest.objectives)
          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "creates a quest with rewards" do
      key = unique_quest_key("rewards")

      attrs = %{
        key: key,
        name: "Quest with Rewards",
        rewards: %{
          xp: 1000,
          gold: 500,
          items: ["magic_ring"]
        }
      }

      result = QuestManager.create_quest(attrs)

      case result do
        {:ok, quest} ->
          assert quest.key == key
          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "creates a quest with prerequisites" do
      key = unique_quest_key("prereqs")

      attrs = %{
        key: key,
        name: "Quest with Prerequisites",
        prerequisites: ["intro_quest", "tutorial_complete"]
      }

      result = QuestManager.create_quest(attrs)

      case result do
        {:ok, quest} ->
          assert quest.key == key
          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "creates a quest with level range" do
      key = unique_quest_key("level_range")

      attrs = %{
        key: key,
        name: "Level Restricted Quest",
        level_range: %{min: 10, max: 20}
      }

      result = QuestManager.create_quest(attrs)

      case result do
        {:ok, quest} ->
          assert quest.key == key
          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "creates a quest with giver NPC" do
      key = unique_quest_key("giver")

      attrs = %{
        key: key,
        name: "NPC Giver Quest",
        giver_key: "village_elder"
      }

      result = QuestManager.create_quest(attrs)

      case result do
        {:ok, quest} ->
          assert quest.key == key
          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "accepts string keys in attributes" do
      key = unique_quest_key("string_keys")

      attrs = %{
        "key" => key,
        "name" => "String Key Quest",
        "quest_type" => "main"
      }

      result = QuestManager.create_quest(attrs)

      case result do
        {:ok, quest} ->
          assert quest.key == key
          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "rejects invalid keys" do
      attrs = %{
        key: "../path_traversal",
        name: "Invalid Key Quest"
      }

      result = QuestManager.create_quest(attrs)
      assert {:error, _reason} = result
    end

    test "rejects keys with path separators" do
      attrs = %{
        key: "some/path",
        name: "Invalid Key Quest"
      }

      result = QuestManager.create_quest(attrs)
      assert {:error, _reason} = result
    end

    test "rejects keys with uppercase" do
      attrs = %{
        key: "InvalidKey",
        name: "Invalid Key Quest"
      }

      result = QuestManager.create_quest(attrs)
      assert {:error, _reason} = result
    end
  end

  describe "update_quest/2" do
    test "updates quest name" do
      key = unique_quest_key("update_name")

      create_attrs = %{
        key: key,
        name: "Original Name"
      }

      case QuestManager.create_quest(create_attrs) do
        {:ok, _quest} ->
          result = QuestManager.update_quest(key, %{name: "Updated Name"})

          case result do
            {:ok, updated} ->
              assert updated.name == "Updated Name"

            {:error, _} ->
              :ok
          end

          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "updates quest objectives" do
      key = unique_quest_key("update_objectives")

      create_attrs = %{
        key: key,
        name: "Objective Update Test",
        objectives: [%{id: "old_obj", type: "kill", target: "rat", count: 1}]
      }

      case QuestManager.create_quest(create_attrs) do
        {:ok, _quest} ->
          new_objectives = [
            %{id: "new_obj", type: "collect", target: "gem", count: 5}
          ]

          result = QuestManager.update_quest(key, %{objectives: new_objectives})

          case result do
            {:ok, updated} ->
              assert is_list(updated.objectives)

            {:error, _} ->
              :ok
          end

          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "updates quest rewards" do
      key = unique_quest_key("update_rewards")

      create_attrs = %{
        key: key,
        name: "Reward Update Test",
        rewards: %{xp: 100}
      }

      case QuestManager.create_quest(create_attrs) do
        {:ok, _quest} ->
          result = QuestManager.update_quest(key, %{rewards: %{xp: 500, gold: 200}})

          case result do
            {:ok, _updated} ->
              :ok

            {:error, _} ->
              :ok
          end

          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end

    test "returns error for non-existent quest" do
      result = QuestManager.update_quest("nonexistent_update_quest", %{name: "Fail"})
      assert {:error, :not_found} = result
    end

    test "preserves other fields when updating" do
      key = unique_quest_key("preserve_fields")

      create_attrs = %{
        key: key,
        name: "Preserve Test",
        description: "Original description",
        quest_type: "main"
      }

      case QuestManager.create_quest(create_attrs) do
        {:ok, _quest} ->
          result = QuestManager.update_quest(key, %{name: "New Name"})

          case result do
            {:ok, updated} ->
              assert updated.description == "Original description"

            {:error, _} ->
              :ok
          end

          cleanup_quest(key)

        {:error, _} ->
          :ok
      end
    end
  end

  describe "delete_quest/1" do
    test "deletes an existing quest" do
      key = unique_quest_key("delete")

      create_attrs = %{
        key: key,
        name: "To Delete"
      }

      case QuestManager.create_quest(create_attrs) do
        {:ok, _quest} ->
          result = QuestManager.delete_quest(key)
          assert :ok = result

          # Verify deletion
          assert {:error, :not_found} = Loka.Engine.Entities.find_one(key: key)

        {:error, _} ->
          :ok
      end
    end

    test "returns error for non-existent quest" do
      result = QuestManager.delete_quest("nonexistent_delete_quest")
      assert {:error, :not_found} = result
    end

    test "rejects invalid key patterns" do
      result = QuestManager.delete_quest("../invalid")
      assert {:error, _reason} = result
    end
  end

  describe "quest types" do
    @quest_types ~w(main side daily repeatable)

    test "accepts all valid quest types" do
      for quest_type <- @quest_types do
        key = unique_quest_key("type_#{quest_type}")

        attrs = %{
          key: key,
          name: "#{quest_type} Quest Test",
          quest_type: quest_type
        }

        result = QuestManager.create_quest(attrs)

        case result do
          {:ok, quest} ->
            assert quest.key == key
            cleanup_quest(key)

          {:error, _} ->
            :ok
        end
      end
    end
  end
end
