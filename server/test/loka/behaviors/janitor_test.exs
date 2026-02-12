defmodule Loka.Behaviors.JanitorTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Janitor
  alias Loka.Engine.Entity

  describe "on_event/3 with :item_dropped" do
    test "ignores nil item" do
      janitor = %Entity{
        id: "jan1",
        type: :npc,
        key: "sweeper",
        location_id: "room1",
        components: %{
          "behavior_config" => %{"janitor" => %{}}
        }
      }

      assert {:ok, _} = Janitor.on_event(janitor, :item_dropped, %{item: nil})
    end

    test "ignores item in different room" do
      janitor = %Entity{
        id: "jan1",
        type: :npc,
        key: "sweeper",
        location_id: "room1",
        components: %{
          "behavior_config" => %{"janitor" => %{}}
        }
      }

      item = %Entity{
        id: "item1",
        type: :item,
        key: "trash",
        location_id: "room2",
        tags: ["trash"]
      }

      assert {:ok, _} = Janitor.on_event(janitor, :item_dropped, %{item: item})
    end

    test "ignores non-trash item in same room" do
      janitor = %Entity{
        id: "jan1",
        type: :npc,
        key: "sweeper",
        location_id: "room1",
        components: %{
          "behavior_config" => %{"janitor" => %{}}
        }
      }

      item = %Entity{
        id: "item1",
        type: :item,
        key: "sword",
        location_id: "room1",
        tags: ["weapon"]
      }

      assert {:ok, _} = Janitor.on_event(janitor, :item_dropped, %{item: item})
    end
  end

  describe "on_event/3 with other events" do
    test "passes through unhandled events" do
      janitor = %Entity{
        id: "jan1",
        type: :npc,
        key: "sweeper",
        components: %{
          "behavior_config" => %{"janitor" => %{}}
        }
      }

      assert {:ok, _} = Janitor.on_event(janitor, :unknown, %{})
    end
  end

  describe "on_init/1" do
    test "initializes without crashing" do
      janitor = %Entity{
        id: "jan1",
        type: :npc,
        key: "sweeper",
        components: %{
          "behavior_config" => %{"janitor" => %{}}
        }
      }

      assert {:ok, ^janitor} = Janitor.on_init(janitor)
    end
  end
end
