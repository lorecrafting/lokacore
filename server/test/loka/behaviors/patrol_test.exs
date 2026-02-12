defmodule Loka.Behaviors.PatrolTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Patrol
  alias Loka.Engine.Entity

  describe "on_event/3" do
    test "passes through all events" do
      entity = %Entity{
        id: "npc1",
        type: :npc,
        key: "patrol_guard",
        components: %{
          "behavior_config" => %{
            "patrol" => %{"path" => ["room_a", "room_b"]}
          }
        }
      }

      assert {:ok, _} = Patrol.on_event(entity, :entity_entered, %{entity: nil})
      assert {:ok, _} = Patrol.on_event(entity, :damage_taken, %{})
    end
  end

  describe "on_init/1" do
    test "initializes without crashing" do
      # Volatile state won't persist outside EntityServer, but on_init should not crash
      entity = %Entity{
        id: "npc1",
        type: :npc,
        key: "patrol_guard",
        location_id: nil,
        components: %{
          "behavior_config" => %{
            "patrol" => %{
              "path" => ["room_a", "room_b", "room_c"],
              "start_index" => 0
            }
          }
        }
      }

      assert {:ok, ^entity} = Patrol.on_init(entity)
    end
  end

  describe "on_tick/1" do
    test "returns {:ok, entity} without crashing" do
      # on_tick uses Volatile state which needs EntityServer context,
      # but it should not crash when called in isolation
      entity = %Entity{
        id: "npc1",
        type: :npc,
        key: "patrol_guard",
        components: %{
          "behavior_config" => %{
            "patrol" => %{"path" => ["room_a", "room_b"]}
          }
        }
      }

      assert {:ok, _} = Patrol.on_tick(entity)
    end
  end
end
