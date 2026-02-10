defmodule Loka.WorldBuilder.DialogueManagerTest do
  use ExUnit.Case, async: false

  alias Loka.TestCleanup
  alias Loka.WorldBuilder.DialogueManager

  @dialogues_dir Path.join([:code.priv_dir(:loka), "world", "drafts", "dialogues"])

  setup do
    on_exit(fn ->
      TestCleanup.cleanup_dialogue_test_files()
      Loka.Engine.TypedObject.Loader.reload()
    end)

    :ok
  end

  describe "create_dialogue/1" do
    test "creates a dialogue with starter template" do
      {:ok, info} =
        DialogueManager.create_dialogue(%{"key" => "test_dlg_npc", "npc_key" => "test_dlg_npc"})

      assert info.key == "test_dlg_npc"
      assert info.entity_key == "test_dlg_npc"
      assert info.trigger == "on_talk"
      assert info.entry_node == "greeting"
      assert info.node_count == 3
    end

    test "creates YAML file on disk" do
      {:ok, _} =
        DialogueManager.create_dialogue(%{
          "key" => "test_dlg_other",
          "npc_key" => "test_dlg_other"
        })

      path = Path.join(@dialogues_dir, "test_dlg_other.yml")
      assert File.exists?(path)

      content = File.read!(path)
      assert content =~ "key: test_dlg_other"
      assert content =~ "type: dialogue"
      assert content =~ "entity_key: test_dlg_other"
      assert content =~ "greeting:"
    end

    test "rejects unsafe keys" do
      {:error, reason} =
        DialogueManager.create_dialogue(%{"key" => "../evil", "npc_key" => "npc"})

      assert is_binary(reason)
    end

    test "rejects keys with invalid characters" do
      {:error, reason} =
        DialogueManager.create_dialogue(%{"key" => "UPPER CASE!", "npc_key" => "npc"})

      assert is_binary(reason)
    end
  end

  describe "delete_dialogue/1" do
    test "deletes an existing dialogue" do
      {:ok, _} =
        DialogueManager.create_dialogue(%{"key" => "test_dlg_npc", "npc_key" => "test_dlg_npc"})

      assert :ok = DialogueManager.delete_dialogue("test_dlg_npc")

      path = Path.join(@dialogues_dir, "test_dlg_npc.yml")
      refute File.exists?(path)
    end

    test "returns error for nonexistent dialogue" do
      {:error, :not_found} = DialogueManager.delete_dialogue("nonexistent_xyz")
    end

    test "rejects unsafe keys" do
      {:error, reason} = DialogueManager.delete_dialogue("../../etc/passwd")
      assert reason =~ "parent directory"
    end
  end
end
