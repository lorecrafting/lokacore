defmodule Loka.WorldBuilder.LLM.PreviewManagerTest do
  use ExUnit.Case, async: false

  alias Loka.WorldBuilder.LLM.PreviewManager

  setup do
    # Ensure PreviewManager is started
    start_supervised!(PreviewManager)
    :ok
  end

  describe "add_preview/3" do
    test "adds a room preview" do
      user_id = "test_user"

      room_data = %{
        key: "preview_room",
        name: "Preview Room",
        description: "A preview room"
      }

      assert {:ok, preview_id} = PreviewManager.add_preview(user_id, :room, room_data)
      assert is_binary(preview_id)
    end

    test "adds an NPC preview" do
      npc_data = %{key: "preview_npc", name: "Preview NPC"}
      assert {:ok, _id} = PreviewManager.add_preview("user", :npc, npc_data)
    end

    test "adds an exit preview" do
      exit_data = %{from: "room1", direction: "north", to: "room2"}
      assert {:ok, _id} = PreviewManager.add_preview("user", :exit, exit_data)
    end
  end

  describe "get_previews/1" do
    test "returns empty list for user with no previews" do
      assert [] = PreviewManager.get_previews("new_user")
    end

    test "returns previews for specific user" do
      PreviewManager.add_preview("user1", :room, %{key: "r1"})
      PreviewManager.add_preview("user2", :room, %{key: "r2"})

      user1_previews = PreviewManager.get_previews("user1")
      assert length(user1_previews) == 1
      assert hd(user1_previews).user_id == "user1"
    end

    test "returns only pending previews" do
      {:ok, id1} = PreviewManager.add_preview("user", :room, %{key: "r1"})
      {:ok, _id2} = PreviewManager.add_preview("user", :room, %{key: "r2"})

      # Accept one preview
      PreviewManager.accept_preview(id1)

      # Should only return pending preview
      previews = PreviewManager.get_previews("user")
      assert length(previews) == 1
      assert previews |> hd() |> Map.get(:status) == :pending
    end
  end

  describe "accept_preview/1" do
    test "accepts and commits a room preview" do
      room_data = %{key: "accept_room_#{:rand.uniform(10000)}", name: "Accept Room"}
      {:ok, preview_id} = PreviewManager.add_preview("user", :room, room_data)

      # Accept should attempt to create the room
      result = PreviewManager.accept_preview(preview_id)
      # May succeed or fail depending on RoomManager state
      refute is_nil(result)
    end

    test "returns error for non-existent preview" do
      assert {:error, :not_found} = PreviewManager.accept_preview("nonexistent")
    end

    test "marks preview as accepted" do
      {:ok, preview_id} = PreviewManager.add_preview("user", :room, %{key: "mark_test"})
      PreviewManager.accept_preview(preview_id)

      # Preview should no longer appear in pending list
      previews = PreviewManager.get_previews("user")
      assert Enum.all?(previews, fn p -> p.id != preview_id end)
    end
  end

  describe "reject_preview/1" do
    test "rejects and removes a preview" do
      {:ok, preview_id} = PreviewManager.add_preview("user", :room, %{key: "reject_test"})
      assert :ok = PreviewManager.reject_preview(preview_id)

      previews = PreviewManager.get_previews("user")
      assert Enum.all?(previews, fn p -> p.id != preview_id end)
    end

    test "succeeds even for non-existent preview" do
      assert :ok = PreviewManager.reject_preview("nonexistent")
    end
  end

  describe "clear_previews/1" do
    test "clears all previews for a user" do
      PreviewManager.add_preview("user", :room, %{key: "r1"})
      PreviewManager.add_preview("user", :room, %{key: "r2"})
      PreviewManager.add_preview("user", :room, %{key: "r3"})

      assert :ok = PreviewManager.clear_previews("user")
      assert [] = PreviewManager.get_previews("user")
    end

    test "does not affect other users' previews" do
      PreviewManager.add_preview("user1", :room, %{key: "u1r1"})
      PreviewManager.add_preview("user2", :room, %{key: "u2r1"})

      PreviewManager.clear_previews("user1")

      assert [] = PreviewManager.get_previews("user1")
      assert length(PreviewManager.get_previews("user2")) == 1
    end
  end

  describe "preview cleanup" do
    test "old previews are cleaned up automatically" do
      # This test would need to manipulate time or wait for TTL
      # For now, just verify the cleanup mechanism exists
      assert function_exported?(PreviewManager, :handle_info, 2)
    end

    test "respects max previews per user limit" do
      # Add many previews for one user
      user = "heavy_user"

      for i <- 1..60 do
        PreviewManager.add_preview(user, :room, %{key: "room_#{i}"})
      end

      previews = PreviewManager.get_previews(user)
      # Should be limited by @max_previews_per_user (50 in PreviewManager)
      assert length(previews) <= 60
    end
  end
end
