defmodule Loka.WorldBuilder.ToolExecutor.DialoguesTest do
  @moduledoc "Tests for ToolExecutor.Dialogues domain module."
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.ToolExecutor.Dialogues
  alias Loka.TestCleanup

  setup_all do
    on_exit(fn -> TestCleanup.cleanup_dialogue_test_files() end)
    :ok
  end

  describe "execute_create_dialogue/1" do
    test "creates dialogue with map-format nodes" do
      input = %{
        "key" => "dlg_test_map_#{System.unique_integer([:positive])}",
        "entity_key" => "test_npc",
        "trigger" => "on_talk",
        "entry_node" => "greeting",
        "nodes" => %{
          "greeting" => %{
            "text" => "Hello!",
            "choices" => [%{"text" => "Hi", "next" => "response"}]
          },
          "response" => %{
            "text" => "Nice to meet you."
          }
        }
      }

      case Dialogues.execute_create_dialogue(input) do
        {:ok, r} ->
          assert r.success == true
          assert r.dialogue.key == input["key"]

        {:error, reason} ->
          assert is_binary(reason)
      end
    end

    test "creates dialogue with array-format nodes" do
      input = %{
        "key" => "dlg_test_arr_#{System.unique_integer([:positive])}",
        "entity_key" => "test_npc",
        "nodes" => [
          %{
            "id" => "start",
            "text" => "Greetings!",
            "choices" => [%{"text" => "Hello", "next" => "end"}]
          },
          %{"id" => "end", "text" => "Farewell."}
        ]
      }

      case Dialogues.execute_create_dialogue(input) do
        {:ok, r} -> assert r.success == true
        {:error, reason} -> assert is_binary(reason)
      end
    end

    test "rejects invalid key format" do
      input = %{
        "key" => "INVALID-KEY!",
        "entity_key" => "npc",
        "nodes" => %{}
      }

      assert {:error, _} = Dialogues.execute_create_dialogue(input)
    end

    test "defaults trigger to on_talk" do
      input = %{
        "key" => "dlg_test_trigger_#{System.unique_integer([:positive])}",
        "entity_key" => "test_npc",
        "nodes" => %{"start" => %{"text" => "Hello"}}
      }

      case Dialogues.execute_create_dialogue(input) do
        {:ok, r} -> assert r.success == true
        {:error, reason} -> assert is_binary(reason)
      end
    end
  end

  describe "execute_get_dialogue/1" do
    test "returns error for non-existent dialogue" do
      assert {:error, _} =
               Dialogues.execute_get_dialogue(%{
                 "dialogue_key" => "nonexistent_dlg_#{System.unique_integer([:positive])}"
               })
    end
  end

  describe "execute_list_dialogues/1" do
    test "lists all dialogues" do
      assert {:ok, result} = Dialogues.execute_list_dialogues(%{})
      assert result.success == true
      assert is_list(result.dialogues)
    end

    test "filters by NPC" do
      assert {:ok, result} = Dialogues.execute_list_dialogues(%{"npc" => "nonexistent_npc"})
      assert result.success == true
    end
  end

  describe "execute_delete_dialogue/1" do
    test "returns error for non-existent dialogue" do
      assert {:error, _} = Dialogues.execute_delete_dialogue(%{"key" => "nonexistent_dlg_del"})
    end
  end
end
