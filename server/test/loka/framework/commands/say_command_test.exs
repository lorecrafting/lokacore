defmodule Loka.Framework.Commands.SayCommandTest do
  use Loka.DataCase, async: true

  alias Loka.Framework.Commands.SayCommand

  describe "module structure" do
    test "module is defined and has expected functions" do
      Code.ensure_loaded!(SayCommand)
      assert function_exported?(SayCommand, :key, 0)
      assert function_exported?(SayCommand, :aliases, 0)
      assert function_exported?(SayCommand, :help, 0)
      assert function_exported?(SayCommand, :parse, 2)
      assert function_exported?(SayCommand, :execute, 2)
    end

    test "key returns 'say'" do
      assert SayCommand.key() == "say"
    end

    test "aliases include apostrophe shortcut" do
      assert "'" in SayCommand.aliases()
    end

    test "help returns usage text" do
      help = SayCommand.help()
      assert is_binary(help)
      assert String.contains?(help, "say")
    end
  end

  describe "parse/2" do
    test "parses valid message" do
      assert {:ok, %{message: "Hello everyone!"}} = SayCommand.parse("Hello everyone!", %{})
    end

    test "trims whitespace from message" do
      assert {:ok, %{message: "Hello"}} = SayCommand.parse("  Hello  ", %{})
    end

    test "returns error for empty message" do
      assert {:error, "Say what?"} = SayCommand.parse("", %{})
    end

    test "returns error for whitespace-only message" do
      assert {:error, "Say what?"} = SayCommand.parse("   ", %{})
    end
  end
end
