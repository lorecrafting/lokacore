defmodule Loka.Framework.Commands.NavigateCommandTest do
  use Loka.DataCase, async: true

  alias Loka.Framework.Commands.NavigateCommand

  describe "module structure" do
    test "module is defined and has expected functions" do
      Code.ensure_loaded!(NavigateCommand)
      assert function_exported?(NavigateCommand, :key, 0)
      assert function_exported?(NavigateCommand, :aliases, 0)
      assert function_exported?(NavigateCommand, :help, 0)
      assert function_exported?(NavigateCommand, :parse, 2)
      assert function_exported?(NavigateCommand, :execute, 2)
    end

    test "key returns 'go'" do
      assert NavigateCommand.key() == "go"
    end

    test "aliases include compass directions" do
      aliases = NavigateCommand.aliases()
      assert "north" in aliases
      assert "south" in aliases
      assert "east" in aliases
      assert "west" in aliases
      assert "n" in aliases
      assert "s" in aliases
      assert "e" in aliases
      assert "w" in aliases
    end

    test "help returns usage text" do
      help = NavigateCommand.help()
      assert is_binary(help)
      assert String.contains?(help, "direction")
    end
  end

  describe "parse/2" do
    test "parses valid direction with room context" do
      room = %{
        id: "room_1",
        exits: [%{direction: "north", destination_id: "room_2"}]
      }

      context = %{location: room}

      assert {:ok, %{direction: "north", exit: exit}} =
               NavigateCommand.parse("north", context)

      assert exit.destination_id == "room_2"
    end

    test "normalizes direction aliases" do
      room = %{
        id: "room_1",
        exits: [%{direction: "north", destination_id: "room_2"}]
      }

      context = %{location: room}

      assert {:ok, %{direction: "north"}} = NavigateCommand.parse("n", context)
      assert {:ok, %{direction: "south"}} = NavigateCommand.parse("s", context)
      assert {:ok, %{direction: "east"}} = NavigateCommand.parse("e", context)
      assert {:ok, %{direction: "west"}} = NavigateCommand.parse("w", context)
      assert {:ok, %{direction: "up"}} = NavigateCommand.parse("u", context)
      assert {:ok, %{direction: "down"}} = NavigateCommand.parse("d", context)
    end

    test "returns nil exit when direction doesn't exist" do
      room = %{id: "room_1", exits: []}
      context = %{location: room}

      assert {:ok, %{direction: "north", exit: nil}} =
               NavigateCommand.parse("north", context)
    end

    test "returns error for empty direction" do
      room = %{id: "room_1", exits: []}
      context = %{location: room}

      assert {:error, "Go where?"} = NavigateCommand.parse("", context)
    end

    test "returns error when no room in context" do
      context = %{location: nil}
      assert {:error, "You are nowhere."} = NavigateCommand.parse("north", context)
    end
  end

  describe "execute/2" do
    test "returns error message when exit is nil" do
      parsed = %{direction: "north", exit: nil}
      context = %{}

      assert {:ok, [event]} = NavigateCommand.execute(parsed, context)
      assert event.type == :system
      assert String.contains?(event.text, "can't go north")
    end

    test "returns error message when exit has no destination" do
      parsed = %{direction: "north", exit: %{destination_id: nil}}
      context = %{}

      assert {:ok, [event]} = NavigateCommand.execute(parsed, context)
      assert event.type == :system
      assert String.contains?(event.text, "nowhere")
    end
  end
end
