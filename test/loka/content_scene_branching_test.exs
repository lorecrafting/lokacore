# size: allow 653, every scene form shares the sampler fixture and its twin
defmodule Loka.ContentSceneBranchingTest do
  # needs, once, then and nested choices in a `.scene` (docs/system/cartridge.md, Source
  # shortcuts). Expected JSON is hand-written; `~` stands for the words.
  use ExUnit.Case, async: true

  alias Loka.Content
  alias Loka.Content.{SceneFiles, Source}

  @moduletag :tmp_dir

  @scene """
  npc: bram
  when: met_bram

  bram: ~
  - Ask
    needs: saw_lantern
    once
    bram: ~
    - Leave
      bram: ~
    - Who
      bram: ~
      sets: knows_potter
  - Take
    gives: lantern
    once
    then: bram_farewell
    bram: ~
  """

  @facts %{
    "met_bram" => "first met",
    "saw_lantern" => "saw it",
    "knows_potter" => "knows"
  }

  defp write(tmp, rel, text) do
    File.mkdir_p!(Path.dirname(Path.join(tmp, rel)))
    File.write!(Path.join(tmp, rel), text)
  end

  defp prose(words), do: %{"prose" => words}
  defp fact_true(f), do: %{"op" => "fact_compare", "fact" => f, "equals" => true}
  defp npc_role, do: %{"role" => "npc", "npc" => "bram"}

  defp bool(f) do
    %{
      "version" => 1,
      "value_type" => %{"type" => "bool", "default" => false},
      "scopes" => ["player"],
      "meaning" => @facts[f]
    }
  end

  defp with_facts(extra \\ []) do
    {"facts.json",
     fn file ->
       facts = Map.new(Map.keys(@facts) ++ extra, &{&1, bool(&1)})
       update_in(file, ["facts"], &Map.merge(&1, facts))
     end}
  end

  @farewell %{
    "npc" => "bram",
    "prompt" => %{"prose" => "~"},
    "roles" => %{"bram" => %{"role" => "npc", "npc" => "bram"}},
    "choices" => %{"bye" => %{"label" => %{"prose" => "Bye"}, "narration" => %{"prose" => "~"}}}
  }

  defp twin do
    %{
      "npc" => "bram",
      "policy" => fact_true("met_bram"),
      "prompt" => prose("~"),
      "roles" => %{"bram" => npc_role(), "lantern" => %{"role" => "item", "item" => "lantern"}},
      "choices" => %{
        "ask" => %{
          "label" => prose("Ask"),
          "policy" => fact_true("saw_lantern"),
          "once" => true,
          "narration" => prose("~"),
          "then" => "scene_ask"
        },
        "take" => %{
          "label" => prose("Take"),
          "narration" => prose("~"),
          "receive" => %{"item" => "lantern", "from" => "bram"},
          "once" => true,
          "then" => "bram_farewell"
        }
      }
    }
  end

  defp child do
    %{
      "npc" => "bram",
      "entry" => false,
      "prompt" => "dialogue.scene.choices.ask.narration",
      "roles" => %{"bram" => npc_role()},
      "choices" => %{
        "who" => %{
          "label" => prose("Who"),
          "narration" => prose("~"),
          "steps" => [%{"op" => "fact.assign", "fact" => "knows_potter", "value" => true}],
          "then" => "scene"
        },
        "leave" => %{"label" => prose("Leave"), "narration" => prose("~"), "then" => "scene"}
      }
    }
  end

  # Break: nesting lowers to another shape: the child's key, prompt, roles or either `then`.
  test "a nested set lowers to a child dialogue linked both ways" do
    assert SceneFiles.parse(@scene, "scene") == {[{"scene", twin()}, {"scene_ask", child()}], []}
  end

  # Break: the scene and the JSON it stands for differ in any byte, or `once` is lowered only
  # for one of them, or the fact or the step or the policy is another shape.
  test "the scene and its hand-written JSON compile to the same bytes" do
    edits = [with_facts(), {"dialogues/bram_farewell.json", @farewell}]
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    write(dir, "scenes/scene.scene", @scene)
    assert {:ok, from_scene, _} = Loka.ContentSource.compile(dir, edits)

    dir = Loka.ContentSource.copy("cartridges/scene_sampler")

    json =
      edits ++
        [
          {"dialogues/scene.json", twin()},
          {"dialogues/scene_ask.json", child()}
        ]

    assert {:ok, from_json, _} = Loka.ContentSource.compile(dir, json)
    assert from_scene == from_json

    scene =
      JSON.decode!(from_scene)["cartridge"]["dialogues"]["scene_sampler@0.0.1:dialogue/scene"]

    ask = scene["choices"]["ask"]
    refute Map.has_key?(ask, "once")
    gate = %{"op" => "not", "item" => compare("scene_ask_done")}
    assert ask["policy"] == %{"op" => "all", "items" => [compare("saw_lantern"), gate]}

    assert ask["steps"] == [
             %{"op" => "fact.assign", "fact" => ref("scene_ask_done"), "value" => true}
           ]

    take = scene["choices"]["take"]
    assert take["policy"] == %{"op" => "not", "item" => compare("scene_take_done")}

    # Break: the fact starts true, so a `once` choice is gone before it is ever taken.
    facts = JSON.decode!(from_scene)["cartridge"]["facts"]
    done = Enum.find(facts, fn {k, _} -> String.ends_with?(k, "fact/scene_ask_done") end)
    assert {_, %{"value_type" => %{"default" => false}}} = done
  end

  # Break: a real scene file and a nested set of the same key are silently merged.
  test "a scene file with the key of another's nested set is refused", %{tmp_dir: tmp} do
    write(tmp, "scenes/s.scene", "npc: bram\nbram: ~\n- Go\n  bram: ~\n  - In\n    bram: ~\n")
    write(tmp, "scenes/s_go.scene", "npc: bram\nbram: ~\n- Out\n")
    {_, diags} = Source.load(tmp)
    assert [%{"data" => %{"why" => "scene_key_taken", "key" => "s_go"}}] = diags
  end

  # Break: a nested resolve also blames a `then` the writer never wrote.
  test "a nested resolve is refused at its own line, not at an implied then" do
    text = "npc: bram\nbram: ~\n- Go\n  quest: resolve q\n  bram: ~\n  - In\n    bram: ~\n"
    assert {:error, diags} = sampler(text)
    assert "resolve_nested" in Enum.map(diags, & &1["data"]["why"])
    assert [] == for(%{"code" => "OUTCOME_MISMATCH"} = d <- diags, do: d)
  end

  # Break: a `then` the scene never wrote is refused as "also written in the scene".
  test "a sidecar then on a choice with no written then is not an overlap" do
    json = {"dialogues/scene.json", %{"choices" => %{"look" => %{"then" => "end"}}}}
    text = "npc: bram\nbram: ~\n- Go\n  bram: ~\n  - In\n    bram: ~\n- Look\n  bram: ~\n"
    assert {:ok, out, _} = sampler(text, [json])
    scene = JSON.decode!(out)["cartridge"]["dialogues"]["scene_sampler@0.0.1:dialogue/scene"]
    assert scene["choices"]["look"]["then"] == "end"
  end

  # Break: a refused line's bytes reach the diagnostic data and crash a JSON encoder.
  test "a badly indented latin-1 line leaves valid text in the diagnostic", %{tmp_dir: tmp} do
    write(tmp, "scenes/s.scene", "npc: bram\nbram: ~\n  - A\n- Caf\xE9\n")
    {_, diags} = Source.load(tmp)
    assert diags != []
    assert JSON.encode!(diags) =~ "bad_indent"
  end

  # Break: a `needs:` opposite the one above is refused, or lowers empty, though another file may
  # flip the fact and the two-file twin plays; or the warning stops saying so, or `when:` is missed.
  test "a needs opposite one above warns, names what it cannot see and lowers" do
    text =
      "npc: bram\nbram: ~\n- Go\n  needs: saw_lantern\n  bram: ~\n  - In\n    needs: not saw_lantern\n    bram: ~\n"

    assert {:ok, out, [warned]} = sampler(text)
    assert warned["data"]["why"] == "unreachable" and warned["data"]["line"] == 7
    assert warned["severity"] == "warning"
    dialogues = JSON.decode!(out)["cartridge"]["dialogues"]
    child = dialogues["scene_sampler@0.0.1:dialogue/scene_go"]

    assert child["choices"]["in"]["policy"]["op"] == "not"

    assert child["choices"]["in"]["narration"] != nil

    assert hd(Content.explained([warned], "/x")) =~ "cannot see another file or a reaction"

    top = "npc: bram\nwhen: saw_lantern\nbram: ~\n- Go\n  needs: not saw_lantern\n  bram: ~\n"
    assert {:ok, _, [%{"severity" => "warning", "data" => %{"line" => 5}}]} = sampler(top)
  end

  # Break: a sidecar silently replaces a written `then` (self, parent or another), or the link down
  # to a nested set, while lowering's own way back stays replaceable (the test above).
  test "a sidecar then over a written one or a nested link is refused", %{tmp_dir: tmp} do
    refused = fn text, rel, choice ->
      write(tmp, "scenes/s.scene", text)
      write(tmp, rel, JSON.encode!(%{"choices" => %{choice => %{"then" => "end"}}}))
      {_, diags} = Source.load(tmp)
      File.rm!(Path.join(tmp, rel))
      for d <- diags, do: {d["path"], d["data"]["why"]}
    end

    head = "npc: bram\nbram: ~\n"
    other = refused.(head <> "- Go\n  bram: ~\n  then: s_ta\n", "dialogues/s.json", "go")
    assert other == [{"dialogues/s.choices.go.then", "scene_overlap"}]
    own = refused.(head <> "- Go\n  bram: ~\n  then: s\n", "dialogues/s.json", "go")
    assert own == [{"dialogues/s.choices.go.then", "scene_overlap"}]
    link = refused.(head <> "- Go\n  bram: ~\n  - In\n    bram: ~\n", "dialogues/s.json", "go")
    assert link == [{"dialogues/s.choices.go.then", "scene_overlap"}]

    parent =
      refused.(
        head <> "- Go\n  bram: ~\n  - In\n    bram: ~\n    then: s\n",
        "dialogues/s_go.json",
        "in"
      )

    assert parent == [{"dialogues/s_go.choices.in.then", "scene_overlap"}]
  end

  # Break: choices the writer ordered show sorted (the runtime sorts by key); or the numbering
  # reaches a nested dialogue's name, a `once` fact or a same-key JSON; or the source-only list
  # reaches the artifact; or a choice a JSON added jumps ahead.
  test "choices show as written, known by their words everywhere else" do
    text =
      "npc: bram\nbram: ~\n- Plain\n  bram: ~\n  once\n  sets: knows_potter\n- Ask\n  bram: ~\n  - Who\n    bram: ~\n"

    add = %{"label" => prose("~"), "narration" => prose("~")}
    json = {"dialogues/scene.json", %{"choices" => %{"zed" => add, "add" => add}}}

    assert {:ok, out, []} = sampler(text, [json, with_facts()])
    c = JSON.decode!(out)["cartridge"]
    scene = c["dialogues"]["scene_sampler@0.0.1:dialogue/scene"]

    assert Map.new(scene["choices"], fn {c, o} -> {c, o["order"]} end) ==
             %{"plain" => 1, "ask" => 2, "add" => nil, "zed" => nil}

    assert scene["choices"]["ask"]["then"] == "scene_ask"
    assert is_map_key(c["dialogues"], "scene_sampler@0.0.1:dialogue/scene_ask")
    assert is_map_key(c["facts"], "scene_sampler@0.0.1:fact/scene_plain_done")

    sorted = "npc: bram\nbram: ~\n- Ask\n  bram: ~\n- Plain\n  bram: ~\n"
    assert {:ok, out, []} = sampler(sorted)
    d = JSON.decode!(out)["cartridge"]["dialogues"]["scene_sampler@0.0.1:dialogue/scene"]
    assert Enum.sort(Map.keys(d["choices"])) == ~w(ask plain)
  end

  # Break: adding a choice renames or renumbers its neighbours' ids, so what names them stops matching.
  test "inserting a choice keeps every other id and shifts only positions" do
    keys = fn body ->
      assert {:ok, out, []} = sampler("npc: bram\nbram: ~\n" <> body)
      d = JSON.decode!(out)["cartridge"]["dialogues"]["scene_sampler@0.0.1:dialogue/scene"]
      Map.new(d["choices"], fn {c, o} -> {c, o["order"]} end)
    end

    assert keys.("- Zed\n  bram: ~\n- Ask\n  bram: ~\n") == %{"zed" => 1, "ask" => 2}

    assert keys.("- Zed\n  bram: ~\n- Mid\n  bram: ~\n- Ask\n  bram: ~\n") ==
             %{"zed" => 1, "mid" => 2, "ask" => 3}
  end

  # Break: a set whose choices flip its own `when:` closes on Back with no word to the writer, or
  # the warning fires where the talk ends anyway or the fact stays true.
  test "RETURN_CLOSED marks a set that shuts its own way back" do
    warned = fn head, body ->
      assert {:ok, _, diags} = sampler("npc: bram\n#{head}\nbram: ~\n" <> body, [with_facts()])
      for %{"code" => "RETURN_CLOSED"} = d <- diags, do: d["severity"]
    end

    sets = "- Ask\n  bram: ~\n  sets: knows_potter\n"

    # Break: a setter that ends the talk beside another way back is the guide's fix, not a closed set.
    assert warned.(
             "when: not knows_potter",
             sets <> "  then: end\n- Other\n  bram: ~\n  - In\n    bram: ~\n"
           ) == []

    back = sets <> "  - Back\n    bram: ~\n"
    assert warned.("when: not knows_potter", back) == ["warning"]
    assert warned.("when: knows_potter", back) == []

    assert warned.("when: not knows_potter", sets <> "  - Bye\n    bram: ~\n    then: end\n") ==
             []

    assert warned.("when: not knows_potter", "- Ask\n  bram: ~\n  - Back\n    bram: ~\n") == []
  end

  # Scene `scene`, with the `h1` or `h2` its `then`s name beside it; the given code's targets.
  defp warned_with_hubs(code, text) do
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    write(dir, "scenes/scene.scene", text)

    for k <- ~w(h1 h2), text =~ "then: #{k}" do
      write(dir, "scenes/#{k}.scene", "npc: bram\nbram: ~\n- Bye\n  bram: ~\n")
    end

    # The sampler's own bram.json would be a second Talk.
    aside = {"dialogues/bram.json", &Map.put(&1, "entry", false)}
    assert {:ok, _, diags} = Loka.ContentSource.compile(dir, [with_facts(), aside])
    for %{"code" => ^code} = d <- diags, do: d["data"]["target"]
  end

  # Break: fall-through stops at a nested set in the guess, so a shut root's real pick of two goes unwarned.
  test "ENTRY_GUESSED looks through a nested set to what Talk would open" do
    head =
      "npc: bram\nwhen: not knows_potter\nbram: ~\n- Go\n  bram: ~\n  - In\n    bram: ~\n    then: h1\n"

    assert warned_with_hubs("ENTRY_GUESSED", head <> "  - Out\n    bram: ~\n    then: h2\n") == [
             "h1"
           ]

    # The nested way back to the root is no second way on.
    assert warned_with_hubs("ENTRY_GUESSED", head <> "  - Back\n    bram: ~\n") == []
  end

  # Break: `when:` plus `once` then `then` refuses Talk for good with no word to the writer, or the
  # warning fires where something else still leads on.
  test "FALL_THROUGH_SPENT marks a shut Talk whose only free way on spends itself" do
    warned = &warned_with_hubs("FALL_THROUGH_SPENT", "npc: bram\n" <> &1)
    head = "when: not knows_potter\nbram: ~\n"
    spent = "- Go\n  bram: ~\n  once\n  sets: knows_potter\n  then: h1\n"
    lasting = "- Stay\n  bram: ~\n  then: h1\n"

    assert warned.(head <> spent) == ["scene"]

    assert warned.(
             head <>
               "- Go\n  bram: ~\n  needs: not saw_lantern\n  sets: saw_lantern\n  then: h1\n"
           ) == ["scene"]

    assert warned.(head <> "- Go\n  bram: ~\n  - In\n    bram: ~\n    once\n    then: h1\n") == [
             "scene"
           ]

    assert warned.(head <> "- Go\n  bram: ~\n  sets: knows_potter\n  then: h1\n") == []
    assert warned.(head <> spent <> lasting) == []
    assert warned.("bram: ~\n" <> spent) == []
  end

  # Break: the warning fires on a speaker whose other Talk still opens, so nothing is refused.
  test "FALL_THROUGH_SPENT stays quiet beside a second Talk" do
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    spent = "npc: bram\nwhen: not knows_potter\nbram: ~\n- Go\n  bram: ~\n  once\n  then: h1\n"
    write(dir, "scenes/scene.scene", spent)
    write(dir, "scenes/h1.scene", "npc: bram\nbram: ~\n- Bye\n  bram: ~\n")
    assert {:ok, _, diags} = Loka.ContentSource.compile(dir, [with_facts()])
    refute "FALL_THROUGH_SPENT" in Enum.map(diags, & &1["code"])
  end

  # Break: a refused choice in an out-of-order list crashes the compile before its error reaches the writer.
  test "a refused choice among unsorted ones reports its line" do
    assert {:error, [_ | _]} = sampler("npc: bram\nbram: ~\n- zebra\n  bram: ~\n- ~\n  bram: ~\n")
  end

  # Break: a child under a key too long stays a dialogue and draws an error of its own.
  test "a child under a dropped link is dropped with it" do
    long = String.duplicate("a", 70)
    text = "npc: bram\nbram: ~\n- #{long}\n  bram: ~\n  - In\n    bram: ~\n"
    assert {:error, diags} = sampler(text)
    assert Enum.map(diags, & &1["data"]["why"]) == ["nested_key_long", nil]
  end

  # Break: a story point's claim or a riddle's answer choice stops naming the choice by its words.
  test "what points at a positioned choice names its words" do
    json =
      {"dialogues/scene.json",
       %{
         "quest" => "lantern",
         "riddle" => %{
           "answer" => "tide",
           "bank" => ["T", "I", "D", "E"],
           "choice_id" => "ask",
           "wrong" => prose("~")
         },
         "choices" => %{"plain" => %{"story_point" => "tale/told"}}
       }}

    assert {:ok, out, _} =
             sampler("npc: bram\nbram: ~\n- Plain\n  bram: ~\n- Ask\n  bram: ~\n", [json])

    c = JSON.decode!(out)["cartridge"]

    assert c["story_points"]["scene_sampler@0.0.1:story_point/tale"]["outcomes"]["told"]["choice"] ==
             "plain"

    assert c["dialogues"]["scene_sampler@0.0.1:dialogue/scene"]["riddle"]["choice_id"] ==
             "ask"
  end

  # Break: the warning alone switches on the stand-in words for a refused file, so a choice with no
  # reply compiles, as `~`, instead of being refused.
  test "a scene that only warns still needs every reply" do
    text =
      "npc: bram\nbram: ~\n- Go\n  needs: saw_lantern\n  bram: ~\n  - In\n    needs: not saw_lantern\n"

    assert {:error, diags} = sampler(text)
    assert Enum.any?(diags, &(&1["data"]["error"] == "missing_property"))
  end

  # Break: a fact the choice above sets back is called unreachable under its own opposite `needs`.
  test "a needs opposite one above is reachable when the file sets that fact", %{tmp_dir: tmp} do
    text =
      "npc: bram\nbram: ~\n- Go\n  needs: a\n  sets: a false\n  bram: ~\n  - In\n    needs: not a\n"

    write(tmp, "scenes/s.scene", text)
    {_, diags} = Source.load(tmp)
    assert diags == []
  end

  defp ref(key),
    do: %{
      "cartridge_id" => "scene_sampler",
      "cartridge_version" => "0.0.1",
      "key" => key,
      "kind" => "fact"
    }

  defp compare(key), do: %{"op" => "fact_compare", "fact" => ref(key), "equals" => true}

  defp sampler(text, changes \\ []) do
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    write(dir, "scenes/scene.scene", text)
    Loka.ContentSource.compile(dir, [with_facts() | changes])
  end

  # Break (hub.ex): a `gives:` under `once` is refused as repeatable, with or without a `needs:`.
  test "gives under once passes the hub check, bare and under needs, not without once" do
    head = "npc: bram\nbram: ~\n- Stay\n  bram: ~\n- Take\n  bram: ~\n  gives: lantern\n"
    assert {:ok, _, _} = sampler(head <> "  once\n")
    assert {:ok, _, _} = sampler(head <> "  once\n  needs: saw_lantern\n")
    assert {:error, diags} = sampler(head)
    assert Enum.any?(Content.explained(diags, "/x"), &(&1 =~ "Add `once` under the choice"))
    assert {:error, [%{"code" => "OUTCOME_MISMATCH"}]} = sampler(head)
  end

  # Break: a `once` fact longer than a Key slips through, or an authored fact of that name is
  # silently replaced. `scene_<54 a>_done` is 65 bytes, one over; 53 a is exactly 64 and compiles.
  test "a once key too long or already a fact is refused at the once", %{tmp_dir: tmp} do
    fits = String.duplicate("a", 53)
    assert {:ok, _, _} = sampler("npc: bram\nbram: ~\n- #{fits}\n  once\n  bram: ~\n")

    long = String.duplicate("a", 54)
    text = "npc: bram\nbram: ~\n- #{long}\n  once\n  bram: ~\n"
    write(tmp, "scenes/s.scene", text)
    assert {:error, diags} = sampler(text)
    assert [%{"data" => %{"why" => "once_key_long"}, "path" => path}] = diags
    assert path =~ ~s(choices.#{long}.once)

    fact = {"facts.json", &put_in(&1, ["facts", "scene_go_done"], bool("met_bram"))}
    go = "npc: bram\nbram: ~\n- Go\n  once\n  bram: ~\n"
    assert {:error, [%{"data" => %{"why" => "once_key_taken"}}]} = sampler(go, [fact])

    # Two `once` choices that make one fact: scene's go_in and the nested go > in.
    two =
      "npc: bram\nbram: ~\n- Go In\n  once\n  bram: ~\n- Go\n  bram: ~\n  - In\n    once\n    bram: ~\n"

    assert {:error, [%{"data" => %{"why" => "once_key_taken", "key" => "scene_go_in_done"}}]} =
             sampler(two)
  end

  # Break: a nested key over Key 64 reaches the schema as a bare key error, or its lines vanish.
  test "a nested key too long names the opening line and keeps the checks under it", %{
    tmp_dir: tmp
  } do
    long = String.duplicate("a", 63)
    text = "npc: bram\nbram: hi\n- #{long}\n  bram: x\n  - In\n    sets: a b c\n"
    write(tmp, "scenes/s.scene", text)
    {_, diags} = Source.load(tmp)
    got = Enum.map(diags, &{&1["data"]["line"], &1["data"]["why"]})
    assert got == [{5, "nested_key_long"}, {6, "bad_sets"}]
    assert hd(diags)["data"]["key"] == "s_#{long}"
    assert Enum.any?(Content.explained(diags, tmp), &(&1 =~ "scenes/s.scene:5"))
  end

  # Break: the longest key Key allows is refused with the one over it.
  test "a nested key of exactly 64 bytes compiles", %{tmp_dir: tmp} do
    write(
      tmp,
      "scenes/s.scene",
      "npc: bram\nbram: hi\n- #{String.duplicate("a", 62)}\n  bram: x\n  - In\n    bram: y\n"
    )

    {_, diags} = Source.load(tmp)
    assert diags == []
  end

  # Break: a sidecar JSON silently replaces a scene's words, or a sidecar's own addition (the
  # keyword), or a nested child's sidecar, is treated the same.
  test "a same-key JSON refuses only what it writes over the scene", %{tmp_dir: tmp} do
    write(tmp, "scenes/s.scene", "npc: bram\nbram: hi\n- Go\n  bram: x\n  - In\n    bram: y\n")
    write(tmp, "dialogues/s.json", ~s({"keyword": "k", "prompt": {"prose": "b"}}))
    write(tmp, "dialogues/s_go.json", ~s({"choices": {"in": {"narration": {"prose": "b"}}}}))
    {_, diags} = Source.load(tmp)
    got = for d <- diags, do: {d["path"], d["data"]["why"], d["data"]["key"]}

    assert Enum.sort(got) == [
             {"dialogues/s.prompt", "scene_overlap", "s"},
             {"dialogues/s_go.choices.in.narration", "scene_overlap", "s_go"}
           ]

    assert Enum.any?(
             Content.explained(diags, tmp),
             &(&1 =~ "dialogues/s.json:1" and &1 =~ "`prompt`")
           )
  end

  test "a choice beside a nested set comes back, as it does in a scene with no nesting" do
    # Break: a nested child's `then` makes the parent a then target, and such a dialogue never
    # reopens, so a plain choice in any nesting scene would end the talk.
    text = """
    npc: bram

    bram: ~
    - Look
      bram: ~
    - Bye
      then: end
      bram: ~
    - Ask
      bram: ~
      - Who
        bram: ~
    """

    {[{"bram", d} | _], []} = SceneFiles.parse(text, "bram")

    assert d["choices"]["look"]["then"] == "bram"
    assert d["choices"]["bye"]["then"] == "end"
    assert d["choices"]["ask"]["then"] == "bram_ask"
  end

  # Break: a person's second nested scene is refused or warns, the top is marked and shuts out the
  # person's other scenes, or a set can be opened by Talk.
  test "a person's nested scenes compile alone: sets marked, tops not" do
    # Two ways on from the `when:` top: a set counted as a fall-through target would warn ENTRY_GUESSED.
    nested =
      "npc: bram\nbram: ~\n- Go\n  bram: ~\n  - In\n    bram: ~\n- Off\n  bram: ~\n  - Up\n    bram: ~\n"

    dir = Loka.ContentSource.copy("cartridges/scene_sampler")

    write(
      dir,
      "scenes/next.scene",
      String.replace(nested, "bram: ~\n-", "when: met_bram\nbram: ~\n-", global: false)
    )

    write(dir, "scenes/scene.scene", nested)
    assert {:ok, built, []} = Loka.ContentSource.compile(dir, [with_facts()])
    dialogues = JSON.decode!(built)["cartridge"]["dialogues"]
    assert dialogues["scene_sampler@0.0.1:dialogue/next_go"]["entry"] == false

    for key <- ~w(scene next),
        do: refute(Map.has_key?(dialogues["scene_sampler@0.0.1:dialogue/#{key}"], "entry"))
  end

  # Break: a sidecar turns a set into what Talk opens, or a shut-out top warns once per set too.
  test "a set's marker is the scene's, and a shut-out top warns alone", %{tmp_dir: tmp} do
    write(tmp, "scenes/s.scene", "npc: bram\nbram: ~\n- Go\n  bram: ~\n  - In\n    bram: ~\n")
    write(tmp, "dialogues/s_go.json", ~s({"entry": true}))
    {_, diags} = Source.load(tmp)
    assert Enum.any?(diags, &(&1["path"] =~ "s_go" and &1["path"] =~ "entry"))

    nested = "npc: bram\nbram: ~\n- Go\n  bram: ~\n  - In\n    bram: ~\n"
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    write(dir, "scenes/scene.scene", nested)
    write(dir, "scenes/next.scene", nested)
    write(dir, "dialogues/scene.json", ~s({"entry": true}))
    assert {:ok, _, unused} = Loka.ContentSource.compile(dir, [with_facts()])

    assert Enum.sort(for w <- unused, do: {w["code"], w["data"]["target"]}) ==
             [{"ENTRY_UNUSED", "bram"}, {"ENTRY_UNUSED", "next"}]
  end

  # Break: a JSON writing the compiler's order mark silently reorders a dialogue: beside a sorted
  # scene, on a JSON dialogue, or in an area bundle.
  test "a choice's order written outside a scene is refused", %{tmp_dir: tmp} do
    order = ~s("choices": {"a": {"order": 1}})
    write(tmp, "scenes/s.scene", "npc: bram\nbram: ~\n- A\n  bram: ~\n- B\n  bram: ~\n")
    write(tmp, "dialogues/s.json", "{#{order}}")
    write(tmp, "scenes/u.scene", "npc: bram\nbram: ~\n- B\n  bram: ~\n- A\n  bram: ~\n")
    write(tmp, "dialogues/u.json", "{#{order}}")
    write(tmp, "dialogues/j.json", ~s({"npc": "bram", #{order}}))
    write(tmp, "areas/a.json", ~s({"dialogues": {"k": {"npc": "bram", #{order}}}}))
    {_, diags} = Source.load(tmp)
    got = for d <- diags, is_map_key(d["data"], "why"), do: {d["data"]["why"], d["path"]}

    why = "choice_order_written"

    assert Enum.sort(got) == [
             {why, "areas/a.dialogues.k.choices.a.order"},
             {why, "dialogues/j.choices.a.order"},
             {why, "dialogues/s.choices.a.order"},
             {why, "dialogues/u.choices.a.order"}
           ]
  end

  # Break: `asked` reads as a reply or a bad line, or lowers to nothing the view can read.
  test "asked under a choice lowers as the JSON field does, at its own line" do
    assert {:ok, built, _} = sampler("npc: bram\nbram: ~\n- Go\n  asked\n  bram: ~\n")

    go =
      JSON.decode!(built)["cartridge"]["dialogues"]["scene_sampler@0.0.1:dialogue/scene"][
        "choices"
      ]["go"]

    assert go["asked_when"] == compare("scene_go_asked")

    assert {:error, [%{"data" => %{"why" => "bad_asked"}}]} =
             sampler("npc: bram\nbram: ~\n- Go\n  asked now\n  bram: ~\n")

    # A refused choice's `asked` adds nothing and does not crash on the choice that was not made.
    twice = "npc: bram\nbram: ~\n- Go\n  bram: ~\n- Go\n  asked\n  bram: ~\n"
    assert {:error, [_]} = sampler(twice)

    fact = {"facts.json", &put_in(&1, ["facts", "scene_go_asked"], bool("met_bram"))}
    go_scene = "npc: bram\nbram: ~\n- Go\n  asked\n  bram: ~\n"
    assert {:error, [%{"data" => %{"why" => "asked_key_taken"}} = d]} = sampler(go_scene, [fact])
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    write(dir, "scenes/scene.scene", go_scene)
    assert hd(Content.explained([d], dir)) =~ "scenes/scene.scene:4"
  end

  test "a scene with no nesting gets no then of its own" do
    # Break: the coming-back line on every scene, which changes every existing compiled hash.
    {[{"bram", d}], []} = SceneFiles.parse("npc: bram\n\nbram: ~\n- Look\n  bram: ~\n", "bram")

    refute is_map_key(d["choices"]["look"], "then")
  end
end
