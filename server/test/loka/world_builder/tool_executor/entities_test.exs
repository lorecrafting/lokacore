defmodule Loka.WorldBuilder.ToolExecutor.EntitiesTest do
  @moduledoc "Tests for ToolExecutor.Entities domain module."
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.ToolExecutor.Entities
  alias Loka.WorldBuilder.{EntityManager, RoomManager}
  alias Loka.TestCleanup

  setup_all do
    on_exit(fn ->
      TestCleanup.cleanup_npc_test_files()
      TestCleanup.cleanup_item_test_files()
    end)

    :ok
  end

  describe "execute_create_npc/1" do
    test "creates NPC with valid input" do
      input = %{
        "key" => "ent_test_npc_#{System.unique_integer([:positive])}",
        "name" => "Test NPC",
        "description" => "A test NPC",
        "level" => 5
      }

      assert {:ok, result} = Entities.execute_create_npc(input)
      assert result.success == true
      assert result.npc.key == input["key"]
      assert result.npc.name == "Test NPC"
    end

    test "creates NPC with default level" do
      input = %{
        "key" => "ent_test_npc_default_#{System.unique_integer([:positive])}",
        "name" => "Default Level NPC"
      }

      assert {:ok, result} = Entities.execute_create_npc(input)
      assert result.success == true
    end

    test "creates NPC in a room" do
      {:ok, room} =
        RoomManager.create_room(%{
          key: "ent_test_npc_room_#{System.unique_integer([:positive])}",
          name: "NPC Room"
        })

      input = %{
        "key" => "ent_test_room_npc_#{System.unique_integer([:positive])}",
        "name" => "Room NPC",
        "room_key" => room.key
      }

      assert {:ok, result} = Entities.execute_create_npc(input)
      assert result.success == true
    end
  end

  describe "execute_create_item/1" do
    test "creates item with valid input" do
      input = %{
        "key" => "ent_test_item_#{System.unique_integer([:positive])}",
        "name" => "Test Item",
        "description" => "A test item",
        "item_type" => "weapon"
      }

      assert {:ok, result} = Entities.execute_create_item(input)
      assert result.success == true
      assert result.item.key == input["key"]
    end

    test "creates item with default type" do
      input = %{
        "key" => "ent_test_item_def_#{System.unique_integer([:positive])}",
        "name" => "Default Item"
      }

      assert {:ok, result} = Entities.execute_create_item(input)
      assert result.success == true
    end

    test "creates item with tags" do
      input = %{
        "key" => "ent_test_item_tagged_#{System.unique_integer([:positive])}",
        "name" => "Tagged Item",
        "tags" => ["unique", "quest"]
      }

      assert {:ok, result} = Entities.execute_create_item(input)
      assert result.success == true
    end
  end

  describe "execute_list_npcs/1" do
    test "lists all NPCs" do
      assert {:ok, result} = Entities.execute_list_npcs(%{})
      assert result.success == true
      assert is_list(result.npcs)
    end

    test "filters by room" do
      assert {:ok, result} = Entities.execute_list_npcs(%{"room_key" => "nonexistent"})
      assert result.success == true
    end

    test "filters by tag" do
      assert {:ok, result} = Entities.execute_list_npcs(%{"tag" => "quest_giver"})
      assert result.success == true
    end
  end

  describe "execute_list_items/1" do
    test "lists all items" do
      assert {:ok, result} = Entities.execute_list_items(%{})
      assert result.success == true
      assert is_list(result.items)
    end

    test "filters by type" do
      assert {:ok, result} = Entities.execute_list_items(%{"item_type" => "weapon"})
      assert result.success == true
    end
  end

  describe "execute_update_entity/2" do
    test "returns error for non-existent NPC" do
      assert {:error, _} =
               Entities.execute_update_entity(:npc, %{
                 "key" => "nonexistent_npc_xyz",
                 "name" => "New"
               })
    end

    test "returns error for non-existent item" do
      assert {:error, _} =
               Entities.execute_update_entity(:item, %{
                 "key" => "nonexistent_item_xyz",
                 "name" => "New"
               })
    end
  end

  describe "execute_delete_entity/2" do
    test "returns error for non-existent NPC" do
      assert {:error, _} = Entities.execute_delete_entity(:npc, %{"key" => "nonexistent_del_npc"})
    end

    test "returns error for non-existent item" do
      assert {:error, _} =
               Entities.execute_delete_entity(:item, %{"key" => "nonexistent_del_item"})
    end
  end
end
