defmodule Exmud.Engine.WorldExporterTest do
  use Exmud.DataCase, async: false

  alias Exmud.Engine.{WorldExporter, WorldLoader, PrototypeLoader, Entities, Entity}

  setup do
    # Clear any existing entities
    Entities.delete_all()

    # Reload prototypes and spawn a world using production starting room
    PrototypeLoader.reload()
    WorldLoader.spawn_world(starting_room: "monastery_gate")

    # Create a temp directory for exports
    export_dir = Path.join(System.tmp_dir!(), "exmud_export_test_#{:rand.uniform(10000)}")
    File.mkdir_p!(export_dir)

    on_exit(fn ->
      File.rm_rf!(export_dir)
    end)

    {:ok, export_dir: export_dir}
  end

  describe "entity_to_prototype/1" do
    test "converts entity to prototype map" do
      entity = %Entity{
        id: "test-123",
        key: "test_entity",
        type: :item,
        name: "Test Item",
        description: "A test item",
        components: %{"physical" => %{"weight" => 5}},
        tags: ["test"],
        locks: %{"get" => "all()"},
        metadata: %{prototype_key: "test_proto"}
      }

      proto = WorldExporter.entity_to_prototype(entity)

      assert proto["key"] == "test_entity"
      assert proto["type"] == "item"
      assert proto["name"] == "Test Item"
      assert proto["description"] == "A test item"
      assert proto["tags"] == ["test"]
      assert proto["locks"] == %{"get" => "all()"}
    end

    test "omits empty fields" do
      entity = %Entity{
        id: "test-123",
        key: "minimal",
        type: :item,
        name: "Minimal",
        description: "Minimal item",
        components: %{},
        tags: [],
        locks: %{},
        metadata: %{}
      }

      proto = WorldExporter.entity_to_prototype(entity)

      refute Map.has_key?(proto, "components")
      refute Map.has_key?(proto, "tags")
      refute Map.has_key?(proto, "locks")
    end
  end

  describe "entity_to_yaml/1" do
    test "produces valid YAML string" do
      entity = %Entity{
        id: "test-123",
        key: "test_entity",
        type: :item,
        name: "Test Item",
        description: "A test item",
        components: %{},
        tags: ["test", "item"],
        locks: %{},
        metadata: %{}
      }

      yaml = WorldExporter.entity_to_yaml(entity)

      assert is_binary(yaml)
      assert String.contains?(yaml, "key: test_entity")
      assert String.contains?(yaml, "type: item")
      assert String.contains?(yaml, "name: Test Item")
    end

    test "handles multiline descriptions" do
      entity = %Entity{
        id: "test-123",
        key: "test_entity",
        type: :room,
        name: "Test Room",
        description: "Line 1\nLine 2\nLine 3",
        components: %{},
        tags: [],
        locks: %{},
        metadata: %{}
      }

      yaml = WorldExporter.entity_to_yaml(entity)

      assert String.contains?(yaml, "description: |")
    end
  end

  describe "export_all/1" do
    test "creates directory structure and exports entities", %{export_dir: export_dir} do
      {:ok, stats} = WorldExporter.export_all(export_dir)

      # Should have created subdirectories
      assert File.dir?(Path.join(export_dir, "rooms"))
      assert File.dir?(Path.join(export_dir, "npcs"))
      assert File.dir?(Path.join(export_dir, "items"))
      assert File.dir?(Path.join(export_dir, "exits"))

      # Should have exported room(s)
      assert stats.rooms >= 1
    end
  end

  describe "export_rooms/1" do
    test "exports only rooms", %{export_dir: export_dir} do
      rooms_dir = Path.join(export_dir, "rooms_only")

      {:ok, stats} = WorldExporter.export_rooms(rooms_dir)

      assert stats.count >= 1
      assert File.dir?(rooms_dir)

      # Should have .yml files
      files = Path.wildcard(Path.join(rooms_dir, "*.yml"))
      assert length(files) >= 1
    end
  end
end
