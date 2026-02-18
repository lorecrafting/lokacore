defmodule Loka.Engine.SpawnSmokeTest do
  @moduledoc """
  Lightweight smoke test that exercises the full prototype → spawn pipeline
  against production YAML prototypes. Catches prototype/runtime drift that
  unit tests with test fixtures won't detect.

  TODO: Re-enable when Grove content is built (Phase 1 rooms + NPCs + items).
  Update test keys to use Grove prototype keys (e.g. awakening_clearing, thera, etc.)
  """
  use Loka.DataCase, async: false

  alias Loka.Engine.{Spawner, Entities}

  # Skipped: no production content exists yet — monastery deleted, Grove not built
  # Remove this tag and update keys when Phase 1 rooms/NPCs/items are committed
  @moduletag :skip
  @moduletag :smoke

  setup do
    {:ok, _} = Loka.Engine.EntitySeeder.seed()
    :ok
  end

  describe "production prototype spawning" do
    test "spawns a room prototype with correct structure" do
      # TODO: replace with Grove room key e.g. "awakening_clearing"
      assert {:ok, room} = Spawner.spawn("awakening_clearing")
      assert room.type == :room
      assert room.id != nil
      assert Entities.get_entity(room.id) != nil
    end

    test "spawns an NPC prototype with correct structure" do
      # TODO: replace with Grove NPC key e.g. "thera"
      assert {:ok, npc} = Spawner.spawn("thera")
      assert npc.type == :npc
      assert npc.id != nil
      assert Entities.get_entity(npc.id) != nil
    end

    test "spawns an item prototype with correct structure" do
      # TODO: replace with a Grove item key e.g. "thera_pendant"
      assert {:ok, item} = Spawner.spawn("thera_pendant")
      assert item.type == :item
      assert item.id != nil
      assert Entities.get_entity(item.id) != nil
    end
  end

  describe "spawn_room pipeline" do
    test "spawns a starting room with all contents (exits, NPCs, items)" do
      # TODO: replace with Grove starting room key
      assert {:ok, room, spawned} = Spawner.spawn_room("awakening_clearing")
      assert room.type == :room
      assert Enum.all?(spawned, &(&1.location_id == room.id))

      for entity <- [room | spawned] do
        assert Entities.get_entity(entity.id) != nil
      end
    end
  end

  describe "prototype inheritance" do
    test "parent fields are resolved for production NPCs" do
      assert {:ok, npc} = Spawner.spawn("thera")
      assert is_list(npc.tags)
      assert npc.metadata[:prototype_key] == "thera"
    end

    test "parent fields are resolved for production rooms" do
      assert {:ok, room} = Spawner.spawn("awakening_clearing")
      assert "room" in room.tags
      assert room.metadata[:prototype_key] == "awakening_clearing"
    end
  end
end
