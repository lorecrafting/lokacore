defmodule Loka.Framework.Inventory.ContainerRespawnTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.Entities
  alias Loka.Engine.Spawner
  alias Loka.Framework.Inventory.Container
  alias Loka.Framework.Inventory.ContainerRespawn

  describe "schedule/1" do
    test "schedules a respawn for a container with respawn enabled" do
      # Spawn a herb patch with respawn enabled
      {:ok, entity} = Spawner.spawn("herb_patch_ginger")

      # Schedule a respawn
      assert :ok = ContainerRespawn.schedule(entity.id)

      # Verify it's pending
      assert ContainerRespawn.pending?(entity.id)
    end

    test "returns :already_scheduled when respawn is already pending" do
      {:ok, entity} = Spawner.spawn("herb_patch_ginger")

      assert :ok = ContainerRespawn.schedule(entity.id)
      assert :already_scheduled = ContainerRespawn.schedule(entity.id)
    end

    test "returns error for non-existent entity" do
      assert {:error, :entity_not_found} = ContainerRespawn.schedule("nonexistent-id")
    end

    test "returns error for entity without container component" do
      # Spawn a regular item (no container)
      {:ok, entity} = Spawner.spawn("sheng_jiang")

      assert {:error, :not_a_container} = ContainerRespawn.schedule(entity.id)
    end

    test "returns respawn_disabled for container without respawn config" do
      # Spawn a basic container without respawn
      {:ok, entity} = Spawner.spawn("base_container")

      assert :respawn_disabled = ContainerRespawn.schedule(entity.id)
    end
  end

  describe "cancel/1" do
    test "cancels a pending respawn" do
      {:ok, entity} = Spawner.spawn("herb_patch_ginger")

      assert :ok = ContainerRespawn.schedule(entity.id)
      assert ContainerRespawn.pending?(entity.id)

      assert :ok = ContainerRespawn.cancel(entity.id)
      refute ContainerRespawn.pending?(entity.id)
    end

    test "returns :ok when no respawn is pending" do
      {:ok, entity} = Spawner.spawn("herb_patch_ginger")

      assert :ok = ContainerRespawn.cancel(entity.id)
    end
  end

  describe "pending_count/0" do
    test "returns the number of pending respawns" do
      initial_count = ContainerRespawn.pending_count()

      {:ok, entity1} = Spawner.spawn("herb_patch_ginger")
      {:ok, entity2} = Spawner.spawn("herb_patch_ginger")

      ContainerRespawn.schedule(entity1.id)
      ContainerRespawn.schedule(entity2.id)

      assert ContainerRespawn.pending_count() == initial_count + 2

      ContainerRespawn.cancel(entity1.id)
      assert ContainerRespawn.pending_count() == initial_count + 1
    end
  end

  describe "respawn execution" do
    test "respawns container contents after delay" do
      # Spawn a container with very short delay for testing
      {:ok, entity} = Spawner.spawn("herb_patch_ginger")

      # Empty the container
      schema = Entities.get_entity(entity.id)
      components = schema.components
      container_data = Map.get(components, "container", %{})

      # Set empty contents and very short delay
      updated_container =
        container_data
        |> Map.put("contents", [])
        |> Map.put("respawn", %{
          "enabled" => true,
          "delay_seconds" => 0,
          "loot_table" => [%{"item" => "sheng_jiang", "weight" => 100, "quantity" => 3}]
        })

      updated_components = Map.put(components, "container", updated_container)
      {:ok, _} = Entities.update_entity(schema, %{components: updated_components})

      # Schedule respawn (should trigger almost immediately with 0 delay)
      assert :ok = ContainerRespawn.schedule(entity.id)

      # Wait for respawn to execute
      Process.sleep(100)

      # Check that contents were regenerated
      schema = Entities.get_entity(entity.id)
      entity = Entities.to_entity(schema)
      container = Container.get_container(entity)

      assert length(container.contents) > 0
      assert Enum.all?(container.contents, &(&1 == "sheng_jiang"))
    end
  end
end
