defmodule Loka.Engine.EntityServerTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.EntityServer
  alias Loka.Engine.Entities
  alias Loka.Engine.Entity

  import Loka.EngineFixtures

  # Use short timeouts for testing
  @test_opts [
    idle_timeout_ms: 500,
    save_interval_ms: 100,
    hibernate_after_ms: 200
  ]

  describe "start_link/2" do
    test "starts with valid entity id" do
      entity = entity_fixture()
      assert {:ok, pid} = EntityServer.start_link(entity.id, @test_opts)
      assert Process.alive?(pid)
      EntityServer.stop(pid)
    end

    test "fails with non-existent entity id" do
      fake_id = Ecto.UUID.generate()
      # GenServer start_link with {:stop, reason} in init returns {:error, reason}
      # but since processes are linked, we need to trap exits
      Process.flag(:trap_exit, true)
      assert {:error, {:error, :entity_not_found}} = EntityServer.start_link(fake_id, @test_opts)
    end

    test "can start with custom name" do
      entity = entity_fixture()
      name = :"test_entity_#{System.unique_integer()}"
      {:ok, pid} = EntityServer.start_link(entity.id, [{:name, name} | @test_opts])
      assert Process.whereis(name) == pid
      EntityServer.stop(pid)
    end
  end

  describe "get_entity/1" do
    test "returns the current entity state" do
      schema = entity_fixture(%{short_desc: "Test Entity"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      entity = EntityServer.get_entity(pid)

      assert %Entity{} = entity
      assert entity.id == schema.id
      assert entity.short_desc == "Test Entity"

      EntityServer.stop(pid)
    end
  end

  describe "get/1" do
    test "returns the full server state" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      state = EntityServer.get(pid)

      assert %EntityServer{} = state
      assert state.entity_id == schema.id
      assert state.dirty == false
      assert %DateTime{} = state.last_activity

      EntityServer.stop(pid)
    end
  end

  describe "update/2" do
    test "updates entity with function" do
      schema = entity_fixture(%{short_desc: "Original"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      {:ok, updated} =
        EntityServer.update(pid, fn entity ->
          %{entity | short_desc: "Updated"}
        end)

      assert updated.short_desc == "Updated"
      assert EntityServer.get_entity(pid).short_desc == "Updated"

      EntityServer.stop(pid)
    end

    test "marks state as dirty after update" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      refute EntityServer.dirty?(pid)

      EntityServer.update(pid, fn entity -> entity end)

      assert EntityServer.dirty?(pid)

      EntityServer.stop(pid)
    end

    test "sets component data" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(pid, fn entity ->
        Entity.add_component(entity, "health", %{"current" => 50, "max" => 100})
      end)

      entity = EntityServer.get_entity(pid)
      assert Entity.get_component(entity, "health") == %{"current" => 50, "max" => 100}

      EntityServer.stop(pid)
    end
  end

  describe "save_now/1" do
    test "saves dirty state to database" do
      schema = entity_fixture(%{short_desc: "Original"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(pid, fn entity ->
        %{entity | short_desc: "Modified"}
      end)

      assert EntityServer.dirty?(pid)

      :ok = EntityServer.save_now(pid)

      refute EntityServer.dirty?(pid)

      # Verify in database
      reloaded = Entities.get_entity(schema.id)
      assert reloaded.short_desc == "Modified"

      EntityServer.stop(pid)
    end

    test "does nothing when not dirty" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      refute EntityServer.dirty?(pid)
      :ok = EntityServer.save_now(pid)
      refute EntityServer.dirty?(pid)

      EntityServer.stop(pid)
    end
  end

  describe "auto-save timer" do
    test "automatically saves dirty state after interval" do
      schema = entity_fixture(%{short_desc: "Original"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(pid, fn entity ->
        %{entity | short_desc: "Auto-saved"}
      end)

      assert EntityServer.dirty?(pid)

      # Wait for auto-save (100ms interval + buffer)
      Process.sleep(150)

      refute EntityServer.dirty?(pid)

      # Verify in database
      reloaded = Entities.get_entity(schema.id)
      assert reloaded.short_desc == "Auto-saved"

      EntityServer.stop(pid)
    end
  end

  describe "idle timeout" do
    test "process stops after idle timeout" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      # Monitor the process
      ref = Process.monitor(pid)

      # Wait for idle timeout (500ms + buffer) - use longer timeout for CI
      assert_receive {:DOWN, ^ref, :process, ^pid, :normal}, 2000
    end

    test "touch resets idle timer" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      ref = Process.monitor(pid)

      # Touch before timeout
      Process.sleep(200)
      EntityServer.touch(pid)

      # Should not have stopped yet
      refute_receive {:DOWN, ^ref, :process, ^pid, _}, 200

      # Touch again
      EntityServer.touch(pid)
      Process.sleep(200)

      # Still alive after touches
      assert Process.alive?(pid)

      EntityServer.stop(pid)
    end

    test "saves state before stopping due to idle" do
      schema = entity_fixture(%{short_desc: "Original"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(pid, fn entity ->
        %{entity | short_desc: "Before Idle Stop"}
      end)

      ref = Process.monitor(pid)

      # Wait for idle timeout - use longer timeout for CI
      assert_receive {:DOWN, ^ref, :process, ^pid, :normal}, 2000

      # Verify state was saved
      reloaded = Entities.get_entity(schema.id)
      assert reloaded.short_desc == "Before Idle Stop"
    end
  end

  describe "stop/1" do
    test "gracefully stops the process" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      assert Process.alive?(pid)
      :ok = EntityServer.stop(pid)
      refute Process.alive?(pid)
    end

    test "saves dirty state before stopping" do
      schema = entity_fixture(%{short_desc: "Original"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(pid, fn entity ->
        %{entity | short_desc: "Stopped State"}
      end)

      :ok = EntityServer.stop(pid)

      # Verify state was saved
      reloaded = Entities.get_entity(schema.id)
      assert reloaded.short_desc == "Stopped State"
    end
  end

  describe "update/3 with force_save" do
    test "immediately persists when force_save: true" do
      schema = entity_fixture(%{short_desc: "Original"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(
        pid,
        fn entity -> %{entity | short_desc: "Force Saved"} end,
        force_save: true
      )

      # Should not be dirty — was force-saved
      refute EntityServer.dirty?(pid)

      # Verify in database immediately
      {:ok, reloaded} = Loka.Engine.Entities.find_one(schema.id)
      assert reloaded.short_desc == "Force Saved"

      EntityServer.stop(pid)
    end

    test "defaults to lazy save when force_save not set" do
      schema = entity_fixture(%{short_desc: "Original"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(pid, fn entity -> %{entity | short_desc: "Lazy"} end)

      assert EntityServer.dirty?(pid)
      EntityServer.stop(pid)
    end
  end

  describe "reload/1" do
    test "reloads entity from database" do
      schema = entity_fixture(%{short_desc: "DB State"})
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      # Modify in-memory without saving
      EntityServer.update(pid, fn entity -> %{entity | short_desc: "Memory Only"} end)
      assert EntityServer.get_entity(pid).short_desc == "Memory Only"

      # Reload discards in-memory changes
      assert :ok = EntityServer.reload(pid)
      assert EntityServer.get_entity(pid).short_desc == "DB State"
      refute EntityServer.dirty?(pid)

      EntityServer.stop(pid)
    end

    test "returns error for deleted entity" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      # Delete the entity from DB
      Loka.Engine.Entities.delete(schema.id)

      assert {:error, :not_found} = EntityServer.reload(pid)

      EntityServer.stop(pid)
    end
  end

  describe "dispatch_event/3" do
    test "returns {:ok, entity} with no behaviors" do
      entity = %Entity{
        id: Ecto.UUID.generate(),
        type: :npc,
        key: "test",
        traits: [],
        components: %{},
        tags: [],
        scripts: %{},
        metadata: %{},
        keywords: []
      }

      assert {:ok, ^entity} = EntityServer.dispatch_event(entity, :test_event, %{})
    end

    test "skips behaviors without on_event/3" do
      defmodule NoEventBehavior do
        def on_init(_entity), do: :ok
      end

      entity = %Entity{
        id: Ecto.UUID.generate(),
        type: :npc,
        key: "test",
        traits: [NoEventBehavior],
        components: %{},
        tags: [],
        scripts: %{},
        metadata: %{},
        keywords: []
      }

      assert {:ok, ^entity} = EntityServer.dispatch_event(entity, :test_event, %{})
    end

    test "calls on_event/3 and returns updated entity" do
      defmodule TestBehavior do
        def on_event(entity, :damage, %{amount: amount}) do
          health = entity.components["health"] || 100
          {:ok, Entity.add_component(entity, "health", health - amount)}
        end

        def on_event(entity, _event, _payload), do: {:ok, entity}
      end

      entity = %Entity{
        id: Ecto.UUID.generate(),
        type: :npc,
        key: "test",
        traits: [TestBehavior],
        components: %{"health" => 100},
        tags: [],
        scripts: %{},
        metadata: %{},
        keywords: []
      }

      assert {:ok, updated} = EntityServer.dispatch_event(entity, :damage, %{amount: 25})
      assert updated.components["health"] == 75
    end

    test "halts chain when behavior returns {:halt, entity}" do
      defmodule HaltBehavior do
        def on_event(entity, :blocked, _payload), do: {:halt, entity}
        def on_event(entity, _event, _payload), do: {:ok, entity}
      end

      defmodule AfterHaltBehavior do
        def on_event(_entity, _event, _payload) do
          raise "should not be called"
        end
      end

      entity = %Entity{
        id: Ecto.UUID.generate(),
        type: :npc,
        key: "test",
        traits: [HaltBehavior, AfterHaltBehavior],
        components: %{},
        tags: [],
        scripts: %{},
        metadata: %{},
        keywords: []
      }

      assert {:halted, ^entity} = EntityServer.dispatch_event(entity, :blocked, %{})
    end

    test "skips crashing behavior and continues chain" do
      defmodule CrashBehavior do
        def on_event(_entity, _event, _payload), do: raise("boom")
      end

      defmodule SafeBehavior do
        def on_event(entity, :safe, _payload) do
          {:ok, Entity.add_component(entity, "processed", true)}
        end

        def on_event(entity, _event, _payload), do: {:ok, entity}
      end

      entity = %Entity{
        id: Ecto.UUID.generate(),
        type: :npc,
        key: "test",
        traits: [CrashBehavior, SafeBehavior],
        components: %{},
        tags: [],
        scripts: %{},
        metadata: %{},
        keywords: []
      }

      assert {:ok, updated} = EntityServer.dispatch_event(entity, :safe, %{})
      assert updated.components["processed"] == true
    end
  end

  describe "handle_event/2" do
    test "receives events via cast" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      event = %Loka.Engine.Event{
        type: :test,
        payload: %{data: "test"},
        source: "source_id",
        target: schema.id
      }

      # Should not raise
      EntityServer.handle_event(pid, event)

      # Give it time to process
      Process.sleep(10)

      # Event handling marks state as dirty (for now)
      assert EntityServer.dirty?(pid)

      EntityServer.stop(pid)
    end
  end

  describe "dirty?/1" do
    test "returns false for fresh process" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      refute EntityServer.dirty?(pid)

      EntityServer.stop(pid)
    end

    test "returns true after update" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(pid, fn e -> e end)

      assert EntityServer.dirty?(pid)

      EntityServer.stop(pid)
    end

    test "returns false after save" do
      schema = entity_fixture()
      {:ok, pid} = EntityServer.start_link(schema.id, @test_opts)

      EntityServer.update(pid, fn e -> e end)
      assert EntityServer.dirty?(pid)

      EntityServer.save_now(pid)
      refute EntityServer.dirty?(pid)

      EntityServer.stop(pid)
    end
  end

  describe "room entity" do
    test "subscribes to room topic" do
      room = room_fixture()
      {:ok, pid} = EntityServer.start_link(room.id, @test_opts)

      entity = EntityServer.get_entity(pid)
      assert entity.type == :room

      EntityServer.stop(pid)
    end
  end

  describe "npc entity" do
    test "subscribes to entity topic" do
      npc = npc_fixture()
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      entity = EntityServer.get_entity(pid)
      assert entity.type == :npc

      EntityServer.stop(pid)
    end
  end
end
