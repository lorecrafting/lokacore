defmodule Loka.Behaviors.ScavengerTest do
  use Loka.DataCase, async: true

  alias Loka.Behaviors.Scavenger
  alias Loka.Engine.Entity

  defp make_scavenger(config_overrides \\ %{}) do
    config =
      Map.merge(
        %{"prefer_types" => ["weapon", "armor"], "carry_limit" => 10},
        config_overrides
      )

    %Entity{
      id: "scav1",
      type: :npc,
      key: "goblin",
      location_id: "room1",
      components: %{
        "behavior_config" => %{"scavenger" => config}
      }
    }
  end

  describe "on_event/3 with :item_dropped" do
    test "picks up preferred item in same room" do
      scavenger = make_scavenger()

      item = %Entity{
        id: "item1",
        type: :item,
        key: "sword",
        location_id: "room1",
        tags: [],
        components: %{"item" => %{"type" => "weapon"}}
      }

      assert {:halt, _} = Scavenger.on_event(scavenger, :item_dropped, %{item: item})
    end

    test "ignores item in different room" do
      scavenger = make_scavenger()

      item = %Entity{
        id: "item1",
        type: :item,
        key: "sword",
        location_id: "other_room",
        tags: [],
        components: %{"item" => %{"type" => "weapon"}}
      }

      assert {:ok, _} = Scavenger.on_event(scavenger, :item_dropped, %{item: item})
    end

    test "ignores item with ignored tags" do
      scavenger = make_scavenger(%{"ignore_tags" => ["quest_item"]})

      item = %Entity{
        id: "item1",
        type: :item,
        key: "quest_sword",
        location_id: "room1",
        tags: ["quest_item"],
        components: %{"item" => %{"type" => "weapon"}}
      }

      assert {:ok, _} = Scavenger.on_event(scavenger, :item_dropped, %{item: item})
    end

    test "ignores nil item" do
      scavenger = make_scavenger()

      assert {:ok, _} = Scavenger.on_event(scavenger, :item_dropped, %{item: nil})
    end
  end

  describe "on_event/3 with other events" do
    test "passes through unhandled events" do
      scavenger = make_scavenger()

      assert {:ok, _} = Scavenger.on_event(scavenger, :unknown, %{})
    end
  end
end
