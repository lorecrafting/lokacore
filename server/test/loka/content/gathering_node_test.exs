defmodule Loka.Content.GatheringNodeTest do
  use Loka.DataCase, async: false

  alias Loka.Content.GatheringNode
  alias Loka.Engine.{Entity, Entities}

  defp create_gathering_node(key, data, opts \\ []) do
    entity =
      Entity.new(
        type: :gathering_node,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns gathering node by key" do
      create_gathering_node(
        "test_node",
        %{
          "skill_required" => "mining",
          "yields" => [%{"item" => "iron_ore", "chance" => 0.8}],
          "respawn_time" => 120
        }, name: "Iron Vein")

      assert {:ok, fetched} = GatheringNode.get("test_node")
      assert fetched.key == "test_node"
    end

    test "returns error for non-gathering_node" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_node",
          short_desc: "Not a node",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = GatheringNode.get("not_node")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = GatheringNode.get("missing")
    end
  end

  describe "skill_required/1" do
    test "returns required skill" do
      entity = create_gathering_node("skilled_node", %{"skill_required" => "herbalism"})
      {:ok, node} = Entity.to_typed_object(entity)

      assert GatheringNode.skill_required(node) == "herbalism"
    end

    test "returns nil when no skill required" do
      entity = create_gathering_node("no_skill_node", %{})
      {:ok, node} = Entity.to_typed_object(entity)

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

      entity = create_gathering_node("multi_yield", %{"yields" => yields})
      {:ok, node} = Entity.to_typed_object(entity)

      assert GatheringNode.yields(node) == yields
    end

    test "returns empty list when no yields" do
      entity = create_gathering_node("no_yields", %{})
      {:ok, node} = Entity.to_typed_object(entity)

      assert GatheringNode.yields(node) == []
    end
  end

  describe "respawn_time/1" do
    test "returns respawn time" do
      entity = create_gathering_node("timed_node", %{"respawn_time" => 600})
      {:ok, node} = Entity.to_typed_object(entity)

      assert GatheringNode.respawn_time(node) == 600
    end

    test "defaults to 300" do
      entity = create_gathering_node("default_respawn", %{})
      {:ok, node} = Entity.to_typed_object(entity)

      assert GatheringNode.respawn_time(node) == 300
    end
  end
end
