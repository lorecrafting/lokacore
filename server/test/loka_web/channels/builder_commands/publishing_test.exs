defmodule LokaWeb.Channels.BuilderCommands.PublishingTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.{Entity, Entities}
  alias LokaWeb.Channels.BuilderCommands.Publishing

  @socket %{}
  @world_dir :code.priv_dir(:loka) |> Path.join("world")

  setup do
    on_exit(fn ->
      # Clean up test YAML files
      for dir <- [
            "drafts/quests",
            "quests",
            "drafts/zones",
            "zones",
            "drafts/prototypes/rooms",
            "prototypes/rooms"
          ] do
        full_dir = Path.join(@world_dir, dir)

        if File.dir?(full_dir) do
          full_dir
          |> File.ls!()
          |> Enum.filter(fn f ->
            String.starts_with?(f, "pub_test") or
              String.starts_with?(f, "test_cascade")
          end)
          |> Enum.each(fn f -> File.rm(Path.join(full_dir, f)) end)
        end
      end
    end)

    :ok
  end

  describe "publish" do
    test "without --force returns confirmation prompt" do
      {:ok, message, _socket} =
        Publishing.execute(:publish, %{type: "quest", key: "pub_test"}, @socket)

      assert message =~ "Publish quest 'pub_test'?"
      assert message =~ "publish --force quest pub_test"
    end

    test "with --force moves file from drafts to published directory" do
      # Create a draft quest file
      draft_dir = Path.join(@world_dir, "drafts/quests")
      File.mkdir_p!(draft_dir)
      draft_path = Path.join(draft_dir, "pub_test.yml")

      File.write!(draft_path, """
      key: pub_test
      name: "Publish Test Quest"
      type: quest
      objectives:
        - id: test
          type: talk
          target_id: npc
          description: "Test"
      """)

      # Create corresponding entity in DB (V2: DB is truth, YAML is export)
      create_test_entity("pub_test", :quest, draft: true)

      # Verify it's a draft
      {:ok, obj} = Entities.find_one(key: "pub_test")
      assert Entity.draft?(obj)

      # Publish with --force
      {:ok, message, _socket} =
        Publishing.execute(:publish, %{type: "quest", key: "pub_test", force: true}, @socket)

      assert message =~ "Published"

      # Verify file moved
      refute File.exists?(draft_path)
      published_path = Path.join(@world_dir, "quests/pub_test.yml")
      assert File.exists?(published_path)
    end

    test "returns error when source file does not exist" do
      {:error, message, _socket} =
        Publishing.execute(
          :publish,
          %{type: "quest", key: "nonexistent_xyz", force: true},
          @socket
        )

      assert message =~ "not found"
    end

    test "returns error for unknown content type" do
      {:error, message, _socket} =
        Publishing.execute(:publish, %{type: "unknown", key: "test", force: true}, @socket)

      assert message =~ "Unknown content type"
    end

    test "publishing malformed YAML still moves file (V2: no reload validation)" do
      # In V2, publishing just moves files — no TypedObject reload/validation step.
      # Malformed YAML will be caught by content validators, not the publish command.
      draft_dir = Path.join(@world_dir, "drafts/quests")
      File.mkdir_p!(draft_dir)
      draft_path = Path.join(draft_dir, "pub_test_bad.yml")

      File.write!(draft_path, """
      name: "Bad Quest"
      description: "This quest has no key field"
      """)

      published_path = Path.join(@world_dir, "quests/pub_test_bad.yml")

      # In V2, publish just moves the file — succeeds even with bad YAML
      {:ok, message, _socket} =
        Publishing.execute(:publish, %{type: "quest", key: "pub_test_bad", force: true}, @socket)

      assert message =~ "Published"
      assert File.exists?(published_path)
      refute File.exists?(draft_path)
    end
  end

  describe "publish zone_all" do
    test "publishes zone and all associated rooms" do
      # Create draft zone YAML referencing two rooms
      draft_zone_dir = Path.join(@world_dir, "drafts/zones")
      File.mkdir_p!(draft_zone_dir)
      draft_zone_path = Path.join(draft_zone_dir, "test_cascade_zone.yml")

      File.write!(draft_zone_path, """
      key: test_cascade_zone
      name: "Cascade Test Zone"
      rooms:
        - test_cascade_room_a
        - test_cascade_room_b
      """)

      # Create draft room YAML files
      draft_room_dir = Path.join(@world_dir, "drafts/prototypes/rooms")
      File.mkdir_p!(draft_room_dir)

      draft_room_a_path = Path.join(draft_room_dir, "test_cascade_room_a.yml")

      File.write!(draft_room_a_path, """
      key: test_cascade_room_a
      parent: base_room
      type: room
      short_desc: "Cascade Room A"
      long_desc: "A test room for cascade publishing."
      """)

      draft_room_b_path = Path.join(draft_room_dir, "test_cascade_room_b.yml")

      File.write!(draft_room_b_path, """
      key: test_cascade_room_b
      parent: base_room
      type: room
      short_desc: "Cascade Room B"
      long_desc: "Another test room for cascade publishing."
      """)

      # Create corresponding entities in DB
      create_test_entity("test_cascade_zone", :zone,
        draft: true,
        components: %{
          "data" => %{"rooms" => ["test_cascade_room_a", "test_cascade_room_b"]}
        }
      )

      create_test_entity("test_cascade_room_a", :room, draft: true)
      create_test_entity("test_cascade_room_b", :room, draft: true)

      # Verify all three are drafts
      {:ok, zone_obj} = Entities.find_one(key: "test_cascade_zone")
      assert Entity.draft?(zone_obj)
      assert zone_obj.type == :zone

      {:ok, room_a} = Entities.find_one(key: "test_cascade_room_a")
      assert Entity.draft?(room_a)

      {:ok, room_b} = Entities.find_one(key: "test_cascade_room_b")
      assert Entity.draft?(room_b)

      # Publish zone_all with --force
      {:ok, message, _socket} =
        Publishing.execute(
          :publish,
          %{type: "zone_all", key: "test_cascade_zone", force: true},
          @socket
        )

      assert message =~ "Published zone 'test_cascade_zone'"
      assert message =~ "2 associated files"

      # Verify zone file moved from drafts to published
      refute File.exists?(draft_zone_path)
      published_zone_path = Path.join(@world_dir, "zones/test_cascade_zone.yml")
      assert File.exists?(published_zone_path)

      # Verify room files moved from drafts to published
      refute File.exists?(draft_room_a_path)
      refute File.exists?(draft_room_b_path)

      published_room_a = Path.join(@world_dir, "prototypes/rooms/test_cascade_room_a.yml")
      published_room_b = Path.join(@world_dir, "prototypes/rooms/test_cascade_room_b.yml")
      assert File.exists?(published_room_a)
      assert File.exists?(published_room_b)
    end

    test "returns error for nonexistent zone" do
      {:error, message, _socket} =
        Publishing.execute(
          :publish,
          %{type: "zone_all", key: "nonexistent_cascade_zone", force: true},
          @socket
        )

      assert message =~ "not found"
    end

    test "returns error when key exists but is not a zone type" do
      # Create a quest entity (not a zone) to test the "not a zone" error path
      create_test_entity("pub_test", :quest)

      {:error, message, _socket} =
        Publishing.execute(
          :publish,
          %{type: "zone_all", key: "pub_test", force: true},
          @socket
        )

      assert message =~ "is not a zone"
    end
  end

  describe "unpublish" do
    test "moves file from published to drafts directory" do
      # Create a published quest file
      published_dir = Path.join(@world_dir, "quests")
      published_path = Path.join(published_dir, "pub_test.yml")

      File.write!(published_path, """
      key: pub_test
      name: "Unpublish Test Quest"
      type: quest
      objectives:
        - id: test
          type: talk
          target_id: npc
          description: "Test"
      """)

      # Create corresponding entity in DB (published = no draft flag)
      create_test_entity("pub_test", :quest)

      # Verify it's published
      {:ok, obj} = Entities.find_one(key: "pub_test")
      refute Entity.draft?(obj)

      # Unpublish it
      {:ok, message, _socket} =
        Publishing.execute(:unpublish, %{type: "quest", key: "pub_test"}, @socket)

      assert message =~ "Unpublished"

      # Verify file moved
      refute File.exists?(published_path)
      draft_path = Path.join(@world_dir, "drafts/quests/pub_test.yml")
      assert File.exists?(draft_path)

      # Verify it's now a draft
      {:ok, obj} = Entities.find_one(key: "pub_test")
      assert Entity.draft?(obj)
    end
  end

  describe "command parser" do
    test "parses publish command without --force" do
      {action, params} = LokaWeb.Channels.CommandParser.parse("publish quest my_quest")
      assert action == :builder_publish
      assert params == %{type: "quest", key: "my_quest", force: false}
    end

    test "parses publish command with --force" do
      {action, params} = LokaWeb.Channels.CommandParser.parse("publish --force quest my_quest")
      assert action == :builder_publish
      assert params == %{type: "quest", key: "my_quest", force: true}
    end

    test "parses publish zone_all without --force" do
      {action, params} = LokaWeb.Channels.CommandParser.parse("publish zone_all my_zone")
      assert action == :builder_publish
      assert params == %{type: "zone_all", key: "my_zone", force: false}
    end

    test "parses publish zone_all with --force" do
      {action, params} = LokaWeb.Channels.CommandParser.parse("publish --force zone_all my_zone")
      assert action == :builder_publish
      assert params == %{type: "zone_all", key: "my_zone", force: true}
    end

    test "parses unpublish command" do
      {action, params} = LokaWeb.Channels.CommandParser.parse("unpublish zone my_zone")
      assert action == :builder_unpublish
      assert params == %{type: "zone", key: "my_zone"}
    end
  end

  # Helper to create a test entity in the DB
  defp create_test_entity(key, type, opts \\ []) do
    is_draft = Keyword.get(opts, :draft, false)
    components = Keyword.get(opts, :components, %{})

    metadata =
      if is_draft,
        do: %{"draft" => true},
        else: %{}

    entity =
      Entity.new(
        type: type,
        key: key,
        short_desc: "Test #{type} #{key}",
        components: components,
        metadata: metadata
      )

    {:ok, _} = Entities.save(entity)
  end
end
