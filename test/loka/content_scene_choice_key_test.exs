defmodule Loka.ContentSceneChoiceKeyTest do
  use ExUnit.Case, async: true

  alias Loka.Content.SceneLines
  alias Loka.Content.Source

  @moduletag :tmp_dir

  # Breaks: the ` #<key>` suffix keys nothing and the choice's key is the slug of the words WITH the
  # suffix (`carry_it_carry`), so a reworded choice still moves every referrer (rulings
  # docs/design/scene-structure-rulings.md §2, "An explicit key").
  test "a ` #<key>` suffix keys the choice; its words are the line without the suffix" do
    assert SceneLines.choice_key("Carry it #carry", 7) == "carry"
    # the control: without the suffix, the slug of the words, as every scene before S3 did
    assert SceneLines.choice_key("Carry it", 7) == "carry_it"
    # a `~` placeholder with no suffix still keys on its line
    assert SceneLines.choice_key("~", 7) == "todo__7"
    # the suffix is not part of what the player reads
    assert SceneLines.label("Carry it #carry") == "Carry it"
    assert SceneLines.label("Carry it") == "Carry it"
    assert SceneLines.label("~ #carry") == "~"
    # a `#` that is not a trailing suffix is words: only ` #<key>` at the very end keys
    assert SceneLines.choice_key("Take #2 pencils", 7) == "take_2_pencils"
    assert SceneLines.choice_key("Ask #why now", 7) == "ask_why_now"
  end

  # Breaks: the suffix reaches the compiled label, so the player reads "Carry it #carry", or the
  # explicit key does not reach the artifact and the choice is keyed by its words.
  test "a scene with an explicit key compiles to that key and a clean label", %{tmp_dir: tmp} do
    File.mkdir_p!(Path.join(tmp, "dialogues"))
    File.mkdir_p!(Path.join(tmp, "scenes"))

    File.write!(
      Path.join(tmp, "dialogues/carry.scene"),
      "npc: maud\n\nmaud: A bowl.\n- Carry it #carry\n  maud: Done.\n- Leave it\n"
    )

    {files, _diags} = Source.load(tmp)

    assert {"dialogues/carry.scene", {:dialogue, "carry", []}, dialogue} =
             List.keyfind(files, "dialogues/carry.scene", 0)

    assert %{"choices" => choices} = dialogue
    # the explicit key names the choice, and no `carry_it`/`carry_it_carry` key exists
    assert %{
             "label" => "dialogue.carry.choices.carry.label",
             "narration" => "dialogue.carry.choices.carry.narration"
           } = choices["carry"]

    refute Map.has_key?(choices, "carry_it")
    refute Map.has_key?(choices, "carry_it_carry")

    # the words themselves: the suffix is nowhere in the text, and the control keeps its own words
    {"text.json", :text, text} = List.keyfind(files, "text.json", 0)

    assert %{
             "dialogue.carry.choices.carry.label" => "Carry it",
             "dialogue.carry.choices.leave_it.label" => "Leave it"
           } = text

    refute Enum.any?(Map.values(text), &String.contains?(&1, "#carry"))
  end
end
