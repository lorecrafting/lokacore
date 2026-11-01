defmodule Loka.ContentSceneVerbsTest do
  # The verbs `.scene` and `.cut` lower to today's JSON (docs/system/cartridge.md, Source
  # shortcuts). Expected JSON is hand-written, and a bad form names its file and line.
  use ExUnit.Case, async: true

  alias Loka.Content
  alias Loka.Content.{Source, SourceLines}

  @moduletag :tmp_dir

  defp write(tmp, rel, text) do
    File.mkdir_p!(Path.dirname(Path.join(tmp, rel)))
    File.write!(Path.join(tmp, rel), text)
  end

  # Break: a verb lowers to another shape or a wrong value type, its steps reorder, a narration or
  # second speaker's line is dropped or not joined, or `with:` is not an npc role.
  test "with, narration, second speaker, sets and quest accept lower to JSON", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.scene", """
    npc: maud
    with: bram

    * Rain falls.
    maud: line one
    bram: line two
    - Go on
      sets: door_open
      sets: mood calm
      sets: count 3
      sets: lit false
      sets: bar true
      sets: code 007
      quest: accept bridge_job
      bram: line three
      * He nods.
    - Stay
    """)

    {files, []} = Source.load(tmp)

    assert {"scenes/a.scene", {:dialogue, "a", []},
            %{
              "npc" => "maud",
              "roles" => %{
                "maud" => %{"role" => "npc", "npc" => "maud"},
                "bram" => %{"role" => "npc", "npc" => "bram"}
              },
              "prompt" => "dialogue.a.prompt",
              "choices" => %{
                "go_on" => %{
                  "label" => "dialogue.a.choices.go_on.label",
                  "narration" => "dialogue.a.choices.go_on.narration",
                  "accept" => "bridge_job",
                  "steps" => [
                    %{"op" => "fact.assign", "fact" => "door_open", "value" => true},
                    %{"op" => "fact.assign", "fact" => "mood", "value" => "calm"},
                    %{"op" => "fact.assign", "fact" => "count", "value" => 3},
                    %{"op" => "fact.assign", "fact" => "lit", "value" => false},
                    %{"op" => "fact.assign", "fact" => "bar", "value" => true},
                    %{"op" => "fact.assign", "fact" => "code", "value" => "007"}
                  ]
                },
                "stay" => %{"label" => "dialogue.a.choices.stay.label"}
              }
            }} in files

    {"text.json", :text, text} = List.keyfind(files, "text.json", 0)
    assert text["dialogue.a.prompt"] == "Rain falls.\nline one\nline two"
    assert text["dialogue.a.choices.go_on.narration"] == "line three\nHe nods."
  end

  # Break: `quest: resolve` lowers onto the choice, or the dialogue loses its `quest`.
  test "quest: resolve on every choice is the dialogue's quest", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.scene", """
    npc: maud
    maud: hi
    - Yes
      quest: resolve job
    - No
      quest: resolve job
    """)

    {files, []} = Source.load(tmp)

    assert {"scenes/a.scene", {:dialogue, "a", []},
            %{
              "npc" => "maud",
              "roles" => %{"maud" => %{"role" => "npc", "npc" => "maud"}},
              "prompt" => "dialogue.a.prompt",
              "quest" => "job",
              "choices" => %{
                "yes" => %{"label" => "dialogue.a.choices.yes.label"},
                "no" => %{"label" => "dialogue.a.choices.no.label"}
              }
            }} in files
  end

  # Break: a bad form lowers silently, is reported as another fault or on another line, or its
  # row is missing from the plain catalog (the raw `why` reaches the writer).
  for {name, {body, want}} <- [
        needs_outside: {"npc: maud\nneeds: met\nmaud: hi\n- Go\n", [{2, "needs_outside_choice"}]},
        once_outside: {"npc: maud\nonce\nmaud: hi\n- Go\n", [{2, "once_outside_choice"}]},
        then_outside: {"npc: maud\nthen: x\nmaud: hi\n- Go\n", [{2, "then_outside_choice"}]},
        needs_rich: {"npc: maud\nmaud: hi\n- Go\n  needs: a or b\n", [{4, "bad_needs"}]},
        needs_placeholder: {"npc: maud\nmaud: hi\n- Go\n  needs: ~\n", [{4, "bad_needs"}]},
        needs_twice: {"npc: maud\nmaud: hi\n- Go\n  needs: a\n  needs: b\n", [{5, "bad_needs"}]},
        then_placeholder: {"npc: maud\nmaud: hi\n- Go\n  then: ~\n", [{4, "bad_then"}]},
        then_twice: {"npc: maud\nmaud: hi\n- Go\n  then: a\n  then: b\n", [{5, "bad_then"}]},
        once_words: {"npc: maud\nmaud: hi\n- Go\n  once: yes\n", [{4, "bad_once"}]},
        then_and_nested:
          {"npc: maud\nmaud: hi\n- Go\n  maud: x\n  then: a\n  - In\n    maud: y\n",
           [{5, "then_and_nested"}]},
        then_after_nested:
          {"npc: maud\nmaud: hi\n- Go\n  maud: x\n  - In\n    maud: y\n  then: a\n",
           [{7, "then_and_nested"}]},
        nested_no_reply:
          {"npc: maud\nmaud: hi\n- Go\n  - In\n    maud: y\n", [{4, "nested_no_reply"}]},
        indent_between:
          {"npc: maud\nmaud: hi\n- Go\n  maud: x\n    - In\n      maud: y\n  - Off\n    maud: z\n",
           [{7, "bad_indent"}]},
        indent_body:
          {"npc: maud\nmaud: hi\n- Go\n  maud: x\n  - In\n  sets: a\n", [{6, "bad_indent"}]},
        indent_tab: {"npc: maud\nmaud: hi\n- Go\n\tmaud: x\n", [{4, "bad_indent"}]},
        nested_key_taken:
          {"npc: maud\nmaud: hi\n- Go In\n  maud: x\n  - A\n- Go\n  maud: x\n  - In\n    maud: y\n    - B\n",
           [{10, "nested_key_taken"}]},
        resolve_nested:
          {"npc: maud\nmaud: hi\n- A\n  quest: resolve j\n  maud: x\n  - In\n- B\n",
           [{4, "resolve_nested"}]},
        sets_many: {"npc: maud\nmaud: hi\n- Go\n  sets: a b c\n", [{4, "bad_sets"}]},
        sets_outside: {"npc: maud\nsets: a\nmaud: hi\n- Go\n", [{2, "outside_choice"}]},
        quest_outside: {"npc: maud\nquest: accept a\nmaud: hi\n", [{2, "outside_choice"}]},
        quest_form: {"npc: maud\nmaud: hi\n- Go\n  quest: start a\n", [{4, "bad_quest"}]},
        quest_twice:
          {"npc: maud\nmaud: hi\n- Go\n  quest: accept a\n  quest: accept b\n",
           [{5, "bad_quest"}]},
        resolve_some:
          {"npc: maud\nmaud: hi\n- A\n  quest: resolve j\n- B\n", [{4, "resolve_not_all"}]},
        resolve_mixed:
          {"npc: maud\nmaud: hi\n- A\n  quest: resolve j\n- B\n  quest: resolve k\n",
           [{4, "resolve_not_all"}, {6, "resolve_not_all"}]},
        with_two: {"npc: maud\nwith: a b\nmaud: hi\n", [{2, "bad_with"}]},
        with_late: {"npc: maud\nmaud: hi\n- Go\n  with: bram\n", [{4, "misplaced_header"}]},
        gives_second_speaker:
          {"npc: maud\nwith: bram\nmaud: hi\n- Go\n  gives: bram\n", [{5, "gives_speaker"}]},
        with_placeholder: {"npc: maud\nwith: ~\nmaud: hi\n", [{2, "bad_with"}]},
        unknown_speaker: {"npc: maud\nbram: hi\n", [{2, "wrong_speaker"}]},
        refused_gives:
          {"npc: maud\nmaud: hi\n- Go\n- Go\n  gives: maud\n",
           [{4, "repeated_choice"}, {5, "gives_speaker"}]},
        refused_sets:
          {"npc: maud\nmaud: hi\n- Go\n- Go\n  sets: a b c\n",
           [{4, "repeated_choice"}, {5, "bad_sets"}]},
        refused_quest:
          {"npc: maud\nmaud: hi\n- Go\n- Go\n  quest: start a\n",
           [{4, "repeated_choice"}, {5, "bad_quest"}]},
        latin1_npc: {"npc: caf\xE9\nmaud: hi\n- Go\n", [{1, "not_utf8"}]}
      ] do
    test "a bad scene form: #{name}", %{tmp_dir: tmp} do
      write(tmp, "scenes/a.scene", unquote(body))
      {_, diags} = Source.load(tmp)
      got = Enum.map(diags, &{&1["data"]["line"], &1["data"]["why"]})
      assert got == unquote(want)

      lines = Content.explained(diags, tmp)

      for {n, why} <- got do
        said = Enum.find(lines, &String.contains?(&1, "scenes/a.scene:#{n}"))
        assert said, "nothing at line #{n}: #{inspect(lines)}"
        refute said =~ why
      end
    end
  end

  # Break: a refused choice's verbs leak onto another choice, or a resolve under it counts.
  test "a valid verb under a refused choice is written nowhere", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.scene", """
    npc: maud
    maud: hi
    - Go
    - Go
      sets: a
      quest: accept b
      quest: resolve c
    """)

    {files, diags} = Source.load(tmp)
    assert [%{"data" => %{"line" => 4, "why" => "repeated_choice"}}] = diags
    {_, _, value} = List.keyfind(files, "scenes/a.scene", 0)
    assert Map.keys(value["choices"]["go"]) == ["label", "narration"]
    assert Map.keys(value) == ["choices", "npc", "prompt", "roles"]
    {"text.json", :text, text} = List.keyfind(files, "text.json", 0)
    assert text["dialogue.a.prompt"] == "hi"
  end

  @bell_steps [
    %{"type" => "narrate", "text" => %{"prose" => "The bell rings."}},
    %{"type" => "narrate", "text" => %{"prose" => "The fen answers.\nThe fox stills."}},
    %{"type" => "await_ack"},
    %{"type" => "end"}
  ]
  @bell_on %{"on" => %{"story_point" => "lantern_resolved", "outcome" => "carry"}}

  # Breaks (gate): a cutscene's lowering differs in any byte from the scene JSON it stands for, or
  # its same-key JSON file (`on`, `control`) is not merged over it.
  test "a sampler scene as a cutscene compiles byte-identical to its JSON form" do
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    head = Map.put(@bell_on, "control", "modal")
    unkeyed = fn text -> Map.reject(text, fn {k, _} -> k =~ "scene.bell_rung." end) end

    assert {:ok, bytes, []} =
             Loka.ContentSource.compile(dir, [
               {"text.json", unkeyed},
               {"scenes/bell_rung.json", Map.put(head, "steps", @bell_steps)}
             ])

    assert bytes =~ "The fen answers."

    File.write!(
      Path.join(dir, "scenes/bell_rung.cut"),
      "The bell rings.\n\nThe fen answers.\nThe fox stills.\n\n---\n"
    )

    assert Loka.ContentSource.compile(dir, [
             {"text.json", unkeyed},
             {"scenes/bell_rung.json", head}
           ]) == {:ok, bytes, []}
  end

  # Break: `steps` beside a `.cut` replaces its words with no error (written text lost).
  test "steps in the JSON beside a cutscene are refused", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.cut", "one\n---\n")
    write(tmp, "scenes/a.json", ~s({"on": {"quest": "q"}, "steps": [{"type": "end"}]}))
    {_, diags} = Source.load(tmp)
    assert [%{"severity" => "error", "data" => %{"why" => "cut_steps"}} = diag] = diags
    assert diag["path"] == "scenes/a.steps"
    [said] = Content.explained(diags, tmp)
    assert said =~ "scenes/a.json"
    assert said =~ "scenes/a.cut"
  end

  # Break: a mistyped key or a `~` in its place is blamed on the file's name, or passes the parser.
  for {line, want} <- [
        {"sets: tally ~", "bad_sets"},
        {"sets: tally +1", "bad_sets"},
        {"sets: Tally 1", "bad_sets"},
        {"quest: accept ~", "bad_quest"},
        {"quest: resolve ~", "bad_quest"},
        {"quest: accept Job", "bad_quest"}
      ] do
    test "a scene key line refuses #{line}", %{tmp_dir: tmp} do
      write(tmp, "scenes/a.scene", "npc: maud\nmaud: hi\n- Go\n  #{unquote(line)}\n")
      {_, diags} = Source.load(tmp)
      assert [%{"data" => %{"line" => 4, "why" => unquote(want)}}] = diags
      [said] = Content.explained(diags, tmp)
      refute said =~ "file's name"
    end
  end

  # Break: a pattern fault deep in a file is blamed on the file's name, or a bad file name loses
  # that message (or gains a `.cut` trigger error telling the writer to add a bad-named JSON).
  test "only a file's own name gets the file-name message", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.scene", "npc: maud\nwhen: Not A Key\nmaud: hi\n- Go\n")
    write(tmp, "scenes/Bad-Name.cut", "one\n---\n")
    {:error, diags} = Content.compile(tmp)
    said = Content.explained(diags, tmp)
    assert [named] = Enum.filter(said, &(&1 =~ "file's name"))
    assert named =~ "Bad-Name.cut"
    refute Enum.any?(said, &(&1 =~ "Bad-Name.json"))
    assert Enum.any?(said, &(&1 =~ "scenes/a.scene:2"))
  end

  # Break: a scene-format line in a cutscene ships as prose unnoticed, is an error, or plain prose
  # with a colon warns.
  test "a scene line in a cutscene warns and stays words", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.cut", "- Go\n\nnpc: maud\n\nThe sign says: wait\n---\n")
    write(tmp, "scenes/a.json", ~s({"control": "modal", "on": {"quest": "q"}}))
    {files, diags} = Source.load(tmp)

    assert [{1, "warning"}, {3, "warning"}] ==
             Enum.map(diags, &{&1["data"]["line"], &1["severity"]})

    assert Enum.all?(diags, &(&1["data"]["why"] == "cut_scene_line"))
    {_, _, value} = List.keyfind(files, "scenes/a.cut", 0)
    assert length(value["steps"]) == 5
    assert hd(Content.explained(diags, tmp)) =~ "scenes/a.cut:1"
  end

  # Breaks (gate): the new verbs' lowering differs in any byte from the dialogue JSON they stand for.
  test "the scene verbs compile byte-identical to their JSON form" do
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    npc = dir |> Path.join("npcs/bram.json") |> File.read!() |> JSON.decode!()

    words = %{
      "dialogue.verbs.prompt" => "Rain falls.\nline one\nline two",
      "dialogue.verbs.choices.go_on.label" => "Go on",
      "dialogue.verbs.choices.go_on.narration" => "line three\nHe nods.",
      "dialogue.verbs.choices.stay.label" => "Stay",
      "dialogue.verbs.choices.stay.narration" => "line four"
    }

    json = %{
      "npc" => "bram",
      "roles" => %{
        "bram" => %{"role" => "npc", "npc" => "bram"},
        "maud" => %{"role" => "npc", "npc" => "maud"}
      },
      "prompt" => "dialogue.verbs.prompt",
      "choices" => %{
        "go_on" => %{
          "label" => "dialogue.verbs.choices.go_on.label",
          "narration" => "dialogue.verbs.choices.go_on.narration",
          "accept" => "lantern",
          "steps" => [
            %{"op" => "fact.assign", "fact" => "bell_heard", "value" => true},
            %{"op" => "fact.assign", "fact" => "search_plan", "value" => "player_led"}
          ]
        },
        "stay" => %{
          "label" => "dialogue.verbs.choices.stay.label",
          "narration" => "dialogue.verbs.choices.stay.narration"
        }
      }
    }

    maud = {"npcs/maud.json", npc}
    json_form = [maud, {"text.json", &Map.merge(&1, words)}, {"dialogues/verbs.json", json}]
    assert {:ok, bytes, warnings} = Loka.ContentSource.compile(dir, json_form)
    assert bytes =~ "He nods."

    write(dir, "scenes/verbs.scene", """
    npc: bram
    with: maud

    * Rain falls.
    bram: line one
    maud: line two
    - Go on
      sets: bell_heard
      sets: search_plan player_led
      quest: accept lantern
      maud: line three
      * He nods.
    - Stay
      bram: line four
    """)

    assert Loka.ContentSource.compile(dir, [maud]) == {:ok, bytes, warnings}
  end

  # Break: a guide example stops compiling when copied literally. The test adds only what the guide
  # says must exist elsewhere: the facts, NPC, item, quest and the NPC's hold on the item.
  test "the guide's scene examples compile as written" do
    guide = File.read!("docs/guides/writing-the-game.md")
    [_, section] = String.split(guide, "## Write a scene\n")
    [section, _] = String.split(section, "## Jump to a beat")
    fences = for [_, body] <- Regex.scan(~r/^```\w*\n(.*?)^```$/ms, section), do: body

    rels = ~w(first.scene second.scene branching.scene third.cut third.json point.scene)
    files = Enum.map(rels, &"scenes/#{&1}") ++ ["dialogues/point.json"]
    assert length(fences) == length(files)
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    File.mkdir_p!(Path.join(dir, "scenes"))
    for {rel, body} <- Enum.zip(files, fences), do: File.write!(Path.join(dir, rel), body)

    fact = fn type ->
      %{"version" => 1, "value_type" => type, "scopes" => ["player"], "meaning" => "x"}
    end

    bool = fact.(%{"type" => "bool", "default" => false})
    mood = fact.(%{"type" => "enum", "values" => ["calm", "wary"], "default" => "wary"})
    facts = %{"met_maud" => bool, "door_open" => bool, "mood" => mood}
    json = &(Path.join([dir, &1]) |> File.read!() |> JSON.decode!())

    File.write!(
      Path.join(dir, "scenes/branch_next.scene"),
      "npc: maud\nmaud: ~\n- Stay\n  maud: ~\n"
    )

    assert {:ok, _, []} =
             Loka.ContentSource.compile(dir, [
               {"facts.json", &update_in(&1, ["facts"], fn f -> Map.merge(f, facts) end)},
               {"npcs/maud.json", json.("npcs/bram.json")},
               {"quests/bridge_job.json", json.("quests/lantern.json")},
               {"items/bowl.json",
                Map.put(json.("items/lantern.json"), "location", %{"in" => "npc", "npc" => "maud"})}
             ])
  end

  # Break: a paragraph splits or merges wrongly, `---` lowers to anything but one await_ack before
  # end, or the prose is not keyed by its step.
  test "a cutscene lowers to one narrate per paragraph, await_ack, end", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.cut", "one\ntwo\n\n\nthree\n---\n")
    write(tmp, "scenes/a.json", ~s({"control": "modal", "on": {"quest": "q"}}))
    {files, []} = Source.load(tmp)

    assert {"scenes/a.cut", {:scene, "a", []},
            %{
              "control" => "modal",
              "on" => %{"quest" => "q"},
              "steps" => [
                %{"type" => "narrate", "text" => "scene.a.steps.0.text"},
                %{"type" => "narrate", "text" => "scene.a.steps.1.text"},
                %{"type" => "await_ack"},
                %{"type" => "end"}
              ]
            }} in files

    {"text.json", :text, text} = List.keyfind(files, "text.json", 0)
    assert text["scene.a.steps.0.text"] == "one\ntwo"
    assert text["scene.a.steps.1.text"] == "three"
  end

  # Break: a malformed file passes, or the fault lands on another line, or a follow-on from the
  # order check or the missing trigger joins it in words the writer cannot act on.
  for {name, {body, want}} <- [
        no_close: {"one\n\ntwo\n", [{3, "cut_end"}]},
        early: {"one\n---\ntwo\n---\n", [{2, "cut_end"}]},
        twice: {"one\n---\n---\n", [{2, "cut_end"}]},
        only_close: {"\n---\n", [{2, "cut_end"}]},
        empty: {"", [{1, "cut_end"}]},
        latin1: {"caf\xE9\n---\n", [{1, "not_utf8"}]}
      ] do
    test "a bad cutscene: #{name}", %{tmp_dir: tmp} do
      write(tmp, "scenes/a.cut", unquote(body))
      write(tmp, "scenes/a.json", ~s({"control": "modal", "on": {"quest": "q"}}))
      {_, diags} = Source.load(tmp)
      got = Enum.map(diags, &{&1["data"]["line"], &1["data"]["why"]})
      assert got == unquote(want)
      [{n, why} | _] = got
      said = diags |> Content.explained(tmp) |> Enum.find(&(&1 =~ "scenes/a.cut:#{n}"))
      assert said && not (said =~ why)
    end
  end

  # Break: a fault in a paragraph or the JSON half of a cutscene points at the wrong file or line.
  test "a cutscene's parts keep their own file and line", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.cut", "one\n\ntwo\n---\n")
    write(tmp, "scenes/a.json", ~s({"control": "modal"}))
    index = SourceLines.index(tmp)
    assert index[Source.at("scenes/a.cut", ["steps", 1, "text"])] == {"scenes/a.cut", 3}
    assert index[Source.at("scenes/a.cut", ["control"])] == {"scenes/a.json", 1}
  end

  # Break: the trigger check, meant for `.cut` files, also refuses a JSON scene.
  test "a JSON scene with no trigger is not told to add one", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.json", ~s({"control": "modal", "steps": [{"type": "end"}]}))
    {_, diags} = Source.load(tmp)
    assert for(%{"data" => %{"why" => "cut_no_trigger"}} = d <- diags, do: d) == []
  end

  # Break: a cutscene with no trigger compiles, never plays and nobody hears why.
  test "a cutscene with nothing to start it says what to add", %{tmp_dir: tmp} do
    write(tmp, "scenes/a.cut", "one\n---\n")
    {_, diags} = Source.load(tmp)
    assert [%{"code" => "SCHEMA_VIOLATION", "data" => %{"why" => "cut_no_trigger"}}] = diags
    [said] = Content.explained(diags, tmp)
    assert said =~ "scenes/a.cut:1"
    assert said =~ "scenes/a.json"
  end
end
