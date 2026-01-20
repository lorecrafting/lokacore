defmodule Loka.Framework.Scripting.BehaviorRegistryTest do
  use Loka.DataCase, async: false

  alias Loka.Framework.Scripting.BehaviorRegistry

  describe "on_entity_created/2" do
    test "handles entity with no behaviors" do
      entity = %{
        id: "test-entity-1",
        behaviors: [],
        data: %{}
      }

      assert :ok = BehaviorRegistry.on_entity_created(entity, %{})
    end

    test "handles entity with behaviors in struct field (new format)" do
      entity = %{
        id: "test-entity-2",
        behaviors: [
          %{script: "patrol", config: %{route: ["a", "b", "c"]}},
          %{script: "day_night_schedule", config: %{wake_at: :dawn}}
        ],
        data: %{}
      }

      # Should not raise - registers behaviors
      assert :ok = BehaviorRegistry.on_entity_created(entity, %{})
    end

    test "handles entity with behaviors in data map" do
      entity = %{
        id: "test-entity-3",
        behaviors: [],
        data: %{
          behaviors: [
            %{script: "wander", config: %{range: 5}}
          ]
        }
      }

      assert :ok = BehaviorRegistry.on_entity_created(entity, %{})
    end

    test "handles nil behaviors gracefully" do
      entity = %{
        id: "test-entity-4",
        behaviors: nil,
        data: %{}
      }

      # Should not crash, just return :ok
      assert :ok = BehaviorRegistry.on_entity_created(entity, %{})
    end
  end

  describe "register_behavior/2" do
    test "registers behavior with new format (script/config map)" do
      entity = %{id: "entity-new-1"}
      behavior = %{script: "patrol", config: %{interval: 60}}

      assert :ok = BehaviorRegistry.register_behavior(entity, behavior)
    end

    test "registers behavior with string keys" do
      entity = %{id: "entity-string-1"}
      behavior = %{"script" => "day_night_schedule", "config" => %{"wake_at" => "dawn"}}

      assert :ok = BehaviorRegistry.register_behavior(entity, behavior)
    end

    test "registers legacy module atom format" do
      entity = %{id: "entity-legacy-1"}
      behavior = Loka.Behaviors.Patrol

      # Legacy format still works
      assert :ok = BehaviorRegistry.register_behavior(entity, behavior)
    end

    test "skips invalid behavior formats" do
      entity = %{id: "entity-invalid-1"}

      # These should not crash, just skip
      assert :ok = BehaviorRegistry.register_behavior(entity, nil)
      assert :ok = BehaviorRegistry.register_behavior(entity, 123)
      assert :ok = BehaviorRegistry.register_behavior(entity, [])
    end
  end

  describe "unregister_behaviors/1" do
    test "unregisters behaviors without error" do
      # Should not crash even if entity wasn't registered
      assert :ok = BehaviorRegistry.unregister_behaviors("nonexistent-entity")
    end
  end
end
