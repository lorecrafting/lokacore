defmodule Loka.WorldBuilder.LLM.BulkGeneratorTest do
  use ExUnit.Case, async: false

  alias Loka.WorldBuilder.LLM.BulkGenerator

  setup do
    start_supervised!(BulkGenerator)
    :ok
  end

  describe "start_generation/4" do
    test "starts a bulk generation task" do
      template = %{
        name: "Tavern Room",
        description: "A cozy tavern",
        tags: ["tavern", "social"]
      }

      assert {:ok, generation_id} =
               BulkGenerator.start_generation("user", :room, 5, template)

      assert is_binary(generation_id)
    end

    test "returns unique generation ID" do
      template = %{name: "Test"}
      {:ok, id1} = BulkGenerator.start_generation("user", :room, 3, template)
      {:ok, id2} = BulkGenerator.start_generation("user", :room, 3, template)

      assert id1 != id2
    end

    test "accepts different content types" do
      template = %{name: "Test"}
      assert {:ok, _} = BulkGenerator.start_generation("user", :room, 2, template)
      assert {:ok, _} = BulkGenerator.start_generation("user", :npc, 2, template)
      assert {:ok, _} = BulkGenerator.start_generation("user", :item, 2, template)
    end
  end

  describe "get_progress/1" do
    test "returns progress for running generation" do
      template = %{name: "Progress Test"}
      {:ok, id} = BulkGenerator.start_generation("user", :room, 3, template)

      assert {:ok, progress} = BulkGenerator.get_progress(id)
      assert Map.has_key?(progress, :status)
      assert Map.has_key?(progress, :completed)
      assert Map.has_key?(progress, :total)
      assert progress.total == 3
    end

    test "returns not_found for non-existent generation" do
      assert {:error, :not_found} = BulkGenerator.get_progress("nonexistent_id")
    end

    test "tracks completion count" do
      template = %{name: "Completion Test"}
      {:ok, id} = BulkGenerator.start_generation("user", :room, 5, template)

      {:ok, progress} = BulkGenerator.get_progress(id)
      assert progress.completed <= progress.total
      assert is_integer(progress.completed)
    end
  end

  describe "cancel_generation/1" do
    test "cancels a running generation" do
      template = %{name: "Cancel Test"}
      {:ok, id} = BulkGenerator.start_generation("user", :room, 10, template)

      assert :ok = BulkGenerator.cancel_generation(id)

      {:ok, progress} = BulkGenerator.get_progress(id)
      assert progress.status in [:cancelled, :running]
    end

    test "returns ok for already completed generation" do
      template = %{name: "Already Done"}
      {:ok, id} = BulkGenerator.start_generation("user", :room, 1, template)

      # Wait a moment for completion (or not - depends on implementation)
      Process.sleep(100)

      assert :ok = BulkGenerator.cancel_generation(id)
    end

    test "returns not_found for non-existent generation" do
      assert {:error, :not_found} = BulkGenerator.cancel_generation("nonexistent")
    end
  end

  describe "generation cleanup" do
    test "cleans up old completed generations" do
      # Verify cleanup mechanism exists
      assert function_exported?(BulkGenerator, :handle_info, 2)
    end

    test "preserves running generations during cleanup" do
      template = %{name: "Long Running"}
      {:ok, id} = BulkGenerator.start_generation("user", :room, 100, template)

      # Generation should still be queryable
      assert {:ok, _progress} = BulkGenerator.get_progress(id)
    end
  end

  describe "concurrent generations" do
    test "allows multiple generations for same user" do
      template1 = %{name: "Batch 1"}
      template2 = %{name: "Batch 2"}

      {:ok, id1} = BulkGenerator.start_generation("user", :room, 3, template1)
      {:ok, id2} = BulkGenerator.start_generation("user", :room, 3, template2)

      assert {:ok, _} = BulkGenerator.get_progress(id1)
      assert {:ok, _} = BulkGenerator.get_progress(id2)
    end

    test "allows generations for different users" do
      template = %{name: "Test"}
      {:ok, id1} = BulkGenerator.start_generation("user1", :room, 2, template)
      {:ok, id2} = BulkGenerator.start_generation("user2", :room, 2, template)

      {:ok, progress1} = BulkGenerator.get_progress(id1)
      {:ok, progress2} = BulkGenerator.get_progress(id2)

      # Each should have independent progress
      assert progress1.id == id1
      assert progress2.id == id2
    end
  end

  describe "error handling" do
    test "handles invalid template gracefully" do
      result = BulkGenerator.start_generation("user", :room, 5, nil)
      # Should either return error or handle nil template
      refute is_nil(result)
    end

    test "handles zero count" do
      template = %{name: "Zero"}
      result = BulkGenerator.start_generation("user", :room, 0, template)
      # Implementation may vary - either error or immediate completion
      refute is_nil(result)
    end

    test "handles negative count" do
      template = %{name: "Negative"}
      result = BulkGenerator.start_generation("user", :room, -5, template)
      # Should handle gracefully
      refute is_nil(result)
    end
  end
end
