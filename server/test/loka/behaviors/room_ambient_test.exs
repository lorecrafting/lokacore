defmodule Loka.Behaviors.RoomAmbientTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.RoomAmbient
  alias Loka.Engine.Entity

  defp room_entity(opts \\ %{}) do
    ambient_messages = Map.get(opts, :ambient_messages, [])
    config = Map.get(opts, :config, %{})

    %Entity{
      id: "room_1",
      type: :room,
      key: "temple_courtyard",
      components: %{
        "emotes" => %{"ambient" => ambient_messages},
        "behavior_config" => %{"room_ambient" => config}
      }
    }
  end

  describe "on_tick/1" do
    test "returns {:ok, entity} with no ambient messages" do
      entity = room_entity()
      assert {:ok, ^entity} = RoomAmbient.on_tick(entity)
    end

    test "returns {:ok, entity} with empty ambient messages" do
      entity = room_entity(%{ambient_messages: []})
      assert {:ok, ^entity} = RoomAmbient.on_tick(entity)
    end

    test "returns {:ok, entity} when emit_chance is 0" do
      entity =
        room_entity(%{
          ambient_messages: ["Wind rustles through the leaves."],
          config: %{"emit_chance" => 0.0}
        })

      assert {:ok, ^entity} = RoomAmbient.on_tick(entity)
    end
  end

  describe "on_event/3" do
    test "passes through all events" do
      entity = room_entity()
      assert {:ok, ^entity} = RoomAmbient.on_event(entity, :entity_entered, %{})
    end
  end
end
