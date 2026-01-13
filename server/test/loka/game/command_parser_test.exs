defmodule Loka.Game.CommandParserTest do
  use ExUnit.Case, async: true

  alias Loka.Game.CommandParser

  describe "parse/1 - movement" do
    test "parses full direction names" do
      assert {:move, "north"} = CommandParser.parse("north")
      assert {:move, "south"} = CommandParser.parse("south")
      assert {:move, "east"} = CommandParser.parse("east")
      assert {:move, "west"} = CommandParser.parse("west")
      assert {:move, "up"} = CommandParser.parse("up")
      assert {:move, "down"} = CommandParser.parse("down")
    end

    test "parses single-letter direction aliases" do
      assert {:move, "north"} = CommandParser.parse("n")
      assert {:move, "south"} = CommandParser.parse("s")
      assert {:move, "east"} = CommandParser.parse("e")
      assert {:move, "west"} = CommandParser.parse("w")
      assert {:move, "up"} = CommandParser.parse("u")
      assert {:move, "down"} = CommandParser.parse("d")
    end

    test "parses diagonal directions" do
      assert {:move, "northeast"} = CommandParser.parse("ne")
      assert {:move, "northwest"} = CommandParser.parse("nw")
      assert {:move, "southeast"} = CommandParser.parse("se")
      assert {:move, "southwest"} = CommandParser.parse("sw")
    end

    test "is case insensitive" do
      assert {:move, "north"} = CommandParser.parse("NORTH")
      assert {:move, "north"} = CommandParser.parse("North")
      assert {:move, "north"} = CommandParser.parse("N")
    end
  end

  describe "parse/1 - look" do
    test "parses look without target" do
      assert {:look, nil} = CommandParser.parse("look")
      assert {:look, nil} = CommandParser.parse("l")
    end

    test "parses look with target" do
      assert {:look, "monk"} = CommandParser.parse("look monk")
      assert {:look, "old man"} = CommandParser.parse("look old man")
      assert {:look, "monk"} = CommandParser.parse("l monk")
    end

    test "parses examine as look" do
      assert {:look, "sword"} = CommandParser.parse("examine sword")
      assert {:look, "sword"} = CommandParser.parse("ex sword")
    end
  end

  describe "parse/1 - communication" do
    test "parses say command" do
      assert {:say, "hello everyone"} = CommandParser.parse("say hello everyone")
    end

    test "parses quote shortcut for say" do
      assert {:say, "hello everyone"} = CommandParser.parse("'hello everyone")
    end

    test "parses shout command" do
      assert {:shout, "help!"} = CommandParser.parse("shout help!")
    end

    test "parses yell command" do
      assert {:yell, "over here!"} = CommandParser.parse("yell over here!")
    end

    test "parses whisper command" do
      assert {:whisper, "player1", "secret message"} =
               CommandParser.parse("whisper player1 secret message")
    end

    test "parses whisper with no message" do
      assert {:whisper, "player1", ""} = CommandParser.parse("whisper player1")
    end
  end

  describe "parse/1 - interaction" do
    test "parses talk command" do
      assert {:talk, "monk"} = CommandParser.parse("talk monk")
      assert {:talk, nil} = CommandParser.parse("talk")
    end

    test "parses get/take command" do
      assert {:get, "sword"} = CommandParser.parse("get sword")
      assert {:get, "sword"} = CommandParser.parse("take sword")
      assert {:get, nil} = CommandParser.parse("get")
    end

    test "parses drop command" do
      assert {:drop, "sword"} = CommandParser.parse("drop sword")
      assert {:drop, nil} = CommandParser.parse("drop")
    end
  end

  describe "parse/1 - inventory and equipment" do
    test "parses inventory command" do
      assert {:inventory, nil} = CommandParser.parse("inventory")
      assert {:inventory, nil} = CommandParser.parse("inv")
      assert {:inventory, nil} = CommandParser.parse("i")
    end

    test "parses equipment command" do
      assert {:equipment, nil} = CommandParser.parse("equipment")
      assert {:equipment, nil} = CommandParser.parse("eq")
    end
  end

  describe "parse/1 - combat" do
    test "parses attack command" do
      assert {:attack, "goblin"} = CommandParser.parse("attack goblin")
      assert {:attack, "goblin"} = CommandParser.parse("kill goblin")
    end

    test "parses flee command" do
      assert {:flee, nil} = CommandParser.parse("flee")
    end
  end

  describe "parse/1 - info commands" do
    test "parses help command" do
      assert {:help, nil} = CommandParser.parse("help")
      assert {:help, nil} = CommandParser.parse("?")
      assert {:help, "movement"} = CommandParser.parse("help movement")
    end

    test "parses who command" do
      assert {:who, nil} = CommandParser.parse("who")
    end

    test "parses score/stats command" do
      assert {:score, nil} = CommandParser.parse("score")
      assert {:score, nil} = CommandParser.parse("stats")
    end
  end

  describe "parse/1 - emote" do
    test "parses emote command" do
      assert {:emote, "waves"} = CommandParser.parse("emote waves")
      assert {:emote, "waves"} = CommandParser.parse(":waves")
    end
  end

  describe "parse/1 - unknown commands" do
    test "returns unknown for unrecognized commands" do
      assert {:unknown, "foobar"} = CommandParser.parse("foobar")
      assert {:unknown, "gibberish"} = CommandParser.parse("gibberish")
    end
  end

  describe "parse/1 - whitespace handling" do
    test "trims leading and trailing whitespace" do
      assert {:move, "north"} = CommandParser.parse("  north  ")
      assert {:say, "hello"} = CommandParser.parse("  say hello  ")
    end
  end

  describe "help/1" do
    test "returns general help for nil" do
      help_text = CommandParser.help(nil)
      assert help_text =~ "Available commands"
      assert help_text =~ "Movement"
    end

    test "returns movement help" do
      help_text = CommandParser.help("movement")
      assert help_text =~ "Movement Commands"
      assert help_text =~ "north/n"
    end

    test "returns chat help" do
      help_text = CommandParser.help("chat")
      assert help_text =~ "Chat Commands"
      assert help_text =~ "say"
    end

    test "returns generic message for unknown topic" do
      help_text = CommandParser.help("unknown_topic")
      assert help_text =~ "No help available"
    end
  end
end
