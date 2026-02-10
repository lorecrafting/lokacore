defmodule LokaWeb.Channels.BuilderCommands.PreviewTest do
  use ExUnit.Case, async: false

  alias LokaWeb.Channels.BuilderCommands.Inspection
  alias LokaWeb.Channels.CommandParser

  @socket %{}
  @world_dir :code.priv_dir(:loka) |> Path.join("world")

  setup do
    Loka.TypedObjectSandbox.checkout()

    on_exit(fn ->
      # Clean up test draft files
      for dir <- ["drafts/quests", "quests"] do
        path = Path.join(@world_dir, "#{dir}/preview_test_quest.yml")
        if File.exists?(path), do: File.rm!(path)
      end

      Loka.Engine.TypedObject.Loader.reload()
    end)

    :ok
  end

  describe "command parser" do
    test "parses preview command with type and key" do
      {action, params} = CommandParser.parse("preview quest intro_welcome")
      assert action == :builder_preview
      assert params == %{type: "quest", key: "intro_welcome"}
    end

    test "parses preview command with npc type" do
      {action, params} = CommandParser.parse("preview npc merchant_bob")
      assert action == :builder_preview
      assert params == %{type: "npc", key: "merchant_bob"}
    end

    test "returns unknown for preview without arguments" do
      {action, _params} = CommandParser.parse("preview")
      assert action == :unknown
    end

    test "returns unknown for preview with only type" do
      {action, _params} = CommandParser.parse("preview quest")
      assert action == :unknown
    end
  end

  describe "preview draft content" do
    test "shows formatted preview of a draft quest" do
      # Create a draft quest file
      draft_dir = Path.join(@world_dir, "drafts/quests")
      File.mkdir_p!(draft_dir)
      draft_path = Path.join(draft_dir, "preview_test_quest.yml")

      File.write!(draft_path, """
      key: preview_test_quest
      name: "Preview Test Quest"
      type: quest
      description: "A quest for testing the preview command."
      objectives:
        - id: test_obj
          type: talk
          target_id: test_npc
          description: "Talk to the test NPC"
      rewards:
        experience: 100
        gold: 50
      """)

      # Reload to pick up the draft
      Loka.Engine.TypedObject.Loader.reload_file(draft_path)

      # Verify it's loaded as a draft
      {:ok, obj} = Loka.Engine.TypedObject.Loader.get("preview_test_quest")
      assert Loka.Engine.TypedObject.draft?(obj)

      # Execute the preview command
      {:ok, text, _socket} =
        Inspection.execute(:preview, %{type: "quest", key: "preview_test_quest"}, @socket)

      # Verify metadata section
      assert text =~ "Preview: preview_test_quest [DRAFT]"
      assert text =~ "Key:    preview_test_quest"
      assert text =~ "Type:   quest"
      assert text =~ "Status: DRAFT"
      assert text =~ "File:"
      assert text =~ "drafts/quests/preview_test_quest.yml"

      # Verify name is shown in metadata
      assert text =~ "Name:   Preview Test Quest"

      # Verify content fields section
      assert text =~ "Content Fields"
      assert text =~ "objectives:"
    end

    test "shows formatted preview of published content" do
      # Create a published quest file
      published_path = Path.join(@world_dir, "quests/preview_test_quest.yml")

      File.write!(published_path, """
      key: preview_test_quest
      name: "Published Preview Quest"
      type: quest
      objectives:
        - id: test_obj
          type: talk
          target_id: test_npc
          description: "Talk to the NPC"
      """)

      Loka.Engine.TypedObject.Loader.reload_file(published_path)

      {:ok, obj} = Loka.Engine.TypedObject.Loader.get("preview_test_quest")
      refute Loka.Engine.TypedObject.draft?(obj)

      {:ok, text, _socket} =
        Inspection.execute(:preview, %{type: "quest", key: "preview_test_quest"}, @socket)

      assert text =~ "Preview: preview_test_quest [PUBLISHED]"
      assert text =~ "Status: PUBLISHED"
    end

    test "shows comparison note when both draft and published versions exist" do
      # Create published version first
      published_path = Path.join(@world_dir, "quests/preview_test_quest.yml")

      File.write!(published_path, """
      key: preview_test_quest
      name: "Published Version"
      type: quest
      objectives:
        - id: obj1
          type: talk
          target_id: npc
          description: "Talk"
      """)

      # Create draft version
      draft_dir = Path.join(@world_dir, "drafts/quests")
      File.mkdir_p!(draft_dir)
      draft_path = Path.join(draft_dir, "preview_test_quest.yml")

      File.write!(draft_path, """
      key: preview_test_quest
      name: "Draft Version"
      type: quest
      objectives:
        - id: obj1
          type: talk
          target_id: npc
          description: "Talk"
      """)

      # Load the draft version into the registry (will be marked as draft)
      Loka.Engine.TypedObject.Loader.reload_file(draft_path)

      {:ok, text, _socket} =
        Inspection.execute(:preview, %{type: "quest", key: "preview_test_quest"}, @socket)

      # Should show draft status and note about published version
      assert text =~ "DRAFT"
      assert text =~ "Note: A published version also exists"
    end
  end

  describe "preview error cases" do
    test "returns error for nonexistent content" do
      {:error, text, _socket} =
        Inspection.execute(:preview, %{type: "quest", key: "nonexistent_xyz"}, @socket)

      assert text =~ "not found"
    end

    test "returns error for unknown content type" do
      {:error, text, _socket} =
        Inspection.execute(:preview, %{type: "unknown_type", key: "test"}, @socket)

      assert text =~ "Unknown type"
      assert text =~ "Valid types"
    end
  end

  describe "preview existing game content" do
    test "can preview a real quest from the world data" do
      # This test uses a quest that should exist in priv/world/quests/
      case Loka.Engine.TypedObject.Loader.get("intro_welcome") do
        {:ok, _obj} ->
          {:ok, text, _socket} =
            Inspection.execute(:preview, %{type: "quest", key: "intro_welcome"}, @socket)

          assert text =~ "Preview: intro_welcome"
          assert text =~ "Type:   quest"
          assert text =~ "Content Fields"

        {:error, :not_found} ->
          # Skip if intro_welcome doesn't exist in this environment
          :ok
      end
    end
  end
end
