defmodule Loka.WorldBuilder.ToolExecutor.GameActionsTest do
  use ExUnit.Case, async: true

  alias Loka.WorldBuilder.ToolExecutor.GameActions

  describe "execute_game_command/2 validation" do
    test "rejects empty command" do
      assert {:error, "Empty command"} = GameActions.execute_game_command(%{"command" => ""}, [])
    end

    test "rejects missing command parameter" do
      assert {:error, "Missing 'command' parameter"} =
               GameActions.execute_game_command(%{}, [])
    end

    test "rejects builder commands" do
      assert {:error, msg} = GameActions.execute_game_command(%{"command" => "goto tavern"}, [])
      assert msg =~ "not available"
    end

    test "rejects help command" do
      assert {:error, msg} = GameActions.execute_game_command(%{"command" => "help"}, [])
      assert msg =~ "not available"
    end

    test "rejects clear command" do
      assert {:error, msg} = GameActions.execute_game_command(%{"command" => "clear"}, [])
      assert msg =~ "not available"
    end

    test "rejects create builder commands" do
      assert {:error, msg} =
               GameActions.execute_game_command(%{"command" => "create room foo"}, [])

      assert msg =~ "not available"
    end

    test "errors when no character stashed" do
      # Navigation needs a character in process dict
      Process.delete(:loka_ai_character)
      Process.delete(:loka_ai_player)

      assert {:error, "No character available"} =
               GameActions.execute_game_command(%{"command" => "look"}, [])
    end
  end
end
