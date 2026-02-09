defmodule LokaWeb.Channels.BuilderCommands.HelpTest do
  use ExUnit.Case, async: true

  alias LokaWeb.Channels.BuilderCommands.Help

  describe "execute/3 - general help" do
    test "returns full help text" do
      {:ok_text, text} = Help.execute(:help, %{}, nil)

      assert text =~ "Available Commands:"
      assert text =~ "Builder Commands:"
      assert text =~ "AI:"
    end
  end

  describe "execute/3 - topic help" do
    test "returns rooms help" do
      {:ok_text, text} = Help.execute(:help, %{topic: "rooms"}, nil)

      assert text =~ "Room Commands:"
      assert text =~ "dig"
      assert text =~ "@desc"
    end

    test "returns entities help" do
      {:ok_text, text} = Help.execute(:help, %{topic: "entities"}, nil)

      assert text =~ "Entity Commands:"
      assert text =~ "create npc"
      assert text =~ "create item"
    end

    test "returns quests help" do
      {:ok_text, text} = Help.execute(:help, %{topic: "quests"}, nil)

      assert text =~ "Quest & Dialogue Commands:"
    end

    test "returns guides help" do
      {:ok_text, text} = Help.execute(:help, %{topic: "guides"}, nil)

      assert text =~ "Guide Commands:"
    end

    test "returns ai help" do
      {:ok_text, text} = Help.execute(:help, %{topic: "ai"}, nil)

      assert text =~ "AI Commands:"
      assert text =~ "chat"
    end

    test "returns error for unknown topic" do
      {:ok_text, text} = Help.execute(:help, %{topic: "nonsense"}, nil)

      assert text =~ "Unknown help topic"
    end
  end

  describe "full_help/0" do
    test "includes all command categories" do
      text = Help.full_help()

      for category <- ~w(Movement Look Talk Inventory Chat Combat) do
        assert text =~ "#{category}:", "Missing category: #{category}"
      end
    end

    test "includes builder command categories" do
      text = Help.full_help()

      for category <- ~w(Navigation Inspect Spawn Entity Content Guides AI) do
        assert text =~ "#{category}:", "Missing builder category: #{category}"
      end

      # "Room CRUD:" uses a different format
      assert text =~ "Room CRUD:"
    end
  end
end
