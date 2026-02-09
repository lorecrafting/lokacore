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

  describe "create commands" do
    test "create zone with key only defaults name" do
      assert CommandParser.parse("create zone dark_forest") ==
               {:builder_create_zone, %{key: "dark_forest", name: "dark_forest"}}
    end

    test "create cutscene with key only defaults name" do
      assert CommandParser.parse("create cutscene intro_cs") ==
               {:builder_create_cutscene, %{key: "intro_cs", name: "intro_cs"}}
    end

    test "create storyline with key only defaults name" do
      assert CommandParser.parse("create storyline main_story") ==
               {:builder_create_storyline, %{key: "main_story", name: "main_story"}}
    end

    test "create room with key only defaults name" do
      assert CommandParser.parse("create room tavern") ==
               {:builder_create_room, %{key: "tavern", name: "tavern"}}
    end

    test "create dialogue with npc key" do
      assert CommandParser.parse("create dialogue monk_elder") ==
               {:builder_create_dialogue, %{npc_key: "monk_elder"}}
    end

    test "create without enough args returns unknown" do
      assert CommandParser.parse("create zone") == {:unknown, %{text: "create zone"}}
      assert CommandParser.parse("create cutscene") == {:unknown, %{text: "create cutscene"}}
      assert CommandParser.parse("create storyline") == {:unknown, %{text: "create storyline"}}
    end
  end

  describe "edit commands" do
    test "edit zone shows info when no field given" do
      assert CommandParser.parse("edit zone dark_forest") ==
               {:builder_edit_zone, %{key: "dark_forest", field: nil, value: nil}}
    end

    test "edit npc shows info when no field given" do
      assert CommandParser.parse("edit npc guard") ==
               {:builder_edit_entity, %{type: "npc", key: "guard", field: nil, value: nil}}
    end

    test "edit quest shows info when no field given" do
      assert CommandParser.parse("edit quest intro_quest") ==
               {:builder_edit_quest, %{key: "intro_quest", field: nil, value: nil}}
    end
  end

  describe "delete commands" do
    test "delete zone" do
      assert CommandParser.parse("delete zone dark_forest") ==
               {:builder_delete_zone, %{key: "dark_forest"}}
    end

    test "delete cutscene" do
      assert CommandParser.parse("delete cutscene intro_cs") ==
               {:builder_delete_cutscene, %{key: "intro_cs"}}
    end

    test "delete storyline" do
      assert CommandParser.parse("delete storyline main_story") ==
               {:builder_delete_storyline, %{key: "main_story"}}
    end

    test "delete script" do
      assert CommandParser.parse("delete script patrol_01") ==
               {:builder_delete_script, %{key: "patrol_01"}}
    end

    test "delete dialogue" do
      assert CommandParser.parse("delete dialogue talk_monk") ==
               {:builder_delete_dialogue, %{key: "talk_monk"}}
    end
  end

  describe "info/inspection commands" do
    test "zone info" do
      assert CommandParser.parse("zone info dark_forest") ==
               {:builder_zone_info, %{key: "dark_forest"}}
    end

    test "cutscene info" do
      assert CommandParser.parse("cutscene info intro_cs") ==
               {:builder_cutscene_info, %{key: "intro_cs"}}
    end

    test "storyline info" do
      assert CommandParser.parse("storyline info main_story") ==
               {:builder_storyline_info, %{key: "main_story"}}
    end

    test "quest info" do
      assert CommandParser.parse("quest info intro_quest") ==
               {:builder_quest_info, %{key: "intro_quest"}}
    end

    test "dialogue info" do
      assert CommandParser.parse("dialogue info talk_monk") ==
               {:builder_dialogue_info, %{key: "talk_monk"}}
    end
  end

  describe "script commands" do
    test "script create with key only defaults hook to on_enter" do
      assert CommandParser.parse("script create patrol_01") ==
               {:builder_script_create, %{key: "patrol_01", hook: "on_enter"}}
    end

    test "script info" do
      assert CommandParser.parse("script info patrol_01") ==
               {:builder_script_info, %{key: "patrol_01"}}
    end

    test "script list without filter" do
      assert CommandParser.parse("script list") ==
               {:builder_script_list, %{hook: nil}}
    end

    test "script list with hook filter" do
      assert CommandParser.parse("script list on_enter") ==
               {:builder_script_list, %{hook: "on_enter"}}
    end

    test "script validate" do
      assert CommandParser.parse("script validate patrol_01") ==
               {:builder_script_validate, %{key: "patrol_01"}}
    end

    test "script test" do
      assert CommandParser.parse("script test patrol_01") ==
               {:builder_script_test, %{key: "patrol_01"}}
    end

    test "script templates" do
      assert CommandParser.parse("script templates") ==
               {:builder_script_templates, %{}}
    end

    test "script template info" do
      assert CommandParser.parse("script template patrol") ==
               {:builder_script_template_info, %{template: "patrol"}}
    end

    test "script delete" do
      assert CommandParser.parse("script delete patrol_01") ==
               {:builder_delete_script, %{key: "patrol_01"}}
    end
  end

  describe "abbreviations" do
    test "dl routes to dialogue" do
      assert CommandParser.parse("dl info talk_monk") ==
               {:builder_dialogue_info, %{key: "talk_monk"}}
    end

    test "sc routes to script" do
      assert CommandParser.parse("sc info patrol_01") ==
               {:builder_script_info, %{key: "patrol_01"}}
    end

    test "cs routes to cutscene" do
      assert CommandParser.parse("cs info intro_cs") ==
               {:builder_cutscene_info, %{key: "intro_cs"}}
    end

    test "sl routes to storyline" do
      assert CommandParser.parse("sl info main_story") ==
               {:builder_storyline_info, %{key: "main_story"}}
    end
  end

  describe "project commands" do
    test "project new with key only defaults name" do
      assert CommandParser.parse("project new myproj") ==
               {:builder_project_new, %{key: "myproj", name: "myproj"}}
    end

    test "project load" do
      assert CommandParser.parse("project load myproj") ==
               {:builder_project_load, %{key: "myproj"}}
    end

    test "project list" do
      assert CommandParser.parse("project list") ==
               {:builder_project_list, %{}}
    end

    test "project delete" do
      assert CommandParser.parse("project delete myproj") ==
               {:builder_project_delete, %{key: "myproj"}}
    end
  end

  describe "doc commands" do
    test "doc write with filename only" do
      assert CommandParser.parse("doc write notes.md") ==
               {:builder_doc_write, %{filename: "notes.md", content: ""}}
    end

    test "doc read" do
      assert CommandParser.parse("doc read notes.md") ==
               {:builder_doc_read, %{filename: "notes.md"}}
    end

    test "doc list" do
      assert CommandParser.parse("doc list") ==
               {:builder_doc_list, %{}}
    end

    test "doc delete" do
      assert CommandParser.parse("doc delete notes.md") ==
               {:builder_doc_delete, %{filename: "notes.md"}}
    end
  end

  describe "guide command" do
    test "guide with topic" do
      assert CommandParser.parse("guide quest_patterns") ==
               {:builder_guide, %{topic: "quest_patterns"}}
    end
  end

  describe "AI commands" do
    test "/ai with prompt" do
      assert CommandParser.parse("/ai create a forest zone") ==
               {:builder_ai, %{prompt: "create a forest zone"}}
    end

    test "/ai without prompt clears" do
      assert CommandParser.parse("/ai") == {:builder_ai_clear, %{}}
    end

    test "chat enters chat mode" do
      assert CommandParser.parse("chat") == {:builder_chat_mode, %{}}
    end

    test "/exit leaves chat mode" do
      assert CommandParser.parse("/exit") == {:builder_exit_chat, %{}}
    end
  end

  describe "help with topic" do
    test "help with specific topic" do
      assert CommandParser.parse("help scripts") == {:help, %{topic: "scripts"}}
    end
  end

  describe "room CRUD commands" do
    test "dig with direction, key, and name" do
      assert CommandParser.parse("dig north tavern The Tavern") ==
               {:builder_dig, %{direction: "north", key: "tavern", name: "The Tavern"}}
    end

    test "@desc sets description" do
      assert CommandParser.parse("@desc A dusty room") ==
               {:builder_set_desc, %{text: "A dusty room"}}
    end

    test "@name sets name" do
      assert CommandParser.parse("@name The Tavern") ==
               {:builder_set_name, %{text: "The Tavern"}}
    end

    test "link creates exit" do
      assert CommandParser.parse("link north tavern") ==
               {:builder_link, %{direction: "north", key: "tavern"}}
    end

    test "unlink removes exit" do
      assert CommandParser.parse("unlink north") ==
               {:builder_unlink, %{direction: "north"}}
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
