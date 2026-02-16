defmodule Loka.Behaviors.NpcAmbientTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.NpcAmbient
  alias Loka.Engine.Entity

  defp npc_entity(opts \\ %{}) do
    idle_emotes = Map.get(opts, :idle_emotes, [])
    config = Map.get(opts, :config, %{})
    location_id = Map.get(opts, :location_id, "room_1")

    %Entity{
      id: "npc_1",
      type: :npc,
      key: "temple_cat",
      location_id: location_id,
      components: %{
        "emotes" => %{"idle" => idle_emotes},
        "behavior_config" => %{"npc_ambient" => config}
      }
    }
  end

  describe "on_tick/1" do
    test "returns {:ok, entity} with no idle emotes" do
      entity = npc_entity()
      assert {:ok, ^entity} = NpcAmbient.on_tick(entity)
    end

    test "returns {:ok, entity} with empty idle emotes" do
      entity = npc_entity(%{idle_emotes: []})
      assert {:ok, ^entity} = NpcAmbient.on_tick(entity)
    end

    test "returns {:ok, entity} when emit_chance is 0" do
      entity =
        npc_entity(%{
          idle_emotes: ["The cat purrs softly."],
          config: %{"emit_chance" => 0.0}
        })

      assert {:ok, ^entity} = NpcAmbient.on_tick(entity)
    end

    test "returns {:ok, entity} without location_id" do
      entity =
        npc_entity(%{
          idle_emotes: ["The cat purrs softly."],
          config: %{"emit_chance" => 1.0},
          location_id: nil
        })

      # Should not crash even with emit_chance 1.0 and no location
      assert {:ok, ^entity} = NpcAmbient.on_tick(entity)
    end
  end

  describe "on_event/3" do
    test "passes through all events" do
      entity = npc_entity()
      assert {:ok, ^entity} = NpcAmbient.on_event(entity, :damage, %{})
    end
  end
end
