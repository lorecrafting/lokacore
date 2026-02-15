defmodule Loka.WorldBuilder.DialogueManagerTest do
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.DialogueManager
  alias Loka.Engine.Entities

  setup do
    on_exit(fn ->
      # Clean up test dialogue entities
      for key <- ["test_dlg_npc", "test_dlg_other"] do
        case Entities.get_entity_by_key(key) do
          %{} = schema -> Entities.delete_entity(schema)
          nil -> :ok
        end
      end
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

    test "persists dialogue to entity DB" do
      {:ok, _} =
        DialogueManager.create_dialogue(%{
          "key" => "test_dlg_other",
          "npc_key" => "test_dlg_other"
        })

      schema = Entities.get_entity_by_key("test_dlg_other")
      assert schema != nil
      assert schema.type == :dialogue

      entity = Entities.to_entity(schema)
      assert entity.key == "test_dlg_other"
      data = entity.components["data"]
      assert data["entity_key"] == "test_dlg_other"
      assert data["trigger"] == "on_talk"
      assert data["entry_node"] == "greeting"
      assert is_map(data["nodes"])
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

      assert Entities.get_entity_by_key("test_dlg_npc") == nil
    end

    test "returns error for nonexistent dialogue" do
      {:error, :not_found} = DialogueManager.delete_dialogue("nonexistent_xyz")
    end
  end
end
