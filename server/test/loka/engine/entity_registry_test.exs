defmodule Loka.Engine.EntityRegistryTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.EntityRegistry
  alias Loka.Engine.EntityServer

  import Loka.EngineFixtures

  # Create isolated registry and supervisor for each test
  setup do
    # Create unique names for this test
    test_id = System.unique_integer([:positive])
    registry_name = :"test_registry_#{test_id}"
    supervisor_name = :"test_supervisor_#{test_id}"

    # Start the Elixir Registry
    {:ok, _} = Registry.start_link(keys: :unique, name: registry_name)

    # Start the DynamicSupervisor
    {:ok, _} =
      DynamicSupervisor.start_link(
        strategy: :one_for_one,
        name: supervisor_name
      )

    # Start the EntityRegistry GenServer
    {:ok, registry_pid} =
      EntityRegistry.start_link(
        name: :"entity_registry_#{test_id}",
        registry: registry_name,
        supervisor: supervisor_name
      )

    opts = [registry: registry_name, supervisor: supervisor_name]

    on_exit(fn ->
      # Cleanup
      if Process.alive?(registry_pid), do: GenServer.stop(registry_pid)
    end)

    {:ok, opts: opts, registry_pid: registry_pid}
  end

  describe "get_or_start/2" do
    test "starts a new process for entity", %{opts: opts} do
      entity = entity_fixture()

      assert {:ok, pid} = EntityRegistry.get_or_start(entity.id, opts)
      assert Process.alive?(pid)

      # Clean up
      EntityServer.stop(pid)
    end

    test "returns existing process on second call", %{opts: opts} do
      entity = entity_fixture()

      {:ok, pid1} = EntityRegistry.get_or_start(entity.id, opts)
      {:ok, pid2} = EntityRegistry.get_or_start(entity.id, opts)

      assert pid1 == pid2

      EntityServer.stop(pid1)
    end

    test "returns error for non-existent entity", %{opts: opts} do
      fake_id = Ecto.UUID.generate()

      assert {:error, {:error, :entity_not_found}} =
               EntityRegistry.get_or_start(fake_id, opts)
    end
  end

  describe "lookup/2" do
    test "finds active process", %{opts: opts} do
      entity = entity_fixture()

      {:ok, pid} = EntityRegistry.get_or_start(entity.id, opts)
      assert {:ok, ^pid} = EntityRegistry.lookup(entity.id, opts)

      EntityServer.stop(pid)
    end

    test "returns not_found for inactive entity", %{opts: opts} do
      entity = entity_fixture()

      assert :not_found = EntityRegistry.lookup(entity.id, opts)
    end

    test "returns not_found after process stops", %{opts: opts} do
      entity = entity_fixture()

      {:ok, pid} = EntityRegistry.get_or_start(entity.id, opts)
      EntityServer.stop(pid)

      # Wait for process to fully stop
      Process.sleep(50)

      assert :not_found = EntityRegistry.lookup(entity.id, opts)
    end
  end

  describe "stop/2" do
    test "stops active process", %{opts: opts} do
      entity = entity_fixture()

      {:ok, pid} = EntityRegistry.get_or_start(entity.id, opts)
      assert Process.alive?(pid)

      :ok = EntityRegistry.stop(entity.id, opts)

      # Wait for process to stop
      Process.sleep(50)
      refute Process.alive?(pid)
    end

    test "returns error for inactive entity", %{opts: opts} do
      entity = entity_fixture()

      assert {:error, :not_found} = EntityRegistry.stop(entity.id, opts)
    end
  end

  describe "list_active/1" do
    test "returns empty list when no processes", %{opts: opts} do
      assert [] = EntityRegistry.list_active(opts)
    end

    test "returns active entity IDs", %{opts: opts} do
      entity1 = entity_fixture()
      entity2 = entity_fixture()

      {:ok, pid1} = EntityRegistry.get_or_start(entity1.id, opts)
      {:ok, pid2} = EntityRegistry.get_or_start(entity2.id, opts)

      active = EntityRegistry.list_active(opts)

      assert entity1.id in active
      assert entity2.id in active
      assert length(active) == 2

      EntityServer.stop(pid1)
      EntityServer.stop(pid2)
    end
  end

  describe "count_active/1" do
    test "returns 0 when no processes", %{opts: opts} do
      assert 0 = EntityRegistry.count_active(opts)
    end

    test "returns count of active processes", %{opts: opts} do
      entity1 = entity_fixture()
      entity2 = entity_fixture()

      {:ok, pid1} = EntityRegistry.get_or_start(entity1.id, opts)
      assert EntityRegistry.count_active(opts) == 1

      {:ok, pid2} = EntityRegistry.get_or_start(entity2.id, opts)
      assert EntityRegistry.count_active(opts) == 2

      EntityServer.stop(pid1)
      EntityServer.stop(pid2)
    end
  end

  describe "broadcast_to_entity/3" do
    test "sends event to active entity", %{opts: opts} do
      entity = entity_fixture()

      {:ok, pid} = EntityRegistry.get_or_start(entity.id, opts)

      event = %Loka.Engine.Event{
        type: :test,
        payload: %{data: "test"},
        source: "source_id",
        target: entity.id
      }

      assert :ok = EntityRegistry.broadcast_to_entity(entity.id, event, opts)

      # Give time for the event to be processed
      Process.sleep(10)

      # Entity should be marked dirty from receiving event
      assert EntityServer.dirty?(pid)

      EntityServer.stop(pid)
    end

    test "returns not_active for inactive entity", %{opts: opts} do
      entity = entity_fixture()

      event = %Loka.Engine.Event{
        type: :test,
        payload: %{},
        source: nil,
        target: entity.id
      }

      assert :not_active = EntityRegistry.broadcast_to_entity(entity.id, event, opts)
    end
  end

  describe "room occupancy tracking" do
    test "register and unregister in room", %{registry_pid: registry_pid} do
      :ok = EntityRegistry.register_in_room("entity_1", "room_1", registry_pid)
      :ok = EntityRegistry.register_in_room("entity_2", "room_1", registry_pid)

      occupants = EntityRegistry.get_room_occupants("room_1", registry_pid)

      assert "entity_1" in occupants
      assert "entity_2" in occupants
      assert length(occupants) == 2

      :ok = EntityRegistry.unregister_from_room("entity_1", "room_1", registry_pid)

      occupants = EntityRegistry.get_room_occupants("room_1", registry_pid)
      assert occupants == ["entity_2"]
    end

    test "get_room_occupants returns empty for unknown room", %{registry_pid: registry_pid} do
      assert [] = EntityRegistry.get_room_occupants("nonexistent_room", registry_pid)
    end

    test "multiple rooms tracked separately", %{registry_pid: registry_pid} do
      :ok = EntityRegistry.register_in_room("entity_1", "room_1", registry_pid)
      :ok = EntityRegistry.register_in_room("entity_2", "room_2", registry_pid)

      assert ["entity_1"] = EntityRegistry.get_room_occupants("room_1", registry_pid)
      assert ["entity_2"] = EntityRegistry.get_room_occupants("room_2", registry_pid)
    end
  end

  describe "broadcast_to_room/3" do
    test "sends event to all active entities in room", %{opts: opts} do
      room = room_fixture()
      npc1 = entity_fixture(%{type: :npc, location_id: room.id})
      npc2 = entity_fixture(%{type: :npc, location_id: room.id})
      _npc_elsewhere = entity_fixture(%{type: :npc})

      # Start only npc1 and npc2
      {:ok, pid1} = EntityRegistry.get_or_start(npc1.id, opts)
      {:ok, pid2} = EntityRegistry.get_or_start(npc2.id, opts)

      event = %Loka.Engine.Event{
        type: :room_event,
        payload: %{message: "Hello room!"},
        location: room.id
      }

      :ok = EntityRegistry.broadcast_to_room(room.id, event, opts)

      # Give time for events to process
      Process.sleep(20)

      # Both entities should be dirty from receiving the event
      assert EntityServer.dirty?(pid1)
      assert EntityServer.dirty?(pid2)

      EntityServer.stop(pid1)
      EntityServer.stop(pid2)
    end

    test "skips inactive entities", %{opts: opts} do
      room = room_fixture()
      npc1 = entity_fixture(%{type: :npc, location_id: room.id})
      _npc2 = entity_fixture(%{type: :npc, location_id: room.id})

      # Only start npc1
      {:ok, pid1} = EntityRegistry.get_or_start(npc1.id, opts)

      event = %Loka.Engine.Event{
        type: :room_event,
        payload: %{},
        location: room.id
      }

      # Should not crash even though npc2 is not active
      :ok = EntityRegistry.broadcast_to_room(room.id, event, opts)

      EntityServer.stop(pid1)
    end
  end
end
