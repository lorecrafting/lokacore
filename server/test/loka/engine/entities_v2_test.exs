defmodule Loka.Engine.EntitiesV2Test do
  use Loka.DataCase

  alias Loka.Engine.{Entity, Entities}

  import Loka.AccountsFixtures

  # Helper to create and save a test entity
  defp create_entity!(attrs \\ []) do
    entity =
      Entity.new(
        Keyword.merge(
          [type: :npc, key: "test_npc", short_desc: "a test npc"],
          attrs
        )
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  # ==========================================================================
  # 1. CRUD: save, find_one, update, delete
  # ==========================================================================

  describe "save/1 insert" do
    test "inserts a new entity and returns it" do
      entity = Entity.new(type: :npc, key: "goblin", short_desc: "a goblin")
      assert {:ok, saved} = Entities.save(entity)
      assert saved.id == entity.id
      assert saved.type == :npc
      assert saved.key == "goblin"
      assert saved.short_desc == "a goblin"
      assert saved.version == 1
    end

    test "generates UUID if none provided" do
      entity = Entity.new(type: :item, key: "sword")
      assert {:ok, saved} = Entities.save(entity)
      assert is_binary(saved.id)
      assert String.length(saved.id) == 36
    end

    test "persists components as JSON" do
      entity =
        Entity.new(type: :npc, key: "fighter", components: %{"combatant" => %{"level" => 5}})

      {:ok, saved} = Entities.save(entity)
      assert saved.components["combatant"]["level"] == 5
    end

    test "persists metadata" do
      entity = Entity.new(type: :npc, key: "test", metadata: %{"parent_key" => "base_npc"})
      {:ok, saved} = Entities.save(entity)
      assert saved.metadata["parent_key"] == "base_npc"
    end
  end

  describe "save/1 update" do
    test "updates an existing entity and increments version" do
      entity = create_entity!()
      assert entity.version == 1

      updated = %{entity | short_desc: "an updated npc"}
      assert {:ok, saved} = Entities.save(updated)
      assert saved.short_desc == "an updated npc"
      assert saved.version == 2
    end

    test "updates components" do
      entity = create_entity!(components: %{"health" => %{"current" => 100}})
      updated = %{entity | components: %{"health" => %{"current" => 50}}}
      {:ok, saved} = Entities.save(updated)
      assert saved.components["health"]["current"] == 50
    end
  end

  describe "delete/1" do
    test "deletes an existing entity" do
      entity = create_entity!()
      assert {:ok, _} = Entities.delete(entity.id)
      assert {:error, :not_found} = Entities.find_one(entity.id)
    end

    test "returns error for nonexistent entity" do
      assert {:error, :not_found} = Entities.delete(Ecto.UUID.generate())
    end

    test "accepts Entity struct" do
      entity = create_entity!()
      assert {:ok, _} = Entities.delete(entity)
    end
  end

  describe "update/2" do
    test "partial update changes only specified fields" do
      entity = create_entity!(short_desc: "original")
      {:ok, updated} = Entities.update(entity.id, %{short_desc: "changed"})
      assert updated.short_desc == "changed"
      assert updated.key == entity.key
    end

    test "returns error for nonexistent entity" do
      assert {:error, :not_found} = Entities.update(Ecto.UUID.generate(), %{short_desc: "x"})
    end
  end

  # ==========================================================================
  # 2. find_one: UUID lookup, key+type lookup, account_id lookup
  # ==========================================================================

  describe "find_one/1 by UUID" do
    test "finds entity by valid UUID" do
      entity = create_entity!()
      assert {:ok, found} = Entities.find_one(entity.id)
      assert found.id == entity.id
      assert found.type == entity.type
    end

    test "returns error for nonexistent UUID" do
      assert {:error, :not_found} = Entities.find_one(Ecto.UUID.generate())
    end

    test "raises on non-UUID string" do
      assert_raise ArgumentError, ~r/valid UUID/, fn ->
        Entities.find_one("not-a-uuid")
      end
    end
  end

  describe "find_one/1 by key+type" do
    test "finds entity by key and type" do
      create_entity!(key: "unique_npc", type: :npc)
      assert {:ok, found} = Entities.find_one(key: "unique_npc", type: :npc)
      assert found.key == "unique_npc"
      assert found.type == :npc
    end

    test "returns error when key exists but wrong type" do
      create_entity!(key: "mykey", type: :npc)
      assert {:error, :not_found} = Entities.find_one(key: "mykey", type: :item)
    end

    test "returns not_found when key given without type and entity doesn't exist" do
      assert {:error, :not_found} = Entities.find_one(key: "nonexistent_key_xyz")
    end
  end

  describe "find_one/1 by account_id" do
    test "finds entity by account_id" do
      player = player_fixture()
      entity = Entity.new(type: :character, key: "hero", account_id: player.id)
      {:ok, _saved} = Entities.save(entity)

      assert {:ok, found} = Entities.find_one(account_id: player.id)
      assert found.account_id == player.id
    end

    test "returns error for nonexistent account_id" do
      assert {:error, :not_found} = Entities.find_one(account_id: Ecto.UUID.generate())
    end
  end

  # ==========================================================================
  # 3. find_all: by type, location, tags, prototype_key, is_prototype
  # ==========================================================================

  describe "find_all/1" do
    test "finds all by type" do
      create_entity!(key: "npc1", type: :npc)
      create_entity!(key: "npc2", type: :npc)
      create_entity!(key: "item1", type: :item)

      npcs = Entities.find_all(type: :npc)
      assert length(npcs) == 2
      assert Enum.all?(npcs, &(&1.type == :npc))
    end

    test "finds all by location_id" do
      room = create_entity!(key: "room1", type: :room)
      create_entity!(key: "npc1", type: :npc, location_id: room.id)
      create_entity!(key: "npc2", type: :npc, location_id: room.id)
      create_entity!(key: "npc3", type: :npc)

      in_room = Entities.find_all(location_id: room.id)
      assert length(in_room) == 2
    end

    test "finds all by location_id and type" do
      room = create_entity!(key: "room1", type: :room)
      create_entity!(key: "npc1", type: :npc, location_id: room.id)
      create_entity!(key: "item1", type: :item, location_id: room.id)

      npcs_in_room = Entities.find_all(location_id: room.id, type: :npc)
      assert length(npcs_in_room) == 1
      assert hd(npcs_in_room).type == :npc
    end

    test "finds all by tags" do
      e1 = create_entity!(key: "hostile1", type: :npc)
      e2 = create_entity!(key: "hostile2", type: :npc)
      _e3 = create_entity!(key: "peaceful", type: :npc)

      Entities.add_tag(e1.id, "hostile")
      Entities.add_tag(e2.id, "hostile")

      hostiles = Entities.find_all(tags: ["hostile"])
      assert length(hostiles) == 2
    end

    test "finds all by is_prototype" do
      create_entity!(key: "proto1", type: :npc, is_prototype: true)
      create_entity!(key: "instance1", type: :npc, is_prototype: false)

      protos = Entities.find_all(is_prototype: true, type: :npc)
      assert length(protos) == 1
      assert hd(protos).is_prototype == true
    end

    test "returns empty list when no matches" do
      assert [] = Entities.find_all(type: :system)
    end
  end

  # ==========================================================================
  # 4. find dispatch
  # ==========================================================================

  describe "find/1" do
    test "dispatches UUID to find_one" do
      entity = create_entity!()
      assert {:ok, found} = Entities.find(entity.id)
      assert found.id == entity.id
    end

    test "dispatches key+type to find_one" do
      create_entity!(key: "goblin", type: :npc)
      assert {:ok, found} = Entities.find(key: "goblin", type: :npc)
      assert found.key == "goblin"
    end

    test "dispatches type-only to find_all" do
      create_entity!(key: "npc1", type: :npc)
      result = Entities.find(type: :npc)
      assert is_list(result)
    end
  end

  # ==========================================================================
  # 5. find_many: batch UUID reads, batch key+type reads
  # ==========================================================================

  describe "find_many/1 by IDs" do
    test "batch fetches by UUIDs" do
      e1 = create_entity!(key: "a", type: :npc)
      e2 = create_entity!(key: "b", type: :npc)
      _e3 = create_entity!(key: "c", type: :npc)

      results = Entities.find_many([e1.id, e2.id])
      assert length(results) == 2
      ids = Enum.map(results, & &1.id) |> MapSet.new()
      assert MapSet.member?(ids, e1.id)
      assert MapSet.member?(ids, e2.id)
    end

    test "returns empty list for empty input" do
      assert [] = Entities.find_many([])
    end
  end

  describe "find_many/2 by keys+type" do
    test "batch fetches by keys and type" do
      create_entity!(key: "goblin", type: :npc)
      create_entity!(key: "orc", type: :npc)
      create_entity!(key: "goblin", type: :item)

      results = Entities.find_many(["goblin", "orc"], :npc)
      assert length(results) == 2
      assert Enum.all?(results, &(&1.type == :npc))
    end
  end

  # ==========================================================================
  # 6. Tags: add_tag, remove_tag, get_tags, query by tags
  # ==========================================================================

  describe "tag operations" do
    test "add_tag and get_tags" do
      entity = create_entity!()
      {:ok, _} = Entities.add_tag(entity.id, "hostile")
      {:ok, _} = Entities.add_tag(entity.id, "undead")

      tags = Entities.get_tags(entity.id)
      assert "hostile" in tags
      assert "undead" in tags
    end

    test "add_tag is idempotent" do
      entity = create_entity!()
      {:ok, _} = Entities.add_tag(entity.id, "hostile")
      {:ok, _} = Entities.add_tag(entity.id, "hostile")

      tags = Entities.get_tags(entity.id)
      assert length(tags) == 1
    end

    test "remove_tag removes a tag" do
      entity = create_entity!()
      {:ok, _} = Entities.add_tag(entity.id, "hostile")
      {:ok, _} = Entities.add_tag(entity.id, "undead")

      :ok = Entities.remove_tag(entity.id, "hostile")
      tags = Entities.get_tags(entity.id)
      assert tags == ["undead"]
    end

    test "tags are included in find_one results" do
      entity = create_entity!()
      Entities.add_tag(entity.id, "quest_giver")

      {:ok, found} = Entities.find_one(entity.id)
      assert "quest_giver" in found.tags
    end

    test "tags cascade on entity delete" do
      entity = create_entity!()
      Entities.add_tag(entity.id, "test")
      Entities.delete(entity.id)

      # Tags should be gone (cascade delete)
      assert Entities.get_tags(entity.id) == []
    end
  end

  # ==========================================================================
  # 7. Optimistic locking: version conflict on save
  # ==========================================================================

  describe "optimistic locking" do
    test "save increments version on update" do
      entity = create_entity!()
      assert entity.version == 1

      {:ok, v2} = Entities.save(%{entity | short_desc: "v2"})
      assert v2.version == 2

      {:ok, v3} = Entities.save(%{v2 | short_desc: "v3"})
      assert v3.version == 3
    end

    test "save rejects stale version" do
      entity = create_entity!()

      # Simulate a concurrent update
      {:ok, _v2} = Entities.save(%{entity | short_desc: "concurrent"})

      # Try to save with stale version 1
      assert {:error, :version_conflict} = Entities.save(%{entity | short_desc: "stale"})
    end
  end

  # ==========================================================================
  # 8. Prototype uniqueness: unique index on key+type where is_prototype
  # ==========================================================================

  describe "prototype uniqueness" do
    test "allows multiple non-prototype entities with same key+type" do
      e1 = Entity.new(type: :npc, key: "goblin", is_prototype: false)
      e2 = Entity.new(type: :npc, key: "goblin", is_prototype: false)
      assert {:ok, _} = Entities.save(e1)
      assert {:ok, _} = Entities.save(e2)
    end

    test "rejects duplicate prototype with same key+type" do
      e1 = Entity.new(type: :npc, key: "goblin", is_prototype: true)
      assert {:ok, _} = Entities.save(e1)

      e2 = Entity.new(type: :npc, key: "goblin", is_prototype: true)
      assert {:error, _changeset} = Entities.save(e2)
    end

    test "allows same key as prototype for different types" do
      e1 = Entity.new(type: :npc, key: "guard", is_prototype: true)
      e2 = Entity.new(type: :item, key: "guard", is_prototype: true)
      assert {:ok, _} = Entities.save(e1)
      assert {:ok, _} = Entities.save(e2)
    end
  end

  # ==========================================================================
  # 9. Location cascade: nilify location_id on parent delete
  # ==========================================================================

  describe "location cascade" do
    test "nilifies location_id when parent entity is deleted" do
      room = create_entity!(key: "room1", type: :room)
      npc = create_entity!(key: "npc1", type: :npc, location_id: room.id)

      # Delete the room
      {:ok, _} = Entities.delete(room.id)

      # NPC should still exist but with nil location
      {:ok, found_npc} = Entities.find_one(npc.id)
      assert found_npc.location_id == nil
    end
  end

  # ==========================================================================
  # save_batch
  # ==========================================================================

  describe "save_batch/1" do
    test "bulk inserts entities" do
      entities =
        for i <- 1..5 do
          Entity.new(type: :item, key: "item_#{i}", short_desc: "item #{i}")
        end

      {count, _} = Entities.save_batch(entities)
      assert count == 5

      items = Entities.find_all(type: :item)
      assert length(items) == 5
    end
  end
end
