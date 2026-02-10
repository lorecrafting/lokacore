defmodule Loka.Content.GatheringNodeTest do
  use ExUnit.Case, async: false

  alias Loka.Content.GatheringNode
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "get/1" do
    test "returns gathering node by key" do
      {:ok, node} =
        TypedObject.new(
          key: "test_node",
          type: :gathering_node,
          name: "Iron Vein",
          data: %{
            "skill_required" => "mining",
            "yields" => [%{"item" => "iron_ore", "chance" => 0.8}],
            "respawn_time" => 120
          }
        )

      Registry.put("test_node", node)

      assert {:ok, fetched} = GatheringNode.get("test_node")
      assert fetched.key == "test_node"
    end

    test "returns error for non-gathering_node" do
      {:ok, entity} = TypedObject.new(key: "not_node", type: :entity)
      Registry.put("not_node", entity)

      assert {:error, :not_found} = GatheringNode.get("not_node")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = GatheringNode.get("missing")
    end
  end

  describe "skill_required/1" do
    test "returns required skill" do
      {:ok, node} =
        TypedObject.new(
          key: "skilled_node",
          type: :gathering_node,
          data: %{"skill_required" => "herbalism"}
        )

      assert GatheringNode.skill_required(node) == "herbalism"
    end

    test "returns nil when no skill required" do
      {:ok, node} =
        TypedObject.new(
          key: "no_skill_node",
          type: :gathering_node,
          data: %{}
        )

      assert GatheringNode.skill_required(node) == nil
    end
  end

  describe "yields/1" do
    test "returns yields list" do
      yields = [
        %{"item" => "iron_ore", "chance" => 0.8, "quantity" => 1},
        %{"item" => "gold_nugget", "chance" => 0.1, "quantity" => 1},
        %{"item" => "gem_shard", "chance" => 0.05, "quantity" => 1}
      ]

      {:ok, node} =
        TypedObject.new(
          key: "multi_yield",
          type: :gathering_node,
          data: %{"yields" => yields}
        )

      assert GatheringNode.yields(node) == yields
    end

    test "returns empty list when no yields" do
      {:ok, node} =
        TypedObject.new(
          key: "no_yields",
          type: :gathering_node,
          data: %{}
        )

      assert GatheringNode.yields(node) == []
    end
  end

  describe "respawn_time/1" do
    test "returns respawn time" do
      {:ok, node} =
        TypedObject.new(
          key: "timed_node",
          type: :gathering_node,
          data: %{"respawn_time" => 600}
        )

      assert GatheringNode.respawn_time(node) == 600
    end

    test "defaults to 300" do
      {:ok, node} =
        TypedObject.new(
          key: "default_respawn",
          type: :gathering_node,
          data: %{}
        )

      assert GatheringNode.respawn_time(node) == 300
    end
  end
end
