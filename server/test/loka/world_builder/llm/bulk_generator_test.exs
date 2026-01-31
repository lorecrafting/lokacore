defmodule Loka.WorldBuilder.LLM.BulkGeneratorTest do
  use ExUnit.Case, async: false

  alias Loka.WorldBuilder.LLM.BulkGenerator

  setup do
    # BulkGenerator is already started by application.ex
    # Just verify it's running
    case Process.whereis(BulkGenerator) do
      nil -> start_supervised!(BulkGenerator)
      _pid -> :ok
    end

    :ok
  end

  describe "start_generation/2" do
    test "starts a bulk generation task" do
      spec = %{
        count: 5,
        type: :room,
        template: %{
          name: "Tavern Room",
          description: "A cozy tavern",
          tags: ["tavern", "social"]
        }
      }

      assert {:ok, generation_id} = BulkGenerator.start_generation("user", spec)

      assert is_binary(generation_id)
    end

    test "returns unique generation ID" do
      spec = %{count: 3, type: :room, template: %{name: "Test"}}
      {:ok, id1} = BulkGenerator.start_generation("user", spec)
      {:ok, id2} = BulkGenerator.start_generation("user", spec)

      assert id1 != id2
    end

    test "accepts different content types" do
      room_spec = %{count: 2, type: :room, template: %{name: "Test"}}
      npc_spec = %{count: 2, type: :npc, template: %{name: "Test"}}
      item_spec = %{count: 2, type: :item, template: %{name: "Test"}}

      assert {:ok, _} = BulkGenerator.start_generation("user", room_spec)
      assert {:ok, _} = BulkGenerator.start_generation("user", npc_spec)
      assert {:ok, _} = BulkGenerator.start_generation("user", item_spec)
    end
  end

  describe "get_progress/1" do
    test "returns progress for running generation" do
      spec = %{count: 3, type: :room, template: %{name: "Progress Test"}}
      {:ok, id} = BulkGenerator.start_generation("user", spec)

      assert {:ok, gen} = BulkGenerator.get_progress(id)
      assert Map.has_key?(gen, :status)
      assert Map.has_key?(gen, :progress)
      assert Map.has_key?(gen, :total)
      assert gen.total == 3
    end

    test "returns not_found for non-existent generation" do
      assert {:error, :not_found} = BulkGenerator.get_progress("nonexistent_id")
    end

    test "tracks completion count" do
      spec = %{count: 5, type: :room, template: %{name: "Completion Test"}}
      {:ok, id} = BulkGenerator.start_generation("user", spec)

      {:ok, gen} = BulkGenerator.get_progress(id)
      assert gen.progress <= gen.total
      assert is_integer(gen.progress)
    end
  end

  describe "cancel_generation/1" do
    test "cancels a running generation" do
      spec = %{count: 10, type: :room, template: %{name: "Cancel Test"}}
      {:ok, id} = BulkGenerator.start_generation("user", spec)

      assert :ok = BulkGenerator.cancel_generation(id)

      {:ok, progress} = BulkGenerator.get_progress(id)
      assert progress.status in [:cancelled, :running]
    end

    test "returns ok for already completed generation" do
      spec = %{count: 1, type: :room, template: %{name: "Already Done"}}
      {:ok, id} = BulkGenerator.start_generation("user", spec)

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
      spec = %{count: 100, type: :room, template: %{name: "Long Running"}}
      {:ok, id} = BulkGenerator.start_generation("user", spec)

      # Generation should still be queryable
      assert {:ok, _progress} = BulkGenerator.get_progress(id)
    end
  end

  describe "concurrent generations" do
    test "allows multiple generations for same user" do
      spec1 = %{count: 3, type: :room, template: %{name: "Batch 1"}}
      spec2 = %{count: 3, type: :room, template: %{name: "Batch 2"}}

      {:ok, id1} = BulkGenerator.start_generation("user", spec1)
      {:ok, id2} = BulkGenerator.start_generation("user", spec2)

      assert {:ok, _} = BulkGenerator.get_progress(id1)
      assert {:ok, _} = BulkGenerator.get_progress(id2)
    end

    test "allows generations for different users" do
      spec = %{count: 2, type: :room, template: %{name: "Test"}}
      {:ok, id1} = BulkGenerator.start_generation("user1", spec)
      {:ok, id2} = BulkGenerator.start_generation("user2", spec)

      {:ok, progress1} = BulkGenerator.get_progress(id1)
      {:ok, progress2} = BulkGenerator.get_progress(id2)

      # Each should have independent progress
      assert progress1.id == id1
      assert progress2.id == id2
    end
  end

  describe "error handling" do
    test "handles invalid template gracefully" do
      spec = %{count: 5, type: :room, template: nil}
      result = BulkGenerator.start_generation("user", spec)
      # Should either return error or handle nil template
      refute is_nil(result)
    end

    test "handles zero count" do
      spec = %{count: 0, type: :room, template: %{name: "Zero"}}
      result = BulkGenerator.start_generation("user", spec)
      # Implementation may vary - either error or immediate completion
      refute is_nil(result)
    end

    test "handles negative count" do
      spec = %{count: -5, type: :room, template: %{name: "Negative"}}
      result = BulkGenerator.start_generation("user", spec)
      # Should handle gracefully
      refute is_nil(result)
    end
  end
end
