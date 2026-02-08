defmodule Loka.Engine.SpawnSmokeTest do
  @moduledoc """
  Lightweight smoke test that exercises the full prototype → spawn pipeline
  against production YAML prototypes. Catches prototype/runtime drift that
  unit tests with test fixtures won't detect.
  """
  use Loka.DataCase, async: false

  alias Loka.Engine.{Spawner, Entities}

  @moduletag :smoke

  setup do
    :ok
  end

  describe "production prototype spawning" do
    test "spawns starting room (monastery_gate) with correct structure" do
      assert {:ok, room} = Spawner.spawn("monastery_gate")

      assert room.type == :room
      assert room.key == "monastery_gate"
      assert room.short_desc == "Monastery Gate"
      assert room.id != nil
      assert "starting_room" in room.tags

      # Persisted to database
      assert Entities.get_entity(room.id) != nil
    end

    test "spawns NPC (novice_pema) with correct structure" do
      assert {:ok, npc} = Spawner.spawn("novice_pema")

      assert npc.type == :npc
      assert npc.key == "novice_pema"
      assert npc.id != nil
      assert npc.short_desc != nil

      assert Entities.get_entity(npc.id) != nil
    end

    test "spawns item (prayer_beads) with correct structure" do
      assert {:ok, item} = Spawner.spawn("prayer_beads")

      assert item.type == :item
      assert item.key == "prayer_beads"
      assert item.id != nil
      assert item.short_desc != nil

      assert Entities.get_entity(item.id) != nil
    end
  end

  describe "spawn_room pipeline" do
    test "spawns starting room with all contents (exits, NPCs, items)" do
      assert {:ok, room, spawned} = Spawner.spawn_room("monastery_gate")

      assert room.type == :room
      assert room.key == "monastery_gate"

      # monastery_gate defines 3 exits: north, south, west
      exits = Enum.filter(spawned, &(&1.type == :exit))
      assert length(exits) == 3

      directions = Enum.map(exits, & &1.components["exit"]["direction"])
      assert "north" in directions
      assert "south" in directions
      assert "west" in directions

      # monastery_gate spawns: novice_pema, prayer_beads, travelers_staff, butter_lamp
      non_exits = Enum.reject(spawned, &(&1.type == :exit))
      assert length(non_exits) == 4

      keys = Enum.map(non_exits, & &1.key)
      assert "novice_pema" in keys
      assert "prayer_beads" in keys
      assert "travelers_staff" in keys
      assert "butter_lamp" in keys

      # All spawned entities are located in the room
      assert Enum.all?(spawned, &(&1.location_id == room.id))

      # All entities persisted
      for entity <- [room | spawned] do
        assert Entities.get_entity(entity.id) != nil
      end
    end
  end

  describe "prototype inheritance" do
    test "parent fields are resolved for production NPCs" do
      assert {:ok, npc} = Spawner.spawn("novice_pema")

      # Should inherit base_npc tags
      assert "npc" in npc.tags
      assert npc.metadata[:prototype_key] == "novice_pema"
    end

    test "parent fields are resolved for production rooms" do
      assert {:ok, room} = Spawner.spawn("monastery_gate")

      # Should inherit base_room tags
      assert "room" in room.tags
      assert room.metadata[:prototype_key] == "monastery_gate"
    end
  end
end
