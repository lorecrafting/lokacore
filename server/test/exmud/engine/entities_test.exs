defmodule Exmud.Engine.EntitiesTest do
  use Exmud.DataCase

  alias Exmud.Engine.Entities
  alias Exmud.Engine.Entity
  alias Exmud.Engine.Schema.EntitySchema

  import Exmud.EngineFixtures

  describe "list_entities/0" do
    test "returns all entities" do
      entity = entity_fixture()
      assert Entities.list_entities() == [entity]
    end

    test "returns empty list when no entities" do
      assert Entities.list_entities() == []
    end
  end

  describe "list_entities/1 with type filter" do
    test "returns entities of specified type" do
      room = room_fixture()
      _npc = npc_fixture()

      result = Entities.list_entities(type: "room")
      assert length(result) == 1
      assert hd(result).id == room.id
    end

    test "returns empty list when no entities of type exist" do
      _room = room_fixture()
      # :exit is a valid enum value but we haven't created any exits
      assert Entities.list_entities(type: "exit") == []
    end
  end

  describe "get_entity!/1" do
    test "returns entity with given id" do
      entity = entity_fixture()
      assert Entities.get_entity!(entity.id).id == entity.id
    end

    test "raises for non-existent id" do
      assert_raise Ecto.NoResultsError, fn ->
        Entities.get_entity!(Ecto.UUID.generate())
      end
    end
  end

  describe "get_entity/1" do
    test "returns entity with given id" do
      entity = entity_fixture()
      assert Entities.get_entity(entity.id).id == entity.id
    end

    test "returns nil for non-existent id" do
      assert is_nil(Entities.get_entity(Ecto.UUID.generate()))
    end
  end

  describe "create_entity/1" do
    test "creates entity with valid data" do
      attrs = valid_entity_attrs()
      assert {:ok, %EntitySchema{} = entity} = Entities.create_entity(attrs)
      # Type is converted to atom by Ecto.Enum
      assert entity.type == String.to_existing_atom(attrs.type)
      assert entity.key == attrs.key
      assert entity.name == attrs.name
      assert entity.description == attrs.description
    end

    test "returns error for missing required fields" do
      assert {:error, changeset} = Entities.create_entity(%{})
      assert %{type: ["can't be blank"], key: ["can't be blank"]} = errors_on(changeset)
    end

    test "returns error for duplicate key" do
      entity = entity_fixture()
      assert {:error, changeset} = Entities.create_entity(%{type: "room", key: entity.key})
      assert %{key: ["has already been taken"]} = errors_on(changeset)
    end

    test "creates entity with components" do
      attrs = valid_entity_attrs(%{components: %{health: %{current: 100, max: 100}}})
      assert {:ok, entity} = Entities.create_entity(attrs)
      assert entity.components == %{health: %{current: 100, max: 100}}
    end

    test "creates entity with behaviors" do
      attrs = valid_entity_attrs(%{behaviors: ["DefaultObject", "Container"]})
      assert {:ok, entity} = Entities.create_entity(attrs)
      assert entity.behaviors == ["DefaultObject", "Container"]
    end

    test "creates entity with tags" do
      attrs = valid_entity_attrs(%{tags: ["magic", "rare"]})
      assert {:ok, entity} = Entities.create_entity(attrs)
      assert entity.tags == ["magic", "rare"]
    end
  end

  describe "update_entity/2" do
    test "updates entity with valid data" do
      entity = entity_fixture()
      assert {:ok, updated} = Entities.update_entity(entity, %{name: "Updated Name"})
      assert updated.name == "Updated Name"
    end

    test "returns error for invalid data" do
      entity = entity_fixture()
      assert {:error, changeset} = Entities.update_entity(entity, %{type: nil})
      assert %{type: ["can't be blank"]} = errors_on(changeset)
    end
  end

  describe "delete_entity/1" do
    test "deletes entity" do
      entity = entity_fixture()
      assert {:ok, %EntitySchema{}} = Entities.delete_entity(entity)
      assert is_nil(Entities.get_entity(entity.id))
    end
  end

  describe "count_all/0" do
    test "returns count of all entities" do
      assert Entities.count_all() == 0
      entity_fixture()
      assert Entities.count_all() == 1
      entity_fixture()
      assert Entities.count_all() == 2
    end
  end

  describe "count_by_type/1" do
    test "returns count of entities by type" do
      room_fixture()
      room_fixture()
      npc_fixture()

      assert Entities.count_by_type("room") == 2
      assert Entities.count_by_type("npc") == 1
      assert Entities.count_by_type("item") == 0
    end
  end

  describe "attributes" do
    test "set_attribute/3 creates new attribute" do
      entity = entity_fixture()
      assert {:ok, attr} = Entities.set_attribute(entity.id, "health", 100)
      assert attr.key == "health"
      assert attr.value == 100
    end

    test "set_attribute/3 updates existing attribute" do
      entity = entity_fixture()
      {:ok, _} = Entities.set_attribute(entity.id, "health", 100)
      {:ok, attr} = Entities.set_attribute(entity.id, "health", 50)
      assert attr.value == 50
    end

    test "set_attribute/4 with category" do
      entity = entity_fixture()
      {:ok, attr} = Entities.set_attribute(entity.id, "strength", 10, "stats")
      assert attr.category == "stats"
    end

    test "get_attribute/2 returns attribute value" do
      entity = entity_fixture()
      {:ok, _} = Entities.set_attribute(entity.id, "health", 100)
      assert Entities.get_attribute(entity.id, "health") == 100
    end

    test "get_attribute/2 returns nil for non-existent attribute" do
      entity = entity_fixture()
      assert is_nil(Entities.get_attribute(entity.id, "nonexistent"))
    end

    test "get_attributes/1 returns map of attributes for entity" do
      entity = entity_fixture()
      {:ok, _} = Entities.set_attribute(entity.id, "health", 100)
      {:ok, _} = Entities.set_attribute(entity.id, "mana", 50)

      attrs = Entities.get_attributes(entity.id)
      assert is_map(attrs)
      assert attrs["health"] == 100
      assert attrs["mana"] == 50
    end

    test "get_attributes/2 filters by category" do
      entity = entity_fixture()
      {:ok, _} = Entities.set_attribute(entity.id, "strength", 10, "stats")
      {:ok, _} = Entities.set_attribute(entity.id, "dexterity", 15, "stats")
      {:ok, _} = Entities.set_attribute(entity.id, "quest_progress", %{step: 1}, "quests")

      stats = Entities.get_attributes(entity.id, "stats")
      assert Map.keys(stats) |> Enum.sort() == ["dexterity", "strength"]

      quests = Entities.get_attributes(entity.id, "quests")
      assert Map.keys(quests) == ["quest_progress"]
    end

    test "delete_attribute/2 removes attribute" do
      entity = entity_fixture()
      {:ok, _} = Entities.set_attribute(entity.id, "health", 100)
      {1, nil} = Entities.delete_attribute(entity.id, "health")
      assert is_nil(Entities.get_attribute(entity.id, "health"))
    end

    test "clear_attributes/1 removes all attributes" do
      entity = entity_fixture()
      {:ok, _} = Entities.set_attribute(entity.id, "health", 100)
      {:ok, _} = Entities.set_attribute(entity.id, "mana", 50)

      {count, nil} = Entities.clear_attributes(entity.id)
      assert count == 2
      assert Entities.get_attributes(entity.id) == %{}
    end
  end

  describe "get_entity_by_key/1" do
    test "returns entity with given key" do
      entity = entity_fixture(%{key: "unique_key_test"})
      assert Entities.get_entity_by_key("unique_key_test").id == entity.id
    end

    test "returns nil for non-existent key" do
      assert is_nil(Entities.get_entity_by_key("nonexistent_key"))
    end
  end

  describe "list_entities/1 with location filter" do
    test "filters by location_id" do
      room = room_fixture()
      item_in_room = entity_fixture(%{type: :item, location_id: room.id})
      _item_elsewhere = item_fixture()

      results = Entities.list_entities(location_id: room.id)
      assert length(results) == 1
      assert hd(results).id == item_in_room.id
    end

    test "filters by multiple types" do
      room = room_fixture()
      npc = npc_fixture()
      _item = item_fixture()

      results = Entities.list_entities(type: [:room, :npc])
      result_ids = Enum.map(results, & &1.id)

      assert room.id in result_ids
      assert npc.id in result_ids
      assert length(results) == 2
    end
  end

  describe "list_rooms/0" do
    test "returns only room entities" do
      room1 = room_fixture()
      room2 = room_fixture()
      _npc = npc_fixture()

      rooms = Entities.list_rooms()
      room_ids = Enum.map(rooms, & &1.id)

      assert room1.id in room_ids
      assert room2.id in room_ids
      assert Enum.all?(rooms, &(&1.type == :room))
    end
  end

  describe "get_room/1" do
    test "returns room by id" do
      room = room_fixture()
      result = Entities.get_room(room.id)
      assert result.id == room.id
      assert result.type == :room
    end

    test "returns nil for non-room entity" do
      npc = npc_fixture()
      assert is_nil(Entities.get_room(npc.id))
    end

    test "returns nil for non-existent id" do
      assert is_nil(Entities.get_room(Ecto.UUID.generate()))
    end
  end

  describe "get_contents/1" do
    test "returns entities at location" do
      room = room_fixture()
      item1 = entity_fixture(%{type: :item, location_id: room.id})
      item2 = entity_fixture(%{type: :item, location_id: room.id})
      _item_elsewhere = item_fixture()

      contents = Entities.get_contents(room.id)
      content_ids = Enum.map(contents, & &1.id)

      assert item1.id in content_ids
      assert item2.id in content_ids
      assert length(contents) == 2
    end

    test "returns empty list when no contents" do
      room = room_fixture()
      assert Entities.get_contents(room.id) == []
    end
  end

  describe "to_entity/1" do
    test "converts EntitySchema to Entity struct" do
      schema =
        entity_fixture(%{
          name: "Test Entity",
          description: "A test",
          components: %{health: 100},
          tags: ["test"]
        })

      entity = Entities.to_entity(schema)

      assert %Entity{} = entity
      assert entity.id == schema.id
      assert entity.name == "Test Entity"
      assert entity.components == %{health: 100}
      assert entity.tags == ["test"]
    end

    test "returns nil for nil input" do
      assert is_nil(Entities.to_entity(nil))
    end
  end

  describe "save_entity/1" do
    test "creates new entity when id is nil" do
      entity =
        Entity.new(:room, %{key: "save_test_#{System.unique_integer()}", name: "Saved Room"})

      assert {:ok, saved} = Entities.save_entity(entity)
      assert saved.name == "Saved Room"
      assert Entities.get_entity(saved.id) != nil
    end

    test "updates existing entity" do
      schema = entity_fixture(%{name: "Original"})
      entity = Entities.to_entity(schema)
      updated_entity = %{entity | name: "Updated"}

      assert {:ok, saved} = Entities.save_entity(updated_entity)
      assert saved.name == "Updated"
    end
  end

  describe "change_entity/2" do
    test "returns a changeset" do
      entity = entity_fixture()
      changeset = Entities.change_entity(entity, %{name: "New Name"})
      assert %Ecto.Changeset{} = changeset
      assert changeset.changes == %{name: "New Name"}
    end

    test "returns changeset with no changes for empty attrs" do
      entity = entity_fixture()
      changeset = Entities.change_entity(entity)
      assert %Ecto.Changeset{} = changeset
      assert changeset.changes == %{}
    end
  end
end
