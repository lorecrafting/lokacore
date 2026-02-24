defmodule Loka.WorldBuilder.YamlBuilderTest do
  use Loka.DataCase, async: false

  alias Loka.WorldBuilder.YamlBuilder

  describe "escape_yaml/1" do
    test "escapes backslashes" do
      assert YamlBuilder.escape_yaml("path\\to") == "path\\\\to"
    end

    test "escapes double quotes" do
      assert YamlBuilder.escape_yaml(~s(say "hello")) == ~s(say \\"hello\\")
    end

    test "escapes newlines" do
      assert YamlBuilder.escape_yaml("line1\nline2") == "line1\\nline2"
    end

    test "handles all special chars together" do
      assert YamlBuilder.escape_yaml("a\\b\"c\nd") == "a\\\\b\\\"c\\nd"
    end

    test "returns empty string for non-binary" do
      assert YamlBuilder.escape_yaml(nil) == ""
      assert YamlBuilder.escape_yaml(42) == ""
    end

    test "passes through plain text unchanged" do
      assert YamlBuilder.escape_yaml("hello world") == "hello world"
    end
  end

  describe "build_zone_yaml/3" do
    test "produces valid YAML with empty rooms" do
      yaml = YamlBuilder.build_zone_yaml("test_zone", "Test Zone")
      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["key"] == "test_zone"
      assert parsed["type"] == "zone"
      assert parsed["name"] == "Test Zone"
      assert parsed["data"]["rooms"] == []
      assert parsed["data"]["reset_mode"] == "empty"
      assert parsed["data"]["lifespan_minutes"] == 0
    end

    test "produces valid YAML with rooms list" do
      yaml = YamlBuilder.build_zone_yaml("forest", "Dark Forest", rooms: ["room_a", "room_b"])
      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["data"]["rooms"] == ["room_a", "room_b"]
    end

    test "respects options" do
      yaml =
        YamlBuilder.build_zone_yaml("z1", "Zone One",
          rooms: ["r1"],
          reset_mode: "full",
          lifespan_minutes: 30
        )

      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["data"]["reset_mode"] == "full"
      assert parsed["data"]["lifespan_minutes"] == 30
    end

    test "escapes special characters in name" do
      yaml = YamlBuilder.build_zone_yaml("z", ~s(Test "Zone"))
      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["name"] == ~s(Test "Zone")
    end

    test "includes resets when provided" do
      yaml = YamlBuilder.build_zone_yaml("z", "Z", resets: [])
      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["data"]["resets"] == []
    end
  end

  describe "build_cutscene_yaml/4" do
    test "produces valid YAML with a single scene" do
      scenes = [%{"text" => "Hello", "delay" => 1000, "class" => "cutscene"}]
      yaml = YamlBuilder.build_cutscene_yaml("cs_test", "Test Cutscene", "manual", scenes)
      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["key"] == "cs_test"
      assert parsed["type"] == "cutscene"
      assert parsed["name"] == "Test Cutscene"

      [line] = parsed["sequence"]
      assert line["text"] == "Hello"
      assert line["delay"] == 1000
      assert line["class"] == "cutscene"
    end

    test "produces valid YAML with multiple scenes" do
      scenes = [
        %{"text" => "Scene one", "delay" => 2000},
        %{"text" => "Scene two", "delay" => 3000, "class" => "cutscene dialogue"}
      ]

      yaml = YamlBuilder.build_cutscene_yaml("cs_multi", "Multi", "on_enter", scenes)
      parsed = YamlElixir.read_from_string!(yaml)

      assert length(parsed["sequence"]) == 2
      assert Enum.at(parsed["sequence"], 0)["text"] == "Scene one"
      assert Enum.at(parsed["sequence"], 1)["class"] == "cutscene dialogue"
    end

    test "escapes special characters in scene text" do
      scenes = [%{"text" => ~s(He said "stop!"), "delay" => 1000}]
      yaml = YamlBuilder.build_cutscene_yaml("cs_esc", "Esc", "manual", scenes)
      parsed = YamlElixir.read_from_string!(yaml)

      assert hd(parsed["sequence"])["text"] == ~s(He said "stop!")
    end
  end

  describe "build_storyline_yaml/4" do
    test "produces valid YAML with empty quest lists" do
      yaml = YamlBuilder.build_storyline_yaml("sl_test", "Test Story", [], [])
      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["key"] == "sl_test"
      assert parsed["type"] == "storyline"
      assert parsed["name"] == "Test Story"
      assert parsed["data"]["main_quests"] == []
      assert parsed["data"]["side_quests"] == []
    end

    test "produces valid YAML with populated quest lists" do
      yaml =
        YamlBuilder.build_storyline_yaml("sl", "Story", ["quest_main_1"], [
          "quest_side_1",
          "quest_side_2"
        ])

      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["data"]["main_quests"] == ["quest_main_1"]
      assert parsed["data"]["side_quests"] == ["quest_side_1", "quest_side_2"]
    end
  end

  describe "build_script_yaml/5" do
    test "produces valid YAML with single-line source" do
      yaml = YamlBuilder.build_script_yaml("sc_test", "Test Script", "on_enter", "continue()")
      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["key"] == "sc_test"
      assert parsed["type"] == "script"
      assert parsed["name"] == "Test Script"
      assert parsed["data"]["hook"] == "on_enter"
      assert String.contains?(parsed["data"]["source"], "continue()")
      assert parsed["data"]["timeout_ms"] == 5000
    end

    test "produces valid YAML with multi-line source" do
      source = "if true do\n  continue()\nelse\n  deny()\nend"
      yaml = YamlBuilder.build_script_yaml("sc_multi", "Multi", "on_enter", source)
      parsed = YamlElixir.read_from_string!(yaml)

      assert String.contains?(parsed["data"]["source"], "if true do")
      assert String.contains?(parsed["data"]["source"], "continue()")
      assert String.contains?(parsed["data"]["source"], "deny()")
    end

    test "respects timeout_ms option" do
      yaml =
        YamlBuilder.build_script_yaml("sc_t", "T", "on_enter", "continue()", timeout_ms: 10000)

      parsed = YamlElixir.read_from_string!(yaml)

      assert parsed["data"]["timeout_ms"] == 10000
    end
  end

  describe "format_yaml_string_list/1" do
    test "returns [] for empty list" do
      assert YamlBuilder.format_yaml_string_list([]) == "[]"
    end

    test "formats items with dash prefix" do
      result = YamlBuilder.format_yaml_string_list(["a", "b"])
      assert result =~ "- a"
      assert result =~ "- b"
    end
  end

  describe "indent_source/1" do
    test "indents each line with 4 spaces" do
      result = YamlBuilder.indent_source("line1\nline2")
      assert result == "    line1\n    line2"
    end

    test "returns default for non-binary" do
      assert YamlBuilder.indent_source(nil) == "    continue.()"
    end
  end

  describe "validate_references/2" do
    test "returns empty warnings for storyline with no quests" do
      assert {:ok, []} =
               YamlBuilder.validate_references(:storyline, %{main_quests: [], side_quests: []})
    end

    test "returns empty warnings for zone with no rooms" do
      assert {:ok, []} = YamlBuilder.validate_references(:zone, %{rooms: []})
    end

    test "returns empty warnings for cutscene with no dialogue scenes" do
      scenes = [%{"type" => "narration", "text" => "Hello"}]
      assert {:ok, []} = YamlBuilder.validate_references(:cutscene, %{scenes: scenes})
    end

    test "returns empty warnings for unknown type" do
      assert {:ok, []} = YamlBuilder.validate_references(:unknown, %{})
    end

    test "returns warnings for storyline with nonexistent quests" do
      {:ok, warnings} =
        YamlBuilder.validate_references(:storyline, %{
          main_quests: ["nonexistent_quest_xyz"],
          side_quests: []
        })

      assert length(warnings) == 1
      assert hd(warnings) =~ "nonexistent_quest_xyz"
    end

    test "returns warnings for zone with nonexistent rooms" do
      {:ok, warnings} =
        YamlBuilder.validate_references(:zone, %{rooms: ["nonexistent_room_xyz"]})

      assert length(warnings) == 1
      assert hd(warnings) =~ "nonexistent_room_xyz"
    end
  end
end
