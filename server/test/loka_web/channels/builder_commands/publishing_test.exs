defmodule LokaWeb.Channels.BuilderCommands.PublishingTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.{Entity, Entities}
  alias LokaWeb.Channels.BuilderCommands.Publishing

  @socket %{}

  describe "publish" do
    test "without --force returns confirmation prompt" do
      {:ok, message, _socket} =
        Publishing.execute(:publish, %{type: "quest", key: "pub_test"}, @socket)

      assert message =~ "Publish quest 'pub_test'?"
      assert message =~ "publish --force quest pub_test"
    end

    test "with --force removes draft flag from entity" do
      create_test_entity("pub_test", :quest, draft: true)

      # Verify it's a draft
      {:ok, obj} = Entities.find_one(key: "pub_test")
      assert Entity.draft?(obj)

      # Publish with --force
      {:ok, message, _socket} =
        Publishing.execute(:publish, %{type: "quest", key: "pub_test", force: true}, @socket)

      assert message =~ "Published"

      # Verify draft flag removed
      {:ok, obj} = Entities.find_one(key: "pub_test")
      refute Entity.draft?(obj)
    end

    test "returns error when entity does not exist" do
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

    test "publishing already-published entity is idempotent" do
      create_test_entity("pub_test", :quest)

      {:ok, obj} = Entities.find_one(key: "pub_test")
      refute Entity.draft?(obj)

      # Publishing again succeeds
      {:ok, message, _socket} =
        Publishing.execute(:publish, %{type: "quest", key: "pub_test", force: true}, @socket)

      assert message =~ "Published"

      {:ok, obj} = Entities.find_one(key: "pub_test")
      refute Entity.draft?(obj)
    end
  end

  describe "publish zone_all" do
    test "publishes zone and all associated rooms" do
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
      assert message =~ "2 associated rooms"

      # Verify all draft flags removed
      {:ok, zone_obj} = Entities.find_one(key: "test_cascade_zone")
      refute Entity.draft?(zone_obj)

      {:ok, room_a} = Entities.find_one(key: "test_cascade_room_a")
      refute Entity.draft?(room_a)

      {:ok, room_b} = Entities.find_one(key: "test_cascade_room_b")
      refute Entity.draft?(room_b)
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
      create_test_entity("pub_test", :quest)

      {:error, message, _socket} =
        Publishing.execute(
          :publish,
          %{type: "zone_all", key: "pub_test", force: true},
          @socket
        )

      assert message =~ "is not a zone"
    end

    test "rolls back on failure when a room is not found" do
      create_test_entity("test_rollback_zone", :zone,
        draft: true,
        components: %{
          "data" => %{"rooms" => ["test_rollback_room_a", "nonexistent_room_xyz"]}
        }
      )

      create_test_entity("test_rollback_room_a", :room, draft: true)

      {:error, message, _socket} =
        Publishing.execute(
          :publish,
          %{type: "zone_all", key: "test_rollback_zone", force: true},
          @socket
        )

      assert message =~ "rolled back"

      # Verify zone and room_a are still drafts (rolled back)
      {:ok, zone} = Entities.find_one(key: "test_rollback_zone")
      assert Entity.draft?(zone)

      {:ok, room_a} = Entities.find_one(key: "test_rollback_room_a")
      assert Entity.draft?(room_a)
    end
  end

  describe "unpublish" do
    test "adds draft flag to entity" do
      create_test_entity("pub_test", :quest)

      # Verify it's published
      {:ok, obj} = Entities.find_one(key: "pub_test")
      refute Entity.draft?(obj)

      # Unpublish it
      {:ok, message, _socket} =
        Publishing.execute(:unpublish, %{type: "quest", key: "pub_test"}, @socket)

      assert message =~ "Unpublished"

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
