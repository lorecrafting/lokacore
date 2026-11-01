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
    - Who
      bram: ~
      sets: knows_potter
    - Leave
      bram: ~
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
    assert {:error, [%{"code" => "OUTCOME_MISMATCH"}]} = sampler(head)
  end

  # Break: a `once` fact longer than a Key slips through, or an authored fact of that name is
  # silently replaced.
  test "a once key too long or already a fact is refused at the once", %{tmp_dir: tmp} do
    long = String.duplicate("a", 60)
    text = "npc: bram\nbram: ~\n- #{long}\n  once\n  bram: ~\n"
    write(tmp, "scenes/s.scene", text)
    assert {:error, diags} = sampler(text)
    assert [%{"data" => %{"why" => "once_key_long"}, "path" => path}] = diags
    assert path =~ ~s(choices.#{long}.once)

    fact = {"facts.json", &put_in(&1, ["facts", "scene_go_done"], bool("met_bram"))}
    go = "npc: bram\nbram: ~\n- Go\n  once\n  bram: ~\n"
    assert {:error, [%{"code" => "RESERVED_FACT"}]} = sampler(go, [fact])
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

  test "a scene with no nesting gets no then of its own" do
    # Break: the coming-back line on every scene, which changes every existing compiled hash.
    {[{"bram", d}], []} = SceneFiles.parse("npc: bram\n\nbram: ~\n- Look\n  bram: ~\n", "bram")

    refute is_map_key(d["choices"]["look"], "then")
  end
end
