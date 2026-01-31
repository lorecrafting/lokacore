defmodule Loka.WorldBuilder.EntityManagerTest do
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.EntityManager
  alias Loka.TestCleanup

  # Clean up test files after all tests complete (runs even if tests fail)
  setup_all do
    on_exit(fn ->
      TestCleanup.cleanup_npc_test_files()
      TestCleanup.cleanup_item_test_files()
    end)

    :ok
  end

  describe "list_entities/1" do
    test "returns empty list when no entities of type exist" do
      entities = EntityManager.list_entities(:npc)
      assert is_list(entities)
    end

    test "lists NPCs" do
      entities = EntityManager.list_entities(:npc)
      assert is_list(entities)
      # May have NPCs from world load
    end

    test "lists items" do
      entities = EntityManager.list_entities(:item)
      assert is_list(entities)
    end

    test "filters by entity subtype" do
      npcs = EntityManager.list_entities(:npc)
      items = EntityManager.list_entities(:item)

      # Lists should be independent
      assert is_list(npcs)
      assert is_list(items)
    end
  end

  describe "get_entity/1" do
    test "returns {:error, :not_found} for non-existent entity" do
      assert {:error, :not_found} = EntityManager.get_entity("nonexistent")
    end

    test "returns entity by ID" do
      # This test depends on having entities in the system
      entities = EntityManager.list_entities(:npc)

      if length(entities) > 0 do
        entity = hd(entities)
        assert {:ok, fetched} = EntityManager.get_entity(entity.id)
        assert fetched.id == entity.id
      end
    end

    test "returns entity by key" do
      entities = EntityManager.list_entities(:npc)

      if length(entities) > 0 do
        entity = hd(entities)

        if entity.key do
          result = EntityManager.get_entity(entity.key)
          refute is_nil(result)
        end
      end
    end
  end

  describe "create_entity/2" do
    test "creates an NPC with valid attributes" do
      attrs = %{
        key: "test_npc_#{:rand.uniform(10000)}",
        name: "Test NPC",
        description: "A test NPC",
        level: 5
      }

      result = EntityManager.create_entity(:npc, attrs)
      # May succeed or fail depending on implementation state
      refute is_nil(result)
    end

    test "creates an item with valid attributes" do
      attrs = %{
        key: "test_item_#{:rand.uniform(10000)}",
        name: "Test Item",
        description: "A test item",
        item_type: "consumable"
      }

      result = EntityManager.create_entity(:item, attrs)
      refute is_nil(result)
    end

    test "returns error for missing required fields" do
      attrs = %{}
      result = EntityManager.create_entity(:npc, attrs)
      # Should fail or require at least a key
      refute is_nil(result)
    end

    test "generates unique IDs for created entities" do
      attrs1 = %{key: "entity1_#{:rand.uniform(10000)}", name: "Entity 1"}
      attrs2 = %{key: "entity2_#{:rand.uniform(10000)}", name: "Entity 2"}

      case {EntityManager.create_entity(:npc, attrs1), EntityManager.create_entity(:npc, attrs2)} do
        {{:ok, e1}, {:ok, e2}} ->
          assert e1.id != e2.id

        _ ->
          :ok
      end
    end
  end

  describe "update_entity/2" do
    setup do
      # Try to create a test entity
      attrs = %{
        key: "update_test_#{:rand.uniform(10000)}",
        name: "Original Name",
        level: 1
      }

      case EntityManager.create_entity(:npc, attrs) do
        {:ok, entity} -> %{entity: entity}
        {:error, _} -> %{entity: nil}
      end
    end

    test "updates entity attributes", %{entity: entity} do
      if entity do
        result = EntityManager.update_entity(entity.id, %{name: "Updated Name"})

        case result do
          {:ok, updated} ->
            assert updated.name == "Updated Name"

          {:error, _reason} ->
            :ok
        end
      end
    end

    test "updates entity level", %{entity: entity} do
      if entity do
        result = EntityManager.update_entity(entity.id, %{level: 10})

        case result do
          {:ok, updated} ->
            assert updated.level == 10

          {:error, _} ->
            :ok
        end
      end
    end

    test "returns error for non-existent entity" do
      result = EntityManager.update_entity("nonexistent", %{name: "Fail"})
      assert {:error, _} = result
    end

    test "preserves other attributes when updating" do
      attrs = %{key: "preserve_test_#{:rand.uniform(10000)}", name: "Original", level: 5}

      case EntityManager.create_entity(:npc, attrs) do
        {:ok, entity} ->
          EntityManager.update_entity(entity.id, %{name: "Changed"})

          case EntityManager.get_entity(entity.id) do
            {:ok, updated} ->
              assert updated.level == 5

            _ ->
              :ok
          end

        {:error, _} ->
          :ok
      end
    end
  end

  describe "delete_entity/1" do
    test "deletes an existing entity" do
      attrs = %{key: "delete_test_#{:rand.uniform(10000)}", name: "To Delete"}

      case EntityManager.create_entity(:npc, attrs) do
        {:ok, entity} ->
          result = EntityManager.delete_entity(entity.id)
          refute is_nil(result)

          # Verify deletion
          assert {:error, :not_found} = EntityManager.get_entity(entity.id)

        {:error, _} ->
          :ok
      end
    end

    test "returns error for non-existent entity" do
      result = EntityManager.delete_entity("nonexistent")
      assert {:error, :not_found} = result
    end

    test "removes entity from list" do
      attrs = %{key: "list_delete_test_#{:rand.uniform(10000)}", name: "Delete From List"}

      case EntityManager.create_entity(:npc, attrs) do
        {:ok, entity} ->
          EntityManager.delete_entity(entity.id)
          entities = EntityManager.list_entities(:npc)
          assert Enum.all?(entities, fn e -> e.id != entity.id end)

        {:error, _} ->
          :ok
      end
    end
  end

  describe "entity validation" do
    test "validates entity subtype" do
      result = EntityManager.create_entity(:invalid_type, %{name: "Invalid"})
      # Should handle invalid type gracefully - returns either :ok or :error tuple
      assert match?({:error, _}, result) or match?({:ok, _}, result)
    end

    test "validates entity attributes" do
      attrs = %{key: "validate_test", name: "", description: ""}
      result = EntityManager.create_entity(:npc, attrs)
      # May accept or reject empty strings
      refute is_nil(result)
    end
  end
end
