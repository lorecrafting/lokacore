defmodule LokaWeb.Channels.BuilderCommands.PublishingTest do
  use ExUnit.Case, async: false

  alias Loka.TestCleanup
  alias LokaWeb.Channels.BuilderCommands.Publishing

  @socket %{}
  @world_dir :code.priv_dir(:loka) |> Path.join("world")

  setup do
    Loka.TypedObjectSandbox.checkout()

    on_exit(fn ->
      TestCleanup.cleanup_quest_test_files()
      TestCleanup.cleanup_room_test_files()
      TestCleanup.cleanup_draft_files(:zone)

      # Also clean published zone files from publish tests
      for key <- ["pub_test", "test_cascade_zone"] do
        path = Path.join(@world_dir, "zones/#{key}.yml")
        if File.exists?(path), do: File.rm!(path)
      end

      Loka.Engine.TypedObject.Loader.reload()
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

      # Reload to pick up the draft
      Loka.Engine.TypedObject.Loader.reload_file(draft_path)

      # Verify it's a draft
      {:ok, obj} = Loka.Engine.TypedObject.Loader.get("pub_test")
      assert Loka.Engine.TypedObject.draft?(obj)

      # Publish with --force
      {:ok, message, _socket} =
        Publishing.execute(:publish, %{type: "quest", key: "pub_test", force: true}, @socket)

      assert message =~ "Published"

      # Verify file moved
      refute File.exists?(draft_path)
      published_path = Path.join(@world_dir, "quests/pub_test.yml")
      assert File.exists?(published_path)

      # Verify it's no longer a draft
      {:ok, obj} = Loka.Engine.TypedObject.Loader.get("pub_test")
      refute Loka.Engine.TypedObject.draft?(obj)
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

    test "rolls back file on reload failure from malformed YAML" do
      # Create a draft file with malformed YAML content (missing key causes validation failure)
      draft_dir = Path.join(@world_dir, "drafts/quests")
      File.mkdir_p!(draft_dir)
      draft_path = Path.join(draft_dir, "pub_test_bad.yml")

      # YAML that parses but fails TypedObject validation (no key or id field)
      File.write!(draft_path, """
      name: "Bad Quest"
      description: "This quest has no key field"
      """)

      published_path = Path.join(@world_dir, "quests/pub_test_bad.yml")

      # Attempt to publish with --force - should fail during reload_file and rollback
      {:error, message, _socket} =
        Publishing.execute(:publish, %{type: "quest", key: "pub_test_bad", force: true}, @socket)

      assert message =~ "Failed to reload after move"

      # Verify file was rolled back to draft location
      assert File.exists?(draft_path), "Draft file should be restored after rollback"
      refute File.exists?(published_path), "Published file should not exist after rollback"
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

      # Reload to pick up all drafts
      Loka.Engine.TypedObject.Loader.reload_file(draft_zone_path)
      Loka.Engine.TypedObject.Loader.reload_file(draft_room_a_path)
      Loka.Engine.TypedObject.Loader.reload_file(draft_room_b_path)

      # Verify all three are drafts
      {:ok, zone_obj} = Loka.Engine.TypedObject.Loader.get("test_cascade_zone")
      assert Loka.Engine.TypedObject.draft?(zone_obj)
      assert zone_obj.type == :zone

      {:ok, room_a} = Loka.Engine.TypedObject.Loader.get("test_cascade_room_a")
      assert Loka.Engine.TypedObject.draft?(room_a)

      {:ok, room_b} = Loka.Engine.TypedObject.Loader.get("test_cascade_room_b")
      assert Loka.Engine.TypedObject.draft?(room_b)

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

      # Verify all objects are no longer drafts
      {:ok, zone_obj} = Loka.Engine.TypedObject.Loader.get("test_cascade_zone")
      refute Loka.Engine.TypedObject.draft?(zone_obj)

      {:ok, room_a} = Loka.Engine.TypedObject.Loader.get("test_cascade_room_a")
      refute Loka.Engine.TypedObject.draft?(room_a)

      {:ok, room_b} = Loka.Engine.TypedObject.Loader.get("test_cascade_room_b")
      refute Loka.Engine.TypedObject.draft?(room_b)
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
      # pub_test quest should already be loadable if we create it;
      # use the quest type to test the "not a zone" error path
      draft_dir = Path.join(@world_dir, "drafts/quests")
      File.mkdir_p!(draft_dir)
      draft_path = Path.join(draft_dir, "pub_test.yml")

      File.write!(draft_path, """
      key: pub_test
      name: "Not A Zone"
      type: quest
      objectives:
        - id: test
          type: talk
          target_id: npc
          description: "Test"
      """)

      Loka.Engine.TypedObject.Loader.reload_file(draft_path)

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

      # Reload to pick up the file
      Loka.Engine.TypedObject.Loader.reload_file(published_path)

      # Verify it's published
      {:ok, obj} = Loka.Engine.TypedObject.Loader.get("pub_test")
      refute Loka.Engine.TypedObject.draft?(obj)

      # Unpublish it
      {:ok, message, _socket} =
        Publishing.execute(:unpublish, %{type: "quest", key: "pub_test"}, @socket)

      assert message =~ "Unpublished"

      # Verify file moved
      refute File.exists?(published_path)
      draft_path = Path.join(@world_dir, "drafts/quests/pub_test.yml")
      assert File.exists?(draft_path)

      # Verify it's now a draft
      {:ok, obj} = Loka.Engine.TypedObject.Loader.get("pub_test")
      assert Loka.Engine.TypedObject.draft?(obj)
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
end
