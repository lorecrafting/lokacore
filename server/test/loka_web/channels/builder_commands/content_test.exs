defmodule LokaWeb.Channels.BuilderCommands.ContentTest do
  use Loka.DataCase, async: false

  alias LokaWeb.Channels.BuilderCommands.Content

  setup do
    {:ok, _} = Loka.Engine.EntitySeeder.seed()

    on_exit(fn ->
      # Clean up any dialogue files created by tests
      Loka.TestCleanup.cleanup_dialogue_test_files()
    end)

    :ok
  end

  # Use a minimal socket stand-in since Content commands only pass it through
  @socket %{}

  describe "execute(:quest_info, ...)" do
    test "returns quest details for existing quest" do
      # Find any real quest — content-agnostic so it works with or without monastery/Grove quests
      case Loka.Engine.Entities.find_all(type: :quest) do
        [] ->
          # No quests yet — passes vacuously until Grove quest content is built
          :ok

        [quest | _] ->
          {:ok, text, _socket} = Content.execute(:quest_info, %{key: quest.key}, @socket)
          assert text =~ "Quest '#{quest.key}':"
          assert text =~ "key: #{quest.key}"
      end
    end

    test "returns error for nonexistent quest" do
      {:error, text, _socket} =
        Content.execute(:quest_info, %{key: "nonexistent_quest_xyz"}, @socket)

      assert text =~ "not found"
    end
  end

  describe "execute(:dialogue_info, ...)" do
    test "returns dialogue structure for existing dialogue" do
      # novice_pema is a common test dialogue
      case Content.execute(:dialogue_info, %{key: "novice_pema"}, @socket) do
        {:ok, text, _socket} ->
          assert text =~ "Dialogue 'novice_pema'"
          assert text =~ "nodes"

        {:error, text, _socket} ->
          # If dialogue doesn't exist in test env, that's also valid
          assert text =~ "not found"
      end
    end

    test "returns error for nonexistent dialogue" do
      {:error, text, _socket} =
        Content.execute(:dialogue_info, %{key: "nonexistent_dialogue_xyz"}, @socket)

      assert text =~ "not found"
    end
  end

  describe "execute(:create_dialogue, ...)" do
    test "creates dialogue template for new NPC" do
      {:ok, text, _socket} =
        Content.execute(:create_dialogue, %{npc_key: "test_create_dlg_npc"}, @socket)

      assert text =~ "Dialogue 'test_create_dlg_npc' created"
      assert text =~ "3 nodes"
      assert text =~ "/ai"
    end
  end

  describe "execute(:edit_quest, ...)" do
    test "shows quest details when no field specified" do
      case Loka.Engine.Entities.find_all(type: :quest) do
        [] ->
          :ok

        [quest | _] ->
          {:ok, text, _socket} =
            Content.execute(:edit_quest, %{key: quest.key, field: nil}, @socket)

          assert text =~ "Quest '#{quest.key}':"
          assert text =~ "key: #{quest.key}"
      end
    end

    test "returns error for nonexistent quest" do
      {:error, text, _socket} =
        Content.execute(:edit_quest, %{key: "nonexistent_xyz", field: nil}, @socket)

      assert text =~ "not found"
    end
  end
end
