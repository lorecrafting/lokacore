defmodule Loka.Framework.Commands.GetCommandTest do
  use Loka.DataCase, async: true

  alias Loka.Framework.Commands.GetCommand

  describe "module structure" do
    test "module is defined and has expected functions" do
      Code.ensure_loaded!(GetCommand)
      assert function_exported?(GetCommand, :key, 0)
      assert function_exported?(GetCommand, :aliases, 0)
      assert function_exported?(GetCommand, :help, 0)
      assert function_exported?(GetCommand, :parse, 2)
      assert function_exported?(GetCommand, :execute, 2)
    end

    test "key returns 'get'" do
      assert GetCommand.key() == "get"
    end

    test "aliases include common synonyms" do
      aliases = GetCommand.aliases()
      assert "take" in aliases
      assert "pick" in aliases
      assert "grab" in aliases
    end

    test "help returns usage text" do
      help = GetCommand.help()
      assert is_binary(help)
      assert String.contains?(help, "item")
    end
  end

  describe "parse/2" do
    test "parses valid target with room context" do
      room = %{
        id: "room_1",
        items: [%{id: "item_1", name: "Sword"}]
      }

      context = %{location: room}

      assert {:ok, %{target: "sword", item: item}} =
               GetCommand.parse("sword", context)

      assert item.name == "Sword"
    end

    test "finds item by partial name match (case insensitive)" do
      room = %{
        id: "room_1",
        items: [%{id: "item_1", name: "Golden Sword of Destiny"}]
      }

      context = %{location: room}

      assert {:ok, %{target: "sword", item: item}} =
               GetCommand.parse("sword", context)

      assert item.name == "Golden Sword of Destiny"
    end

    test "returns nil item when target doesn't exist" do
      room = %{id: "room_1", items: []}
      context = %{location: room}

      assert {:ok, %{target: "sword", item: nil}} =
               GetCommand.parse("sword", context)
    end

    test "returns error for empty target" do
      room = %{id: "room_1", items: []}
      context = %{location: room}

      assert {:error, "Get what?"} = GetCommand.parse("", context)
    end

    test "returns error when no room in context" do
      context = %{location: nil}
      assert {:error, "You are nowhere."} = GetCommand.parse("sword", context)
    end

    test "handles room with nil items list" do
      room = %{id: "room_1", items: nil}
      context = %{location: room}

      assert {:ok, %{target: "sword", item: nil}} =
               GetCommand.parse("sword", context)
    end
  end

  describe "execute/2" do
    test "returns error message when item is nil" do
      parsed = %{target: "sword", item: nil}
      context = %{}

      assert {:ok, [event]} = GetCommand.execute(parsed, context)
      assert event.type == :system
      assert String.contains?(event.text, "don't see 'sword'")
    end
  end
end
