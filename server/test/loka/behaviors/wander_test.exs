defmodule Loka.Behaviors.WanderTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Wander
  alias Loka.Engine.Entity

  describe "on_event/3" do
    test "passes through all events" do
      entity = %Entity{
        id: "npc1",
        type: :npc,
        key: "temple_cat",
        components: %{
          "behavior_config" => %{
            "wander" => %{"allowed_rooms" => ["courtyard", "garden"]}
          }
        }
      }

      assert {:ok, _} = Wander.on_event(entity, :entity_entered, %{entity: nil})
      assert {:ok, _} = Wander.on_event(entity, :damage_taken, %{})
    end
  end

  describe "on_init/1" do
    test "initializes without crashing" do
      entity = %Entity{
        id: "npc1",
        type: :npc,
        key: "temple_cat",
        components: %{
          "behavior_config" => %{
            "wander" => %{
              "allowed_rooms" => ["courtyard", "garden", "kitchen"]
            }
          }
        }
      }

      assert {:ok, ^entity} = Wander.on_init(entity)
    end
  end

  describe "on_tick/1" do
    test "returns {:ok, entity} without crashing" do
      entity = %Entity{
        id: "npc1",
        type: :npc,
        key: "temple_cat",
        components: %{
          "behavior_config" => %{
            "wander" => %{
              "allowed_rooms" => ["courtyard", "garden"],
              "move_chance" => 0.0
            }
          }
        }
      }

      # move_chance is 0, so it won't try to move
      assert {:ok, _} = Wander.on_tick(entity)
    end
  end
end
