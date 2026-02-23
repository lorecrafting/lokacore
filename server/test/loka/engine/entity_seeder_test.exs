defmodule Loka.Engine.EntitySeederTest do
  use Loka.DataCase

  alias Loka.Engine.{Entity, Entities, EntitySeeder}

  @test_dir "test/fixtures/seeder_yaml"

  setup do
    # Create a temporary YAML directory for test fixtures
    dir = Path.join(File.cwd!(), @test_dir)
    File.rm_rf!(dir)
    File.mkdir_p!(Path.join(dir, "prototypes/_base"))
    File.mkdir_p!(Path.join(dir, "prototypes/npcs"))
    File.mkdir_p!(Path.join(dir, "prototypes/rooms"))
    File.mkdir_p!(Path.join(dir, "prototypes/items"))
    File.mkdir_p!(Path.join(dir, "quests"))
    File.mkdir_p!(Path.join(dir, "skills"))

    on_exit(fn -> File.rm_rf!(dir) end)

    {:ok, dir: dir}
  end

  # Helper to write a YAML file
  defp write_yaml(dir, subpath, content) do
    path = Path.join(dir, subpath)
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, content)
  end

  # Helper to seed from test fixtures
  defp seed_from(dir) do
    EntitySeeder.do_seed([dir])
  end

  # ==========================================================================
  # Inheritance Resolution
  # ==========================================================================

  # ==========================================================================
  # YAML to Entity Conversion
  # ==========================================================================

  describe "yaml_to_entity/1" do
    test "converts basic NPC YAML to entity" do
      data = %{
        "key" => "goblin",
        "type" => "npc",
        "short_desc" => "a goblin",
        "long_desc" => "A small goblin stands here.",
        "tags" => ["hostile"],
        "components" => %{"combatant" => %{"level" => 3}}
      }

      entity = EntitySeeder.yaml_to_entity(data)

      assert %Entity{} = entity
      assert entity.type == :npc
      assert entity.key == "goblin"
      assert entity.short_desc == "a goblin"
      assert entity.long_desc == "A small goblin stands here."
      assert entity.is_prototype == true
      assert entity.components["combatant"]["level"] == 3
      assert entity.tags == ["hostile"]
    end

    test "maps name/description to short_desc/long_desc for quests" do
      data = %{
        "key" => "test_quest",
        "type" => "quest",
        "name" => "A Test Quest",
        "description" => "You must test things.",
        "objectives" => [%{"id" => "obj1", "type" => "talk"}],
        "rewards" => %{"xp" => 10}
      }

      entity = EntitySeeder.yaml_to_entity(data)

      assert entity.short_desc == "A Test Quest"
      assert entity.long_desc == "You must test things."
      # Quest-specific fields go into components["data"] for TypedObject compat
      assert entity.components["data"]["objectives"] == [%{"id" => "obj1", "type" => "talk"}]
      assert entity.components["data"]["rewards"] == %{"xp" => 10}
    end

    test "merges attributes into components" do
      data = %{
        "key" => "test_room",
        "type" => "room",
        "attributes" => %{"x" => 0, "y" => 1, "z" => 0}
      }

      entity = EntitySeeder.yaml_to_entity(data)
      assert entity.components["attributes"] == %{"x" => 0, "y" => 1, "z" => 0}
    end

    test "merges emotes into components" do
      data = %{
        "key" => "test_npc",
        "type" => "npc",
        "emotes" => %{"greeting" => "Hello there!"}
      }

      entity = EntitySeeder.yaml_to_entity(data)
      assert entity.components["emotes"] == %{"greeting" => "Hello there!"}
    end

    test "preserves existing id when provided" do
      id = Ecto.UUID.generate()
      data = %{"key" => "test", "type" => "npc"}

      entity = EntitySeeder.yaml_to_entity(data, id)
      assert entity.id == id
    end
  end

  # ==========================================================================
  # Full Seeding (Integration)
  # ==========================================================================

  describe "seeding from YAML files" do
    test "seeds non-located entities first", %{dir: dir} do
      write_yaml(dir, "skills/test_skill.yml", """
      key: test_skill
      type: skill
      name: Test Skill
      category: combat_melee
      """)

      assert {:ok, count} = seed_from(dir)
      assert count >= 1

      assert {:ok, entity} = Entities.find_one(key: "test_skill", type: :skill)
      assert entity.short_desc == "Test Skill"
      assert entity.is_prototype == true
    end

    test "seeds rooms", %{dir: dir} do
      write_yaml(dir, "prototypes/rooms/test_room.yml", """
      key: test_room
      type: room
      short_desc: Test Room
      long_desc: A test room.
      tags:
        - room
      """)

      assert {:ok, _} = seed_from(dir)
      assert {:ok, entity} = Entities.find_one(key: "test_room", type: :room)
      assert entity.short_desc == "Test Room"
    end

    test "seeds NPCs with standalone YAML", %{dir: dir} do
      write_yaml(dir, "prototypes/npcs/test_goblin.yml", """
      key: test_goblin
      type: npc
      short_desc: a goblin
      components:
        combatant:
          health:
            current: 100
            max: 100
          level: 5
      tags:
        - hostile
      """)

      assert {:ok, _} = seed_from(dir)
      assert {:ok, entity} = Entities.find_one(key: "test_goblin", type: :npc)

      assert entity.short_desc == "a goblin"
      assert entity.components["combatant"]["health"] == %{"current" => 100, "max" => 100}
      assert entity.components["combatant"]["level"] == 5
    end

    test "seeds exits from room definitions", %{dir: dir} do
      write_yaml(dir, "prototypes/rooms/room_a.yml", """
      key: room_a
      type: room
      short_desc: Room A
      exits:
        north: room_b
      """)

      write_yaml(dir, "prototypes/rooms/room_b.yml", """
      key: room_b
      type: room
      short_desc: Room B
      exits:
        south: room_a
      """)

      assert {:ok, _} = seed_from(dir)

      # Forward exit from room A
      assert {:ok, exit_a} = Entities.find_one(key: "room_a_north", type: :exit)
      assert exit_a.components["exit"]["direction"] == "north"
      assert exit_a.components["exit"]["destination_key"] == "room_b"

      # Reverse exit from room B (defined in YAML)
      assert {:ok, exit_b} = Entities.find_one(key: "room_b_south", type: :exit)
      assert exit_b.components["exit"]["direction"] == "south"
      assert exit_b.components["exit"]["destination_key"] == "room_a"
    end

    test "creates reciprocal exits when not defined in YAML", %{dir: dir} do
      write_yaml(dir, "prototypes/rooms/room_x.yml", """
      key: room_x
      type: room
      short_desc: Room X
      exits:
        east: room_y
      """)

      write_yaml(dir, "prototypes/rooms/room_y.yml", """
      key: room_y
      type: room
      short_desc: Room Y
      """)

      assert {:ok, _} = seed_from(dir)

      # Forward exit
      assert {:ok, _} = Entities.find_one(key: "room_x_east", type: :exit)
      # Reciprocal exit created automatically
      assert {:ok, reciprocal} = Entities.find_one(key: "room_y_west", type: :exit)
      assert reciprocal.components["exit"]["direction"] == "west"
      assert reciprocal.components["exit"]["destination_key"] == "room_x"
    end

    test "exit entities reference room UUIDs", %{dir: dir} do
      write_yaml(dir, "prototypes/rooms/room_p.yml", """
      key: room_p
      type: room
      short_desc: Room P
      exits:
        up: room_q
      """)

      write_yaml(dir, "prototypes/rooms/room_q.yml", """
      key: room_q
      type: room
      short_desc: Room Q
      """)

      assert {:ok, _} = seed_from(dir)

      {:ok, room_p} = Entities.find_one(key: "room_p", type: :room)
      {:ok, room_q} = Entities.find_one(key: "room_q", type: :room)
      {:ok, exit_entity} = Entities.find_one(key: "room_p_up", type: :exit)

      assert exit_entity.location_id == room_p.id
      assert exit_entity.components["exit"]["destination_id"] == room_q.id
    end
  end

  # ==========================================================================
  # Idempotent Seeding
  # ==========================================================================

  describe "idempotent seeding" do
    test "running seed twice produces the same result", %{dir: dir} do
      write_yaml(dir, "prototypes/rooms/idem_room.yml", """
      key: idem_room
      type: room
      short_desc: Idempotent Room
      tags:
        - room
      """)

      write_yaml(dir, "prototypes/npcs/idem_npc.yml", """
      key: idem_npc
      type: npc
      short_desc: Idempotent NPC
      """)

      # First seed
      assert {:ok, count1} = seed_from(dir)
      {:ok, room1} = Entities.find_one(key: "idem_room", type: :room)
      {:ok, npc1} = Entities.find_one(key: "idem_npc", type: :npc)

      # Second seed (should update, not duplicate)
      assert {:ok, count2} = seed_from(dir)
      {:ok, room2} = Entities.find_one(key: "idem_room", type: :room)
      {:ok, npc2} = Entities.find_one(key: "idem_npc", type: :npc)

      assert count1 == count2

      # Same entity IDs
      assert room1.id == room2.id
      assert npc1.id == npc2.id

      # Version incremented on re-seed
      assert room2.version == room1.version + 1
    end
  end

  # ==========================================================================
  # Conflict Resolution
  # ==========================================================================

  describe "conflict resolution" do
    test "updates existing prototype from YAML", %{dir: dir} do
      # Pre-insert a prototype entity
      {:ok, existing} =
        Entity.new(type: :npc, key: "conflict_npc", short_desc: "old desc", is_prototype: true)
        |> Entities.save()

      write_yaml(dir, "prototypes/npcs/conflict_npc.yml", """
      key: conflict_npc
      type: npc
      short_desc: new desc from YAML
      """)

      assert {:ok, _} = seed_from(dir)

      {:ok, updated} = Entities.find_one(key: "conflict_npc", type: :npc)
      assert updated.id == existing.id
      assert updated.short_desc == "new desc from YAML"
    end

    test "skips non-prototype instances", %{dir: dir} do
      # Pre-insert a non-prototype (instance) entity
      {:ok, instance} =
        Entity.new(
          type: :npc,
          key: "instance_npc",
          short_desc: "player-created",
          is_prototype: false
        )
        |> Entities.save()

      write_yaml(dir, "prototypes/npcs/instance_npc.yml", """
      key: instance_npc
      type: npc
      short_desc: YAML version
      """)

      assert {:ok, _} = seed_from(dir)

      {:ok, found} = Entities.find_one(key: "instance_npc", type: :npc)
      # Instance is preserved, not overwritten
      assert found.short_desc == "player-created"
      assert found.id == instance.id
    end
  end

  # ==========================================================================
  # Phased Ordering
  # ==========================================================================

  describe "phased ordering" do
    test "rooms are seeded before exits (exits can reference room UUIDs)", %{dir: dir} do
      write_yaml(dir, "prototypes/rooms/order_room_a.yml", """
      key: order_room_a
      type: room
      short_desc: Order Room A
      exits:
        north: order_room_b
      """)

      write_yaml(dir, "prototypes/rooms/order_room_b.yml", """
      key: order_room_b
      type: room
      short_desc: Order Room B
      """)

      assert {:ok, _} = seed_from(dir)

      # If rooms weren't seeded before exits, exit creation would fail
      {:ok, exit_entity} = Entities.find_one(key: "order_room_a_north", type: :exit)
      {:ok, room_b} = Entities.find_one(key: "order_room_b", type: :room)

      assert exit_entity.components["exit"]["destination_id"] == room_b.id
    end
  end

  # ==========================================================================
  # Quest Seeding
  # ==========================================================================

  describe "quest seeding" do
    test "seeds quest with content fields in components", %{dir: dir} do
      write_yaml(dir, "quests/test_quest.yml", """
      id: test_quest
      name: A Test Quest
      description: You must test things.
      type: main
      giver: system
      objectives:
        - id: obj1
          type: talk
          target_id: test_npc
          description: Talk to test NPC
      rewards:
        xp: 50
      journal_entries:
        start: Quest started
        complete: Quest done
      """)

      assert {:ok, _} = seed_from(dir)

      {:ok, quest} = Entities.find_one(key: "test_quest", type: :quest)
      assert quest.short_desc == "A Test Quest"
      # YAML block scalar may or may not have trailing newline
      assert String.trim(quest.long_desc) == "You must test things."
      assert quest.components["data"]["objectives"] |> List.first() |> Map.get("id") == "obj1"
      assert quest.components["data"]["rewards"]["xp"] == 50
      assert quest.components["data"]["giver"] == "system"
      assert quest.components["data"]["quest_type"] == "main"
    end
  end

  # ==========================================================================
  # Reverse Direction
  # ==========================================================================

  describe "reverse_direction/1" do
    test "reverses cardinal directions" do
      assert EntitySeeder.reverse_direction("north") == "south"
      assert EntitySeeder.reverse_direction("south") == "north"
      assert EntitySeeder.reverse_direction("east") == "west"
      assert EntitySeeder.reverse_direction("west") == "east"
    end

    test "reverses vertical directions" do
      assert EntitySeeder.reverse_direction("up") == "down"
      assert EntitySeeder.reverse_direction("down") == "up"
    end

    test "reverses diagonal directions" do
      assert EntitySeeder.reverse_direction("northeast") == "southwest"
      assert EntitySeeder.reverse_direction("southeast") == "northwest"
    end

    test "returns nil for unknown direction" do
      assert EntitySeeder.reverse_direction("portal") == nil
    end
  end
end
