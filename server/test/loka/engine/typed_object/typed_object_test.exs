defmodule Loka.Engine.TypedObjectTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.TypedObject

  describe "new/1" do
    test "creates a basic entity TypedObject" do
      assert {:ok, to} = TypedObject.new(key: "test_npc", type: :entity, subtype: :npc)
      assert to.key == "test_npc"
      assert to.type == :entity
      assert to.subtype == :npc
      assert to.is_prototype == true
    end

    test "creates a quest TypedObject" do
      assert {:ok, to} = TypedObject.new(key: "test_quest", type: :quest)
      assert to.key == "test_quest"
      assert to.type == :quest
      assert to.subtype == nil
    end

    test "creates from string keys" do
      assert {:ok, to} = TypedObject.new(%{"key" => "string_key", "type" => "dialogue"})
      assert to.key == "string_key"
      assert to.type == :dialogue
    end

    test "normalizes legacy entity types" do
      assert {:ok, to} = TypedObject.new(key: "legacy_npc", type: :npc)
      assert to.type == :entity
    end

    test "handles short_desc/long_desc mappings" do
      assert {:ok, to} =
               TypedObject.new(
                 key: "mapped_desc",
                 type: :entity,
                 short_desc: "Short",
                 long_desc: "Long description"
               )

      assert to.name == "Short"
      assert to.description == "Long description"
    end

    test "returns error for missing key" do
      assert {:error, errors} = TypedObject.new(type: :entity)
      assert "key is required" in errors
    end

    test "returns error for missing type" do
      assert {:error, errors} = TypedObject.new(key: "no_type")
      assert "type is required" in errors
    end

    test "returns error for invalid key format" do
      assert {:error, errors} = TypedObject.new(key: "123invalid", type: :entity)
      assert "key must be a valid identifier (alphanumeric, underscore, hyphen)" in errors
    end

    test "returns error for invalid type" do
      assert {:error, errors} = TypedObject.new(key: "invalid_type", type: :invalid)
      assert Enum.any?(errors, &String.contains?(&1, "type must be one of"))
    end

    test "returns error for invalid entity subtype" do
      assert {:error, errors} =
               TypedObject.new(key: "bad_subtype", type: :entity, subtype: :invalid)

      assert Enum.any?(errors, &String.contains?(&1, "entity subtype must be one of"))
    end

    test "normalizes keywords to lowercase strings" do
      assert {:ok, to} =
               TypedObject.new(
                 key: "keyword_test",
                 type: :entity,
                 keywords: ["UPPER", :atom_key, "Mixed"]
               )

      assert to.keywords == ["upper", "atom_key", "mixed"]
    end
  end

  describe "new!/1" do
    test "returns TypedObject on success" do
      to = TypedObject.new!(key: "bang_test", type: :entity)
      assert to.key == "bang_test"
    end

    test "raises on error" do
      assert_raise RuntimeError, ~r/Invalid TypedObject/, fn ->
        TypedObject.new!(type: :entity)
      end
    end
  end

  describe "has_tag?/2" do
    test "returns true when tag exists" do
      {:ok, to} = TypedObject.new(key: "tagged", type: :entity, tags: ["hostile", "undead"])
      assert TypedObject.has_tag?(to, "hostile")
      assert TypedObject.has_tag?(to, "undead")
    end

    test "returns false when tag missing" do
      {:ok, to} = TypedObject.new(key: "tagged", type: :entity, tags: ["hostile"])
      refute TypedObject.has_tag?(to, "friendly")
    end
  end

  describe "get_attribute/3" do
    test "returns attribute value" do
      {:ok, to} =
        TypedObject.new(
          key: "attr_test",
          type: :entity,
          attributes: %{"strength" => 10, "dex" => 15}
        )

      assert TypedObject.get_attribute(to, "strength") == 10
      assert TypedObject.get_attribute(to, "dex") == 15
    end

    test "returns default when not found" do
      {:ok, to} = TypedObject.new(key: "attr_test", type: :entity)
      assert TypedObject.get_attribute(to, :missing, 42) == 42
    end
  end

  describe "get_data/3" do
    test "returns data value" do
      {:ok, to} =
        TypedObject.new(
          key: "data_test",
          type: :quest,
          data: %{objectives: [%{id: "obj1"}]}
        )

      assert TypedObject.get_data(to, :objectives) == [%{id: "obj1"}]
    end

    test "returns default when not found" do
      {:ok, to} = TypedObject.new(key: "data_test", type: :quest)
      assert TypedObject.get_data(to, :missing, []) == []
    end
  end

  describe "entity?/1" do
    test "returns true for entities" do
      {:ok, to} = TypedObject.new(key: "entity", type: :entity)
      assert TypedObject.entity?(to)
    end

    test "returns false for content types" do
      {:ok, to} = TypedObject.new(key: "quest", type: :quest)
      refute TypedObject.entity?(to)
    end
  end

  describe "content?/1" do
    test "returns true for content types" do
      for type <- [:quest, :dialogue, :script, :zone] do
        {:ok, to} = TypedObject.new(key: "content_#{type}", type: type)
        assert TypedObject.content?(to)
      end
    end

    test "returns false for entities" do
      {:ok, to} = TypedObject.new(key: "entity", type: :entity)
      refute TypedObject.content?(to)
    end
  end

  describe "display_ref/1" do
    test "returns key for prototypes" do
      {:ok, to} = TypedObject.new(key: "proto_key", type: :entity)
      assert TypedObject.display_ref(to) == "proto_key"
    end

    test "returns key#short_id for instances" do
      {:ok, to} =
        TypedObject.new(
          key: "instance_key",
          type: :entity,
          id: "550e8400-e29b-41d4-a716-446655440000"
        )

      assert TypedObject.display_ref(to) == "instance_key#550e84"
    end
  end

  describe "merge_parent/2" do
    test "child values override parent values" do
      {:ok, parent} =
        TypedObject.new(
          key: "parent",
          type: :entity,
          name: "Parent Name",
          description: "Parent desc"
        )

      {:ok, child} =
        TypedObject.new(
          key: "child",
          type: :entity,
          parent_key: "parent",
          name: "Child Name"
        )

      merged = TypedObject.merge_parent(child, parent)
      assert merged.name == "Child Name"
      assert merged.description == "Parent desc"
    end

    test "merges attributes deeply" do
      {:ok, parent} =
        TypedObject.new(
          key: "parent",
          type: :entity,
          attributes: %{stats: %{str: 10, dex: 10}, level: 1}
        )

      {:ok, child} =
        TypedObject.new(
          key: "child",
          type: :entity,
          parent_key: "parent",
          attributes: %{stats: %{str: 15}}
        )

      merged = TypedObject.merge_parent(child, parent)
      assert merged.attributes.stats.str == 15
      assert merged.attributes.stats.dex == 10
      assert merged.attributes.level == 1
    end

    test "concatenates tags uniquely" do
      {:ok, parent} =
        TypedObject.new(
          key: "parent",
          type: :entity,
          tags: ["base", "shared"]
        )

      {:ok, child} =
        TypedObject.new(
          key: "child",
          type: :entity,
          parent_key: "parent",
          tags: ["child", "shared"]
        )

      merged = TypedObject.merge_parent(child, parent)
      assert "base" in merged.tags
      assert "child" in merged.tags
      assert "shared" in merged.tags
      # Should be unique
      assert length(merged.tags) == 3
    end

    test "preserves child key and identity" do
      {:ok, parent} = TypedObject.new(key: "parent", type: :entity)

      {:ok, child} =
        TypedObject.new(
          key: "child",
          type: :entity,
          parent_key: "parent",
          id: "child-id"
        )

      merged = TypedObject.merge_parent(child, parent)
      assert merged.key == "child"
      assert merged.id == "child-id"
      assert merged.parent_key == "parent"
    end
  end

  describe "valid_types/0" do
    test "returns all valid types" do
      types = TypedObject.valid_types()
      assert :entity in types
      assert :quest in types
      assert :dialogue in types
      assert :script in types
      assert :zone in types
    end
  end

  describe "valid_entity_subtypes/0" do
    test "returns all valid entity subtypes" do
      subtypes = TypedObject.valid_entity_subtypes()
      assert :npc in subtypes
      assert :room in subtypes
      assert :item in subtypes
      assert :exit in subtypes
      assert :character in subtypes
    end
  end

  describe "behaviors parsing" do
    test "parses new behavior format with script and config" do
      {:ok, to} =
        TypedObject.new(
          key: "patrol_npc",
          type: :entity,
          subtype: :npc,
          behaviors: [
            %{"script" => "patrol", "config" => %{"route" => ["gate", "market", "temple"]}}
          ]
        )

      assert length(to.behaviors) == 1
      [behavior] = to.behaviors
      assert behavior.script == "patrol"
      # Config keys that match existing atoms get normalized to atoms
      assert behavior.config.route == ["gate", "market", "temple"]
    end

    test "parses behavior format with atom keys" do
      {:ok, to} =
        TypedObject.new(
          key: "schedule_npc",
          type: :entity,
          subtype: :npc,
          behaviors: [
            %{script: "day_night_schedule", config: %{wake_at: :dawn, sleep_at: :dusk}}
          ]
        )

      assert length(to.behaviors) == 1
      [behavior] = to.behaviors
      assert behavior.script == "day_night_schedule"
      assert behavior.config == %{wake_at: :dawn, sleep_at: :dusk}
    end

    test "parses multiple behaviors" do
      {:ok, to} =
        TypedObject.new(
          key: "complex_npc",
          type: :entity,
          subtype: :npc,
          behaviors: [
            %{"script" => "patrol", "config" => %{"interval" => 300}},
            %{"script" => "day_night_schedule", "config" => %{"wake_at" => "dawn"}}
          ]
        )

      assert length(to.behaviors) == 2
      scripts = Enum.map(to.behaviors, & &1.script)
      assert "patrol" in scripts
      assert "day_night_schedule" in scripts
    end

    test "handles behavior without config" do
      {:ok, to} =
        TypedObject.new(
          key: "simple_behavior",
          type: :entity,
          subtype: :npc,
          behaviors: [
            %{"script" => "wander"}
          ]
        )

      assert length(to.behaviors) == 1
      [behavior] = to.behaviors
      assert behavior.script == "wander"
      assert behavior.config == %{}
    end

    test "handles empty behaviors list" do
      {:ok, to} =
        TypedObject.new(
          key: "no_behaviors",
          type: :entity,
          subtype: :npc,
          behaviors: []
        )

      assert to.behaviors == []
    end

    test "filters out invalid behavior entries" do
      {:ok, to} =
        TypedObject.new(
          key: "mixed_behaviors",
          type: :entity,
          subtype: :npc,
          behaviors: [
            %{"script" => "patrol"},
            123,
            nil,
            %{no_script_key: "invalid"}
          ]
        )

      # Only the valid map entry with script key should remain
      # Integers, nil, and maps without script key are filtered out
      assert length(to.behaviors) == 1
      [behavior] = to.behaviors
      assert behavior.script == "patrol"
    end

    test "legacy string format converts to new format" do
      {:ok, to} =
        TypedObject.new(
          key: "legacy_behaviors",
          type: :entity,
          subtype: :npc,
          behaviors: [
            "Loka.Behaviors.Patrol",
            :wander
          ]
        )

      # Legacy formats get converted to new format with empty config
      assert length(to.behaviors) == 2
      scripts = Enum.map(to.behaviors, & &1.script)
      assert "patrol" in scripts
      assert "wander" in scripts
      assert Enum.all?(to.behaviors, fn b -> b.config == %{} end)
    end
  end

  describe "emotes parsing" do
    test "parses emotes with string keys from YAML" do
      {:ok, to} =
        TypedObject.new(
          key: "emotive_npc",
          type: :entity,
          subtype: :npc,
          emotes: %{
            "waking_up" => "*stretches and yawns*",
            "patrol_arrive" => "*surveys the area*"
          }
        )

      assert map_size(to.emotes) == 2
      assert to.emotes.waking_up == "*stretches and yawns*"
      assert to.emotes.patrol_arrive == "*surveys the area*"
    end

    test "parses emotes with atom keys" do
      {:ok, to} =
        TypedObject.new(
          key: "emotive_npc",
          type: :entity,
          subtype: :npc,
          emotes: %{
            spotted_player: "Welcome, traveler!",
            closing_shop: "Shop's closed. Come back tomorrow."
          }
        )

      assert to.emotes.spotted_player == "Welcome, traveler!"
      assert to.emotes.closing_shop == "Shop's closed. Come back tomorrow."
    end

    test "handles empty emotes map" do
      {:ok, to} =
        TypedObject.new(
          key: "no_emotes",
          type: :entity,
          subtype: :npc,
          emotes: %{}
        )

      assert to.emotes == %{}
    end

    test "handles missing emotes (defaults to empty map)" do
      {:ok, to} =
        TypedObject.new(
          key: "no_emotes",
          type: :entity,
          subtype: :npc
        )

      assert to.emotes == %{}
    end

    test "converts non-string values to strings" do
      {:ok, to} =
        TypedObject.new(
          key: "mixed_values",
          type: :entity,
          emotes: %{
            number_event: 42,
            atom_event: :some_atom
          }
        )

      assert to.emotes.number_event == "42"
      assert to.emotes.atom_event == "some_atom"
    end
  end

  describe "merge_parent/2 with emotes" do
    test "child emotes override parent emotes for same event" do
      {:ok, parent} =
        TypedObject.new(
          key: "parent_npc",
          type: :entity,
          emotes: %{
            waking_up: "*parent wakes up*",
            patrol_arrive: "*parent looks around*"
          }
        )

      {:ok, child} =
        TypedObject.new(
          key: "child_npc",
          type: :entity,
          parent_key: "parent_npc",
          emotes: %{
            waking_up: "*child stretches dramatically*"
          }
        )

      merged = TypedObject.merge_parent(child, parent)

      # Child overrides parent for waking_up
      assert merged.emotes.waking_up == "*child stretches dramatically*"
      # Parent's patrol_arrive is preserved
      assert merged.emotes.patrol_arrive == "*parent looks around*"
    end

    test "child can add new emotes to parent's set" do
      {:ok, parent} =
        TypedObject.new(
          key: "parent_npc",
          type: :entity,
          emotes: %{patrol_arrive: "*looks around*"}
        )

      {:ok, child} =
        TypedObject.new(
          key: "child_npc",
          type: :entity,
          parent_key: "parent_npc",
          emotes: %{spotted_player: "Hello there!"}
        )

      merged = TypedObject.merge_parent(child, parent)

      assert merged.emotes.patrol_arrive == "*looks around*"
      assert merged.emotes.spotted_player == "Hello there!"
    end
  end

  describe "merge_parent/2 with behaviors" do
    test "child behaviors override parent behaviors with same script" do
      {:ok, parent} =
        TypedObject.new(
          key: "parent_npc",
          type: :entity,
          behaviors: [
            %{script: "patrol", config: %{interval: 300, route: ["a", "b"]}}
          ]
        )

      {:ok, child} =
        TypedObject.new(
          key: "child_npc",
          type: :entity,
          parent_key: "parent_npc",
          behaviors: [
            %{script: "patrol", config: %{route: ["c", "d", "e"]}}
          ]
        )

      merged = TypedObject.merge_parent(child, parent)

      assert length(merged.behaviors) == 1
      [behavior] = merged.behaviors
      assert behavior.script == "patrol"
      # Child route overrides parent route
      assert behavior.config.route == ["c", "d", "e"]
      # Parent interval is preserved
      assert behavior.config.interval == 300
    end

    test "combines unique behaviors from parent and child" do
      {:ok, parent} =
        TypedObject.new(
          key: "parent_npc",
          type: :entity,
          behaviors: [
            %{script: "patrol", config: %{interval: 300}}
          ]
        )

      {:ok, child} =
        TypedObject.new(
          key: "child_npc",
          type: :entity,
          parent_key: "parent_npc",
          behaviors: [
            %{script: "day_night_schedule", config: %{wake_at: :dawn}}
          ]
        )

      merged = TypedObject.merge_parent(child, parent)

      assert length(merged.behaviors) == 2
      scripts = Enum.map(merged.behaviors, & &1.script)
      assert "patrol" in scripts
      assert "day_night_schedule" in scripts
    end

    test "child can add new behaviors to empty parent" do
      {:ok, parent} =
        TypedObject.new(
          key: "parent_npc",
          type: :entity,
          behaviors: []
        )

      {:ok, child} =
        TypedObject.new(
          key: "child_npc",
          type: :entity,
          parent_key: "parent_npc",
          behaviors: [
            %{script: "wander", config: %{range: 5}}
          ]
        )

      merged = TypedObject.merge_parent(child, parent)

      assert length(merged.behaviors) == 1
      [behavior] = merged.behaviors
      assert behavior.script == "wander"
    end
  end
end
