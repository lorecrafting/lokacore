defmodule Loka.Engine.TypedObject.RegistryTest do
  use ExUnit.Case, async: false

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "init/0" do
    test "creates ETS tables" do
      # Tables should already exist from setup
      assert :ets.whereis(:typed_objects) != :undefined
      assert :ets.whereis(:typed_objects_by_type) != :undefined
      assert :ets.whereis(:typed_objects_by_tag) != :undefined
    end

    test "is idempotent" do
      # Should not error when called multiple times
      assert :ok = Registry.init()
      assert :ok = Registry.init()
    end
  end

  describe "put/2 and get/1" do
    test "stores and retrieves a TypedObject" do
      {:ok, to} = TypedObject.new(key: "test_entity", type: :entity, subtype: :npc)

      assert :ok = Registry.put("test_entity", to)
      assert {:ok, retrieved} = Registry.get("test_entity")
      assert retrieved.key == "test_entity"
      assert retrieved.type == :entity
    end

    test "returns error for non-existent key" do
      assert {:error, :not_found} = Registry.get("nonexistent")
    end

    test "overwrites existing entry" do
      {:ok, to1} = TypedObject.new(key: "overwrite_test", type: :entity, name: "Original")
      {:ok, to2} = TypedObject.new(key: "overwrite_test", type: :entity, name: "Updated")

      Registry.put("overwrite_test", to1)
      Registry.put("overwrite_test", to2)

      {:ok, retrieved} = Registry.get("overwrite_test")
      assert retrieved.name == "Updated"
    end
  end

  describe "get!/1" do
    test "returns TypedObject when found" do
      {:ok, to} = TypedObject.new(key: "bang_test", type: :entity)
      Registry.put("bang_test", to)

      retrieved = Registry.get!("bang_test")
      assert retrieved.key == "bang_test"
    end

    test "raises when not found" do
      assert_raise RuntimeError, ~r/TypedObject not found/, fn ->
        Registry.get!("nonexistent")
      end
    end
  end

  describe "list_by_type/1" do
    test "returns all TypedObjects of a type" do
      {:ok, npc1} = TypedObject.new(key: "npc1", type: :entity, subtype: :npc)
      {:ok, npc2} = TypedObject.new(key: "npc2", type: :entity, subtype: :npc)
      {:ok, quest} = TypedObject.new(key: "quest1", type: :quest)

      Registry.put("npc1", npc1)
      Registry.put("npc2", npc2)
      Registry.put("quest1", quest)

      entities = Registry.list_by_type(:entity, :npc)
      assert length(entities) == 2
      assert Enum.all?(entities, fn e -> e.type == :entity and e.subtype == :npc end)

      quests = Registry.list_by_type(:quest)
      assert length(quests) == 1
    end

    test "returns empty list when no matches" do
      assert Registry.list_by_type(:dialogue) == []
    end
  end

  describe "list_by_tag/1" do
    test "returns all TypedObjects with a tag" do
      {:ok, hostile1} =
        TypedObject.new(key: "hostile1", type: :entity, tags: ["hostile", "undead"])

      {:ok, hostile2} = TypedObject.new(key: "hostile2", type: :entity, tags: ["hostile"])
      {:ok, friendly} = TypedObject.new(key: "friendly1", type: :entity, tags: ["friendly"])

      Registry.put("hostile1", hostile1)
      Registry.put("hostile2", hostile2)
      Registry.put("friendly1", friendly)

      hostiles = Registry.list_by_tag("hostile")
      assert length(hostiles) == 2
      assert Enum.all?(hostiles, fn e -> "hostile" in e.tags end)

      undead = Registry.list_by_tag("undead")
      assert length(undead) == 1
    end

    test "returns empty list when no matches" do
      assert Registry.list_by_tag("nonexistent") == []
    end
  end

  describe "exists?/1" do
    test "returns true when key exists" do
      {:ok, to} = TypedObject.new(key: "exists_test", type: :entity)
      Registry.put("exists_test", to)

      assert Registry.exists?("exists_test")
    end

    test "returns false when key doesn't exist" do
      refute Registry.exists?("nonexistent")
    end
  end

  describe "delete/1" do
    test "removes TypedObject and indexes" do
      {:ok, to} =
        TypedObject.new(key: "delete_test", type: :entity, subtype: :npc, tags: ["test_tag"])

      Registry.put("delete_test", to)

      assert Registry.exists?("delete_test")

      Registry.delete("delete_test")

      refute Registry.exists?("delete_test")
      assert Registry.list_by_type(:entity, :npc) == []
      assert Registry.list_by_tag("test_tag") == []
    end

    test "is idempotent" do
      # Should not error when deleting non-existent key
      assert :ok = Registry.delete("nonexistent")
    end
  end

  describe "clear/0" do
    test "removes all entries" do
      {:ok, to1} = TypedObject.new(key: "clear1", type: :entity)
      {:ok, to2} = TypedObject.new(key: "clear2", type: :quest)

      Registry.put("clear1", to1)
      Registry.put("clear2", to2)

      assert Registry.count() == 2

      Registry.clear()

      assert Registry.count() == 0
      assert Registry.all() == []
    end
  end

  describe "keys/0 and all/0" do
    test "returns all keys" do
      {:ok, to1} = TypedObject.new(key: "key1", type: :entity)
      {:ok, to2} = TypedObject.new(key: "key2", type: :quest)

      Registry.put("key1", to1)
      Registry.put("key2", to2)

      keys = Registry.keys()
      assert "key1" in keys
      assert "key2" in keys
    end

    test "returns all TypedObjects" do
      {:ok, to1} = TypedObject.new(key: "all1", type: :entity)
      {:ok, to2} = TypedObject.new(key: "all2", type: :quest)

      Registry.put("all1", to1)
      Registry.put("all2", to2)

      all = Registry.all()
      assert length(all) == 2
      keys = Enum.map(all, & &1.key)
      assert "all1" in keys
      assert "all2" in keys
    end
  end

  describe "count/0" do
    test "returns correct count" do
      assert Registry.count() == 0

      {:ok, to} = TypedObject.new(key: "count_test", type: :entity)
      Registry.put("count_test", to)

      assert Registry.count() == 1
    end
  end

  describe "put_all/1" do
    test "bulk inserts TypedObjects" do
      {:ok, to1} = TypedObject.new(key: "bulk1", type: :entity)
      {:ok, to2} = TypedObject.new(key: "bulk2", type: :quest)

      Registry.put_all(%{
        "bulk1" => to1,
        "bulk2" => to2
      })

      assert Registry.count() == 2
      assert {:ok, _} = Registry.get("bulk1")
      assert {:ok, _} = Registry.get("bulk2")
    end
  end
end
