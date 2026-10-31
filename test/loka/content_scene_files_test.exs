defmodule Loka.ContentSceneFilesTest do
  use ExUnit.Case, async: true

  alias Loka.Content.Source

  @dir "cartridges/speech_sampler"
  @prompt ~s(The elder leans close. "The ward fails at the new moon.")
  @json %{
    "npc" => "elder",
    "keyword" => "ward",
    "prompt" => %{"prose" => @prompt},
    "roles" => %{"elder" => %{"role" => "npc", "npc" => "elder"}},
    "choices" => %{
      "thank_her" => %{
        "label" => %{"prose" => "Thank her"},
        "narration" => %{"prose" => "The elder nods."}
      }
    }
  }
  @scene """
  npc: elder

  elder: #{@prompt}
  - Thank her
    elder: The elder nods.
  """

  # Breaks (docs/system/cartridge.md, Source shortcuts, gate): the scene's lowering differs in any
  # byte from the dialogue JSON it stands for, or its same-key JSON file (the keyword) is not
  # merged over it.
  test "a sampler dialogue as a scene compiles byte-identical to its JSON form" do
    dir = Loka.ContentSource.copy(@dir)

    moved =
      {"areas/village.json",
       &update_in(&1, ["dialogues"], fn d -> Map.delete(d, "elder_ward") end)}

    json_form = [moved, {"text.json", %{}}, {"dialogues/elder_ward.json", @json}]
    assert {:ok, bytes, []} = Loka.ContentSource.compile(dir, json_form)
    assert bytes =~ "Thank her"

    File.mkdir_p!(Path.join(dir, "scenes"))
    File.write!(Path.join(dir, "scenes/elder_ward.scene"), @scene)

    scene_form =
      List.replace_at(json_form, 2, {"dialogues/elder_ward.json", %{"keyword" => "ward"}})

    assert Loka.ContentSource.compile(dir, scene_form) == {:ok, bytes, []}
  end

  @moduletag :tmp_dir

  # Breaks: `when:` lowers to another policy, `gives:` to another effect or giver, a second
  # speech line is dropped, a choice key differs from its label's words, or a bad line (an
  # effect before any choice, another speaker, a repeated choice) is not named by file and line.
  test "when: and gives: lower; bad lines are named by number", %{tmp_dir: tmp} do
    File.mkdir_p!(Path.join(tmp, "dialogues"))
    File.mkdir_p!(Path.join(tmp, "scenes"))

    File.write!(
      Path.join(tmp, "dialogues/maud.scene"),
      "npc: maud\nwhen: met_maud\n\nmaud: line one\nmaud: line two: aside\n- Take it.\n  maud: line three\n  gives: bowl\n"
    )

    File.write!(
      Path.join(tmp, "scenes/bad.scene"),
      "npc: maud\ngives: bowl\nmaud: line one\nbram: line two\n- Go\n- Go\n"
    )

    {files, diags} = Source.load(tmp)

    maud = %{
      "npc" => "maud",
      "roles" => %{"maud" => %{"role" => "npc", "npc" => "maud"}},
      "policy" => %{"op" => "fact_compare", "fact" => "met_maud", "equals" => true},
      "prompt" => "dialogue.maud.prompt",
      "choices" => %{
        "take_it" => %{
          "label" => "dialogue.maud.choices.take_it.label",
          "narration" => "dialogue.maud.choices.take_it.narration",
          "receive" => %{"item" => "bowl", "from" => "maud"}
        }
      }
    }

    assert {"dialogues/maud.scene", {:dialogue, "maud", []}, maud} in files

    assert {"text.json", :text,
            %{
              "dialogue.maud.prompt" => "line one\nline two: aside",
              "dialogue.maud.choices.take_it.label" => "Take it.",
              "dialogue.maud.choices.take_it.narration" => "line three"
            }} in files

    assert {"scenes/bad.scene", {:dialogue, "bad", []}, :invalid} in files

    assert Enum.map(diags, &{&1["code"], &1["path"], &1["data"]}) == [
             {"SCHEMA_VIOLATION", ~s("scenes/bad.scene"),
              %{"line" => 2, "text" => "gives: bowl"}},
             {"SCHEMA_VIOLATION", ~s("scenes/bad.scene"),
              %{"line" => 4, "text" => "bram: line two"}},
             {"SCHEMA_VIOLATION", ~s("scenes/bad.scene"), %{"line" => 6, "text" => "- Go"}}
           ]
  end
end
