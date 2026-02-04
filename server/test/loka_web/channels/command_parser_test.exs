defmodule LokaWeb.Channels.CommandParserTest do
  use ExUnit.Case, async: true

  alias LokaWeb.Channels.CommandParser

  describe "navigation commands" do
    test "parses full direction names" do
      assert CommandParser.parse("north") == {:navigate, %{direction: "north"}}
      assert CommandParser.parse("south") == {:navigate, %{direction: "south"}}
      assert CommandParser.parse("east") == {:navigate, %{direction: "east"}}
      assert CommandParser.parse("west") == {:navigate, %{direction: "west"}}
      assert CommandParser.parse("up") == {:navigate, %{direction: "up"}}
      assert CommandParser.parse("down") == {:navigate, %{direction: "down"}}
    end

    test "parses shorthand directions" do
      assert CommandParser.parse("n") == {:navigate, %{direction: "north"}}
      assert CommandParser.parse("s") == {:navigate, %{direction: "south"}}
      assert CommandParser.parse("e") == {:navigate, %{direction: "east"}}
      assert CommandParser.parse("w") == {:navigate, %{direction: "west"}}
      assert CommandParser.parse("u") == {:navigate, %{direction: "up"}}
      assert CommandParser.parse("d") == {:navigate, %{direction: "down"}}
    end
  end

  describe "builder commands (prefixed :builder_*)" do
    test "parses goto" do
      assert CommandParser.parse("goto tavern") == {:builder_goto, %{room_key: "tavern"}}
    end

    test "parses spawn" do
      assert CommandParser.parse("spawn guard") == {:builder_spawn, %{npc_key: "guard"}}
    end

    test "parses give" do
      assert CommandParser.parse("give sword") == {:builder_give, %{item_key: "sword"}}
    end

    test "parses info" do
      assert CommandParser.parse("info monk") == {:builder_info, %{target: "monk"}}
    end

    test "parses flag commands" do
      assert CommandParser.parse("setflag quest_done") ==
               {:builder_setflag, %{flag: "quest_done"}}

      assert CommandParser.parse("clearflag quest_done") ==
               {:builder_clearflag, %{flag: "quest_done"}}

      assert CommandParser.parse("flags") == {:builder_flags, %{}}
    end

    test "parses quest commands" do
      assert CommandParser.parse("startquest intro") == {:builder_startquest, %{key: "intro"}}

      assert CommandParser.parse("completequest intro") ==
               {:builder_completequest, %{key: "intro"}}

      assert CommandParser.parse("resetquest intro") == {:builder_resetquest, %{key: "intro"}}
      assert CommandParser.parse("quests") == {:builder_quests, %{}}
    end

    test "parses settime" do
      assert CommandParser.parse("settime dawn") == {:builder_settime, %{time: "dawn"}}
    end

    test "parses list" do
      assert CommandParser.parse("list npcs") == {:builder_list, %{type: "npcs"}}
      assert CommandParser.parse("list items") == {:builder_list, %{type: "items"}}
    end

    test "parses find" do
      assert CommandParser.parse("find sword") == {:builder_find, %{search: "sword"}}
    end

    test "parses no-argument builder commands" do
      assert CommandParser.parse("rooms") == {:builder_rooms, %{}}
      assert CommandParser.parse("where") == {:builder_where, %{}}
      assert CommandParser.parse("purge") == {:builder_purge, %{}}
      assert CommandParser.parse("reload") == {:builder_reload, %{}}
      assert CommandParser.parse("validate") == {:builder_validate, %{}}
      assert CommandParser.parse("godmode") == {:builder_godmode, %{}}
    end
  end

  describe "player commands" do
    test "parses look" do
      assert CommandParser.parse("look") == {:look, %{}}
      assert CommandParser.parse("l") == {:look, %{}}
    end

    test "parses look with target" do
      assert CommandParser.parse("look monk") == {:look, %{target: "monk"}}
    end

    test "parses talk" do
      assert CommandParser.parse("talk elder") == {:talk, %{target: "elder"}}
    end

    test "parses inventory" do
      assert CommandParser.parse("inventory") == {:inventory, %{}}
      assert CommandParser.parse("i") == {:inventory, %{}}
    end

    test "parses get and drop" do
      assert CommandParser.parse("get sword") == {:get_item, %{target: "sword"}}
      assert CommandParser.parse("drop shield") == {:drop_item, %{target: "shield"}}
    end

    test "parses say" do
      assert CommandParser.parse("say hello world") == {:say, %{message: "hello world"}}
    end

    test "parses combat commands" do
      assert CommandParser.parse("attack goblin") == {:attack, %{target: "goblin"}}
      assert CommandParser.parse("flee") == {:flee, %{}}
    end

    test "parses equip and unequip" do
      assert CommandParser.parse("equip sword") == {:equip, %{target: "sword"}}
      assert CommandParser.parse("unequip head") == {:unequip, %{target: "head"}}
    end

    test "parses who" do
      assert CommandParser.parse("who") == {:who, %{}}
    end

    test "parses help" do
      assert CommandParser.parse("help") == {:help, %{}}
    end

    test "parses clear" do
      assert CommandParser.parse("clear") == {:clear, %{}}
    end
  end

  describe "edge cases" do
    test "handles empty input" do
      assert CommandParser.parse("") == {:unknown, %{text: ""}}
    end

    test "handles whitespace-only input" do
      assert CommandParser.parse("   ") == {:unknown, %{text: ""}}
    end

    test "strips leading and trailing whitespace" do
      assert CommandParser.parse("  north  ") == {:navigate, %{direction: "north"}}
    end

    test "handles extra whitespace between words" do
      assert CommandParser.parse("goto   tavern") == {:builder_goto, %{room_key: "tavern"}}
    end

    test "returns unknown for unrecognized commands" do
      assert CommandParser.parse("dance") == {:unknown, %{text: "dance"}}
      assert CommandParser.parse("xyzzy") == {:unknown, %{text: "xyzzy"}}
    end

    test "say preserves full message text" do
      assert CommandParser.parse("say hello there friend") ==
               {:say, %{message: "hello there friend"}}
    end

    test "find preserves search text with spaces" do
      assert CommandParser.parse("find ancient sword") ==
               {:builder_find, %{search: "ancient sword"}}
    end
  end
end
