defmodule Exmud.Engine.PrototypeTest do
  use ExUnit.Case, async: true

  alias Exmud.Engine.Prototype
  alias Exmud.Engine.Entity

  describe "new/1" do
    test "creates a valid prototype from keyword list" do
      assert {:ok, proto} = Prototype.new(key: "goblin", type: :npc)
      assert proto.key == "goblin"
      assert proto.type == :npc
    end

    test "creates a valid prototype from map with atom keys" do
      assert {:ok, proto} = Prototype.new(%{key: "goblin", type: :npc, name: "Goblin"})
      assert proto.key == "goblin"
      assert proto.type == :npc
      assert proto.name == "Goblin"
    end

    test "creates prototype with all fields" do
      attrs = %{
        key: "goblin_warrior",
        parent: "base_npc",
        type: :npc,
        name: "Goblin Warrior",
        description: "A fierce goblin.",
        components: %{"combatant" => %{"health" => 30}},
        behaviors: [Exmud.Engine.PrototypeTest],
        attributes: %{"respawn_time" => 300},
        tags: ["hostile", "goblinoid"],
        scripts: %{"on_death" => "print('dead')"},
        locks: %{"attack" => "perm(hostile)"},
        exits: %{},
        spawns: []
      }

      assert {:ok, proto} = Prototype.new(attrs)
      assert proto.key == "goblin_warrior"
      assert proto.parent == "base_npc"
      assert proto.components == %{"combatant" => %{"health" => 30}}
      assert proto.behaviors == [Exmud.Engine.PrototypeTest]
      assert proto.tags == ["hostile", "goblinoid"]
    end

    test "returns error for missing key" do
      assert {:error, errors} = Prototype.new(type: :npc)
      assert "key is required" in errors
    end

    test "returns error for missing type" do
      assert {:error, errors} = Prototype.new(key: "test")
      assert "type is required" in errors
    end

    test "returns error for empty key" do
      assert {:error, errors} = Prototype.new(key: "", type: :npc)
      assert "key must be a non-empty string" in errors
    end

    test "returns error for invalid type" do
      assert {:error, errors} = Prototype.new(key: "test", type: :invalid)
      assert Enum.any?(errors, &String.contains?(&1, "type must be one of"))
    end

    test "returns multiple errors at once" do
      assert {:error, errors} = Prototype.new(%{})
      assert length(errors) >= 2
      assert "key is required" in errors
      assert "type is required" in errors
    end

    test "sets default values for optional fields" do
      assert {:ok, proto} = Prototype.new(key: "test", type: :item)
      assert proto.components == %{}
      assert proto.behaviors == []
      assert proto.attributes == %{}
      assert proto.tags == []
      assert proto.scripts == %{}
      assert proto.locks == %{}
      assert proto.exits == %{}
      assert proto.spawns == []
    end
  end

  describe "validate/1" do
    test "validates a correct prototype" do
      proto = %Prototype{key: "test", type: :npc}
      assert {:ok, ^proto} = Prototype.validate(proto)
    end

    test "catches invalid key format" do
      proto = %Prototype{key: "123invalid", type: :npc}
      assert {:error, errors} = Prototype.validate(proto)
      assert Enum.any?(errors, &String.contains?(&1, "valid identifier"))
    end

    test "allows hyphens and underscores in key" do
      proto = %Prototype{key: "goblin-warrior_elite", type: :npc}
      assert {:ok, _} = Prototype.validate(proto)
    end

    test "catches non-map components" do
      proto = %Prototype{key: "test", type: :npc, components: "invalid"}
      assert {:error, errors} = Prototype.validate(proto)
      assert "components must be a map" in errors
    end

    test "catches non-list behaviors" do
      proto = %Prototype{key: "test", type: :npc, behaviors: "invalid"}
      assert {:error, errors} = Prototype.validate(proto)
      assert "behaviors must be a list" in errors
    end

    test "catches non-atom behaviors in list" do
      proto = %Prototype{key: "test", type: :npc, behaviors: ["NotAModule"]}
      assert {:error, errors} = Prototype.validate(proto)
      assert Enum.any?(errors, &String.contains?(&1, "module atoms"))
    end

    test "catches non-list tags" do
      proto = %Prototype{key: "test", type: :npc, tags: "invalid"}
      assert {:error, errors} = Prototype.validate(proto)
      assert "tags must be a list" in errors
    end

    test "catches non-string tags in list" do
      proto = %Prototype{key: "test", type: :npc, tags: [:not_a_string]}
      assert {:error, errors} = Prototype.validate(proto)
      assert "tags must be a list of strings" in errors
    end
  end

  describe "merge_parent/2" do
    test "child key overrides parent key" do
      parent = %Prototype{key: "base", type: :npc, name: "Base NPC"}
      child = %Prototype{key: "goblin", type: :npc, parent: "base"}

      merged = Prototype.merge_parent(child, parent)

      assert merged.key == "goblin"
      assert merged.parent == "base"
    end

    test "child name overrides parent name" do
      parent = %Prototype{key: "base", type: :npc, name: "Base NPC"}
      child = %Prototype{key: "goblin", type: :npc, name: "Goblin"}

      merged = Prototype.merge_parent(child, parent)

      assert merged.name == "Goblin"
    end

    test "inherits parent name if child has none" do
      parent = %Prototype{key: "base", type: :npc, name: "Base NPC"}
      child = %Prototype{key: "goblin", type: :npc}

      merged = Prototype.merge_parent(child, parent)

      assert merged.name == "Base NPC"
    end

    test "deep merges components" do
      parent = %Prototype{
        key: "base",
        type: :npc,
        components: %{
          "combatant" => %{"health" => %{"max" => 100}, "level" => 1}
        }
      }

      child = %Prototype{
        key: "goblin",
        type: :npc,
        components: %{
          "combatant" => %{"health" => %{"max" => 30}}
        }
      }

      merged = Prototype.merge_parent(child, parent)

      # Child overrides nested value
      assert merged.components["combatant"]["health"]["max"] == 30
      # Parent value preserved where child doesn't override
      assert merged.components["combatant"]["level"] == 1
    end

    test "concatenates and deduplicates tags" do
      parent = %Prototype{key: "base", type: :npc, tags: ["npc", "creature"]}
      child = %Prototype{key: "goblin", type: :npc, tags: ["hostile", "npc"]}

      merged = Prototype.merge_parent(child, parent)

      # Child tags come first, then parent, deduplicated
      assert merged.tags == ["hostile", "npc", "creature"]
    end

    test "concatenates behaviors and deduplicates" do
      parent = %Prototype{key: "base", type: :npc, behaviors: [ExUnit.Case]}
      child = %Prototype{key: "goblin", type: :npc, behaviors: [ExUnit.Case, Kernel]}

      merged = Prototype.merge_parent(child, parent)

      assert Kernel in merged.behaviors
      assert ExUnit.Case in merged.behaviors
      assert length(merged.behaviors) == 2
    end

    test "child type takes precedence" do
      parent = %Prototype{key: "base", type: :npc}
      child = %Prototype{key: "special", type: :item}

      merged = Prototype.merge_parent(child, parent)

      assert merged.type == :item
    end

    test "inherits parent type if child has none" do
      parent = %Prototype{key: "base", type: :npc}
      child = %Prototype{key: "special", type: nil}

      merged = Prototype.merge_parent(child, parent)

      assert merged.type == :npc
    end

    test "merges exits" do
      parent = %Prototype{key: "base", type: :room, exits: %{"north" => "room1"}}
      child = %Prototype{key: "room", type: :room, exits: %{"south" => "room2"}}

      merged = Prototype.merge_parent(child, parent)

      assert merged.exits == %{"north" => "room1", "south" => "room2"}
    end

    test "child exit overrides parent exit for same direction" do
      parent = %Prototype{key: "base", type: :room, exits: %{"north" => "room1"}}
      child = %Prototype{key: "room", type: :room, exits: %{"north" => "room2"}}

      merged = Prototype.merge_parent(child, parent)

      assert merged.exits == %{"north" => "room2"}
    end

    test "concatenates spawns" do
      parent = %Prototype{key: "base", type: :room, spawns: [%{prototype: "npc1"}]}
      child = %Prototype{key: "room", type: :room, spawns: [%{prototype: "npc2"}]}

      merged = Prototype.merge_parent(child, parent)

      assert merged.spawns == [%{prototype: "npc2"}, %{prototype: "npc1"}]
    end
  end

  describe "to_entity/2" do
    test "converts prototype to entity with new UUID" do
      {:ok, proto} = Prototype.new(key: "goblin", type: :npc, name: "Goblin")

      entity = Prototype.to_entity(proto)

      assert %Entity{} = entity
      assert is_binary(entity.id)
      assert String.length(entity.id) == 36
      assert entity.type == :npc
      assert entity.key == "goblin"
      assert entity.name == "Goblin"
    end

    test "copies all fields to entity" do
      {:ok, proto} =
        Prototype.new(
          key: "goblin",
          type: :npc,
          name: "Goblin",
          description: "A goblin",
          components: %{"combat" => %{"hp" => 30}},
          behaviors: [Kernel],
          attributes: %{"level" => 1},
          tags: ["hostile"],
          scripts: %{"on_death" => "script"},
          locks: %{"attack" => "true"}
        )

      entity = Prototype.to_entity(proto)

      assert entity.description == "A goblin"
      assert entity.components == %{"combat" => %{"hp" => 30}}
      assert entity.behaviors == [Kernel]
      assert entity.attributes == %{"level" => 1}
      assert entity.tags == ["hostile"]
      assert entity.scripts == %{"on_death" => "script"}
      assert entity.locks == %{"attack" => "true"}
    end

    test "sets metadata with prototype_key" do
      {:ok, proto} = Prototype.new(key: "goblin", type: :npc)

      entity = Prototype.to_entity(proto)

      assert entity.metadata.prototype_key == "goblin"
      assert %DateTime{} = entity.metadata.created_at
      assert %DateTime{} = entity.metadata.updated_at
    end

    test "applies overrides" do
      {:ok, proto} = Prototype.new(key: "goblin", type: :npc, name: "Goblin")

      entity = Prototype.to_entity(proto, %{name: "Elite Goblin", location_id: "room_1"})

      assert entity.name == "Elite Goblin"
      assert entity.location_id == "room_1"
    end

    test "entity starts with empty contents and nil location" do
      {:ok, proto} = Prototype.new(key: "goblin", type: :npc)

      entity = Prototype.to_entity(proto)

      assert entity.contents == []
      assert entity.location_id == nil
    end
  end

  describe "from_map/1" do
    test "creates prototype from string-keyed map" do
      assert {:ok, proto} =
               Prototype.from_map(%{
                 "key" => "goblin",
                 "type" => "npc",
                 "name" => "Goblin"
               })

      assert proto.key == "goblin"
      assert proto.type == :npc
      assert proto.name == "Goblin"
    end

    test "handles nested maps with string keys" do
      assert {:ok, proto} =
               Prototype.from_map(%{
                 "key" => "goblin",
                 "type" => "npc",
                 "components" => %{
                   "combat" => %{"hp" => 30}
                 }
               })

      assert proto.components == %{"combat" => %{"hp" => 30}}
    end

    test "returns error for invalid input" do
      assert {:error, _} = Prototype.from_map(%{"type" => "npc"})
    end
  end

  describe "valid_types/0" do
    test "returns list of valid types" do
      types = Prototype.valid_types()

      assert :room in types
      assert :npc in types
      assert :item in types
      assert :exit in types
      assert :character in types
    end
  end
end
