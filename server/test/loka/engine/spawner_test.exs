defmodule Loka.Engine.SpawnerTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.{Spawner, Entities, Entity}

  # In V2, prototypes are entities in the database.
  # Create test prototypes in setup.
  setup do
    # Base NPC prototype (parent for goblin)
    base_npc =
      Entity.new(
        type: :npc,
        key: "base_npc",
        short_desc: "Base NPC",
        is_prototype: true,
        tags: ["npc"],
        components: %{"combatant" => %{"level" => 1, "health" => 50}}
      )

    {:ok, _} = Entities.save(base_npc)
    for tag <- base_npc.tags, do: Entities.add_tag(base_npc.id, tag)

    # Goblin prototype (child of base_npc)
    goblin =
      Entity.new(
        type: :npc,
        key: "goblin",
        short_desc: "Goblin",
        extra_desc: "A menacing goblin.",
        is_prototype: true,
        tags: ["npc", "hostile"],
        components: %{
          "combatant" => %{"level" => 2, "health" => 30},
          "loot" => %{"table" => "goblin_loot"}
        },
        metadata: %{prototype_key: "goblin"}
      )

    {:ok, _} = Entities.save(goblin)
    for tag <- goblin.tags, do: Entities.add_tag(goblin.id, tag)

    # Town square room prototype (with exits)
    town_square =
      Entity.new(
        type: :room,
        key: "town_square",
        short_desc: "Town Square",
        extra_desc: "A bustling town square.",
        is_prototype: true,
        tags: ["town"],
        components: %{
          "coordinates" => %{"x" => 0, "y" => 0, "z" => 0},
          "exits" => %{
            "north" => %{"destination_key" => "general_store"},
            "east" => %{"destination_key" => "tavern"}
          }
        }
      )

    {:ok, _} = Entities.save(town_square)
    for tag <- town_square.tags, do: Entities.add_tag(town_square.id, tag)

    # General store room prototype
    general_store =
      Entity.new(
        type: :room,
        key: "general_store",
        short_desc: "General Store",
        is_prototype: true,
        components: %{"coordinates" => %{"x" => 0, "y" => 1, "z" => 0}}
      )

    {:ok, _} = Entities.save(general_store)

    # Tavern room prototype
    tavern =
      Entity.new(
        type: :room,
        key: "tavern",
        short_desc: "Tavern",
        is_prototype: true,
        components: %{"coordinates" => %{"x" => 1, "y" => 0, "z" => 0}}
      )

    {:ok, _} = Entities.save(tavern)

    # Forest clearing room prototype (with spawns)
    forest_clearing =
      Entity.new(
        type: :room,
        key: "forest_clearing",
        short_desc: "Forest Clearing",
        extra_desc: "A sunlit clearing in the forest.",
        is_prototype: true,
        tags: ["forest"],
        components: %{
          "coordinates" => %{"x" => 5, "y" => 5, "z" => 0},
          "exits" => %{
            "south" => %{"destination_key" => "town_square"}
          },
          "spawns" => [
            %{"prototype" => "goblin"},
            %{"prototype" => "goblin", "short_desc" => "Goblin Scout"}
          ]
        }
      )

    {:ok, _} = Entities.save(forest_clearing)
    for tag <- forest_clearing.tags, do: Entities.add_tag(forest_clearing.id, tag)

    # Test corridor template prototype
    test_corridor =
      Entity.new(
        type: :room,
        key: "test_corridor",
        short_desc: "Test Corridor",
        is_prototype: true,
        tags: ["dungeon", "corridor"],
        components: %{
          "coordinates" => %{"x" => 0, "y" => 0, "z" => 0}
        },
        metadata: %{"is_template" => true}
      )

    {:ok, _} = Entities.save(test_corridor)
    for tag <- test_corridor.tags, do: Entities.add_tag(test_corridor.id, tag)

    :ok
  end

  describe "spawn/2" do
    test "spawns entity from valid prototype" do
      assert {:ok, entity} = Spawner.spawn("goblin")

      assert entity.type == :npc
      # Key equals prototype key (UUID provides instance uniqueness)
      assert entity.key == "goblin"
      assert entity.short_desc == "Goblin"
      assert entity.id != nil

      # Verify persisted to database
      assert schema = Entities.get_entity(entity.id)
      assert schema.key == "goblin"
    end

    test "spawns entity with location_id option" do
      # Create a room first
      {:ok, room} = Spawner.spawn("town_square")

      {:ok, goblin} = Spawner.spawn("goblin", location_id: room.id)

      assert goblin.location_id == room.id
    end

    test "spawns entity with short_desc override" do
      {:ok, entity} = Spawner.spawn("goblin", short_desc: "Elite Goblin")

      assert entity.short_desc == "Elite Goblin"
      # Key equals prototype key
      assert entity.key == "goblin"
    end

    test "spawns entity with extra_desc override" do
      {:ok, entity} = Spawner.spawn("goblin", extra_desc: "A very scary goblin.")

      assert entity.extra_desc == "A very scary goblin."
    end

    test "spawns entity with component override" do
      {:ok, entity} =
        Spawner.spawn("goblin",
          components: %{"combatant" => %{"level" => 10}}
        )

      # Components are deep-merged from prototype
      assert entity.components["combatant"]["level"] == 10
    end

    test "spawns entity with attributes from prototype" do
      {:ok, entity} = Spawner.spawn("goblin")

      # Check that the entity was created successfully
      assert entity.type == :npc
    end

    test "spawns entity with tag override" do
      {:ok, entity} = Spawner.spawn("goblin", tags: ["elite"])

      # Tags are appended from prototype
      assert "elite" in entity.tags
    end

    test "inherits from parent prototype" do
      {:ok, entity} = Spawner.spawn("goblin")

      # Should have tags from goblin prototype
      assert "npc" in entity.tags
      assert "hostile" in entity.tags
    end

    test "returns error for unknown prototype" do
      assert {:error, :not_found} = Spawner.spawn("nonexistent_prototype")
    end

    test "generates unique entity ids" do
      {:ok, entity1} = Spawner.spawn("goblin")
      {:ok, entity2} = Spawner.spawn("goblin")

      assert entity1.id != entity2.id
    end

    test "sets metadata with prototype key" do
      {:ok, entity} = Spawner.spawn("goblin")

      # Metadata uses atom keys
      assert entity.metadata[:prototype_key] == "goblin"
    end
  end

  describe "spawn_at/3" do
    test "spawns entity at specified location" do
      {:ok, room} = Spawner.spawn("town_square")
      {:ok, entity} = Spawner.spawn_at("goblin", room.id)

      assert entity.location_id == room.id
    end

    test "accepts additional options" do
      {:ok, room} = Spawner.spawn("town_square")
      {:ok, entity} = Spawner.spawn_at("goblin", room.id, short_desc: "Guard Goblin")

      assert entity.location_id == room.id
      assert entity.short_desc == "Guard Goblin"
    end
  end

  describe "spawn_room/2" do
    test "spawns room entity" do
      {:ok, room, _spawned} = Spawner.spawn_room("town_square")

      assert room.type == :room
      assert room.key == "town_square"
      assert room.short_desc == "Town Square"
    end

    test "spawns exits defined in prototype" do
      {:ok, room, spawned} = Spawner.spawn_room("town_square")

      exits = Enum.filter(spawned, &(&1.type == :exit))

      # town_square has exits: north (general_store) and east (tavern)
      assert length(exits) == 2

      # Exit data is stored in components["exit"]
      directions = Enum.map(exits, & &1.components["exit"]["direction"])
      assert "north" in directions
      assert "east" in directions

      # Verify exits are placed in the room
      assert Enum.all?(exits, &(&1.location_id == room.id))
    end

    test "spawns entities defined in spawns list" do
      {:ok, room, spawned} = Spawner.spawn_room("forest_clearing")

      # forest_clearing has 2 goblins and exits
      npcs = Enum.filter(spawned, &(&1.type == :npc))

      assert length(npcs) == 2

      # One should have the overridden short_desc
      names = Enum.map(npcs, & &1.short_desc)
      assert "Goblin" in names
      assert "Goblin Scout" in names

      # All spawned entities should be in the room
      assert Enum.all?(npcs, &(&1.location_id == room.id))
    end

    test "returns room and all spawned entities" do
      {:ok, room, spawned} = Spawner.spawn_room("forest_clearing")

      assert %Entity{} = room
      assert is_list(spawned)
      assert spawned != []
    end

    test "returns error for non-room prototype" do
      assert {:error, {:invalid_type, _}} = Spawner.spawn_room("goblin")
    end

    test "returns error for unknown prototype" do
      assert {:error, :not_found} = Spawner.spawn_room("nonexistent_room")
    end

    test "exits have correct components" do
      {:ok, _room, spawned} = Spawner.spawn_room("town_square")

      exits = Enum.filter(spawned, &(&1.type == :exit))
      north_exit = Enum.find(exits, &(&1.components["exit"]["direction"] == "north"))

      assert north_exit.components["exit"]["destination_key"] == "general_store"
      assert "exit" in north_exit.tags
    end
  end

  describe "despawn/1" do
    test "deletes entity by id" do
      {:ok, entity} = Spawner.spawn("goblin")

      assert :ok = Spawner.despawn(entity.id)
      assert Entities.get_entity(entity.id) == nil
    end

    test "deletes entity struct" do
      {:ok, entity} = Spawner.spawn("goblin")

      assert :ok = Spawner.despawn(entity)
      assert Entities.get_entity(entity.id) == nil
    end

    test "deletes entity schema" do
      {:ok, entity} = Spawner.spawn("goblin")
      schema = Entities.get_entity(entity.id)

      assert :ok = Spawner.despawn(schema)
      assert Entities.get_entity(entity.id) == nil
    end

    test "returns error for nonexistent entity" do
      assert {:error, :not_found} = Spawner.despawn("nonexistent-id")
    end
  end

  describe "spawn_from_template/2" do
    test "spawns room from template prototype" do
      {:ok, room} = Spawner.spawn_from_template("test_corridor", x: 5, y: 3)

      assert room.type == :room
      assert String.starts_with?(room.key, "test_corridor_")
      assert room.short_desc == "Test Corridor"
      assert "dungeon" in room.tags
      assert "corridor" in room.tags

      # Verify coordinates
      coords = room.components["coordinates"]
      assert coords["x"] == 5
      assert coords["y"] == 3
      assert coords["z"] == 0
    end

    test "spawns template with short_desc override" do
      {:ok, room} = Spawner.spawn_from_template("test_corridor", short_desc: "North Corridor")

      assert room.short_desc == "North Corridor"
    end

    test "spawns template with custom key" do
      {:ok, room} = Spawner.spawn_from_template("test_corridor", key: "corridor_a1")

      assert room.key == "corridor_a1"
    end

    test "spawns template with additional tags" do
      {:ok, room} = Spawner.spawn_from_template("test_corridor", tags: ["secret"])

      assert "dungeon" in room.tags
      assert "corridor" in room.tags
      assert "secret" in room.tags
    end

    test "spawns template with component override" do
      {:ok, room} =
        Spawner.spawn_from_template("test_corridor",
          components: %{"lighting" => %{"level" => "bright"}}
        )

      assert room.components["lighting"]["level"] == "bright"
    end

    test "generates unique ids for each spawn (keys match prototype)" do
      {:ok, room1} = Spawner.spawn_from_template("test_corridor", x: 1, y: 1)
      {:ok, room2} = Spawner.spawn_from_template("test_corridor", x: 2, y: 1)

      # Keys can be the same (both from same prototype) but IDs are unique
      assert room1.id != room2.id
    end

    test "returns error for non-template prototype" do
      assert {:error, {:not_a_template, _}} = Spawner.spawn_from_template("town_square")
    end

    test "returns error for unknown prototype" do
      assert {:error, :not_found} = Spawner.spawn_from_template("nonexistent_template")
    end

    test "persists spawned room to database" do
      {:ok, room} = Spawner.spawn_from_template("test_corridor")

      assert schema = Entities.get_entity(room.id)
      # Schema stores type as atom
      assert schema.type == :room
    end
  end

  describe "draft flag propagation" do
    test "spawned entity carries draft flag when prototype is a draft" do
      # Create a draft NPC prototype in the database
      draft_proto =
        Entity.new(
          type: :npc,
          key: "draft_goblin",
          short_desc: "Draft Goblin",
          is_prototype: true,
          metadata: %{"draft" => true},
          tags: ["hostile"]
        )

      {:ok, _} = Entities.save(draft_proto)

      {:ok, entity} = Spawner.spawn("draft_goblin")

      assert Entity.draft?(entity)
      assert entity.metadata["draft"] == true
    end

    test "spawned entity does NOT carry draft flag when prototype is published" do
      {:ok, entity} = Spawner.spawn("goblin")

      refute Entity.draft?(entity)
      refute entity.metadata["draft"]
    end

    test "spawn_room propagates draft flag from draft room prototype" do
      draft_room =
        Entity.new(
          type: :room,
          key: "draft_room",
          short_desc: "Draft Room",
          is_prototype: true,
          metadata: %{"draft" => true}
        )

      {:ok, _} = Entities.save(draft_room)

      {:ok, room, _spawned} = Spawner.spawn_room("draft_room")

      assert Entity.draft?(room)
      assert room.metadata["draft"] == true
    end
  end

  describe "integration" do
    test "spawned entities can be queried from database" do
      {:ok, room} = Spawner.spawn("town_square")
      {:ok, goblin1} = Spawner.spawn_at("goblin", room.id)
      {:ok, goblin2} = Spawner.spawn_at("goblin", room.id, name: "Goblin Boss")

      contents = Entities.get_contents(room.id)

      assert length(contents) == 2
      ids = Enum.map(contents, & &1.id)
      assert goblin1.id in ids
      assert goblin2.id in ids
    end

    test "spawn_room creates consistent world state" do
      {:ok, room, spawned} = Spawner.spawn_room("forest_clearing")

      # Verify room is in database
      assert Entities.get_entity(room.id) != nil

      # Verify all spawned entities are in database
      for entity <- spawned do
        assert Entities.get_entity(entity.id) != nil
      end

      # Verify contents relationship
      contents = Entities.get_contents(room.id)
      assert length(contents) == length(spawned)
    end

    test "can spawn multiple rooms" do
      {:ok, room1, _} = Spawner.spawn_room("town_square")
      {:ok, room2, _} = Spawner.spawn_room("forest_clearing")

      assert room1.id != room2.id

      rooms = Entities.list_entities(type: :room)
      room_ids = Enum.map(rooms, & &1.id)

      assert room1.id in room_ids
      assert room2.id in room_ids
    end
  end
end
