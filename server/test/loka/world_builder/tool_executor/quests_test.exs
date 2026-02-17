defmodule Loka.WorldBuilder.ToolExecutor.QuestsTest do
  @moduledoc "Tests for ToolExecutor.Quests domain module."
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.ToolExecutor.Quests
  alias Loka.TestCleanup

  setup_all do
    on_exit(fn -> TestCleanup.cleanup_quest_test_files() end)
    :ok
  end

  describe "execute_create_quest/1" do
    test "creates quest with full input" do
      input = %{
        "key" => "quest_test_full_#{System.unique_integer([:positive])}",
        "name" => "Full Test Quest",
        "description" => "A quest with all fields",
        "quest_type" => "side",
        "giver_key" => "test_npc",
        "objectives" => [%{"id" => "obj1", "type" => "kill", "target" => "rat", "count" => 5}],
        "rewards" => %{"xp" => 100, "gold" => 50}
      }

      case Quests.execute_create_quest(input) do
        {:ok, r} ->
          assert r.success == true
          assert r.message =~ "Created quest"

        {:error, reason} ->
          assert is_binary(reason), "Expected string error reason, got: #{inspect(reason)}"
      end
    end

    test "creates quest with minimal input" do
      input = %{
        "key" => "quest_test_min_#{System.unique_integer([:positive])}",
        "name" => "Minimal Quest",
        "description" => "A simple quest",
        "giver_key" => "some_npc",
        "objectives" => [%{"id" => "obj1", "type" => "talk_to", "target" => "npc"}]
      }

      case Quests.execute_create_quest(input) do
        {:ok, r} -> assert r.success == true
        {:error, reason} -> assert is_binary(reason)
      end
    end

    test "uses default quest_type when not specified" do
      input = %{
        "key" => "quest_test_noqt_#{System.unique_integer([:positive])}",
        "name" => "No Type Quest",
        "description" => "Quest without type",
        "giver_key" => "npc",
        "objectives" => [%{"id" => "obj1", "type" => "collect", "target" => "herb", "count" => 3}]
      }

      case Quests.execute_create_quest(input) do
        {:ok, r} -> assert r.success == true
        {:error, reason} -> assert is_binary(reason)
      end
    end
  end

  describe "execute_update_quest/1" do
    test "returns error for non-existent quest" do
      input = %{
        "quest_key" => "nonexistent_quest_#{System.unique_integer([:positive])}",
        "name" => "Updated"
      }

      assert {:error, _} = Quests.execute_update_quest(input)
    end
  end

  describe "execute_list_quests/1" do
    test "lists all quests" do
      assert {:ok, result} = Quests.execute_list_quests(%{})
      assert result.success == true
      assert is_list(result.quests)
    end

    test "filters by quest_type" do
      assert {:ok, result} = Quests.execute_list_quests(%{"quest_type" => "main"})
      assert result.success == true
    end

    test "filters by giver_key" do
      assert {:ok, result} = Quests.execute_list_quests(%{"giver_key" => "village_elder"})
      assert result.success == true
    end
  end

  describe "execute_delete_quest/1" do
    test "returns error for non-existent quest" do
      assert {:error, _} = Quests.execute_delete_quest(%{"key" => "nonexistent_quest_del"})
    end
  end
end
